import React, { useState } from "react";
import apiClient from "../../axios.js";
import s from "./jobcard.module.css";
import {ConfirmDialog} from "../common/dialog";  // 👈 import modal

function initials(name = "?") {
  return name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}
function relTime(iso) {
  const d = iso ? new Date(iso) : new Date();
  const secs = Math.max(1, Math.floor((Date.now() - d.getTime()) / 1000));
  const units = [[31536000,"y"],[2592000,"mo"],[604800,"w"],[86400,"d"],[3600,"h"],[60,"m"]];
  for (const [u, l] of units) if (secs >= u) return Math.floor(secs / u) + l + " ago";
  return secs + "s ago";
}

const STATUS_OPTIONS = [
  { value: "applied",   label: "Applied" },
  { value: "interview", label: "Selected for interview" },
  { value: "rejected",  label: "Rejected" },
  { value: "finalized", label: "Finalized" },
];

function toErrorMessage(err) {
  const detail = err?.response?.data?.detail ?? err?.response?.data;
  if (Array.isArray(detail)) {
    return detail
      .map((e) => `${(e.loc || []).join(".") || "payload"} — ${e.msg}`)
      .join("\n");
  }
  if (detail && typeof detail === "object") {
    if (detail.msg) return String(detail.msg);
    if (detail.error) return String(detail.error);
    try { return JSON.stringify(detail); } catch {}
  }
  return err?.message || "Request failed";
}


export default function JobCard({ job, onUpdated, onDeleted }) {
  const [status, setStatus] = useState(job.status || "applied");
  const [notes, setNotes] = useState(job.notes || "");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [err, setErr] = useState("");
  const [showConfirm, setShowConfirm] = useState(false); // 👈

  const logo = job.company_logo_url;
  const bg =
    "#" + Math.abs((job.company || "?").split("").reduce((a,c)=>a+c.charCodeAt(0),0))
      .toString(16).padStart(6,"0").slice(0,6);

  const save = async () => {
    setSaving(true); setErr("");
    try {
      const payload = { status, notes: typeof notes === "string" ? notes : JSON.stringify(notes) };
      await apiClient.patch(`/api/jobs/${job.id}`, payload);
      onUpdated?.();
    } catch (e) {
      setErr(toErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    setDeleting(true); setErr("");
    try {
      await apiClient.delete(`/api/jobs/${job.id}`);
      onDeleted?.(job.id);
    } catch (e) {
      setErr(toErrorMessage(e));
    } finally {
      setDeleting(false);
      setShowConfirm(false); // close dialog
    }
  };

  return (
    <>
      <div className={s.card}>
        <button
          type="button"
          className={s.del}
          onClick={() => setShowConfirm(true)}  // 👈 show modal
          aria-label="Delete job"
          title="Delete job"
          disabled={deleting || saving}
        >
          ×
        </button>
        <div className={s.left}>
          {logo ? (
            <img src={logo} alt="logo" className={s.logo} />
          ) : (
            <div className={s.logoFallback} style={{ background: bg }}>
              {initials(job.company || job.title)}
            </div>
          )}
        </div>

        <div className={s.body}>
          <div className={s.title}>{job.title}</div>
          <div className={s.sub}>
            <span>{job.company || "—"}</span>
            {job.location && <span className={s.dot}>•</span>}
            {job.location && <span>{job.location}</span>}
          </div>
          {job.url && (
            <a className={s.link} href={job.url} target="_blank" rel="noreferrer">Open job</a>
          )}

          <div className={s.noteRow}>
            <textarea
              rows={2}
              placeholder="Notes (optional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {err && (
            <div className={s.err}>
              {String(err).split("\n").map((line, i) => <div key={i}>{line}</div>)}
            </div>
          )}
        </div>

        <div className={s.right}>
          <div className={s.time} title={job.applied_at}>{relTime(job.applied_at)}</div>
          <div className={s.controls}>
            <select value={status} onChange={(e) => setStatus(e.target.value)} disabled={saving || deleting} title="Update status">
              {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <button onClick={save} disabled={saving || deleting}>{saving ? "Saving…" : "Save"}</button>
          </div>
        </div>
      </div>
      <ConfirmDialog
        open={showConfirm}
        title="Delete job"
        message="Are you sure you want to remove this job from your list?"
        onConfirm={remove}
        onCancel={() => setShowConfirm(false)}
      />
    </>
  );
}

