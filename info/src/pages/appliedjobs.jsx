import React, { useEffect, useState } from "react";
import apiClient from "../axios.js";
import JobCard from "../components/jobcard/jobcard";

export default function AppliedJobsPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      // If baseURL already ends with /api, change to "/jobs"
      const { data } = await apiClient.get("/api/jobs");
      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      const status = err?.response?.status;
      if (status === 404) setRows([]);
      else if (status === 401) setError("Please sign in to view your applied jobs.");
      else setError(err?.response?.data?.detail || err.message || "Failed to load jobs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2>Applied Jobs</h2>
      </div>

      {loading && <div>Loading…</div>}

      {!loading && !!error && (
        <div
          role="alert"
          style={{
            padding: 12,
            border: "1px solid #fecaca",
            background: "#fef2f2",
            color: "#991b1b",
            borderRadius: 8,
          }}
        >
          {error}
        </div>
      )}

      {!loading && !error && rows.length === 0 && <p>No applied jobs recorded yet.</p>}

      {!loading && !error && rows.length > 0 && (
        <div style={{ display: "grid", gap: 12 }}>
          {rows.map((j) => (
            <JobCard key={j.id} job={j} onUpdated={load} />
          ))}
        </div>
      )}
    </div>
  );
}
