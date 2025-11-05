// scripts/atswatchers.js — generic success detector + referrer-aware canonical emit + submitted card
// (updated: 2025-11-04 — idempotent on back/forward to same page; tightened guards)

(function () {
  if (window.__JobAidATSWatchers__) return;
  window.__JobAidATSWatchers__ = true;

  /* tiny utils */
  const QS = (sel, root = document) => { try { return root.querySelector(sel); } catch { return null; } };
  const attr = (sel, a, root = document) => (QS(sel, root)?.getAttribute?.(a) || "").trim();
  const abs = (u) => { try { return new URL(u, location.href).href; } catch { return ""; } };

  // favicon absolute url (fallback to /favicon.ico)
  const favicon = () => {
    const href =
      attr('link[rel="icon"]', 'href') ||
      attr('link[rel="shortcut icon"]', 'href') ||
      attr('link[rel*="apple-touch-icon" i]', 'href') ||
      '/favicon.ico';
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
    if (/application\s*(?:was\s*)?(submitted|received|complete)\b/i.test(s)) return '';
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
  } // gets tab context
  async function canonicalize(u) {
    const r = await sendBg({ action: 'canonicalizeUrl', url: u });
    return r?.canonical || '';
  } // canonicalized url

  // ---------- success detection ----------

  // Prefer context (canonical) heavily; others add confidence.
  const SUCCESS_SCORE_THRESHOLD = 0.6;

  // URL & text signals (expanded)
  const URL_SUCCESS_RX =
    /(thank[\s-]?you|application[-\s]?submit(?:ted)?|submission[-\s]?complete|post-?apply|confirmation|success|applied)/i;

  const TEXT_SUCCESS_RX =
    /\b(thank\s+you(?:\s+for\s+applying)?|application\s+(?:submit(?:ted)?|received|complete)|you.?ve\s+applied|submitted\s+successfully)\b/i;

  const EMAIL_VERIFY_RX = /\b(verify|verification)\s+(your\s+)?email\b/i;

  // Auth/login pages should not count as success
  const AUTH_RX = /(sign[-\s]?in|log[-\s]?in|authenticate|forgot|create[-\s]?account)\b/i; // note: "register" excluded (too noisy)
  const AUTH_SELECTORS = [
    '#login-form, #sign-in-form, .login-page, .auth-page',
    'input[type="password"]'
  ];

  // Visible = on-screen and not hidden
  const isVisible = (el) => {
    if (!el) return false;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  };

  const SUCCESS_SELECTORS = [
    // site-specific-ish
    '#application\\.confirmation, #application_confirmation, #application-confirmation',
    '.artdeco-toast-item__message',
    // generic-ish (must be visible and contain relevant words)
    '[data-testid*="thank" i]:not([hidden])',
    '[data-testid*="confirm" i]:not([hidden])'
  ];

  async function looksLikeSuccessPage() {
    const ctx = await getCtx();
    const activeCanonUrl = ctx?.first_canonical || ctx?.canonical || '';

    const href = location.href;
    const title = document.title || '';
    const bodyText = (document.body?.innerText || '').slice(0, 8000);

    // 1) Guard against auth/login pages
    if (AUTH_RX.test(href) || AUTH_RX.test(title)) return false;
    if (AUTH_SELECTORS.some(sel => QS(sel))) return false;

    // Avoid “verify your email” interstitials unless there are strong success cues
    if (EMAIL_VERIFY_RX.test(bodyText) && !TEXT_SUCCESS_RX.test(bodyText)) return false;

    // 2) Evaluate weighted signals (bias to having a known canonical context)
    const urlHit = URL_SUCCESS_RX.test(href) ? 1 : 0;
    const textHit = TEXT_SUCCESS_RX.test(bodyText) ? 1 : 0;
    const canonHit = activeCanonUrl && activeCanonUrl.length > 10 ? 1 : 0;
    const selectorHit = SUCCESS_SELECTORS.some(sel => {
      const el = QS(sel);
      return el && isVisible(el) && /\b(thank|confirm|appl[y|ication]|submit)\b/i.test((el.innerText || '').trim());
    }) ? 1 : 0;

    const score =
      (0.2 * urlHit) +
      (0.2 * textHit) +
      (0.6 * canonHit) +
      (0.2 * selectorHit);

    return Math.min(score, 1) > SUCCESS_SCORE_THRESHOLD;
  }

  // ---------- idempotence: once-per-job per tab session ----------

  // Normalizes the key with background canonicalizer so back/forward to the same page won't refire.
  async function oncePerJob(finalCanon) {
    const norm = (await canonicalize(finalCanon)) || finalCanon.split('#')[0];
    const k = `__jobAid_applied__${norm}`;
    if (sessionStorage.getItem(k)) return false;
    sessionStorage.setItem(k, '1');
    return true;
  }

  // ---------- UI ----------

  function showSubmissionCard(card) {
    const id = '__jobAidSubmissionCard__';
    if (document.getElementById(id)) return;
    const host = document.createElement('div');
    host.id = id;
    Object.assign(host.style, {
      position:'fixed', top:'50%', left:'50%', transform:'translate(-50%,-50%)',
      zIndex:2147483647, background:'#fff', border:'1px solid #e5e7eb',
      borderRadius:'12px', boxShadow:'0 12px 40px rgba(0,0,0,.25)', width:'min(360px,92vw)',
      padding:'14px'
    });
    host.innerHTML = `
      <div style="display:grid;grid-template-columns:40px 1fr;gap:10px;align-items:start">
        <img src="${card.logo_url || ''}" onerror="this.style.display='none'" style="width:40px;height:40px;border-radius:8px;background:#f3f4f6;"/>
        <div>
          <div style="font-weight:800;font:14px system-ui">${card.title || '—'}</div>
          <div style="color:#6b7280;font:12px system-ui">${card.subtitle || ''}</div>
          <div style="margin-top:8px;color:#16a34a;font-weight:700;font:12px system-ui">Submitted ✓</div>
        </div>
      </div>`;
    document.body.appendChild(host);
    setTimeout(()=>{ host.style.opacity='0'; host.style.transition='opacity .2s'; setTimeout(()=>host.remove(),220); }, 4000);
  }

  // ---------- metadata cache helpers ----------

  async function getMetadataFromCache(canonicalUrl) {
    if (!canonicalUrl) return null;
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'getCanonicalMetadata',
        canonicalUrl
      });
      if (response && response.ok && response.data) return response.data;
    } catch (e) {
      console.error("Error retrieving canonical metadata:", e);
    }
    return null;
  }

  async function enrichWithStickyContext() {
    const [ctx, bgCanon] = await Promise.all([getCtx(), canonicalize(location.href)]);
    const ctxCanon = ctx?.first_canonical || ctx?.canonical || '';
    const cacheMeta = await getMetadataFromCache(ctxCanon);

    const fromCtx = cacheMeta || ctx?.meta || {};
    const merged = {
      title: sanitizeTitle(fromCtx.title || document.title || ''),
      company: fromCtx.company || '',
      location: fromCtx.location || '',
      logo: fromCtx.logoUrl || favicon()
    };

    const finalCanon = (ctxCanon || bgCanon || location.href);
    return { ...merged, canon: finalCanon };
  }

  // ---------- reporting ----------

  async function reportSuccess() {
    try {
      const info = await enrichWithStickyContext();
      const finalCanon = (info?.canon || '').trim();
      if (!finalCanon) return;

      // once-per-job guard (normalized canonical)
      const firstTime = await oncePerJob(finalCanon);
      if (!firstTime) return;

      // Background may already have this marked; bail if so (extra safety)
      try {
        const chk = await sendBg({ action: 'checkAppliedForUrl', url: finalCanon, title: info.title, company: info.company, location: info.location });
        if (chk?.ok && chk.applied_at) return;
      } catch {}

      const applied_at = new Date().toISOString();

      // Let background bind source platform via referrer (e.g., LinkedIn -> ATS)
      await sendBg({
        action: 'submissionDetected',
        pageCanonical: finalCanon,
        referrer: document.referrer || ''
      });

      const payload = nonEmptyMerge({
        action: 'appliedJob',
        url: finalCanon,
        applied_at
      }, {
        title: info.title || '—',
        company: info.company || '',
        location: info.location || '',
        logo_url: info.logo || favicon(),
        ats_vendor: location.hostname,
        preview_card: {
          title: info.title || '—',
          subtitle: [info.company, info.location].filter(Boolean).join(' • '),
          logo_url: info.logo || favicon(),
          link_url: finalCanon
        }
      });

      // Persist if desired:
      // await sendBg(payload);
      // await sendBg({ action: 'rememberAppliedInstant', url: finalCanon, applied_at });

      showSubmissionCard(payload.preview_card); // center notification
    } catch {}
  }

  // ---------- scheduling / debouncing ----------

  let checking = false;      // in-flight gate to avoid run storms
  let t = null;              // debounce timer

  async function runCheck() {
    if (checking) return;
    checking = true;
    try {
      if (await looksLikeSuccessPage()) await reportSuccess();
    } finally {
      checking = false;
    }
  }

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

  // DOM change observer (attributes filter keeps noise down)
  const mo = new MutationObserver(scheduleCheck);
  try {
    mo.observe(document.documentElement, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['class', 'style', 'hidden', 'aria-hidden']
    });
  } catch {}

  // Initial kicks
  window.addEventListener('load', scheduleCheck, { once: true });
  document.addEventListener('DOMContentLoaded', scheduleCheck, { once: true });

  // Hook so contentscript can ping after icon mount
  window.initATSWatchers = function initATSWatchers() { scheduleCheck(); };
})();

/*n
(function () {
  if (window.__JobAidATSWatchers__) return;
  window.__JobAidATSWatchers__ = true;

  // tiny utils 
  const QS = (sel, root = document) => { try { return root.querySelector(sel); } catch { return null; } };
  const attr = (sel, a, root = document) => (QS(sel, root)?.getAttribute?.(a) || "").trim();
  const abs = (u) => { try { return new URL(u, location.href).href; } catch { return ""; } };

  // getting favicon href value and converting to an absolute url by resolving with present page url.
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
    if (/application\s*(?:was\s*)?(submitted|received)\b/i.test(s)) return '';
    if (/^submission\b/i.test(s)) return '';
    return s;
  };

  function sendBg(payload) {
    return new Promise((resolve) => {
      try { chrome.runtime?.sendMessage(payload, (resp) => resolve(resp)); }
      catch { resolve(null); }
    });
  }
  async function getCtx() { const r = await sendBg({ action: 'getJobContext' }); return r?.ctx || null; } // gets tab context
  async function canonicalize(u) { const r = await sendBg({ action: 'canonicalizeUrl', url: u }); return r?.canonical || ''; } // canonicalized url

  // generic submission detector
  const URL_SUCCESS_RX = /(thank[\s-]?you|application[-\s]?submitted|submission[-\s]?complete|post-?apply|submit_?apply|confirmation|success)/i;
  const TEXT_SUCCESS_RX = /(thank\s+you\s+for\s+applying|application\s+(?:submitted|received)|successfully\s+(?:applied|submitted))/i;
  const SUCCESS_SELECTORS = [
    '.confirmation, .success, .thanks, .thank-you',
    '.artdeco-toast-item__message',
    '#application\\.confirmation, #application_confirmation, #application-confirmation',
    '[data-testid*="thank" i], [data-testid*="confirm" i]'
  ];

  // Keywords and paths common to sign-in, login, authentication, and registration pages
  const AUTH_RX = /(sign[-\s]?in|log[-\s]?in|register|authenticate|forgot|create[-\s]?account)/i;
  const AUTH_SELECTORS = [
    '#login-form, #sign-in-form, .login-page, .auth-page',
    'input[type="password"]'
  ];
  *///n
  // Detecting success page with auth-guard and context requirements
  /*async function looksLikeSuccessPage() {
    const ctx = await getCtx();
    const activeCanonUrl = ctx?.first_canonical || ctx?.canonical || ''; // 1st seen page with that tab ID
    const href = location.href;
    const bodyText = (document.body?.innerText || '').slice(0, 8000);

    // Auth / login-like pages should not be treated as success
    if (AUTH_RX.test(href) || AUTH_RX.test(document.title)) return false;
    if (AUTH_SELECTORS.some(sel => QS(sel))) return false;
    if (bodyText.includes('password') && bodyText.includes('username')) return false;
    
    // A. URL Match
    if (URL_SUCCESS_RX.test(href)) return true;
    // Require we actually have a job-context canonical to bind to
    if (!activeCanonUrl || activeCanonUrl.length < 10) return false;
    // B. Text Match
    if (TEXT_SUCCESS_RX.test(bodyText)) return true;
    // C. Selector Match
    if (SUCCESS_SELECTORS.some(sel => QS(sel))) return true;

    return false;
  } */
 /*n
  
  // Put this near your other constants if you want it configurable
  const SUCCESS_SCORE_THRESHOLD = 0.6;

  // Detecting success page with weighted scoring
  async function looksLikeSuccessPage() {
    const ctx = await getCtx();
    const activeCanonUrl = ctx?.first_canonical || ctx?.canonical || '';

    const href = location.href;
    const title = document.title || '';
    const bodyText = (document.body?.innerText || '').slice(0, 8000);

    // 1) Guard against auth/login pages
    if (AUTH_RX.test(href) || AUTH_RX.test(title)) return false;
    if (AUTH_SELECTORS.some(sel => QS(sel))) return false;
    if (bodyText.includes('password') && bodyText.includes('username')) return false;

    // 2) Evaluate weighted signals
    const urlHit      = URL_SUCCESS_RX.test(href) ? 1 : 0;              // 0.4
    const textHit     = TEXT_SUCCESS_RX.test(bodyText) ? 1 : 0;         // 0.4
    const canonHit    = activeCanonUrl && activeCanonUrl.length > 10 ? 1 : 0; // 0.2
    const selectorHit = SUCCESS_SELECTORS.some(sel => QS(sel)) ? 1 : 0; // 0.3

    const score =
        (0.2 * urlHit) +
        (0.2 * textHit) +
        (0.6 * canonHit) +
        (0.2 * selectorHit);

    // Optional: clamp to 1 (in case multiple hits overlap conceptually)
    const finalScore = Math.min(score, 1);

    // Debug breakdown (remove if noisy)
    /*console.debug('[JobAid] success-score', {
      urlHit, textHit, canonHit, selectorHit,
      score: finalScore, activeCanonUrl
    }); */
  /*n
    return finalScore > SUCCESS_SCORE_THRESHOLD;
  }


  // per-job once guard keyed by final canonical detail URL for session
  function oncePerJob(finalCanon) {
    const k = `__jobAid_applied__${finalCanon}`;
    if (sessionStorage.getItem(k)) return false;
    sessionStorage.setItem(k, "1");
    return true;
  }

  // Center-screen “Submitted ✓” card
  function showSubmissionCard(card) {
    const id = '__jobAidSubmissionCard__';
    if (document.getElementById(id)) return;
    const host = document.createElement('div');
    host.id = id;
    Object.assign(host.style, {
      position:'fixed', top:'50%', left:'50%', transform:'translate(-50%,-50%)',
      zIndex:2147483647, background:'#fff', border:'1px solid #e5e7eb',
      borderRadius:'12px', boxShadow:'0 12px 40px rgba(0,0,0,.25)', width:'min(360px,92vw)',
      padding:'14px'
    });
    host.innerHTML = `
      <div style="display:grid;grid-template-columns:40px 1fr;gap:10px;align-items:start">
        <img src="${card.logo_url || ''}" onerror="this.style.display='none'" style="width:40px;height:40px;border-radius:8px;background:#f3f4f6;"/>
        <div>
          <div style="font-weight:800;font:14px system-ui">${card.title || '—'}</div>
          <div style="color:#6b7280;font:12px system-ui">${card.subtitle || ''}</div>
          <div style="margin-top:8px;color:#16a34a;font-weight:700;font:12px system-ui">Submitted ✓</div>
        </div>
      </div>`;
    document.body.appendChild(host);
    setTimeout(()=>{ host.style.opacity='0'; host.style.transition='opacity .2s'; setTimeout(()=>host.remove(),220); }, 4000);
  }

  // Example call from the content script: get cached canonical metadata
  async function getMetadataFromCache(canonicalUrl) {
    if (!canonicalUrl) return null;
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'getCanonicalMetadata',
        canonicalUrl
      });
      if (response && response.ok && response.data) return response.data;
    } catch (e) {
      console.error("Error retrieving canonical metadata:", e);
    }
    return null;
  }

  // Getting canonical information for present submission page url.
  async function enrichWithStickyContext() {
    const [ctx, bgCanon] = await Promise.all([getCtx(), canonicalize(location.href)]);
    const ctxCanon = ctx?.first_canonical || ctx?.canonical || '';
    const cacheMeta = await getMetadataFromCache(ctxCanon);

    // Prioritize cache data, then context data
    const fromCtx = cacheMeta || ctx?.meta || {};
    const merged = {
      title: sanitizeTitle(fromCtx.title || document.title || ''),
      company: fromCtx.company || '',
      location: fromCtx.location || '',
      logo: fromCtx.logoUrl || favicon()
    };

    const finalCanon = (ctxCanon || bgCanon || location.href);
    return { ...merged, canon: finalCanon };
  }

  // Reporting success to background.
  async function reportSuccess() {
    try {
      const info = await enrichWithStickyContext();
      const finalCanon = (info?.canon || '').trim();
      if (!finalCanon) return;

      if (!oncePerJob(finalCanon)) return;

      try {
        const chk = await sendBg({ action: 'checkAppliedForUrl', url: finalCanon, title: info.title, company: info.company, location: info.location });
        if (chk?.ok && chk.applied_at) return;
      } catch {}

      const applied_at = new Date().toISOString();

      // Let background bind to the original platform via referrer when ATS IDs differ
      await sendBg({
        action: 'submissionDetected',
        pageCanonical: finalCanon,
        referrer: document.referrer || ''
      });

      const payload = nonEmptyMerge({
        action: 'appliedJob',
        url: finalCanon,
        applied_at
      }, {
        title: info.title || '—',
        company: info.company || '',
        location: info.location || '',
        logo_url: info.logo || favicon(),
        ats_vendor: location.hostname,
        preview_card: {
          title: info.title || '—',
          subtitle: [info.company, info.location].filter(Boolean).join(' • '),
          logo_url: info.logo || favicon(),
          link_url: finalCanon
        }
      });

      // If you want persistence, uncomment these:
      // await sendBg(payload);
      // await sendBg({ action: 'rememberAppliedInstant', url: finalCanon, applied_at });

      showSubmissionCard(payload.preview_card); // center notification
    } catch {}
  }

  async function runCheck() {
    if (!(await looksLikeSuccessPage())) return;
    await reportSuccess();
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
n*/
// (Removed trailing duplicate SUCCESS regex/constants)
