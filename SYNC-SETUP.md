# ⚡ Real-time sync setup (one-time, ~10 minutes)

Sparkle's real-time sync uses a free [Supabase](https://supabase.com) project as the shared home for your household's data. Both phones read and write the same record, so changes appear on the other phone within seconds. **Only one of you does this setup** — the other just pastes a pairing code.

## Part 1 — create the backend

1. Go to **https://supabase.com** → *Start your project* → sign up (free, no credit card).
2. Create a **New project**. Pick any name (e.g. `sparkle`), generate a database password (you won't need it again), choose a region close to you (e.g. West EU), and wait ~1 minute for it to provision.
3. In the left sidebar open **SQL Editor**, paste the block below, and click **Run**:

```sql
create table if not exists sparkle_state (
  household  text primary key,
  doc        jsonb not null,
  rev        bigint not null default 0,
  updated_at timestamptz not null default now()
);

alter table sparkle_state enable row level security;

create policy "sparkle_anon_all" on sparkle_state
  for all to anon using (true) with check (true);

alter publication supabase_realtime add table sparkle_state;
```

4. In the left sidebar open **Project Settings → API** and keep this page open. You need two values:
   - **Project URL** — looks like `https://abcdefgh.supabase.co`
   - **anon public** key — a long string starting with `eyJ…`

## Part 2 — connect the phones

5. On **your** phone, open Sparkle → **Settings → ⚡ Set up real-time sync**. Paste the Project URL and the anon key, tap **Create household**. The app then offers the pairing code to share.
6. Send the pairing code to your partner (iMessage/WhatsApp).
7. On **your partner's** phone: Sparkle → **Settings → Set up real-time sync** → paste the code in the *Pairing code* box → **Pair this phone**. (A brand-new phone can also tap "I have a pairing code" right on the welcome screen.)

That's it. Add or complete a task on one phone and watch it appear on the other. Both phones keep working offline; they catch up automatically when back online.

> **A note on privacy:** the pairing code contains the project URL, the anon key, and your household ID — anyone holding it can read and write your cleaning schedule (and nothing else). Share it only with each other. You can rotate the anon key in Supabase settings if it ever leaks.

## Part 3 (optional) — tasks in the iPhone Calendar app

This publishes your planned tasks as a subscribable calendar feed that updates automatically.

1. In Supabase open **Edge Functions** (left sidebar) → **Deploy a new function** → *Via Editor*.
2. Name it exactly `calendar`, replace the sample code with the contents of [`supabase/functions/calendar/index.ts`](supabase/functions/calendar/index.ts) from this repository, and deploy.
3. In the function's **Details** page, turn **off** "Enforce JWT verification" (the iPhone Calendar app can't authenticate; the feed is protected by your secret household ID instead).
4. In Sparkle: **Settings → 📅 Copy calendar feed link**.
5. On each iPhone: **Settings → Apps → Calendar → Calendar Accounts → Add Account → Other → Add Subscribed Calendar** → paste the link.

Planned tasks now show up as all-day events named like "🧹 Vacuum living room (Lisa)". iOS refreshes subscribed calendars periodically, so completed tasks disappear and new plans appear on their own.

## Troubleshooting

- **"Couldn't connect" when creating the household** — re-check the URL/key, and make sure the SQL from step 3 ran without errors.
- **Changes don't appear in real time but do after reopening the app** — make sure the SQL's last line ran (`alter publication supabase_realtime add table sparkle_state`); it enables live updates.
- **Calendar feed shows nothing** — confirm JWT verification is off for the function and that the link ends with `?h=<your household id>`.
- **Supabase pauses free projects after ~1 week of inactivity** — normal use (opening the app) counts as activity; if it ever pauses, one click in the dashboard resumes it and no data is lost.
