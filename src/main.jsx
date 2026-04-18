import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import BudgetApp from "./BudgetApp.jsx";
import { exportToXlsx, importFromXlsx } from "./xlsx-helpers.js";

function getToken() {
  return localStorage.getItem("byb_token") || "";
}

function Root() {
  const [initialData, setInitialData] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const loadData = async () => {
    const token = getToken();
    try {
      const res = await fetch("/api/data", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.status === 401) {
        // Session expired or reset — clear all local state so app shows login fresh
        localStorage.removeItem("byb_token");
        localStorage.removeItem("byb_user");
        localStorage.removeItem("byb_welcomed");
        setInitialData(null);
      } else if (res.ok) {
        setInitialData(await res.json());
      } else {
        setInitialData(null);
      }
    } catch {
      console.warn("Could not reach API — starting with defaults.");
      setInitialData(null);
    }
    setLoaded(true);
    setReloadKey((k) => k + 1);
  };

  useEffect(() => { loadData(); }, []);

  const onSave = async (data) => {
    try {
      await fetch("/api/data", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify(data),
      });
    } catch {
      console.warn("Save failed — is the server running? (npm run server)");
    }
  };

  if (!loaded) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", fontFamily: "'Inter', system-ui, sans-serif", color: "#6B6F6B", fontSize: 15 }}>
        Loading…
      </div>
    );
  }

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
