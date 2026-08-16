import React, { useState, useEffect } from "react";
import { DEFAULT_USERS, DEFAULT_CATEGORIES, INCIDENTALS_CAT, SAVINGS_CAT, VIEW_ORDER } from "./lib/constants.js";
import { uid, fmtAUD, monthKey, todayISO, addPeriod, dayOfMonth, genMonthRange } from "./lib/utils.js";
import { MONEY_SCALE, parseImportedAUDToCents, reconcileEntryToDollars, toCentsDocument, toDollarsDocument } from "../money-schema.js";
import { applyTxEffect, saveTransactionEffect, envelopeFillPlan, applyEnvelopeFill, removeEnvelope, reconcileLedger, applyOpeningBalances, applyResetBalances, applySetUnallocated, householdTotal } from "./lib/money.js";
import { buildStyles } from "./styles/buildStyles.js";
import { useIsMobile } from "./hooks/useIsMobile.js";
import { useSwipeNavigation } from "./hooks/useSwipeNavigation.js";
import { Sidebar } from "./components/Sidebar.jsx";
import { Header } from "./components/Header.jsx";
import { ConfirmHost, askConfirm } from "./components/ConfirmDialog.jsx";
import { WelcomeModal, SettingsModal, NameSetupModal } from "./components/modals.jsx";
import { LoginPage } from "./views/LoginPage.jsx";
import { Dashboard } from "./views/Dashboard.jsx";
import { TransactionsView } from "./views/TransactionsView.jsx";
import { EnvelopesView } from "./views/EnvelopesView.jsx";
import { RecurringView } from "./views/RecurringView.jsx";
import { ReportsView } from "./views/ReportsView.jsx";
import { transactionFingerprint } from "./lib/csvImport.js";

const INCOME_COLOURS = ["#A0B894", "#8FA876", "#6B9559", "#7FB069", "#5F8A4F"];

// How far the unallocated balance may be moved by hand before the app asks
// first. See setUnallocatedManually for why there is a line at all, and why it
// is here rather than lower.
const UNALLOCATED_CONFIRM_AT = 10_000;

export default function BudgetApp({ onImport, onExport, onSave, onReload, initialData } = {}) {
  // The production API returns integer cents. Legacy-shaped data is still
  // accepted at this boundary for old exports and the frozen regression suite;
  // it is converted once before any domain arithmetic and converted back only
  // when calling a legacy-shaped onSave consumer.
  const legacyInput = !!initialData && initialData.moneyScale !== MONEY_SCALE;
  const sourceData = legacyInput ? toCentsDocument(initialData, { rejectUnexpected: false }) : initialData;
  const initUsers = sourceData?.users?.length ? sourceData.users : DEFAULT_USERS;
  // Normalise categories: add envelope fields if missing (backward-compat migration)
  const rawCats = (sourceData?.categories?.length ? sourceData.categories : DEFAULT_CATEGORIES).map((c) => ({
    envelopeBalance: 0,
    isAccumulating: false,
    baseAmount: c.monthlyBudget || 0,
    ...c,
    // Force savings to always be accumulating and protected
    ...(c.id === SAVINGS_CAT.id ? { isAccumulating: true, protected: true } : {}),
  }));
  // Always ensure both protected categories exist
  let initCategories = rawCats;
  if (!initCategories.some((c) => c.id === INCIDENTALS_CAT.id)) initCategories = [...initCategories, INCIDENTALS_CAT];
  if (!initCategories.some((c) => c.id === SAVINGS_CAT.id)) initCategories = [...initCategories, SAVINGS_CAT];
  const initRecurring = sourceData?.recurring?.length ? sourceData.recurring : [];
  const initTransactions = sourceData?.transactions?.length ? sourceData.transactions : [];
  const initUnallocated = sourceData?.unallocatedBalance || 0;

  // ALL hooks must come before any conditional return
  const [authToken, setAuthToken] = useState(() => localStorage.getItem("byb_token") || "");
  const [users, setUsers] = useState(initUsers);
  const [activeUserId, setActiveUserId] = useState(() => {
    const stored = localStorage.getItem("byb_user");
    return stored && initUsers.find((u) => u.id === stored) ? stored : initUsers[0].id;
  });
  const [categories, setCategories] = useState(initCategories);
  const [unallocatedBalance, setUnallocatedBalance] = useState(initUnallocated);
  const [recurring, setRecurring] = useState(initRecurring);
  const [transactions, setTransactions] = useState(initTransactions);
  const [assets, setAssets] = useState(sourceData?.assets?.length ? sourceData.assets : []);
  const [transfers, setTransfers] = useState(sourceData?.transfers?.length ? sourceData.transfers : []);
  const [reconcileLog, setReconcileLog] = useState(Array.isArray(sourceData?.reconcileLog) ? sourceData.reconcileLog : []);
  // Every deliberate change to the household total that is not a transaction:
  // opening the envelopes at setup, resetting all balances, setting unallocated
  // by hand. One log rather than three, because they are one question — "what
  // moved my total, and who did it" — and a reader answering it should not have
  // to interleave three lists by date. Reconciles and transfers stay where they
  // are: they conserve the total, so they answer a different question.
  //
  // A file written before this existed simply has no key, which reads as
  // "nothing was ever recorded" — which is exactly what it means.
  //
  // `openingBalances` was this log's short-lived predecessor. It was never
  // written by a deployed instance, so folding it in costs nothing and is done
  // on read; a file that has it keeps its history, and the key falls away on the
  // next save. A file that has neither is simply a household with no
  // adjustments yet.
  const [adjustments, setAdjustments] = useState(() => {
    if (Array.isArray(sourceData?.adjustments)) return sourceData.adjustments;
    if (Array.isArray(sourceData?.openingBalances)) {
      return sourceData.openingBalances.map((e) => ({ ...e, kind: "opening", amount: e.amount ?? e.total }));
    }
    return [];
  });
  const [view, setView] = useState("dashboard");
  const [viewAnim, setViewAnim] = useState(""); // "", "left", "right"
  const [theme, setTheme] = useState(() => localStorage.getItem("byb_theme") || "light");
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Welcome modal — the flag lives on the user record server-side and follows
  // the account across devices. localStorage is kept as an offline fallback
  // and to avoid a re-show for users upgrading from the old version.
  const [welcomeOpen, setWelcomeOpen] = useState(() => {
    const userId = localStorage.getItem("byb_user");
    const user = initUsers.find((u) => u.id === userId) || initUsers[0];
    if (user?.hasSeenWelcome) return false;
    return !localStorage.getItem("byb_welcomed");
  });
  const [showNamePrompt, setShowNamePrompt] = useState(() => {
    const token = localStorage.getItem("byb_token");
    const userId = localStorage.getItem("byb_user");
    if (!token || !userId) return false;
    if (localStorage.getItem(`byb_named_${userId}`)) return false;
    const user = initUsers.find((u) => u.id === userId);
    return user?.name === "User 1";
  });
  const [activeMonth, setActiveMonth] = useState(todayISO().slice(0, 7));
  // `start`/`end` are the Transactions view's optional explicit date range. Blank
  // means "no range", which leaves the list on the global month — or on a single
  // envelope's whole history, when one is selected.
  const [txFilters, setTxFilters] = useState({ type: "all", categoryId: "all", addedBy: "all", search: "", start: "", end: "" });
  const [reportRange, setReportRange] = useState({ start: todayISO().slice(0, 4) + "-01-01", end: todayISO() });
  const [editingTx, setEditingTx] = useState(null);
  const [txFormOpen, setTxFormOpen] = useState(false);
  const [incomeFlowOpen, setIncomeFlowOpen] = useState(false);
  const [editingCat, setEditingCat] = useState(null);
  const [catFormOpen, setCatFormOpen] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [ruleFormOpen, setRuleFormOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const isMobile = useIsMobile();

  // Theme variables for the global stylesheet.
  //
  // Transitions are suppressed for the frame the swap lands on. A var()-valued
  // property that is mid-transition is not re-resolved when the custom property
  // underneath it changes, which stranded card elevation on the outgoing
  // theme's shadow (see .byb-theme-switching in global.css).
  useEffect(() => {
    const el = document.documentElement;
    el.classList.add("byb-theme-switching");
    el.dataset.theme = theme;
    // Whether a transition starts is decided at style recalculation, so the
    // recalculation has to happen while the guard is up. Reading offsetWidth
    // forces it synchronously — without it the guard going up, the theme
    // changing and the guard coming down all coalesce into one recalculation
    // where the guard is already gone, and the stranding comes straight back.
    void el.offsetWidth;
    // A timer rather than requestAnimationFrame: rAF is paused in a hidden tab,
    // and a guard that never lifted would leave the app with no motion at all.
    const t = setTimeout(() => el.classList.remove("byb-theme-switching"), 0);
    return () => {
      clearTimeout(t);
      el.classList.remove("byb-theme-switching");
    };
  }, [theme]);

  // If this device dismissed the welcome before the upgrade, sync the flag to
  // the server so other devices stop showing it too.
  useEffect(() => {
    if (!authToken) return;
    const user = users.find((u) => u.id === activeUserId);
    if (user && !user.hasSeenWelcome && localStorage.getItem("byb_welcomed")) {
      fetch("/api/auth/welcome-seen", { method: "POST", headers: { Authorization: `Bearer ${authToken}` } }).catch(() => {});
      setUsers((prev) => prev.map((u) => u.id === activeUserId ? { ...u, hasSeenWelcome: true } : u));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authToken]);

  const updateTheme = (t) => { setTheme(t); localStorage.setItem("byb_theme", t); };
  const styles = buildStyles(theme, isMobile);

  // Close all open forms when switching tabs; reset transaction filters on re-entry
  const handleSetView = (v, anim) => {
    if (v === view) return;
    if (!anim) {
      const fromIdx = VIEW_ORDER.indexOf(view);
      const toIdx = VIEW_ORDER.indexOf(v);
      anim = toIdx > fromIdx ? "right" : "left";
    }
    setViewAnim(anim);
    setView(v);
    if (v === "transactions") {
      setTxFilters({ type: "all", categoryId: "all", addedBy: "all", search: "", start: "", end: "" });
    }
    setEditingTx(null);
    setTxFormOpen(false);
    setIncomeFlowOpen(false);
    setEditingCat(null);
    setCatFormOpen(false);
    setEditingRule(null);
    setRuleFormOpen(false);
  };

  // Navigate to Transactions tab filtered by category (sets filter AFTER handleSetView to override the reset).
  // No date range, so the envelope opens on its whole history rather than the global month.
  const navigateToCategory = (catId) => {
    handleSetView("transactions");
    setTxFilters({ type: "all", categoryId: catId, addedBy: "all", search: "", start: "", end: "" });
  };

  // ── Swipe between tabs (touch devices) ────────────────────────────────────
  //
  // The gesture itself lives in useSwipeNavigation, which tracks the finger and
  // settles the view. All this decides is when the shell owns the gesture:
  // never over a modal.
  //
  // An envelope drill-down used to be excluded here too, because the list
  // substituted a swipe of its own — leftwards only, meaning "leave the
  // envelope". So the same gesture did two different things depending on where
  // the user was, and rightwards did nothing at all, which is what the
  // stakeholder reported as a swipe that "works sometimes". A swipe now means
  // one thing everywhere: change tab. Leaving an envelope is a control on
  // screen (DEC-010).
  //
  // Sheets and other in-view overlays suppress the gesture themselves, through
  // the `data-swipe-ignore` guard useSwipeNavigation already honours.
  const anyModalOpen = settingsOpen || welcomeOpen || showNamePrompt;

  const swipe = useSwipeNavigation({
    enabled: !anyModalOpen,
    index: VIEW_ORDER.indexOf(view),
    count: VIEW_ORDER.length,
    // The gesture has already moved the view; the mount animation would replay
    // the same travel a second time.
    onNavigate: (i) => handleSetView(VIEW_ORDER[i], "none"),
  });

  const categoriesById = Object.fromEntries(categories.map((c) => [c.id, c]));
  const usersById = Object.fromEntries(users.map((u) => [u.id, u]));

  const handleLogin = async (userId, token) => {
    localStorage.setItem("byb_token", token);
    localStorage.setItem("byb_user", userId);
    setAuthToken(token);
    await onReload?.();
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", headers: { Authorization: `Bearer ${authToken}` } });
    } catch { /* ignore network errors on logout */ }
    localStorage.removeItem("byb_token");
    localStorage.removeItem("byb_user");
    setAuthToken("");
    await onReload?.();
  };

  // Show login page when not authenticated (after all hooks)
  if (!authToken) {
    return <LoginPage onLogin={handleLogin} />;
  }

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2400);
  };

  const persist = (patch) => {
    const document = { transactions, categories, recurring, users, unallocatedBalance, assets, transfers, reconcileLog, adjustments, ...patch, moneyScale: MONEY_SCALE };
    onSave?.(legacyInput ? toDollarsDocument(document) : document);
  };

  // The envelope arithmetic itself lives in lib/money.js. This component holds
  // the state and decides what to ask the user; it does not do the sums.
  const ledger = () => ({ categories, unallocatedBalance });

  const commitLedger = ({ categories: newCats, unallocatedBalance: newUnalloc }, patch = {}) => {
    setCategories(newCats);
    setUnallocatedBalance(newUnalloc);
    persist({ categories: newCats, unallocatedBalance: newUnalloc, ...patch });
  };

  // Commit one of money.js's adjustments and write it down in the same breath.
  //
  // Everything numeric in the entry — before, after, amount, the per-envelope
  // detail — comes from the same pass that produced the ledger being committed,
  // so the record cannot drift from the balances it explains. All this adds is
  // who, when, and which kind.
  //
  // Capped like `reconcileLog`, and for the same reason: the whole file is
  // rewritten on every save. 120 entries is decades of a log this quiet.
  const recordAdjustment = (kind, { ledger: next, ...detail }, patch = {}) => {
    const entry = { id: uid(), date: todayISO(), at: new Date().toISOString(), userId: activeUserId, kind, ...detail };
    const newAdjustments = [entry, ...adjustments].slice(0, 120);
    setAdjustments(newAdjustments);
    commitLedger(next, { adjustments: newAdjustments, ...patch });
    return entry;
  };

  const saveTx = (tx) => {
    const isEdit = !!tx.id;
    const old = isEdit ? transactions.find((t) => t.id === tx.id) || null : null;
    const form = isEdit ? tx : { ...tx, id: uid(), createdAt: new Date().toISOString(), isRecurring: false, recurringId: null };
    const { ledger: next, transaction } = saveTransactionEffect(ledger(), old, form);
    const newTx = isEdit
      ? transactions.map((t) => (t.id === tx.id ? transaction : t))
      : [transaction, ...transactions];
    setTransactions(newTx);
    commitLedger(next, { transactions: newTx });
    showToast(isEdit ? "Transaction updated" : "Transaction added");
    setEditingTx(null);
    setTxFormOpen(false);
  };

  const deleteTx = (id) => {
    const tx = transactions.find((t) => t.id === id);
    const next = tx ? applyTxEffect(ledger(), tx, -1) : ledger();
    const newTx = transactions.filter((t) => t.id !== id);
    setTransactions(newTx);
    commitLedger(next, { transactions: newTx });
    showToast("Transaction deleted");
  };

  // ── Unified Add Income flow ───────────────────────────────────────────────
  const addIncome = ({ sourceId, newSourceName, amount, date, description, allocationMode, splits }) => {
    let newCats = [...categories];

    // Create a new income stream on the fly if requested
    let catId = sourceId;
    if (!catId && newSourceName) {
      const colour = INCOME_COLOURS[newCats.filter((c) => c.type === "income").length % INCOME_COLOURS.length];
      const newSource = { id: uid(), name: newSourceName, type: "income", colour, monthlyBudget: null };
      newCats = [...newCats, newSource];
      catId = newSource.id;
    }
    if (!catId) return;

    // Work out allocations
    let allocations = [];
    if (allocationMode === "split") {
      allocations = splits.filter((s) => s.amount > 0);
    } else if (allocationMode === "fill") {
      let remaining = Math.max(0, unallocatedBalance + amount);
      const expCats = newCats.filter((c) => c.type === "expense" && (c.baseAmount || 0) > 0);
      for (const c of expCats) {
        const base = c.baseAmount || 0;
        const need = c.isAccumulating ? base : Math.max(0, base - (c.envelopeBalance || 0));
        const used = Math.min(need, remaining);
        if (used > 0) allocations.push({ catId: c.id, amount: used });
        remaining -= used;
      }
    }

    const tx = {
      id: uid(),
      date: date || todayISO(),
      amount,
      type: "income",
      categoryId: catId,
      description: description || "Income",
      isRecurring: false,
      recurringId: null,
      allocations,
      addedBy: activeUserId,
      createdAt: new Date().toISOString(),
    };

    const next = applyTxEffect({ categories: newCats, unallocatedBalance }, tx, 1);
    const newTx = [tx, ...transactions];
    setTransactions(newTx);
    commitLedger(next, { transactions: newTx });

    const allocated = allocations.reduce((s, a) => s + a.amount, 0);
    if (allocationMode === "fill") showToast(`${fmtAUD(amount)} logged · ${fmtAUD(allocated)} into envelopes`);
    else if (allocationMode === "split") showToast(`${fmtAUD(amount)} logged · ${allocations.length} envelope${allocations.length === 1 ? "" : "s"} topped up`);
    else showToast(`${fmtAUD(amount)} added to Unallocated`);
  };

  // Envelope actions — move money from unallocated into envelopes.
  // A fill that outruns the unallocated balance is confirmed first, the same way
  // the fill-everything path below does it: the money is not there, and pushing
  // unallocated negative without saying so is how a household ends up budgeting
  // against money it does not have.
  const fillEnvelope = async (catId) => {
    const { cat, base, amount, shortfall } = envelopeFillPlan(ledger(), catId);
    if (!cat || base <= 0) { showToast("Set a base amount first"); return; }
    if (amount <= 0) { showToast(`${cat.name} is already full`); return; }
    if (shortfall > 0) {
      const ok = await askConfirm({
        title: "Top up from Unallocated?",
        message: `Filling ${cat.name} needs ${fmtAUD(amount)} but only ${fmtAUD(unallocatedBalance)} is unallocated. This will leave Unallocated at ${fmtAUD(unallocatedBalance - amount)}.`,
        confirmLabel: "Fill envelope",
      });
      if (!ok) return;
    }
    commitLedger(applyEnvelopeFill(ledger(), catId, amount));
    showToast(`Filled ${cat.name} with ${fmtAUD(amount)}`);
  };

  // A manual transfer moves money the user has already decided about, so it does
  // not need permission — but it does need to say when the source envelope does
  // not hold what is being moved out of it (DEF-014). Same threshold and same
  // dialog shape as the fill paths above: below a cent is rounding, not an
  // overdraw.
  const transferEnvelope = async (fromId, toId, amount, description) => {
    const from = categories.find((c) => c.id === fromId);
    const available = from?.envelopeBalance || 0;
    if (amount > available) {
      const ok = await askConfirm({
        title: "Transfer more than the envelope holds?",
        message: `${from?.name || "That envelope"} holds ${fmtAUD(available)} but this transfer moves ${fmtAUD(amount)}. This will leave it at ${fmtAUD(available - amount)}.`,
        confirmLabel: "Transfer anyway",
      });
      if (!ok) return;
    }
    const newCats = categories.map((c) => {
      if (c.id === fromId) return { ...c, envelopeBalance: (c.envelopeBalance || 0) - amount };
      if (c.id === toId) return { ...c, envelopeBalance: (c.envelopeBalance || 0) + amount };
      return c;
    });
    const log = { id: uid(), date: todayISO(), fromId, toId, amount, description: description || "", createdAt: new Date().toISOString() };
    const newTransfers = [log, ...transfers];
    setCategories(newCats);
    setTransfers(newTransfers);
    persist({ categories: newCats, transfers: newTransfers });
    showToast(`Transferred ${fmtAUD(amount)}`);
  };

  // Combined: log multiple income transactions + fill all envelopes in one step
  const fillAllWithMultipleIncome = async (sources) => {
    // sources = [{ catId, amount }, ...]
    const validSources = sources.filter(({ amount }) => amount > 0);
    if (validSources.length === 0) { showToast("Enter at least one income amount"); return; }

    const totalIncome = validSources.reduce((s, { amount }) => s + amount, 0);

    // Pre-check: calculate net draw on existing unallocated (hard reset: non-savings → base, savings → +base)
    const expCats = categories.filter((c) => c.type === "expense" && (c.baseAmount || 0) > 0);
    const totalFillNeeded = expCats.reduce((s, c) => {
      const base = c.baseAmount || 0;
      return s + (c.isAccumulating ? base : (base - (c.envelopeBalance || 0)));
    }, 0);
    const netDraw = totalFillNeeded - totalIncome;
    if (netDraw > 0) {
      const ok = await askConfirm({
        title: "Top up from Unallocated?",
        message: `Filling all envelopes will draw ${fmtAUD(netDraw)} from your existing unallocated balance (${fmtAUD(unallocatedBalance)} available).`,
        confirmLabel: "Fill envelopes",
      });
      if (!ok) return;
    }

    let next = ledger();
    const newIncomeTxs = [];
    validSources.forEach(({ catId, amount }) => {
      const incomeTx = { id: uid(), date: todayISO(), amount, type: "income", categoryId: catId, description: "Income fill", isRecurring: false, recurringId: null, allocations: [], addedBy: activeUserId, createdAt: new Date().toISOString() };
      newIncomeTxs.push(incomeTx);
      next = applyTxEffect(next, incomeTx, 1);
    });
    let newCats = next.categories;
    let newUnalloc = next.unallocatedBalance;

    // Hard reset: non-savings → set balance to exactly base; savings → add base
    const fillMap = {};
    expCats.forEach((c) => {
      const base = c.baseAmount || 0;
      fillMap[c.id] = c.isAccumulating ? base : (base - (c.envelopeBalance || 0));
    });
    newCats = newCats.map((c) => fillMap[c.id] != null ? { ...c, envelopeBalance: (c.envelopeBalance || 0) + fillMap[c.id] } : c);
    newUnalloc = newUnalloc - Object.values(fillMap).reduce((s, a) => s + a, 0);

    const newTx = [...newIncomeTxs, ...transactions];
    setTransactions(newTx);
    commitLedger({ categories: newCats, unallocatedBalance: newUnalloc }, { transactions: newTx });
    showToast(`${fmtAUD(totalIncome)} income logged · envelopes filled`);
  };

  // First-time wizard: bulk set base amounts, then ask whether the household
  // already holds that money.
  //
  // This used to set `envelopeBalance` to the base amount alongside it, which
  // raised the household total by the sum of every base amount and recorded
  // nothing at all — twenty envelopes at $500 invented $10,000 (DEF-013). The
  // money itself was not the error: a household adopting the app mid-life
  // genuinely does hold money against these envelopes, sitting in their bank
  // account. Doing it silently was.
  //
  // So the two halves are separated. Setting a budget moves no money and needs
  // no permission, so base amounts land first and on their own. Opening the
  // envelopes holding money is a second thing, and it is the user who states
  // that the money is there — for a total they are shown before they agree to
  // it. Backing out (Escape, or tapping the ground) leaves the envelopes empty,
  // so the outcome that raises the household total is the one that needs a
  // deliberate press.
  //
  // What it is recorded as matters as much as that it is recorded. An opening
  // balance is not earnings, so it is not an income transaction: monthly income
  // totals, the trend charts and the n8n summary at /api/integrations/summary
  // all count `type === "income"` rows, and a $10,000 adoption balance landing
  // in them would misreport the household's first month for good. It goes in the
  // adjustments log instead, alongside the other deliberate changes to the
  // household total: dated, attributed, with the per-envelope breakdown and the
  // amount it moved the household by.
  const setupBaseAmounts = async (amountsMap) => {
    const withBases = categories.map((c) =>
      amountsMap[c.id] !== undefined
        ? { ...c, baseAmount: amountsMap[c.id], monthlyBudget: amountsMap[c.id] }
        : c
    );

    // Worked out before the question is asked, so the amount the user agrees to
    // is the amount that actually moves — the same numbers, not a second sum.
    const opening = applyOpeningBalances({ categories: withBases, unallocatedBalance }, amountsMap);

    const setUpOnly = (msg) => {
      commitLedger({ categories: withBases, unallocatedBalance });
      showToast(msg);
    };

    if (opening.amount <= 0) { setUpOnly("Envelopes set up. Add money as it arrives."); return; }

    const fund = await askConfirm({
      title: "Do you already have this money?",
      message: `Your envelopes add up to ${fmtAUD(opening.amount)}.\n\nIf that money is already in your account, BYB! can open them holding it. It is recorded as an opening balance dated today, so your totals still add up and you can see later where the money came from.\n\nIf it is not there yet, start the envelopes empty and fill them as income arrives.`,
      confirmLabel: `Yes, open with ${fmtAUD(opening.amount)}`,
      cancelLabel: "Start empty",
    });

    if (!fund) { setUpOnly("Envelopes set up · balances start empty"); return; }

    recordAdjustment("opening", opening);
    showToast(`Envelopes set up · ${fmtAUD(opening.amount)} opening balance recorded`);
  };

  // End-of-month reconcile: pool non-savings surpluses, cover deficits,
  // remainder to unallocated. The arithmetic is envelope arithmetic and lives in
  // lib/money.js; this decides what to record and what to say about it.
  const reconcileEnvelopes = () => {
    const nonSavings = categories.filter((c) => c.type === "expense" && !c.isAccumulating);
    const hasActivity = nonSavings.some((c) => (c.envelopeBalance || 0) !== 0);
    if (!hasActivity) { showToast("Nothing to reconcile"); return; }

    const { ledger: next, movements, pooled: totalPooled, toppedUp, returned } = reconcileLedger(ledger());

    // Record the reconcile in the log.
    //
    // The three aggregates keep the shape and the meaning they have always had:
    // the Reports summary line, the toast, and the n8n integrations endpoint all
    // read them, and entries written before `movements` existed still have to
    // render. `toppedUp` therefore stays a COUNT of envelopes rather than an
    // amount — how much each one received is in `movements`, where it cannot be
    // mistaken for the count nor drift away from the ledger.
    const entry = {
      id: uid(),
      date: todayISO(),
      at: new Date().toISOString(),
      userId: activeUserId,
      pooled: totalPooled,
      toppedUp,
      returned,
      movements,
    };
    const newLog = [entry, ...reconcileLog].slice(0, 120); // keep last 120 runs

    setReconcileLog(newLog);
    commitLedger(next, { reconcileLog: newLog });

    // Notify external automation (n8n webhook) if the server has one configured
    fetch("/api/events/reconcile", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
      body: JSON.stringify(reconcileEntryToDollars(entry)),
    }).catch(() => {});

    let msg = `${fmtAUD(totalPooled)} redistributed`;
    if (toppedUp > 0) msg += ` · ${toppedUp} envelope${toppedUp !== 1 ? "s" : ""} topped up`;
    if (returned > 0) msg += ` · ${fmtAUD(returned)} returned to unallocated`;
    showToast(msg);
  };

  // Wipe every balance. Starting over is a legitimate thing to want, so this is
  // not taken away — but it destroys the household's money outright, and it sits
  // in a settings menu that more than one person opens.
  //
  // There has always been a dialog here; it lived in SettingsModal and said only
  // that balances would be cleared and that it could not be undone. That is the
  // shape of a warning without being one: it is the same sentence whether the
  // household holds nothing or holds four thousand dollars, so it tells the
  // reader nothing they can weigh. The question moved here, where the ledger
  // actually is, and now states what is about to be destroyed.
  //
  // Returns whether the reset happened, so Settings can stay open if it did not.
  const resetAllBalances = async () => {
    const holding = categories.filter((c) => (c.envelopeBalance || 0) !== 0);
    const total = householdTotal(ledger());
    // Nothing to destroy is not a question worth asking, and an entry saying
    // "$0.00 became $0.00" is a row in the log that says nothing.
    if (holding.length === 0 && unallocatedBalance === 0) { showToast("All balances are already zero"); return false; }

    const inEnvelopes = holding.reduce((s, c) => s + (c.envelopeBalance || 0), 0);
    const confirmed = await askConfirm({
      title: "Reset all balances to zero?",
      message: `${holding.length} envelope${holding.length === 1 ? " holds" : "s hold"} ${fmtAUD(inEnvelopes)} and Unallocated holds ${fmtAUD(unallocatedBalance)} — ${fmtAUD(total)} in all. Every one of them is set to ${fmtAUD(0)}.\n\nYour transactions and history are not affected, and the reset is recorded in Reports. The balances themselves cannot be recovered. This cannot be undone.`,
      confirmLabel: "Reset balances",
      danger: true,
    });
    if (!confirmed) return false;

    const entry = recordAdjustment("reset", applyResetBalances(ledger()));
    showToast(`All balances reset to zero · ${fmtAUD(-entry.amount)} cleared`);
    return true;
  };

  const reorderCategories = (newCats) => {
    setCategories(newCats);
    persist({ categories: newCats });
  };

  // Type a new unallocated balance. This is the household reconciling the app
  // against a bank statement, and it changes the household total by whatever the
  // difference happens to be.
  //
  // It is always recorded — the total moved, and something has to be able to say
  // why. It is not always confirmed. The everyday use of this editor is a small
  // correction ("the app says $250.40, the bank says $250.15"), and a dialog on
  // every one of those teaches the household to dismiss dialogs, which is
  // precisely what must not happen to the reset dialog above. So the question is
  // asked when the change stops looking like a correction: a slipped digit on a
  // balance large enough to matter moves it by hundreds or thousands, while a
  // genuine correction moves it by tens. UNALLOCATED_CONFIRM_AT sits between
  // those, and it is a round number a household can hold in their head.
  const setUnallocatedManually = async (amount) => {
    const change = applySetUnallocated(ledger(), amount);
    if (change.amount === 0) { showToast(`Unallocated is already ${fmtAUD(amount)}`); return; }

    if (Math.abs(change.amount) >= UNALLOCATED_CONFIRM_AT) {
      const direction = change.amount > 0 ? "add" : "remove";
      const confirmed = await askConfirm({
        title: `Set Unallocated to ${fmtAUD(amount)}?`,
        message: `Unallocated goes from ${fmtAUD(change.unallocated.before)} to ${fmtAUD(amount)}. That will ${direction} ${fmtAUD(Math.abs(change.amount))}, taking everything you hold from ${fmtAUD(change.before)} to ${fmtAUD(change.after)}.\n\nYour envelopes are not touched. The change is recorded in Reports.`,
        confirmLabel: "Set balance",
      });
      if (!confirmed) return;
    }

    recordAdjustment("set-unallocated", change);
    showToast(`Unallocated set to ${fmtAUD(amount)}`);
  };

  const saveCat = (cat) => {
    let newCats;
    if (cat.id) {
      newCats = categories.map((c) => (c.id === cat.id ? { ...c, ...cat, monthlyBudget: cat.baseAmount || 0 } : c));
      showToast("Category updated");
    } else {
      newCats = [...categories, { envelopeBalance: 0, isAccumulating: false, ...cat, id: uid(), monthlyBudget: cat.baseAmount || 0 }];
      showToast("Category added");
    }
    setCategories(newCats);
    persist({ categories: newCats });
    setEditingCat(null);
    setCatFormOpen(false);
  };

  const deleteCat = async (id) => {
    const cat = categories.find((c) => c.id === id);
    if (!cat) return;
    if (cat.protected) { showToast(`"${cat.name}" is a protected envelope and cannot be deleted`); return; }
    const txCount = transactions.filter((t) => t.categoryId === id).length;
    const ruleCount = recurring.filter((r) => r.categoryId === id).length;
    const total = txCount + ruleCount;

    // Deleting an envelope does not delete the money in it. Say where it goes
    // before the user commits — including when the envelope is overdrawn, where
    // "returning" the balance means unallocated absorbs the shortfall.
    const balance = cat.envelopeBalance || 0;
    const moneyNote = balance > 0
      ? `\n\nThe ${fmtAUD(balance)} in this envelope will be returned to Unallocated.`
      : balance < 0
        ? `\n\nThis envelope is overdrawn by ${fmtAUD(-balance)}. That shortfall comes out of Unallocated, taking it to ${fmtAUD(unallocatedBalance + balance)}.`
        : "";

    const confirmed = await askConfirm({
      title: `Delete "${cat.name}"?`,
      message: total > 0
        ? `${total} item(s) reference this envelope (${txCount} transaction(s), ${ruleCount} recurring rule(s)). They will be reassigned to "Household Incidentals".${moneyNote}`
        : `This cannot be undone.${moneyNote}`,
      confirmLabel: total > 0 ? "Delete & reassign" : "Delete",
      danger: true,
    });
    if (!confirmed) return;

    if (total > 0) {
      // Ensure Incidentals exists in categories
      const hasIncidentals = categories.some((c) => c.id === INCIDENTALS_CAT.id);
      const catsWithIncidentals = hasIncidentals ? categories : [...categories, INCIDENTALS_CAT];
      const newTx = transactions.map((t) => t.categoryId === id ? { ...t, categoryId: INCIDENTALS_CAT.id } : t);
      const newRecurring = recurring.map((r) => r.categoryId === id ? { ...r, categoryId: INCIDENTALS_CAT.id } : r);
      const { ledger: next } = removeEnvelope({ categories: catsWithIncidentals, unallocatedBalance }, id);
      setTransactions(newTx); setRecurring(newRecurring);
      commitLedger(next, { transactions: newTx, recurring: newRecurring });
      showToast(`Deleted "${cat.name}" · ${total} item(s) moved to Incidentals`);
    } else {
      const { ledger: next } = removeEnvelope(ledger(), id);
      commitLedger(next);
      showToast("Category deleted");
    }
  };

  const saveRule = (incoming) => {
    // The form's "Next due" is the user stating which day of the month the rule
    // falls on, so it is what the monthly cycle anchors to. Recording it here
    // means a clamp into a short February cannot quietly become the rule's new
    // day (see addPeriod), and an edited due date replaces a stale anchor.
    const rule = incoming.nextDueDate ? { ...incoming, dueDay: dayOfMonth(incoming.nextDueDate) } : incoming;
    let newRecurring;
    if (rule.id) {
      newRecurring = recurring.map((r) => (r.id === rule.id ? { ...r, ...rule } : r));
      showToast("Recurring rule updated");
    } else {
      newRecurring = [...recurring, { ...rule, id: uid() }];
      showToast("Recurring rule added");
    }
    setRecurring(newRecurring);
    persist({ recurring: newRecurring });
    setEditingRule(null);
    setRuleFormOpen(false);
  };

  const deleteRule = (id) => {
    const newRecurring = recurring.filter((r) => r.id !== id);
    setRecurring(newRecurring);
    persist({ recurring: newRecurring });
    showToast("Recurring rule deleted");
  };

  const saveAsset = (asset) => {
    let newAssets;
    if (asset.id) {
      newAssets = assets.map((a) => a.id === asset.id ? { ...a, ...asset } : a);
      showToast("Asset updated");
    } else {
      newAssets = [...assets, { ...asset, id: uid() }];
      showToast("Asset added");
    }
    setAssets(newAssets);
    persist({ assets: newAssets });
  };

  const deleteAsset = (id) => {
    const newAssets = assets.filter((a) => a.id !== id);
    setAssets(newAssets);
    persist({ assets: newAssets });
    showToast("Asset deleted");
  };

  const postDueRecurrences = () => {
    // Read the date once so the two passes below cannot straddle midnight.
    const today = todayISO();
    const due = recurring.filter((r) => r.nextDueDate <= today);
    if (due.length === 0) return;
    const newPosted = due.map((r) => ({
      id: uid(), date: r.nextDueDate, amount: r.amount, type: r.type,
      categoryId: r.categoryId, description: r.label, isRecurring: true,
      recurringId: r.id, allocations: [], addedBy: r.addedBy, createdAt: new Date().toISOString(),
    }));
    const newTx = [...newPosted, ...transactions];
    const newRecurring = recurring.map((r) => {
      if (r.nextDueDate > today) return r;
      // Rules saved before the anchor existed take it from where they are now,
      // which is the last date the old code got right for them.
      const dueDay = r.dueDay || dayOfMonth(r.nextDueDate);
      return { ...r, dueDay, nextDueDate: addPeriod(r.nextDueDate, r.frequency, dueDay) };
    });
    const next = newPosted.reduce((acc, tx) => applyTxEffect(acc, tx, 1), ledger());
    setTransactions(newTx); setRecurring(newRecurring);
    commitLedger(next, { transactions: newTx, recurring: newRecurring });
    showToast(`Posted ${due.length} recurring transaction(s)`);
  };

  const handleExport = () => {
    if (typeof onExport === "function") {
      onExport({ transactions, categories, users, recurring });
      showToast("Export started");
    } else {
      showToast("Export handler not wired");
    }
  };

  const importTransactions = (rows, meta = {}) => {
    const existingIds = new Set(transactions.map((transaction) => transaction.id));
    const existingCounts = new Map();
    transactions.forEach((transaction) => {
      const fingerprint = transactionFingerprint(transaction);
      existingCounts.set(fingerprint, (existingCounts.get(fingerprint) || 0) + 1);
    });
    const categoryTypes = new Map(categories.map((category) => [category.id, category.type]));
    let skipped = Number(meta.skipped || 0) + Number(meta.invalid || 0);
    let duplicates = Number(meta.duplicates || 0);
    const imported = [];
    for (const raw of rows || []) {
      const type = raw.type === "income" ? "income" : raw.type === "expense" ? "expense" : null;
      const amount = raw.amount;
      const date = String(raw.date || "");
      const categoryId = raw.categoryId;
      if (!type || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isSafeInteger(amount) || amount <= 0 || categoryTypes.get(categoryId) !== type) {
        skipped++;
        continue;
      }
      const transaction = {
        ...raw,
        id: raw.id && !existingIds.has(raw.id) ? raw.id : uid(),
        date,
        amount,
        type,
        categoryId,
        description: String(raw.description || "").trim(),
        isRecurring: false,
        recurringId: null,
        allocations: [],
        imported: true,
        addedBy: raw.addedBy || activeUserId,
        createdAt: raw.createdAt || new Date().toISOString(),
      };
      if (!meta.preDeduped) {
        const fingerprint = transactionFingerprint(transaction);
        const alreadyStored = existingCounts.get(fingerprint) || 0;
        if (alreadyStored > 0) {
          existingCounts.set(fingerprint, alreadyStored - 1);
          duplicates++;
          continue;
        }
      }
      existingIds.add(transaction.id);
      imported.push(transaction);
    }
    if (imported.length === 0) {
      showToast(duplicates ? `No new transactions · ${duplicates} already imported` : "No valid new transactions found");
      return { ok: false, count: 0, skipped, duplicates };
    }
    const next = imported.reduce((current, transaction) => applyTxEffect(current, transaction, 1), ledger());
    const merged = [...imported, ...transactions];
    setTransactions(merged);
    commitLedger(next, { transactions: merged });
    const notes = [
      skipped ? `${skipped} skipped` : "",
      duplicates ? `${duplicates} already imported` : "",
      meta.rounded ? `${meta.rounded} rounded to cents` : "",
    ].filter(Boolean);
    showToast(`Imported ${imported.length} transaction${imported.length === 1 ? "" : "s"}${notes.length ? ` · ${notes.join(" · ")}` : ""}`);
    return { ok: true, count: imported.length, skipped, duplicates };
  };

  const importFromJSON = (jsonText) => {
    try {
      const parsed = JSON.parse(jsonText);
      if (!Array.isArray(parsed)) throw new Error("Expected a JSON array of transactions");
      const incomeCatId = categories.find((c) => c.type === "income")?.id || "";
      const expenseCatId = categories.find((c) => c.type === "expense")?.id || "";
      let rounded = 0;
      const valid = parsed
        .filter((t) => t.date && t.amount)
        .map((t) => {
          const imported = parseImportedAUDToCents(Math.abs(Number(t.amount)));
          if (imported.rounded) rounded++;
          return ({
          id: t.id || uid(),
          date: t.date,
          amount: imported.cents,
          type: t.type === "income" ? "income" : "expense",
          categoryId: t.categoryId || (t.type === "income" ? incomeCatId : expenseCatId),
          description: t.description || "",
          isRecurring: false,
          recurringId: null,
          allocations: [],
          addedBy: t.addedBy || activeUserId,
          createdAt: t.createdAt || new Date().toISOString(),
        }); })
        .filter((t) => t.amount > 0);
      return importTransactions(valid, { rounded }).ok;
    } catch (e) {
      showToast("Import failed: " + (e.message || "Invalid JSON"));
      return false;
    }
  };

  const handleImportFile = (file) => {
    if (typeof onImport !== "function") {
      showToast("Import handler not wired");
      return;
    }
    Promise.resolve(onImport(file, { categories, users })).then((result) => {
      if (result && Array.isArray(result.added)) {
        importTransactions(result.added, result);
      }
    }).catch(() => showToast("Import failed"));
  };

  const closeWelcome = () => {
    setWelcomeOpen(false);
    localStorage.setItem("byb_welcomed", "1");
    // Persist on the user record so it follows the account across devices
    fetch("/api/auth/welcome-seen", { method: "POST", headers: { Authorization: `Bearer ${authToken}` } }).catch(() => {});
    setUsers((prev) => prev.map((u) => u.id === activeUserId ? { ...u, hasSeenWelcome: true } : u));
  };

  const runningBalance = transactions.reduce((s, t) => s + (t.type === "income" ? t.amount : -t.amount), 0);
  const lastUpdated = transactions.reduce((max, t) => (t.createdAt > max ? t.createdAt : max), "");

  const todayMo = todayISO().slice(0, 7);
  const [ty] = todayMo.split("-").map(Number);
  const threeBack = `${ty - 3}-${todayMo.slice(5)}`;
  const oneAhead = `${ty + 1}-${todayMo.slice(5)}`;
  const earliestTxMo = transactions.length > 0
    ? transactions.reduce((min, t) => (monthKey(t.date) < min ? monthKey(t.date) : min), monthKey(transactions[0].date))
    : threeBack;
  const rangeStart = earliestTxMo < threeBack ? earliestTxMo : threeBack;
  const availableMonths = Array.from(new Set([...genMonthRange(rangeStart, oneAhead), ...transactions.map((t) => monthKey(t.date)), activeMonth])).sort().reverse();
  const dueCount = recurring.filter((r) => r.nextDueDate <= todayISO()).length;
  const activeUser = usersById[activeUserId];

  return (
    <div style={styles.app}>
      <Sidebar view={view} setView={handleSetView} dueCount={dueCount} styles={styles} />
      <div style={styles.main}>
        <Header
          view={view}
          activeMonth={activeMonth}
          setActiveMonth={setActiveMonth}
          availableMonths={availableMonths}
          users={users}
          activeUserId={activeUserId}
          onOpenSettings={() => setSettingsOpen(true)}
          onLogout={handleLogout}
          styles={styles}
        />
        <div style={styles.content} data-swipe-surface {...swipe.handlers}>
          <div className="byb-swipe-track" ref={swipe.trackRef}>
            <div key={view} className={viewAnim === "none" ? undefined : viewAnim ? `byb-view-${viewAnim}` : "byb-view"}>
              {view === "dashboard" && (
                <Dashboard
                  activeMonth={activeMonth}
                  transactions={transactions}
                  categories={categories}
                  recurring={recurring}
                  styles={styles}
                  unallocatedBalance={unallocatedBalance}
                  onTransferEnvelope={transferEnvelope}
                  onAddTx={saveTx}
                  onAddIncome={addIncome}
                  activeUserId={activeUserId}
                  txFormOpen={txFormOpen}
                  setTxFormOpen={setTxFormOpen}
                  setEditingTx={setEditingTx}
                  onReconcile={reconcileEnvelopes}
                  onNavigateToCategory={navigateToCategory}
                  onFillSingleEnvelope={fillEnvelope}
                  incomeFlowOpen={incomeFlowOpen}
                  setIncomeFlowOpen={setIncomeFlowOpen}
                />
              )}
              {view === "transactions" && (
                <TransactionsView
                  transactions={transactions}
                  categories={categories}
                  users={users}
                  categoriesById={categoriesById}
                  usersById={usersById}
                  activeMonth={activeMonth}
                  activeUserId={activeUserId}
                  txFilters={txFilters}
                  setTxFilters={setTxFilters}
                  editingTx={editingTx}
                  setEditingTx={setEditingTx}
                  txFormOpen={txFormOpen}
                  setTxFormOpen={setTxFormOpen}
                  saveTx={saveTx}
                  deleteTx={deleteTx}
                  onTransferEnvelope={transferEnvelope}
                  onAddIncome={addIncome}
                  incomeFlowOpen={incomeFlowOpen}
                  setIncomeFlowOpen={setIncomeFlowOpen}
                  unallocatedBalance={unallocatedBalance}
                  recurring={recurring}
                  reconcileLog={reconcileLog}
                  styles={styles}
                />
              )}
              {view === "categories" && (
                <EnvelopesView
                  categories={categories}
                  editingCat={editingCat}
                  setEditingCat={setEditingCat}
                  catFormOpen={catFormOpen}
                  setCatFormOpen={setCatFormOpen}
                  saveCat={saveCat}
                  deleteCat={deleteCat}
                  unallocatedBalance={unallocatedBalance}
                  onFillWithIncome={fillAllWithMultipleIncome}
                  onFillSingleEnvelope={fillEnvelope}
                  onSetupBaseAmounts={setupBaseAmounts}
                  recurring={recurring}
                  onReorderCats={reorderCategories}
                  onNavigateToCategory={navigateToCategory}
                  styles={styles}
                />
              )}
              {view === "recurring" && (
                <RecurringView
                  recurring={recurring}
                  categories={categories}
                  users={users}
                  categoriesById={categoriesById}
                  activeUserId={activeUserId}
                  editingRule={editingRule}
                  setEditingRule={setEditingRule}
                  ruleFormOpen={ruleFormOpen}
                  setRuleFormOpen={setRuleFormOpen}
                  saveRule={saveRule}
                  deleteRule={deleteRule}
                  postDueRecurrences={postDueRecurrences}
                  styles={styles}
                />
              )}
              {view === "reports" && (
                <ReportsView
                  transactions={transactions}
                  categories={categories}
                  categoriesById={categoriesById}
                  usersById={usersById}
                  reportRange={reportRange}
                  setReportRange={setReportRange}
                  handleExport={handleExport}
                  assets={assets}
                  onSaveAsset={saveAsset}
                  onDeleteAsset={deleteAsset}
                  transfers={transfers}
                  reconcileLog={reconcileLog}
                  adjustments={adjustments}
                  unallocatedBalance={unallocatedBalance}
                  onSetUnallocated={setUnallocatedManually}
                  onImportJSON={importFromJSON}
                  onImportTransactions={importTransactions}
                  activeUserId={activeUserId}
                  onNavigateToCategory={navigateToCategory}
                  activeMonth={activeMonth}
                  styles={styles}
                />
              )}
            </div>
          </div>
        </div>
        <div style={styles.footer}>
          <span>Running balance: <strong style={{ color: runningBalance >= 0 ? "var(--byb-ok)" : "var(--byb-over)" }} data-testid="running-balance">{fmtAUD(runningBalance)}</strong></span>
          <span style={{ fontSize: 11, color: styles.textMuted, textAlign: "center" }}>BYB! is for personal use only — not financial advice. Use at your own risk.</span>
          <span>Active: {activeUser?.name}{lastUpdated ? ` · last updated ${lastUpdated.slice(0, 10)}` : ""}</span>
        </div>
      </div>
      {settingsOpen && (
        <SettingsModal
          user={usersById[activeUserId]}
          users={users}
          setUsers={setUsers}
          authToken={authToken}
          isAdmin={activeUser?.role === "owner" || activeUser?.role === "admin"}
          theme={theme}
          setTheme={updateTheme}
          activeUserId={activeUserId}
          onShowWelcome={() => { setSettingsOpen(false); setWelcomeOpen(true); }}
          onResetBalances={resetAllBalances}
          onClose={() => setSettingsOpen(false)}
          styles={styles}
        />
      )}
      {showNamePrompt && (
        <NameSetupModal
          authToken={authToken}
          activeUserId={activeUserId}
          onComplete={(newName) => {
            setUsers((prev) => prev.map((u) => u.id === activeUserId ? { ...u, name: newName } : u));
            localStorage.setItem(`byb_named_${activeUserId}`, "1");
            setShowNamePrompt(false);
          }}
          onSkip={() => {
            localStorage.setItem(`byb_named_${activeUserId}`, "1");
            setShowNamePrompt(false);
          }}
          styles={styles}
        />
      )}
      {welcomeOpen && !showNamePrompt && (
        <WelcomeModal onClose={closeWelcome} styles={styles} />
      )}
      <ConfirmHost styles={styles} />
      {toast && <div className="byb-toast" style={styles.toast} data-testid="toast">{toast}</div>}
    </div>
  );
}
