# Budget App

Personal household budgeting for family use. React + Vite + XLSX, running locally — no server, no cloud, no login.

## Prerequisites

- **Node.js 18 or newer** — download from https://nodejs.org. Includes `npm`.
- **VS Code** (or any editor).

That is the only software you need. The `xlsx` library is pure JavaScript and runs in the browser.

## Install

```bash
cd "E:\Claude Projects\Budget App"
npm install
```

This downloads React, Vite, the `xlsx` library, and the test tooling into `node_modules/`.

## Run locally

```bash
npm run dev
```

Vite serves the app at **http://localhost:5173** and opens it automatically. Edits to `src/` files hot-reload in the browser.

## Run tests

```bash
npm test
```

Runs the Jest suite in a simulated browser (`jsdom`). Tests live in `src/BudgetApp.test.jsx`.

## Build for production

```bash
npm run build
```

Writes a static bundle to `dist/`. You can open `dist/index.html` directly, or host the folder anywhere.

```bash
npm run preview
```

Serves the built `dist/` folder at http://localhost:4173 so you can sanity-check the production build.

## Project structure

```
Budget App/
├── claude.md                      ← project spec + agent definitions
├── wireframe.md                   ← UI layout spec (step 1)
├── schema.md                      ← data models (step 2)
├── BudgetApp.jsx                  ← generated component (step 3, audit copy)
├── BudgetApp-review.md            ← review report (step 4)
├── BudgetApp-revised.jsx          ← corrected component (step 4, audit copy)
├── BudgetApp.test.jsx             ← tests (step 5, audit copy)
├── test-summary.md                ← what is tested (step 5)
├── index.html                     ← Vite entry point
├── package.json                   ← dependencies + scripts
├── vite.config.js                 ← dev server config
├── babel.config.json              ← for Jest
├── jest.config.js                 ← test runner
├── jest.setup.js                  ← testing-library setup
├── .gitignore
└── src/
    ├── main.jsx                   ← mounts <BudgetApp /> and wires XLSX helpers
    ├── BudgetApp.jsx              ← the component used by Vite at runtime
    ├── BudgetApp.test.jsx         ← the test file Jest runs
    └── xlsx-helpers.js            ← exportToXlsx + importFromXlsx (SheetJS)
```

The root-level `BudgetApp.jsx`, `BudgetApp-revised.jsx`, and `BudgetApp.test.jsx` are the agent audit trail. The files that actually run live under `src/`.

## How XLSX works

- The component exposes **Import** and **Export** buttons on the Transactions view.
- Import is also available on the Reports view.
- Export produces `budget-YYYY-MM-DD.xlsx` with two sheets: **Transactions** and **Summary**. Your browser downloads it.
- Import accepts the same format back. Rows match by `id` first, then fall back to matching `categoryName` and `addedByName` (case-insensitive). Unmatchable rows are skipped and counted in the toast.

## Data

Everything is in React state. Refreshing the page resets to the seed data in `src/BudgetApp.jsx`. To make changes persist between sessions, export to XLSX before closing and import on your next session. (Adding `localStorage` persistence is a natural next step — see `wireframe.md` for what was planned but deferred.)

## Colour palette

- Primary `#7FB069` (muted green)
- Secondary `#B8D4AE` (sage)
- Text `#1A1A1A` on light, `#F5F5F5` on dark

## Troubleshooting

- **`npm install` fails on Windows with EACCES or path-length errors** — move the project to a shorter path like `C:\budget-app` and retry.
- **Port 5173 already in use** — edit `vite.config.js` and change `port` to something else.
- **Tests complain about ESM** — make sure `package.json` has `"type": "module"` and that you ran `npm install` after pulling the project.
- **Nothing imports when you click Import** — check the browser console; the file must be an `.xlsx` with a `Transactions` sheet (or a single-sheet workbook whose columns match the export format).
