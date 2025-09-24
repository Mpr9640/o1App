// scripts/atswatchers.js — canonical detail URL only + sticky meta merge + per-job dedupe (finalCanon)

(function () {
  if (window.__JobAidATSWatchers__) return;
  window.__JobAidATSWatchers__ = true;

  /* ======= tiny utils ======= */
  const QS = (sel, root = document) => { try { return root.querySelector(sel); } catch { return null; } };
  const QSA = (sel, root = document) => { try { return Array.from(root.querySelectorAll(sel)); } catch { return []; } };
  const textOf = (el) => (el?.textContent || "").trim();
  const txt = (sel, root = document) => textOf(QS(sel, root));
  const attr = (sel, a, root = document) => (QS(sel, root)?.getAttribute?.(a) || "").trim();
  const abs = (u) => { try { return new URL(u, location.href).href; } catch { return ""; } };
  const hostname = () => location.hostname.toLowerCase();

  const favicon = () => {
    const href =
      attr('link[rel="icon"]', 'href') ||
      attr('link[rel="shortcut icon"]', 'href') ||
      attr('link[rel*="apple-touch-icon" i]', 'href');
    return href ? abs(href) : "";
  };

  const nonEmptyMerge = (base, patch) => {
    const out = { ...base };
    for (const [k, v] of Object.entries(patch || {})) {
      if (v !== undefined && v !== null && String(v).trim() !== '') out[k] = v;
    }
    return out;
  };

  const sanitizeTitle = (t) => {
    const s = (t || '').trim();
    if (!s) return s;
    if (/^thank\s*you\b/i.test(s)) return '';
    if (/application\s*(submitted|received)\b/i.test(s)) return '';
    if (/^submission\b/i.test(s)) return '';
    return s;
  };

  function sendBg(payload) {
    return new Promise((resolve) => {
      try { chrome.runtime?.sendMessage(payload, (resp) => resolve(resp)); }
      catch { resolve(null); }
    });
  }

  async function getCtx() {
    const r = await sendBg({ action: 'getJobContext' });
    return r?.ctx || null;
  }

  async function canonicalize(u) {
    const r = await sendBg({ action: 'canonicalizeUrl', url: u });
    return r?.canonical || '';
  }

  /* ========= Vendor table ========= */
  const VENDORS = [
    {
      name: "LinkedIn",
      hostRx: /(^|\.)linkedin\.com$/i,
      success: {
        urlRx: [/applicationSubmitted|thank[- ]?you/i],
        textRx: [/application sent|successfully applied|application submitted/i],
        selectors: ['.artdeco-toast-item__message']
      },
      extract() {
        const title = txt(".top-card-layout__title, .jobs-unified-top-card__job-title, .jobs-unified-top-card__title, h1[data-test-job-title]") || txt("h1");
        const company = txt(".jobs-unified-top-card__company-name a, .topcard__org-name-link, .top-card-layout__entity-info a");
        const locationTxt = txt(".top-card-layout__second-subline .jobs-unified-top-card__bullet, .jobs-unified-top-card__primary-description");
        const logo = (() => {
          const i = QS('img.jobs-unified-top-card__company-logo-image') ||
                    QS('.jobs-unified-top-card__company-logo img') ||
                    QS('.artdeco-entity-image img');
          return i?.src ? abs(i.src) : "";
        })();
        const jobId = (() => {
          const m = location.pathname.match(/\/jobs\/view\/(\d+)/);
          return m?.[1] || new URL(location.href).searchParams.get('currentJobId') || "";
        })();
        const canon = jobId ? `https://www.linkedin.com/jobs/view/${jobId}/` : ""; // leave empty if unknown here
        return { title, company, location: locationTxt, logo, jobId, canon, source_icon: "https://www.linkedin.com/favicon.ico" };
      }
    },
    {
      name: "Greenhouse",
      hostRx: /greenhouse\.io|boards\.greenhouse\.io/i,
      success: { urlRx: [/thanks|thank[- ]?you|submitted/i], textRx: [/thank you for applying|application submitted/i], selectors: ['.flash.notice', '#application.confirmation'] },
      extract() {
        const title = txt("h1.app-title, h1.job-title, h1") || document.title;
        const company = (() => { const seg = location.pathname.split("/").filter(Boolean)[0]; return (seg || "").replace(/[-_]+/g, " "); })();
        const locationTxt = txt(".location, [data-test='location']");
        const logo = attr(".company-logo img","src") ? abs(attr(".company-logo img","src")) : "";
        const jobId = (location.pathname.match(/\/jobs\/(\d+)/) || [])[1] || "";
        const canon = jobId ? `https://${location.hostname}/jobs/${jobId}` : "";
        return { title, company, location: locationTxt, logo, jobId, canon, source_icon: "https://boards.greenhouse.io/favicon.ico" };
      }
    },
    {
      name: "Lever",
      hostRx: /jobs\.lever\.co/i,
      success: { urlRx: [/thank[- ]?you|submitted/i], textRx: [/thank you for applying|application received/i] },
      extract() {
        const title = txt("h2.title, h1") || document.title;
        const company = location.hostname.split(".")[0];
        const locationTxt = txt(".location, [data-test='location']");
        const logo = favicon();
        const segs = location.pathname.split('/').filter(Boolean);
        const jobId = segs[2] || "";
        const canon = (segs[0] && jobId) ? `https://${location.hostname}/${segs[0]}/${jobId}` : "";
        return { title, company, location: locationTxt, logo, jobId, canon, source_icon: "https://jobs.lever.co/favicon.ico" };
      }
    },
    {
      name: "Workday",
      hostRx: /myworkdayjobs\.com|wd\d+\.myworkdayjobs\.com/i,
      success: { urlRx: [/thank[- ]?you|submitted|confirmation/i], textRx: [/application submitted|thank you for applying/i] },
      extract() {
        const title = txt('[data-automation-id="jobPostingHeader"] h1') || txt("h1");
        const company = location.hostname.split(".")[0];
        const locationTxt = txt('[data-automation-id*="jobLocation"]');
        const logo = favicon();
        const segs = location.pathname.split('/').filter(Boolean);
        const last = segs[segs.length - 1];
        const jobId = (last && /[A-Z0-9]{8,}/i.test(last)) ? last : "";
        const canon = jobId ? `https://${location.hostname}/${segs.slice(0,4).join('/')}/${jobId}` : "";
        return { title, company, location: locationTxt, logo, jobId, canon, source_icon: favicon() };
      }
    },
    {
      name: "iCIMS",
      hostRx: /icims\.com/i,
      success: { urlRx: [/confirmation|submitted|success/i], textRx: [/thank you for applying|application submitted/i], selectors: ['.iCIMS_Confirmation', '.iCIMS_MainWrapper .confirmation'] },
      extract() {
        const title = txt(".iCIMS_JobHeader .title, h1") || document.title;
        const company = attr('meta[property="og:site_name"]','content') || location.hostname.split(".")[0];
        const locationTxt = txt(".iCIMS_JobHeader .locations .iCIMS_JobHeaderFieldValue");
        const logo = attr(".iCIMS_Logo img","src") ? abs(attr(".iCIMS_Logo img","src")) : favicon();
        const jobId = (location.pathname.match(/\/jobs\/(\d+)/i) || [])[1] || "";
        const canon = jobId ? `https://${location.hostname}/jobs/${jobId}/` : "";
        return { title, company, location: locationTxt, logo, jobId, canon, source_icon: favicon() };
      }
    },
    {
      name: "SmartRecruiters",
      hostRx: /smartrecruiters\.com/i,
      success: { urlRx: [/thank[- ]?you|confirmation/i], textRx: [/thank you for your application|application submitted/i] },
      extract() {
        const title = txt("h1, .job-title") || document.title;
        const company = location.pathname.split('/').filter(Boolean)[0]?.replace(/[-_]+/g, ' ') || '';
        const locationTxt = txt(".location, [data-test='location']");
        const logo = favicon();
        return { title, company, location: locationTxt, logo, jobId: "", canon: "", source_icon: favicon() };
      }
    },
    {
      name: "Ashby",
      hostRx: /jobs\.ashbyhq\.com/i,
      success: { urlRx: [/thank[- ]?you/i], textRx: [/thanks for applying/i] },
      extract() {
        const title = txt("h1, .job-title") || document.title;
        const company = location.pathname.split('/').filter(Boolean)[0]?.replace(/[-_]+/g, ' ') || '';
        const locationTxt = txt("[data-testid='job-location'], .location");
        const logo = favicon();
        const segs = location.pathname.split('/').filter(Boolean).slice(0,3);
        const canon = segs.length ? `https://${location.hostname}/${segs.join('/')}` : "";
        return { title, company, location: locationTxt, logo, jobId: "", canon, source_icon: favicon() };
      }
    },
    {
      name: "Workable",
      hostRx: /apply\.workable\.com/i,
      success: { urlRx: [/thank[- ]?you|submitted/i], textRx: [/thank you for applying/i] },
      extract() {
        const title = txt("h1, .job-title") || document.title;
        const company = location.pathname.split('/').filter(Boolean)[0]?.replace(/[-_]+/g, ' ') || '';
        const locationTxt = txt(".location, [data-test='location']");
        const logo = favicon();
        const m = location.pathname.match(/\/j\/([A-Za-z0-9]+)/);
        const jobId = m?.[1] || "";
        const canon = jobId ? `https://${location.hostname}/j/${jobId}/` : "";
        return { title, company, location: locationTxt, logo, jobId, canon, source_icon: favicon() };
      }
    },
    {
      name: "BambooHR",
      hostRx: /bamboohr\.com/i,
      success: { urlRx: [/thank[- ]?you|submitted/i], textRx: [/thank you for applying/i] },
      extract() {
        const title = txt("h1, .app-title") || document.title;
        const company = location.hostname.split(".")[0];
        const locationTxt = txt(".location, [data-test='location']");
        const logo = favicon();
        const m = location.pathname.match(/\/careers\/(\d+)/);
        const jobId = m?.[1] || "";
        const canon = jobId ? `https://${location.hostname}/careers/${jobId}` : "";
        return { title, company, location: locationTxt, logo, jobId, canon, source_icon: favicon() };
      }
    },
    {
      name: "Taleo/Oracle",
      hostRx: /taleo\.net|oraclecloud\.com/i,
      success: { urlRx: [/applicationSubmitted|thank[- ]?you|confirmation/i], textRx: [/thank you for applying|application submitted/i] },
      extract() {
        const title = txt("h1, .jobTitle") || document.title;
        const company = attr('meta[property="og:site_name"]','content') || location.hostname.split(".")[0];
        const locationTxt = txt(".location, [data-test='location']");
        const logo = favicon();
        const jobId = new URL(location.href).searchParams.get('job') || new URL(location.href).searchParams.get('jobId') || "";
        const canon = jobId ? `${location.origin}${location.pathname.split('?')[0]}?job=${jobId}` : "";
        return { title, company, location: locationTxt, logo, jobId, canon, source_icon: favicon() };
      }
    },
    {
      name: "SuccessFactors",
      hostRx: /successfactors\.com|career[0-9]\.successfactors\.|sap\.com/i,
      success: { urlRx: [/application=success|thank[- ]?you/i], textRx: [/thank you for applying|application submitted/i] },
      extract() {
        const title = txt("h1, .jobTitle") || document.title;
        const company = (new URLSearchParams(location.search).get("company") || "").replace(/[-_]+/g," ") || location.hostname.split(".")[0];
        const locationTxt = txt(".jobLocation, .location");
        const logo = favicon();
        const jobId = new URL(location.href).searchParams.get('jobId') || new URL(location.href).searchParams.get('jobID') || "";
        const canon = jobId ? `${location.origin}${location.pathname}?jobId=${jobId}` : "";
        return { title, company, location: locationTxt, logo, jobId, canon, source_icon: favicon() };
      }
    },
    {
      name: "ADP",
      hostRx: /workforcenow\.adp\.com|(^|\.)adp\.com$/i,
      success: { urlRx: [/confirmation|submitted|thank[- ]?you/i], textRx: [/thank you for applying|application submitted/i] },
      extract() {
        const title = txt("h1, .jobTitle") || document.title;
        const company = attr('meta[property="og:site_name"]','content') || location.hostname.split(".")[0];
        const locationTxt = txt(".location");
        const logo = favicon();
        const jobId = new URL(location.href).searchParams.get('uid') || new URL(location.href).searchParams.get('jobId') || "";
        const canon = jobId ? `${location.origin}${location.pathname}?uid=${jobId}` : "";
        return { title, company, location: locationTxt, logo, jobId, canon, source_icon: favicon() };
      }
    },
    {
      name: "JazzHR",
      hostRx: /app\.jazz\.co|applytojob\.com/i,
      success: { urlRx: [/thank[- ]?you|submitted/i], textRx: [/thank you for applying/i] },
      extract() {
        const title = txt("h1, .job-title") || document.title;
        const company = txt(".company") || location.hostname.split(".")[0];
        const locationTxt = txt(".location");
        const logo = favicon();
        const m = location.pathname.match(/\/apply\/([A-Za-z0-9]+)/);
        const jobId = m?.[1] || "";
        const canon = jobId ? `https://${location.hostname}/apply/${jobId}` : "";
        return { title, company, location: locationTxt, logo, jobId, canon, source_icon: favicon() };
      }
    },
    {
      name: "Indeed",
      hostRx: /indeed\.com/i,
      success: { urlRx: [/apply\/thankyou|application-submitted|submitted/i], textRx: [/application submitted|thank you for applying/i] },
      extract() {
        const title = txt("h1, .jobsearch-JobInfoHeader-title") || document.title;
        const company = txt(".jobsearch-InlineCompanyRating div:first-child, .jobsearch-CompanyInfoWithoutHeaderImage span") || location.hostname.split(".")[0];
        const locationTxt = txt(".jobsearch-JobInfoHeader-subtitle div:last-child");
        const logo = attr("img[alt*='logo' i]", "src") ? abs(attr("img[alt*='logo' i]", "src")) : favicon();
        const jk = new URL(location.href).searchParams.get('jk') || new URL(location.href).searchParams.get('vjk') || "";
        const canon = jk ? `https://${location.hostname}/viewjob?jk=${jk}` : "";
        return { title, company, location: locationTxt, logo, jobId: jk, canon, source_icon: favicon() };
      }
    },
    {
      name: "Dice",
      hostRx: /dice\.com/i,
      success: { urlRx: [/thank[- ]?you|application-submitted|submitted|confirmation/i], textRx: [/thank you for applying|application submitted/i] },
      extract() {
        const title = txt("h1, [data-cy='jobTitle']") || document.title;
        const company = txt("[data-cy='companyName'], .company") || location.hostname.split(".")[0];
        const locationTxt = txt("[data-cy='location'], .location");
        const logo = favicon();
        const jobId = new URL(location.href).searchParams.get('jobid') || new URL(location.href).searchParams.get('id') || "";
        const canon = jobId ? `https://${location.hostname}/job-detail/${jobId}` : "";
        return { title, company, location: locationTxt, logo, jobId, canon, source_icon: favicon() };
      }
    },
    {
      name: "Monster",
      hostRx: /monster\.com/i,
      success: { urlRx: [/thank[- ]?you|application-submitted|submitted/i], textRx: [/application submitted|thank you for applying/i] },
      extract() {
        const title = txt("h1, .job-title") || document.title;
        const company = txt(".company, .job-company") || location.hostname.split(".")[0];
        const locationTxt = txt(".location, [data-test='location']");
        const logo = favicon();
        const m = location.pathname.match(/\/job\/([^/]+)/);
        const jobId = m?.[1] || "";
        const canon = jobId ? `https://${location.hostname}/job/${jobId}` : "";
        return { title, company, location: locationTxt, logo, jobId, canon, source_icon: favicon() };
      }
    },
  ];

  const WHICH = () => VENDORS.find(v => v.hostRx.test(hostname()));

  const findByText = (rx, root = document) => {
    const it = document.createNodeIterator(root, NodeFilter.SHOW_ELEMENT);
    let node;
    while ((node = it.nextNode())) {
      const t = (node.textContent || "").trim();
      if (t && rx.test(t)) return node;
    }
    return null;
  };

  const looksLikeSuccess = (v) => {
    const uok = v.success.urlRx?.some(rx => rx.test(location.href)) || false;
    const tok = v.success.textRx?.some(rx => findByText(rx)) || false;
    const sok = v.success.selectors?.some(sel => QS(sel)) || false;
    return uok || tok || sok;
  };

  // per-job once guard keyed by final canonical detail URL
  function oncePerJob(finalCanon) {
    const k = `__jobAid_applied__${finalCanon}`;
    if (sessionStorage.getItem(k)) return false;
    sessionStorage.setItem(k, "1");
    return true;
  }

  function showBanner(msg) {
    const id = '__jobAidAppliedBanner__';
    if (document.getElementById(id)) return;
    const host = document.createElement('div');
    host.id = id;
    Object.assign(host.style, {
      position: 'fixed',
      top: '16px',
      left: '50%',
      transform: 'translateX(-50%)',
      background: '#111827',
      color: '#fff',
      padding: '10px 14px',
      borderRadius: '10px',
      zIndex: 2147483647,
      font: '14px system-ui',
      boxShadow: '0 6px 22px rgba(0,0,0,.25)'
    });
    host.textContent = msg || 'Added into your applied job list';
    document.body.appendChild(host);
    setTimeout(() => { host.style.opacity = '0'; host.style.transition = 'opacity .2s ease'; setTimeout(() => host.remove(), 220); }, 3200);
  }

  async function enrichWithStickyContext(details) {
    const [ctx, bgCanon] = await Promise.all([getCtx(), canonicalize(location.href)]);
    const fromCtx = ctx?.meta || {};
    const ctxCanon = ctx?.first_canonical || ctx?.canonical || '';

    // sanitize title from confirmation pages
    const sanitizedTitle = sanitizeTitle(details.title);
    const merged = {
      ...details,
      title: sanitizedTitle || fromCtx.title || details.title || '',
      company: details.company || fromCtx.company || '',
      location: details.location || fromCtx.location || '',
      logo: details.logo || fromCtx.logoUrl || '',
    };

    // compute final canonical detail URL preference
    const vendorCanon = (details.canon || '').trim();
    const finalCanon = (ctxCanon || vendorCanon || bgCanon || location.href);

    return { ...merged, canon: finalCanon };
  }

  // UPDATED: standardized reporter using ctx.first_canonical and instant cache hint
  async function emitApplied(vendor, details) {
    const meta = details || {};
    try {
      const ctx = await getCtx();
      const target = ctx?.first_canonical || ctx?.canonical || (await canonicalize(location.href));
      const applied_at = new Date().toISOString();

      const payload = nonEmptyMerge({
        action: 'appliedJob',
        url: target,
        applied_at,
      }, {
        title: sanitizeTitle(meta.title || document.title || ''),
        company: meta.company || '',
        location: meta.location || '',
        logo_url: meta.logo || favicon(),
        job_id: meta.jobId || '',
        ats_vendor: vendor?.name?.toLowerCase() || hostname(),
        preview_card: {
          title: meta.title || '—',
          subtitle: [meta.company, meta.location].filter(Boolean).join(' • '),
          logo_url: meta.logo || favicon(),
          link_url: target,
        },
      });

      await sendBg(payload);
      // optional fast-path hint; background may ignore if unsupported
      await sendBg({ action: 'rememberAppliedInstant', url: target, applied_at });

      showBanner('Added into your App applied job list');
    } catch {}
  }

  function shouldRun() {
    // Run if success markers exist (even if our floating icon isn't present)
    const v = WHICH();
    return v ? looksLikeSuccess(v) : false;
  }

  async function runCheck() {
    if (!shouldRun()) return;
    const v = WHICH(); if (!v) return;

    // Confirm success again (SPAs can bounce)
    if (!looksLikeSuccess(v)) return;

    const raw = v.extract ? v.extract() : null;
    if (!raw) return;

    // Merge with sticky context and canonicalize to detail page
    const info = await enrichWithStickyContext(raw);

    const finalCanon = (info?.canon || '').trim();
    if (!finalCanon) return;

    // De-dupe strictly by final canonical detail URL
    if (!oncePerJob(finalCanon)) return;

    // Extra guard: if already saved for this URL, skip
    try {
      const chk = await sendBg({ action: 'checkAppliedForUrl', url: finalCanon });
      if (chk?.ok && chk.applied_at) return;
    } catch {}

    await emitApplied(v, info);
  }

  // Debounced schedule
  let t = null;
  const scheduleCheck = () => { clearTimeout(t); t = setTimeout(runCheck, 220); };

  // SPA navigation hooks
  (function patchHistory() {
    const origPush = history.pushState;
    const origReplace = history.replaceState;
    history.pushState = function() { const r = origPush.apply(this, arguments); scheduleCheck(); return r; };
    history.replaceState = function() { const r = origReplace.apply(this, arguments); scheduleCheck(); return r; };
    window.addEventListener('popstate', scheduleCheck, { passive: true });
    window.addEventListener('hashchange', scheduleCheck, { passive: true });
  })();

  // DOM change observer
  const mo = new MutationObserver(scheduleCheck);
  mo.observe(document.documentElement, { subtree: true, childList: true, attributes: true });

  // Initial kicks
  window.addEventListener('load', scheduleCheck, { once: true });
  document.addEventListener('DOMContentLoaded', scheduleCheck, { once: true });

  // Hook so contentscript can ping after icon mount
  window.initATSWatchers = function initATSWatchers() { scheduleCheck(); };
})();
