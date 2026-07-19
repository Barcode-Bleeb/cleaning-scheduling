// Sparkle push notifications — Supabase Edge Function.
// Deploy as function name "push" with JWT verification DISABLED
// (the app calls it with only the household ID as shared secret,
// and pg_cron triggers the morning reminder without auth headers).
// See SYNC-SETUP.md Part 4.

import { createClient } from "npm:@supabase/supabase-js@2";
import { generateVapidKeys, sendPush } from "./webpush.js";

const TIMEZONE = "Europe/Amsterdam"; // used to decide what "today" means for reminders
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const json = (obj: unknown, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json", ...CORS } });

function db() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

async function getVapid(client: ReturnType<typeof db>) {
  const { data } = await client.from("sparkle_push_keys").select("public_key, private_jwk").eq("id", 1).maybeSingle();
  if (data) return { publicKey: data.public_key, privateJwk: data.private_jwk };
  const keys = await generateVapidKeys();
  const { error } = await client.from("sparkle_push_keys").insert({ id: 1, public_key: keys.publicKey, private_jwk: keys.privateJwk });
  if (error) { // lost a race with a concurrent first call — read the winner's keys
    const { data: again } = await client.from("sparkle_push_keys").select("public_key, private_jwk").eq("id", 1).single();
    return { publicKey: again!.public_key, privateJwk: again!.private_jwk };
  }
  return { publicKey: keys.publicKey, privateJwk: keys.privateJwk };
}

// send to one subscription; drop it from the table if the push service says it's gone
async function deliver(client: ReturnType<typeof db>, vapid: any, sub: any, payload: unknown) {
  try {
    const status = await sendPush(sub.sub, payload, vapid);
    if (status === 404 || status === 410) {
      await client.from("sparkle_push_subs").delete().eq("endpoint", sub.endpoint);
    }
    return status;
  } catch (_e) {
    return 0;
  }
}

function todayIso(): string {
  // YYYY-MM-DD in the household's timezone
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE }).format(new Date());
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  const client = db();

  if (req.method === "GET") {
    const vapid = await getVapid(client);
    return json({ publicKey: vapid.publicKey });
  }

  let body: any;
  try { body = await req.json(); } catch (_e) { return json({ error: "bad json" }, 400); }

  if (body.action === "subscribe") {
    const { h, sub, person, remind, completions } = body;
    if (!h || !sub?.endpoint || !sub?.keys) return json({ error: "missing fields" }, 400);
    const { error } = await client.from("sparkle_push_subs").upsert({
      endpoint: sub.endpoint, household: h, person: person || "p1", sub,
      remind: remind !== false, completions: completions !== false,
    });
    return error ? json({ error: error.message }, 500) : json({ ok: true });
  }

  if (body.action === "unsubscribe") {
    await client.from("sparkle_push_subs").delete().eq("endpoint", body.endpoint || "");
    return json({ ok: true });
  }

  if (body.action === "completed") {
    const { h, endpoint, title, byName } = body;
    if (!h || !title) return json({ error: "missing fields" }, 400);
    const vapid = await getVapid(client);
    const { data: subs } = await client.from("sparkle_push_subs")
      .select("endpoint, sub").eq("household", h).eq("completions", true).neq("endpoint", endpoint || "-");
    let sent = 0;
    for (const s of subs || []) {
      const status = await deliver(client, vapid, s, {
        title: "✅ " + (byName || "Your partner") + " just did",
        body: String(title).slice(0, 120),
        tag: "sparkle-done",
      });
      if (status >= 200 && status < 300) sent++;
    }
    return json({ ok: true, sent });
  }

  if (body.action === "remind") {
    // throttle: at most one reminder round per 6 hours, so a stray extra
    // call (this endpoint is unauthenticated) can't spam anyone
    const { data: gate } = await client.from("sparkle_push_keys").select("last_remind").eq("id", 1).maybeSingle();
    const last = gate?.last_remind ? new Date(gate.last_remind).getTime() : 0;
    if (Date.now() - last < 6 * 3600 * 1000) return json({ ok: true, skipped: "too soon" });
    const vapid = await getVapid(client);
    await client.from("sparkle_push_keys").update({ last_remind: new Date().toISOString() }).eq("id", 1);

    const today = todayIso();
    const { data: households } = await client.from("sparkle_state").select("household, doc");
    let sent = 0;
    for (const hh of households || []) {
      const doc = hh.doc as any;
      const due = (doc.tasks || []).filter((t: any) => t.date <= today);
      if (!due.length) continue;
      const { data: subs } = await client.from("sparkle_push_subs")
        .select("endpoint, sub, person").eq("household", hh.household).eq("remind", true);
      for (const s of subs || []) {
        const mine = due.filter((t: any) => t.person === s.person);
        const partnerId = s.person === "p1" ? "p2" : "p1";
        const partnerName = doc.people?.[partnerId]?.name || "your partner";
        const theirs = due.length - mine.length;
        const parts = [];
        if (mine.length) parts.push(`${mine.length} for you (${mine.map((t: any) => t.title).slice(0, 3).join(", ")}${mine.length > 3 ? "…" : ""})`);
        if (theirs) parts.push(`${theirs} for ${partnerName}`);
        const status = await deliver(client, vapid, s, {
          title: `🧽 Today at home: ${due.length} task${due.length > 1 ? "s" : ""}`,
          body: parts.join(" · ") || "All caught up!",
          tag: "sparkle-remind",
        });
        if (status >= 200 && status < 300) sent++;
      }
    }
    return json({ ok: true, sent });
  }

  return json({ error: "unknown action" }, 400);
});
