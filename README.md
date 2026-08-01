# 🧽 Sparkle — a cleaning planner for your household

A tiny, installable web app for planning the household cleaning. It adapts to your household size — **1 person** (personal reminders), **2** (the classic couple view), or **3–8** (a group) — and changes its screens and stats to match. No accounts, no servers, no app store — it runs entirely on your phone.

## What it does

- **Any household, 1–8 people** — the interface adapts: Solo gets a personal view, Duo the couple view, Group the multi-person view. Add, rename, recolour, reorder, or retire people in Settings.
- **Plan tasks on a date** — with an icon, notes, and an assignee.
- **Recurring chores** — daily / weekly / bi-weekly / monthly etc. Completing one automatically plans the next.
- **Take turns 🔄** — recurring tasks rotate through the household in the order you set; fixed chores return to their owner.
- **Take over 🤝** — pick up someone else's task; it's tracked separately from a silent edit, and shown in the stats.
- **Postpone** — move a task with one tap (+1 day, +2 days, +1 week, or pick a date). Postpones are counted.
- **Stats dashboard** — who did what and how often, task balance, postpone counts, take-overs (took over / taken from / net), how often tasks were done on their first planned date, and an 8-week activity chart. Filterable by all time / 90 / 30 / 7 days.
- **Starter chores** — one tap adds a sensible set of common recurring tasks.
- **Undo** — accidentally marked something done? Undo it from "Recently done".
- **Real-time sync** *(optional)* — both phones share one live schedule via a free Supabase backend. One-time setup: see [SYNC-SETUP.md](SYNC-SETUP.md).
- **iPhone Calendar integration** — add any task to your calendar from its action sheet, or (with sync enabled) subscribe to an auto-updating calendar feed of all planned tasks.
- **Push notifications** *(optional, with sync)* — a morning summary of today's tasks and a ping when someone else completes something; per-phone opt-in and toggles. See [SYNC-SETUP.md](SYNC-SETUP.md) Part 4.
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

Two options:

- **Real-time (recommended):** follow [SYNC-SETUP.md](SYNC-SETUP.md) once (~10 minutes, free). Changes then appear on the other phone within seconds, and the app keeps working offline.
- **Manual:** **Settings → Export** on one phone, send the code, **Settings → Import** on the other. The imported data fully replaces what's on the receiving phone.

## Documentation

Longer-form guides live in [`docs/`](docs/). All three are PDFs (open on GitHub, or download).

| Document | For whom | What it covers |
|---|---|---|
| [📘 Course Manual](docs/Sparkle-Course-Manual.pdf) *(32 pages)* | Anyone wanting to **understand** the app | A beginner-friendly walkthrough: the system at a glance, how the app was built step by step, how to read the code, the data & state model, PWA/offline, Git & GitHub hosting, a deep dive on the Supabase backend, real-time sync internals, notifications & calendar, testing, and a rubric for reading code like a reviewer. |
| [📄 Quick Reference](docs/Sparkle-Quick-Reference.pdf) *(2 pages)* | Quick lookups | A cheat-sheet companion to the manual: mental models, the file map, the *data → render* loop, review flags, and a mini-glossary. |
| [🚀 Setup Guide](docs/Sparkle-Setup-Guide.pdf) *(4 pages)* | A **new household** getting started | Step-by-step to run Sparkle on your two phones — *Basic* (no accounts, ~2 min) or *Full* (own free Supabase project for sync, notifications & calendar, ~15 min), with a checklist and troubleshooting. |

For the exact backend setup steps (SQL, Edge Functions, scheduling), see [SYNC-SETUP.md](SYNC-SETUP.md).

## Development

Plain HTML/CSS/JS — no build step, no dependencies.

| File | Purpose |
|---|---|
| `index.html` | The entire app (UI + logic + styling in one file) |
| `manifest.webmanifest` | PWA manifest (name, icons, standalone display) |
| `sw.js` | Service worker for offline use and auto-updates |
| `icons/` | App icons |
| `supabase/functions/` | Edge Functions: the calendar feed and push-notification sender |
| `docs/` | Course manual, quick reference, and setup guide (PDFs) |

To run locally: `python3 -m http.server` and open `http://localhost:8000`.
