import React, { useState, useEffect, useRef } from "react";
import { PALETTE, DEFAULT_USERS, DEFAULT_CATEGORIES, INCIDENTALS_CAT, SAVINGS_CAT, VIEW_ORDER } from "./lib/constants.js";
import { uid, fmtAUD, monthKey, todayISO, addPeriod, dayOfMonth, genMonthRange } from "./lib/utils.js";
import { buildStyles } from "./styles/buildStyles.js";
import { useIsMobile } from "./hooks/useIsMobile.js";
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

const INCOME_COLOURS = ["#A0B894", "#8FA876", "#6B9559", "#7FB069", "#5F8A4F"];

export default function BudgetApp({ onImport, onExport, onSave, onReload, initialData } = {}) {
  const initUsers = initialData?.users?.length ? initialData.users : DEFAULT_USERS;
  // Normalise categories: add envelope fields if missing (backward-compat migration)
  const rawCats = (initialData?.categories?.length ? initialData.categories : DEFAULT_CATEGORIES).map((c) => ({
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
  const initRecurring = initialData?.recurring?.length ? initialData.recurring : [];
  const initTransactions = initialData?.transactions?.length ? initialData.transactions : [];
  const initUnallocated = initialData?.unallocatedBalance || 0;

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
  const [assets, setAssets] = useState(initialData?.assets?.length ? initialData.assets : []);
  const [transfers, setTransfers] = useState(initialData?.transfers?.length ? initialData.transfers : []);
  const [reconcileLog, setReconcileLog] = useState(Array.isArray(initialData?.reconcileLog) ? initialData.reconcileLog : []);
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
  const [txFilters, setTxFilters] = useState({ type: "all", categoryId: "all", addedBy: "all", search: "" });
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

  // Theme variables for the global stylesheet
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
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
      setTxFilters({ type: "all", categoryId: "all", addedBy: "all", search: "" });
    }
    setEditingTx(null);
    setTxFormOpen(false);
    setIncomeFlowOpen(false);
    setEditingCat(null);
    setCatFormOpen(false);
    setEditingRule(null);
    setRuleFormOpen(false);
  };

  // Navigate to Transactions tab filtered by category (sets filter AFTER handleSetView to override the reset)
  const navigateToCategory = (catId) => {
    handleSetView("transactions");
    setTxFilters({ type: "all", categoryId: catId, addedBy: "all", search: "" });
  };

  // ── Swipe between tabs (touch devices) ────────────────────────────────────
  const swipeRef = useRef({ x: 0, y: 0, active: false });
  const inEnvelopeContext = view === "transactions" && txFilters.categoryId !== "all";
  const anyModalOpen = settingsOpen || welcomeOpen || showNamePrompt;

  const onSwipeStart = (e) => {
    const t = e.touches[0];
    swipeRef.current = { x: t.clientX, y: t.clientY, active: true };
  };
  const onSwipeEnd = (e) => {
    if (!swipeRef.current.active) return;
    swipeRef.current.active = false;
    if (anyModalOpen || inEnvelopeContext) return; // envelope view has its own swipe-back
    if (e.target.closest && e.target.closest("input, select, textarea, [data-env-id]")) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - swipeRef.current.x;
    const dy = t.clientY - swipeRef.current.y;
    if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    const idx = VIEW_ORDER.indexOf(view);
    if (dx < 0 && idx < VIEW_ORDER.length - 1) handleSetView(VIEW_ORDER[idx + 1], "right");
    else if (dx > 0 && idx > 0) handleSetView(VIEW_ORDER[idx - 1], "left");
  };

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

  const persist = (patch) => onSave?.({ transactions, categories, recurring, users, unallocatedBalance, assets, transfers, reconcileLog, ...patch });

  // Apply or reverse a transaction's effect on envelope balances + unallocated.
  // Income transactions may carry an `allocations` array ([{catId, amount}])
  // recording money that went straight into envelopes — applying and
  // reversing both honour it, so edits and deletes keep balances correct.
  const applyTxEffect = (tx, factor, cats, unalloc) => {
    let newCats = cats;
    let newUnalloc = unalloc;
    if (tx.type === "expense") {
      newCats = cats.map((c) => c.id === tx.categoryId ? { ...c, envelopeBalance: (c.envelopeBalance || 0) - factor * tx.amount } : c);
    } else if (tx.type === "income") {
      newUnalloc = unalloc + factor * tx.amount;
      for (const alloc of tx.allocations || []) {
        newCats = newCats.map((c) => c.id === alloc.catId ? { ...c, envelopeBalance: (c.envelopeBalance || 0) + factor * alloc.amount } : c);
        newUnalloc -= factor * alloc.amount;
      }
    }
    return { newCats, newUnalloc };
  };

  // Build the allocations array for a TxForm income transaction
  const allocationsFromForm = (tx, availableUnalloc) => {
    if (tx.type !== "income" || !tx.allocatedEnvelopeId) return [];
    const allocAmt = Math.min(tx.amount, Math.max(0, availableUnalloc + tx.amount));
    return allocAmt > 0 ? [{ catId: tx.allocatedEnvelopeId, amount: allocAmt }] : [];
  };

  const saveTx = (tx) => {
    let newTx;
    let newCats = [...categories];
    let newUnalloc = unallocatedBalance;

    if (tx.id) {
      const old = transactions.find((t) => t.id === tx.id);
      if (old) { const r = applyTxEffect(old, -1, newCats, newUnalloc); newCats = r.newCats; newUnalloc = r.newUnalloc; }
      const updated = { ...old, ...tx, allocations: allocationsFromForm(tx, newUnalloc) };
      const r2 = applyTxEffect(updated, 1, newCats, newUnalloc); newCats = r2.newCats; newUnalloc = r2.newUnalloc;
      newTx = transactions.map((t) => (t.id === tx.id ? updated : t));
      showToast("Transaction updated");
    } else {
      const created = {
        ...tx,
        id: uid(),
        createdAt: new Date().toISOString(),
        isRecurring: false,
        recurringId: null,
        allocations: allocationsFromForm(tx, unallocatedBalance),
      };
      const r = applyTxEffect(created, 1, newCats, newUnalloc); newCats = r.newCats; newUnalloc = r.newUnalloc;
      newTx = [created, ...transactions];
      showToast("Transaction added");
    }
    setTransactions(newTx);
    setCategories(newCats);
    setUnallocatedBalance(newUnalloc);
    persist({ transactions: newTx, categories: newCats, unallocatedBalance: newUnalloc });
    setEditingTx(null);
    setTxFormOpen(false);
  };

  const deleteTx = (id) => {
    const tx = transactions.find((t) => t.id === id);
    let newCats = [...categories];
    let newUnalloc = unallocatedBalance;
    if (tx) { const r = applyTxEffect(tx, -1, newCats, newUnalloc); newCats = r.newCats; newUnalloc = r.newUnalloc; }
    const newTx = transactions.filter((t) => t.id !== id);
    setTransactions(newTx);
    setCategories(newCats);
    setUnallocatedBalance(newUnalloc);
    persist({ transactions: newTx, categories: newCats, unallocatedBalance: newUnalloc });
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

    const r = applyTxEffect(tx, 1, newCats, unallocatedBalance);
    const newTx = [tx, ...transactions];
    setTransactions(newTx);
    setCategories(r.newCats);
    setUnallocatedBalance(r.newUnalloc);
    persist({ transactions: newTx, categories: r.newCats, unallocatedBalance: r.newUnalloc });

    const allocated = allocations.reduce((s, a) => s + a.amount, 0);
    if (allocationMode === "fill") showToast(`${fmtAUD(amount)} logged · ${fmtAUD(allocated)} into envelopes`);
    else if (allocationMode === "split") showToast(`${fmtAUD(amount)} logged · ${allocations.length} envelope${allocations.length === 1 ? "" : "s"} topped up`);
    else showToast(`${fmtAUD(amount)} added to Unallocated`);
  };

  // Envelope actions — move money from unallocated into envelopes
  const fillEnvelope = (catId) => {
    const cat = categories.find((c) => c.id === catId);
    const base = cat?.baseAmount || 0;
    if (!cat || base <= 0) { showToast("Set a base amount first"); return; }
    const currentBalance = cat.envelopeBalance || 0;
    const amount = cat.isAccumulating ? base : Math.max(0, base - currentBalance);
    if (amount <= 0) { showToast(`${cat.name} is already full`); return; }
    const newCats = categories.map((c) => c.id === catId ? { ...c, envelopeBalance: currentBalance + amount } : c);
    const newUnalloc = unallocatedBalance - amount;
    setCategories(newCats); setUnallocatedBalance(newUnalloc);
    persist({ categories: newCats, unallocatedBalance: newUnalloc });
    showToast(`Filled ${cat.name} with ${fmtAUD(amount)}`);
  };

  const transferEnvelope = (fromId, toId, amount, description) => {
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
    if (netDraw > 0.01) {
      const ok = await askConfirm({
        title: "Top up from Unallocated?",
        message: `Filling all envelopes will draw ${fmtAUD(netDraw)} from your existing unallocated balance (${fmtAUD(unallocatedBalance)} available).`,
        confirmLabel: "Fill envelopes",
      });
      if (!ok) return;
    }

    let newCats = [...categories];
    let newUnalloc = unallocatedBalance;
    const newIncomeTxs = [];
    validSources.forEach(({ catId, amount }) => {
      const incomeTx = { id: uid(), date: todayISO(), amount, type: "income", categoryId: catId, description: "Income fill", isRecurring: false, recurringId: null, allocations: [], addedBy: activeUserId, createdAt: new Date().toISOString() };
      newIncomeTxs.push(incomeTx);
      const r = applyTxEffect(incomeTx, 1, newCats, newUnalloc);
      newCats = r.newCats; newUnalloc = r.newUnalloc;
    });

    // Hard reset: non-savings → set balance to exactly base; savings → add base
    const fillMap = {};
    expCats.forEach((c) => {
      const base = c.baseAmount || 0;
      fillMap[c.id] = c.isAccumulating ? base : (base - (c.envelopeBalance || 0));
    });
    newCats = newCats.map((c) => fillMap[c.id] != null ? { ...c, envelopeBalance: (c.envelopeBalance || 0) + fillMap[c.id] } : c);
    newUnalloc = newUnalloc - Object.values(fillMap).reduce((s, a) => s + a, 0);

    const newTx = [...newIncomeTxs, ...transactions];
    setTransactions(newTx); setCategories(newCats); setUnallocatedBalance(newUnalloc);
    persist({ transactions: newTx, categories: newCats, unallocatedBalance: newUnalloc });
    showToast(`${fmtAUD(totalIncome)} income logged · envelopes filled`);
  };

  // First-time wizard: bulk set base amounts AND immediately fill envelopes
  const setupBaseAmounts = (amountsMap) => {
    const newCats = categories.map((c) =>
      amountsMap[c.id] !== undefined
        ? { ...c, baseAmount: amountsMap[c.id], monthlyBudget: amountsMap[c.id], envelopeBalance: amountsMap[c.id] }
        : c
    );
    setCategories(newCats);
    persist({ categories: newCats });
    showToast("Envelopes set up and filled! Your balances are ready to go.");
  };

  // End-of-month reconcile: pool non-savings surpluses, cover deficits,
  // remainder to unallocated. Every run is recorded in the reconcile log.
  const reconcileEnvelopes = () => {
    const nonSavings = categories.filter((c) => c.type === "expense" && !c.isAccumulating);
    const hasActivity = nonSavings.some((c) => (c.envelopeBalance || 0) !== 0);
    if (!hasActivity) { showToast("Nothing to reconcile"); return; }

    // Step 1: pool all positive non-savings balances
    let pool = 0;
    const afterPool = categories.map((c) => {
      if (c.type === "expense" && !c.isAccumulating && (c.envelopeBalance || 0) > 0) {
        pool += c.envelopeBalance;
        return { ...c, envelopeBalance: 0 };
      }
      return c;
    });
    const totalPooled = pool;

    // Step 2: cover negatives most-negative first
    const negIds = afterPool
      .filter((c) => c.type === "expense" && !c.isAccumulating && (c.envelopeBalance || 0) < 0)
      .sort((a, b) => (a.envelopeBalance || 0) - (b.envelopeBalance || 0))
      .map((c) => c.id);

    let toppedUp = 0;
    let finalCats = [...afterPool];
    for (const id of negIds) {
      if (pool <= 0) break;
      const c = finalCats.find((x) => x.id === id);
      if (!c) continue;
      const deficit = -(c.envelopeBalance || 0);
      const use = Math.min(deficit, pool);
      pool -= use;
      if (use > 0) toppedUp++;
      finalCats = finalCats.map((x) => x.id === id ? { ...x, envelopeBalance: (x.envelopeBalance || 0) + use } : x);
    }

    const returned = pool;
    const newUnalloc = unallocatedBalance + returned;

    // Record the reconcile in the log
    const entry = {
      id: uid(),
      date: todayISO(),
      at: new Date().toISOString(),
      userId: activeUserId,
      pooled: Math.round(totalPooled * 100) / 100,
      toppedUp,
      returned: Math.round(returned * 100) / 100,
    };
    const newLog = [entry, ...reconcileLog].slice(0, 120); // keep last 120 runs

    setCategories(finalCats);
    setUnallocatedBalance(newUnalloc);
    setReconcileLog(newLog);
    persist({ categories: finalCats, unallocatedBalance: newUnalloc, reconcileLog: newLog });

    // Notify external automation (n8n webhook) if the server has one configured
    fetch("/api/events/reconcile", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
      body: JSON.stringify(entry),
    }).catch(() => {});

    let msg = `${fmtAUD(totalPooled)} redistributed`;
    if (toppedUp > 0) msg += ` · ${toppedUp} envelope${toppedUp !== 1 ? "s" : ""} topped up`;
    if (returned > 0.01) msg += ` · ${fmtAUD(returned)} returned to unallocated`;
    showToast(msg);
  };

  const resetAllBalances = () => {
    const newCats = categories.map((c) => ({ ...c, envelopeBalance: 0 }));
    setCategories(newCats);
    setUnallocatedBalance(0);
    persist({ categories: newCats, unallocatedBalance: 0 });
    showToast("All balances reset to zero");
  };

  const reorderCategories = (newCats) => {
    setCategories(newCats);
    persist({ categories: newCats });
  };

  const setUnallocatedManually = (amount) => {
    setUnallocatedBalance(amount);
    persist({ unallocatedBalance: amount });
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
    if (total > 0) {
      const confirmed = await askConfirm({
        title: `Delete "${cat.name}"?`,
        message: `${total} item(s) reference this envelope (${txCount} transaction(s), ${ruleCount} recurring rule(s)). They will be reassigned to "Household Incidentals".`,
        confirmLabel: "Delete & reassign",
        danger: true,
      });
      if (!confirmed) return;
      // Ensure Incidentals exists in categories
      const hasIncidentals = categories.some((c) => c.id === INCIDENTALS_CAT.id);
      const catsWithIncidentals = hasIncidentals ? categories : [...categories, INCIDENTALS_CAT];
      const newTx = transactions.map((t) => t.categoryId === id ? { ...t, categoryId: INCIDENTALS_CAT.id } : t);
      const newRecurring = recurring.map((r) => r.categoryId === id ? { ...r, categoryId: INCIDENTALS_CAT.id } : r);
      const newCats = catsWithIncidentals.filter((c) => c.id !== id);
      setTransactions(newTx); setRecurring(newRecurring); setCategories(newCats);
      persist({ transactions: newTx, recurring: newRecurring, categories: newCats });
      showToast(`Deleted "${cat.name}" · ${total} item(s) moved to Incidentals`);
    } else {
      const confirmed = await askConfirm({
        title: `Delete "${cat.name}"?`,
        message: "This cannot be undone.",
        confirmLabel: "Delete",
        danger: true,
      });
      if (!confirmed) return;
      const newCats = categories.filter((c) => c.id !== id);
      setCategories(newCats);
      persist({ categories: newCats });
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
    let newCats = [...categories];
    let newUnalloc = unallocatedBalance;
    newPosted.forEach((tx) => { const r = applyTxEffect(tx, 1, newCats, newUnalloc); newCats = r.newCats; newUnalloc = r.newUnalloc; });
    setTransactions(newTx); setRecurring(newRecurring); setCategories(newCats); setUnallocatedBalance(newUnalloc);
    persist({ transactions: newTx, recurring: newRecurring, categories: newCats, unallocatedBalance: newUnalloc });
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

  const importFromJSON = (jsonText) => {
    try {
      const parsed = JSON.parse(jsonText);
      if (!Array.isArray(parsed)) throw new Error("Expected a JSON array of transactions");
      const existing = new Set(transactions.map((t) => t.id));
      const incomeCatId = categories.find((c) => c.type === "income")?.id || "";
      const expenseCatId = categories.find((c) => c.type === "expense")?.id || "";
      const valid = parsed
        .filter((t) => t.date && t.amount)
        .map((t) => ({
          id: t.id || uid(),
          date: t.date,
          amount: Math.abs(parseFloat(t.amount) || 0),
          type: t.type === "income" ? "income" : "expense",
          categoryId: t.categoryId || (t.type === "income" ? incomeCatId : expenseCatId),
          description: t.description || "",
          isRecurring: false,
          recurringId: null,
          allocations: [],
          imported: true,
          addedBy: t.addedBy || activeUserId,
          createdAt: t.createdAt || new Date().toISOString(),
        }))
        .filter((t) => t.amount > 0 && !existing.has(t.id));
      if (valid.length === 0) { showToast("No new transactions found in the pasted data"); return false; }
      let newCats = [...categories];
      let newUnalloc = unallocatedBalance;
      valid.forEach((tx) => { const r = applyTxEffect(tx, 1, newCats, newUnalloc); newCats = r.newCats; newUnalloc = r.newUnalloc; });
      const newTx = [...valid, ...transactions];
      setTransactions(newTx); setCategories(newCats); setUnallocatedBalance(newUnalloc);
      persist({ transactions: newTx, categories: newCats, unallocatedBalance: newUnalloc });
      showToast(`Imported ${valid.length} transaction${valid.length !== 1 ? "s" : ""}`);
      return true;
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
        const existing = new Set(transactions.map((t) => t.id));
        const newRows = result.added.filter((t) => !existing.has(t.id));
        const merged = [...transactions, ...newRows];
        setTransactions(merged);
        persist({ transactions: merged });
        showToast(`Imported ${newRows.length} row(s)${result.skipped ? `, skipped ${result.skipped}` : ""}`);
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
        <div
          style={styles.content}
          onTouchStart={onSwipeStart}
          onTouchEnd={onSwipeEnd}
        >
          <div key={view} className={viewAnim ? `byb-view-${viewAnim}` : "byb-view"}>
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
                unallocatedBalance={unallocatedBalance}
                onSetUnallocated={setUnallocatedManually}
                onImportJSON={importFromJSON}
                onNavigateToCategory={navigateToCategory}
                activeMonth={activeMonth}
                styles={styles}
              />
            )}
          </div>
        </div>
        <div style={styles.footer}>
          <span>Running balance: <strong style={{ color: runningBalance >= 0 ? PALETTE.primaryDeep : PALETTE.warn }} data-testid="running-balance">{fmtAUD(runningBalance)}</strong></span>
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
