import React from "react";
import styles from "./dialog.module.css";

/** One-button info/error modal */
export function AlertDialog({ open, title = "Notice", message, onClose }) {
  if (!open) return null;
  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true" aria-labelledby="alert-title">
      <div className={styles.dialog}>
        {title && <h3 id="alert-title" className={styles.title}>{title}</h3>}
        {message && <p className={styles.message}>{message}</p>}
        <div className={styles.actions}>
          <button className={styles.primary} onClick={onClose} autoFocus>OK</button>
        </div>
      </div>
    </div>
  );
}

/** Two-button confirm modal */
export function ConfirmDialog({ open, title = "Confirm", message, onConfirm, onCancel, confirmText = "Confirm", cancelText = "Cancel" }) {
  if (!open) return null;
  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true" aria-labelledby="confirm-title">
      <div className={styles.dialog}>
        {title && <h3 id="confirm-title" className={styles.title}>{title}</h3>}
        {message && <p className={styles.message}>{message}</p>}
        <div className={styles.actions}>
          <button className={styles.ghost} onClick={onCancel}>{cancelText}</button>
          <button className={styles.danger} onClick={onConfirm} autoFocus>{confirmText}</button>
        </div>
      </div>
    </div>
  );
}
