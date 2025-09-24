import React from "react";
import { Outlet } from "react-router-dom";
import styles from "./authlayout.module.css";

export default function AuthLayout() {
  return (
    <div className={styles.authShell}>
      {/* Provide a reasonable width for forms; children can be any auth page */}
      <div className={styles.authContent}>
        <Outlet />
      </div>
    </div>
  );
}
