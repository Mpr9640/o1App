import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "../../axios.js";
import styles from "./homepage.module.css";

/* ---------------- helpers: time + weeks ---------------- */
const toISODate = (d) => {
  const dt = new Date(d);
  dt.setHours(0, 0, 0, 0);
  return dt.toISOString();
};

const startOfWeek = (d) => {
  // Monday start; change to Sunday if you prefer
  const dt = new Date(d);
  const day = (dt.getDay() + 6) % 7; // 0..6 (Mon..Sun)
  dt.setDate(dt.getDate() - day);
  dt.setHours(0, 0, 0, 0);
  return dt;
};

const endOfWeek = (d) => {
  const s = startOfWeek(d);
  const e = new Date(s);
  e.setDate(s.getDate() + 6);
  e.setHours(23, 59, 59, 999);
  return e;
};

const fmtShort = (d) =>
  new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" });

const sameWeekKey = (iso) =>
  new Date(iso).toISOString().slice(0, 10); // YYYY-MM-DD of start

const buildZeroWeeks = (n = 13 /* ~90 days */) => {
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
  const map = new Map(
    baseWeeks.map((w) => [
      new Date(w.week_start).toISOString().slice(0, 10),
      { ...w },
    ])
  );
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
  return Array.from(map.values()).sort(
    (a, b) => new Date(a.week_start) - new Date(b.week_start)
  );
};

/* ---------------- tiny UI primitives ---------------- */
const Tile = ({ value, label, onView }) => (
  <div className={styles.card}>
    <div className={styles.tileValue}>{value ?? 0}</div>
    <div className={styles.tileLabel}>{label}</div>
    {onView && (
      <button type="button" className={styles.viewBtn} onClick={onView}>
        View
      </button>
    )}
  </div>
);

// Simple column chart (4 bars)
const ColumnChart = ({ data, max }) => {
  const items = [
    { key: "applied", colorVar: "var(--c-applied)", label: "Applied" },
    { key: "interview", colorVar: "var(--c-interview)", label: "Interview" },
    { key: "rejected", colorVar: "var(--c-rejected)", label: "Rejected" },
    { key: "finalized", colorVar: "var(--c-finalized)", label: "Accepted" },
  ];
  const m = Math.max(1, max ?? Math.max(...items.map((i) => data[i.key] || 0)));
  return (
    <div className={styles.colsWrap}>
      {items.map((i) => {
        const v = data[i.key] || 0;
        const h = (v / m) * 80; // 80px max height
        return (
          <div className={styles.col} key={i.key} title={`${i.label}: ${v}`}>
            <div
              className={styles.colBar}
              style={{ height: `${h}px`, background: i.colorVar }}
            />
            <div className={styles.colCap}>{v}</div>
            <div className={styles.colLbl}>{i.label}</div>
          </div>
        );
      })}
    </div>
  );
};

// Donut (pie) chart via SVG
const Donut = ({ data }) => {
  const items = [
    { key: "applied", colorVar: "var(--c-applied)" },
    { key: "interview", colorVar: "var(--c-interview)" },
    { key: "rejected", colorVar: "var(--c-rejected)" },
    { key: "finalized", colorVar: "var(--c-finalized)" },
  ];
  const values = items.map((i) => data[i.key] || 0);
  const total = Math.max(1, values.reduce((a, b) => a + b, 0));
  const r = 36;
  const c = 2 * Math.PI * r;

  let offset = 0;
  return (
    <svg viewBox="0 0 100 100" className={styles.donut}>
      <circle cx="50" cy="50" r={r} className={styles.donutBg} />
      {items.map((i, idx) => {
        const val = values[idx];
        const frac = val / total;
        const len = frac * c;
        const dash = `${len} ${c - len}`;
        const el = (
          <circle
            key={i.key}
            cx="50"
            cy="50"
            r={r}
            fill="transparent"
            stroke={i.colorVar}
            strokeWidth="12"
            strokeDasharray={dash}
            strokeDashoffset={-offset}
          />
        );
        offset += len;
        return el;
      })}
      <text x="50" y="54" textAnchor="middle" className={styles.donutText}>
        {total}
      </text>
    </svg>
  );
};

/* ---------------- page ---------------- */
const HomePage = () => {
  const navigate = useNavigate();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [selectedWeekKey, setSelectedWeekKey] = useState("");

  const load = async () => {
    setLoading(true);
    setErr("");
    try {
      const { data } = await apiClient.get("/api/jobs/summary?window_days=90");
      setSummary(data);
    } catch (e) {
      const status = e?.response?.status;
      if (status === 401) setErr("Please sign in to see your dashboard.");
      else
        setErr(
          e?.response?.data?.detail || e.message || "Failed to load dashboard"
        );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const totals = {
    all: summary?.totals?.all ?? 0,
    applied: summary?.totals?.applied ?? 0,
    interview: summary?.totals?.interview ?? 0,
    rejected: summary?.totals?.rejected ?? 0,
    finalized: summary?.totals?.finalized ?? 0,
  };

  // ~13 weeks (≈90 days)
  const weekly = useMemo(
    () => mergeWeekly(buildZeroWeeks(13), summary?.weekly || []),
    [summary]
  );

  // Build week dropdown options (Mon–Sun)
  const weekOptions = useMemo(() => {
    return weekly.map((w) => {
      const s = new Date(w.week_start);
      const e = endOfWeek(s);
      return {
        key: sameWeekKey(w.week_start),
        label: `${fmtShort(s)} – ${fmtShort(e)}`,
        start: s,
        end: e,
        data: w,
      };
    });
  }, [weekly]);

  // default selected = most recent week
  useEffect(() => {
    if (!selectedWeekKey && weekOptions.length) {
      setSelectedWeekKey(weekOptions[weekOptions.length - 1].key);
    }
  }, [selectedWeekKey, weekOptions]);

  const selectedWeek = weekOptions.find((o) => o.key === selectedWeekKey);

  /* ---------- navigation helpers ---------- */
  const toDateParam = (d) => new Date(d).toISOString().slice(0, 10); // YYYY-MM-DD

  const goToOverall = (status) => {
    const qs = new URLSearchParams({ status }).toString();
    navigate(`/applied-jobs?${qs}`);
  };

  const goToWeekStatus = (status) => {
    if (!selectedWeek) return;
    const qs = new URLSearchParams({
      status,
      start: toDateParam(selectedWeek.start),
      end: toDateParam(selectedWeek.end),
    }).toString();
    navigate(`/applied-jobs?${qs}`);
  };

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <h1 className={styles.h1}>Welcome 👋</h1>
        <p className={styles.sub}>Your job search dashboard at a glance.</p>
      </section>

      {loading && <div className={styles.loading}>Loading…</div>}

      {!loading && err && (
        <div role="alert" className={styles.error}>
          {err}
        </div>
      )}

      {!loading && !err && (
        <>
          {/* Row 1: Totals + “View” buttons */}
          <section className={styles.grid4}>
            <Tile
              value={totals.applied}
              label="Total Applied"
              onView={() => goToOverall("applied")}
            />
            <Tile
              value={totals.interview}
              label="Selected for Interview"
              onView={() => goToOverall("interview")}
            />
            <Tile
              value={totals.finalized}
              label="Accepted"
              onView={() => goToOverall("finalized")}
            />
            <Tile
              value={totals.rejected}
              label="Rejected"
              onView={() => goToOverall("rejected")}
            />
          </section>

          {/* Row 2: Week selector + charts + deep link buttons */}
          <section className={styles.row2}>
            <div className={styles.card}>
              <div className={styles.weekHeader}>
                <div className={styles.weekTitle}>Weekly report (last 90 days)</div>
                <select
                  className={styles.select}
                  value={selectedWeekKey}
                  onChange={(e) => setSelectedWeekKey(e.target.value)}
                >
                  {weekOptions.map((o) => (
                    <option key={o.key} value={o.key}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.charts}>
                <div className={styles.chartBlock}>
                  <div className={styles.chartTitle}>Overview</div>
                  <Donut data={selectedWeek?.data || {}} />
                </div>
                <div className={styles.chartBlock}>
                  <div className={styles.chartTitle}>By Status (Columns)</div>
                  <ColumnChart
                    data={selectedWeek?.data || {}}
                    max={Math.max(
                      selectedWeek?.data?.applied || 0,
                      selectedWeek?.data?.interview || 0,
                      selectedWeek?.data?.rejected || 0,
                      selectedWeek?.data?.finalized || 0
                    )}
                  />
                </div>
              </div>

              <div className={styles.actions}>
                <button
                  className={styles.pill}
                  onClick={() => goToWeekStatus("applied")}
                >
                  View Applied
                </button>
                <button
                  className={styles.pill}
                  onClick={() => goToWeekStatus("interview")}
                >
                  View Selected for Interview
                </button>
                <button
                  className={styles.pill}
                  onClick={() => goToWeekStatus("finalized")}
                >
                  View Accepted
                </button>
                <button
                  className={styles.pill}
                  onClick={() => goToWeekStatus("rejected")}
                >
                  View Rejected
                </button>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
};

export default HomePage;
