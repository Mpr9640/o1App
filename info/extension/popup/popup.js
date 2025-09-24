// popup.js — stable job card, canonical open, instant applied timestamp
// (updated: 2025-09-21)

document.addEventListener("DOMContentLoaded", init);

const APP_HOME = "http://localhost:3000/home";

async function init() {
  const authEl = $("#authState");
  const appliedEl = $("#applied");
  const scoreEl = $("#score");
  const matchesRow = $("#matchesRow");
  const othersRow = $("#othersRow");
  const matchesEl = $("#matches");
  const othersEl = $("#others");

  const openAppBtn = $("#openApp");
  const viewSkillsBtn = $("#viewSkills");
  const autofillBtn = $("#autofillbutton");
  const markAppliedBtn = $("#markApplied");

  const jobCard = $("#jobCard");
  const jobLogo = $("#jobLogo");
  const jobTitle = $("#jobTitle");
  const jobCompany = $("#jobCompany");
  const jobLocation = $("#jobLocation");
  const jobLink = $("#jobLink");

  if (authEl) authEl.textContent = "Open App goes to homepage";

  const tab = await getActiveTab().catch(() => null);

  // 1) Background sticky context first
  let ctx = null;
  try { const r = await sendBg({ action: 'getJobContext' }); ctx = r?.ctx || null; } catch {}
  const ctxMeta = ctx?.meta || {};
  const ctxUrl = ctx?.first_canonical || ctx?.canonical || '';

  // 2) Tab state (skills + quick meta)
  let stateFromTab = null;
  if (tab?.id) {
    try { stateFromTab = await sendTab(tab.id, { action: "getSkillMatchState" }); } catch {}
  }

  // 3) LI meta fast-path
  let liMeta = null;
  if (tab?.id) {
    try { liMeta = await sendTab(tab.id, { action: "getActiveLinkedInMeta" }); } catch {}
  }
  if (!liMeta) {
    try { liMeta = await sendBg({ action: "getActiveJobMeta" }); } catch {}
  }

  // Merge preference: ctx → LI → tab snapshot
  let meta = {
    title: "",
    company: "",
    location: "",
    logoUrl: "",
    atsVendor: "",
    jobId: "",
    url: ctxUrl || (tab?.url || "")
  };
  meta = nonEmptyMerge(meta, ctxMeta);
  meta = nonEmptyMerge(meta, liMeta || {});
  meta = nonEmptyMerge(meta, (stateFromTab?.meta || {}));
  if (!meta.url) meta.url = ctxUrl || tab?.url || "";

  // Skills
  const percentage = Number(stateFromTab?.percentage || 0);
  const matchedWords = Array.isArray(stateFromTab?.matchedWords) ? stateFromTab.matchedWords : [];
  const allSkills = Array.isArray(stateFromTab?.allSkills) ? stateFromTab.allSkills : [];

  // Applied lookup (canonical)
  let appliedText = "Not applied yet";
  if (meta.url) {
    try {
      const canResp = await sendBg({ action: 'canonicalizeUrl', url: meta.url });
      const canonical = canResp?.canonical || meta.url;
      const res = await sendBg({ action: 'checkAppliedForUrl', url: canonical });
      if (res && res.ok && res.applied_at) appliedText = `Applied before: ${new Date(res.applied_at).toLocaleString()}`;
    } catch {}
  }
  appliedEl.textContent = appliedText;

  // Render card
  const hasCard = meta.title || meta.company || meta.location || meta.logoUrl;
  if (hasCard) {
    jobTitle.textContent = meta.title || "—";
    jobCompany.textContent = meta.company || "—";
    console.log('company name:',meta.company);
    jobLocation.textContent = meta.location || "—";
    jobLink.href = meta.url || "#";

    const dotEl = document.querySelector(".job-sub .dot");
    if (dotEl) dotEl.style.display = (meta.company && meta.location) ? "inline" : "none";

    const faviconFallback = (u) => { try { const x = new URL(u); return `${x.origin}/favicon.ico`; } catch { return ""; } };
    let logoSrc = meta.logoUrl || "";
    if (!logoSrc && meta.url && !/linkedin\.com|indeed\.com|dice\.com|glassdoor\.com/i.test(meta.url)) {
      logoSrc = faviconFallback(meta.url);
    }
    if (logoSrc) { jobLogo.src = logoSrc; jobLogo.style.display = "block"; jobLogo.onerror = () => { jobLogo.style.display = "none"; }; }
    else { jobLogo.style.display = "none"; }

    jobCard.hidden = false;
  } else {
    jobCard.hidden = true;
  }

  // Skills UI
  const hasJD = Array.isArray(allSkills) && allSkills.length > 0;
  if (hasJD) {
    scoreEl.hidden = false; matchesRow.hidden = false; othersRow.hidden = false;
    scoreEl.textContent = `Skill match: ${Math.round(percentage)}%`;
    matchesEl.innerHTML = ""; othersEl.innerHTML = "";
    matchedWords.slice(0, 50).forEach((s) => matchesEl.appendChild(pill(s, "match")));
    const mset = new Set(matchedWords.map((x) => (x || "").toLowerCase()));
    const others = allSkills.filter((x) => !mset.has((x || "").toLowerCase()));
    others.slice(0, 50).forEach((s) => othersEl.appendChild(pill(s, "other")));
  } else {
    scoreEl.hidden = true; matchesRow.hidden = true; othersRow.hidden = true;
  }

  // Unified "open job" that prefers canonical
  async function openJob() {
    const preferred = ctxUrl || meta.url || "";
    if (!preferred) return;
    try {
      const canResp = await sendBg({ action: 'canonicalizeUrl', url: preferred });
      const url = canResp?.canonical || preferred;
      chrome.tabs.create({ url });
    } catch {
      chrome.tabs.create({ url: preferred });
    }
  }

  // Buttons
  openAppBtn.addEventListener("click", async () => { await chrome.tabs.create({ url: APP_HOME }); window.close(); });
  viewSkillsBtn.addEventListener("click", async () => {
    if (!tab?.id) return;
    const res = await sendTab(tab.id, { action: "openSkillsPanel" });
    if (!res?.ok) alert("Job description not found on this page.");
    window.close();
  });
  autofillBtn.addEventListener("click", async () => {
    if (!tab?.id) return;
    await sendTab(tab.id, { action: "runAutofill" });
    window.close();
  });

  jobCard.onclick = (e) => { if (e.target.closest("button") || e.target.closest("a")) return; openJob(); };
  jobCard.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openJob(); } };

  markAppliedBtn.addEventListener("click", async () => {
    const preferred = ctxUrl || meta.url;
    if (!preferred) { alert("Open a job page first."); return; }
    const canResp = await sendBg({ action: 'canonicalizeUrl', url: preferred });
    const targetUrl = canResp?.canonical || preferred;

    setBusy(markAppliedBtn, true, "Saving…");
    const payload = {
      action: "appliedJob",
      title: meta.title || document.title || "Unknown",
      company: meta.company || "",
      location: meta.location || "",
      url: targetUrl,
      logo_url: meta.logoUrl || null,
      job_id: meta.jobId || null,
      ats_vendor: meta.atsVendor || (targetUrl.includes('linkedin.com') ? 'linkedin' : 'extension'),
      applied_at: new Date().toISOString(),
      preview_card: {
        title: meta.title || "—",
        subtitle: [meta.company, meta.location].filter(Boolean).join(" • "),
        logo_url: meta.logoUrl || null,
        link_url: targetUrl,
      },
    };
    let res = await sendBg(payload).catch((e) => ({ ok: false, error: e?.message || String(e) }));
    if (!res?.ok) {
      res = await sendBg({
        action: "markApplied",
        title: payload.title, company: payload.company, location: payload.location, url: payload.url,
        logo_url: payload.logo_url, job_id: payload.job_id, applied_at: payload.applied_at, preview_card: payload.preview_card,
      }).catch((e) => ({ ok: false, error: e?.message || String(e) }));
    }
    setBusy(markAppliedBtn, false, "Mark applied");

    if (res?.ok) {
      const when = res.data?.applied_at || payload.applied_at;
      appliedEl.textContent = `Applied before: ${new Date(when).toLocaleString()}`;
    } else {
      alert(res?.error || "Failed to save");
    }
  });
}

/* helpers */
function $(sel) { const el = document.querySelector(sel.startsWith("#") ? sel : `#${sel}`); if (!el) throw new Error(`Missing element: ${sel}`); return el; }
function pill(txt, cls) { const s = document.createElement("span"); s.className = `pill ${cls}`; s.textContent = txt; return s; }
function setBusy(btn, busy, label) { btn.disabled = !!busy; btn.textContent = busy ? "…" : label; }
function sendBg(payload) { return new Promise((resolve, reject) => { try { chrome.runtime.sendMessage(payload, (resp) => resolve(resp)); } catch (e) { reject(e); } }); }
function sendTab(tabId, payload) { return new Promise((resolve, reject) => { try { chrome.tabs.sendMessage(tabId, payload, (resp) => resolve(resp)); } catch (e) { reject(e); } }); }
function getActiveTab() { return new Promise((resolve, reject) => { chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => { if (chrome.runtime.lastError || !tabs || !tabs.length) return reject("No active tab"); resolve(tabs[0]); }); }); }
function nonEmptyMerge(base, patch) { const out = { ...base }; for (const [k, v] of Object.entries(patch || {})) { if (v !== undefined && v !== null && String(v).trim() !== '') out[k] = v; } return out; }

async function runAutofill() {
  try {
    const tab = await getActiveTab();
    const data = await new Promise((resolve) => { chrome.storage.local.get("autofillData", (r) => resolve(r.autofillData || null)); });
    const bundleURL = chrome.runtime.getURL("autofill.bundle.js");
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (url, token, data) => {
        const script = document.createElement("script");
        script.type = "module"; script.src = url; script.id = "autofill-script";
        script.onload = () => { import(url).then((module) => { if (module && typeof module.autofillInit === "function") { try { module.autofillInit(token, data); } catch (e) { console.error(e); } } else { console.error("Autofill Init export is not found."); } }).catch((err) => console.error("Error importing module:", err)); };
        script.onerror = () => console.error(`Failed to load script: ${url}`);
        document.head.appendChild(script);
      },
      args: [bundleURL, "", data],
    });
  } catch (error) { console.error(error); }
}
console.log("popup.js loaded");

