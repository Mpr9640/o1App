import React, { useEffect, useState } from "react";
import apiClient from "../../axios.js";
import styles from "./homepage.module.css";

// ---------- tiny UI helpers (no chart libs) ----------
const Tile = ({ value, label }) => (
  <div className={styles.card}>
    <div style={{ fontSize: 28, fontWeight: 700, lineHeight: 1 }}>{value ?? 0}</div>
    <div style={{ fontSize: 12, color: "#6b7280" }}>{label}</div>
  </div>
);

const WeekBars = ({ weeks, keyName, color = "#10b981" }) => {
  const max = Math.max(1, ...weeks.map((w) => w[keyName] || 0));
  return (
    <div style={{ display: "flex", gap: 4, alignItems: "flex-end", height: 40 }}>
      {weeks.map((w, i) => (
        <div
          key={`${w.week_start}-${i}`}
          title={`${new Date(w.week_start).toLocaleDateString()} — ${w[keyName] || 0}`}
          style={{
            width: 10,
            height: ((w[keyName] || 0) / max) * 40 || 2, // 2px stub so you always see something
            background: color,
            borderRadius: 2,
          }}
        />
      ))}
    </div>
  );
};

// ---------- zero-fill helpers so graphs always render ----------
const toISODate = (d) => {
  const dt = new Date(d);
  dt.setHours(0, 0, 0, 0);
  return dt.toISOString();
};

const startOfWeek = (d) => {
  // Monday as start-of-week; change to Sunday if you prefer
  const dt = new Date(d);
  const day = (dt.getDay() + 6) % 7; // 0..6 (Mon..Sun)
  dt.setDate(dt.getDate() - day);
  dt.setHours(0, 0, 0, 0);
  return dt;
};

const buildZeroWeeks = (n = 8) => {
  const out = [];
  let cur = startOfWeek(new Date());
  for (let i = n - 1; i >= 0; i--) {
    const wk = new Date(cur);
    wk.setDate(cur.getDate() - i * 7);
    out.push({
      week_start: toISODate(wk),
      applied: 0,
      interview: 0,
      rejected: 0,
      finalized: 0,
    });
  }
  return out;
};

const mergeWeekly = (baseWeeks, apiWeeks) => {
  // apiWeeks items look like: {week_start: ISO, applied?, interview?, rejected?, finalized?}
  const map = new Map(baseWeeks.map((w) => [new Date(w.week_start).toISOString().slice(0, 10), { ...w }]));
  (apiWeeks || []).forEach((row) => {
    const key = new Date(row.week_start).toISOString().slice(0, 10);
    if (!map.has(key)) {
      map.set(key, {
        week_start: toISODate(startOfWeek(row.week_start)),
        applied: 0,
        interview: 0,
        rejected: 0,
        finalized: 0,
      });
    }
    const cur = map.get(key);
    ["applied", "interview", "rejected", "finalized"].forEach((k) => {
      if (row[k] != null) cur[k] = row[k];
    });
  });
  // sort by date
  return Array.from(map.values()).sort(
    (a, b) => new Date(a.week_start) - new Date(b.week_start)
  );
};

// ---------- page ----------
const HomePage = () => {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const load = async () => {
    setLoading(true);
    setErr("");
    try {
      // NOTE: If your apiClient baseURL already ends with /api, change to "/jobs/summary"
      const { data } = await apiClient.get("/api/jobs/summary?window_days=90");
      setSummary(data);
    } catch (e) {
      const status = e?.response?.status;
      if (status === 401) setErr("Please sign in to see your dashboard.");
      else setErr(e?.response?.data?.detail || e.message || "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // Build safe totals and zero-filled weekly series
  const totals = {
    all: summary?.totals?.all ?? 0,
    applied: summary?.totals?.applied ?? 0,
    interview: summary?.totals?.interview ?? 0,
    rejected: summary?.totals?.rejected ?? 0,
    finalized: summary?.totals?.finalized ?? 0,
  };

  // Always render 8 weeks; if API has none, merge into zeros
  const weekly = mergeWeekly(buildZeroWeeks(8), summary?.weekly || []);

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <h1>Welcome 👋</h1>
        <p className={styles.sub}>Your job search dashboard at a glance.</p>
      </section>

      {loading && <div style={{ padding: 16 }}>Loading…</div>}

      {!loading && err && (
        <div
          role="alert"
          style={{
            padding: 12,
            border: "1px solid #fecaca",
            background: "#fef2f2",
            color: "#991b1b",
            borderRadius: 8,
            marginBottom: 16,
          }}
        >
          {err}
        </div>
      )}

      {!loading && !err && (
        <>
          {/* Row 1: Totals */}
          <section className={styles.grid}>
            <Tile value={totals.all} label="Total applied" />
            <Tile value={totals.interview} label="Being interviewed" />
            <Tile value={totals.rejected} label="Rejected" />
            {/* If you want: <Tile value={totals.finalized} label="Finalized" /> */}
          </section>

          {/* Row 2: Weekly bars (always visible, zero-filled) */}
          <section className={styles.grid}>
            <div className={styles.card}>
              <h3 style={{ marginTop: 10}}>
                Applied per week (last {summary?.window_days ?? 90}d)
              </h3>
              <WeekBars weeks={weekly} keyName="applied" color="#3b82f6" />
            </div>
            <div className={styles.card}>
              <h3 style={{ marginTop: 0 }}>Interview per week</h3>
              <WeekBars weeks={weekly} keyName="interview" color="#6366f1" />
            </div>
            <div className={styles.card}>
              <h3 style={{ marginTop: 0 }}>Rejected per week</h3>
              <WeekBars weeks={weekly} keyName="rejected" color="#ef4444" />
            </div>
          </section>
        </>
      )}
    </div>
  );
};

export default HomePage;
