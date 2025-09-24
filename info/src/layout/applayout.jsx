import React, { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import apiClient from "../axios.js";
import styles from "./applayout.module.css";

export default function AppLayout() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  const logout = async () => {
    try {
      setBusy(true);
      await apiClient.post("/api/logout");
      navigate("/");
    } catch (e) {
      alert(e?.response?.data?.detail || "Logout failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>Job Aid</div>
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
            to='/applied-jobs'
            className = {({ isActive})=> isActive? `${styles.link} ${styles.active}`: styles.link}
          >
            Jobs Applied
          </NavLink>
          <button
            type="button"
            className={`${styles.link} ${styles.logout}`}
            onClick={logout}
            disabled={busy}
          >
            {busy ? "Logging out…" : "Logout"}
          </button>
        </nav>
      </aside>

      <main className={styles.content}>
        {/* All page content renders here; sidebar stays put */}
        <Outlet />
      </main>
    </div>
  );
}
