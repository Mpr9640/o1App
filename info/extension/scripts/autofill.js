//===Global caches
//Config ======
const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
//Styles ======
//import { waitForResumeParseNetworkFirst } from'./resumechecking.js';
const style = document.createElement('style');
style.textContent = `
  .autofill-highlight{ outline:2px solid gold !important; transition: outline .3s ease-out; }
  .autofill-drop-indicator{ outline:2px dashed #8aa; }
`;
document.head.appendChild(style);

const fieldNameCache = new WeakMap();
const groupCache = new WeakMap();
//const delay = (ms)=>new Promise(r=>setTimeout(r,ms));s
// Visibility / Normalization
function isElementVisible(el){
  if (!el || !el.getBoundingClientRect) return false;
  const rect = el.getBoundingClientRect();
  if (!rect || rect.width === 0 || rect.height === 0) return false;

  const cs = getComputedStyle(el);
  if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return false;

  if ((rect.bottom < 0 && rect.top < 0) || (rect.right < 0 && rect.left < 0)) return false;

  for (let n = el; n; n = n.parentElement){
    if (n.hidden) return false;
    if (n.getAttribute && n.getAttribute('aria-hidden') === 'true') return false;
    if ('inert' in n && n.inert) return false;
  }
  return true;
}
function normalizeFieldName(s){
  return (s||'').toString().toLowerCase().replace(/\s/g,'').replace(/[^a-z0-9]/g,'').trim();
}
function normalizeFieldNameWithSpace(s){
  return (s||'').toString()
    .replace(/([a-z])([A-Z])/g,'$1 $2')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g,' ')
    .replace(/\s+/g, ' ')
    .trim();
}
// Booleans / Options =====
const BOOL_TRUE = new Set(['yes','y','true','t','1','accept','agree','iagree','optin','on','currentlyworking','currentlystudying']);
const BOOL_FALSE = new Set(['no','n','false','f','0','decline','disagree','i do not agree','optout','off','notcurrentlyworking','notcurrentlystudying']);

function normalizeOptionText(text) {
  return (text||'').split('-')[0].replace(/\(.*?\)/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
} 
//Function for normalization ob booleans
function normalizeToBooleanLike(v){
  const s = normalizeOptionText(String(v));
  if (BOOL_TRUE.has(s)) return 'yes';
  if (BOOL_FALSE.has(s)) return 'no';
  return s;
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

// Finding nearest label fallback
function textNodeCenterRect(node) {
  const range = node.ownerDocument.createRange();
  range.selectNodeContents(node);
  const rects = range.getClientRects();
  range.detach?.();
  if (!rects || rects.length === 0) return null;
  let best = rects[0];
  for (let i = 1; i < rects.length; i++) {
    const r = rects[i];
    if (r.width * r.height > best.width * best.height) best = r;
  }
  return best;
}
function getExplicitLabels(el) {
  const doc = el.ownerDocument;
  const out = [];
  if (el.labels && el.labels.length) {
    for (const lab of el.labels) {
      const t = (lab.textContent || '').trim();
      if (t) out.push(t);
    }
  } else {
    let p = el.parentElement;
    while (p) {
      if (p.tagName === 'LABEL') {
        const t = (p.textContent || '').trim();
        if (t) out.push(t);
        break;
      }
      p = p.parentElement;
    }
  }
  const addByIds = (attr) => {
    const ids = (el.getAttribute(attr) || '').split(/\s+/).filter(Boolean);
    for (const id of ids) {
      const n = doc.getElementById(id);
      if (n) {
        const t = (n.textContent || '').trim();
        if (t) out.push(t);
      }
    }
  };
  addByIds('aria-labelledby');
  addByIds('aria-describedby');

  if (el.placeholder) out.push(el.placeholder);
  if (el.title) out.push(el.title);

  return out;
}
function nearestTextAround(el, px = 220, { includeIframes = false } = {}) {
  if (!el) return '';

  const explicit = getExplicitLabels(el)
    .map(normalizeFieldNameWithSpace)
    .find(Boolean);
  if (explicit) return explicit;

  const root = el.getRootNode?.() || el.ownerDocument || document;
  const doc = root.nodeType === 9 ? root : (root.ownerDocument || document);

  const er = el.getBoundingClientRect();
  const ecx = er.left + er.width / 2;
  const ecy = er.top + er.height / 2;

  const walker = doc.createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        const raw = node.nodeValue || '';
        if (!raw.trim()) return NodeFilter.FILTER_REJECT;
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        const tag = parent.tagName;
        if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT') return NodeFilter.FILTER_REJECT;
        if (!isElementVisible(parent)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    },
    false
  );

  let bestTxt = '';
  let bestScore = Infinity;

  while (walker.nextNode()) {
    const node = walker.currentNode;
    const rect = textNodeCenterRect(node);
    if (!rect) continue;

    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    const dx = cx - ecx;
    const dy = cy - ecy;
    const dist = Math.hypot(dx, dy);
    if (dist > px) continue;

    let bias = 0;
    if (cx > ecx) bias += 18;
    if (cy > ecy) bias += 9;
    if (Math.abs(dy) < 10) bias -= 6;

    const score = dist + bias;
    if (score < bestScore) {
      bestScore = score;
      bestTxt = (node.nodeValue || '').trim();
    }
  }

  if (!bestTxt && includeIframes) {
    for (const iframe of doc.querySelectorAll('iframe')) {
      try {
        const idoc = iframe.contentDocument;
        if (!idoc) continue;
        const walker2 = idoc.createTreeWalker(
          idoc,
          NodeFilter.SHOW_TEXT,
          {
            acceptNode(node) {
              const raw = node.nodeValue || '';
              if (!raw.trim()) return NodeFilter.FILTER_REJECT;
              const parent = node.parentElement;
              if (!parent) return NodeFilter.FILTER_REJECT;
              const tag = parent.tagName;
              if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT') return NodeFilter.FILTER_REJECT;
              if (!isElementVisible(parent)) return NodeFilter.FILTER_REJECT;
              return NodeFilter.FILTER_ACCEPT;
            }
          },
          false
        );

        let best2 = Infinity, txt2 = '';
        while (walker2.nextNode()) {
          const node = walker2.currentNode;
          const rect = textNodeCenterRect(node);
          if (!rect) continue;
          const cx = rect.left + rect.width / 2;
          const cy = rect.top + rect.height / 2;
          const dx = cx - ecx;
          const dy = cy - ecy;
          const dist = Math.hypot(dx, dy);
          if (dist > px) continue;
          let bias = 0;
          if (cx > ecx) bias += 18;
          if (cy > ecy) bias += 9;
          if (Math.abs(dy) < 10) bias -= 6;
          const score = dist + bias;
          if (score < best2) {
            best2 = score;
            txt2 = (node.nodeValue || '').trim();
          }
        }
        if (txt2) bestTxt = txt2;
      } catch (e) {}
    }
  }

  const norm = normalizeFieldNameWithSpace(bestTxt);
  //console.log('[nearestTextAround]', norm);
  return norm;
}
function findAssociatedLabel(el){
  if (!el) return '';
  if (el.id){
    const lab = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
    if (lab?.textContent) return lab.textContent.trim();
  }
  return '';
}
///====Hosts
// OPTIONAL: Workday hints
function isWorkdayHost() {
  const h = location.hostname;
  return /\.myworkdayjobs\.com$/i.test(h) || /\.wd\d+\.myworkdayjobs\.com$/i.test(h);
}
///ICIMS host related 
const isIcimsHost = /(?:^|\.)icims\.(?:com|co)$/i.test(location.hostname);
function getIcimsFormRoot() {
  return document.querySelector(
    '#iCIMS_ApplicantProfile, form#cp_form, form[action*="Profile"], form[action*="Candidate"], .iCIMS_ContentPane'
  ) || document;
}
function stableKeyFor(el) {
  const id = el.id || '';
  const name = el.getAttribute?.('name') || '';
  const type = el.getAttribute?.('type') || '';
  const formAct = el.form?.getAttribute?.('action') || '';
  // short DOM path fingerprint
  let n = el, path = [];
  for (let i=0; n && i<4; i++) {
    let ix = 0, sib = n;
    while ((sib = sib.previousElementSibling)) ix++;
    path.push(`${n.tagName}:${ix}`);
    n = n.parentElement;
  }
  return [id, name, type, formAct, path.join('>')].join('|');
}


const fieldMappings = [
  // ==== PERSONAL INFO ====
  { keywords: [/\bfirst\s*name\b/i, /\bgiven\s*name\b/i], dataKey: 'firstname' },
  { keywords: [/\bmiddle\s*name\b/i, /\binitial\b/i], dataKey: 'middlename' },
  { keywords: [/\blast\s*name\b/i, /\bsurname\b/i, /\bfamily\s*name\b/i], dataKey: 'lastname' },
  { keywords: [/\bfull\s*name\b/i, /\blegal\s*name\b/i,/^name$/i], dataKey: 'fullname' },
  { keywords: [/\bdate\s*of\s*birth\b/i, /\bdob\b/i, /\bbirth\s*date\b/i], dataKey: 'dateofbirth', type:'date' },

  // ==== CONTACT INFO ====
  { keywords: [/\bemail\b/i, /\bemail\s*address\b/i], dataKey: 'email' },
  { keywords: [/\b(?:phone|mobile|telephone|contact\s*number)\b(?!\s*(extension|type)\b)/i], dataKey: 'phonenumber' },
  { keywords: [/\b(country\s*code|phone\s*code)\b/i], dataKey: 'residencecountry', handleCountryCode: true },

  // ==== SOCIAL / LINKS ====
  { keywords: [/\blinked\s?in\b/i, /\blinked\s*in\s*profile\b/i], dataKey: 'linkedin' },
  { keywords: [/\bgit\s?hub\b/i, /\bgithub\s*profile\b/i], dataKey: 'github' },
  { keywords: [/\bportfolio\b/i, /\bpersonal\s*site\b/i], dataKey: 'portfolio' },
  { keywords: [/\bskills\b/i], dataKey: 'skills'},

  // ==== FILE UPLOADS ====
  { keywords: [/\bresume\b/i, /\bcv\b/i, /\bcurriculum\s*vitae\b/i], dataKey: 'resume' },
  { keywords: [/\bcover\s*letter\b/i, /\bsupporting\s*document\b/i], dataKey: 'coverletter' },

  // ==== DEMOGRAPHIC INFO ====
  { keywords: [/\bgender\b/i, /\bsex\b/i], dataKey: 'gender' },
  { keywords: [/\brace\b/i, /\bethnicity\b/i, /\bethnic\s*group\b/i], dataKey: 'race' },
  { keywords: [/\bdisab(?:ility|led)?\b/i, /\bdisclosure of disability\b/i], dataKey: 'disability' },
  { keywords: [/\bveteran\b/i, /\bmilitary\b/i, /\barmed\s*forces\b/i], dataKey: 'veteran' },
  { keywords: [/\bsponsor|spsorship/i, /\bvisa\s*sponsor\b/i, /\bwork\s*authorization\b/i], dataKey: 'needsponsorship' },

  // residence address / address line 1 / address number / street number — prefix required
  {keywords: [/\b(?:residence|residential|street|postal|permanent|home)[-\s]*address\b(?!\s*line\s*2\b)(?:\s*(?:line\s*1|number(?:\s*\d+)?))?/i,/\b(?:residence|residential|permanent|present|current|home)[-\s]*street[-\s]*number\b/i],dataKey: 'residenceaddress'},
  {keywords: [/\b(?:residence|residential|permanent|present|current|home)[-\s]*(?:city|town)\b/i],dataKey: 'residencecity'},
  {keywords: [/\b(?:residence|residential|permanent|present|current|home)[-\s]*state\b(?!\s*of\b)/i],dataKey: 'residencestate'},
  {keywords: [/\b(?:residence|residential|permanent|present|current|home)[-\s]*country\b(?!\s*(?:code|dial|calling)\b)/i],dataKey: 'residencecountry'},
  {keywords: [/\b(?:residence|residential|permanent|present|current|home)[-\s]*(?:zip|postal|area)[-\s]*code\b/i],dataKey: 'residencezipcode'},
  {keywords: [/\b(?:residence|residential|permanent|present|current|home|currently)[-\s]*(location|located)\b/i],dataKey: 'residencelocation'}
];

//=== Date related codes:
function parseISOish(dateStr){
  // accepts "YYYY", "YYYY-MM", "YYYY-MM-DD"
  if (!dateStr) return null;
  const m = String(dateStr).match(/^(\d{4})(?:[-/](\d{1,2}))?(?:[-/](\d{1,2}))?$/);
  if (!m) return null;
  const year  = +m[1];
  const month = m[2] ? +m[2] : null;
  const day   = m[3] ? +m[3] : null;
  //console.log('parseisoish ymd',year,month,day);
  return { year, month, day };
}
const p2 = (n)=> String(n).padStart(2,'0');

function detectSingleDateGranularity(el){
  // For single field date controls (not split month/year)
  const t   = (el.type||'').toLowerCase();
  const ph  = (el.getAttribute('placeholder')||'').toLowerCase();
  const idn = ((el.id||'') + ' ' + (el.name||'')).toLowerCase();

  if (t === 'month') return 'month-year-single';    // native <input type="month"> expects "YYYY-MM"
  if (t === 'date')  return 'date-single';          // native "YYYY-MM-DD"
  if( t==='year') return 'year-single';

  // Placeholder/ID heuristics
  if (/\bmm[\/\-]yyyy\b/.test(ph) || /\bmm[\/\-]yyyy\b/.test(idn))  return 'month-year-single';
  if (/\byyyy\b/.test(ph) || /\byear\b/.test(idn))                  return 'year-single';
  if (/\bdate\b/.test(idn) || /\bmm[\/\-]dd[\/\-]yyyy\b/.test(ph))  return 'date-single';

  return null;
}

// turn a parsed {year,month,day} into the string the field expects
function formatForGranularity(granularity, parts){
  if (!parts) return '';
  const {year, month, day} = parts;

  switch (granularity){
    case 'year-single':
      return year ? String(year) : '';
    case 'month-year-single':
      // Prefer native input[type=month] "YYYY-MM"; if the site wants "MM/YYYY" we’ll rewrite later if needed.
      if (year && month) return `${year}-${p2(month)}`;
      // If month missing, degrade to just year to avoid junk
      return year ? String(year) : '';
    case 'date-single':
      // Use safe fallback day=01 if missing
      if (year && month) return `${year}-${p2(month)}-${p2(day||1)}`;
      return year ? `${year}-01-01` : '';
    default:
      return '';
  }
}
function refineDateHumanNameAndGroup(obj){
  const el   = obj.element;
  const id   = el.id   || '';
  const name = el.name || '';
  const key  = (id + ' ' + name).toLowerCase();

  const isStart = /\b(startdate|start_date|fromdate|from_date|from|firstyearattended)\b/.test(key);
  const isEnd   = /\b(enddate|end_date|todate|to_date|to|lastyearattended)\b/.test(key);
  const side    = isStart ? 'from' : (isEnd ? 'to' : null);

  const mentionsMonth = /\bmonth\b|datesectionmonth|\bmm\b/.test(key);
  const mentionsYear  = /\byear\b|datesectionyear|\byyyy\b/.test(key);
  const mentionsDay   = /\bday\b|datesectionday|\bdd\b/.test(key);   // ⬅️ new

  const singleGran = detectSingleDateGranularity(el);
  if (side && (mentionsMonth || mentionsYear || mentionsDay)){
    const part = mentionsMonth ? 'month' : mentionsYear ? 'year' : 'day';
    obj.humanName = `${side} ${part}`;
    obj.groupId   = obj.groupId || `date:${side}`;
    obj._dateMeta = { mode: 'split', side, part };
    return;
  }

  if (side && singleGran){
    obj.humanName = `${side} ${singleGran}`;
    obj.groupId   = obj.groupId || `date:${side}`;
    obj._dateMeta = { mode: 'single', side, granularity: singleGran };
    return;
  }

  if (!side && /start|begin|from/i.test(obj.humanName||'')){
    obj._dateMeta = { mode: singleGran ? 'single':'unknown', side: 'from', granularity: singleGran||null };
    obj.groupId   = obj.groupId || `date:from`;
    return;
  }
  if (!side && /\bend|finish|to\b/i.test(obj.humanName||'')){
    obj._dateMeta = { mode: singleGran ? 'single':'unknown', side: 'to', granularity: singleGran||null };
    obj.groupId   = obj.groupId || `date:to`;
    return;
  }

  if (singleGran){
    obj._dateMeta = { mode: 'single', side: null, granularity: singleGran };
  }
}
function adaptMonthYearToPlaceholder(el, val, parts){
  const ph = (el.getAttribute('placeholder')||'').toLowerCase();
  if (!parts || !parts.year || !parts.month) return val;
  if (/\bmm[\/\-]yyyy\b/.test(ph)) return `${p2(parts.month)}/${parts.year}`;
  return val; // keep "YYYY-MM"
}
const MONTH_NAMES = ['january','february','march','april','may','june','july','august','september','october','november','december'];

function optionText(el){
  return (el.textContent || el.label || '').trim().toLowerCase();
}

function findOptionIndex(el, candidates){
  const opts = Array.from(el.options || []);
  // exact first, then contains
  for (const c of candidates){
    const idx = opts.findIndex(o => optionText(o) === c);
    if (idx >= 0) return idx;
  }
  for (const c of candidates){
    const idx = opts.findIndex(o => optionText(o).includes(c));
    if (idx >= 0) return idx;
  }
  return -1;
}

function monthCandidates(m){
  const n = Number(m);
  if (!n || n < 1 || n > 12) return [];
  const name = MONTH_NAMES[n-1];
  return [
    String(n),                     // "3"
    String(n).padStart(2,'0'),     // "03"
    name,                          // "march"
    name.slice(0,3)                // "mar"
  ];
}
function resolveDateSource(obj){ // entry = one experience/education item
  // Prefer the metadata side, fall back to humanName hints
  const side = obj._dateMeta?.side
    || (/\b(from|start)\b/i.test(obj.humanName || '') ? 'from'
        : /\b(to|end)\b/i.test(obj.humanName || '') ? 'to' : null);

  return side;
}
async function fillDate(el, obj,value,{currentlyWorkHere=false}={}){
  //console.log('filldate datemeta',obj._dateMeta);
  // 1) Resolve ISO source
  const side = resolveDateSource(obj);
  const iso = value;
  //console.log('filldate side and iso:',side,iso);
  if (side === 'to' && currentlyWorkHere) {
    //console.log('filDate, skipping to.. because of currently working');
    // Many pages disable/ignore end date if "currently work here" is checked
    return;
  }

  // 2) Parse parts
  const parts = parseISOish(iso); //returns the data with split(year,month and day)
  //console.log('fillDate, splitting ymd:',parts.year,parts.month,parts.day);
  const tag = (el.tagName || '').toUpperCase();
  //const type = (el.type || '').toLowerCase();

  // 3) If we have explicit split meta (month/year pieces)
  if (obj._dateMeta?.mode === 'split'){
    if (!parts) return;
    if (obj._dateMeta.part === 'year'){
      const val = parts.year ? String(parts.year) : '';
      if (tag === 'SELECT') {
        //console.log('filldate year select tag val:',val)
        const idx = findOptionIndex(el, [String(parts.year)]);
        if (idx >= 0) { el.selectedIndex = idx; el.dispatchEvent(new Event('change', {bubbles:true})); }
        else{//console.log('fillDate skipping tag and entering regular type fill');
          await fillInput(el, val);}
      } else {
        //console.log('fillDate 2.year skipping tag and entering regular type fill');
        await fillInput(el, val);
      }
      return;
    }
    if (obj._dateMeta.part === 'month'){
      if (!parts.month){ /* degrade quietly if month unknown */ console.log('fillDate skipping month fill because off no value:',val); return; }
      if (tag === 'SELECT'){
        //console.log('filldate month select tag val:',val)
        const idx = findOptionIndex(el, monthCandidates(parts.month));
        if (idx >= 0){
          el.selectedIndex = idx;
          el.dispatchEvent(new Event('change', {bubbles:true}));
        }else{
          //console.log('fillDate 1.skipping month tag and entering regular type fill');
          await fillInput(el, String(parts.month).padStart(2,'0'));
        }
      }else{
        //console.log('fillDate 2.month skipping tag and entering regular type fill');
        await fillInput(el, String(parts.month).padStart(2,'0'));
      }
      return;
    }
    if (obj._dateMeta.part === 'day'){
      if (!parts.month){ /* degrade quietly if month unknown */ console.log('fillDate skipping day fill because off no value:',val); return; }
      if (tag === 'SELECT'){
        //console.log('filldate day select tag val:',val)
        const idx = findOptionIndex(el, parts.day);
        if (idx >= 0){
          el.selectedIndex = idx;
          el.dispatchEvent(new Event('change', {bubbles:true}));
        }else{
          //console.log('fillDate 1.skipping day tag and entering regular type fill');
          await fillInput(el, String(parts.day).padStart(2,'0'));
        }
      }else{
        //console.log('fillDate 2.month skipping tag and entering regular type fill');
        await fillInput(el, String(parts.day).padStart(2,'0'));
      }
      return;
    }
    

    

  }
  // 4) Single-field date
  // Detect granularity if metadata missing (defensive)
  const gran = obj._dateMeta?.granularity || detectSingleDateGranularity(el);
  let val = formatForGranularity(gran, parts);
  //console.log('filldate,gran value:',val);
  // adapt to "MM/YYYY" placeholders when it's a month-year control
  if (gran === 'month-year-single'){
    val = adaptMonthYearToPlaceholder(el, val, parts);
    //console.log('filldate,gran month-year-single value:',val);
  }

  // For <select> style "single" fields (rare), try options too
  if (tag === 'SELECT'){
    const candidates =
      gran === 'year-single'       ? [String(parts?.year || '')]
    : gran === 'month-year-single' ? (parts?.month ? monthCandidates(parts.month).map(c=>/\d{2}/.test(c)? `${c}/${parts.year}`: c) : [])
    : gran === 'date-single'       ? [val, val.replace(/-/g,'/')]
    : [val];

    const idx = findOptionIndex(el, candidates.map(s => String(s).toLowerCase()));
    if (idx >= 0){
      el.selectedIndex = idx;
      el.dispatchEvent(new Event('change', {bubbles:true}));
      return;
    }
  }

  // 5) Default to input fill
  console.log('filldate final going for fill input with value:',val);
  await fillInput(el, val);
}
const processedDateBatches = new Set(); // separate from your processedGroups for radios/checkboxes

function batchKeyForDate(decision, obj){
  const side = obj._dateMeta?.side || 'na';
  // decision has { kind, index } like 'experience' / 2  or 'education' / 1
  if(decision.kind && decision.index){
    return `${decision.kind}:${decision.index}:${side}`
  }
  else{
    return `${decision.dataKey}:${side}`
  }
}

// gather up to 3 nearby split-date peers (day/month/year) with same groupId & side
function collectLocalSplitDatePeers(inputs, startIdx, obj){
  const side    = obj._dateMeta?.side || '';
  const groupId = obj.groupId;
  const peers = new Map(); // part -> {obj, idx}

  // scan up to 2 back and 3 forward to capture day/month/year even if order varies
  const lo = Math.max(0, startIdx - 2);
  const hi = Math.min(inputs.length - 1, startIdx + 3);

  for (let i = lo; i <= hi; i++){
    const p = inputs[i];
    if (!p || p._dateMeta?.mode !== 'split') continue;
    if (p.groupId !== groupId) continue;
    if ((p._dateMeta?.side || '') !== side) continue;

    const part = p._dateMeta.part; // 'day' | 'month' | 'year'
    if (part && !peers.has(part)) peers.set(part, { obj: p, idx: i });
    if (peers.size >= 3) break;
  }

  // order month -> year -> day (month first helps some validators)
  const order = ['month', 'year', 'day'];
  return order.map(k => peers.get(k)?.obj).filter(Boolean);
}

//===select helpers
function splitMultiValues(val) {
  return val.split(/[,;/|]+/).map(v => v.trim()).filter(Boolean);
}
function isComplexDropdown(el) {
  return (
    el.getAttribute('role') === 'combobox' ||
    el.closest('.MuiAutocomplete-root, .ant-select, .rc-select')
  );
}
async function fillSelectElement(el, value, opts={}) {
  if (!el || el.disabled || el.readOnly) return;
  const tag = el.tagName?.toUpperCase?.();
  const valStr = (value ?? '').toString().trim();
  if (!valStr) return;
  // Scroll to make it visible
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  simulateMouse(el);
  await delay(50);
  // ----- Case 1: Native <select> (single)
  if (tag === 'SELECT' && !el.multiple) {
    console.log('1. fillselectelement func,select but not multiple');
    const match = [...el.options].find(opt =>
      normalizeFieldNameWithSpace(opt.textContent || '').includes(
        normalizeFieldNameWithSpace(valStr)
      )
    );
    if (match) {
      el.value = match.value;
      el.selectedIndex = match.index;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }
  }

  // ----- Case 2: Native <select multiple>
  if (tag === 'SELECT' && el.multiple) {
    console.log('2. Fillselectelement func select and multiple');
    const vals = splitMultiValues(valStr);
    let changed = false;
    for (const opt of el.options) {
      const shouldSelect = vals.some(v =>
        normalizeFieldNameWithSpace(opt.textContent || '').includes(
          normalizeFieldNameWithSpace(v)
        )
      );
      if (opt.selected !== shouldSelect) {
        opt.selected = shouldSelect;
        changed = true;
      }
    }
    if (changed) {
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }
    return true;
  }

  // ----- Case 3: Custom dropdown (MUI / Ant / React-Select / Ashby)
  //Ashby selects
  if (isComplexDropdown(el) && (isAshbyHost || isGreenhouseHost)) {
    console.log('3. fillselectelement func select and complexdropdown');
    const timeout = opts.timeout ?? 1500;
    const radius  = opts.radius ?? 700;
    const exactFirst = opts.exactFirst ?? true;
    /*const btn = findNearestDropdownButton(el);
    console.log('btn found in fillworkday:',btn);
    //if (!btn) return false;
    // 1) Open the popup
    //simulatePointerClick(btn);
    */
    const findComboTextInput = (root) => {
      if (root.tagName === 'INPUT') return root;
      return (
        root.querySelector('input[type="text"]') ||
        root.querySelector('input:not([type])') ||
        root.querySelector('[role="textbox"]') ||
        root
      );
    };
    const textBox = findComboTextInput(el);
    if (!textBox) return false;
    // 3.2 set the value with native setter + input events so React sees it
    const setNative = (input, val) => {
      const proto = Object.getPrototypeOf(input);
      const desc  = Object.getOwnPropertyDescriptor(proto, 'value');
      const setter = desc && desc.set;
      if (setter) setter.call(input, val);
      else input.value = val;

      try { input.dispatchEvent(new InputEvent('beforeinput', { bubbles:true, inputType:'insertText', data:String(val) })); } catch {}
      input.dispatchEvent(new Event('input',  { bubbles:true, composed:true }));
      input.dispatchEvent(new Event('change', { bubbles:true, composed:true }));
    };

    // 3.3 focus, put the text, nudge with a key to trigger filtering
    textBox.focus();
    simulateMouse(textBox);
    setNative(textBox, valStr);
    textBox.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    textBox.dispatchEvent(new KeyboardEvent('keyup',   { key: 'ArrowDown', bubbles: true }));
    await waitUntil(() => textBox.getAttribute('aria-expanded') === 'true', 350);
    // 2) Find nearest listbox to this button
    let listbox = await waitForNearestListbox(textBox, timeout, radius);
    console.log('list box found:',listbox);
    if (!listbox) {
      console.log('list box not found, so trying one more time')
      // one retry: click again then re-scan
      simulatePointerClick(textBox);
      await delay(120);
      listbox = await waitForNearestListbox(textBox, timeout, radius);
      console.log('fter trying 2nd time listbox',listbox);
      if (!listbox) return false;
    }
    // 3) Try to select the option by scanning (handles virtualized lists via scrolling)
    const picked = await scanAndSelectOption(listbox, value, { exactFirst, timeout });
    if (!picked) {
      // fallback: send ESC to close if still open
      console.log('No picked options')
      tryClosePopup(textBox, listbox);
      return false;
    }
    // 4) Close the popup (many WD lists auto-close on selection; but ensure)
    tryClosePopup(textBox, listbox);
    return true;
  }
  // Case 3: Custom dropdown (MUI/Ant/React-Select etc.) 
  if (isComplexDropdown(el)) { 
    console.log('4. fillselectelement func select and complexdropdown2') 
    try { 
      el.click(); 
      await delay(200); 
      const list = document.querySelector('[role="listbox"], ul[role="menu"], .MuiAutocomplete-popper, .ant-select-dropdown, .rc-virtual-list-holder'); 
      if (!list) return false; 
      const options = [...list.querySelectorAll('[role="option"], li, div')]; 
      const target = options.find(opt => normalizeFieldNameWithSpace(opt.textContent || '').includes( normalizeFieldNameWithSpace(valStr) ) );
       if (target) { 
        clickOptionLike(target); return true; 
      } 
      // fallback: close if not found 
      document.body.click(); 
    } 
    catch (err) { 
      console.warn('5.fillSelectElement func custom dropdown failed', err); 
    } 
    return true;
  }
  return false;

}

function isWorkdayCombo(el){ 
  // Prefer the nearest WD-ish container if present, else fall back to a div
  const root = el.closest(
    '[data-automation-id*="select"],' +                 // e.g., multiSelectContainer, selectDropdown, etc.
    '[data-uxi-widget-type="selectinput"],' +          // WD select input widget
    '[data-automation-id*="multiSelect"],' +           // multiSelectContainer
    '[data-automation-id*="prompt"],' +                // promptIcon / promptOption
    'div'
  );
  if (!root) return false;

  // Base signals (your originals)
  const hasButton = !!root.querySelector('button[aria-haspopup="listbox"], button[aria-expanded]');
  const hasText   = !!root.querySelector('input[type="text"], input:not([type]), input[role="combobox"], [role="combobox"]');
  const hasArrow  = !!root.querySelector('[data-automation-id="promptIcon"], [class*="promptIcon"], span, svg, i');

  // Workday-specific strong signals (seen in your screenshot)
  const hasWDAtt = (
    root.matches('[data-automation-id], [data-uxi-widget-type]') ||
    !!root.querySelector(
      '[data-automation-id*="select"],' +
      '[data-automation-id*="multiSelect"],' +
      '[data-automation-id*="prompt"],' +
      '[data-uxi-widget-type="selectinput"]'
    )
  );

  // Nearby listbox cues (often rendered/telegraphed even if virtualized)
  const hasListboxHints = !!root.querySelector(
    '[role="listbox"], [aria-controls*="listbox"], [id*="listbox"], [data-automation-id*="selectDropdown"]'
  );

  // Two ways to declare "combo":
  // 1) Your original triad (button + text + arrow)
  // 2) WD multiselect variant (text + WD signals + (arrow OR listbox hints))
  const classicCombo = hasButton && hasText && hasArrow;
  const wdCombo = hasText && hasWDAtt && (hasArrow || hasListboxHints);

  const result = classicCombo || wdCombo;
  // Optional debug
  // console.log({ classicCombo, wdCombo, hasButton, hasText, hasArrow, hasWDAtt, hasListboxHints });
  return result;
}

function tryClosePopup(btn, listbox) {
  // If still expanded, try ESC first (less intrusive than body click)
  if (btn?.getAttribute('aria-expanded') === 'true') {
    listbox?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    listbox?.dispatchEvent(new KeyboardEvent('keyup',   { key: 'Escape', bubbles: true }));
  }
  // If stubborn, click outside once
  if (btn?.getAttribute('aria-expanded') === 'true') {
    document.body.click();
  }
}

function simulatePointerClick(el) {
  const r = el.getBoundingClientRect();
  const x = r.left + r.width / 2, y = r.top + Math.min(r.height / 2, 16);
  el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: x, clientY: y }));
  el.dispatchEvent(new MouseEvent('mousedown',    { bubbles: true, clientX: x, clientY: y }));
  el.dispatchEvent(new MouseEvent('mouseup',      { bubbles: true, clientX: x, clientY: y }));
  el.click();
  el.dispatchEvent(new PointerEvent('pointerup',  { bubbles: true, clientX: x, clientY: y }));
}

function isClickableVisible(el){
  if (!isVisible(el)) return false;
  const cs = getComputedStyle(el);
  return cs.pointerEvents !== 'none';
}

function getCenter(el){
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width/2, y: r.top + r.height/2 };
}

function distance(a,b){ return Math.hypot(a.x - b.x, a.y - b.y); }

function norm(s){
  return (s ?? '')
    .toString()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')   // strip accents
    .replace(/[^a-z0-9+%&().,\-\/\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function fuzzyScore(txt, want){
  if (!txt || !want) return 0;
  if (txt === want) return 1;
  if (txt.startsWith(want)) return 0.9;
  if (txt.includes(want)) return Math.min(0.88, want.length / Math.max(txt.length, 1));
  // token overlap
  const A = new Set(txt.split(' ')), B = new Set(want.split(' '));
  let hit = 0; B.forEach(t => { if (A.has(t)) hit++; });
  return hit / Math.max(B.size, 1) * 0.7;
}

function clickOptionLike(opt){
  opt.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
  opt.dispatchEvent(new MouseEvent('mousedown',    { bubbles: true }));
  opt.dispatchEvent(new MouseEvent('mouseup',      { bubbles: true }));
  opt.click();
  opt.dispatchEvent(new PointerEvent('pointerup',  { bubbles: true }));
}

function delay(ms){ return new Promise(r => setTimeout(r, ms)); }

async function waitUntil(pred, ms = 600, step = 30){
  const t0 = performance.now();
  while (performance.now() - t0 < ms) {
    if (pred()) return true;
    await delay(step);
  }
  return false;
}
//Find the nearest visible listbox/menu to the anchor (button) within a radius.
async function waitForNearestListbox(anchor, timeout = 1200, radius = 700) {
  const start = performance.now();
  const anchorCenter = getCenter(anchor);

  const pick = () => {
    // Common WD portals: role=listbox/menu, sometimes data-automation-id=listbox
    const candidates = [
      ...document.querySelectorAll('[role="listbox"], [role="menu"], [data-automation-id="listbox"]')
    ].filter(isVisible);

    let best = null, bestD = Infinity;
    for (const c of candidates) {
      const d = distance(anchorCenter, getCenter(c));
      if (d < bestD && d <= radius) { best = c; bestD = d; }
    }
    return best;
  };

  while (performance.now() - start < timeout) {
    const lb = pick();
    if (lb) return lb;
    await delay(40);
  }
  return null;
}
/**
 * Scrolls a (possibly virtualized) listbox to find and click the best option.
 */
async function scanAndSelectOption(listbox, targetText, { exactFirst = true, timeout = 1500 } = {}) {
  const start = performance.now();
  const want = norm(targetText);

  // Ensure we start from the top
  listbox.scrollTop = 0;

  const seen = new Map(); // text -> element (last seen)
  let bestLoose = null;   // { el, score, txt }

  while (performance.now() - start < timeout) {
    const options = collectOptionNodes(listbox);
    console.log('options collected',options);

    for (const opt of options) {
      const txt = norm(opt.textContent);
      if (!txt) continue;

      // Dedup by text; keep the *currently visible* element so clicks work
      seen.set(txt, opt);

      if (exactFirst && (txt === want || txt.includes(want))) {
        clickOptionLike(opt);
        return true;
      }

      const score = fuzzyScore(txt, want);
      if (!bestLoose || score > bestLoose.score) bestLoose = { el: opt, score, txt };
    }

    // If we’re at the bottom, break
    const atBottom = Math.ceil(listbox.scrollTop + listbox.clientHeight) >= listbox.scrollHeight;
    if (atBottom) break;

    // Scroll further down to trigger virtualization
    listbox.scrollTop = Math.min(listbox.scrollTop + Math.max(40, Math.floor(listbox.clientHeight * 0.9)), listbox.scrollHeight);
    await delay(80);
  }

  // If exact/contains not found, try best fuzzy match (threshold keeps it sane)
  if (bestLoose && bestLoose.score >= 0.30) {
    clickOptionLike(bestLoose.el);
    return true;
  }

  return false;
}
function isToggleButton(n){
  if (!n || n.nodeType !== 1) return false;
  const tag = n.tagName?.toLowerCase();
  if (tag === 'button') {
    return n.hasAttribute('aria-haspopup') || n.hasAttribute('aria-expanded');
  }
  // Some UIs use div/span with role=button
  if ((n.getAttribute('role') === 'button') && n.hasAttribute('aria-haspopup')) return true;
  return false;
}

/**
 * Finds the nearest dropdown toggle button for a Workday-like combo.
 * Looks at self, then scans container & a few ancestors for a matching button.
 */
function findNearestDropdownButton(el, maxHops = 3){
  if (!el) return null;
  if (isToggleButton(el)) return el; // if caller passed the button itself

  // Prefer a semantic container first
  let container = el.closest('[data-automation-id], [role="group"], .wd-select, .wd-input, .MuiAutocomplete-root, .ant-select, div');

  // Walk up a few levels; within each, query for a proper toggle button
  let node = container || el;
  for (let i = 0; node && i <= maxHops; i++, node = node.parentElement) {
    const btn = node.querySelector(
      'button[aria-haspopup="listbox"], button[aria-expanded], [role="button"][aria-haspopup="listbox"]'
    );
    if (isToggleButton(btn)) return btn;
  }
  return null;
}

function collectOptionNodes(listbox) {
  // Workday variants + fallbacks (role=option most common)
  const sel = [
    '[role="option"]',
    '[data-automation-id="option"]',
    '[role="menuitem"]',
    'li',
    '.wd-option' // rare custom class; harmless if absent
  ].join(',');

  // Only return clickable/visible ones
  return [...listbox.querySelectorAll(sel)].filter(isClickableVisible);
}
/**
 * Open a Workday-style dropdown via its button, find the nearest popup listbox,
 * scroll through all options (even virtualized), select the best match, and close.
 *
 * @param {HTMLElement} el - the toggle button itself OR any descendant of the WD combo
 * @param {string} value  - visible text you want to pick
 * @param {object} opts   - { timeout?: number, radius?: number, exactFirst?: boolean }
 * @returns {Promise<boolean>}
 */
//workday selects
async function fillWorkdayByButton(el, value, opts = {}) {
  const timeout = opts.timeout ?? 1500;
  const radius  = opts.radius ?? 700;
  const exactFirst = opts.exactFirst ?? true;
  const btn = findNearestDropdownButton(el);
  console.log('btn found in fillworkday:',btn);
  if (!btn) return false;
  // 1) Open the popup
  simulatePointerClick(btn);
  await waitUntil(() => btn.getAttribute('aria-expanded') === 'true', 350);
  // 2) Find nearest listbox to this button
  let listbox = await waitForNearestListbox(btn, timeout, radius);
  console.log('list box found:',listbox);
  if (!listbox) {
    console.log('list box not found, so trying one more time')
    // one retry: click again then re-scan
    simulatePointerClick(btn);
    await delay(120);
    listbox = await waitForNearestListbox(btn, timeout, radius);
    console.log('fter trying 2nd time listbox',listbox);
    if (!listbox) return false;
  }
  // 3) Try to select the option by scanning (handles virtualized lists via scrolling)
  const picked = await scanAndSelectOption(listbox, value, { exactFirst, timeout });
  if (!picked) {
    // fallback: send ESC to close if still open
    console.log('No picked options')
    tryClosePopup(btn, listbox);
    return false;
  }

  // 4) Close the popup (many WD lists auto-close on selection; but ensure)
  tryClosePopup(btn, listbox);
  return true;
}

// ========= RESUME HELPERS (unchanged except for minor hygiene) =========
const FILE_POS_KW_RE = /\b(resume|cv|curriculum\s*vitae|cover\s*letter)\b/i;
const FILE_NEG_KW_RE = /\b(attach|upload|choose|select|browse|drag|drop|click|tap|select\s+one)\b/i;
const FILE_SIZE_HINT_RE = /\b(?:max(?:imum)?\s*size|size\s*limit)\b.*|\(\s*\d+(?:\.\d+)?\s*(kb|mb|gb)\s*max\)/i;
function isFileField(el){ return (el?.type||'').toLowerCase() === 'file'; }
function stripFileCtas(s){
  if(!s) return '';
  return s.replace(FILE_SIZE_HINT_RE,' ').replace(/\b(or)\b/ig,' ').replace(/\s+/g,' ').trim();
}
function findFileFieldName(field, maxHops = 6){
  if(!isFileField(field)) return '';
  const HEADING_SEL = 'h1,h2,h3,h4,h5,h6,span,strong,[role="heading"],legend,[data-automation-id],label';//,[data-automation-id*="Heading"],[data-automation-id*="title"],label';
  if(field.id){
    const lab = document.querySelector(`label[for="${CSS.escape(field.id)}"]`);
    const t = stripFileCtas(lab?.textContent || '');
    if(FILE_POS_KW_RE.test(t)) return normalizeFieldNameWithSpace(t);
  }
  let el = field;
  for(let hop=0; el && el!==document.body && hop<=maxHops; hop++, el = el.parentElement){
    const h = el.querySelector(HEADING_SEL)
    if(h?.textContent){
      const t = stripFileCtas(h.textContent);
      if(FILE_POS_KW_RE.test(t)) return normalizeFieldNameWithSpace(t);
    }
    const selfTxt = stripFileCtas(el.textContent || '');
    if(FILE_POS_KW_RE.test(selfTxt) && selfTxt.split(/\s+/).length > 2)
      return normalizeFieldNameWithSpace(selfTxt);

    let prev = el.previousElementSibling;
    if(prev){
      const prevTxt = stripFileCtas(prev.textContent || '');
      if(FILE_POS_KW_RE.test(prevTxt)) return normalizeFieldNameWithSpace(prevTxt);
      const prevHead = prev.matches(HEADING_SEL) ? prev : prev.querySelector(HEADING_SEL);
      if(prevHead?.textContent){
        const t = stripFileCtas(prevHead.textContent);
        if(FILE_POS_KW_RE.test(t)) return normalizeFieldNameWithSpace(t);
      }
    }
    el = el.parentElement;
  }
  return '';
}
/*************************************************
 * Host gating
 *************************************************/
const SET1_HOSTS = new Set([
  'icims.com',              // <- add more later
]);

const SET2_HOSTS = new Set([
  'ashbyhq.com',
  'myworkdayjobs.com',
  'greenhouse.io',
  'boards.greenhouse.io',
]);

function hostIn(set) {
  const h = (location.hostname || '').toLowerCase();
  for (const d of set) {
    if (h === d || h.endsWith(`.${d}`)) return true;
  }
  return false;
}

const IS_SET1 = hostIn(SET1_HOSTS); // needs all the special checks (icims)
const IS_SET2 = hostIn(SET2_HOSTS); // no special checks (plain resume fields)

/*************************************************
 * Existing helpers (unchanged except where noted)
 *************************************************/
// autofill.js (or your bundle)

// ----- Messaging-based session helpers -----
async function sessSet(obj) {
  const res = await chrome.runtime.sendMessage({ type: 'SESSION_SET', payload: obj });
  if (!res?.ok) throw new Error(res?.error || 'SESSION_SET failed');
  return true;
}
async function sessGet(keyOrNull) {
  const res = await chrome.runtime.sendMessage({ type: 'SESSION_GET', payload: keyOrNull ?? null });
  if (!res?.ok) throw new Error(res?.error || 'SESSION_GET failed');
  return res.data || {};
}
async function sessRemove(keyOrKeys) {
  const res = await chrome.runtime.sendMessage({ type: 'SESSION_REMOVE', payload: keyOrKeys });
  if (!res?.ok) throw new Error(res?.error || 'SESSION_REMOVE failed');
  return true;
}
async function sessClear() {
  const res = await chrome.runtime.sendMessage({ type: 'SESSION_CLEAR' });
  if (!res?.ok) throw new Error(res?.error || 'SESSION_CLEAR failed');
  return true;
}

// ----- Your pending flag helpers now just call sess* -----
const PENDING_KEY = 'ja_resume_pending_v1';
function pageKey() {
  try { return `${location.origin}${location.pathname}`; }
  catch { return location.href; }
}
async function setPendingResumeUpload(resumeSrc) {
  if (!IS_SET1) return;
  await sessSet({ [PENDING_KEY]: { page: pageKey(), t: Date.now(), resumeSrc } });
}
async function getPendingResumeUpload() {
  if (!IS_SET1) return null;
  const o = await sessGet(PENDING_KEY);
  return o?.[PENDING_KEY] || null;
}
async function clearPendingResumeUpload() {
  if (!IS_SET1) return;
  await sessRemove(PENDING_KEY);
}

const parsedFileInputs = new WeakSet();
function markAutofilled(el, source='resume') {
  try { el.setAttribute('data-autofilled', 'true'); } catch {}
  try { el.setAttribute('data-resume-parsed', 'true'); } catch {}
  try { el.dataset.afSource = source; } catch {}
  parsedFileInputs.add(el);
}
function setFilesWithNativeSetter(input, fileList) {
  try {
    // 1) Try the element's own descriptor (rare)
    const own = Object.getOwnPropertyDescriptor(input, 'files');
    if (own?.set) {
      own.set.call(input, fileList);
      return;
    }
    // 2) Try HTMLInputElement prototype
    const proto = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'files');
    if (proto?.set) {
      proto.set.call(input, fileList);
      return;
    }
    // 3) As a last resort, define then assign (some sites lock it)
    Object.defineProperty(input, 'files', { configurable: true, writable: true, value: fileList });
  } catch (e) {
    console.warn('[resume] native setter failed, will attempt direct assign', e);
    try { input.files = fileList; } catch (e2) { console.error('[resume] direct assign failed', e2); }
  }
}

function dataURLtoBlob(dataurl){
  try{
    const [meta, data] = dataurl.split(',');
    const mime = ((meta || '').match(/:(.*?);/) || [])[1] || 'application/octet-stream';
    const bstr = atob((data || ''));
    const u8 = new Uint8Array(bstr.length);
    for (let i = 0; i < bstr.length; i++) u8[i] = bstr.charCodeAt(i);
    return new Blob([u8], { type: mime });
  }catch(e){
    console.error('[resume] dataURLtoBlob failed', e);
    return new Blob([], { type: 'application/octet-stream' });
  }
}

function fetchResumeFromBackground(fileUrl){
  return new Promise((resolve, reject)=>{
    try{
      chrome.runtime.sendMessage({ action:'fetchResume', fileUrl }, (resp)=>{
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError?.message || 'runtime error');
          return;
        }
        if (resp && resp.success && resp.fileData) resolve(resp);
        else reject(resp?.error || 'background fetch failed');
      });
    }catch(e){ reject(e); }
  });
}
// Some ATS require a user gesture before file assignment
async function withUserGesture(input, fn){
  try {
    input.focus();
    // A short, real click tends to satisfy most defenses
    //input.click?.();
    await new Promise(r => setTimeout(r, 30));
  } catch {}
  return await fn();
}
async function simulateFileSelectionFromBackground(inputElement, fileUrl){
  console.log('1. entered into simulate function');
  const src = fileUrl.startsWith('http') ? fileUrl : `${API_BASE_URL}${fileUrl}`;
  const { fileData, filename } = await fetchResumeFromBackground(src);
  const blob = dataURLtoBlob(fileData);
  const file = new File([blob], filename || (src.split('/').pop() || 'resume.pdf'), { type: blob.type || 'application/pdf' });
  const dt = new DataTransfer();
  dt.items.add(file);
  console.log('2.. In simulatefileselection func before ensure visible')
  console.log('3.. In simulatefileselection func going to set the file')
  return withUserGesture(inputElement, async () => {
    inputElement.dispatchEvent(new Event('focus', { bubbles: true }));
    // Emit an innocuous input event pre-assignment to wake frameworks
    inputElement.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
    setFilesWithNativeSetter(inputElement, dt.files);
    // Many frameworks listen to 'change' only
    inputElement.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
    // Some also react to a second input after change
    inputElement.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
    inputElement.blur();
    inputElement.dispatchEvent(new Event('blur', { bubbles: true }));
    return true;
  });
}
/*
// Shadow DOM walker for dropzones
function* iterateRoots(root = document){
  yield root;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, null);
  let node;
  while (node = walker.nextNode()){
    if (node.shadowRoot) yield* iterateRoots(node.shadowRoot);
  }
}

function collectDropzones(){
  const sel = [
    '.dropzone','[data-dropzone]','.file-drop','.upload-drop','[role="button"].drop',
    '.upload-area','.dz-clickable','.dz-default','.attachment-drop','.file-uploader',
    // Common ATS/UX patterns
    '[aria-label*="drop file" i]','[aria-label*="upload" i]','[data-testid*="drop" i]',
    '[class*="drop" i]','[class*="upload" i]'
  ].join(',');

  const zones = new Set();
  for (const r of iterateRoots(document)) {
    r.querySelectorAll(sel).forEach(z => zones.add(z));
    // texty targets like “Drop your resume here”
    r.querySelectorAll('*').forEach(el=>{
      const t = (el.textContent || '').toLowerCase();
      if (t && t.length < 200 && (t.includes('drop') || t.includes('drag') || t.includes('upload'))) {
        zones.add(el);
      }
    });
  }
  return [...zones];
}

async function tryAttachToDropzones(fileUrl, { attempts = 3, perZoneTries = 2 } = {}){
  console.log('1. entered into dropzone function');
  const src = fileUrl.startsWith('http') ? fileUrl : `${API_BASE_URL}${fileUrl}`;
  const { fileData, filename } = await fetchResumeFromBackground(src);
  const blob = dataURLtoBlob(fileData);
  const file = new File([blob], filename || (src.split('/').pop() || 'resume.pdf'), { type: blob.type || 'application/pdf' });
  let zones = collectDropzones();
  console.log('2. entered into dropzone function before zones.length');
  if (!zones.length) return false;
  const buildDT = () => {
    const dt = new DataTransfer();
    dt.items.add(file);
    return dt;
  };
  console.log('3. entered into dropzone resume attach.');
  const dispatchDrag = async (z) => {
    z.classList.add('autofill-drop-indicator');

    const dt = buildDT();
    // Some engines ignore the ctor payload; set .dataTransfer after construct if needed
    const mkEvent = (type) => {
      let ev;
      try { ev = new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: dt }); }
      catch { ev = new DragEvent(type, { bubbles: true, cancelable: true }); }
      try { Object.defineProperty(ev, 'dataTransfer', { value: dt }); } catch {}
      return ev;
    };

    z.dispatchEvent(mkEvent('dragenter'));
    await new Promise(r => setTimeout(r, 40));
    z.dispatchEvent(mkEvent('dragover'));
    await new Promise(r => setTimeout(r, 40));
    z.dispatchEvent(mkEvent('drop'));

    // Allow any async parse spinners to mount
    await new Promise(r => setTimeout(r, 400));
    z.classList.remove('autofill-drop-indicator');
    return true;
  };

  for (let a = 0; a < attempts; a++){
    for (const z of zones){
      for (let k = 0; k < perZoneTries; k++){
        try {
          const ok = await dispatchDrag(z);
          if (ok) return true;
        } catch (e) {
          z?.classList?.remove('autofill-drop-indicator');
          // continue trying other zones
        }
      }
    }
    // re-scan; some sites replace the node after first try
    await new Promise(r => setTimeout(r, 200));
    zones = collectDropzones();
  }
  return false;
}
*/
/*
function setFilesWithNativeSetter(input, fileList) {
  const desc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'files');
  if (desc?.set) desc.set.call(input, fileList);
  else input.files = fileList;
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

  return true;
}
  */
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
      return true;
    }catch(e){
      z.classList?.remove('autofill-drop-indicator');
    }
  }
  return false;
}
const RESUME_POS = [/\bresume\b/i, /\bcv\b/i, /\bcurriculum\s*vitae\b/i, /\brésumé\b/i];
const RESUME_NEG = [/\bcover\s*letter\b/i, /\btranscript\b/i, /\breferences?\b/i];
function isResumeHumanName(name=''){
  const t = String(name || '').trim();
  if (!t) return false;
  if (RESUME_NEG.some(r => r.test(t))) return false;
  return RESUME_POS.some(r => r.test(t));
}

/*************************************************
 * Wait for ATS parsers to finish — used only on SET1
 *************************************************/
async function waitForResumeParseToFinish({
  timeoutMs = 15000,
  quietMs   = 1200,
  pollMs    = 200
} = {}) {
  if (!IS_SET1) return { navigated:false }; // <-- gate: skip for set2/others

  const startKey = pageKey();

  const spinnerSel = [
    '.spinner', '.loading', '[aria-busy="true"]',
    '.wd-loading', '.icims-loading', '.ashby-loading',
    '.sr-loading', '.gh-loading', '[data-test="loading"]'
  ].join(',');

  const snapshotInputs = () => {
    const arr = [];
    document.querySelectorAll('input, textarea, select').forEach(el => {
      if (!el || !(el instanceof HTMLElement)) return;
      const type = (el.type || '').toLowerCase();
      if (type === 'password' || type === 'hidden') return;
      arr.push({ el, val: ('value' in el ? el.value : ''), disabled: !!el.disabled });
    });
    return arr;
  };
  const hasValuesChanged = (b, a) => {
    if (a.length !== b.length) return true;
    for (let i=0; i<b.length; i++){
      const x=b[i], y=a[i];
      if (x.el !== y.el) return true;
      if (x.val !== y.val) return true;
      if (x.disabled !== y.disabled) return true;
    }
    return false;
  };

  const before = snapshotInputs();
  let lastDomChange = performance.now();
  const mo = new MutationObserver(() => { lastDomChange = performance.now(); });
  try { mo.observe(document.documentElement, { childList:true, subtree:true, attributes:true, characterData:true }); } catch {}

  const hasSpinner = () => !!document.querySelector(spinnerSel);
  const urlChanged = () => pageKey() !== startKey;

  const t0 = performance.now();
  while (performance.now() - t0 < timeoutMs) {
    const after = snapshotInputs();
    const valueChurn = hasValuesChanged(before, after);

    if (urlChanged() || (valueChurn && !hasSpinner())) break;
    await delay(pollMs);
  }

  const quietStart = performance.now();
  while (performance.now() - quietStart < quietMs) {
    if (performance.now() - lastDomChange < quietMs/2) {
      await delay(pollMs);
      continue;
    }
    await delay(pollMs);
  }

  try { mo.disconnect(); } catch {}
  return { navigated: urlChanged() };
}
async function handleFileInput(input, fileUrl){
  const t = (input?.type || '').toLowerCase();
  if (t !== 'file' || input.disabled || input.readOnly) return false;
  console.log('1.handlefileinput func entered')
  // If a file already present, skip
  if (input.files && input.files.length > 0) {
    console.log('2. handlefileinput func file already present on this input — skipping upload');
    markAutofilled(input, 'resume');
    return true;
  }

  // --- SET1 (icims): full pending + wait + re-entry support ---
  if (IS_SET1) {
    try { await setPendingResumeUpload(fileUrl); } catch {}
    try {
      const ok = await simulateFileSelectionFromBackground(input, fileUrl);
      if (ok) {
        const res = await waitForResumeParseToFinish();
        markAutofilled(input, 'resume');
        // Log pending state safely (no storage.session direct from CS)
        try {
          const pending = await getPendingResumeUpload();
          console.log('[resume] pending (after native set):', pending);
          if (pending && !res?.navigated && pending.page === pageKey()) {
            await clearPendingResumeUpload();
          }
        } catch {}
        return true;
      }
    } catch (e) {
      console.log('[resume] native set failed, trying dropzone', e);
    }

    try {
      const ok2 = await tryAttachToDropzones(fileUrl);
      if (ok2) {
        const res = await waitForResumeParseToFinish();
        markAutofilled(input, 'resume');
        try {
          const pending = await getPendingResumeUpload();
          console.log('[resume] pending (after drop):', pending);
          if (pending && !res?.navigated && pending.page === pageKey()) {
            await clearPendingResumeUpload();
          }
        } catch {}
        return true;
      }
    } catch (e) {
      console.log('[resume] dropzone failed', e);
    }
   /*
    // Last-ditch: show a clickable anchor next to the input
    try{
      const src = fileUrl.startsWith('http') ? fileUrl : `${API_BASE_URL}${fileUrl}`;
      const filename = src.split('/').pop() || 'resume.pdf';
      const a = document.createElement('a');
      a.href = src; a.textContent = filename; a.target='_blank';
      a.style.display='inline-block'; a.style.marginLeft='8px'; a.style.color='#06c'; a.style.textDecoration='underline';
      input.parentNode?.insertBefore(a, input.nextSibling);
    }catch{} */
    return false;
  }

  // --- SET2 (ashby/workday/greenhouse) & others: simple upload, no waits/flags ---
  try {
    const ok = await simulateFileSelectionFromBackground(input, fileUrl);
    if (ok) { markAutofilled(input, 'resume'); return true; }
  } catch (e) {
    console.log('[resume] simple upload failed, trying dropzone (set2/others)', e);
  try {
    const ok2 = await tryAttachToDropzones(fileUrl);
    if (ok2) { markAutofilled(input, 'resume'); return true; }
  } catch { console.log('[resume] trying dropzone  failed', e);}
  }/*
    // Last-ditch: show a clickable anchor next to the input
  try{
    const src = fileUrl.startsWith('http') ? fileUrl : `${API_BASE_URL}${fileUrl}`;
    const filename = src.split('/').pop() || 'resume.pdf';
    const a = document.createElement('a');
    a.href = src; a.textContent = filename; a.target='_blank';
    a.style.display='inline-block'; a.style.marginLeft='8px'; a.style.color='#06c'; a.style.textDecoration='underline';
    input.parentNode?.insertBefore(a, input.nextSibling);
  }catch{}*/

  return false;
}

async function resumeFirstFromInputs(inputs, autofillData, watchMs = 1000) {
  if (!Array.isArray(inputs) || !inputs.length) return { ok:false, reason:'no-inputs' };
  console.log('1 resumefirst func parsing started');

  const resumeFile = autofillData?.['resume'];
  if (!resumeFile) {
    console.log('[resume] no resume file/url on autofillData["resume"]');
    return { ok:false, reason:'no-resume-data' };
  }

  const candidates = inputs.filter(o => {
    const el = o?.element;
    if (!el) return false;
    const t = (el.type || '').toLowerCase();
    if (t !== 'file') return false;
    if (!o.humanName) return false;
    return isResumeHumanName(o.humanName);
  });

  if (candidates.length === 0) return { ok:false, reason:'no-resume-file-input' };

  let anySuccess = false;

  for (const r of candidates) {
    const el = r.element;
    const label = String(r.humanName || '');

    // Skip ATS-wide "autofill" slots
    if (label.toLowerCase().includes('autofill')) {
      console.log('2.resumefirst func skipping autofill-slot:', label);
      continue;
    }

    // input already has a file (e.g., after refresh)
    if (el.files && el.files.length > 0) {
      console.log('3.resume first func input already has file, skipping:', label);
      markAutofilled(el, 'resume');
      anySuccess = true;
      continue;
    }

    console.log('4.resume frist func uploading into:', label);
    try {
      const ok = await handleFileInput(el, resumeFile);
      if (ok) {
        anySuccess = true;
        if (IS_SET1) await new Promise(r => setTimeout(r, Math.max(500, watchMs)));
      }
    } catch (e) {
      console.log('[resume] file handle error', e);
    }
  }

  return anySuccess ? { ok:true } : { ok:false, reason:'resume-upload-failed' };
}
/*
//New resume helpers regarding page refresh
function pageKey() {
  try { return `${location.origin}${location.pathname}`; }
  catch { return location.href; }
}

// ===== Session marker to survive refresh/rerender =====
const PENDING_KEY = 'ja_resume_pending_v1';

async function setPendingResumeUpload(resumeSrc) {
  try { await chrome.storage.session.set({ [PENDING_KEY]: { page: pageKey(), t: Date.now(), resumeSrc } }); } catch {}
}
async function getPendingResumeUpload() {
  try { const o = await chrome.storage.session.get(PENDING_KEY); return o?.[PENDING_KEY] || null; } catch { return null; }
}
async function clearPendingResumeUpload() {
  try { await chrome.storage.session.remove(PENDING_KEY); } catch {}
}
// ===== Marking parsed file inputs =====
const parsedFileInputs = new WeakSet();
function markAutofilled(el, source='resume') {
  try { el.setAttribute('data-autofilled', 'true'); } catch {}
  try { el.setAttribute('data-resume-parsed', 'true'); } catch {}
  try { el.dataset.afSource = source; } catch {}
  parsedFileInputs.add(el);
}
function setFilesWithNativeSetter(input, fileList) {
  const desc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'files');
  if (desc?.set) desc.set.call(input, fileList);
  else input.files = fileList;
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

  //resumeUploadHappened = true;
  //log('Resume set via background', filename);
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
      //resumeUploadHappened = true;
      //log('Dropzone upload attempted');
      return true;
    }catch(e){
      //log('Dropzone error', e);
      z.classList?.remove('autofill-drop-indicator');
    }
  }
  return false;
}
const RESUME_POS = [/\bresume\b/i, /\bcv\b/i, /\bcurriculum\s*vitae\b/i, /\brésumé\b/i];
const RESUME_NEG = [/\bcover\s*letter\b/i, /\btranscript\b/i, /\breferences?\b/i];
function isResumeHumanName(name=''){
  const t = String(name || '').trim();
  if (!t) return false;
  if (RESUME_NEG.some(r => r.test(t))) return false;
  return RESUME_POS.some(r => r.test(t));
}
function markAutofilled(el, source='resume') {
  try { el.setAttribute('data-autofilled', 'true'); } catch {}
  try { el.dataset.afSource = source; } catch {}
}
// ===== Wait for ATS parsers to finish =====
async function waitForResumeParseToFinish({
  timeoutMs = 15000,
  quietMs   = 1200,
  pollMs    = 200
} = {}) {
  const startKey = pageKey();

  const spinnerSel = [
    '.spinner', '.loading', '[aria-busy="true"]',
    '.wd-loading', '.icims-loading', '.ashby-loading',
    '.sr-loading', '.gh-loading', '[data-test="loading"]'
  ].join(',');

  const snapshotInputs = () => {
    const arr = [];
    document.querySelectorAll('input, textarea, select').forEach(el => {
      if (!el || !(el instanceof HTMLElement)) return;
      const type = (el.type || '').toLowerCase();
      if (type === 'password' || type === 'hidden') return;
      arr.push({ el, val: ('value' in el ? el.value : ''), disabled: !!el.disabled });
    });
    return arr;
  };
  const hasValuesChanged = (b, a) => {
    if (a.length !== b.length) return true;
    for (let i=0; i<b.length; i++){
      const x=b[i], y=a[i];
      if (x.el !== y.el) return true;
      if (x.val !== y.val) return true;
      if (x.disabled !== y.disabled) return true;
    }
    return false;
  };

  const before = snapshotInputs();
  let lastDomChange = performance.now();
  const mo = new MutationObserver(() => { lastDomChange = performance.now(); });
  try { mo.observe(document.documentElement, { childList:true, subtree:true, attributes:true, characterData:true }); } catch {}

  const hasSpinner = () => !!document.querySelector(spinnerSel);
  const urlChanged = () => pageKey() !== startKey;

  const t0 = performance.now();
  while (performance.now() - t0 < timeoutMs) {
    const after = snapshotInputs();
    const valueChurn = hasValuesChanged(before, after);

    if (urlChanged() || (valueChurn && !hasSpinner())) break;
    await delay(pollMs);
  }

  const quietStart = performance.now();
  while (performance.now() - quietStart < quietMs) {
    if (performance.now() - lastDomChange < quietMs/2) {
      await delay(pollMs);
      continue;
    }
    await delay(pollMs);
  }

  try { mo.disconnect(); } catch {}
  return { navigated: urlChanged() };
}

// ===== Core: handleFileInput (checks input value BEFORE parsing) =====
async function handleFileInput(input, fileUrl){
  // 0) Guard: input must be a file input and enabled
  const t = (input?.type || '').toLowerCase();
  if (t !== 'file' || input.disabled || input.readOnly) return false;

  // 1) EARLY EXIT: If this file input already has a value, SKIP (no global helper)
  //    Many ATSes populate input.files on refresh; that’s enough signal.
  if (input.files && input.files.length > 0) {
    console.log('[resume] file already present on this input — skipping upload');
    markAutofilled(input, 'resume'); // mark so later passes skip it too
    return true;
  }

  // 2) Set a pending flag so a refresh/rerender will cause re-entry
  try { await setPendingResumeUpload(fileUrl); } catch {}

  // 3) Primary path: programmatic file selection
  try {
    const ok = await simulateFileSelectionFromBackground(input, fileUrl);
    if (ok) {
      const res = await waitForResumeParseToFinish();
      markAutofilled(input, 'resume');
      // If no navigation, clear the pending flag
      const pending = await getPendingResumeUpload();
      if (pending && !res?.navigated && pending.page === pageKey()) {
        await clearPendingResumeUpload();
      }
      return true;
    }
  } catch(e) {
    console.log('[resume] native set failed, trying dropzone', e);
  }

  // 4) Fallback path: dropzone simulation
  try {
    const ok2 = await tryAttachToDropzones(fileUrl);
    if (ok2) {
      const res = await waitForResumeParseToFinish();
      markAutofilled(input, 'resume');
      const pending = await getPendingResumeUpload();
      if (pending && !res?.navigated && pending.page === pageKey()) {
        await clearPendingResumeUpload();
      }
      return true;
    }
  } catch(e) {
    console.log('[resume] dropzone failed', e);
  }

  // 5) Optional UX breadcrumb (won’t interfere with later parsing)
  try{
    const src = fileUrl.startsWith('http') ? fileUrl : `${API_BASE_URL}${fileUrl}`;
    const filename = src.split('/').pop() || 'resume.pdf';
    const a = document.createElement('a');
    a.href = src; a.textContent = filename; a.target='_blank';
    a.style.display='inline-block'; a.style.marginLeft='8px'; a.style.color='#06c'; a.style.textDecoration='underline';
    input.parentNode?.insertBefore(a, input.nextSibling);
  }catch{}

  // leave pending flag; if navigation still happens, the boot hook will re-run
  return false;
}

// ===== Core: resumeFirstFromInputs (skips inputs that already have value) =====
async function resumeFirstFromInputs(inputs, autofillData, watchMs = 1000) {
  if (!Array.isArray(inputs) || !inputs.length) return { ok:false, reason:'no-inputs' };
  console.log('[resume] parsing started');

  const resumeFile = autofillData?.['resume'];
  if (!resumeFile) {
    console.log('[resume] no resume file/url on autofillData["resume"]');
    return { ok:false, reason:'no-resume-data' };
  }

  const candidates = inputs.filter(o => {
    const el = o?.element;
    if (!el) return false;
    const t = (el.type || '').toLowerCase();
    if (t !== 'file') return false;
    if (!o.humanName) return false;
    return isResumeHumanName(o.humanName);
  });

  if (candidates.length === 0) {
    return { ok:false, reason:'no-resume-file-input' };
  }

  let anySuccess = false;

  for (const r of candidates) {
    const el = r.element;
    const label = String(r.humanName || '');

    // Skip ATS-wide "autofill" slots
    if (label.toLowerCase().includes('autofill')) {
      console.log('[resume] skipping autofill-slot:', label);
      continue;
    }

    // EARLY EXIT: this specific file input already holds a file → skip (no global helper)
    if (el.files && el.files.length > 0) {
      console.log('[resume] input already has file, skipping:', label);
      markAutofilled(el, 'resume');
      anySuccess = true; // treat as success because resume is present
      continue;
    }

    console.log('[resume] uploading into:', label);
    try {
      const ok = await handleFileInput(el, resumeFile);
      if (ok) {
        anySuccess = true;
        await delay(Math.max(500, watchMs)); // grace for lazy parsers
      }
    } catch (e) {
      console.log('[resume] file handle error', e);
    }
  }

  return anySuccess ? { ok:true } : { ok:false, reason:'resume-upload-failed' };
}
*/
const isLeverHost = /(?:^|\.)lever\.co$/i.test(location.hostname);
function stripRequiredAsterisk(s){ return s.replace(/\s*[:*]\s*$/, ''); }
// kill live-status & helper text that leaks into container text on many hosts
const CONTAINER_NOISE_RE =
/\b(required|optional|characters?\s*remaining|drag\s*(?:and|&)\s*drop|click to upload|upload(?: a)? file|choose file|attach(?:ment)?|file size.*|max(?:imum)? size.*|no location found|try entering a different location|loading|analyzing resume|couldn'?t auto read resume|success|error|warning|info)\b.*$/i;

function dropContainerNoise(s){
  return (s || '')
    .replace(CONTAINER_NOISE_RE, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

// treat very machiney `name=` values as last resort
function looksMachineName(s){
  if(!s) return false;
  if(/cards?\[/.test(s)) return true;                          // Lever custom questions
  if(/[a-f0-9]{8}-[a-f0-9-]{13,}/i.test(s)) return true;       // UUID-ish
  if(/\b(field|input|question)\d+\b/i.test(s)) return true;
  // accept obvious good keys
  if (/\b(email|phone|name|first|last|company|location|address|city|state|zip|linkedin|github|portfolio|website)\b/i.test(s)) {
    return false;
  }
  return /^[a-z0-9_\[\]\-]+$/i.test(s);                        // no spaces ⇒ likely a key
}

// =====================
// Lever-specific: pull the visible question text
// =====================
const leverQuestionCache = new WeakMap();
function leverQuestionTextFor(field){
  if(!isLeverHost || !field) return '';
  const li = field.closest('li.application-question');
  if(!li) return '';
  if(leverQuestionCache.has(li)) return leverQuestionCache.get(li);

  const txtEl = li.querySelector('.application-label .text, .application-label');
  let txt = txtEl?.textContent || '';
  txt = stripRequiredAsterisk(txt).trim();

  // cache per <li> to avoid re-walking
  leverQuestionCache.set(li, txt);
  return txt;
}

// =====================
// Name extraction (UPDATED)
// =====================
function inputFieldSelection(field){
  if(!field) return '';
  if(fieldNameCache.has(field)) return fieldNameCache.get(field);

  // local cleaner that also strips the field's own value/placeholder
  const clean = (s)=>{
    if(!s) return '';
    let t = (s || '').trim();
    if(field.value) t = t.replace(field.value, '').trim();
    if(field.placeholder) t = t.replace(field.placeholder, '').trim();
    t = stripRequiredAsterisk(t);
    t = dropContainerNoise(t);
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
    let el = field;
    while(el && el!==document.body){
      if(el.tagName==='LABEL') return clean(el.textContent);
      if(el.parentNode?.tagName==='LABEL') return clean(el.parentNode.textContent);
      let prev = el.previousElementSibling;
      while(prev){
        if(prev.tagName==='LABEL') return clean(prev.textContent);
        prev = prev.previousElementSibling;
      }
      el = el.parentNode;
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
    // Prefer Lever's explicit question text when available
    if(isLeverHost){
      const q = leverQuestionTextFor(field);
      if(q) return clean(q);
    }
    let el = field;
    while(el && el!==document.body){
      const p = el.parentNode;
      if(p && ['DIV','SECTION','SPAN','TD','TH','LI','P'].includes(p.tagName)){
        const txt = dropContainerNoise((p.textContent||'').trim());
        if(txt) return clean(txt);
      }
      let prev = el.previousElementSibling;
      while(prev){
        if(['DIV','SECTION','SPAN','TD','TH','LI','P'].includes(prev.tagName)){
          const txt = dropContainerNoise((prev.textContent||'').trim());
          if(txt) return clean(txt);
        }
        prev = prev.previousElementSibling;
      }
      el = el.parentNode;
    }
    return '';
  };

  // ---------- resolution order ----------
  let name = '';

  // radios/checkboxes: fieldset or label are strongest
  const t = (field.type||'').toLowerCase();
  if (t === 'checkbox' || t === 'radio') {
    name = inFieldset() || labelAssoc() || inContainers();
  }

  if(!name && isLeverHost){
    // hard prefer the Lever question text early
    const leverQ = leverQuestionTextFor(field);
    if(leverQ) name = clean(leverQ);
  }

  if(!name) name = labelAssoc();
  if(!name) name = ariaLabels();

  // de-prioritize ugly machine names
  if(!name && field.name && !looksMachineName(field.name)) {
    name = clean(field.name);
  }

  if(!name && field.title) name = clean(field.title);
  if(!name) name = inFieldset() || inContainers();
  if(!name && field.placeholder) name = clean(field.placeholder);
  if(!name) name = nearestTextAround(field);

  // ---------- file input post-processing (uses your existing helpers/regexes) ----------
  if(isFileField(field)){
    const cleaned = stripFileCtas ? stripFileCtas(name) : name;
    if (FILE_POS_KW_RE?.test?.(cleaned)) {
      const finalName = normalizeFieldNameWithSpace(cleaned);
      fieldNameCache.set(field, finalName);
      return finalName;
    }
    if (!cleaned || FILE_NEG_KW_RE?.test?.(cleaned) || FILE_SIZE_HINT_RE?.test?.(cleaned)) {
      const hopName = findFileFieldName ? findFileFieldName(field, 6) : '';
      if (hopName) {
        fieldNameCache.set(field, hopName);
        return hopName;
      }
    }
    name = cleaned || name;
    console.log('1. inputfieldselection func humanname for file:',name);
  }

  const out = name || '';
  fieldNameCache.set(field, out);
  return out;
}
//===ashby helpers
const isAshbyHost = /(?:^|\.)ashbyhq\.com$/i.test(location.hostname);
const isGreenhouseHost = /(?:^|\.)greenhouse\.io$/i.test(location.hostname);
function isAshbyButtonEntry(obj){
  return !!(obj && obj.ashbyLinked && obj.optionText && obj.element?.tagName === 'BUTTON');
}

// --- helpers (Ashby only) ---
function ashbyQuestionTextFor(node){
  if (!isAshbyHost || !node) return '';
  const entry = node.closest('[class*="application-form-field-entry"]') || node.closest('div');
  const lab = entry?.querySelector('label[class*="application-form-question-title"], label[for]');
  return (lab?.textContent || '').replace(/\s*[:*]\s*$/, '').trim();
}

function ashbyFindYesNoButtonsNear(input){
  if (!isAshbyHost || !input) return [];
  const entry = input.closest('[class*="application-form-field-entry"]') || input.closest('div');
  if (!entry) return [];
  // Ashby wraps the two buttons in a container with "yesno" in the class
  const yesNo = entry.querySelector('div[class*="yesno"]');
  if (!yesNo) return [];
  const btns = [...yesNo.querySelectorAll('button')].filter(b => b && b.offsetParent !== null);
  // keep only obvious yes/no
  return btns
    .map(b => ({ el: b, text: (b.textContent || '').trim().toLowerCase() }))
    .filter(b => b.text === 'yes' || b.text === 'no');
}

// =====================
// Input collection (incl. combobox roles & iframes)  — UPDATED
// =====================
function allShadowHosts(root=document){
  return [...root.querySelectorAll('*')].filter(el=>el.shadowRoot);
}
function collectInputsIn(root){
  const sel = `
    input:not([disabled]):not([readonly]):not([type="hidden"]),
    select:not([disabled]):not([readonly]),
    textarea:not([disabled]):not([readonly]),
    [contenteditable="true"]:not([aria-disabled="true"]),
    [role="textbox"]:not([aria-disabled="true"]),
    [role="combobox"]:not([aria-disabled="true"])
  `;
  const nodes = [...root.querySelectorAll(sel)];
  const isToolbarish = (el) =>
    el.closest('[role="toolbar"], [role="menu"], header, [data-testid*="toolbar"], [class*="toolbar"]');

  const results = [];
  let groupCounter = 0;

  for (const input of nodes) {
    // Skip random buttons unless true combobox
    if (input.tagName === 'BUTTON' && input.getAttribute('role') !== 'combobox') continue;
    if (isToolbarish(input)) continue;

    const style = window.getComputedStyle(input);
    const inFloatingPanel =
      !!input.closest('[role="listbox"], [role="dialog"], [role="menu"]') &&
      (style.position === 'fixed' || style.position === 'absolute');
    if (inFloatingPanel && input.tagName === 'INPUT' && input.type === 'text') continue;
    //==icims 
    if (isIcimsHost) {
      // iCIMS dropdown search inputs live inside role=listbox but may not be fixed/absolute
      if (input.closest('[role="listbox"], [role="dialog"], [role="menu"]')) {
        // skip overlay search boxes; we’ll drive selects via anchor/search later
        if (input.tagName === 'INPUT' && (input.type === 'text' || input.classList.contains('dropdown-search'))) {
          continue;
        }
      }
      // also skip known non-targets
      if (input.matches('#nav-trigger, textarea[id^="h-captcha-response"]')) continue;
    }
    //
    let groupId = null;
    let humanName = null;

    const t = (input.type||'').toLowerCase();
    if (t === 'checkbox' || t === 'radio') {
      // --- your existing grouping logic (unchanged) ---
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

      // --- NEW: only on Ashby, link nearby Yes/No buttons to this checkbox group ---
      if (isAshbyHost && t === 'checkbox') {
        const yesNoBtns = ashbyFindYesNoButtonsNear(input);
        if (yesNoBtns.length) {
          // Prefer the visible question text if present
          const q = ashbyQuestionTextFor(input);
          const human = q ? normalizeFieldNameWithSpace(q) : humanName;
          for (const b of yesNoBtns) {
            results.push({
              element: b.el,           // use the button as the actionable element
              groupId,
              humanName: human,
              ashbyLinked: true,       // optional hint for your filler
              optionText: b.text       // "yes" or "no"
            });
          }
        }
      }
      // --- end Ashby block ---

    } else {
      humanName = inputFieldSelection(input) || input.name || input.getAttribute?.('aria-label') || '';
    }

    const obj = { element: input, groupId, humanName };
    if (typeof refineDateHumanNameAndGroup === 'function' && isWorkdayHost){
      refineDateHumanNameAndGroup(obj);
    }
    results.push(obj);
  }
  // after the for-loop, before returning:
  results.sort((a,b) => {
    if (a.groupId && a.groupId === b.groupId) {
      const aIsBtn = a.element?.tagName === 'BUTTON';
      const bIsBtn = b.element?.tagName === 'BUTTON';
      if (aIsBtn !== bIsBtn) return aIsBtn ? 1 : -1; // INPUTs first
    }
    return 0;
  });
  //console.log('All Results with input,label and id:', results.slice(0,70));
  return results;
}

/*
function collectInputsIn(root){
  const sel = `
    input:not([disabled]):not([readonly]):not([type="hidden"]),
    select:not([disabled]):not([readonly]),
    textarea:not([disabled]):not([readonly]),
    [contenteditable="true"]:not([aria-disabled="true"]),
    [role="textbox"]:not([aria-disabled="true"]),
    [role="combobox"]:not([aria-disabled="true"])
  `;
  const nodes = [...root.querySelectorAll(sel)];
  //const specialNodes = root.querySelectorAll('button:not([disabled]):not([aria-disabled="true"])'); // Renamed to specialNodes for clarity
  /*
  // CORRECTED Logic
  if (isAshbyHost && specialNodes.length > 0) {
    nodes.push(...specialNodes); // Use spread syntax to add individual elements
  }

  const isToolbarish = (el) =>
    el.closest('[role="toolbar"], [role="menu"], header, [data-testid*="toolbar"], [class*="toolbar"]');

  const results = [];
  let groupCounter = 0;

  for (const input of nodes) {
    // Skip random buttons unless true combobox
    if (input.tagName === 'BUTTON' && input.getAttribute('role') !== 'combobox') continue;
  

    // Skip disabled-ish toolbars/headers
    if (isToolbarish(input)) continue;

    // Skip floating listbox search boxes (popper overlays)
    const style = window.getComputedStyle(input);
    const inFloatingPanel =
      !!input.closest('[role="listbox"], [role="dialog"], [role="menu"]') &&
      (style.position === 'fixed' || style.position === 'absolute');
    if (inFloatingPanel && input.tagName === 'INPUT' && input.type === 'text') continue;

    let groupId = null;
    let humanName = null;

    const t = (input.type||'').toLowerCase();
    if (t === 'checkbox' || t === 'radio') {
      // make a stable key for radio/checkbox sets
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

    const obj = { element: input, groupId, humanName };

    // keep your Workday date refinements
    if (typeof refineDateHumanNameAndGroup === 'function' && isWorkdayHost){
      refineDateHumanNameAndGroup(obj);
    }

    results.push(obj);
  }

  console.log('All Results with input,label and id:', results.slice(0,30));
  return results;
}
*/
function collectAllRoots(){
  const roots = [document];
  const stack = [...allShadowHosts(document)];
  document.querySelectorAll('iframe').forEach(fr=>{              //, frame
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
/*
function inputSelection(){
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
  console.log('Total inputs collected', uniq.length, uniq.slice(0,70));
  return uniq;
}
*/
function shouldSkipTopInputScan() {
  if (window.top !== window) return false; // we are inside an iframe already
  const frames = document.querySelectorAll('iframe'); //,frame
  for (const f of frames) {
    try {
      const src = f.src || '';
      if (/(workday\.com|icims\.com|lever\.co|greenhouse\.io|smartrecruiters\.com|taleo\.net|oraclecloud\.com|bamboohr\.com)/i.test(src)) {
        return true;
      }
    } catch {}
  }
  return false;
}
function inputSelection(){
  // 🚫 Skip scanning if we’re the top window and ATS iframe exists
  if (shouldSkipTopInputScan()) {
    console.log('[inputSelection] ATS iframe detected — skip input scanning in top window');
    return [];
  }
  const roots = collectAllRoots(); //isIcimsHost ? [getIcimsFormRoot()] : 
  const all = roots.flatMap(r => collectInputsIn(r));

  const uniq = [];
  const seenEls = new WeakSet();
  const seenKeys = new Set();

  for (const it of all) {
    const el = it.element;
    if (!el) continue;
    if (seenEls.has(el)) continue;
    seenEls.add(el);

    const key = stableKeyFor(el);
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);

    uniq.push(it);
  }

  //console.log('Total inputs collected', uniq.length, uniq.slice(0,70));
  return uniq;
}

// =====================
// Repeated section discovery (Add buttons, titles)
//EDUCATION =====
export const eduMappings = [
  { keywords:[/\b(school|college|university)\s*(?:name)?\b/i],     dataKey:'educations[x].school' },
  { keywords:[/\bdegree\b/i],                                       dataKey:'educations[x].degree' },
  { keywords:[/\b(major|field\s*of\s*study|discipline|course|course\s*of\s*study)\b/i], dataKey:'educations[x].major' },
  { keywords:[/\b(cgpa|gpa)\b/i],                                   dataKey:'educations[x].cgpa' },
  { keywords:[/\bcurrently\s*studying|present\b/i],                 dataKey:'educations[x].currently_studying' },
];

// ===== EXPERIENCE =====
export const expMappings = [
  { keywords:[/\b(company|employer|organization)\s*(?:name)?\b/i], dataKey:'experiences[x].company_name' },
  { keywords:[/\b(job|role|position)\b(?!(\s*description))\s*(?:(title|name))?\b/i],     dataKey:'experiences[x].job_name' },
  { keywords:[/\bcurrently\s*(work|working)|present\b/i],                 dataKey:'experiences[x].currently_working' },
  { keywords:[/\b(duties|responsibilities|description)\b/i],       dataKey:'experiences[x].job_duties' },
];

// ===== SHARED ADDRESS (dynamic prefix for repeated sections) =====
export const addressMappings = [
  { keywords:[/\b(start\s*date|from|start)\b/i],                    dataKey:'{prefix}[x].start_date', type:'date' },
  { keywords:[/\bend\s*date|graduation\s*date|to|end\b/i],          dataKey:'{prefix}[x].end_date',   type:'date' },
  { keywords:[/(?:(?<!e[-\s]?mail\s*)\b(?:(?:employer|working)\s*)?address\b(?!\s*line\s*2\b)(?:\s*(?:line\s*1|number(?:\s*\d+)?))?|\bstreet\s*number\b)/i], dataKey:'{prefix}[x].address' },
  { keywords:[/\b(?:(?:employer|working|school|university|job|company)\s*)?(city|town)\b/i], dataKey:'{prefix}[x].city' },
  { keywords:[/\b(?:(?:employer|working|school|university|job|company)\s*)?state\b(?!\s*of\b)/i], dataKey:'{prefix}[x].state' },
  { keywords:[/\b(?:(?:employer|working|school|university|job|company)\s*)?zip(?:\s*code)?\b/i], dataKey:'{prefix}[x].zip_code' },
  { keywords:[/\b(?:(?:employer|working|school|university|job|company)\s*)?country\b(?!\s*(?:code|dial|calling)\b)/i], dataKey:'{prefix}[x].country' },
  { keywords:[/\b(?:(?:employer|working|school|university|job|company)\s*)?location\b/i],dataKey:'{prefix}[x].location', type:'combine'},
];

export const resMappings = [
    // ==== CONTACT ADDRESS (root/residence) ====
  { keywords: [/(?:(?<!e[-\s]?mail\s*)\b(?:(?:residence|residential|street|postal|permanent|home)\s*)?address\b(?!\s*line\s*2\b)(?:\s*(?:line\s*1|number(?:\s*\d+)?))?|\bstreet\s*number\b)/i], dataKey: 'residenceaddress' },
  { keywords: [/\b(?:(?:residence|residential|permanent|present|curren|home)\s*)?(?:city|town)\b/i], dataKey: 'residencecity' },
  { keywords: [/\b(?:(?:residence|residential|permanent|present|current|home)\s*)?state\b(?!\s*of\b)/i], dataKey: 'residencestate' },
  { keywords: [/\b(?:(?:residence|residential|permanent|present|current|home)\s*)?country\b(?!\s*(?:code|dial|calling)\b)/i], dataKey: 'residencecountry' },
  { keywords: [/\b(?:(?:residence|residential|permanent|present|current|home)\s*)(?:zip|postal|area)\s*code\b/i], dataKey: 'residencezipcode'},
  { keywords: [/\b(?:(?:residence|residential|permanent|present|current|home)\s*)?(?:location)\b/i], dataKey: 'residencelocation' }
]
const TITLE_BUCKETS = {
  education: ['education','school','college','university','degree','qualification'],
  experience: ['experience','employment','work history','job history','work experience'],
  languages: ['language','languages'],
  certifications: ['certification','certifications','license','licenses','credential','credentials'],
};
const SECTION_TO_DATAKEY = {
  education: 'educations',
  experience: 'experiences',
  languages: 'languages',
  certifications: 'certifications',
};
function normalize(s){ return normalizeFieldNameWithSpace(s||''); }
const HEADING_SEL = 'h1,h2,h3,h4,h5,h6,[role="heading"],legend';
const TITLE_HINT_SEL = [
  'label','strong','span',
  '[data-automation-id*="Heading"]',
  '[data-automation-id*="Title"]',
  '[data-automation-id*="header"]',
  '[data-automation-id*="title"]'
].join(',');
//to find forms near fields.
const CONTAINER_UP_SEL = 'section,fieldset,form,article,div';
//function to return the text of an element
function textOf(el){ return (el?.textContent || '').trim(); }
function firstMatch(scope, sel){ try { return scope?.querySelector?.(sel) || null; } catch { return null; } }
function textFromAria(el, doc = document){
  if (!el) return '';
  const label = el.getAttribute('aria-label');
  if (label) return label.trim();
  const labelledBy = el.getAttribute('aria-labelledby');
  if (labelledBy){
    const ids = labelledBy.split(/\s+/).filter(Boolean);
    const txt = ids.map(id => doc.getElementById(id)?.textContent || '').join(' ').trim();
    if (txt) return txt;
  }
  return '';
}
function resolveSectionTitleForAdd(btn, { maxHops = 6 } = {}){
  if (!btn) return '';
  let node = btn.closest(CONTAINER_UP_SEL);
  const doc = btn.ownerDocument || document;
  let hops = 0;

  while (node && hops < maxHops){
    const legend = node.matches('fieldset') ? firstMatch(node, 'legend') : null;
    if (legend && textOf(legend)) return textOf(legend);
    const heading = firstMatch(node, HEADING_SEL);
    if (heading && textOf(heading)) return textOf(heading);
    const ariaTxt = textFromAria(node, doc);
    if (ariaTxt) return ariaTxt;
    const wdHint = firstMatch(node, TITLE_HINT_SEL);
    if (wdHint && textOf(wdHint)) return textOf(wdHint);

    let prev = node.previousElementSibling;
    while (prev){
      const prevHeading = prev.matches(HEADING_SEL) ? prev : firstMatch(prev, HEADING_SEL);
      if (prevHeading && textOf(prevHeading)) return textOf(prevHeading);
      const prevLabelish = firstMatch(prev, TITLE_HINT_SEL);
      if (prevLabelish && textOf(prevLabelish)) return textOf(prevLabelish);
      const prevAria = textFromAria(prev, doc);
      if (prevAria) return prevAria;
      prev = prev.previousElementSibling;
    }
    node = node.parentElement?.closest?.(CONTAINER_UP_SEL) || node.parentElement;
    hops++;
  }
  return nearestTextAround(btn, 300) || '';
}

//finding add button with nearest titles.
function findAddButtonsWithTitles(root = document) {
  const CLICKABLE = [
    'button',
    '[role="button"]',
    'a[href]',
    '[tabindex]:not([tabindex="-1"])'
  ].join(',');

  const ADD_TEXT_RE = /\b(add|new|\+)\b/i;

  const candidates = [...root.querySelectorAll(CLICKABLE)].filter(el =>  ADD_TEXT_RE.test(el.textContent || el.getAttribute('aria-label') || '')); //isElementVisible(el) &&
  console.log('buttons found',candidates);
  return candidates.map(btn => {
    const titleText = resolveSectionTitleForAdd(btn, { maxHops: 6 }) || '';
    const controlsId = btn.getAttribute('aria-controls');
    const controlled = controlsId ? btn.ownerDocument.getElementById(controlsId) : null;
    const norm = normalize(titleText);
    console.log('findaddbuttonswithtitles,:',btn,norm,controlled);
    return { button: btn, rawTitle: titleText, normTitle: norm, controlled };
  });
}
//function to return add button section title is  edu/exp or none.
function titleToSectionKey(normTitle) {
  if (!normTitle) return null;
  for (const [key, keywords] of Object.entries(TITLE_BUCKETS)) {
    if (keywords.some(k => normTitle.includes(k))) return key;
  }
  return null;
}
async function safeClick(el) {
  if (!el) return false; // || !isElementVisible(el)
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  await new Promise(r => setTimeout(r, 120));
  el.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
  el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
  el.click?.();
  el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  el.dispatchEvent(new MouseEvent('pointerup', { bubbles: true }));
  return true;
}
async function waitAfterExpand() {
  await waitForDomStable({ timeoutMs: 3000, quietMs: 180 });
  await new Promise(r => setTimeout(r, 60));
}
//function to return the opened inputs
function resolveNewContainer(candidate) {
  const modal = document.querySelector('[role="dialog"][aria-modal="true"], [data-automation-id*="promptPanel"], [data-automation-id*="modalDialog"]');
  if (modal && isElementVisible(modal)) return modal;
  if (candidate?.controlled && isElementVisible(candidate.controlled)) return candidate.controlled;
  return widenToInputCluster(candidate?.button || document.body);
}
//Returns new form fields.
function widenToInputCluster(anchor) {
  const containers = [
    anchor?.closest?.('section,fieldset,form,div,article'),
    document
  ].filter(Boolean);

  let best = containers[0] || document;
  let bestScore = -1;

  for (const c of containers) {
    const visibleInputs = [...c.querySelectorAll('input,select,textarea,[contenteditable="true"]')]
      .filter(isElementVisible).length;
    if (visibleInputs > bestScore) {
      bestScore = visibleInputs;
      best = c;
    }
  }
  //console.log('wideninputcluster best contiane for add button:',best);
  return best;
}
async function fillOneEducation(container, dataItem) {
  const inputs = collectInputsIn(container);
  //await populateRepeatedSection(container, 'education', dataItem);
  //console.log('Inputs for education:', container, dataItem);
  await populateFields(inputs, dataItem);
}
async function fillOneExperience(container, dataItem) {
  const inputs = collectInputsIn(container);
  await populateFields(inputs,dataItem)
  //await populateRepeatedSection(container, 'experience', dataItem);
 // console.log('Inputs for experience:', container, dataItem);
  // await populateExperienceGroup(inputs, dataItem);
}
async function fillOneLanguage(container, dataItem) {
  const inputs = collectInputsIn(container);
  //await populateFields(inputs,dataItem)
  //console.log('Inputs for language:', inputs, dataItem);
}
async function fillOneCertification(container, dataItem) {
  //const inputs = collectInputsIn(container);
 // console.log('Inputs for certification:', inputs, dataItem);
}
async function fillOneBySection(sectionKey, container, dataItem) {
  if (sectionKey === 'education') return fillOneEducation(container, dataItem);
  if (sectionKey === 'experience') return fillOneExperience(container, dataItem);
  if (sectionKey === 'languages') return fillOneLanguage(container, dataItem);
  if (sectionKey === 'certifications') return fillOneCertification(container, dataItem);
}

//function returning which kind the form belongs to 
function classifySectionForInput(input){
  //const root = resolveNearestSectionRoot(input);
  //const raw = scrapeTitleFor(root);
  const root = document.body;
  const raw = resolveSectionTitleForAdd(input,{maxHops:6}) || '';
  const norm = normalizeFieldNameWithSpace(raw);
  for (const [key, list] of Object.entries(TITLE_BUCKETS)){
    if (list.some(k => norm.includes(k))) {
      return { kind:key, root };
    }

  }
  return { kind:null, root };
}

// anchors + blind spots
const EDU_ANCHORS = [/\bdegree\b/i, /\b(school|college|university)\b/i, /\b(discipline|major|field\s*of\s*study)\b/i];
const EXP_ANCHORS = [/\b(company|employer|organization)\b/i, /\b(job|role|position)\s*(?:(title|name))?\b/i];
const ADDRESSISH = [
  /\baddress\b(?!\s*line\s*2\b)/i, /\bcity\b/i, /\bstate\b(?!\s*of\b)/i, /\bzip(?:\s*code)?\b/i,
  /\bcountry\b(?!\s*(?:code|dial|calling)\b)/i
];
//checking the input labels with edu anchors to make sure ot belongs to correct kind
function isAnchorLabel(label, kind){
  const rxs = kind==='education' ? EDU_ANCHORS : kind==='experience' ? EXP_ANCHORS : [];
  return rxs.some(rx=>rx.test(label));
}
//checking belongs to address labels
function isAddressish(label){ return ADDRESSISH.some(rx=>rx.test(label)); }
// per-section states
const sectionState = new WeakMap(); // root -> { kind, locked, index,perIndexFilled: Map<number, Set<string>>}
const usedIndex = { education:new Set(), experience:new Set() };
//map Function storing the kind,index and filledkeys.
function ensureSectionState(root, kind){
  if (!sectionState.has(root)) {
    sectionState.set(root, { kind, locked:false, index:null, perIndexFilled:new Map() });
  }
  const st = sectionState.get(root);
  if (!st.kind && kind) st.kind = kind;
  return st;
}
//to return unused first index in arrays
function nextUnusedIndex(kind, data){
  const arr = (kind==='education') ? (data.educations||[]) : (data.experiences||[]);
  const used = usedIndex[kind];
  for (let i=0;i<arr.length;i++){
    if (!used.has(i)) return i;
  }
  return null;
}
// Consumption ledger: kind -> Map<index, Set<relKey>>
const consumed = {
  education: new Map(),
  experience: new Map()
};

function isConsumed(kind, index, relKey){
  const m = consumed[kind];
  const s = m.get(index);
  return !!s && s.has(relKey);
}
function markConsumed(kind, index, relKey){
  const m = consumed[kind];
  if (!m.has(index)) m.set(index, new Set());
  m.get(index).add(relKey);
}

// Get next unused index >= startIdx
function nextUnusedIndexFrom(kind, data, startIdx=0){
  const arr = (kind==='education') ? (data.educations||[]) : (data.experiences||[]);
  const used = usedIndex[kind];
  for (let i = startIdx; i < arr.length; i++){
    if (!used.has(i)) return i;
  }
  //return null;
  return null;
}

//to lock which index need to parse for sections.
function lockIndexForSection(st, kind,data){
  const arr = kind==='education' ? (data.educations||[]) : (data.experiences||[]);
  let bestIdx = null//, bestScore = -1;
  for (let i = 0; i < arr.length; i++) {
    // Check if the current index 'i' is NOT in the set of used indices for this 'kind'.
    if (!usedIndex[kind].has(i)) {
      bestIdx = i; // This is the first unused index we found.
      break;       // Stop the loop immediately.
    }
  }
  const fallback = nextUnusedIndex(kind, data);
  st.index = (bestIdx !== null ? bestIdx : fallback ?? 0);
  // Mark the state as locked and add the chosen index to the used set.
  st.locked = true;
  usedIndex[kind].add(st.index);
}
// Keep these WeakMaps near your other per-root state
const kindStreakByRoot = new WeakMap(); // root -> { last:'education'|'experience'|null, count:number }

function bumpKindStreak(root, newKind){
  if (!newKind) return { last:null, count:0 };
  let s = kindStreakByRoot.get(root);
  if (!s) s = { last:null, count:0 };
  if (s.last === newKind) s.count++;
  else { s.last = newKind; s.count = 1; }
  kindStreakByRoot.set(root, s);
  return s;
}


//Updating dynamically section key and index
function resolveDataKey(template, kind, index){
  return template
    .replace('{prefix}', kind==='education' ? 'educations' : 'experiences')
    .replace('[x]', `.${index}`)
    .replace('educations[x]', `educations.${index}`)
    .replace('experiences[x]', `experiences.${index}`);
}
//functio ot return path
function getByPath(obj, path){
  if (!path) return undefined;
  const parts = path.split('.').map(p => /^\d+$/.test(p) ? Number(p) : p);
  return parts.reduce((a,k)=>a?.[k], obj);
}

// decide mapping for a single input
function flattenRegexes(mappings) {
  return mappings.flatMap(m => Array.isArray(m.keywords) ? m.keywords : []).filter(Boolean);
}
function labelFor(el){ try { return inputFieldSelection(el); } catch { return ''; } }

//Main function for decideing wether it is repeated or non repeated.
function decideMappingForInput(input, inputLabel, data, { 
  fieldMappings, eduMappings, expMappings, addressMappings
}){
  const base = fieldMappings.find(m => m.keywords?.some(rx=>rx.test(inputLabel)));
  if (base) return { mapping: base, dataKey: base.dataKey, reason: 'base' };

  // NOTE: assuming resMappings exists in your scope (as in your code)
  const res = resMappings.find(m=>m.keywords?.some(rx=>rx.test(inputLabel)));

  const eduHit  = eduMappings.find(m => m.keywords?.some(rx=>rx.test(inputLabel)));
  const expHit  = expMappings.find(m => m.keywords?.some(rx=>rx.test(inputLabel)));
  const addrHit = addressMappings.find(m => m.keywords?.some(rx=>rx.test(inputLabel)));

  const { kind, root } = classifySectionForInput(input);
  console.log('decide functon,inputlabel, root and  kind received for input',inputLabel,root,kind);

  let inferredKind = kind;
  console.log('decide function, 1st inferredkind',inferredKind);
  if (!inferredKind) inferredKind = eduHit ? 'education' : expHit ? 'experience' : null;

  let st = ensureSectionState(root, inferredKind);
  console.log('decide functon, section map',st);

  if(res && !st.locked && !inferredKind){
    console.log('st.locked status:',st.locked);
    return {mapping: res, dataKey:res.dataKey,reason:'res' };
  }

  if (!eduHit && !expHit && !addrHit) return null;

  if(!inferredKind && st.locked){
    inferredKind = st.kind;
    console.log('decide function,setting kind to use for address labels using st.locked',inferredKind);
  }

  // === UPDATED ①: allow switching the locked kind if current input points to the other kind ===
  // Determine what this input most strongly suggests right now:
  const presentKind = eduHit ? 'education' : (expHit ? 'experience' : inferredKind);
  if (st.locked && presentKind && presentKind !== st.kind) {
    console.log('decide function: switching locked kind from', st.kind, 'to', presentKind);
    st.locked = false;         // drop the old lock
    st.index  = null;          // clear index
    st.kind   = presentKind;   // adopt the new kind
  }
  // === END UPDATED ① ===

  if (presentKind && !st.locked && isAddressish(inputLabel)){
    console.log('decide skipping because address before lock');
    return { skip:true, reason:'address_before_lock' };
  }

  if (presentKind && !st.locked && isAnchorLabel(inputLabel, presentKind)){
    lockIndexForSection(st, presentKind, data);
    console.log('decide function,sending new index locked:');
  }

  const hit = eduHit || expHit || addrHit;
  const kindToUse = eduHit ? 'education' : expHit ? 'experience' : presentKind;
  console.log('decide finla kind to use:',kindToUse);
  if (!kindToUse) return null;

  // === UPDATED ②: respect lock only if it matches the kind we’re about to use ===
  const lockMatchesKind = st.locked && (st.kind === kindToUse);
  let idx = lockMatchesKind ? st.index : (kindToUse ? (nextUnusedIndex(kindToUse, data) ?? 0) : 0);
  if (!lockMatchesKind && !st.locked) {
    // Soft-lock now so subsequent section fields align
    lockIndexForSection(st, kindToUse, data);
    idx = st.index;
  }
  // === END UPDATED ② ===

  console.log('decide index:',idx);

  // updating dynamic key with correct kind and index
  let tentativeKey = resolveDataKey(hit.dataKey, kindToUse, idx);
  console.log('decide tenativeKey',tentativeKey);

  // replacing all the dynamic keys with tentative key index related
  let relKey = toRelativeKey(tentativeKey, kindToUse);
  console.log('decide relKey',relKey);

  // If this relKey for the current index was already consumed, advance index
  while (st.locked && isConsumed(kindToUse, idx, relKey)) {
    const nextIdx = nextUnusedIndexFrom(kindToUse, data, idx + 1);
    if (nextIdx == null) return null; // nothing left to fill
    idx = nextIdx;
    console.log('decided nextidx due to used idx and datakey',idx);
    tentativeKey = resolveDataKey(hit.dataKey, kindToUse, idx);
    console.log('decided non conusmed tentativekey',idx);
    relKey = toRelativeKey(tentativeKey, kindToUse);
    console.log('decided non conusmed relkey',idx);
    // also promote lock to the new index so subsequent fields align
    st.index = idx;
    console.log('updating st.index because of used index old',st.index);
    usedIndex[kindToUse].add(idx);
    console.log('decide, if repeated,idx,tentativeKey,relKey:',idx,tentativeKey,relKey);
  }

  console.log('decide ,finally mapping',hit,'dataKey',tentativeKey,'kind',kindToUse,'index',idx);

  // (Optional improvement you can adopt later: mark with relKey to match the checker)
  markConsumed(kindToUse, idx, tentativeKey);

  return { mapping: hit, dataKey: tentativeKey, kind: kindToUse, index: idx, reason: 'repeated' };
}

/*
function decideMappingForInput(input, inputLabel, data, {
  fieldMappings, eduMappings, expMappings, addressMappings
}){
  const base = fieldMappings.find(m => m.keywords?.some(rx=>rx.test(inputLabel)));
  if (base) return { mapping: base, dataKey: base.dataKey, reason: 'base' };
  //return the section label for input ele.
  const res = resMappings.find(m=>m.keywords?.some(rx=>rx.test(inputLabel)));
  const eduHit  = eduMappings.find(m => m.keywords?.some(rx=>rx.test(inputLabel)));
  const expHit  = expMappings.find(m => m.keywords?.some(rx=>rx.test(inputLabel)));
  const addrHit = addressMappings.find(m => m.keywords?.some(rx=>rx.test(inputLabel)));
  const { kind, root } = classifySectionForInput(input);
  console.log('decide functon,inputlabel and  kind received for input',inputLabel,kind);
  let inferredKind = kind;
  console.log('decide function, 1st inferredkind',inferredKind);
  if (!inferredKind) inferredKind = eduHit ? 'education' : expHit ? 'experience' : null;
  let st = ensureSectionState(root, inferredKind);
  console.log('decide functon, section map',st);
  if(res && !st.locked && !inferredKind){
    console.log('st.locked status:',st.locked);
    return {mapping: res, dataKey:res.dataKey,reason:'res' };
  }
  if (!eduHit && !expHit && !addrHit) return null;
  if(!inferredKind && st.locked){ inferredKind = st.kind; console.log('decide function,setting kind to use for address labels using st.locked',inferredKind);}
  if (inferredKind && !st.locked && isAddressish(inputLabel)){console.log('decide skipping because address before lock'); return { skip:true, reason:'address_before_lock' }};
  if (inferredKind && !st.locked && isAnchorLabel(inputLabel, inferredKind)){
    lockIndexForSection(st, inferredKind,data);
    console.log('decide function,sending new index locked:');
  }

  const hit = eduHit || expHit || addrHit;
  const kindToUse = eduHit ? 'education' : expHit ? 'experience' : inferredKind;
  console.log('decide finla kind to use:',kindToUse);
  if (!kindToUse) return null;
  // Start with the current/next index
  let idx = st.locked ? st.index : (kindToUse ? (nextUnusedIndex(kindToUse, data) ?? 0) : 0);
  console.log('decide index:',idx)
  // updating dynamic key with correct kind and index
  let tentativeKey = resolveDataKey(hit.dataKey, kindToUse, idx);
  console.log('decide tenativeKey',tentativeKey);
  //replacing all the dynmaic keys with tenative key index related
  let relKey = toRelativeKey(tentativeKey, kindToUse);
  console.log('decide relKey',relKey);
  // If this relKey for the current index was already consumed, advance index
  while (st.locked && isConsumed(kindToUse, idx, relKey)) {
    const nextIdx = nextUnusedIndexFrom(kindToUse, data, idx + 1);
    if (nextIdx == null) return null; // nothing left to fill
    idx = nextIdx;
    console.log('decided nextidx due to used idx and datakey',idx);
    tentativeKey = resolveDataKey(hit.dataKey, kindToUse, idx);
    console.log('decided non conusmed tentativekey',idx);
    relKey = toRelativeKey(tentativeKey, kindToUse);
    console.log('decided non conusmed relkey',idx);
    // also promote lock to the new index so subsequent fields align
    st.index = idx;
    console.log('updating st.index because of used index old',st.index);
    usedIndex[kindToUse].add(idx);
    console.log('decide, if repeated,idx,tentativeKey,relKey:',idx,tentativeKey,relKey);
  }
  console.log('decide ,finally mapping',hit,'dataKey',tentativeKey,'kind',kindToUse,'index',idx);
  markConsumed(kindToUse,idx,tentativeKey);
  return { mapping: hit, dataKey: tentativeKey, kind: kindToUse, index: idx, reason: 'repeated' };
}
*/
// Count indices we’ve already used for this kind (bounded by data length)
function countExistingByLedger(kind, dataLen){
  const used = usedIndex[kind] || new Set();
  let n = 0;
  for (const idx of used){ if (idx < dataLen) n++; }
  return n;
}
//=== UPDATED: Add-runner — click only what’s needed
export async function processAddSectionsFromData(autofillData) {
  if (!autofillData || typeof autofillData !== 'object') {
    console.log('[AddRunner] No data to process.');
    return;
  }
  //A funciton to check add buttons with titles and filtering if it is edu/exp/or not.
  let addIndex = findAddButtonsWithTitles(document)
    .map(c => ({ ...c, sectionKey: titleToSectionKey(c.normTitle) }))
    .filter(c => !!c.sectionKey);

  if (!addIndex.length) {
    console.log('[AddRunner] No Add buttons with recognizable titles found.');
    return;
  }

  const plan = [];
  for (const c of addIndex) {
    const dataKey = SECTION_TO_DATAKEY[c.sectionKey]; //ginding key in autofilldata
    const arr = Array.isArray(autofillData[dataKey]) ? autofillData[dataKey] : []; //length and value
    const count = arr.length;
    if (count <= 0) continue;

    plan.push({
      sectionKey: c.sectionKey,
      dataKey,
      count,
      buttonRef: c.button,
      heading: c.rawTitle,
    });
  }
  console.log('processedaddbuttonfinction, plan wher it had buttons with edu/exp',plan);
  if (!plan.length) {
    console.log('[AddRunner] No sections have data; no clicks needed.');
    return;
  }

  const MAX_PER_SECTION = 10;

  for (const item of plan) {
    const { sectionKey, dataKey } = item;
    const arr = autofillData[dataKey];
    const desired = Math.min(arr.length, MAX_PER_SECTION);

    // how many instances already present?

    //const freshBtnInfo = findAddButtonsWithTitles(document)
      //.map(c => ({ ...c, sectionKey: titleToSectionKey(c.normTitle) }))
      //.find(c => c.sectionKey === sectionKey);

    //const btnForCount = freshBtnInfo?.button || item.buttonRef;
    //const existing = btnForCount ? countExistingInstancesNear(btnForCount, sectionKey) : 0;

    const existing = countExistingByLedger(sectionKey, arr.length);

    // We only need to click for the remainder (cap by desired)
    const desiredClicks = Math.max(0, Math.min(desired, arr.length) - existing);

    //const desiredClicks = Math.max(0, desired - existing);
    console.log(`[AddRunner] Section "${sectionKey}" → desired=${desired}, existing=${existing}, clicks=${desiredClicks}`);

    if (desiredClicks === 0) continue;

    let clicks = 0;
    while (clicks < desiredClicks) {
      const fresh = findAddButtonsWithTitles(document)
        .map(c => ({ ...c, sectionKey: titleToSectionKey(c.normTitle) }))
        .find(c => c.sectionKey === sectionKey);

      const btn = fresh?.button || item.buttonRef;
      if (!btn) { //|| !isElementVisible(btn)
        console.warn(`[AddRunner] Add button for "${sectionKey}" not found/visible; stopping at ${clicks}/${desiredClicks}.`);
        break;
      }

      const clicked = await safeClick(btn);
      if (!clicked) {
        console.warn(`[AddRunner] Failed to click Add for "${sectionKey}".`);
        break;
      }
      await waitAfterExpand();

      const container = resolveNewContainer(fresh);
      if (!container) {
        console.warn(`[AddRunner] Could not resolve new container after Add for "${sectionKey}".`);
        break;
      }

      // Existing instances consume arr[0..existing-1]; new click indexes start at existing
      const dataIdx = existing + clicks;
      //const dataItem = arr[dataIdx];
      /*if (!dataItem) {
        console.warn(`[AddRunner] No data item at index ${dataIdx} for "${sectionKey}".`);
        break;
      }*/
      //console.log('dataItem we are sending at starting is',dataItem);
      try {
        await fillOneBySection(sectionKey, container, autofillData);
      } catch (e) {
        console.error(`[AddRunner] Error filling ${sectionKey} #${dataIdx+1}:`, e);
      }

      clicks += 1;
    }
  }
}

//===Autofill
let autofillData = null;
// ===== Core fill =====
/*function setValueWithNativeSetter(el, val){
  try{
    let proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype
              : el instanceof HTMLInputElement ? HTMLInputElement.prototype
              : HTMLElement.prototype;
    const desc = Object.getOwnPropertyDescriptor(proto, 'value');
    if (desc?.set) desc.set.call(el, val);
    else el.value = val;
  }catch{ el.value = val; }
}*/
// --- unified: native set + React/MUI tracker nudge ---
function setValueWithNativeSetter(el, val){
  try{
    console.log('filling with native value in setter',val)
    const oldVal = el.value; // needed to nudge React's _valueTracker

    let proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype
              : el instanceof HTMLInputElement ? HTMLInputElement.prototype
              : HTMLElement.prototype;
    const desc = Object.getOwnPropertyDescriptor(proto, 'value');
    if (desc?.set){ desc.set.call(el, val);console.log('nat1');}
    else{
       el.value = val;
       console.log('nat2');
    }

    // If React is managing this element, mark it dirty so onChange fires
    const tracker = el._valueTracker;
    if (tracker) tracker.setValue(oldVal);

  }catch{
    console.log('filling regulare value in setter',val)
    el.value = val;
  }
}

// --- tiny helper (mouse only) ---
function simulateMouse(el){
  const r = el.getBoundingClientRect();
  const x = Math.floor(r.left + r.width/2), y = Math.floor(r.top + Math.min(r.height/2, 12));
  const ev = (t)=>new MouseEvent(t,{bubbles:true,cancelable:true,clientX:x,clientY:y});
  el.dispatchEvent(ev('mousedown'));
  el.dispatchEvent(ev('mouseup'));
  //el.dispatchEvent(ev('click'));
}

// --- updated: fires input+change, plus light keyboard fallback ---
function fireInputEvents(el, val){ 
  // try to hit editors that listen to beforeinput/input
  try{ el.dispatchEvent(new InputEvent('beforeinput',{bubbles:true,cancelable:true,inputType:'insertFromPaste',data:String(val)})); }catch{}
  try{ el.dispatchEvent(new InputEvent('input',{bubbles:true,cancelable:true,inputType:'insertFromPaste',data:String(val)})); }catch{
    el.dispatchEvent(new Event('input',{bubbles:true,cancelable:true}));
  }

  // tiny keyboard nudge (some UIs set dirty state on key events)
  el.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
  el.dispatchEvent(new KeyboardEvent('keyup',{key:'Enter',bubbles:true}));

  // finalizer most libs listen for
  el.dispatchEvent(new Event('change',{bubbles:true,cancelable:true}));
}
// --- updated: just adds mouse + a couple key events; rest unchanged ---
async function fillInput(el, value, opts = { mapped:false }){
  if(!el || el.disabled || el.readOnly) return;
  const tag = el.tagName?.toUpperCase?.() || '';
  const type = (el.type||'text').toLowerCase();

  let normVal = value;
  if(normVal===true) normVal='yes';
  if(normVal===false) normVal='no';

  el.scrollIntoView({behavior:'smooth', block:'center'});
  await delay(40);

  if(type==='file'){ console.log('skipping becuase of file');return; }
    // In your main fillInput()
  if (isWorkdayCombo(el)) {
    console.log('Fill Input workdaycombo for select');
    //const ok = await fillWorkdayDropdown(el, value);
    const ok = await fillWorkdayByButton(el, value);
    if (ok) el.setAttribute('data-autofilled','true');
    return;
  }

  if (tag === 'SELECT' || isComplexDropdown(el)) {
    console.log('1. fill Input select complex type');
    const ok = await fillSelectElement(el, value);
    if (ok) el.setAttribute('data-autofilled', 'true');
    return;
  }

  // CONTENTEDITABLE
  if(el.isContentEditable || el.getAttribute('role')==='textbox'){
    console.log('filling content editable and text')
    simulateMouse(el);//not contains click event         // NEW
    el.focus();
    el.click();
    try{
      document.execCommand('selectAll',false,null);
      document.execCommand('insertText', false, String(normVal));
    }catch{
      el.textContent = String(normVal);
    }
    fireInputEvents(el, normVal); //contains change event
    el.dispatchEvent(new Event('change', { bubbles: true })); 
    el.blur(); 
    el.dispatchEvent(new Event('blur',{bubbles:true}));
    await delay(50);
    markAutofilled(el, opts.mapped ? 'mapped' : 'fallback');
    if (opts.mapped) await waitForUiUpdates?.(2000);
    return;
  }

  // STANDARD INPUT
  console.log('filling standard inputs');
  simulateMouse(el);              // NEW
  el.focus();
  el.click();
  setValueWithNativeSetter(el, String(normVal)); //setting value
  fireInputEvents(el, normVal);
  el.blur(); 
  el.dispatchEvent(new Event('blur',{bubbles:true}));
  await delay(50);
  markAutofilled(el, 'choice');

}

// --- updated: checkbox/radio adds mouse + key fallback, minimal ---
async function checkElement(el, should){
  const type = (el.type||'').toLowerCase();
  if (type==='checkbox' || type==='radio'){
    if (el.checked !== !!should){
      simulateMouse(el);          // NEW
      el.focus();
      el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      el.click?.();
      // tiny keyboard fallback
      el.dispatchEvent(new KeyboardEvent('keydown',{key:' ',bubbles:true})); // NEW
      el.dispatchEvent(new KeyboardEvent('keyup',{key:' ',bubbles:true}));   // NEW
      el.dispatchEvent(new Event('change',{bubbles:true}));
      //fireInputEvents(el,should);
    }
    await delay(50);
    markAutofilled(el, 'choice');
  }
}

// ---------- Helpers to materialize mappings for a known section ----------
function sectionToPrefix(sectionKey){
  return sectionKey === 'education' ? 'educations'
       : sectionKey === 'experience' ? 'experiences'
       : sectionKey; // languages/certifications if you later add address for them
}

// Strip leading "<prefix>[x]." or "educations[x]." to a relative key
function toRelativeKey(dataKey, sectionKey){
  const prefix = sectionToPrefix(sectionKey);
  return dataKey
    .replace('{prefix}', prefix)
    .replace(/^educations\[x]\./, '')
    .replace(/^experiences\[x]\./, '')
    .replace(new RegExp('^' + prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\[x]\\.'), '');
}

//Main populating logic
async function populateFields(inputs, data){
  if(!data) return;
  const normalizedData = {};
  for(const key in data){
    normalizedData[normalizeFieldName(key)] = data[key];
  }
  autofillData = normalizedData;


  //try { await resumeFirstFromInputs(inputs,autofillData, 500); } catch(e){ console.log('No file Input found:',e); }

  const processedGroups = new Set();
  const WD = isWorkdayHost();

  for(let i=0;i<inputs.length;i++){
    const obj = inputs[i];
    const el = obj.element;
    const groupId = obj.groupId;
    let inputName = obj.humanName;
    console.log('Inside populate fields, el, Id, name:',el,groupId,inputName);
    if(el.getAttribute('data-autofilled')==='true'){
      console.log('populate skipping autofilled element:',el);
      continue;
    }
    if(el.disabled || el.readOnly) continue;
    if (WD && /\bcountry\b/i.test(inputName)) {
      console.log('Skip Workday country');
      continue;
    }
    // === New decision core for mappings / repeated sections ===
    const decision = decideMappingForInput(el, inputName, autofillData, {
      fieldMappings, eduMappings, expMappings, addressMappings
    });
    if(decision &&el.type==='text'&& el.value){console.log('making value as empty');el.value = '';} 
    if (!decision || decision.skip){console.log('populate no decision el:',inputName);continue;}
    let entry = decision.mapping;
    let val = getByPath(autofillData, decision.dataKey);
    console.log('populate vlaue by path',val);
    // fallback to name/id if still empty and not address
    if(val===undefined && (!decision.mapping?.type || decision.mapping?.type!=='address')){
      val = autofillData[normalizeFieldName(el.name)] ?? autofillData[normalizeFieldName(el.id)];
    }
    if(val===undefined) continue;

    if(val===true) val='yes';
    if(val===false) val='no';

    const t = (el.type||'').toLowerCase();
    if (t === 'checkbox' && !groupId && !inputName) {
      const normVal = normalizeToBooleanLike(val);
      const elementLabelNorm = normalizeToBooleanLike(findAssociatedLabel(el) || el.value || '');
      if (elementLabelNorm === 'yes' || elementLabelNorm === 'no') {
        const shouldCheck = normVal === elementLabelNorm;
        await checkElement(el, shouldCheck);
        continue;
      }
      const isTrueVal = normVal === 'yes';
      if (isTrueVal) {
        await checkElement(el, true);
        continue;
      } else if (normVal === 'no') {
        // If the input explicitly says 'false', uncheck it.
        await checkElement(el, false);
        continue;
      }
    }
    if((groupId || inputName) && (t==='radio' || t==='checkbox'|| isAshbyButtonEntry(obj))){
      console.log('entered into checkbox groupId')
      const groupKey = groupId || normalizeFieldNameWithSpace(inputName);
      if(processedGroups.has(groupKey)) continue;
      const normNameEq = (a,b)=> normalizeFieldNameWithSpace(a) === normalizeFieldNameWithSpace(b);
      const groupObjs = inputs.filter(x => {
        const sameGroup = x.element !== el && (x.groupId === groupId || (inputName && normNameEq(x.humanName, inputName)));
        if (!sameGroup) return false;
        const xt = (x.element.type || '').toLowerCase();
        const isChoice = (xt === 'radio' || xt === 'checkbox') || isAshbyButtonEntry(x);
        return isChoice;
      });
      groupObjs.push(obj);
      const checkboxMap = [];
      for (const g of groupObjs) {
        let label;
        if (isAshbyButtonEntry(g)) {
          label = normalizeFieldNameWithSpace(g.optionText); // "yes" / "no"
        } else {
          const gEl = g.element;
          label = normalizeFieldNameWithSpace(findAssociatedLabel(gEl) || gEl.value || '');
        }
        checkboxMap.push({ label, element: g.element, isButton: isAshbyButtonEntry(g) });
      }
      const desiredValues = Array.isArray(val) ? val.map(v=>String(v)) : [String(val)];
      const wantedNorms = desiredValues.map(v => normalizeFieldNameWithSpace(v));

      const wantedBool = desiredValues.map(v=>normalizeToBooleanLike(v));
      const labelsBool = checkboxMap.map(x=>normalizeToBooleanLike(x.label));
      if (new Set(wantedBool).size === 1 && (labelsBool.includes('yes') || labelsBool.includes('no'))){
        for (const x of checkboxMap){
          const should = normalizeToBooleanLike(x.label) === wantedBool[0];
          if (x.isButton) {
            if (should) x.element.click();
          } else {
            await checkElement(x.element, should);
          }
        }
        processedGroups.add(groupKey);
        console.log('checkbox done');
        continue;
      }
      for (const wanted of wantedNorms){
        let final = checkboxMap.find(x=>x.label === wanted)
                || checkboxMap.find(x=>x.label.includes(wanted));

        if(!final){
          const tokens = new Set(wanted.split(/\s+/).filter(Boolean));
          let best = {item:null,score:-1};
          for (const x of checkboxMap){
            const ts = new Set(x.label.split(/\s+/).filter(Boolean));
            const overlap = [...tokens].filter(t=>ts.has(t)).length;
            if (overlap > best.score) best = {item:x, score:overlap};
          }
          final = best.item;
        }

        if(final){
          if (final.isButton) {
            final.element.click();
          } else {
            await checkElement(final.element, true);
          }
        }
      }
      if (t==='radio'){
        for (const x of checkboxMap){
          if (x.isButton) continue;
          const keep = x.element.getAttribute('data-autofilled') === 'true';
          if(!keep) await checkElement(x.element, false);
        }
      }
      processedGroups.add(groupKey);
      continue;
    }
    if (el.tagName === 'BUTTON') continue; 
    // non-grouped input fill
    el.classList.add('autofill-highlight');
    el.setAttribute('data-autofilled','true');
    // If you handle special types, add here (file, date, code). Keeping simple:
    if (entry.type === 'date'){
      // If single-field, just fill normally
      if (obj._dateMeta?.mode !== 'split' || !groupId){
        await fillDate(el, obj, val, { currentlyWorkHere: !!entry?.currently_work_here });
        el.setAttribute('data-autofilled','true');
        continue;
      }

      // Split date: batch the local trio based on decision.kind/index + side (no sectionKey)
      const bkey = batchKeyForDate(decision, obj);
      if (processedDateBatches.has(bkey)) continue;

      const peers = collectLocalSplitDatePeers(inputs, i, obj);
      if (peers.length === 0){
        // Fallback: just fill this one if we somehow didn't find mates
        await fillDate(el, obj, val, { currentlyWorkHere: !!entry?.currently_work_here });
        el.setAttribute('data-autofilled','true');
        processedDateBatches.add(bkey);
        continue;
      }

      for (const peer of peers){
        await fillDate(peer.element, peer, val, { currentlyWorkHere: !!entry?.currently_work_here });
        peer.element.setAttribute('data-autofilled','true');
      }
      processedDateBatches.add(bkey);
      continue;
    }

    if(t!=='file'){
      await fillInput(el, val, { mapped:true });
    }
    setTimeout(()=>el.classList.remove('autofill-highlight'), 260);
    if(groupId){
      processedGroups.add(groupId);
    }

    await delay(60);
  }

}

/*************************************************
 * autofillInit — unchanged call flow
 *************************************************/
export async function autofillInit(tokenOrData, arg2 = null) {
  // Back-compat: if arg2 looks like opts, treat it as opts; else it’s dataFromPopup
  const looksLikeOpts = arg2 && typeof arg2 === 'object' && ('reentry' in arg2);
  const opts = looksLikeOpts ? (arg2 || {}) : null;
  const dataFromPopup = looksLikeOpts ? null : arg2;

  const data = dataFromPopup ?? tokenOrData;
  const reentry = !!opts?.reentry;

  console.log('[autofillInit] data:', data, 'reentry:', reentry);
  if (!data) { console.log('[autofill] No data provided to autofillInit'); return; }

  autofillData = data;

  await waitForDomStable({ timeoutMs: 1000, quietMs: 180 });
  const inputs = inputSelection();
  console.log('[autofill] All inputs (first pass):', inputs.length, inputs.slice(0,70));

  // ---- Minimal re-entry guard ----
  if (!(reentry && IS_SET1)) {
    // normal flow OR non-icims re-entry: allow resume parsing
    try {
      await resumeFirstFromInputs(inputs, autofillData, 500);
    } catch (e) {
      console.log('No file Input found:', e);
    }
  } else {
    console.log('[resume] re-entry on SET1 (iCIMS): skipping resume upload');
  }

  await populateFields(inputs, data);
  await processAddSectionsFromData(autofillData);
}

/*
export async function autofillInit(tokenOrData, dataFromPopup=null){
  const data = dataFromPopup ?? tokenOrData;
  console.log('[autofillInit] data:', data);
  if(!data){ console.log('[autofill] No data provided to autofillInit'); return; }
  autofillData = data;
  await waitForDomStable({ timeoutMs: 1000, quietMs: 180 });
  const inputs = inputSelection();
  console.log('[autofill] All inputs (first pass):', inputs.length,inputs.slice(0,70));

  try {
    await resumeFirstFromInputs(inputs,autofillData, 500); 
  } catch(e) {
    console.log('No file Input found:',e);
  }
  await populateFields(inputs, data);
  await processAddSectionsFromData(autofillData);
}
*/