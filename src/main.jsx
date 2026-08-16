import React, { useState, useEffect, useRef, useCallback } from "react";
import { createRoot } from "react-dom/client";
import BudgetApp from "./BudgetApp.jsx";
import { exportToXlsx, importFromXlsx } from "./xlsx-helpers.js";
import "./styles/global.css";

function getToken() {
  return localStorage.getItem("byb_token") || "";
}

const SAVE_DEBOUNCE_MS = 600;

function SkeletonScreen() {
  return (
    <div className="byb-skeleton-screen">
      <div className="byb-skeleton-sidebar">
        <div className="byb-skeleton byb-skeleton-logo" />
        {[...Array(5)].map((_, i) => <div key={i} className="byb-skeleton byb-skeleton-nav" />)}
      </div>
      <div className="byb-skeleton-main">
        <div className="byb-skeleton byb-skeleton-header" />
        <div className="byb-skeleton byb-skeleton-kpi" />
        {[...Array(6)].map((_, i) => <div key={i} className="byb-skeleton byb-skeleton-row" />)}
      </div>
    </div>
  );
}

export function Root() {
  const [initialData, setInitialData] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [saveConflict, setSaveConflict] = useState(false);
  const [discardingConflict, setDiscardingConflict] = useState(false);

  // Optimistic-concurrency version of the data we last loaded/saved.
  const versionRef = useRef(0);
  // Debounced, serial save machinery. `latestDraftRef` is deliberately kept
  // separate from the payload currently in flight: an edit made while a POST
  // is waiting must survive if that POST loses an optimistic-concurrency race.
  const pendingRef = useRef(null);
  const latestDraftRef = useRef(null);
  const timerRef = useRef(null);
  const saveInFlightRef = useRef(false);
  const conflictRef = useRef(false);

  const loadData = useCallback(async (preserveOnFailure = false) => {
    const token = getToken();
    try {
      const res = await fetch("/api/data", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.status === 401) {
        // Session expired — clear auth state only. The welcome flag is
        // deliberately NOT cleared (it lives on the user record server-side
        // now; the localStorage copy is just a fallback for offline starts).
        localStorage.removeItem("byb_token");
        localStorage.removeItem("byb_user");
        setInitialData(null);
      } else if (res.ok) {
        const data = await res.json();
        versionRef.current = typeof data.dataVersion === "number" ? data.dataVersion : 0;
        setInitialData(data);
      } else {
        if (preserveOnFailure) return false;
        setInitialData(null);
      }
    } catch {
      console.warn("Could not reach API — starting with defaults.");
      if (preserveOnFailure) return false;
      setInitialData(null);
    }
    setLoaded(true);
    setReloadKey((k) => k + 1);
    return true;
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const flushSave = useCallback(async () => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    // A second debounce can fire while the first POST is still waiting. Leave
    // its payload queued; the first request's `finally` block will send it with
    // the newly returned version. Once a real conflict exists, only the user's
    // explicit discard-and-reload action may replace what is on screen.
    if (saveInFlightRef.current || conflictRef.current) return;
    const data = pendingRef.current;
    if (!data) return;
    pendingRef.current = null;
    saveInFlightRef.current = true;
    let continueQueue = false;
    try {
      const res = await fetch("/api/data", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ ...data, dataVersion: versionRef.current }),
      });
      if (res.status === 409) {
        // Never reload or retry a stale whole-household snapshot here. Reloading
        // discards this person's local edit; retrying after a GET overwrites the
        // other person's winning edit. Keep the newest local draft rendered and
        // require a clearly labelled, explicit discard instead.
        pendingRef.current = latestDraftRef.current;
        conflictRef.current = true;
        setSaveConflict(true);
        console.warn("Save conflict — local changes remain on screen and are not saved.");
        return;
      }
      if (res.ok) {
        const body = await res.json();
        if (typeof body.dataVersion === "number") versionRef.current = body.dataVersion;
        if (latestDraftRef.current === data) latestDraftRef.current = null;
        continueQueue = !!pendingRef.current;
      } else {
        pendingRef.current = latestDraftRef.current || data;
        console.warn(`Save failed with status ${res.status}.`);
      }
    } catch {
      pendingRef.current = latestDraftRef.current || data;
      console.warn("Save failed — is the server running? (npm start)");
    } finally {
      saveInFlightRef.current = false;
      if (continueQueue && !conflictRef.current && pendingRef.current) {
        timerRef.current = setTimeout(flushSave, 0);
      }
    }
  }, []);

  // Debounce saves so rapid successive edits coalesce into one request.
  const onSave = useCallback((data) => {
    latestDraftRef.current = data;
    pendingRef.current = data;
    if (conflictRef.current) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(flushSave, SAVE_DEBOUNCE_MS);
  }, [flushSave]);

  const resetSaveState = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    pendingRef.current = null;
    latestDraftRef.current = null;
    conflictRef.current = false;
    setSaveConflict(false);
  }, []);

  const discardAndReload = useCallback(async () => {
    setDiscardingConflict(true);
    const reloaded = await loadData(true);
    if (reloaded) resetSaveState();
    setDiscardingConflict(false);
  }, [loadData, resetSaveState]);

  // BudgetApp only requests a reload after an explicit login or logout. Those
  // actions intentionally start a fresh authenticated view, so a successful
  // reload also clears any save state left by the previous session.
  const reloadForAuth = useCallback(async () => {
    const reloaded = await loadData();
    if (reloaded) resetSaveState();
  }, [loadData, resetSaveState]);

  // Flush pending saves when the tab is hidden or closed.
  useEffect(() => {
    const onHide = () => { if (document.visibilityState === "hidden") flushSave(); };
    window.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", flushSave);
    return () => {
      window.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", flushSave);
    };
  }, [flushSave]);

  if (!loaded) return <SkeletonScreen />;

  return (
    <>
      {saveConflict && (
        <div className="byb-save-conflict" role="alert" aria-live="assertive">
          <div>
            <strong>Changes not saved</strong>
            <span>Another person saved changes. Your changes are still on screen but have not been saved.</span>
          </div>
          <button type="button" onClick={discardAndReload} disabled={discardingConflict}>
            {discardingConflict ? "Reloading latest…" : "Discard my unsaved changes and reload latest"}
          </button>
        </div>
      )}
      <BudgetApp
        key={reloadKey}
        initialData={initialData}
        onSave={onSave}
        onExport={(payload) => exportToXlsx(payload)}
        onImport={(file, context) => importFromXlsx(file, context)}
        onReload={reloadForAuth}
      />
    </>
  );
}

const rootElement = document.getElementById("root");
if (rootElement) {
  createRoot(rootElement).render(
    <React.StrictMode>
      <Root />
    </React.StrictMode>
  );
}

// PWA — register the service worker for production builds only (Vite dev
// server and the SW cache don't mix well during development).
if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
