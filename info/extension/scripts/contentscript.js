//1. workday, ashby and greenhouse. (oracle.cloud)needs to fix

const URL_KEYWORDS = ['apply','application','job','jobs','career','careers','hiring','employment','positions','form'];

const ATS_HOST_MAP = [
  /greenhouse\.io|boards\.greenhouse\.io/i, /lever\.co/i,
  /myworkdayjobs\.com|workday\.com/i, /icims\.com/i, /taleo\.net/i,
  /ashbyhq\.com/i, /smartrecruiters\.com/i, /workable\.com/i,
  /bamboohr\.com/i, /jobvite\.com/i, /successfactors\.com/i,/metacareers\.com/i
];

const KNOWN_JOB_HOSTS = [
  /(^|\.)linkedin\.com$/i, /indeed\.com/i, /dice\.com/i, /glassdoor\.com/i,
  /monster\.com/i, /careerbuilder\.com/i, /jobright\.ai/i, ...ATS_HOST_MAP
];
// ---- Frame role split (works on all hosts) ----
const IS_TOP_WINDOW = (window.top === window.self);
//const IS_TOP_WINDOW = (window.top === window.self);


// Does this page embed an ATS/vendor iframe?
function pageHasAtsIframe() {
  try {
    const iframes = Array.from(document.querySelectorAll('iframe'));
    if (!iframes.length) return false;
    const rx = new RegExp(ATS_HOST_MAP.map(r => r.source).join('|'), 'i');
    const src = fr.src || fr.getAttribute('data-src') || '';
    return iframes.some(fr => rx.test(src || ''));
  } catch { return false; }
}

// Role assignment:
// - UI (icon/banner triggers) only on top window
// - Parsing (JD, skills, forms) inside ATS iframe when present; otherwise fallback to top
const ROLE_UI = IS_TOP_WINDOW;
const ROLE_PARSE = pageHasAtsIframe() ? !IS_TOP_WINDOW : true;


/* Negative & hard-block guards */
const NEGATIVE_HOSTS = [
  /github\.com$/i, /stackoverflow\.com$/i,/localhost/i,
  /mail\.google\.com$/i, /calendar\.google\.com$/i, /notion\.so$/i,
  /confluence\./i, /slack\.com$/i, /teams\.microsoft\.com$/i
];
const HARD_BLOCK_HOSTS = [
  /(^|\.)chatgpt\.com$/i, // blocks ChatGPT and any openai.com subdomain
];
const SEARCH_ENGINE_HOSTS = [/google\./i, /bing\.com/i, /duckduckgo\.com/i, /search\.yahoo\.com/i, /ecosia\.org/i];

const LI_NEGATIVE_PATH = [/^\/feed/i, /^\/messaging/i, /^\/notifications/i, /^\/in\//i, /^\/people\//i, /^\/sales\//i, /^\/learning\//i];

let jobApplicationDetected = false;
let jdAnchorEl = null;
let lastJDHash = "";
let matchedWords = [];
let percentage = 0;
let allSkills = [];
let currentJobKey = "";
let lastActiveLIMeta = null;
let lastActiveGenericMeta = null;
let _didFullJDForUrl = new Set();

const clamp = (v,min,max)=>Math.max(min,Math.min(v,max));
const txt = (el) => (el?.innerText || el?.textContent || '').trim();
const sanitize = (s) => String(s || '').replace(/\s{2,}/g,' ').trim();
// Safe URL helpers
function safeURL(str, base = location?.href || "") {
  try {
    if (!str) return null;
    // If caller passes a fully qualified URL, use it; otherwise use base.
    return base ? new URL(str, base) : new URL(str);
  } catch {
    return null;
  }
}
const absUrl = (u) => { try {/* return u ? new URL(u, location.href).href : '';*/ const out = safeURL(u, location?.href || ""); return out ? out.href : ""; } catch { return ''; } };
const hash = (s) => { let h=0; for (let i=0;i<s.length;i++) h=Math.imul(31,h)+s.charCodeAt(i)|0; return String(h); };
const debounce = (fn, wait=400) => { let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), wait); }; };
const hostMatches = (arr) => arr.some(rx => rx.test(location.hostname));
const isSearchEngineHost = () => hostMatches(SEARCH_ENGINE_HOSTS);
const isKnownJobHost = () => hostMatches(KNOWN_JOB_HOSTS);
const isAtsHost = () => hostMatches(ATS_HOST_MAP);
const isLinkedInHost = () => /(^|\.)linkedin\.com$/i.test(location.hostname);
const isNegativeHost = () => hostMatches(NEGATIVE_HOSTS);
const isHardBlockedHost = () => hostMatches(HARD_BLOCK_HOSTS);

const isVisible = (el) => {
  if (!el) return false;
  const cs = getComputedStyle(el);
  if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return false;
  const rect = el.getBoundingClientRect?.();
  if (rect && (rect.width <= 0 || rect.height <= 0)) return false;
  if (!el.offsetParent && cs.position !== 'fixed') return false;
  return true;
};
// IcIms
/* =========================
   0c) UI lock + geometry helpers (ADD THIS)
   ========================= */

// Per-origin + per-path UI lock to prevent double icons when same-origin iframes also run the script
const __JA_FRAME_ID = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const __JA_LOCK_KEY = `__jobAidUiLock__::${location.origin}::${(safeURL(location.href)?.pathname || '/')}`;

function acquireUiLock() {
  try {
    const owner = localStorage.getItem(__JA_LOCK_KEY);
    if (owner && owner !== __JA_FRAME_ID) return false;
    localStorage.setItem(__JA_LOCK_KEY, __JA_FRAME_ID);
    window.addEventListener('unload', () => {
      try { if (localStorage.getItem(__JA_LOCK_KEY) === __JA_FRAME_ID) localStorage.removeItem(__JA_LOCK_KEY); } catch {}
    });
    return true;
  } catch { return true; } // if storage fails, fail-open (still only 1 icon due to DOM id check)
}
function releaseUiLock() {
  try { if (localStorage.getItem(__JA_LOCK_KEY) === __JA_FRAME_ID) localStorage.removeItem(__JA_LOCK_KEY); } catch {}
}

// pick the element closest to the viewport center (used by getGenericActiveCardMeta)
function closestToViewportCenter(nodes) {
  let best = null, bestD = Infinity;
  const cx = window.innerWidth / 2, cy = window.innerHeight / 2;
  for (const n of nodes || []) {
    if (!n || !isVisible(n)) continue;
    const r = n.getBoundingClientRect();
    const x = Math.max(r.left, Math.min(cx, r.right));
    const y = Math.max(r.top, Math.min(cy, r.bottom));
    const d = (x - cx) * (x - cx) + (y - cy) * (y - cy);
    if (d < bestD) { bestD = d; best = n; }
  }
  return best;
}
/* =========================
   0d) Primary job block selector (ADD THIS)
   ========================= */

function selectPrimaryJobBlock(doc = document) {
  const $$ = (s, r = doc) => Array.from(r.querySelectorAll(s));
  const visible = (el) => {
    if (!el) return false;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };

  const CANDIDATES = [
    'main', '#main', '[role="main"]',
    '#iCIMS_JobContent', '.iCIMS_JobContent', '.iCIMS_JobDescription', '.iCIMS_JobHeader',
    '.iCIMS_Profile', '.iCIMS_CandidateProfile', '.iCIMS_Application', '.iCIMS_Apply',
    '.iCIMS_Content', '.icims-portal', '.application-container',
    '.job-details', '.job', '.job-application', '.application',
    '.wizard', '.stepper', '.progress-tracker', '.application-steps', '.wizardSteps'
  ].join(',');

  const hasTitle = (root) => !!root.querySelector('h1,h2,[role="heading"]');
  const longText = (root) => ((root.textContent || '').replace(/\s+/g,' ').length > 500);
  const applySignals = (root) => {
    const inputs = root.querySelectorAll('input,select,textarea');
    const stepper = root.querySelector('[data-automation-id*="stepper" i], .wd-step, .progress-tracker, .application-steps, .wizardSteps, .stepper');
    const btn = Array.from(root.querySelectorAll('a,button,input[type=submit]')).some(el =>
      /apply|begin application|start application|continue|next|submit/i.test((el.textContent || el.value || '').trim())
    );
    return inputs.length >= 6 || !!stepper || !!btn;
  };

  const blocks = $$(CANDIDATES).filter(visible);
  if (!blocks.length) return null;

  const topMost = blocks.filter(el => !blocks.some(o => o !== el && o.contains(el)));
  if (!topMost.length) return null;

  function score(el) {
    const r = el.getBoundingClientRect();
    const area = r.width * r.height;
    const jdLike = (hasTitle(el) && longText(el)) ? 2 : 0;
    const applLike = applySignals(el) ? 1 : 0;
    return { jdLike, applLike, area, top: r.top || 0 };
  }

  topMost.sort((a,b) => {
    const sa = score(a), sb = score(b);
    if (sa.jdLike !== sb.jdLike) return sb.jdLike - sa.jdLike;
    if (sa.applLike !== sb.applLike) return sb.applLike - sa.applLike;
    if (sa.area !== sb.area) return sb.area - sa.area;
    return sa.top - sb.top;
  });

  const best = topMost[0];
  const s = score(best);
  return (s.jdLike || s.applLike) ? best : null;
}

/* =========================
   0b) URL & list/grid helpers
   ========================= */
// 1.Working codes to find JOb pages.
function urlHints() {
  try {
    //const u = new URL(location.href);
    const u = safeURL(location.href) || { pathname: "", search: "" };
    const path = (u.pathname + ' ' + u.search).toLowerCase();
    let hits = 0;
    for (const k of URL_KEYWORDS) {
      const re = new RegExp(`(^|[\\W_])${k}([\\W_]|$)`, 'i');
      if (re.test(path)){
        hits++;
        break;
      }
    }
    return hits;
  } catch { return 0; }
}

function looksLikeGrid(root = document) {
  const cards = root.querySelectorAll(
    '[data-occludable-job-id],[data-job-id],[data-jk],.job-card,.jobs-search-results__list-item,.tapItem,.job_seen_beacon'
  );
  return cards.length > 12 && !hasApplySignals();
}

function hasApplySignals() {
  const strongBtn = Array.from(document.querySelectorAll('a,button,input[type=submit]'))
      .some(el => /apply(?:\s|$)|submit application|send application|begin application|start application|apply now/i
          .test((el.textContent||el.value||'').trim()));
  if (strongBtn) return true;
  if (document.querySelector('input[type="file"], input[name*="resume" i], input[name*="cv" i], input[name*="file" i]')) return true;
  const labelish = /(first|last)\s*name|email|phone|address|resume|cv|linkedin|portfolio|cover\s*letter|location/i;

  const forms = Array.from(document.querySelectorAll('form'))
      .filter(f => !/search|filter|newsletter/i.test(
          (f.getAttribute('id')||'') + ' ' + (f.getAttribute('name')||'') + ' ' + (f.className||'')
      ));

  const hasCandidateForm = forms.some(f => {
      const inputs = f.querySelectorAll('input,select,textarea');
      if (inputs.length < 1) return false;
      const text = (f.innerText||'').slice(0, 1200);
      return labelish.test(text);
  });
  
  if (hasCandidateForm) return true;
  const allCandidateInputs = document.querySelectorAll('input,select,textarea');
  if (allCandidateInputs.length > 1) {
      // Check the text surrounding the inputs for application labels
      const inputsTextContext = (document.body?.innerText || '').slice(0, 4000); 
      
      if (labelish.test(inputsTextContext)) {
          return true;
      }
  }

  return false; // If none of the four signals are met.
}

function liDetailRoot() {
  return document.querySelector('.jobs-search__job-details--container')
      || document.querySelector('.jobs-details__main-content')
      || document.querySelector('#main')
      || null;
}

const HEADING_RE = /(?:^|\b)(?:job\s*description|about\s*the\s*role|role\s*requirements|responsibilities|requirements|qualifications|skills|what\s+(?:you(?:’|')?ll|you\s+will)\s+do|you\s+are|what\s+we\s+look\s+for|preferred\s+qualifications|minimum\s+qualifications|must\s+have|nice\s+to\s+have|duties|scope)(?=\b|\s*[:—-])/i;

const JD_SELECTORS = [
  '.jobs-description__container','.jobs-box__html-content',
  '.jobs-description-content__text','.jobs-unified-description__content',
  '.show-more-less-html__markup',
  '#jobDescriptionText','.jobsearch-jobDescriptionText',
  '[data-automation-id="jobPostingDescription"]','[data-automation-id="richTextArea"]',
  '#job-details','[aria-labelledby = "job-overview"]','#overview',
  '#jobdescSec','[data-cy="jobDescription"]','section[data-testid="jobDescription"]',
  '.job-details__content',
  '.job-description','[itemprop="description"]','.unstyled-html',
  '#jobDescription','.jobDescription','.description__text',
  '#iCIMS_JobContent','.iCIMS_JobDescription','.posting .section-wrapper','.posting .content',
  '.posting .description',
];

function jsonldHasJobPosting() {
  try {
    for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
      let data; try { data = JSON.parse(s.textContent || ''); } catch { continue; }
      const list = Array.isArray(data) ? data : [data];
      if (list.some(n => {
        const t = Array.isArray(n?.['@type']) ? n['@type'].join(',') : n?.['@type'];
        return (t||'').toLowerCase().includes('jobposting');
      })) return true;
    }
  } catch {}
  return false;
}

function findJobTitleEl() {
  const sels = [
    '.jobsearch-JobInfoHeader-title',
    '.top-card-layout__title','.jobs-unified-top-card__job-title','.jobs-unified-top-card__title',
    'h1[data-test-job-title]','[data-test-job-title]',
    'h1[data-cy="jobTitle"]','[data-testid="jobTitle"]','.jobTitle','h1.job-title','[data-automation-id="jobPostingHeader"] h1','h1'
  ];
  for (const s of sels) { const el = document.querySelector(s); if (el && (el.textContent||'').trim()) return el; }
  return null;
}
function titleLooksSane(t) {
  const s = (t||'').trim();
  if (!s) return false;
  if (s.length < 3 || s.length > 160) return false;
  if (/^chatgpt$/i.test(s)) return false;
  return true;
}
function hasJDContainers() {
  const root = isLinkedInHost() ? (liDetailRoot() || document) : document;
  return !!root.querySelector(JD_SELECTORS.join(','));
}

// NEW: detect auth/stepper/confirmation-like pages to suppress JD extraction
function looksLikeAuthOrStepper() {
  // Workday stepper / auth / application wizard
  //const stepper = document.querySelector('[data-automation-id*="stepper" i], .wd-step, .progress-tracker, .application-steps, .wizardSteps, .stepper');
  const authWords = /(create\s*account|log\s*in|sign\s*in|sign\s*up|authentication|verify\s*email|password)/i;
  //const hasAuthText = authWords.test((document.body.innerText || '').slice(0, 4000));
  const hasAuthUrl = authWords.test((location.href));
  //const heavyForm = document.querySelector('form') && document.querySelectorAll('input,select,textarea').length > 10;
  //return !!(stepper || (heavyForm && hasAuthText));
  return !!(hasAuthUrl);
}

function isNegativeLinkedInPage() {
  if (!isLinkedInHost()) return false;
  const p = location.pathname.toLowerCase();
  return LI_NEGATIVE_PATH.some(rx => rx.test(p));
}

/** Core detector (tiered) */
async function detectJobPage() {
  if (isHardBlockedHost()) return { ok: false, tier: 'none', score: 0, allowUI: false, signals: { reason: 'hard_block' } };
  if (isSearchEngineHost() || isNegativeHost() || isNegativeLinkedInPage()) {
    return { ok: false, tier: 'none', score: 0, allowUI: false, signals: { reason: 'negative_host_or_path' } };
  }

  const schemaFound = jsonldHasJobPosting();
  const titleEl = findJobTitleEl();
  const title = (titleEl?.textContent || '').trim();
  const detailsOk = titleLooksSane(title) || !!getCompanyName() || !!getLocationText();

  const schemaScore = schemaFound ? 1.2 : 0;
  const hostScore   = isKnownJobHost() ? 0.8 : 0;
  const formScore   = hasApplySignals() ? 0.8 : 0;
  const detailsScore= detailsOk ? 0.6 : 0;
  const urlScore    = urlHints() > 0 ? 0.8 : 0;
  const atsScore    = isAtsHost() ? 0.3 : 0;

  // Optional ML (kept OFF). Keep mlBoost defined so later code never crashes.
  let mlBoost = 0;
  /* try {
    const root = isLinkedInHost() ? (liDetailRoot() || document) : document;
    const sample = (root.innerText || '').slice(0, 1600);
    const resp = await new Promise((resolve) => {
      chrome.runtime.sendMessage({
        action: 'classifyJobPageAdvanced',
        features: { url: location.href, host: location.host, has_apply: !!formScore, has_schema: !!schemaFound },
        sample
      }, r => resolve(r || null));
    });
    if (resp && typeof resp.mlBoost === 'number') mlBoost = Math.max(0, Math.min(0.8, resp.mlBoost));
  } catch {} */

  let score = urlScore + hostScore + atsScore + schemaScore + detailsScore + formScore + mlBoost;

  const s1 = !!schemaFound;
  const s2 = !!titleLooksSane(title);
  const s3 = isKnownJobHost();
  const s4 = !!hasApplySignals();
  const s5 = !!hasJDContainers();
  const s6 = urlHints() > 0;

  const strongSignals = [s1,s2,s3,s4,s5,s6].filter(Boolean).length;
  const gridOnly = looksLikeGrid(document) && strongSignals < 2;

  let tier = 'none', ok = false;

  if (schemaFound) { ok = true; score = Math.max(score, 2.6); tier = 'high'; }
  else if (!gridOnly && strongSignals >= 2 && score >= 1.6) { ok = true; tier = 'medium'; }
  else if (!gridOnly && (urlScore + hostScore + atsScore) >= 1.0 && (detailsOk || hasJDContainers())) { ok = true; tier = 'low'; }

  const allowUI = ok
    && (tier === 'medium' || tier === 'high')
    && (schemaFound || hasJDContainers() || hasApplySignals() || urlHints());

  const scoreNum = Number.isFinite(score) ? Number(score.toFixed(2)) : 0;

  return {
    ok, tier, score: scoreNum, allowUI,
    signals: { urlScore, hostScore, atsScore, schemaFound, detailsOk, formSignals: !!formScore, strongSignals, gridOnly, mlBoost }
  };
}


/* =========================
   2) JD extraction (Schema → DOM semantics → Keyword fallback)
   ========================= */

function cleanJDText(s) {
  let out = String(s || '');
  out = out.replace(/https?:\/\/\S+/gi, ' ')
           .replace(/\bhttps?\b/gi, ' ')
           .replace(/\bwww\.[^\s]+/gi, ' ')
           .replace(/[\w.-]+\.(com|org|net|io|co)(\/[^\s]*)?/gi, ' ')
           .replace(/\\u00[0-9a-f]{2}/gi, ' ')
           .replace(/%[0-9a-f]{2}/gi, ' ')
           .replace(/[\w?&=]{20,}/g, ' ')
           .replace(/\s{2,}/g, ' ').trim();
  return out;
}

function stripLabelishLines(raw) {
  return (raw || '')
    .split(/\n+/)
    .filter(line => {
      const t = line.trim(); if (!t) return false;
      if (/^.{1,40}:\s*$/.test(t)) return false;
      if (/^.{1,40}\*\s*$/.test(t)) return false;
      if (/^\([\s\S]{1,20}\)\s*$/.test(t)) return false;
      const words = t.split(/\s+/); const shortish = t.length <= 30 && words.length <= 4;
      const noPunct = !/[.?!,:;–—]/.test(t);
      const looksPlainWords = words.every(w => /^[A-Za-z][A-Za-z-]*$/.test(w));
      if (shortish && noPunct && looksPlainWords && !HEADING_RE.test(t)) return false;
      return true;
    })
    .join('\n').replace(/\n{3,}/g, '\n\n');
}

function scoreJDText(t) {
  const L = t.length;
  if (L < 120 || L > 24000) return 0;
  //const kw = ["responsibilities","requirements","nice to have","qualifications","skills","you’ll","you will","about the role","duties"];
  const kw = [
    "job description",
    "about the role",
    "role requirements",
    "responsibilities",
    "requirements",
    "qualifications",
    "skills",
    "what you'll do",
    "what you will do",
    "you are",
    "what we look for",
    "preferred qualifications",
    "minimum qualifications",
    "must have",
    "nice to have",
    "duties",
    "scope",
    "you could be a great fit if"
  ];
  let k = 0; const lc = t.toLowerCase(); for (const w of kw) if (lc.includes(w)) k++;
  const lenBonus = Math.max(0, 10 - Math.abs((L - 3000) / 600));
  return k*5 + lenBonus;
}

function collectJDFromJSONLD() {
  const arr = [];
  (isLinkedInHost() ? (liDetailRoot() || document) : document)
    .querySelectorAll('script[type="application/ld+json"]').forEach(s => {
      let data; try { data = JSON.parse(s.textContent || ''); } catch { data = null; }
      const list = data ? (Array.isArray(data) ? data : [data]) : [];
      for (const node of list) {
        const typ = Array.isArray(node?.['@type']) ? node['@type'].join(',') : node?.['@type'];
        if ((typ || '').toLowerCase().includes('jobposting')) {
          const html = node.description || node.responsibilities || ''; if (!html) continue;
          const tmp = document.createElement('div'); tmp.innerHTML = html;
          const t = cleanJDText(sanitize(tmp.innerText || tmp.textContent || '')); if (t) arr.push({ el: document.body, text: t, why: 'jsonld' });
        }
      }
    });
  return arr;
}

function collectJDBySelectors() {
  const arr = [];
  const root = isLinkedInHost() ? (liDetailRoot() || document) : document;
  JD_SELECTORS.forEach(sel => {
    root.querySelectorAll(sel).forEach(el => {
      if (!isVisible(el)) return;
      if (el.closest('form, fieldset, [role="form"], .form, .application-form')) return;
      const controls = el.querySelectorAll('input,select,textarea,button'); if (controls.length >= 2) return;
      const raw = sanitize(txt(el)); const base = isLinkedInHost() ? raw : stripLabelishLines(raw);
      const t = cleanJDText(base); if (t) arr.push({ el, text: t, why: `sel:${sel}` });
    });
  });
  return arr;
}

function isHeadingCandidate(el) {
  if (!el) return false;
  if (el.tagName === 'LABEL' || el.closest('label')) return false;
  if (el.closest('form, fieldset, [role="form"], .form, .application-form')) return false;
  if (el.matches?.('[for]')) return false;
  if (el.querySelector?.('input,select,textarea,button')) return false;
  const t = (el.textContent || '').trim(); if (!t || t.length < 5) return false;
  if (!/^H[1-6]$/.test(el.tagName) && el.getAttribute('role') !== 'heading') {
    const s = getComputedStyle(el); const fs = parseFloat(s.fontSize) || 0; const fw = parseInt(s.fontWeight,10) || 400;
    if (fs < 14 && fw < 600) return false;
  }
  return HEADING_RE.test(t);
}

function collectJDByHeadings() {
  const arr = [];
  const root = isLinkedInHost() ? (liDetailRoot() || document) : document;
  const nodes = Array.from(root.querySelectorAll('h1,h2,h3,h4,h5,h6,[role="heading"],div,legend,strong,b,span[role="heading"]'))
    .filter(isHeadingCandidate);
  for (const h of nodes) {
    const chunks = []; let sib = h.nextElementSibling, i = 0;
    // Optional (recommended): Increase heading merge tolerance to catch split JDs
    while (sib && i < 24) {
      if (/^H[1-6]$/.test(sib.tagName)) break;
      if (!sib.closest('form, fieldset, [role="form"], .form, .application-form') && isVisible(sib) && !sib.querySelector('input,select,textarea,button')) {
        chunks.push(sib.cloneNode(true));
      }
      sib = sib.nextElementSibling; i++;
    }
    const wrap = document.createElement('div'); chunks.forEach(n => wrap.appendChild(n));
    const raw = sanitize(txt(wrap)); const base = isLinkedInHost() ? raw : stripLabelishLines(raw);
    const t = cleanJDText(base); if (t) arr.push({ el: h, text: t, why: 'heading' });
  }
  return arr;
}

function mergeCandidateTexts(cands, maxLen = 24000) {
  const seen = new Set(); const parts = []; let total = 0;
  for (const c of cands) {
    const t = (c.text || '').trim(); if (t.length < 120) continue;
    const h = hash(t.toLowerCase()); if (seen.has(h)) continue;
    if (total + t.length > maxLen) {
      const slice = t.slice(0, Math.max(0, maxLen - total));
      if (slice.length >= 120) { parts.push(slice); total += slice.length; }
      break;
    }
    parts.push(t); total += t.length; seen.add(h);
    // Optional increase: allow a couple more chunks
    if (parts.length >= 8) break;
  }
  return parts.join('\n\n');
}

function extractPageTextSansForms() {
  try {
    const root = isLinkedInHost() ? (liDetailRoot() || document.body) : document.body;
    const clone = root.cloneNode(true);
    clone.querySelectorAll('form, fieldset, [role="form"], .application-form, nav, header, footer, aside, script, style').forEach(n => n.remove());
    clone.querySelectorAll('input, select, textarea, button').forEach(n => n.remove());
    const raw = sanitize(clone.innerText || clone.textContent || ''); const base = isLinkedInHost() ? raw : stripLabelishLines(raw);
    return cleanJDText(base);
  } catch { return ""; }
}
function waitForPageSettle({ urlQuietMs = 800, domQuietMs = 600, timeoutMs = 8000 } = {}) {
  const startUrl = location.href;
  let lastChange = performance.now();

  const mo = new MutationObserver(() => { lastChange = performance.now(); });
  try { mo.observe(document.documentElement, { childList: true, subtree: true }); } catch {}

  const t0 = performance.now();
  return new Promise((resolve) => {
    const timer = setInterval(() => {
      const now = performance.now();
      const urlChanged = location.href !== startUrl;
      const domIdle   = (now - lastChange) >= domQuietMs;
      const urlIdle   = urlChanged ? ((now - lastChange) >= urlQuietMs) : true;

      if ((domIdle && urlIdle) || (now - t0) > timeoutMs) {
        clearInterval(timer);
        try { mo.disconnect(); } catch {}
        // give layout a tick
        requestAnimationFrame(() => requestAnimationFrame(resolve));
      }
    }, 120);
  });
}
function waitForDomStable({ timeoutMs = 2500, quietMs = 180 } = {}) {
  return new Promise(resolve => {
    let timer = setTimeout(done, timeoutMs);
    let idle;
    const mo = new MutationObserver(() => {
      clearTimeout(idle);
      idle = setTimeout(done, quietMs);
    });
    mo.observe(document.documentElement, { subtree: true, childList: true, attributes: true });
    function done(){
      mo.disconnect();
      clearTimeout(timer);
      resolve();
    }
  });
}
async function getJobDescriptionText() {
  //waitForPageSettle({ urlQuietMs: 800, domQuietMs: 600, timeoutMs: 8000 });
  // 1B) HARD GUARD: only allow JD on real job pages
  // Only parse where we intend to (ATS iframe when present; else fallback top)
  if (!ROLE_PARSE) return { text: "", anchor: null, source: "none" };
  // early bailout in top window
  if (IS_TOP_WINDOW && pageHasAtsIframe()) {
    //console.log('[JD] ATS iframe detected — skip JD scan in top window')
    //console.log('[CS] frame?', window.top === window.self ? 'top' : 'iframe', location.href);
    return { text: "", anchor: null, source: "skipped_ats_iframe" };
    // you can set a flag so the rest of your script short-circuits
    //window.__JOB_AID_SKIP_JD__ = true;
  }
  // We are either inside the iframe, or on a page without an ATS iframe.
  // If you want to start *after* the JD block renders, add a tiny stabilizer:
  waitForDomStable({ timeoutMs: 2500, quietMs: 180 });
  try {
    const det = await detectJobPage();
    if (!det.allowUI) return { text: "", anchor: null, source: "none" };
  } catch {}

  // Do not return JD on auth/stepper/confirmation pages
  if (looksLikeAuthOrStepper()) return { text: "", anchor: null, source: 'none' };

  // Stage 1: Schema.org JSON-LD (gold)
  const jsonld = collectJDFromJSONLD();
  if (jsonld.length) {
    const merged = mergeCandidateTexts(jsonld, 24000);
    if (merged && merged.length > 120) return { text: merged, anchor: document.body, source: 'jsonld' };
  }
  // Stage 2: Semantic DOM (selectors + headings)
  let candidates = [...collectJDBySelectors(), ...collectJDByHeadings()];
  if (candidates.length) {
    candidates.forEach(c => c.score = scoreJDText(c.text));
    let good = candidates.filter(c => c.score >= 3);

    // Optional ML ranking (background can decide)
    const titleEl = findJobTitleEl();
    const detailsOk = !!(titleEl || getCompanyName() || getLocationText());
    if (detailsOk && good.length) {
      try {
        const payload = { action: 'rankJDCandidates', items: good.map(g => g.text.slice(0, 1200)) };
        const resp = await new Promise(res => chrome.runtime.sendMessage(payload, r => res(r||null)));
        if (resp && typeof resp.bestIndex === 'number' && good[resp.bestIndex]) {
          good = [good[resp.bestIndex], ...good.filter((_,i)=> i!==resp.bestIndex)];
        }
      } catch {}
    }

    if (good.length) {
      const anchorFrom = good[0].el || titleEl || null;
      let anchor = anchorFrom;
      if (anchor) { for (let i=0; i<2 && anchor.parentElement; i++) {
        const p = anchor.parentElement;if (/SECTION|FORM|UL|LI|FIELDSET|ARTICLE|DIV/i.test(p.tagName)) anchor = p; else break;
        //anchor = p;
      } }
      const merged = mergeCandidateTexts(good, 24000);
      if (merged && merged.length > 120) return { text: merged, anchor: anchor || null, source: 'dom' };
    }
  }

  // Stage 3: Keyword/context fallback
  const fallback = extractPageTextSansForms();
  if (fallback && fallback.length > 300) return { text: fallback, anchor: findJobTitleEl() || null, source: 'fallback' };

  return { text: "", anchor: null, source: 'none' };
}

/* =========================
   3) Meta helpers (company/location/logo)
   ========================= */

function readJSONLDJob() {
  try {
    const nodes = [];
    document.querySelectorAll('script[type="application/ld+json"]').forEach(s=>{
      try{
        const obj = JSON.parse(s.textContent||'');
        const arr = Array.isArray(obj)?obj:[obj];
        for (const n of arr) {
          const t = Array.isArray(n?.['@type']) ? n['@type'].join(',') : n?.['@type'];
          if ((t||'').toLowerCase().includes('jobposting')) nodes.push(n);
        }
      }catch{}
    });
    return nodes[0] || null;
  } catch { return null; }
}

function getCompanyName() {
  const jl = readJSONLDJob();
  const fromJL = jl?.hiringOrganization?.name || jl?.hiringOrganization || '';
  if (fromJL && typeof fromJL === 'string') return fromJL.trim();

  const sels = [

    // Indeed (new inline header)
    '[data-testid="inlineHeader-companyName"] a',
    '[data-company-name="true"] a',
    '[data-testid="companyName"]',

    // LinkedIn (keep)
    '.job-details-jobs-unified-top-card__company-name a',
    '.topcard__org-name-link',
    '.top-card-layout__entity-info a',
    '.jobs-unified-top-card__company-name',

    // Generic / other ATS
    '.company,[data-company]',
    '.posting-company,[data-qa="posting-company-name"]',
    '.iCIMS_JobHeader .iCIMS_InlineText:not(.title)',
    '.job-company'
  ];

  for (const sel of sels) {
    const t = document.querySelector(sel)?.textContent?.trim();
    if (t) return t;
  }

  const og = document.querySelector('meta[property="og:site_name"]')?.content?.trim();
  // Ignore generic hosts (avoid "LinkedIn", "Indeed", etc.)
  if (og && !/^(linkedin|indeed|glassdoor|dice|jobright\.ai|monster)$/i.test(og)) return og;

  // Final fallback: subdomain, but never return "www"
  const parts = location.hostname.split('.');
  const sub = parts.length>2 ? parts.slice(0,-2).join('.') : parts[0];
  if (!sub || /^www\d*$/i.test(sub)) return '';
  return sub;
}


function getLocationText() {
  const jl = readJSONLDJob();
  const jlLoc = (() => {
    const loc = jl?.jobLocation;
    if (!loc) return '';
    const asArr = Array.isArray(loc) ? loc : [loc];
    const addr = asArr[0]?.address;
    if (!addr) return '';
    const bits = [addr.addressLocality, addr.addressRegion, addr.addressCountry].filter(Boolean);
    return bits.join(', ');
  })();
  if (jlLoc) return jlLoc;


  const sels = [
    // Indeed (new inline header)
    '[data-testid="inlineHeader-companyLocation"]',
    '[data-testid="companyLocation"]',
    // LinkedIn & generic fallbacks
    '[data-automation-id*="jobLocation"]',
    '.jobs-unified-top-card__job-insight .jobs-unified-top-card__bullet',
    '.top-card-layout__second-subline .jobs-unified-top-card__bullet',
    '.posting-categories .location',
    '.location',
    '[data-test="location"]',
    '.iCIMS_JobHeader .locations .iCIMS_JobHeaderFieldValue',
    '.jobsearch-JobInfoHeader-subtitle div:last-child',
    '[data-qa="posting-location"]'
  ];

  for (const sel of sels) {
   const t = document.querySelector(sel)?.textContent?.trim();
   if (t) {
    // normalize bullets: "Dallas, TX•Remote" → "Dallas, TX • Remote"
    return t.replace(/\s*[•·]\s*/g, ' • ');
   }
  }
  return '';
}


function bestIcon() {
  const links = [...document.querySelectorAll('link[rel*="icon" i], link[rel*="apple-touch-icon" i]')];
  if (!links.length) return null;
  const parsed = links.map(l => {
    const sizes = l.getAttribute("sizes"); let score = 0;
    if (sizes) { const m = sizes.match(/(\d+)\s*x\s*(\d+)/i); if (m) score = Math.max(+m[1], +m[2]); }
    else if (/apple-touch-icon/i.test(l.rel)) score = 192; else score = 64;
    return { href: absUrl(l.href), score };
  }).filter(x => x.href);
  parsed.sort((a,b)=> b.score - a.score); return parsed[0]?.href || null;
}

function getBgImageUrl(el) {
  if (!el) return '';
  const s = getComputedStyle(el);
  const bg = s.backgroundImage || s['background-image'] || '';
  const m = bg.match(/url\(["']?(.+?)["']?\)/i);
  return m ? m[1] : '';
}

function getLinkedInLogoUrl() {
  const scope = liDetailRoot() || document;
  const img1 = scope.querySelector('img.jobs-unified-top-card__company-logo-image'); if (img1?.src) return absUrl(img1.src);
  const img2 = scope.querySelector('.jobs-unified-top-card__company-logo img');     if (img2?.src) return absUrl(img2.src);
  const bg1  = scope.querySelector('.jobs-unified-top-card__company-logo, .jobs-company__company-logo');
  const bgUrl1 = getBgImageUrl(bg1); if (bgUrl1) return absUrl(bgUrl1);
  const img3 = scope.querySelector('.artdeco-entity-image__image, .artdeco-entity-image img, img.ivm-view-attr__img--centered'); if (img3?.src) return absUrl(img3.src);
  const bg2  = scope.querySelector('.artdeco-entity-image__image');
  const bgUrl2 = getBgImageUrl(bg2); if (bgUrl2) return absUrl(bgUrl2);
  const listItem = document.querySelector('li.jobs-search-results__list-item[aria-selected="true"], li.jobs-search-results__list-item--active');
  const liImg = listItem?.querySelector('img'); if (liImg?.src) return absUrl(liImg.src);
  const liBg  = listItem?.querySelector('.artdeco-entity-image, .ivm-image-view-model__img');
  const liBgUrl = getBgImageUrl(liBg); if (liBgUrl) return absUrl(liBgUrl);
  return '';
}

function getCompanyLogoUrl() {
  if (isLinkedInHost()) {
    const liLogo = getLinkedInLogoUrl();
    if (liLogo) return liLogo;
    return ''; // avoid LinkedIn favicon
  }
  const sels = ['img[alt*="logo" i]','.company-logo img','.artdeco-entity-image img','.iCIMS_Logo img','.image-container img','img[aria-label*="logo" i]'];
  //for (const sel of sels) { const src = document.querySelector(sel)?.getAttribute('src'); if (src) return absUrl(src); }
  for (const sel of sels) {
  const src = document.querySelector(sel)?.getAttribute('src');
    if (src && typeof src === 'string') {
     const a = absUrl(src);
     if (a) return a;
    }
}
  const og = document.querySelector('meta[property="og:image"]')?.content;
  if (og) return absUrl(og);
  return bestIcon() || absUrl('/favicon.ico');
}

function getJobTitleStrict() {
  const sels = [
    '[data-automation-id="jobPostingHeader"] h1','.jobsearch-JobInfoHeader-title','.top-card-layout__title',
    '.jobs-unified-top-card__job-title','.jobs-unified-top-card__title','h1[data-test-job-title]','h1[data-cy="jobTitle"]',
    '[data-testid="jobTitle"]','.jobTitle','h1.job-title','h1'
  ];
  for (const sel of sels) { const t = document.querySelector(sel)?.textContent?.trim(); if (t) return t; }
  return document.title || '';
}

/* =========================
   4) Icon / Banner (UI gates only for MEDIUM/HIGH)
   ========================= */
const isIcimsHost = /(?:^|\.)icims\.com$/i.test(location.hostname);
/*
function showIcon() {
  // acquire per-origin+path lock; if another same-origin frame owns UI, bail
  if(isIcimsHost && !acquireUiLock() ){
    return;
  }
  //if (!acquireUiLock()) return;
  if (document.getElementById('jobAidIcon')) return;

  const iconUrl = chrome.runtime.getURL('images/icon.jpeg');
  const icon = document.createElement('img');
  icon.src = iconUrl; icon.id = 'jobAidIcon';
  Object.assign(icon.style, {
    position:'fixed', left:'20px', top:'20px', width:'48px', height:'48px',
    zIndex: '2147483647', cursor:'pointer', userSelect:'none', pointerEvents:'auto',
  });
  let isDragging=false, moved=false, offsetX=0, offsetY=0;
  icon.addEventListener('pointerdown', e => {
    isDragging = true; moved = false;
    offsetX = e.clientX - icon.offsetLeft; offsetY = e.clientY - icon.offsetTop;
    icon.setPointerCapture(e.pointerId);
    icon.style.cursor = 'grabbing'; e.preventDefault();
  });
  icon.addEventListener('pointermove', e => {
    if (!isDragging) return; moved = true;
    let x = e.clientX - offsetX; let y = e.clientY - offsetY;
    const maxX = window.innerWidth - icon.offsetWidth; const maxY = window.innerHeight - icon.offsetHeight;
    x = clamp(x, 0, maxX); y = clamp(y, 0, maxY);
    icon.style.left = x + 'px'; icon.style.top = y + 'px';
  });
  icon.addEventListener('pointerup', e => {
    if (!isDragging) return; isDragging = false;
    icon.releasePointerCapture(e.pointerId); icon.style.cursor = 'pointer';
  });
  icon.addEventListener('click', e => {
    if (moved) { e.stopImmediatePropagation(); return; }
    chrome.runtime.sendMessage({ action: 'openPopup' });
  });
  document.body.appendChild(icon);
  try { window.__JobAidIconShown = true; } catch {}
  try { if (typeof window.initATSWatchers === 'function') window.initATSWatchers(); } catch {}
}
*/
function showIcon() {
  // Only the top window owns UI
  if (!ROLE_UI) return;

  // Acquire per-origin+path lock to avoid double icons across same-origin iframes
  //if (!acquireUiLock()) return;

  if (document.getElementById('jobAidIcon')) return;

  const iconUrl = chrome.runtime.getURL('images/icon.jpeg');
  const icon = document.createElement('img');
  icon.src = iconUrl; icon.id = 'jobAidIcon';
  Object.assign(icon.style, {
    position:'fixed', left:'20px', top:'20px', width:'48px', height:'48px',
    zIndex: '2147483647', cursor:'pointer', userSelect:'none', pointerEvents:'auto',
  });
  let isDragging=false, moved=false, offsetX=0, offsetY=0;
  icon.addEventListener('pointerdown', e => {
    isDragging = true; moved = false;
    offsetX = e.clientX - icon.offsetLeft; offsetY = e.clientY - icon.offsetTop;
    icon.setPointerCapture(e.pointerId);
    icon.style.cursor = 'grabbing'; e.preventDefault();
  });
  icon.addEventListener('pointermove', e => {
    if (!isDragging) return; moved = true;
    let x = e.clientX - offsetX; let y = e.clientY - offsetY;
    const maxX = window.innerWidth - icon.offsetWidth; const maxY = window.innerHeight - icon.offsetHeight;
    x = clamp(x, 0, maxX); y = clamp(y, 0, maxY);
    icon.style.left = x + 'px'; icon.style.top = y + 'px';
  });
  icon.addEventListener('pointerup', e => {
    if (!isDragging) return; isDragging = false;
    icon.releasePointerCapture(e.pointerId); icon.style.cursor = 'pointer';
  });
  icon.addEventListener('click', e => {
    if (moved) { e.stopImmediatePropagation(); return; }
    chrome.runtime.sendMessage({ action: 'openPopup' });
  });
  document.body.appendChild(icon);
  try { window.__JobAidIconShown = true; } catch {}
  try { if (typeof window.initATSWatchers === 'function') window.initATSWatchers(); } catch {}
}
/*
function removeIcon() {
  const icon = document.getElementById('jobAidIcon');
  if (icon) icon.remove();
  try { window.__JobAidIconShown = false; } catch {}
  if(isIcimsHost){
    releaseUiLock(); // release owner so another frame (if any) may take over when appropriate
  }
}*/
function removeIcon() {
  const icon = document.getElementById('jobAidIcon');
  if (icon) icon.remove();
  try { window.__JobAidIconShown = false; } catch {}
  // Always release the UI lock if we own it
  //releaseUiLock();
}

function removeBanner() { const host = document.getElementById('jobAidSkillBannerHost'); if (host) host.remove(); }

/* ==== skills banner kept as-is except gated by allowUI ==== */
function displayMatchingPerecentage(pct, matched) {
    
  if (!ROLE_PARSE) return; // banner only in the parsing context

  if (!Array.isArray(allSkills) || allSkills.length === 0) return;

  const hostId = 'jobAidSkillBannerHost';
  let host = document.getElementById(hostId);
  // choose one primary container to own the banner
  const primary = selectPrimaryJobBlock();
  const insertRoot = primary || document.querySelector('main') || document.body;
  // find title within the chosen root (not the whole document)
  const titleSel = [
    "[data-automation-id='jobPostingHeader'] h1",".jobsearch-JobInfoHeader-title",".top-card-layout__title",
    ".jobs-unified-top-card__job-title",".jobs-unified-top-card__title","h1[data-test-job-title]",
    "h1[data-cy='jobTitle']","[data-testid='jobTitle']", ".jobTitle","h1.job-title","h1"
  ];
  let titleEl = null;
  for (const s of titleSel) { const el = insertRoot.querySelector(s); if (el) { titleEl = el; break; } }

  // if an existing banner is mounted outside our chosen root (duplication scenario), remove & recreate
  if (host && !insertRoot.contains(host)) { try { host.remove(); } catch {} host = null; }

  if (!host) {
    host = document.createElement('div'); host.id = hostId;

    if (titleEl?.parentElement) titleEl.parentElement.insertBefore(host, titleEl.nextSibling);
    else insertRoot.insertBefore(host, insertRoot.firstChild || null);

    const shadow = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = `
      @keyframes border-move { 0% { --angle: 0deg; } 100% { --angle: 360deg; } }
      .box { --angle: 0deg; box-sizing: border-box; width: 100%; margin: 10px 0; padding: 10px 12px;
             border-radius: 12px; background: #fff; position: relative; }
      .box::before { content: ""; position: absolute; inset: -2px; border-radius: 14px;
        background: conic-gradient(from var(--angle), #6366f1 0%, #22c55e 25%, #06b6d4 50%, #f59e0b 75%, #6366f1 100%);
        -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
        -webkit-mask-composite: xor; mask-composite: exclude; padding: 2px; z-index: 0; animation: border-move 4s linear infinite; }
      .inner { position: relative; z-index: 1; }
      .score { font-weight: 800; font-size: 14px; color: #1e3a8a; }
      .row { margin-top: 6px; display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
      .label { font-size: 12px; color: #374151; font-weight: 700; margin-right: 6px; }
      .pill { display: inline-block; padding: 4px 8px; border-radius: 9999px;
              background: #f3f4f6; border: 1px solid #e5e7eb; font-size: 12px; color: #111827; }
      .pill.miss { background: #fff7ed; border-color: #fed7aa; color: #9a3412; }
    `;
    const root = document.createElement('div'); root.className = 'box';
    root.innerHTML = `
      <div class="inner">
        <div class="score" id="score"></div>
        <div class="row"><span class="label" id="matchLabel"></span><div class="row" id="matchList"></div></div>
        <div class="row"><span class="label" id="unmatchLabel"></span><div class="row" id="unmatchList"></div></div>
      </div>
    `;
    shadow.appendChild(style); shadow.appendChild(root);
  } else if (!host.isConnected) {
    // rare SPA remounts
    if (titleEl?.parentElement) titleEl.parentElement.insertBefore(host, titleEl.nextSibling);
    else insertRoot.insertBefore(host, insertRoot.firstChild || null);
  }

  const scoreEl = host.shadowRoot.getElementById('score');
  const matchLabel = host.shadowRoot.getElementById('matchLabel');
  const unmatchLabel = host.shadowRoot.getElementById('unmatchLabel');
  const matchList = host.shadowRoot.getElementById('matchList');
  const unmatchList = host.shadowRoot.getElementById('unmatchList');

  const jd = Array.isArray(allSkills) ? allSkills : [];
  const mset = new Set((matched || []).map(x => (x || '').toLowerCase()));
  const unmatched = jd.filter(x => !mset.has((x || '').toLowerCase()));

  scoreEl.textContent = `Skill match: ${Math.round(pct || 0)}%`;
  matchLabel.textContent = `Matched (${matched.length}/${jd.length})`;
  unmatchLabel.textContent = `Unmatched (${unmatched.length}/${jd.length})`;

  matchList.innerHTML = '';
  matched.slice(0, 120).forEach(s => { const p = document.createElement('span'); p.className = 'pill'; p.textContent = s; matchList.appendChild(p); });

  unmatchList.innerHTML = '';
  unmatched.slice(0, 120).forEach(s => { const p = document.createElement('span'); p.className = 'pill miss'; p.textContent = s; unmatchList.appendChild(p); });
}

function expandLinkedInDescription() {
  ['.show-more-less-html__button','button[aria-expanded="false"][data-control-name*="show"]',
   'button[aria-label*="show more" i]','button[aria-label*="see more" i]']
   .forEach(sel => document.querySelectorAll(sel).forEach(btn => { if (isVisible(btn)) { try { btn.click(); } catch {} } }));
}

/* =========================
   5) LinkedIn active-card helpers
   ========================= */
// try to get an id from html structure of Linkedin present page
function findLinkedInJobIdFromDetail() {
  const a = Array.from(document.querySelectorAll('a[href*="/jobs/view/"]')).find(x => /\/jobs\/view\/\d+/.test(x.getAttribute('href')||''));
  const m = a?.getAttribute('href')?.match(/\/jobs\/view\/(\d+)/);
  if (m) return m[1];

  const el = document.querySelector('[data-job-id],[data-job-id-view],[data-job-id-saved]');
  const id = el?.getAttribute('data-job-id') || el?.getAttribute('data-job-id-view') || el?.getAttribute('data-job-id-saved');
  return id || '';
}
//tries to get an active id from active card, if not from url, if not from html.
function getActiveCardId() {
  const liActive =
    document.querySelector(
      'li.jobs-search-results__list-item--active [data-occludable-job-id], ' +
      'li.jobs-search-results__list-item[aria-selected="true"] [data-occludable-job-id], ' +
      ' .jobs-search-two-pane__job-card-container--active [data-occludable-job-id]'
    ) || document.querySelector('[data-occludable-job-id]');
  if (liActive?.dataset?.occludableJobId) return `LI:${liActive.dataset.occludableJobId}`;

  //const urlJobId = new URL(location.href).searchParams.get('currentJobId');
  const urlJobId = (safeURL(location.href)?.searchParams || new URLSearchParams()).get('currentJobId');
  if (urlJobId) return `LI:${urlJobId}`;

  const detailId = findLinkedInJobIdFromDetail();
  if (detailId) return `LI:${detailId}`;

  return '';
}

function getLinkedInActiveCardMeta() {

  if (!isLinkedInHost()) return null;

  //const root = liDetailRoot() || document;
  const tEl = findJobTitleEl();
  const title = (tEl?.textContent || '').trim();
  if (!title) return null;
  function getLinkedInCompanyName(root=document) {
    // LinkedIn job details live in a dedicated container; prefer that as root
    const scope =
      root.querySelector('.jobs-search__job-details--container') ||
      root.querySelector('.jobs-details__main-content') ||
      root.querySelector('#main') ||
      root;

    // 1) Exact structure you shared
    let el = scope.querySelector('.job-details-jobs-unified-top-card__company-name a');
    if (el && el.textContent.trim()) {return el.textContent.trim();}
    // 2) Same container, but sometimes people grab the div instead of the <a>
    el = scope.querySelector('.job-details-jobs-unified-top-card__company-name');
    if (el && el.textContent.trim()) return el.textContent.trim();
    // 3) Other stable LinkedIn selectors we see in the wild
    const sels = [
      '.jobs-unified-top-card__company-name a',
      '.jobs-unified-top-card__company-name',
      '.top-card-layout__entity-info a',
      '.topcard__org-name-link',
      'a[data-test-app-aware-link][href*="/company/"]'
    ];
    for (const s of sels) {
      const n = scope.querySelector(s);
      if (n && n.textContent && n.textContent.trim()) return n.textContent.trim();
    }

    // 4) Fallback: look for the first company link in the unified top card region
    const region =
      scope.querySelector('.jobs-unified-top-card') ||
      scope.querySelector('.jobs-details__main-content') ||
      scope;
    const link = Array.from(region.querySelectorAll('a'))
      .find(a => /\/company\//.test(a.getAttribute('href') || ''));
    if (link && link.textContent.trim()) return link.textContent.trim();

    return '';
  }

  const  companyName = getLinkedInCompanyName();
 //console.log('company Name:', companyName);
  function getLinkedInLocation(root = document) {
    // container with multiple classes → dot-chain them
    const container = root.querySelector(
      '.t-black--light.mt2.job-details-jobs-unified-top-card__tertiary-description-container'
    );

    if (container) {
      // Prefer the first low-emphasis text chunk (that’s the location)
      const spans = container.querySelectorAll('span.tvm__text.tvm__text--low-emphasis');
      for (const sp of spans) {
        const text = sp.textContent?.trim();
        if (!text) continue;
        // Skip bullet separators or notes
        if (text === '·') continue;
        if (/responses managed off linkedin/i.test(text)) continue;
        return text;
      }

      // Fallback: take everything before the first bullet
      const raw = container.textContent.replace(/\s+/g, ' ').trim();
      const beforeBullet = raw.split('·')[0].trim();
      if (beforeBullet) return beforeBullet;
    }

    // Other LinkedIn layouts (fallbacks you already had)
    const fallbacks = [
      '.jobs-unified-top-card__primary-description',
      '.jobs-unified-top-card__job-insight .jobs-unified-top-card__bullet',
      '.top-card-layout__second-subline .jobs-unified-top-card__bullet',
    ];
    for (const s of fallbacks) {
      const v = root.querySelector(s)?.textContent?.trim();
      if (v) return v.split('·')[0].trim();
    }

    return '';
  }
  const locationText = getLinkedInLocation();
  //const u = new URL(window.location.href);
  const u = safeURL(window.location.href) || { hostname: location.hostname, pathname: location.pathname, origin: location.origin };
  let jobId = u.searchParams.get('currentJobId') || '';
  if (!jobId) {
    const selected = document.querySelector('.jobs-search-results__list-item[aria-selected="true"]');
    jobId = selected?.getAttribute('data-id')
         || selected?.getAttribute('data-occludable-job-id')
         || selected?.querySelector('[data-job-id]')?.getAttribute('data-job-id')
         || findLinkedInJobIdFromDetail()
         || '';
  }

  const canonicalUrl = jobId ? `https://www.linkedin.com/jobs/view/${jobId}/` : location.href;
  const logoUrl = getCompanyLogoUrl();
  const meta = { title, company: companyName, location: locationText, logoUrl, url: canonicalUrl, jobId, atsVendor: 'linkedin' };
  lastActiveLIMeta = meta;
  return meta;
}
/* =========================
   5b) Generic company/ATS list → active-card helpers
   ========================= */

function findGenericJobListContainers(root = document) {
  const sels = [
    '[role="list"], [role="listbox"]',
    '.jobs, .jobs-list, .job-list, .posting-list, .positions-list, .careers-list',
    '.gh-application, .lever, .ashby, .workday, .icims, .smartrecruiters, .workable, .bamboohr, .successfactors',
    '.search-results, .results-list, .positions, .open-roles'
  ];
  const lists = new Set();
  sels.forEach(sel => document.querySelectorAll(sel).forEach(el => lists.add(el)));
  if (lists.size === 0) {
    const many = document.querySelectorAll('li a[href*="job"], li a[href*="careers"], li a[href*="jobs"], li a[href*="/posting"], .job-card a, .posting a');
    if (many.length >= 6) lists.add(many[0].closest('ul,ol,section,div') || document.body);
  }
  return Array.from(lists);
}

function findGenericJobCards(lists = findGenericJobListContainers()) {
  const cards = [];
  const linkSel = [
    'a[href*="jobs/"]','a[href*="/job/"]','a[href*="/careers/"]','a[href*="/posting"]','a[href*="lever.co"]',
    'a[href*="greenhouse.io"]','a[href*="myworkdayjobs"]','a[href*="icims.com"]','a[href*="ashbyhq.com"]',
    'a[href*="smartrecruiters.com"]','a[href*="apply.workable.com"]','a[href*="bamboohr.com"]','a[href*="successfactors"]'
  ].join(',');
  for (const list of lists) {
    const candidates = list.querySelectorAll('[role="option"], [role="listitem"], li, .job-card, .posting, .position, .result');
    candidates.forEach(item => {
      let a = item.querySelector(linkSel) || item.querySelector('a[href]');
      if (!a || !a.href) return;
      if (!isVisible(item)) return;
      cards.push({ item, link: a });
    });
  }
  const seen = new Set(); const out = [];
  for (const c of cards) {
    const key = c.link.href.split('#')[0];
    if (seen.has(key)) continue;
    seen.add(key); out.push(c);
  }
  return out;
}

function isSelectedCard(el) {
  if (!el) return false;
  // Strong explicit states
  if (el.matches?.('[aria-selected="true"], [aria-current="true"], [aria-current="page"], .is-active, .active, .selected, .is-selected, .current')) return true;
  // Some lists mark the active item by role=option + aria-activedescendant on the listbox
  const listbox = el.closest?.('[role="listbox"], [role="list"]');
  const act = listbox?.getAttribute?.('aria-activedescendant');
  if (act) {
    const activeEl = document.getElementById(act);
    if (activeEl && (activeEl === el || activeEl.closest?.('*') === el)) return true;
  }

  // Some cards toggle expansion when selected
  const exp = el.getAttribute?.('aria-expanded');
  if (exp && /^(true|1)$/i.test(exp)) return true;

  return false;
}

function extractMetaFromCard(item, link) {
  //const heading = item.querySelector('h1,h2,h3,h4,[role="heading"]');
  const title = (findJobTitleEl()?.textContent || '').trim() //|| sanitize((link?.textContent || heading?.textContent || '').trim());
  //const locEl = item.querySelector('[data-test*="location" i], [data-testid*="location" i], .location, [class*="location" i]');
  const location = (getLocationText() || '').trim()//sanitize((locEl?.textContent || '').replace(/\s*[•·]\s*/g,' • ').trim());
  const company = getCompanyName();
  const img = item.querySelector('img[alt*="logo" i], .company-logo img, img');
  const logoUrl = img?.src ? absUrl(img.src) : getCompanyLogoUrl();
  //const url = absUrl(link?.href || '');
  const url = absUrl((link && typeof link.href === 'string') ? link.href : '');
  return { title, company, location, logoUrl, url };
}
function getGenericActiveCardMeta() {
  const cards = findGenericJobCards();
  if (cards.length === 0) return null;

  // 1) explicit selection
  let pick = cards.find(c => isSelectedCard(c.item));
  if (!pick) {
    // 2) focus inside the item (keyboard navigation)
    pick = cards.find(c => c.item.matches(':focus-within'));
  }
  if (!pick) {
    // 3) item nearest to viewport center (best-effort for two-pane layouts)
    const nodes = cards.map(c => c.item);
    const best = closestToViewportCenter(nodes);
    pick = cards.find(c => c.item === best) || null;
  }
  if (!pick) {
    // 4) only if the list is tiny, allow index 0 as a last resort
    if (cards.length <= 2) pick = cards[0];
  }
  if (!pick) return null;

  const meta = extractMetaFromCard(pick.item, pick.link);
  if (!(meta.title || meta.url)) return null;
  return { ...meta, atsVendor: 'company' };
}


function bindGenericListClicks() {
  if (window.__JobAidGenericListBound__) return;
  window.__JobAidGenericListBound__ = true;
  document.addEventListener('click', (e) => {
    const a = e.target?.closest?.('a[href]');
    if (!a) return;
    const li = a.closest?.('[role="option"], [role="listitem"], li, .job-card, .posting, .position, .result');
    if (!li) return;
    setTimeout(() => {
      try {
        const meta = getGenericActiveCardMeta();
        if (meta && (meta.title || meta.company)) {
          chrome.runtime.sendMessage({ action: 'updateJobContext', canonical: location.href, meta, confidence: 0.75 });
          lastActiveGenericMeta = meta;
        }
      } catch {}
    }, 120);
  }, { capture: true, passive: true });
}

/* =========================
   6) Stable Job Key for LinkedIn
   ========================= */

async function computeStableJobKey() {
  // Prefer canonical URL from background (contains vendor IDs when available)
  try {
    const resp = await new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: 'canonicalizeUrl', url: location.href }, resolve);
    });
    const canonical = resp?.canonical || location.href;
    if (canonical) return canonical; // use canonical URL as the job key
  } catch {}

  // Fallback: title+company+activeId OR pathname hashed (stable enough per flow)
  //const u = new URL(window.location.href);
  const u = safeURL(window.location.href);
  const activeId = getActiveCardId();
  const title = (findJobTitleEl()?.textContent || '').trim();
  const company = (getCompanyName() || '').trim();
  const raw = [u.hostname, activeId || u.pathname, title, company].filter(Boolean).join(' | ');
  return raw || u.origin + u.pathname;
}

// ---- Canonical scoring (40/30/30) ----
function canonicalScore({ hasApply, hasTCL, hasJD }) {
  const w = { apply: 0.4, tcl: 0.3, jd: 0.3 };
  let s = 0;
  if (hasApply) s += w.apply;
  if (hasTCL) s += w.tcl;
  if (hasJD) s += w.jd;
  return s;
}
function hasTitleCompanyLocation() {
  const t = (findJobTitleEl()?.textContent || '').trim();
  const c = (getCompanyName() || '').trim();
  const l = (getLocationText() || '').trim();
  return !!(t && c && l);
}
// ---- Journey: freeze canonical snapshot when Apply/Interested is clicked
(function initApplyClickMonitor(){
  const APPLY_RX = /(apply|i['’]?\s*m\s+interested|begin application|start application)/i;
  document.addEventListener('click', async (e) => {
    const el = e.target?.closest('a,button,input[type=submit]'); if (!el) return;
    const label = (el.textContent || el.value || '').trim();
    if (!APPLY_RX.test(label)) return;

    try {
      const hasApply = true;
      const hasTCL = hasTitleCompanyLocation();
      const { text: jdText } = await getJobDescriptionText();
      const hasJD = !!(jdText && jdText.length > 120);
      const score = canonicalScore({ hasApply, hasTCL, hasJD });

      const snapshot = {
        title: getJobTitleStrict(),
        company: getCompanyName(),
        location: getLocationText(),
        logoUrl: getCompanyLogoUrl(),
        url: location.href,
        score
      };
      chrome.runtime.sendMessage({ action: 'journeyStart', snapshot });
      // Tell bg to lock first_canonical to the very first detail page
      try { chrome.runtime.sendMessage({ action: 'noteFirstJobUrl', url: location.href }); } catch {}
    } catch {}
  }, { capture: true, passive: true });
})();

const bindPageToJourney = debounce(async () => {
  try {
    const hasApply = hasApplySignals();
    const hasTCL = hasTitleCompanyLocation();
    const { text: jdText } = await getJobDescriptionText();
    const score = canonicalScore({ hasApply, hasTCL, hasJD: !!(jdText && jdText.length > 120) });
    chrome.runtime.sendMessage({ action: 'journeyBindCanonical', canonical: location.href, host: location.hostname, score });
  } catch {}
}, 250);
//The bindPageToJourney function is triggered by three different event listeners
window.addEventListener('load', bindPageToJourney, { once: true }); // when full page loads
window.addEventListener('popstate', bindPageToJourney, { passive: true }); // chrome forward and back arrows
window.addEventListener('hashchange', bindPageToJourney, { passive: true }); // In url, when the text after # is changed.

/* =========================
   7) Scan loop (ties together job page detection + icon UI + JD send)
   ========================= */

async function scan() {
  //console.log('scan function intitated');
  // Don’t waste work in background tabs
  if (document.visibilityState !== 'visible') return;
  // Early cleanup if hard-blocked (e.g., ChatGPT)
  if (isHardBlockedHost()) {
    removeIcon(); 
    removeBanner();
    jobApplicationDetected = false;
    currentJobKey = ""; lastJDHash = ""; lastActiveLIMeta = null;
    return;
  }
  const det = await detectJobPage();
  // Telemetry for QA
  //try { chrome.runtime.sendMessage({ action: 'jobDetection', detection: det, url: location.href }); } catch {}
  if (!det.ok) {
    removeIcon(); 
    removeBanner();
    jobApplicationDetected = false;
    currentJobKey = ""; lastJDHash = ""; lastActiveLIMeta = null;
    return;
  }
  const newKey = await computeStableJobKey();
  if (newKey && newKey !== currentJobKey) {
    currentJobKey = newKey;
    lastJDHash = ""; matchedWords = []; allSkills = [];
    removeBanner();
  }

  if (det.allowUI && !jobApplicationDetected) {
    showIcon(); 
    jobApplicationDetected = true;

  }
  if (!det.allowUI) { removeIcon(); }

  expandLinkedInDescription();

  // Push sticky job context for popup or background
  if (isLinkedInHost()) {
    const liMeta = getLinkedInActiveCardMeta();
    if (liMeta && (liMeta.title || liMeta.company)) {
      chrome.runtime.sendMessage({ action: 'liActiveJobCard', jobKey: currentJobKey, meta: liMeta });
      pushJobContext({ ...liMeta, jobKey: currentJobKey }, { confidence: det.tier === 'high' ? 1.0 : 0.7 });
    }
  } 
  else {
    // Prefer active card meta from company/ATS list if present; fall back to page-level
    bindGenericListClicks();
    const generic = getGenericActiveCardMeta();
    if (generic && (generic.title || generic.company)) {
      lastActiveGenericMeta = generic;
      pushJobContext({ ...generic, jobKey: currentJobKey }, { confidence: det.tier === 'high' ? 1.0 : 0.7 });
    } 
    else {
      const meta = {
        title: getJobTitleStrict(),
        company: getCompanyName(),
        location: getLocationText(),
        logoUrl: getCompanyLogoUrl(),
        url: location.href,
        jobKey: currentJobKey
      };
      pushJobContext(meta, { confidence: det.tier === 'high' ? 1.0 : 0.7 });
    }
  }

    // 1B) HARD GUARD: only allow JD on real job pages
  // Only parse where we intend to (ATS iframe when present; else fallback top)
  if (!ROLE_PARSE) return { text: "", anchor: null, source: "none" };
  // early bailout in top window
  if (IS_TOP_WINDOW && pageHasAtsIframe()) {
    //console.log('[JD] ATS iframe detected — skip JD scan in top window')
    //console.log('[CS] frame?', window.top === window.self ? 'top' : 'iframe', location.href);
    return { text: "", anchor: null, source: "skipped_ats_iframe" };
    // you can set a flag so the rest of your script short-circuits
    //window.__JOB_AID_SKIP_JD__ = true;
  }
  // Extract JD (Schema → DOM → Fallback) — guarded in getJobDescriptionText()
  if(ROLE_PARSE){
    //console.log('Role parse in scan function sending jd');
    const urlKey = location.href.split('#')[0];
    //console.log('filljdurl in scan funtion:',_didFullJDForUrl);
    //console.log('URL key in scan funtion:',urlKey);
    if (!_didFullJDForUrl.has(urlKey)) {    
      const { text, anchor, source } = await getJobDescriptionText();
      if (text && text.length > 120) {
        _didFullJDForUrl.add(urlKey);
        jdAnchorEl = anchor || null;
        const h = hash(text);
        if (h !== lastJDHash) {
          lastJDHash = h;
          chrome.runtime.sendMessage({ action: "jdText", text, jobKey: currentJobKey, source, tier: det.tier });
        }
      }
    }

  }

}

async function pushJobContext(meta, { confidence = 0.8 } = {}) {
  try {
    const resp = await new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: 'canonicalizeUrl', url: location.href }, resolve);
    });
    const canonical = resp?.canonical || location.href;
    await new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: 'updateJobContext', canonical, meta, confidence }, resolve);
    });
  } catch {}
}

/* =========================
   7a) SINGLE debounced detection runner (strict gate) — (1A)
   ========================= */

// Unified detection gate ensures we only work on true job pages

// Non-debounced core logic
async function runDetectionNow() {
  try {
    const det = await detectJobPage();

    // Strict UI gate
    if (!det.allowUI || (det.tier !== 'medium' && det.tier !== 'high')) {
      jobApplicationDetected = false;
      removeIcon();
      removeBanner();
      // reset so popup doesn't show stale info
      currentJobKey = ""; lastJDHash = ""; lastActiveLIMeta = null;
      return;
    }

    // Real job page → run full scan pipeline
    //jobApplicationDetected = true;
    await scan();
  } catch {}
}

// Debounced wrapper for observers / mutations
const runDetection = debounce(runDetectionNow, 350);


/* =========================
   7b) Init / Observers (using the single gate)
   ========================= */

// Initial kick
runDetection();

// Watch SPA URL/state changes
(function patchHistory() {

  const p = history.pushState, r = history.replaceState;
  //push used to add new job tab url, replace replaces the existing job url( changes)
  history.pushState = function(){ const x = p.apply(this, arguments); runDetection(); return x; };
  history.replaceState = function(){ const x = r.apply(this, arguments); runDetection(); return x; };
  window.addEventListener('popstate', runDetection, {passive:true});
  window.addEventListener('hashchange', runDetection, {passive:true});
})();

// Observe DOM (single debounced runner)
new MutationObserver(() => runDetection()).observe(document, { childList: true, subtree: true });
// Refresh detection when keyboard focus moves inside the list (important for ATS panes)
document.addEventListener('focusin', () => runDetection(), { capture: true, passive: true });
// Optional: in heavy two-pane lists, the visible/center card changes on scroll
window.addEventListener('scroll', () => runDetection(), { passive: true });


// Keep fresh when tab becomes visible / on load
window.addEventListener('load', runDetection);
document.addEventListener('visibilitychange', () => { if (!document.hidden) runDetection(); });

/* =========================
   8) Messaging API
   ========================= */

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  /*if (request.action === 'forceScanNow') {
    (async () => { try{await runDetectionNow(); sendResponse?.({ ok: true, jobKey: currentJobKey, url: location.href });} catch(e){sendResponse?.({ ok: false, error: String(e?.message || e), url: location.href });}})();
    return true;
  }*/
  
  if (request.action === 'getDetectionState') {
    // on-demand quick read (re-run a lightweight detect without side-effects)
    (async () => {
      try {
          const det = await detectJobPage();
          sendResponse?.(det);
        } catch (e) {
          sendResponse?.({ ok: false, error: String(e?.message || e) });
        }
      })().catch(e => {
        // Final safety so Chrome never complains about the channel
        sendResponse?.({ ok: false, error: String(e?.message || e) });
    });
    return true;
  }
  if (request.action === 'hasJD') {
    (async () => {
      const { text } = await getJobDescriptionText();
      sendResponse({ ok: !!(text && text.length > 120) });
    })();
    return true;
  }
  if (request.action === 'getCanonicalScore') {
    (async () => {
      const hasApply = hasApplySignals();
      const hasTCL = hasTitleCompanyLocation();
      const { text: jdText } = await getJobDescriptionText();
      const score = canonicalScore({ hasApply, hasTCL, hasJD: !!(jdText && jdText.length > 120) });
      sendResponse({
        score,
        title: getJobTitleStrict(),
        company: getCompanyName(),
        location: getLocationText(),
        logoUrl: getCompanyLogoUrl(),
        url: location.href
      });
    })();
    return true;
  }

  if (request.action === 'displayPercentage' && typeof request.percentage === 'number') {
    matchedWords = request.matchedWords || [];
    percentage = request.percentage || 0;
    if (Array.isArray(request.allSkills)) allSkills = request.allSkills;
    // Only render banner if we’re on a MEDIUM/HIGH page (icon present implies allowUI)
    //if (!document.getElementById('jobAidIcon')) return true;
    // IMPORTANT: never return true without responding
    //console.log('1. In contentscript.js getskillmatchstate percentage,matchedwords and allskills:',percentage,matchedWords,allSkills);
    if (!document.getElementById('jobAidIcon')) {
      sendResponse?.({ status: 'no_ui' }); // <— respond
      return; // sync
    }
    displayMatchingPerecentage(percentage, matchedWords);
    sendResponse?.({ status: 'success' });
    return; // true;
  }
  /*
  if (request.action === 'openSkillsPanel') {
    if (jdAnchorEl) {
      sendResponse?.({ ok: true, where: 'jd' });
      console.log('jd anchor:',jdAnchorEl);
      jdAnchorEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      jdAnchorEl.style.transition = 'box-shadow 0.6s ease';
      const prev = jdAnchorEl.style.boxShadow;
      jdAnchorEl.style.boxShadow = '0 0 0 3px rgba(5, 80, 243, 0.35)';
      setTimeout(() => { jdAnchorEl.style.boxShadow = prev || 'none'; }, 1500);
      return true; //true;
    }
    const host = document.getElementById('jobAidSkillBannerHost');
    if (host) { host.scrollIntoView({ behavior: 'smooth', block: 'center' }); sendResponse?.({ ok: true, where: 'banner' }); }
    else { sendResponse?.({ ok: false, reason: 'no_anchor' }); }
    return true;// true;
  }
  */
  if (request.action === 'openSkillsPanel'){
    if (jdAnchorEl) {
      // 1) Reply immediately so popup sees ok:true.
      sendResponse?.({ ok: true, where: 'jd' });
      // 2) Do the visual work asynchronously.
      setTimeout(() => {
        try {
          jdAnchorEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
          jdAnchorEl.style.transition = 'box-shadow 0.6s ease';
          const prev = jdAnchorEl.style.boxShadow;
          jdAnchorEl.style.boxShadow = '0 0 0 3px rgba(235, 37, 37, 0.35)';
          setTimeout(() => { jdAnchorEl.style.boxShadow = prev || 'none'; }, 1500);
        } catch {}
      }, 0);
      return true; // keep port open while we run the async side effect (safe, even though we already replied)
    } 
    const host = document.getElementById('jobAidSkillBannerHost');
    if (host) {
      sendResponse?.({ ok: true, where: 'banner' });
      setTimeout(() => {
        try { host.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch {}
      }, 0);
      return true;
    }
    // This is the failure path.
    //console.error('openSkillsPanel failed: No anchor or host element found.'); // 💡 ADD THIS LOGGING
    sendResponse?.({ ok: false, reason: 'no_anchor' });
    return; // synchronous no-op is fine her
  }
  
  if (request.action === 'getSkillMatchState') {
    waitForDomStable({ timeoutMs: 2500, quietMs: 180 });
    const meta = { url: location.href, title: getJobTitleStrict(), company: getCompanyName(), location: getLocationText(), logoUrl: getCompanyLogoUrl() };
    //console.log('2. In contentscript.js getskillmatchstate percentage,matchedwords and allskills:',percentage,matchedWords,allSkills);
    sendResponse?.({ percentage, matchedWords, allSkills, meta, jobKey: currentJobKey });
    return;// true;
  }

  if (request.action === 'getActiveLinkedInMeta') {
    const fresh = isLinkedInHost() ? (getLinkedInActiveCardMeta() || lastActiveLIMeta) : null;
    sendResponse?.(fresh || null);
    return;// true;
  }
  if (request.action === 'getActiveCompanyMeta') {
    const fresh = (!isLinkedInHost()) ? (getGenericActiveCardMeta() || lastActiveGenericMeta) : null;
    sendResponse?.(fresh || null);
    return;// true;
  }

  if (request.action === 'hasFillableForm') {
    sendResponse({ ok: !!document.querySelector('input,select,textarea') });
    return;// true;
  }
  if (request.action === 'showCanonicalChooser') {
    // placeholder; you can render an overlay later
    sendResponse?.({ ok: true });
    return;// true;
  }
});
/***********************************************
 * contentscript.js — Autofill re-entry watcher
 * Injects autofill.bundle.js on refresh if a
 * pending resume upload was in progress.
 ***********************************************/
(function(){
  const SET1_HOSTS = new Set(['icims.com']);
  const PENDING_KEY    = 'ja_resume_pending_v1';
  const REENTRY_FLAG   = '__JA_AUTOFILL_REENTRY_IN_PROGRESS__';
  const INJECTED_ID    = 'autofill-script';
  const BUNDLE_PATH    = 'autofill.bundle.js';
  const REENTRY_TTL_MS = 60 * 1000;

  // ---- helpers (top-like host/page so iframes work) ----
  function topLikeHost() {
    try {
      if (window.top === window) return (location.hostname || '').toLowerCase();
      return window.top.location.hostname.toLowerCase(); // throws if cross-origin
    } catch {
      try { if (document.referrer) return new URL(document.referrer).hostname.toLowerCase(); } catch {}
      return (location.hostname || '').toLowerCase();
    }
  }
  function topLikePageKey() {
    try {
      if (window.top === window) return `${location.origin}${location.pathname}`;
      const o = window.top.location; return `${o.origin}${o.pathname}`;
    } catch {
      try { if (document.referrer) { const u = new URL(document.referrer); return `${u.origin}${u.pathname}`; } } catch {}
      return `${location.origin}${location.pathname}`;
    }
  }
  function hostInHost(set, host) {
    const h = (host || '').toLowerCase();
    for (const d of set) if (h === d || h.endsWith(`.${d}`)) return true;
    return false;
  }
  const IS_SET1_TOP = hostInHost(SET1_HOSTS, topLikeHost());
  if (!IS_SET1_TOP) return;

  function hasRealInputs(){ return !!document.querySelector('input,select,textarea'); }

  function waitForPageSettle({ urlQuietMs=800, domQuietMs=600, timeoutMs=8000 } = {}) {
    const startUrl = location.href;
    let lastChange = performance.now();
    const mo = new MutationObserver(()=>{ lastChange = performance.now(); });
    try { mo.observe(document.documentElement, { childList:true, subtree:true, attributes:true }); } catch {}
    const t0 = performance.now();
    return new Promise(resolve=>{
      const timer = setInterval(()=>{
        const now = performance.now();
        const urlChanged = location.href !== startUrl;
        const domIdle = (now - lastChange) >= domQuietMs;
        const urlIdle = urlChanged ? ((now - lastChange) >= urlQuietMs) : true;
        if ((domIdle && urlIdle) || (now - t0) > timeoutMs) {
          clearInterval(timer); try { mo.disconnect(); } catch {}
          requestAnimationFrame(resolve);
        }
      },120);
    });
  }

  // ---- talk to service worker session helpers ----
  async function sessionGet(key) {
    const res = await chrome.runtime.sendMessage({ type: 'SESSION_GET', payload: key });
    return res?.ok ? (res.data?.[key] ?? null) : null;
  }
  async function sessionRemove(key) {
    await chrome.runtime.sendMessage({ type: 'SESSION_REMOVE', payload: key });
  }

  function looselyMatchesPage(pendingPage, currentTopLikePage) {
    if (!pendingPage || !currentTopLikePage) return false;
    if (pendingPage === currentTopLikePage) return true;
    try {
      const p = new URL(pendingPage), c = new URL(currentTopLikePage);
      if (p.origin !== c.origin) return false;
      const pp = p.pathname.split('/').slice(0,3).join('/');
      const cp = c.pathname.split('/').slice(0,3).join('/');
      return pp === cp;
    } catch { return false; }
  }

  async function maybeReenterAutofill(){
    console.log('[reentry] 1. start (topLikeHost=%s, frameHost=%s)', topLikeHost(), (location.hostname||''));
    if (!hasRealInputs()) { console.log('[reentry] no inputs in this frame; skipping'); return; }
    if (window[REENTRY_FLAG]) { console.log('[reentry] flag set; skipping'); return; }
    window[REENTRY_FLAG] = true;

    console.log('[reentry] 2. host ok & executor frame chosen');

    const pending = await sessionGet(PENDING_KEY);
    if (!pending) { console.log('[reentry] no pending key in session; abort'); return; }
    console.log('[reentry] 3. pending found:', pending);

    const topKey = topLikePageKey();
    if (!looselyMatchesPage(pending.page, topKey)) {
      console.log('[reentry] 4. page mismatch; pending=%s currentTop=%s', pending.page, topKey);
      return;
    }
    console.log('[reentry] 4. page ok');

    if ((Date.now() - pending.t) > REENTRY_TTL_MS) { console.log('[reentry] 5. ttl expired'); return; }
    console.log('[reentry] 5. ttl ok');

    const { autofillData } = await new Promise(r => chrome.storage.local.get('autofillData', r));
    if (!autofillData) { console.log('[reentry] 6. no autofillData; abort'); return; }
    console.log('[reentry] 6. have autofillData');

    await waitForPageSettle();

    const url = chrome.runtime.getURL(BUNDLE_PATH);

    const callInit = async () => {
      try {
        const mod = await import(url);
        if (mod?.autofillInit) {
          console.log('[reentry] 8. calling autofillInit');
          //await mod.autofillInit(autofillData, null);
          await mod.autofillInit(autofillData, { reentry: true });
          // clear pending once we successfully re-enter
          await sessionRemove(PENDING_KEY);
        } else {
          console.error('[reentry] autofillInit export not found');
        }
      } catch (e) { console.error('[reentry] import/module failed', e); }
    };

    if (document.getElementById(INJECTED_ID)) {
      console.log('[reentry] 7a. bundle already injected');
      await callInit();
      return;
    }

    console.log('[reentry] 7b. injecting bundle');
    const script = document.createElement('script');
    script.type = 'module';
    script.src = url;
    script.id = INJECTED_ID;
    script.onload = callInit;
    script.onerror = () => console.error('[reentry] failed to load bundle:', url);
    document.documentElement.appendChild(script);
  }

  maybeReenterAutofill();
})();
