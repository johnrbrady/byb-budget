# BYB! v0.7 — Update Notes

## Current production upgrade

- Monetary values are migrated once from decimal dollars to exact integer
  cents (`moneyScale: 100`) before the server accepts requests.
- The original file is retained as a hash-named pre-cents recovery copy and
  the migration is atomic, validated, idempotent, and available in dry-run
  mode with `npm run money:dry-run -- <budget.json>`.
- Forms reject more than two decimal places; XLSX imports round to the nearest
  cent and report that rounding. XLSX exports and external integrations remain
  dollar-valued.
- Concurrent-save conflicts retain the losing person's unsaved screen and
  require an explicit discard-and-reload choice; no stale snapshot is retried.
- Date-filtered transactions now show the exact total spent at the top.
- Reports now show one user-selected category bar chart at a time (Groceries by
  default), and the distribution pie supports either one month or any custom
  From/To period.
- Transaction descriptions offer tappable suggestions from the household's own
  prior entries; no external prediction service is used.

The v0.7 notes below describe the earlier release. The current upgrade changes
`budget.json` money values to cents on first server start and retains the exact
pre-cents file for recovery. `passwords.json` and `sessions.json` are unchanged.

## How to apply the update

```bash
cd "Budget App"
npm install        # no new dependencies, but refreshes the lockfile
npm start          # Vite dev server + API server
```

For production / TrueNAS:

```bash
npm run build
npm run server     # serves the built app + API on :3001
```

or use Docker (see README → Deployment).

**Existing users keep their data.** Logins, passwords, balances, transactions
and history are preserved. Each user may see the welcome screen
at most once more (on devices that had never dismissed it); after that the
"seen" flag is stored on their account, not the browser.

## What changed

### Fixes
- **Welcome screen repeating** — the flag was stored per-browser and was
  wiped every time a session expired. It now lives on the user record
  server-side and follows the account across devices.
- **Income allocation drift** — editing or deleting an income transaction
  that had been allocated to an envelope now reverses the envelope effect
  correctly. Allocations are stored on the transaction (`allocations` array).
- **Concurrent saves** — the server now versions the data file. If two
  family members save at once, the second save is rejected and that client
  reloads the latest data instead of silently overwriting it.

### New
- **Unified Add Income flow** (Dashboard + Transactions): pick an income
  stream or create a new one inline, enter the amount (with a "Stay
  Consistent" shortcut from recurring rules), then choose where it goes —
  Unallocated, a full envelope fill, or specific envelopes with splits.
- **Reconcile logging** — every reconcile records who ran it, when, how much
  was pooled, topped up and returned. History shows in Reports.
- **n8n integration** — `GET /api/integrations/summary` returns a full
  budget summary (balances, month totals, upcoming bills, net worth, last
  reconcile) authenticated by `BYB_API_KEY`. Optionally, set
  `BYB_WEBHOOK_URL` to receive a POST whenever someone reconciles.
- **Gestures** — swipe left/right anywhere to move between tabs. Long-press
  an envelope for quick actions (fill, view transactions, edit). Long-press
  the + button on Transactions to choose income/expense/transfer. Envelope
  reordering now starts from the drag handle.
- **PWA** — service worker added; install the app to your phone's home
  screen from your TrueNAS address and it loads instantly.

### Polish
- Proper SVG icon set replaces emoji and PNG nav icons.
- Animated view transitions, panel slide-ins, number ticks on balances,
  button/input hover and focus states, styled scrollbars, skeleton loading
  screen instead of "Loading…".
- All `window.confirm` popups replaced with styled confirmation dialogs.
- The month selector in the header now also drives the Reports view, and
  Report category rows click through to filtered transactions.
- Codebase restructured from one 3,000-line file into `lib/`, `hooks/`,
  `components/`, `views/`, `styles/` modules. Tests rewritten to match.

## Data model additions (all backward compatible)

| Field | Where | Default |
|---|---|---|
| `hasSeenWelcome` | user record | absent → welcome shows once |
| `allocations` | income transactions | absent → treated as `[]` |
| `reconcileLog` | top level | absent → `[]` |
| `dataVersion` | top level | absent → `0` |
