# BYB! — Ban' Yuh Belly Budgeting

Household envelope budgeting for the family. React + Vite frontend, Express
API with JSON-file storage, password logins, XLSX export, and an automation
API for n8n. Runs on a laptop for development and on TrueNAS SCALE (Docker)
for the household.

## Quick start (local)

```bash
cd "Budget App"
npm install
npm start          # runs the Vite dev server (:5173) AND the API server (:3001)
```

Open http://localhost:5173. The Vite dev server proxies `/api/*` to the
Express server.

Other scripts:

```bash
npm run dev        # frontend only
npm run server     # API only (also serves dist/ if it exists)
npm run build      # production bundle to dist/
npm run preview    # sanity-check the production build
npm test           # Jest suite (jsdom)
npm run money:dry-run -- /path/to/budget.json  # inspect legacy data without changing it
```

## Project structure

```
Budget App/
├── server.js                  ← Express API: auth, data, integrations
├── index.html                 ← Vite entry point
├── vite.config.js             ← dev server + /api proxy
├── Dockerfile                 ← production image (build + serve)
├── docker-compose.yml         ← TrueNAS-friendly deployment
├── .env.example               ← server configuration reference
├── byb-backup.sh              ← scheduled, verified backup of every instance
├── byb-restore.sh             ← restore one instance from a backup
├── BACKUP.md                  ← backup/restore: install, verify, recover
├── UPDATE-NOTES.md            ← what changed in the latest update
├── public/                    ← logo, manifest, service worker (sw.js)
└── src/
    ├── main.jsx               ← root: data loading, debounced saves, SW registration
    ├── BudgetApp.jsx          ← app shell: state, handlers, tab navigation
    ├── lib/                   ← constants.js (palette, defaults), utils.js
    ├── hooks/                 ← useIsMobile, useLongPress
    ├── styles/                ← global.css (theme vars, motion), buildStyles.js
    ├── components/            ← Sidebar, Header, forms, modals, AddIncomeFlow,
    │                            ConfirmDialog, QuickActions, Icons, PieChart…
    ├── views/                 ← Dashboard, Transactions, Envelopes, Recurring,
    │                            Reports, LoginPage
    ├── xlsx-helpers.js        ← exportToXlsx / importFromXlsx (ExcelJS)
    └── BudgetApp.test.jsx     ← Jest + React Testing Library suite
```

The root-level `BudgetApp.jsx`, `BudgetApp-revised.jsx`, `BudgetApp.test.jsx`,
`wireframe.md`, `schema.md` and `test-summary.md` are the original agent audit
trail from v0.3–v0.5. They are historical documents — the running code lives
under `src/`.

## How it works

- **Envelopes** — each expense category is an envelope with a monthly fill
  amount (`baseAmount`) and a current balance. Income lands in **Unallocated**
  and moves into envelopes via fills, splits, or transfers.
- **Add Income** (Dashboard / Transactions) — one flow for all money in:
  choose a stream (or create one inline), enter the amount, then keep it
  unallocated, run a fill, or split it across envelopes.
- **Reconcile** (Dashboard) — end of month: surpluses from non-savings
  envelopes are pooled, deficits covered, remainder returned to Unallocated.
  Every run is recorded in the reconcile history (Reports).
- **Recurring** — weekly/fortnightly/monthly rules; due rules post with one
  click and advance their next-due date.
- **Reports** — net worth (manual asset snapshots), summary and a distribution
  pie that switches between one month and any custom date range, plus one
  selectable envelope spending chart (Groceries by default) with five-month or
  one-year bars and month-over-month comparisons (click through to transactions),
  transfers and reconcile logs, XLSX export, direct bank-statement CSV import
  with preview and duplicate protection, and AI-assisted JSON paste import.
  Accumulating envelopes can carry a target amount and due date, with the
  remaining amount and required monthly fill shown on both Envelopes and the
  Dashboard. Reports retain each month's envelope plan from the month this
  feature is installed and compare it with actual spending; older plans are
  not fabricated because the previous data model did not record them.
- **Transaction filters** — explicit From/To dates show a prominent total spent
  for the exact filtered result. Transaction descriptions suggest previously
  used household entries as the user types; the history stays local.

## Data & persistence

All data lives in `data/` next to `server.js` (or `BYB_DATA_DIR`):

- `budget.json` — transactions, categories, recurring rules, users, assets,
  transfers, reconcile log, and a `dataVersion` counter used to detect
  concurrent edits. Money is stored as integer cents and marked with
  `moneyScale: 100`; display, XLSX, webhooks and integration responses remain
  ordinary AUD dollars.
- `passwords.json` — bcrypt hashes. First sign-in sets the password.
- `sessions.json` — bearer tokens with expiry (default 72 h).

Back up the `data/` directory and you have everything. On TrueNAS that is done
by `byb-backup.sh`, which backs up every household's `budget.json` and
`passwords.json` on a schedule, verifies what it wrote, and rotates history —
see **[BACKUP.md](BACKUP.md)** for installing it as a cron job, confirming it is
still running, and restoring. Restoring is not simply "copy the file back":
`byb-restore.sh` also has to invalidate sessions, or a browser still holding the
old data can silently overwrite the restore. BACKUP.md explains why.

### Integer-cents migration

On first start with a legacy dollar-valued `budget.json`, the server validates
every recognised money path, writes a same-directory temporary file, flushes
it, and atomically replaces the original. It leaves the exact original as
`budget.pre-cents-<hash>.json`. Already-migrated files are validated and left
unchanged, so restarts never convert twice. Unknown numeric fields or unknown
money scales stop startup rather than being guessed.

```bash
node migrate-money.js --dry-run /path/to/budget.json
```

Rollback is a paired operation: stop the cents-aware image, restore the
pre-cents `budget.json` (plus its matching `passwords.json` when restoring a
scheduled backup), clear sessions, then start the prior image. Never run an old
dollar-based image against a `moneyScale: 100` file.

New clients identify cents requests with `X-BYB-Money-Scale: 100`. Legacy tabs
remain dollar-compatible; the migration's one-time `dataVersion` bump makes a
stale write take the normal conflict path.

## Authentication

Pick a user on the login page and enter a password. The first password ever
set promotes that user to owner. Admins can add users and change roles from
Settings (avatar button, top right).

## Integrations (n8n)

Set `BYB_API_KEY` in the environment, then:

```
GET /api/integrations/summary
x-api-key: <your key>
```

returns unallocated balance, per-envelope balances, month-to-date income and
expenses, low envelopes, upcoming bills (7 days), net worth, and the last
reconcile — ready for a daily-briefing workflow in n8n (HTTP Request node).

Optionally set `BYB_WEBHOOK_URL` to receive a POST whenever someone presses
Reconcile.

## Deployment (TrueNAS SCALE)

```bash
docker compose up -d --build
```

- The compose file maps `./data` into the container — point it at a dataset
  (e.g. `/mnt/tank/apps/byb`) so budget data survives image rebuilds.
- The app serves on port 3001 (HTTP). Put Tailscale or a reverse proxy in
  front for HTTPS; the server's security headers already assume this.
- Set `BYB_API_KEY` / `BYB_WEBHOOK_URL` in the compose environment to enable
  the n8n integration.

Once deployed, open the address on your phone and "Add to Home Screen" — the
app is a PWA and behaves like a native app.

## Colour palette

- Primary `#7FB069` (muted green)
- Secondary `#B8D4AE` (sage)
- Text `#1A1A1A` on light, `#F5F5F5` on dark

## Troubleshooting

- **"Could not reach the server"** — run `npm start` (not just `npm run dev`);
  the API server must be running on :3001.
- **Save conflict messages** — two people edited at once. Your unsaved changes
  stay on screen and no automatic retry occurs. Use the clearly labelled
  discard-and-reload action only when you are ready to replace them with the
  latest server copy.
- **Service worker serving stale assets after an update** — hard-refresh once
  (Ctrl+Shift+R); the worker takes over on the next load.
- **Port in use** — change `BYB_PORT` (server) or `server.port` in
  `vite.config.js` (frontend).
