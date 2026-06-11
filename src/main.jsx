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

function Root() {
  const [initialData, setInitialData] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  // Optimistic-concurrency version of the data we last loaded/saved.
  const versionRef = useRef(0);
  // Debounced save machinery — always sends the latest pending payload.
  const pendingRef = useRef(null);
  const timerRef = useRef(null);

  const loadData = useCallback(async () => {
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
        setInitialData(null);
      }
    } catch {
      console.warn("Could not reach API — starting with defaults.");
      setInitialData(null);
    }
    setLoaded(true);
    setReloadKey((k) => k + 1);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const flushSave = useCallback(async () => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    const data = pendingRef.current;
    if (!data) return;
    pendingRef.current = null;
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
        // Someone else saved first — reload their data rather than overwrite.
        console.warn("Save conflict — another user saved first. Reloading latest data.");
        await loadData();
        return;
      }
      if (res.ok) {
        const body = await res.json();
        if (typeof body.dataVersion === "number") versionRef.current = body.dataVersion;
      }
    } catch {
      console.warn("Save failed — is the server running? (npm start)");
    }
  }, [loadData]);

  // Debounce saves so rapid successive edits coalesce into one request.
  const onSave = useCallback((data) => {
    pendingRef.current = data;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(flushSave, SAVE_DEBOUNCE_MS);
  }, [flushSave]);

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
    <BudgetApp
      key={reloadKey}
      initialData={initialData}
      onSave={onSave}
      onExport={(payload) => exportToXlsx(payload)}
      onImport={(file, context) => importFromXlsx(file, context)}
      onReload={loadData}
    />
  );
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);

// PWA — register the service worker for production builds only (Vite dev
// server and the SW cache don't mix well during development).
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
