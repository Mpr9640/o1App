// src/layout/authlayout.jsx
import React, { useState } from "react";
import { Outlet } from "react-router-dom";
import styles from "./authlayout.module.css";
import { AlertDialog } from "../components/common/dialog";

export default function AuthLayout() {
  const [alertOpen, setAlertOpen] = useState(false);
  const [alertMsg, setAlertMsg] = useState("");

  const showAlert = (msg) => {
    setAlertMsg(msg);
    setAlertOpen(true);
  };

  return (
    <>
      <div className={styles.authShell}>
        <div className={styles.authContent}>
          {/* Pass showAlert to all child routes */}
          <Outlet context={{ showAlert }} />
        </div>
      </div>

      <AlertDialog
        open={alertOpen}
        title="Notice"
        message={alertMsg}
        onClose={() => setAlertOpen(false)}
      />
    </>
  );
}
