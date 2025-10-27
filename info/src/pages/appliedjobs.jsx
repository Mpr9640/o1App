import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import apiClient from "../axios.js";
import JobCard from "../components/jobcard/jobcard";
import s from "./appliedjobs.module.css";

/* ---------- helpers ---------- */
const useQuery = () => {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
};

const STATUS_OPTIONS = [
  { value: "",           label: "All statuses" },
  { value: "applied",    label: "Applied" },
  { value: "interview",  label: "Selected for interview" },
  { value: "finalized",  label: "Accepted" },
  { value: "rejected",   label: "Rejected" },
];

export default function AppliedJobsPage() {
  const q = useQuery();
  const navigate = useNavigate();

  // read initial filters from URL (what HomePage sends)
  const [status, setStatus] = useState(q.get("status") || "");
  const [start,  setStart]  = useState(q.get("start")  || ""); // YYYY-MM-DD
  const [end,    setEnd]    = useState(q.get("end")    || "");

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // keep local filter state in sync if URL changes elsewhere
  useEffect(() => {
    setStatus(q.get("status") || "");
    setStart(q.get("start") || "");
    setEnd(q.get("end") || "");
  }, [q]);

  const buildQueryString = () => {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (start)  params.set("start", start);
    if (end)    params.set("end", end);
    return params.toString();
  };

  const pushUrl = () => {
    const qs = buildQueryString();
    navigate(qs ? `/applied-jobs?${qs}` : "/applied-jobs", { replace: true });
  };

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const qs = buildQueryString();
      const { data } = await apiClient.get(`/api/jobs${qs ? `?${qs}` : ""}`);
      // supports array or {items:[]}
      setRows(Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : []));
    } catch (err) {
      const statusCode = err?.response?.status;
      if (statusCode === 404) setRows([]);
      else if (statusCode === 401) setError("Please sign in to view your applied jobs.");
      else setError(err?.response?.data?.detail || err.message || "Failed to load jobs");
    } finally {
      setLoading(false);
    }
  };

  // load on first render and whenever URL filters change
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.get("status"), q.get("start"), q.get("end")]);

  const applyFilters = (e) => {
    e?.preventDefault?.();
    pushUrl(); // triggers useEffect -> load()
  };

  const clearFilters = () => {
    setStatus("");
    setStart("");
    setEnd("");
    navigate("/applied-jobs", { replace: true }); // triggers reload
  };

  // quick helper to set current week (Mon–Sun)
  const setThisWeek = () => {
    const now = new Date();
    const day = (now.getDay() + 6) % 7; // Mon=0
    const s = new Date(now);
    s.setDate(now.getDate() - day);
    s.setHours(0, 0, 0, 0);
    const e = new Date(s);
    e.setDate(s.getDate() + 6);
    e.setHours(23, 59, 59, 999);
    const iso = (d) => new Date(d).toISOString().slice(0, 10);
    setStart(iso(s));
    setEnd(iso(e));
  };

  return (
    <div className={s.page}>
      <div className={s.header}>
        <h2 className={s.h2}>Applied Jobs</h2>
        <form onSubmit={applyFilters} className={s.filters}>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            title="Filter by status"
            className={s.select}
          >
            {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>

          <input
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            aria-label="Start date"
            className={s.input}
          />
          <input
            type="date"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            aria-label="End date"
            className={s.input}
          />

          <button type="submit" className={s.primary}>Apply filters</button>
          <button type="button" onClick={clearFilters} className={s.ghost}>Clear</button>
          <button type="button" onClick={setThisWeek} className={s.ghost}>This week</button>
        </form>
      </div>

      {loading && <div className={s.loading}>Loading…</div>}

      {!loading && !!error && (
        <div role="alert" className={s.error}>{error}</div>
      )}

      {!loading && !error && rows.length === 0 && (
        <p className={s.empty}>No jobs found for these filters.</p>
      )}

      {!loading && !error && rows.length > 0 && (
        <div className={s.listGrid}>
          {rows.map((j) => (
            <JobCard
              key={j.id}
              job={j}
              onUpdated={load}
              onDeleted={(id) => setRows((prev) => prev.filter((x) => x.id !== id))}
            />
          ))}
        </div>
      )}
    </div>
  );
}
