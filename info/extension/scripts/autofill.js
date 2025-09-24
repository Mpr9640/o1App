// Works with text/number/date/email/tel/password/textarea/contenteditable/select/checkbox/radio/file
// Handles React/MUI/AntD/React-Select comboboxes, drag-n-drop dropzones, shadow DOM inputs, and same-origin iframes.

// ====== Config ======
const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const DEBUG = true; // flip to false to quiet logs

// ====== Styles ======
const style = document.createElement('style');
style.textContent = `
  .autofill-highlight{ outline:2px solid gold !important; transition: outline .3s ease-out; }
  .autofill-drop-indicator{ outline:2px dashed #8aa; }
`;
document.head.appendChild(style);

// ====== Utils ======
const log = (...a)=>DEBUG&&console.log('[autofill]', ...a);
const delay = (ms)=>new Promise(r=>setTimeout(r,ms));

const fieldNameCache = new WeakMap();
const groupCache = new WeakMap();

function normalizeFieldName(s){
  return (s||'').toString().toLowerCase().replace(/\s/g,'').replace(/[^a-z0-9]/g,'').trim();
}
function normalizeFieldNameWithSpace(s){
  return (s||'').toString().toLowerCase()
    .replace(/[^a-z0-9\s]/gi,'')
    .replace(/([a-z]([A-Z]))/g,'$1 $2')
    .replace(/\s+/g, ' ')
    .trim();
}
function isVisible(el){
  if (!el || !el.getBoundingClientRect) return false;
  const r = el.getBoundingClientRect();
  const style = window.getComputedStyle(el);
  return r.width > 0 && r.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
}
function simulateMouseMove(el){
  try{
    const r = el.getBoundingClientRect();
    const x = r.left + (Math.random()*Math.max(1, r.width));
    const y = r.top  + (Math.random()*Math.max(1, r.height));
    el.dispatchEvent(new MouseEvent('mousemove',{clientX:x,clientY:y,bubbles:true}));
  }catch{}
}
function formatDate(val){
  try{
    const d = new Date(val);
    if (isNaN(+d)) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,'0');
    const day = String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${day}`;
  }catch{ return ''; }
}

// ===== Workday detection =====
function isWorkdaySite() {
  return /(^|\.)myworkdayjobs\.com$/i.test(location.hostname) || /\.wd\d+\.myworkdayjobs\.com$/i.test(location.hostname);
}

// ===== Resume/Network/DOM Quiet =====
const RESUME_PARSE_TIMEOUT_MS = 20000;
const DOM_QUIET_MS = 600;

let parseHookInstalled = false;
let pendingParseCalls = 0;
let lastDomChangeAt = Date.now();
let resumeUploadHappened = false;

const PARSE_HINT_RX = /(resume|cv|parse|autofill|extract|profile-extract|doc-parse|attachment)/i;

const _domQuietObserver = new MutationObserver(() => { lastDomChangeAt = Date.now(); });
_domQuietObserver.observe(document.documentElement, { childList: true, subtree: true, attributes: true });

function isParsingSpinnerActive() {
  return !!document.querySelector(
    '[aria-busy="true"], [role="status"], .loading, .spinner, .progress, .MuiCircularProgress-root, .ant-spin-spinning'
  );
}
function installParseHooksOnce() {
  if (parseHookInstalled) return;
  parseHookInstalled = true;
  log('Installing parse/network hooks');

  const _fetch = window.fetch;
  window.fetch = async function(input, init) {
    const url = typeof input === 'string' ? input : (input?.url || '');
    const tracked = PARSE_HINT_RX.test(url);
    if (tracked) pendingParseCalls++;
    try {
      const res = await _fetch.apply(this, arguments);
      if (tracked) res.clone().text().finally(() => setTimeout(() => pendingParseCalls = Math.max(0, pendingParseCalls - 1), 0));
      return res;
    } catch (e) {
      if (tracked) setTimeout(() => pendingParseCalls = Math.max(0, pendingParseCalls - 1), 0);
      throw e;
    }
  };

  const _open = XMLHttpRequest.prototype.open;
  const _send = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function(method, url) {
    this.__isParse = PARSE_HINT_RX.test(url || '');
    return _open.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send = function() {
    if (this.__isParse) pendingParseCalls++;
    this.addEventListener('loadend', () => {
      if (this.__isParse) setTimeout(() => pendingParseCalls = Math.max(0, pendingParseCalls - 1), 0);
    });
    return _send.apply(this, arguments);
  };
}
async function waitForResumeParseToFinish(timeoutMs = RESUME_PARSE_TIMEOUT_MS) {
  installParseHooksOnce();
  log('Waiting for resume parse to finish...');
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const netIdle  = pendingParseCalls === 0;
    const domQuiet = (Date.now() - lastDomChangeAt) >= DOM_QUIET_MS;
    const noSpin   = !isParsingSpinnerActive();
    if (netIdle && domQuiet && noSpin) {
      log('Resume parse finished (idle/quiet/no spinner)');
      return true;
    }
    await delay(120);
  }
  log('Resume parse wait timed out (continuing)');
  return false;
}
async function waitForUiUpdates(totalTimeout = 4000, minQuiet = DOM_QUIET_MS) {
  const start = Date.now();
  log('Waiting for UI updates to settle...');
  while (Date.now() - start < totalTimeout) {
    const domQuiet = (Date.now() - lastDomChangeAt) >= minQuiet;
    const noSpin   = !isParsingSpinnerActive();
    if (domQuiet && noSpin) {
      log('UI settled (quiet/no spinner)');
      return true;
    }
    await delay(120);
  }
  log('UI settle wait timed out');
  return false;
}

// ===== Labels / Nearby text =====
function nearestTextAround(el, px=220){
  const rectEl = el.getBoundingClientRect();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
  let nearest = '', best = Infinity;
  while(walker.nextNode()){
    const n = walker.currentNode;
    if(!n.parentElement) continue;
    const txt = (n.textContent||'').trim();
    if(!txt) continue;
    const r = n.parentElement.getBoundingClientRect?.(); if(!r) continue;
    const cx = r.left + r.width/2, cy = r.top + r.height/2;
    const dx = cx - (rectEl.left + rectEl.width/2);
    const dy = cy - (rectEl.top + rectEl.height/2);
    const dist = Math.hypot(dx,dy);
    if(dist < px && dist < best){ best = dist; nearest = txt; }
  }
  return normalizeFieldNameWithSpace(nearest);
}

function inputFieldSelection(field){
  if(!field) return '';
  if(fieldNameCache.has(field)) return fieldNameCache.get(field);

  const clean = (s)=>{
    if(!s) return '';
    let t = s.trim();
    if(field.value) t = t.replace(field.value,'').trim();
    if(field.placeholder) t = t.replace(field.placeholder,'').trim();
    return normalizeFieldNameWithSpace(t);
  };

  const inFieldset = ()=>{
    const fs = field.closest('fieldset');
    if(!fs) return '';
    const legend = fs.querySelector('legend');
    if(legend?.textContent) return clean(legend.textContent);
    const lab = fs.querySelector(':scope > label');
    if(lab?.textContent) return clean(lab.textContent);
    return '';
  };
  const labelAssoc = ()=>{
    if (field.id){
      const lab = document.querySelector(`label[for="${CSS.escape(field.id)}"]`);
      if (lab?.textContent) return clean(lab.textContent);
    }
    let el=field;
    while(el && el!==document.body){
      if(el.tagName==='LABEL') return clean(el.textContent);
      if(el.parentNode?.tagName==='LABEL') return clean(el.parentNode.textContent);
      let prev = el.previousElementSibling;
      while(prev){
        if(prev.tagName==='LABEL') return clean(prev.textContent);
        prev = prev.previousElementSibling;
      }
      el=el.parentNode;
    }
    return '';
  };
  const ariaLabels = ()=>{
    if(field.hasAttribute('aria-label')) return clean(field.getAttribute('aria-label'));
    if(field.hasAttribute('aria-labelledby')){
      const ids = field.getAttribute('aria-labelledby').split(/\s+/);
      const txt = ids.map(id => document.getElementById(id)?.textContent || '').join(' ');
      if (txt.trim()) return clean(txt);
    }
    return '';
  };
  const inContainers = ()=>{
    let el=field;
    while(el && el!==document.body){
      const p = el.parentNode;
      if(p && ['DIV','SECTION','SPAN','TD','TH','LI','P'].includes(p.tagName)){
        const txt = (p.textContent||'').trim();
        if(txt) return clean(txt);
      }
      let prev = el.previousElementSibling;
      while(prev){
        if(['DIV','SECTION','SPAN','TD','TH','LI','P'].includes(prev.tagName) && prev.textContent?.trim()){
          return clean(prev.textContent);
        }
        prev = prev.previousElementSibling;
      }
      el = el.parentNode;
    }
    return '';
  };

  let name = '';
  if(['checkbox','radio'].includes((field.type||'').toLowerCase())) name = inFieldset() || labelAssoc() || inContainers();
  if(!name) name = labelAssoc();
  if(!name) name = ariaLabels();
  if(!name && field.name) name = clean(field.name);
  if(!name && field.title) name = clean(field.title);
  if(!name) name = inFieldset() || inContainers();
  if(!name && field.placeholder) name = clean(field.placeholder);
  if(!name) name = nearestTextAround(field);

  fieldNameCache.set(field,name||'');
  return name||'';
}

// ===== Section prefixes (safer) =====
const sectionRules = [
  { rx: /(contact|personal).*info|address/i, prefix: 'residence', weight: 3 },
  { rx: /(home|current|residential).*address/i, prefix: 'residence', weight: 3 },
  { rx: /(education|school|university|college)/i, prefix: 'school', weight: 3 },
  { rx: /(experience|employment|work|job)/i, prefix: 'job', weight: 3 },
  { rx: /(company|employer)/i, prefix: 'job', weight: 2 },
];
function getSectionPrefix(input){
  let cur = input;
  let best = { prefix: 'residence', weight: 0 };
  while(cur && cur!==document.body){
    const wrap = cur.closest('fieldset,section,div,span,form');
    if(wrap){
      const title = wrap.querySelector('legend,h1,h2,h3,[data-automation-id],.section-title,.title,label');
      const txt = (title?.textContent || title?.getAttribute?.('data-automation-id') || '').toLowerCase();
      for (const r of sectionRules){
        if (r.rx.test(txt) && r.weight > best.weight) best = { prefix: r.prefix, weight: r.weight };
      }
    }
    cur = cur.parentElement;
  }
  return best.prefix;
}

// ===== Mappings =====
const fieldMappings = [
  {keywords:[/company|employer/], dataKey:'companyname'},
  {keywords:[/email/], dataKey:'email', type:'text'},
  {keywords:[/first.*name/], dataKey:'firstname', type:'text'},
  {keywords:[/middle.*name/], dataKey:'middlename', type:'text'},
  {keywords:[/last.*name/], dataKey:'lastname', type:'text'},
  {keywords:[/(country.+code)|(phone.+code)/], dataKey:'residencountry', type:'code', handleCountryCode:true},
  {keywords:[/(phone|mobile|telephone)/], dataKey:'phonenumber', type:'text', handleCountryCode:true},
  {keywords:[/date.*of.*birth/], dataKey:'dateofbirth', type:'date'},
  {keywords:[/linkedin/], dataKey:'linkedin', type:'text'},
  {keywords:[/github/], dataKey:'github', type:'text'},
  {keywords:[/resume|cv/], dataKey:'resume', type:'file'},
  {keywords:[/race|ethnicity/], dataKey:'race', type:'radio'},
  {keywords:[/degree/], dataKey:'degree', type:'text'},
  {keywords:[/major/], dataKey:'major', type:'text'},
  {keywords:[/school.*name|college.*name|university.*name/], dataKey:'school', type:'text'},
  {keywords:[/start.*date/], dataKey:'startdate', type:'date'},
  {keywords:[/end.*date/], dataKey:'enddate', type:'date'},
  {keywords:[/cgpa/], dataKey:'cgpa', type:'text'},
  {keywords:[/skills/], dataKey:'skills', type:'textarea'},
  {keywords:[/job.*title|job.*name/], dataKey:'jobname', type:'text'},
  {keywords:[/(duties|responsibilities|description)/], dataKey:'jobduties', type:'textarea'},
  {keywords:[/currently.*working/], dataKey:'currentlyworking', type:'checkbox'},
  {keywords:[/currently.*studying/], dataKey:'currentlystudying', type:'checkbox'},
  {keywords:[/sponsor|spsor/], dataKey:'needsponsorship', type:'checkbox'},
  {keywords:[/veteran|military/], dataKey:'veteran', type:'checkbox'},
  {keywords:[/disability|disable/], dataKey:'disability', type:'checkbox'},
  {keywords:[/gender/], dataKey:'gender', type:'radio'},
  {keywords:[/address|city|town|zip|postal|location|locat|state|country/], dataKey:'dummy', type:'address'},
  {keywords:[/name|fullname/], dataKey:'fullname', type:'text'},
];

// ===== Radio/Checkbox labels =====
function findAssociatedLabel(input){
  if (input.id){
    const byFor = document.querySelector(`label[for="${CSS.escape(input.id)}"]`);
    if (byFor) return byFor.textContent.trim();
  }
  const aria = input.getAttribute('aria-labelledby');
  if (aria){
    const txt = aria.split(/\s+/).map(id => document.getElementById(id)?.textContent || '').join(' ').trim();
    if (txt) return txt;
  }
  if (input.getAttribute('aria-label')) return input.getAttribute('aria-label');

  const c = input.closest('div, span, label, li, tr, td, th, p');
  if(c){
    const direct = c.querySelector('label,button,[role="button"]');
    if(direct?.textContent) return direct.textContent.trim();
    const sibs = [...c.parentElement?.children || []].filter(x=>x.tagName?.toLowerCase()==='label');
    if(sibs.length) return sibs[0].textContent.trim();
  }
  return nearestTextAround(input);
}

// ===== Booleans / Options =====
const BOOL_TRUE = new Set(['yes','y','true','t','1','accept','agree','iagree','optin','on','currentlyworking','currentlystudying']);
const BOOL_FALSE = new Set(['no','n','false','f','0','decline','disagree','i do not agree','optout','off','notcurrentlyworking','notcurrentlystudying']);

function normalizeOptionText(text) {
  return (text||'').split('-')[0].replace(/\(.*?\)/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
}
function normalizeToBooleanLike(v){
  const s = normalizeOptionText(String(v));
  if (BOOL_TRUE.has(s)) return 'yes';
  if (BOOL_FALSE.has(s)) return 'no';
  return s;
}
// --- NEW: read current visible text/value for a combobox-like input
function readComboText(input){
  const t = resolveTypingTarget(input);
  const v = (t && ('value' in t)) ? (t.value || '') : (t?.textContent || '');
  return normalizeFieldNameWithSpace(v || '');
}

// --- NEW: commit a Workday selection like a real user
async function commitWorkdaySelection(input){
  const t = resolveTypingTarget(input);
  if (!t) return;
  // Press Enter to accept the highlighted option
  t.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));
  t.dispatchEvent(new KeyboardEvent('keyup',{key:'Enter',bubbles:true,cancelable:true}));
  await delay(80);
  // Close the popup (Escape), then give WD time to propagate state
  t.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));
  t.dispatchEvent(new KeyboardEvent('keyup',{key:'Escape',bubbles:true,cancelable:true}));
  await waitForUiUpdates(2500, 250);
}

// --- NEW: verify selection stuck; if not, retry via keyboard navigation
async function verifyAndCommitDropdown(input, expectedNorm){
  const after = readComboText(input);
  if (after && (after === expectedNorm || after.includes(expectedNorm))) return true;

  // Retry once via keyboard: open, ArrowDown, Enter
  input.click();
  await delay(120);
  const t = resolveTypingTarget(input);
  if (t){
    t.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true,cancelable:true}));
    t.dispatchEvent(new KeyboardEvent('keyup',{key:'ArrowDown',bubbles:true,cancelable:true}));
    t.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));
    t.dispatchEvent(new KeyboardEvent('keyup',{key:'Enter',bubbles:true,cancelable:true}));
  }
  await waitForUiUpdates(2500, 250);

  const finalV = readComboText(input);
  return !!finalV;
}

// ===== Dropdown / Autocomplete =====
function isComplexDropdown(el){
  const hasPopup = (el.getAttribute && el.getAttribute('aria-haspopup')?.toLowerCase()==='listbox') || false;
  const sibBtn = !!el.parentElement?.querySelector?.('button[aria-haspopup="listbox"]');
  const sibSpan = !!el.nextElementSibling?.matches?.('span[aria-haspopup="listbox"]');
  return el.getAttribute?.('role')==='combobox'
      || el.classList?.contains?.('autocomplete')
      || !!el.closest?.('.dropdown-menu,.MuiAutocomplete-root,.MuiSelect-root,.ant-select,.Select')
      || (el.placeholder||'').toLowerCase().match?.(/search|select/)
      || hasPopup || sibBtn || sibSpan;
}
function isMultiSelectLike(el){
  if (el.tagName?.toUpperCase() === 'SELECT' && el.multiple) return true;
  if (el.closest?.('.ant-select-multiple')) return true;
  if (el.closest?.('.MuiAutocomplete-root')?.className?.includes('MuiAutocomplete-multiple')) return true;
  if (el.closest?.('.Select--multi')) return true; // react-select classic
  const lb = el.getAttribute?.('aria-controls') ? document.getElementById(el.getAttribute('aria-controls')) : null;
  if (lb && lb.getAttribute('aria-multiselectable') === 'true') return true;
  return false;
}
function splitMultiValues(raw){
  if (Array.isArray(raw)) return raw.map(v=>String(v)).filter(Boolean);
  return String(raw||'').split(/[,;|]/g).map(s => s.trim()).filter(Boolean);
}
function resolveTypingTarget(el) {
  if (!el) return null;
  if (el.tagName === 'INPUT' || el.isContentEditable) return el;
  el.click();
  const scope = el.closest?.('[role="combobox"], .MuiAutocomplete-root, .ant-select, .Select, .dropdown, .wd-TextInput') || document;
  const target = scope.querySelector?.('input:not([type="hidden"]):not([disabled])') || document.activeElement;
  return (target && (target.tagName === 'INPUT' || target.isContentEditable)) ? target : el;
}
async function typeToInput(input, value){
  const t = resolveTypingTarget(input);
  if (!t) { input.click(); await delay(60); return; }

  t.focus(); t.click();
  await delay(50);

  // Clear existing text but do NOT fire 'change' yet (Workday can crash on early change)
  if ('value' in t) {
    t.value = '';
    t.dispatchEvent(new Event('input', { bubbles: true })); // input only
  }
  await delay(40);
}

/*async function typeToInput(input, value){
  const target = resolveTypingTarget(input);
  target.focus(); target.click();
  await delay(40);
  try {
    const proto = target instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype
                : target instanceof HTMLInputElement ? HTMLInputElement.prototype
                : HTMLElement.prototype;
    const desc = Object.getOwnPropertyDescriptor(proto, 'value');
    if (desc?.set) desc.set.call(target, '');
    else target.value = '';
  } catch { target.value = ''; }
  target.dispatchEvent(new Event('input',{bubbles:true}));
  target.dispatchEvent(new Event('change',{bubbles:true}));
  await delay(30);

  for (const ch of String(value)) {
    target.dispatchEvent(new KeyboardEvent('keydown', { key: ch, bubbles:true, cancelable:true }));
    try {
      const proto = target instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype
                  : target instanceof HTMLInputElement ? HTMLInputElement.prototype
                  : HTMLElement.prototype;
      const desc = Object.getOwnPropertyDescriptor(proto, 'value');
      const next = (target.value || '') + ch;
      if (desc?.set) desc.set.call(target, next);
      else target.value = next;
    } catch {
      target.value = (target.value || '') + ch;
    }
    target.dispatchEvent(new Event('input',{bubbles:true}));
    target.dispatchEvent(new KeyboardEvent('keyup', { key: ch, bubbles:true, cancelable:true }));
    await delay(8);
  }
  target.dispatchEvent(new Event('change',{bubbles:true}));
  await delay(100);
} */
function getActiveListboxes(){
  const listboxes = [
    ...document.querySelectorAll('[role="listbox"]:not([aria-hidden="true"])'),
    ...document.querySelectorAll('.MuiAutocomplete-popper [role="listbox"]'),
    ...document.querySelectorAll('.MuiPaper-root .MuiMenu-list'),
    ...document.querySelectorAll('.ant-select-dropdown [role="listbox"], .ant-select-dropdown .ant-select-item-option'),
    ...document.querySelectorAll('.rc-virtual-list, .rc-virtual-list-holder')
  ];
  return listboxes.filter(lb => isVisible(lb));
}
async function gatherDropdownOptions(maxScrolls=8){
  const seen = new Set();
  let options = [];
  for (let i=0; i<maxScrolls; i++){
    const lbs = getActiveListboxes();
    if (!lbs.length) break;
    for (const lb of lbs){
      const nodes = lb.querySelectorAll(
        '[role="option"]:not([aria-disabled="true"]):not(.Mui-disabled),' +
        '.dropdown-option:not([aria-disabled="true"]),' +
        'li.MuiAutocomplete-option:not(.Mui-disabled),' +
        '.MuiList-root .MuiMenuItem-root:not(.Mui-disabled),' +
        '.ant-select-item-option:not(.ant-select-item-option-disabled),' +
        'div[data-value][role="option"],' +
        'ul[role="listbox"] > li:not([aria-disabled="true"]):not([aria-hidden="true"])'
      );
      nodes.forEach(n=>{ if(!seen.has(n)){ seen.add(n); options.push(n); } });
      if (lb.scrollHeight - lb.scrollTop > lb.clientHeight + 2) {
        lb.scrollTop = Math.min(lb.scrollTop + lb.clientHeight, lb.scrollHeight);
        await delay(100);
      }
    }
  }
  return options;
}
async function selectBestOption(normValue, options) {
  const candidates = Array.from(options).map(opt => {
    const t = normalizeFieldNameWithSpace(opt.textContent || opt.innerText || '');
    const dv = normalizeFieldNameWithSpace(opt.getAttribute?.('data-value') || opt.value || '');
    return { t, dv, opt };
  });

  let chosen = candidates.find(c => c.t === normValue || c.dv === normValue)?.opt;
  if (chosen) return chosen;

  const vBool = normalizeToBooleanLike(normValue);
  chosen = candidates.find(c => normalizeToBooleanLike(c.t) === vBool || normalizeToBooleanLike(c.dv) === vBool)?.opt;
  if (chosen) return chosen;

  try {
    const labels = candidates.map(c => c.t || c.dv);
    const response = await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ type: 'bestMatch', text: normValue, labels }, (res) => {
        if (res && res.ok) resolve(res);
        else reject(res?.error || "Best match failed");
      });
    });
    if (response?.label){
      const match = candidates.find(c => c.t === response.label || c.dv === response.label);
      if (match) return match.opt;
    }
  } catch (err) {
    console.warn('[autofill] ML match failed:', err);
  }

  chosen = candidates.find(c => c.t.includes(normValue) || c.dv.includes(normValue))?.opt;
  if (chosen) return chosen;

  const tokens = new Set(normValue.split(/\s+/).filter(Boolean));
  let best = {opt:null, score:-1};
  for (const c of candidates){
    const ts = new Set((c.t || c.dv).split(/\s+/).filter(Boolean));
    const overlap = [...tokens].filter(t=>ts.has(t)).length;
    if (overlap > best.score){ best = { opt:c.opt, score:overlap }; }
  }
  return best.opt || null;
}
function isBooleanLikeString(s){
  const v = normalizeToBooleanLike(String(s));
  return v === 'yes' || v === 'no';
}

function optionsContainBoolean(options){
  for (const opt of options){
    const t = normalizeFieldNameWithSpace(opt.textContent || opt.innerText || opt.value || '');
    const v = normalizeToBooleanLike(t);
    if (v === 'yes' || v === 'no') return true;
  }
  return false;
}
async function trySearchingInDropdown(input, rawValue){
  const value = String(rawValue);
  const normValue = normalizeFieldNameWithSpace(value);
  // --- NEW: open first on Workday, then preflight options BEFORE typing
  const isWD = isWorkdaySite();
  if (isWD) {
    // If the trigger is a button, just click to open the listbox
    if (input.tagName?.toUpperCase() === 'BUTTON') {
      input.click();
      await delay(120);
    } else {
      // Focus/click without clearing or firing change yet
      input.focus(); input.click();
      await delay(120);
    }

    // Gather whatever is visible right now
    let preOpts = await gatherDropdownOptions(2);

    // If caller is trying to set a boolean-like value but the dropdown is NOT boolean,
    // skip to avoid crashing Workday's reader (e.g., Language: English/Spanish)
    if (isBooleanLikeString(normValue) && preOpts.length && !optionsContainBoolean(preOpts)) {
      log('[autofill] Skip non-boolean dropdown for boolean value', { value, normValue });
      // Close any open popup politely
      const t = resolveTypingTarget(input);
      if (t){
        t.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));
        t.dispatchEvent(new KeyboardEvent('keyup',{key:'Escape',bubbles:true,cancelable:true}));
      }
      return false;
    }
  }


  log('Dropdown search', { value, normValue });

  await typeToInput(input, value);

  let options = await gatherDropdownOptions(8);
  if (!options.length){
    await delay(150);
    options = await gatherDropdownOptions(6);
  }

  const chosen = await selectBestOption(normValue, options);
  if (chosen){
    chosen.scrollIntoView({behavior:'smooth', block:'center'});
    // Use full pointer sequence so React/Workday trusts it
    chosen.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));
    chosen.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,cancelable:true}));
    chosen.dispatchEvent(new PointerEvent('pointerup',{bubbles:true}));
    chosen.dispatchEvent(new MouseEvent('mouseup',{bubbles:true,cancelable:true}));
    chosen.click();
    input.dispatchEvent(new Event('change',{bubbles:true}));
    log('Dropdown: picked option', chosen.textContent?.trim());

    // COMMIT & VERIFY for Workday (prevents “snap-back”)
    if (isWorkdaySite()){
      await commitWorkdaySelection(input);
      const ok = await verifyAndCommitDropdown(input, normalizeFieldNameWithSpace(String(value)));
      if (!ok) log('Workday commit retry still failed (will continue)', { value });
    } else {
      // Non-Workday: blur is fine
      input.blur(); input.dispatchEvent(new Event('blur',{bubbles:true}));
    }
    return true;
  }
  // Keyboard fallback
  // Keyboard fallback (also uses WD commit)
  log('Dropdown: keyboard fallback');
  const t = resolveTypingTarget(input);
  if (t){
    t.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true,cancelable:true}));
    t.dispatchEvent(new KeyboardEvent('keyup',{key:'ArrowDown',bubbles:true,cancelable:true}));
    t.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));
    t.dispatchEvent(new KeyboardEvent('keyup',{key:'Enter',bubbles:true,cancelable:true}));
  }
  if (isWorkdaySite()){
    await commitWorkdaySelection(input);
  } else {
    input.dispatchEvent(new Event('change',{bubbles:true}));
    input.blur(); input.dispatchEvent(new Event('blur',{bubbles:true}));
  }
  return true;
}


async function selectMultipleFromDropdown(input, values){
  const picked = new Set();
  for (const raw of values){
    const v = normalizeFieldNameWithSpace(String(raw));
    if (!v) continue;

    input.click();
    await typeToInput(input, raw);

    let options = await gatherDropdownOptions(6);
    const opt = await selectBestOption(v, options);
    if (opt){
      opt.scrollIntoView({behavior:'smooth', block:'center'});
      await delay(40);
      opt.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,cancelable:true}));
      opt.dispatchEvent(new MouseEvent('mouseup',{bubbles:true,cancelable:true}));
      opt.click();
      input.dispatchEvent(new Event('change',{bubbles:true}));

      if (isWorkdaySite()){
        await commitWorkdaySelection(input);
      } else {
        // keep focus for next chip in non-WD UIs
        await delay(120);
      }

    picked.add(v);
    input.click(); // reopen for next value
    await delay(60);

    } else {
      input.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
      input.dispatchEvent(new KeyboardEvent('keyup',{key:'Enter',bubbles:true}));
      await delay(60);
    }
  }
  input.blur(); input.dispatchEvent(new Event('blur',{bubbles:true}));
  log('Multi-select picked count', picked.size);
  return picked.size > 0;
}

// ===== File handling (resume) =====
const GENERIC_UPLOAD_STRINGS = [
  'choose file','choose files','upload','upload file','upload files',
  'attach','attach file','attach files','drag','drop','drag and drop',
  'please select','please select one','browse','select a file','select file',
  'drop files here','no file chosen','supported formats','max size'
];
function isGenericUploadPhrase(s) {
  const x = normalizeFieldNameWithSpace(s);
  return GENERIC_UPLOAD_STRINGS.some(g => x === g || x.includes(g));
}
function bestLabelForFileInput(input) {
  if (input.id) {
    const lab = document.querySelector(`label[for="${CSS.escape(input.id)}"]`);
    const t = lab?.textContent?.trim();
    if (t && !isGenericUploadPhrase(t)) return normalizeFieldNameWithSpace(t);
  }
  let node = input;
  while (node && node !== document.body) {
    if (node.tagName === 'LABEL') {
      const t = node.textContent?.trim();
      if (t && !isGenericUploadPhrase(t)) return normalizeFieldNameWithSpace(t);
    }
    node = node.parentElement;
  }
  const fs = input.closest('fieldset');
  const legend = fs?.querySelector('legend')?.textContent?.trim();
  if (legend && !isGenericUploadPhrase(legend)) return normalizeFieldNameWithSpace(legend);

  const head = input.closest('section,div,form')?.querySelector('h1,h2,h3,.section-title,.title');
  const headTxt = head?.textContent?.trim();
  if (headTxt && !isGenericUploadPhrase(headTxt)) return normalizeFieldNameWithSpace(headTxt);

  const sibs = [];
  let p = input.previousElementSibling;
  for (let i=0; i<3 && p; i++, p = p.previousElementSibling) {
    const t = p.textContent?.trim();
    if (t && !isGenericUploadPhrase(t)) sibs.push(t);
  }
  if (sibs.length) {
    const best = sibs.sort((a,b)=> b.length - a.length)[0];
    return normalizeFieldNameWithSpace(best);
  }
  const near = nearestTextAround(input);
  if (near && !isGenericUploadPhrase(near)) return near;
  return '';
}
function dataURLtoBlob(dataurl){
  const [meta, data] = dataurl.split(',');
  const mime = (meta.match(/:(.*?);/)||[])[1] || '';
  const bstr = atob(data);
  const u8 = new Uint8Array(bstr.length);
  for(let i=0;i<bstr.length;i++) u8[i]=bstr.charCodeAt(i);
  return new Blob([u8], { type: mime||'application/octet-stream' });
}
function fetchResumeFromBackground(fileUrl){
  return new Promise((resolve, reject)=>{
    try{
      chrome.runtime.sendMessage({action:'fetchResume', fileUrl}, (resp)=>{
        if(resp && resp.success) resolve(resp);
        else reject(resp?.error || 'background fetch failed');
      });
    }catch(e){ reject(e); }
  });
}
function setFilesWithNativeSetter(input, fileList) {
  const desc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'files');
  if (desc?.set) desc.set.call(input, fileList);
  else input.files = fileList;
}
async function simulateFileSelectionFromBackground(inputElement, fileUrl){
  const src = fileUrl.startsWith('http') ? fileUrl : `${API_BASE_URL}${fileUrl}`;
  const { fileData, filename } = await fetchResumeFromBackground(src);
  const blob = dataURLtoBlob(fileData);
  const file = new File([blob], filename || (src.split('/').pop() || 'resume.pdf'), { type: blob.type || 'application/pdf' });

  const dt = new DataTransfer();
  dt.items.add(file);

  inputElement.focus();
  inputElement.dispatchEvent(new Event('focus', { bubbles: true }));

  setFilesWithNativeSetter(inputElement, dt.files);

  inputElement.dispatchEvent(new Event('input',{bubbles:true,cancelable:true}));
  inputElement.dispatchEvent(new Event('change',{bubbles:true,cancelable:true}));

  inputElement.blur();
  inputElement.dispatchEvent(new Event('blur',{bubbles:true}));

  resumeUploadHappened = true;
  log('Resume set via background', filename);
  return true;
} 
async function tryAttachToDropzones(fileUrl){
  const zones = document.querySelectorAll('.dropzone, [data-dropzone], .file-drop, .upload-drop, [role="button"].drop, .upload-area, .dz-clickable, .dz-default, .attachment-drop, .file-uploader');
  if(!zones.length) return false;

  const src = fileUrl.startsWith('http') ? fileUrl : `${API_BASE_URL}${fileUrl}`;
  const { fileData, filename } = await fetchResumeFromBackground(src);
  const blob = dataURLtoBlob(fileData);
  const file = new File([blob], filename || (src.split('/').pop() || 'resume.pdf'), { type: blob.type || 'application/pdf' });

  for(const z of zones){
    try{
      z.classList.add('autofill-drop-indicator');
      const dt = new DataTransfer();
      dt.items.add(file);

      const enter = new DragEvent('dragenter',{bubbles:true,dataTransfer:dt});
      const over  = new DragEvent('dragover', {bubbles:true,dataTransfer:dt});
      const drop  = new DragEvent('drop',     {bubbles:true,dataTransfer:dt});
      z.dispatchEvent(enter); await delay(60);
      z.dispatchEvent(over);  await delay(60);
      z.dispatchEvent(drop);
      await delay(400);
      z.classList.remove('autofill-drop-indicator');
      resumeUploadHappened = true;
      log('Dropzone upload attempted');
      return true;
    }catch(e){
      log('Dropzone error', e);
      z.remove?.classList?.remove('autofill-drop-indicator');
    }
  }
  return false;
}
async function handleFileInput(input, fileUrl){
  try{
    const ok = await simulateFileSelectionFromBackground(input, fileUrl);
    if(ok) { try { await waitForResumeParseToFinish(); } catch {} return true; }
  }catch(e){ log('Native file set failed, trying dropzone', e); }
  try{
    const ok2 = await tryAttachToDropzones(fileUrl);
    if(ok2) { try { await waitForResumeParseToFinish(); } catch {} return true; }
  }catch(e){ log('Dropzone attach failed', e); }
  try{
    const src = fileUrl.startsWith('http') ? fileUrl : `${API_BASE_URL}${fileUrl}`;
    const filename = src.split('/').pop() || 'resume.pdf';
    const a = document.createElement('a');
    a.href = src; a.textContent = filename; a.target='_blank';
    a.style.display='inline-block'; a.style.marginLeft='8px'; a.style.color='#06c'; a.style.textDecoration='underline';
    input.parentNode?.insertBefore(a, input.nextSibling);
  }catch{}
  return false;
}

// ===== Fallback scoring =====
function runScoringFallback(candidates, keys) {
  let best = { candidate: "", key: "", score: -Infinity };
  const tok = s => normalizeFieldNameWithSpace(s).split(/\s+/).filter(Boolean);
  for (const cand of candidates) {
    const candTokens = tok(cand);
    for (const key of keys) {
      const keyTokens = tok(key);
      const candStr = normalizeFieldNameWithSpace(cand);
      const keyStr = normalizeFieldNameWithSpace(key);
      let score = 0;

      if (candStr === keyStr) score += 200;
      if (candStr.includes(keyStr) || keyStr.includes(candStr)) {
        const ratio = Math.min(candStr.length, keyStr.length) / Math.max(candStr.length, keyStr.length);
        score += ratio > 0.7 ? 80 : 30;
      }
      const setC = new Set(candTokens);
      const setK = new Set(keyTokens);
      const inter = [...setC].filter(t=>setK.has(t)).length;
      const union = new Set([...setC, ...setK]).size || 1;
      score += 100 * (inter / union);

      if (keyStr.includes('first') && candStr.includes('first')) score += 10;
      if (keyStr.includes('last') && candStr.includes('last')) score += 10;
      if (keyStr.includes('phone') && candStr.includes('phone')) score += 10;
      if (keyStr.includes('email') && candStr.includes('email')) score += 10;

      if (score > best.score) best = { candidate: cand, key, score };
    }
  }
  log('Fallback best key', best);
  return best.key;
}

// ===== React/Workday-safe value setting =====
function setValueWithNativeSetter(el, val){
  try{
    let proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype
              : el instanceof HTMLInputElement ? HTMLInputElement.prototype
              : HTMLElement.prototype;
    const desc = Object.getOwnPropertyDescriptor(proto, 'value');
    if (desc?.set) desc.set.call(el, val);
    else el.value = val;
  }catch{ el.value = val; }
}
function fireInputEvents(el, val){
  try{
    el.dispatchEvent(new InputEvent('input', { bubbles:true, cancelable:true, data:String(val), inputType:'insertFromPaste' }));
  }catch{
    el.dispatchEvent(new Event('input', { bubbles:true, cancelable:true }));
  }
  el.dispatchEvent(new Event('change', { bubbles:true, cancelable:true }));
}


async function typeCharacters(el, text){
  el.focus();
  try{ el.setSelectionRange(0, (el.value||'').length); }catch{}
  for (const ch of String(text)){
    el.dispatchEvent(new KeyboardEvent('keydown',{key: ch,bubbles:true,cancelable:true}));
    setValueWithNativeSetter(el, (el.value||'') + ch);
    fireInputEvents(el, ch);
    el.dispatchEvent(new KeyboardEvent('keyup',{key: ch,bubbles:true,cancelable:true}));
    await delay(10);
  }
  el.dispatchEvent(new KeyboardEvent('keydown',{key: 'Tab',bubbles:true,cancelable:true}));
  el.dispatchEvent(new KeyboardEvent('keyup',{key: 'Tab',bubbles:true,cancelable:true}));
}

// ===== Core fill =====
async function fillInput(el, value, opts = { mapped:false }){
  if(!el || el.disabled || el.readOnly) return;
  const tag = el.tagName?.toUpperCase?.() || '';
  const type = (el.type||'text').toLowerCase();

  let normVal = value;
  if(normVal===true) normVal='yes';
  if(normVal===false) normVal='no';

  log('Filling input', { tag, type, value: normVal, mapped: !!opts.mapped });

  simulateMouseMove(el);
  el.scrollIntoView({behavior:'smooth', block:'center'});
  await delay(40);

  const complex = isComplexDropdown(el);

  // MULTI-SELECT <select>
  if (tag === 'SELECT' && el.multiple) {
    const desired = splitMultiValues(normVal);
    const optsList = Array.from(el.options).map(opt => ({
      element: opt,
      text: normalizeFieldNameWithSpace(opt.textContent || opt.value || '')
    }));
    for (const raw of desired){
      const nv = normalizeFieldNameWithSpace(raw);
      let hit = optsList.find(o => o.text === nv) || optsList.find(o => o.text.includes(nv));
      if (!hit) {
        const toks = new Set(nv.split(/\s+/).filter(Boolean));
        let best = {o:null, score:-1};
        for (const o of optsList){
          const ts = new Set(o.text.split(/\s+/).filter(Boolean));
          const overlap = [...toks].filter(t=>ts.has(t)).length;
          if (overlap > best.score) best = {o, score:overlap};
        }
        hit = best.o;
      }
      if (hit){ hit.element.selected = true; }
    }
    el.dispatchEvent(new Event('input', { bubbles: true, cancelable:true }));
    el.dispatchEvent(new Event('change', { bubbles: true, cancelable:true }));
    el.blur(); el.dispatchEvent(new Event('blur',{bubbles:true}));
    if (opts.mapped) await waitForUiUpdates(3000);
    return;
  }

  // SINGLE <select>
  if (tag === 'SELECT') {
    if (complex) {
      await trySearchingInDropdown(el, String(normVal));
      if (opts.mapped) await waitForUiUpdates(3000);
      return;
    }
    const nv = normalizeFieldNameWithSpace(String(normVal));
    const options = Array.from(el.options).map(opt => ({
      element: opt,
      value: normalizeFieldNameWithSpace(opt.value || opt.textContent || '')
    }));
    const matched = options.find(opt => opt.value === nv) || options.find(opt => opt.value.includes(nv));
    if (matched) {
      matched.element.selected = true;
      el.dispatchEvent(new Event('input', { bubbles: true, cancelable:true }));
      el.dispatchEvent(new Event('change', { bubbles: true, cancelable:true }));
      el.blur(); el.dispatchEvent(new Event('blur',{bubbles:true}));
      if (opts.mapped) await waitForUiUpdates(3000);
    } else {
      log('Dropdown: no matching option found', normVal);
    }
    return;
  }

  // FILE
  if(type==='file'){ return; }

  // COMPLEX MULTI-SELECT
  if (complex && isMultiSelectLike(el)) {
    const values = splitMultiValues(normVal);
    await selectMultipleFromDropdown(el, values);
    if (opts.mapped) await waitForUiUpdates(3000);
    return;
  }

  // COMPLEX SINGLE
  if (complex){
    await trySearchingInDropdown(el, String(normVal));
    if (opts.mapped) await waitForUiUpdates(3000);
    return;
  }

  // CONTENTEDITABLE
  if(el.isContentEditable || el.getAttribute('role')==='textbox'){
    el.focus();
    try{
      document.execCommand('selectAll',false,null);
      document.execCommand('insertText', false, String(normVal));
    }catch{
      el.textContent = String(normVal);
    }
    fireInputEvents(el, normVal);
    el.blur(); el.dispatchEvent(new Event('blur',{bubbles:true}));
    if (opts.mapped) await waitForUiUpdates(2000);
    return;
  }

  // STANDARD INPUT
  el.focus();
  setValueWithNativeSetter(el, String(normVal));
  fireInputEvents(el, normVal);
  el.blur(); el.dispatchEvent(new Event('blur',{bubbles:true}));

  if (isWorkdaySite()) {
    await delay(16);
    const current = (el.value ?? '').toString();
    if (normalizeFieldNameWithSpace(current) !== normalizeFieldNameWithSpace(String(normVal))) {
      log('Workday: fallback typing characters');
      await typeCharacters(el, String(normVal));
      el.blur(); el.dispatchEvent(new Event('blur',{bubbles:true}));
    }
  }
  if (opts.mapped) await waitForUiUpdates(2000);
}

// ===== Address routing =====
async function fillAddressFields(input, normalizedInputName, data, prefix){
  const map = {
    residence:{ address:'residenceaddress', city:'residencecity', state:'residencestate', zip_code:'residencezipcode', country:'residencecountry', location:'residencelocation' },
    school:{ Name:'schoolname', address:'schooladdress', city:'schoolcity', state:'schoolstate', zip_code:'schoolzipcode', country:'schoolcountry', start_date:'schoolstartdate', end_date:'schoolenddate', currently_studying:'currentlystudying', location:'schoollocation' },
    job:{ address:'jobaddress', city:'jobcity', state:'jobstate', zip_code:'jobzipcode', country:'jobcountry', start_date:'jobstartdate', end_date:'jobenddate', currently_working:'currentlyworking', duties:'jobduties', company_name:'companyname', job_name:'jobname', location:'joblocation' },
  }[prefix];
  if(!map) return;

  const mappings = [
    {k:[/city|town/], dk:map.city},
    {k:[/zip|postal/], dk:map.zip_code},
    {k:[/country|origin|region/], dk:map.country},
    {k:[/state|province/], dk:map.state},
    {k:[/address|street/], dk:map.address},
    {k:[/start.*date/], dk:map.start_date, t:'date'},
    {k:[/end.*date/], dk:map.end_date, t:'date'},
    {k:[/name/], dk:map.Name},
    {k:[/(current|present)/], dk:map.currently_studying, t:'checkbox'},
    {k:[/(current|present)/], dk:map.currently_working, t:'checkbox'},
    {k:[/company|employe/], dk:map.company_name},
    {k:[/(job|role|name|title)/], dk:map.job_name},
    {k:[/(duties|responsibilities|description)/], dk:map.duties},
    {k:[/location/], dk:map.location}
  ];

  for(const m of mappings){
    if(m.k.some(rx=>rx.test(normalizedInputName)) && data?.[m.dk]!=null){
      log('Address fill', { field: normalizedInputName, dataKey: m.dk, prefix });
      if(m.t==='date') await fillInput(input, formatDate(data[m.dk]), { mapped:true });
      else await fillInput(input, data[m.dk], { mapped:true });
      break;
    }
  }
}

// ===== Input collection (incl. combobox roles & iframes) =====
function allShadowHosts(root=document){
  return [...root.querySelectorAll('*')].filter(el=>el.shadowRoot);
}
function collectInputsIn(root) {
  const sel = `
    input:not([disabled]):not([readonly]):not([type="hidden"]),
    select:not([disabled]):not([readonly]),
    textarea:not([disabled]):not([readonly]),
    [contenteditable="true"]:not([aria-disabled="true"]),
    [role="textbox"]:not([aria-disabled="true"]),
    [role="combobox"]:not([aria-disabled="true"]),
    [aria-haspopup="listbox"]:not([aria-disabled="true"])
  `;
  const nodes = [...root.querySelectorAll(sel)];
  const results = [];
  let groupCounter = 0;

  for (const input of nodes) {
    let groupId = null;
    let humanName = null;

    const t = (input.type||'').toLowerCase();
    if (t === 'checkbox' || t === 'radio') {
      let key = '';
      if (input.name) key = `name:${input.name}`;
      if (!key){
        const fs = input.closest('fieldset');
        const legend = fs?.querySelector('legend')?.textContent?.trim();
        if (legend) key = `fieldset:${normalizeFieldNameWithSpace(legend)}`;
      }
      if (!key && input.getAttribute('aria-labelledby')){
        key = `aria:${input.getAttribute('aria-labelledby')}`;
      }
      const container = input.closest('fieldset, section, div, form, ul, ol, table, tbody, tr') || root;
      if (!key){
        if (!groupCache.has(container)) groupCache.set(container, `group-${groupCounter++}`);
        key = groupCache.get(container);
      }
      groupId = key;

      if (!container._humanName) {
        container._humanName = inputFieldSelection(input) || input.name || '';
      }
      humanName = container._humanName;
    } else {
      humanName = inputFieldSelection(input) || input.name || input.getAttribute?.('aria-label') || '';
    }

    results.push({ element: input, groupId, humanName });
  }
  return results;
}
function collectAllRoots(){
  const roots = [document];
  const stack = [...allShadowHosts(document)];
  document.querySelectorAll('iframe, frame').forEach(fr=>{
    try{
      if (fr.contentDocument) {
        roots.push(fr.contentDocument);
        stack.push(...allShadowHosts(fr.contentDocument));
      }
    }catch{}
  });
  while (stack.length) {
    const host = stack.pop();
    if (host.shadowRoot) {
      roots.push(host.shadowRoot);
      stack.push(...allShadowHosts(host.shadowRoot));
    }
  }
  return roots;
}
function inputSelection() {
  const roots = collectAllRoots();
  const all = roots.flatMap(r => collectInputsIn(r));
  const uniq = [];
  const seen = new WeakSet();
  for (const it of all) {
    if (!seen.has(it.element)) {
      seen.add(it.element);
      uniq.push(it);
    }
  }
  log('Total inputs collected', uniq.length);
  return uniq;
}

// ===== Check helpers =====
async function checkElement(el, shouldCheck = true){
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  await delay(30);
  if (!!el.checked !== !!shouldCheck) {
    el.click();
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }
  el.setAttribute('data-autofilled', 'true');
  el.classList.add('autofill-highlight');
  setTimeout(() => el.classList.remove('autofill-highlight'), 240);
}

// ===== Workday gating =====
function classifyForWorkday(inputName) {
  const n = (inputName || '').toLowerCase();
  if (/\bcountry\b/.test(n)) return 'country';
  if (/\b(phone|mobile)\b/.test(n)) return 'phone';
  if (/\b(address|zip|postal|state|province|city|town)\b/.test(n)) return 'address';
  if (/\b(name|first|last|middle)\b/.test(n)) return 'name';
  return 'other';
}
function elementHasNonEmptyValue(el){
  const t = (el.type||'').toLowerCase();
  if (t==='checkbox' || t==='radio') return el.checked;
  if (el.tagName?.toUpperCase()==='SELECT'){
    const i = el.selectedIndex;
    if (i == null || i < 0) return false;
    const opt = el.options[i];
    const txt = (opt?.textContent || opt?.value || '').trim();
    return !!txt;
  }
  if (el.isContentEditable) return ((el.textContent||'').trim().length > 0);
  const v = el.value ?? '';
  return (String(v).trim().length > 0);
}
function workdayCountryIsReady(inputs){
  for (const obj of inputs){
    if (/\bcountry\b/i.test(obj.humanName || '')){
      if (elementHasNonEmptyValue(obj.element)) return true;
    }
  }
  return true;
}

// ===== Repeated Sections (Education / Experience / Languages) =====
const RX_EDU = /(education|school|university|college)/i;
const RX_EXP = /(experience|employment|work|job)/i;
const RX_LANG = /(language|languages)/i;

function textOf(el){ return (el?.textContent || el?.innerText || '').trim(); }
function qAll(root, sel){ return Array.from((root || document).querySelectorAll(sel)); }

function findSectionHeaders(sectionRx) {
  const heads = qAll(document, 'h1,h2,h3,h4,legend,.section-title,.title,[data-automation-id]');
  return heads.filter(h => sectionRx.test(textOf(h)) || sectionRx.test(h.getAttribute('data-automation-id')||''));
}
function findNearestSectionRoot(headerEl){
  return headerEl.closest('section,form,fieldset,div') || headerEl.parentElement || document.body;
}
function findNearestAddButtonToHeader(headerEl) {
  const ADD_RX = /^(\+?\s*)?add(\s|$)/i;
  const scope = findNearestSectionRoot(headerEl);
  const candidates = [
    ...qAll(scope, 'button,[role="button"],a,span[role="button"],div[role="button"]'),
    ...qAll(scope, '[data-automation-id*="add"],[data-automation-id*="Add"],[title^="Add"]')
  ].filter(isVisible);

  for (const b of candidates){
    const text = textOf(b);
    const aria = (b.getAttribute('aria-label')||'') + ' ' + (b.getAttribute('title')||'') + ' ' + (b.getAttribute('data-automation-id')||'');
    if (ADD_RX.test(text) || ADD_RX.test(aria) || /add/i.test(aria)) return b;
  }
  return null;
}
function countEntryBlocksInSection(sectionRoot){
  // heuristic: count containers with at least 2 interactive fields but smaller than entire section
  const groups = qAll(sectionRoot, 'fieldset, .card, .panel, .wd-Panel, .MuiPaper-root, .ant-card, li, div');
  const blocks = [];
  for (const g of groups) {
    const inputs = g.querySelectorAll('input:not([type="hidden"]), select, textarea, [contenteditable="true"], [role="textbox"]');
    if (inputs.length >= 2) {
      const secInputs = sectionRoot.querySelectorAll('input:not([type="hidden"]), select, textarea, [contenteditable="true"], [role="textbox"]').length;
      if (inputs.length < secInputs) blocks.push(g);
    }
  }
  // dedupe by geometry
  const uniq = [];
  const seen = new Set();
  for (const b of blocks) {
    const r = b.getBoundingClientRect();
    const key = [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)].join(':');
    if (!seen.has(key)) { seen.add(key); uniq.push(b); }
  }
  return uniq.length;
}
async function ensureSectionEntries(sectionRx, neededCount, maxClicks=6){
  const headers = findSectionHeaders(sectionRx);
  if (!headers.length) return 0;
  // pick the header whose section has the most inputs
  headers.sort((a,b)=>{
    const sa = findNearestSectionRoot(a);
    const sb = findNearestSectionRoot(b);
    return (sb.querySelectorAll('input,select,textarea,[contenteditable="true"]').length -
            sa.querySelectorAll('input,select,textarea,[contenteditable="true"]').length);
  });
  const header = headers[0];
  const section = findNearestSectionRoot(header);
  let count = countEntryBlocksInSection(section);
  log('ensureSectionEntries start', { neededCount, count, headerText: textOf(header) });

  let clicks = 0;
  while (count < neededCount && clicks < maxClicks){
    const btn = findNearestAddButtonToHeader(header);
    if (!btn) { log('Add button not found for section'); break; }
    btn.scrollIntoView({behavior:'smooth', block:'center'});
    btn.click();
    btn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    btn.dispatchEvent(new MouseEvent('mouseup',   { bubbles: true, cancelable: true }));
    clicks++;
    await waitForUiUpdates(4000, 300);
    count = countEntryBlocksInSection(section);
    log('ensureSectionEntries click result', { clicks, count });
  }
  return count;
}

// ===== Resume Autofill UX detector (for 3s second pass) =====
function hasResumeAutofillUX(){
  const nodes = Array.from(document.querySelectorAll('h1,h2,h3,label,button,span,div,a'));
  const joined = nodes.slice(0, 400).map(n => (n.textContent||'').toLowerCase()).join(' ');
  if (/(autofill|parse|from resume|extract).*resume|resume.*(autofill|parse|extract)/i.test(joined)) return true;
  const fileInputs = Array.from(document.querySelectorAll('input[type="file"]'));
  return fileInputs.some(inp => {
    const name = bestLabelForFileInput(inp) || inputFieldSelection(inp);
    return /resume|cv/.test(name || '');
  });
}

// ====== Populate all ======
async function populateFields(inputs, data){
  if(!data) return;
  const normalizedData = {};
  for(const key in data) normalizedData[normalizeFieldName(key)] = data[key];
  autofillData = normalizedData;

  const processedGroups = new Set();

  const WD = isWorkdaySite();
  let wdCountryReady = WD ? workdayCountryIsReady(inputs) : true;
  const wdDeferred = [];

  for(const obj of inputs){
    const el = obj.element;
    const groupId = obj.groupId;
    const inputName = obj.humanName;

    if(el.getAttribute('data-autofilled')==='true') continue;
    if(el.disabled || el.readOnly) continue;

    // Workday: skip touching "Country" entirely (usually default & sensitive)
    if (WD && /\bcountry\b/i.test(inputName)) {
      log('Skip Workday country');
      continue;
    }

    let wdClass = 'other';
    if (WD) {
      wdClass = classifyForWorkday(inputName);
      if ((wdClass === 'address' || wdClass === 'phone' || wdClass === 'name') && !wdCountryReady) {
        wdDeferred.push(obj);
        log('Deferring until country ready', inputName);
        continue;
      }
    }

    // ML bestKey with fallback
    let bestKey;
    try {
      const filteredAutofillData = Object.fromEntries(Object.entries(autofillData).filter(([key]) => key !== "userid"));
      const keys = Object.keys(filteredAutofillData);
      const response = await new Promise((resolve,reject)=>{
        chrome.runtime.sendMessage({
          type: 'bestMatch',
          text: inputName,
          labels: keys
        },(res)=> res && res.ok ? resolve(res) : reject(res?.error || "bestMatch failed"));
      });
      if(response) bestKey = response.label;
      if (!bestKey) bestKey = runScoringFallback([inputName], Object.keys(autofillData));
    } catch {
      bestKey = runScoringFallback([inputName], Object.keys(autofillData));
    }

    // mapping priority
    let mapping = fieldMappings.find(m => m.keywords.some(rx => rx.test(inputName)));
    if(!mapping && el.type === 'file') {
      const around = bestLabelForFileInput(el) || nearestTextAround(el);
      mapping = fieldMappings.find(m => m.keywords.some(rx => rx.test(around)));
      log('file input label (fallback)', { around, mappingFound: !!mapping });
    }

    // derive value
    let val = undefined;
    if (mapping) {
      const dk = mapping.dataKey;
      val = normalizedData[dk];
      if (val === undefined && bestKey) val = normalizedData[bestKey];
    } else if (bestKey) {
      val = normalizedData[bestKey];
    }

    if(val===true) val='yes';
    if(val===false) val='no';

    // fallback to name/id
    if(val===undefined){
      val = normalizedData[normalizeFieldName(el.name)] ?? normalizedData[normalizeFieldName(el.id)];
    }
    if(val===undefined && (!mapping || mapping.type!=='address')) {
      // nothing we can fill for this input
      continue;
    }

    // handle grouped radios/checkboxes once per group
    const t = (el.type||'').toLowerCase();
    if((groupId || inputName) && (t==='radio' || t==='checkbox')){
      const groupKey = groupId || normalizeFieldNameWithSpace(inputName);
      if(processedGroups.has(groupKey)) continue;

      const groupEls = inputs
        .filter(x => x.element !== el && (x.groupId === groupId || normalizeFieldNameWithSpace(x.humanName) === normalizeFieldNameWithSpace(inputName)) && ((x.element.type||'').toLowerCase()===t))
        .map(x => x.element);
      groupEls.push(el);

      const checkboxMap = [];
      for(const gEl of groupEls){
        const label = normalizeFieldNameWithSpace(findAssociatedLabel(gEl) || gEl.value || '');
        checkboxMap.push({label,element:gEl});
      }

      const desiredValues = Array.isArray(val) ? val.map(v=>String(v)) : [String(val)];
      const wantedNorms = desiredValues.map(v => normalizeFieldNameWithSpace(v));

      // Boolean groups
      const wantedBool = desiredValues.map(v=>normalizeToBooleanLike(v));
      const labelsBool = checkboxMap.map(x=>normalizeToBooleanLike(x.label));
      if (new Set(wantedBool).size === 1 && (labelsBool.includes('yes') || labelsBool.includes('no'))){
        for (const x of checkboxMap){
          const should = normalizeToBooleanLike(x.label) === wantedBool[0];
          await checkElement(x.element, should);
        }
        processedGroups.add(groupKey);
        continue;
      }

      // Otherwise: exact -> ML -> includes -> overlap
      for (const wanted of wantedNorms){
        let finalCheck = checkboxMap.find(x=>x.label === wanted)?.element;

        if (!finalCheck){
          try{
            const response = await new Promise((resolve,reject)=>{
              chrome.runtime.sendMessage({
                type: 'bestMatch',
                text: wanted,
                labels: checkboxMap.map(x=>x.label)
              },(res)=> res && res.ok ? resolve(res) : reject(res?.error || 'Best Match Failed'));
            });
            const bestLabel = normalizeFieldNameWithSpace(response.label || '');
            finalCheck = checkboxMap.find(x=>x.label === bestLabel)?.element;
          }catch{}
        }
        if(!finalCheck){
          finalCheck = checkboxMap.find(x=>x.label.includes(wanted))?.element;
        }
        if(!finalCheck){
          const tokens = new Set(wanted.split(/\s+/).filter(Boolean));
          let best = {el:null,score:-1};
          for (const x of checkboxMap){
            const ts = new Set(x.label.split(/\s+/).filter(Boolean));
            const overlap = [...tokens].filter(t=>ts.has(t)).length;
            if (overlap > best.score) best = {el:x.element, score:overlap};
          }
          finalCheck = best.el;
        }

        if(finalCheck) await checkElement(finalCheck, true);
      }

      // radios: ensure others off (only if we set one here)
      if (t==='radio'){
        for (const x of checkboxMap){
          const keep = x.element.getAttribute('data-autofilled') === 'true';
          if(!keep) await checkElement(x.element, false);
        }
      }

      processedGroups.add(groupKey);
      continue;
    }

    // non-grouped inputs
    el.classList.add('autofill-highlight');
    el.setAttribute('data-autofilled','true');

    if(mapping?.type==='file' && el.type==='file' && /resume|cv/.test((inputName||'').toLowerCase())){
      try{ await handleFileInput(el, val); await delay(120); }catch(e){ log('File handle error', e); }
    } else if(mapping?.type==='address'){
      if (isWorkdaySite() && !wdCountryReady) { wdDeferred.push(obj); continue; }
      const prefix = getSectionPrefix(el);
      await fillAddressFields(el, inputName, normalizedData, prefix); // (mapped waits inside)
    } else if(mapping?.type==='date'){
      await fillInput(el, formatDate(val), { mapped:true });
    }
    // Phone with code (best-effort)
    else if(mapping?.type==='code' && mapping.handleCountryCode && mapping.dataKey==='phonenumber'){
      if (isWorkdaySite() && !wdCountryReady) { wdDeferred.push(obj); continue; }
      const prevSelect = el.previousElementSibling;
      if(prevSelect?.tagName?.toUpperCase()==='SELECT'){
        const parts = String(val).match(/^\+?(\d{1,3})?(\d+)$/);
        if(parts && parts[1]){
          const code = parts[1], num = parts[2];
          let set=false;
          for(const opt of prevSelect.options){
            if(normalizeFieldNameWithSpace(opt.value).includes(code) || normalizeFieldNameWithSpace(opt.textContent||'').includes(code)){
              opt.selected=true;
              prevSelect.dispatchEvent(new Event('change',{bubbles:true}));
              await fillInput(el, num, { mapped:true });
              set=true; break;
            }
          }
          if(!set) await fillInput(el, val, { mapped:true });
        }else{
          await fillInput(el, val, { mapped:true });
        }
      }else{
        await fillInput(el, val, { mapped:true });
      }
    } else {
      // ALWAYS fill mapped/non-mapped if we have a value (your spec)
      await fillInput(el, val, { mapped: !!mapping });
    }

    // re-check workday readiness in case UX changed
    if (WD && wdClass === 'country' && !wdCountryReady) {
      wdCountryReady = workdayCountryIsReady(inputs);
    }

    setTimeout(()=>el.classList.remove('autofill-highlight'), 260);
    if(groupId) processedGroups.add(groupId);
    await delay(60);
  }

  // Workday second pass for deferred address/phone/name
  if (WD && wdDeferred.length) {
    wdCountryReady = workdayCountryIsReady(inputs);
    if (wdCountryReady) {
      log('Running deferred Workday fields');
      await populateFields(wdDeferred, data);
    }
  }
}

// ====== Public init ======
let autofillData = null;
export async function autofillInit(tokenOrData, dataFromPopup=null){
  const data = dataFromPopup ?? tokenOrData;
  if(!data){ log('No data provided to autofillInit'); return; }
  autofillData = data;

  // Expand repeated rows if your data has arrays
  try {
    const eduArr =
      (Array.isArray(data.education) && data.education) ||
      (Array.isArray(data.educations) && data.educations) ||
      (Array.isArray(data.schools) && data.schools) || [];
    if (eduArr.length > 1) {
      await ensureSectionEntries(RX_EDU, eduArr.length);
    }

    const expArr =
      (Array.isArray(data.experience) && data.experience) ||
      (Array.isArray(data.experiences) && data.experiences) ||
      (Array.isArray(data.jobs) && data.jobs) || [];
    if (expArr.length > 1) {
      await ensureSectionEntries(RX_EXP, expArr.length);
    }

    const langArr =
      (Array.isArray(data.languages) && data.languages) || [];
    if (langArr.length > 1) {
      await ensureSectionEntries(RX_LANG, langArr.length);
    }
  } catch (e) {
    log('ensureSectionEntries error', e);
  }

  // First pass
  const inputs = inputSelection();
  log('All inputs (first pass)', inputs.length);
  await populateFields(inputs, data);

  // If resume UX is present OR we just uploaded a resume: wait 3s, then fill any leftovers.
  if (resumeUploadHappened || hasResumeAutofillUX()) {
    log('Detected resume-autofill UX or upload; scheduling second pass');
    await delay(3000);
    const all = inputSelection();
    const unfilled = all.filter(i =>
      i.element.getAttribute("data-autofilled") !== "true" &&
      !i.element.disabled &&
      !i.element.readOnly &&
      !((i.element.type||'')==='checkbox' || (i.element.type||'')==='radio'
         ? i.element.checked
         : ((i.element.value ?? '').toString().trim().length > 0))
    );
    if (unfilled.length){
      log(`Second pass after resume parse: ${unfilled.length} fields`);
      await populateFields(unfilled, data);
    } else {
      log('Second pass: nothing left to fill');
    }
  } else {
    log('No resume-autofill UX detected; skipping second-pass delay');
  }
}

// ====== Mutation Observer (robust, throttled) ======
let debounce;
let lastRun = 0;
const RUN_MIN_GAP_MS = 700; // throttling for noisy UIs (e.g., Workday)
const rootForObserver = document.querySelector("form") || document.body;
const observer = new MutationObserver(mutations => {
  clearTimeout(debounce);
  debounce = setTimeout(async () => {
    if (!autofillData) return;

    if (Date.now() - lastRun < RUN_MIN_GAP_MS) return;

    const hasNewInputs = mutations.some(m =>
      [...m.addedNodes].some(n => n.querySelector?.('input:not([type="hidden"]), select, textarea, [contenteditable="true"], [role="textbox"], [role="combobox"], [aria-haspopup="listbox"]'))
    );
    if (!hasNewInputs) return;

    const all = inputSelection();
    const unfilled = all.filter(i =>
      i.element.getAttribute("data-autofilled") !== "true" &&
      !i.element.disabled &&
      !i.element.readOnly
    );

    if (unfilled.length) {
      lastRun = Date.now();
      log(`New inputs detected: ${unfilled.length} — autofilling.`);
      await populateFields(unfilled, autofillData);
    }
  }, 350);
});
observer.observe(rootForObserver, { childList:true, subtree:true });

// (Optionally expose for manual re-run)
export async function autofillRerun(){
  if(!autofillData) return;
  const inputs = inputSelection();
  await populateFields(inputs, autofillData);
}
