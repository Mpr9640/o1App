// src/layout/applayout.jsx
import React, { useState, useCallback } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import apiClient from "../axios.js";
import styles from "./applayout.module.css";
import { AlertDialog } from "../components/common/dialog"; // uses your existing dialog

export default function AppLayout() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  // --- AlertDialog state (global)
  const [alertOpen, setAlertOpen] = useState(false);
  const [alertTitle, setAlertTitle] = useState("Notice");
  const [alertMsg, setAlertMsg] = useState("");

  // Expose this to all child routes via Outlet context
  const showAlert = useCallback(
    ({ title = "Notice", message = "" } = {}) => {
      setAlertTitle(title);
      setAlertMsg(message);
      setAlertOpen(true);
    },
    []
  );

  const logout = async () => {
    try {
      setBusy(true);
      await apiClient.post("/api/logout");
      navigate("/");
    } catch (e) {
      showAlert({
        title: "Logout",
        message: e?.response?.data?.detail || "Logout failed",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.shell}>
      <aside className={`${styles.sidebar} ${styles.glassPanel}`}>
        <div className={styles.brandRow}>
          <img
            src="/icon.jpeg"
            alt="Job Aid icon"
            className={styles.brandLogo}
            loading="eager"
            width={28}
            height={28}
          />
          <div className={styles.brandText}>Job Aid</div>
        </div>

        <nav className={styles.nav}>
          <NavLink
            to="/home"
            className={({ isActive }) =>
              isActive ? `${styles.link} ${styles.active}` : styles.link
            }
          >
            Home
          </NavLink>
          <NavLink
            to="/profile"
            className={({ isActive }) =>
              isActive ? `${styles.link} ${styles.active}` : styles.link
            }
          >
            Profile
          </NavLink>
          <NavLink
            to="/applied-jobs"
            className={({ isActive }) =>
              isActive ? `${styles.link} ${styles.active}` : styles.link
            }
          >
            Jobs Applied
          </NavLink>

          <button
            type="button"
            className={`${styles.link} ${styles.logout}`}
            onClick={logout}
            disabled={busy}
            aria-busy={busy ? "true" : "false"}
          >
            {busy ? "Logging out…" : "Logout"}
          </button>
        </nav>
      </aside>

      {/* Global alert modal host */}
      <AlertDialog
        open={alertOpen}
        title={alertTitle}
        message={alertMsg}
        onClose={() => setAlertOpen(false)}
      />

      <main className={`${styles.content} ${styles.glassPanel}`}>
        {/* Pass showAlert to all nested routes */}
        <Outlet context={{ showAlert }} />
      </main>
    </div>
  );
}
