# 🧽 Sparkle — a cleaning planner for two

A tiny, installable web app for planning the household cleaning between you and your partner. No accounts, no servers, no app store — it runs entirely on your phone.

## What it does

- **Plan tasks on a date** — with an icon, notes, and an assignee.
- **Recurring chores** — daily / weekly / bi-weekly / monthly etc. Completing one automatically plans the next.
- **Take turns 🔄** — recurring tasks can alternate between the two of you automatically.
- **Postpone** — move a task with one tap (+1 day, +2 days, +1 week, or pick a date). Postpones are counted.
- **Stats dashboard** — who did what and how often, task balance between the two of you, postpone counts, how often tasks were done on their first planned date, and an 8-week activity chart. Filterable by all time / 90 / 30 / 7 days.
- **Starter chores** — one tap adds a sensible set of common recurring tasks.
- **Undo** — accidentally marked something done? Undo it from "Recently done".
- **Works offline** and in light & dark mode.

## Getting it on your iPhones (one-time setup)

1. **Publish the app with GitHub Pages** (free):
   - On GitHub, open this repository → **Settings** → **Pages**.
   - Under *Build and deployment*, set **Source** to *Deploy from a branch*, pick branch **`main`** and folder **`/ (root)`**, then save.
   - After a minute your app is live at `https://<your-username>.github.io/cleaning-scheduling/`.
2. **Install it on both iPhones**:
   - Open that URL in **Safari**.
   - Tap the **Share** button → **Add to Home Screen**.
   - Sparkle now opens full-screen like a normal app, works offline, and keeps its data.

## Keeping two phones in sync

Your data is stored on the phone itself (no server), so each phone has its own copy. To sync up:

1. On the phone with the latest data: **Settings → Export** — this shares/copies a code.
2. Send it via iMessage/WhatsApp.
3. On the other phone: **Settings → Import** → paste → done.

Doing this once a week (or after a big planning session) is plenty. The imported data fully replaces what's on the receiving phone.

## Development

Plain HTML/CSS/JS — no build step, no dependencies.

| File | Purpose |
|---|---|
| `index.html` | The entire app (UI + logic) |
| `manifest.webmanifest` | PWA manifest (name, icons, standalone display) |
| `sw.js` | Service worker for offline use |
| `icons/` | App icons |

To run locally: `python3 -m http.server` and open `http://localhost:8000`.
