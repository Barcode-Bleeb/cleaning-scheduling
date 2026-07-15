// Sparkle calendar feed — Supabase Edge Function.
// Serves the household's planned tasks as an iCalendar (.ics) feed that the
// iPhone Calendar app can subscribe to. Deploy as function name "calendar"
// with JWT verification DISABLED (the Calendar app can't send auth headers).
// See SYNC-SETUP.md in the repository root.

import { createClient } from "npm:@supabase/supabase-js@2";

function icsEscape(s: string): string {
  return String(s).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}
function icsDate(iso: string): string {
  return iso.replace(/-/g, "");
}
function nextDay(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + 1));
  return dt.toISOString().slice(0, 10).replace(/-/g, "");
}

Deno.serve(async (req) => {
  const h = new URL(req.url).searchParams.get("h");
  if (!h) return new Response("missing household parameter ?h=", { status: 400 });

  const db = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { data, error } = await db.from("sparkle_state").select("doc").eq("household", h).maybeSingle();
  if (error) return new Response("db error", { status: 500 });
  if (!data) return new Response("unknown household", { status: 404 });

  const doc = data.doc as {
    people: Record<string, { name: string }>;
    tasks: Array<{ id: string; title: string; icon: string; person: string; date: string; notes?: string }>;
  };
  const stamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";

  const events = (doc.tasks || []).map((t) => {
    const who = doc.people?.[t.person]?.name || "?";
    return [
      "BEGIN:VEVENT",
      `UID:${t.id}@sparkle`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${icsDate(t.date)}`,
      `DTEND;VALUE=DATE:${nextDay(t.date)}`,
      `SUMMARY:${icsEscape(`${t.icon} ${t.title} (${who})`)}`,
      `DESCRIPTION:${icsEscape((t.notes ? t.notes + "\n" : "") + "Planned in Sparkle")}`,
      "END:VEVENT",
    ].join("\r\n");
  });

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Sparkle//Cleaning planner//EN",
    "X-WR-CALNAME:Sparkle cleaning",
    "X-PUBLISHED-TTL:PT1H",
    ...events,
    "END:VCALENDAR",
    "",
  ].join("\r\n");

  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Cache-Control": "max-age=300",
    },
  });
});
