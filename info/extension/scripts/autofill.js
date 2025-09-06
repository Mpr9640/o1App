// autofill.js — universal + layout-agnostic
// Works with text/number/date/email/tel/password/textarea/contenteditable/select/checkbox/radio/file
// Handles React/MUI/AntD/React-Select comboboxes, drag-n-drop dropzones, and shadow DOM inputs.

// ====== Config ======
//import { embedOne, embedMany, cosineSim } from './embeddingclient.js';
const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const DEBUG = true; // flip to false to quiet logs

// ====== Styles (highlight) ======
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
    .trim();
}

function simulateMouseMove(el){
  try{
    const r = el.getBoundingClientRect();
    const x = r.left + (Math.random()*r.width);
    const y = r.top  + (Math.random()*r.height);
    el.dispatchEvent(new MouseEvent('mousemove',{clientX:x,clientY:y,bubbles:true}));
  }catch{}
}

function formatDate(val){
  try{
    const d = new Date(val);
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,'0');
    const day = String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${day}`;
  }catch{ return ''; }
}

// ====== Nearby text (fallback label) ======
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

// ====== Field name inference ======

function inputFieldSelection(field){
  if(!field) return '';
  console.log('field',field);
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
  const inContainers = ()=>{
    let el=field;
    while(el && el!==document.body){
      const p = el.parentNode;
      if(p && ['DIV','SECTION','SPAN','TD','TH','LI'].includes(p.tagName)){
        const txt = (p.textContent||'').trim();
        if(txt) return clean(txt);
      }
      let prev = el.previousElementSibling;
      while(prev){
        if(['DIV','SECTION','SPAN','TD','TH','LI'].includes(prev.tagName) && prev.textContent?.trim()){
          return clean(prev.textContent);
        }
        prev = prev.previousElementSibling;
      }
      el = el.parentNode;
    }
    return '';
  };

  let name = '';
  if(['checkbox','radio'].includes(field.type)) name = inFieldset() || labelAssoc() || inContainers();
  if(!name && field.id){
    const lab = document.querySelector(`label[for="${CSS.escape(field.id)}"]`);
    name = lab ? clean(`${field.id} ${lab.textContent}`) : clean(field.id);
  }
  if(!name && field.hasAttribute('aria-label')) name = clean(field.getAttribute('aria-label'));
  if(!name && field.hasAttribute('aria-labelledby')){
    const lbl = document.getElementById(field.getAttribute('aria-labelledby'));
    if(lbl) name = clean(lbl.textContent);
  }
  if(!name && field.name) name = clean(field.name);
  if(!name && field.title) name = clean(field.title);
  if(!name) name = inFieldset() || labelAssoc() || inContainers();
  if(!name && field.placeholder) name = clean(field.placeholder);
  if(!name) name = nearestTextAround(field);

  fieldNameCache.set(field,name||'');
  return name||'';
}

// ====== Address / Section prefixes ======
const sectionKeywords = [
  { keywords:[/residence|residential|home|permanent|location|living|current address/], type:'address', prefix:'residence' },
  { keywords:[/school|education|university|college/], type:'address', prefix:'school' },
  { keywords:[/job|employment|work|company|employe|previous employer|current employer/], type:'address', prefix:'job' },
];
function getSectionPrefix(input){
  let cur=input;
  while(cur && cur!==document.body){
    const wrap = cur.closest('fieldset,section,div,span,form');
    if(wrap){
      const title = wrap.querySelector('legend,h1,h2,h3,label,.section-title,.title');
      const txt = title?.textContent?.toLowerCase() || '';
      for(const s of sectionKeywords){
        if(s.keywords.some(k=>k.test(txt))) return s.prefix;
      }
    }
    cur = cur.parentElement;
  }
  return 'residence';
}

// ====== Dataset mappings ======
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
  {keywords:[/address|city|town|zip|postal|location|state|country/], dataKey:'dummy', type:'address'},
  {keywords:[/name|fullname/], dataKey:'fullname', type:'text'},
];


// ====== Label helpers for radios/checkboxes ======
function findAssociatedLabel(input){
  const c = input.closest('div, span, label, li, tr, td, th');
  if(!c) return null;
  const direct = c.querySelector('label') || c.querySelector('button');
  if(direct) return direct.textContent.trim();
  const sibs = [...c.parentElement?.children || []].filter(x=>x.tagName?.toLowerCase()==='label');
  if(sibs.length) return sibs[0].textContent.trim();
  const forAttr = document.querySelector(`label[for="${CSS.escape(input.id||'')}"]`);
  if(forAttr) return forAttr.textContent.trim();
  return nearestTextAround(input);
}

// ====== Dropdown/Autocomplete ======
function isComplexDropdown(el){
  const hasPopup = el.getAttribute('aria-haspopup')?.toLowerCase()==='listbox';
  const sibBtn = !!el.parentElement?.querySelector('button[aria-haspopup="listbox"]');
  const sibSpan = !!el.nextElementSibling?.matches('span[aria-haspopup="listbox"]');
  return el.getAttribute('role')==='combobox'
      || el.classList?.contains('autocomplete')
      || !!el.closest('.dropdown-menu,.MuiAutocomplete-root,.MuiSelect-root,.ant-select')
      || (el.placeholder||'').toLowerCase().match(/search|select/)
      || hasPopup || sibBtn || sibSpan;
}

async function trySearchingInDropdown(input, rawValue){
  const value = String(rawValue);
  const normValue = normalizeFieldName(value);

  input.focus(); input.click();
  await delay(80);
  input.dispatchEvent(new Event('focus', { bubbles: true }));
  input.value = '';
  input.dispatchEvent(new Event('input',{bubbles:true}));
  input.dispatchEvent(new Event('change',{bubbles:true}));
  await delay(80);

  // Type chars with keyboard events (helps MUI/AntD filtering)
  for(const ch of value){
    input.value += ch;
    input.dispatchEvent(new KeyboardEvent('keydown',{key: ch,bubbles:true,cancelable:true}));
    input.dispatchEvent(new KeyboardEvent('keypress',{key: ch,bubbles:true,cancelable:true}));
    input.dispatchEvent(new Event('input',{bubbles:true}));
    input.dispatchEvent(new KeyboardEvent('keyup',{key: ch,bubbles:true,cancelable:true}));
    await delay(60);
  }
  input.dispatchEvent(new Event('change',{bubbles:true}));
  await delay(250);

  // Look for options
  let options = document.querySelectorAll(
    '[role="option"]:not([aria-disabled="true"]):not(.Mui-disabled),' +
    '.dropdown-option:not([aria-disabled="true"]),' +
    'li.MuiAutocomplete-option:not(.Mui-disabled),' +
    '.MuiList-root .MuiMenuItem-root:not(.Mui-disabled),' +
    '.ant-select-item-option:not(.ant-select-item-option-disabled),' +
    'div[data-value][role="option"],' +
    'ul[role="listbox"] > li:not([aria-disabled="true"]):not([aria-hidden="true"])'
  );

  const trySelect = (matcher)=>{
    for(const opt of options){
      if(opt.offsetParent===null) continue; // visible only
      const t = normalizeFieldName(opt.textContent||opt.innerText||'');
      const dv = normalizeFieldName(opt.getAttribute?.('data-value')||opt.value||'');
      if(matcher(t, dv, opt)) return opt;
    }
    return null;
  };

  let chosen = trySelect((t,dv)=> t===normValue || dv===normValue)
            || trySelect((t,dv)=> t.includes(normValue) || dv.includes(normValue));

  if(chosen){
    chosen.scrollIntoView({behavior:'smooth', block:'center'});
    await delay(80);
    chosen.click();
    chosen.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,cancelable:true}));
    chosen.dispatchEvent(new MouseEvent('mouseup',{bubbles:true,cancelable:true}));
    input.dispatchEvent(new Event('change',{bubbles:true}));
    input.blur(); input.dispatchEvent(new Event('blur',{bubbles:true}));
    log('Dropdown: picked option', chosen.textContent?.trim());
    return true;
  }

  // Keyboard fallback: ArrowDown + Enter (first option)
  log('Dropdown: keyboard fallback');
  input.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true}));
  input.dispatchEvent(new KeyboardEvent('keyup',{key:'ArrowDown',bubbles:true}));
  await delay(120);
  input.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
  input.dispatchEvent(new KeyboardEvent('keyup',{key:'Enter',bubbles:true}));
  input.dispatchEvent(new Event('change',{bubbles:true}));
  input.blur(); input.dispatchEvent(new Event('blur',{bubbles:true}));
  return true;
}

// ====== File handling (resume) ======
function isParseResumeInput(input){
  const ctx = (input.closest('form,section,div,fieldset')?.textContent || '') + ' ' + inputFieldSelection(input);
  return ['autofill','parse','auto','smart','generate','resume','upload','attach'].some(k => ctx.toLowerCase().includes(k));
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
        if(resp && resp.success){
          //const file = new File([resp.fileBlob],resp.filename,{type: resp.type});
          //resolve(file);
          resolve(resp);

        }
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
  inputElement.files = dt.files;
  inputElement.dispatchEvent(new Event('input',{bubbles:true}));
  inputElement.dispatchEvent(new Event('change',{bubbles:true}));
  log('Resume set via background', filename);
  return true;
} 

async function tryAttachToDropzones(fileUrl){
  // Common dropzones (Greenhouse, Lever, Workday, custom)
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
      log('Dropzone upload attempted');
      return true;
    }catch(e){
      log('Dropzone error', e);
      z.classList.remove('autofill-drop-indicator');
    }
  }
  return false;
}

async function handleFileInput(input, fileUrl){
  try{
    // Try native input first via background
    const ok = await simulateFileSelectionFromBackground(input, fileUrl);
    if(ok) return true;
  }catch(e){
    log('Native file set failed, trying dropzone', e);
  }
  // Try dropzones as fallback
  try{
    const ok2 = await tryAttachToDropzones(fileUrl);
    if(ok2) return true;
  }catch(e){ log('Dropzone attach failed', e); }

  // Link injection as last resort (visual confirmation)
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

// To minimize description like fuzzy logic.
function normalizeOptionText(text) {
  return text
    .split("-")[0]   // take only before dash
    .replace(/\(.*?\)/g, "")  // remove parentheses
    .trim()
    .toLowerCase();
}


// ====== Core fill ======
async function fillInput(el, value){
  if(!el || el.disabled || el.readOnly) return;
  const tag = el.tagName.toUpperCase();
  const type = (el.type||'text').toLowerCase();

  let normVal = value;
  if(normVal===true) normVal='yes';
  if(normVal===false) normVal='no';

  simulateMouseMove(el);
  el.scrollIntoView({behavior:'smooth', block:'center'});
  await delay(60);

  const hasPopup = el.getAttribute('aria-haspopup')?.toLowerCase()==='listbox';
  const sibBtn   = !!el.parentElement?.querySelector('button[aria-haspopup="listbox"]');
  const sibSpan  = !!el.nextElementSibling?.matches('span[aria-haspopup="listbox"]');
  const complex  = isComplexDropdown(el) || hasPopup || sibBtn || sibSpan;

  if(tag==='SELECT'){
    if(complex){ await trySearchingInDropdown(el, String(normVal)); return; }
    const nv = normalizeFieldNameWithSpace(String(normVal));
    let selected = false;
    for(const opt of el.options){
      const ov = normalizeFieldNameWithSpace(opt.value || opt.textContent || '');
      if(ov===nv || ov.includes(nv)){
        opt.selected = true; selected=true;
        el.dispatchEvent(new Event('input',{bubbles:true}));
        el.dispatchEvent(new Event('change',{bubbles:true}));
        break;
      }
    }
    if(!selected) log('No option matched for select', normVal);
  }
  else if(type==='file'){
    // do nothing here (we set via handler)
  } else {
    // contenteditable
    if(el.isContentEditable || el.getAttribute('role')==='textbox'){
      el.focus();
      el.textContent = String(normVal);
      el.dispatchEvent(new Event('input',{bubbles:true}));
      el.dispatchEvent(new Event('change',{bubbles:true}));
      el.blur(); el.dispatchEvent(new Event('blur',{bubbles:true}));
      return;
    }
    // complex text-based combobox?
    if(complex){
      await trySearchingInDropdown(el, String(normVal));
      return;
    }
    // standard inputs
    el.focus();
    // (optional: simulate typing) — direct set is more reliable for frameworks + then fire events
    el.value = String(normVal);
    el.dispatchEvent(new Event('input',{bubbles:true}));
    el.dispatchEvent(new Event('change',{bubbles:true}));
    el.blur(); el.dispatchEvent(new Event('blur',{bubbles:true}));
  }
}

// ====== Address field routing ======
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
      if(m.t==='date') await fillInput(input, formatDate(data[m.dk]));
      else await fillInput(input, data[m.dk]);
      break;
    }
  }
}
// ====== Inputs collector (incl. shadow DOMs) ======
function allShadowHosts(root=document){
  return [...root.querySelectorAll('*')].filter(el=>el.shadowRoot);
}
function collectInputsIn(root) {
  const sel = `
    input:not([disabled]):not([readonly]),
    select:not([disabled]):not([readonly]),
    textarea:not([disabled]):not([readonly]),
    [contenteditable="true"]:not([aria-disabled="true"])
  `;
  const nodes = [...root.querySelectorAll(sel)];
  const results = [];
  let groupCounter = 0;

  for (const input of nodes) {
    let groupId = null;
    let humanName = null;

    if (input.type === 'checkbox' || input.type === 'radio') {
      // group checkboxes/radios by nearest container
      const container = input.closest('fieldset, section, div, form') || input.parentElement || root;
      if (!groupCache.has(container)) {
        groupCache.set(container, `group-${groupCounter++}`);
      }
      groupId = groupCache.get(container);

      // attach human-readable name once
      if (!container._humanName) {
        container._humanName = inputFieldSelection(input) || input.name || '';
      }
      humanName = container._humanName;
    } else {
      humanName = inputFieldSelection(input) || input.name || '';
    }

    results.push({
      element: input,
      groupId,
      humanName
    });
  }
  return results;
}

function inputSelection() {
  const roots = [document];
  const stack = [...allShadowHosts(document)];

  while (stack.length) {
    const host = stack.pop();
    if (host.shadowRoot) {
      roots.push(host.shadowRoot);
      stack.push(...allShadowHosts(host.shadowRoot));
    }
  }

  const all = roots.flatMap(r => collectInputsIn(r));

  // deduplicate by element
  const uniq = [];
  const seen = new WeakSet();
  for (const it of all) {
    if (!seen.has(it.element)) {
      seen.add(it.element);
      uniq.push(it);
    }
  }
  return uniq;
}

// Helper function to perform autofill
async function autofillElement(el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await delay(40);
    if (!el.checked) {
        el.click();
        el.dispatchEvent(new Event('change', { bubbles: true }));
    }
    el.setAttribute('data-autofilled', 'true');
    el.classList.add('autofill-highlight');
    setTimeout(() => el.classList.remove('autofill-highlight'), 260);
}

// ====== Populate all ======
async function populateFields(inputs, data){
  if(!data) return;
  const normalizedData = {};
  for(const key in data) normalizedData[normalizeFieldName(key)] = data[key];
  autofillData = normalizedData;
  //console.log('autofillData',autofillData);

  const processedGroups = new Set();

  for(const obj of inputs){
    const el = obj.element;
    const groupId = obj.groupId;
    const inputName = obj.humanName;

    if(el.getAttribute('data-autofilled')==='true') continue;
    if(el.disabled || el.readOnly) continue;

    //const inputName = inputFieldSelection(el);
    console.log('InputName',inputName);
    let bestKey;
    if(autofillData){
      const filteredAutofillData = Object.fromEntries(Object.entries(autofillData).filter(([key]) => key !== "userid"));
      const keys = Object.keys(filteredAutofillData);
      const response = await new Promise((resolve,reject)=>{
        chrome.runtime.sendMessage({
          type: 'bestMatch',
          text: inputName,
          labels: keys
        },(res)=>{
          if(res && res.ok){
            resolve(res);
          }
          else{
            reject(res?.error || "Best match failed");
          }
        });
      });
      
      if(response){bestKey=response.label};
      console.log('bestkey:',bestKey);
      //if(bestKey) val = autofillData[bestKey];
    } 

    const mapping = fieldMappings.find(m => m.keywords.some(rx => rx.test(inputName)));
    // determine value dynamically
    let val = null;
    val = mapping ? (normalizedData[mapping.dataKey] ?? normalizedData[bestKey]) : undefined;

    if(val===true) val='yes';
    if(val===false) val='no';

    // fallback to name/id
    if(val===undefined){
      val = normalizedData[normalizeFieldName(el.name)] ?? normalizedData[normalizeFieldName(el.id)];
    }
    if(val===undefined && (!mapping || mapping.type!=='address')) continue;

    // handle grouped radios/checkboxes
    if((groupId || inputName) && (el.type==='radio' || el.type==='checkbox')){
      if(processedGroups.has(inputName || groupId)) continue;

      const groupEls = inputs.filter(x =>
          groupId ? x.groupId === groupId : x.humanName === inputName
      ).map(x => x.element);
      const checkboxMap= [];
      for(const gEl of groupEls){
        const Inputlabel = findAssociatedLabel(gEl) || gEl.value || '';
        checkboxMap.push({label:Inputlabel,element:gEl});
      }
      const wantValues = Array.isArray(val)
          ? val.map(v => String(v))
          : [String(val)];
      for(const wanted of wantValues){     
          //const bestMatch = await decideMatch(label, wantValues);
          const response = await new Promise((resolve,reject)=>{
            chrome.runtime.sendMessage({
              type: 'bestMatch',
              text: wanted,
              labels: checkboxMap.map(x=>x.label)
            },(res)=>{
              if(res && res.ok){
                resolve(res);
              }
              else{
                reject(res?.error || 'Best Match Failed');
              }
            })
          })
          const bestMatch = response.label
          console.log('bestmatch:',bestMatch);
          let finalCheck;
          if(bestMatch){
            finalCheck = checkboxMap.find(x=>x.label === bestMatch)?.element;
            console.log('finalCheck',finalCheck);
          }
          if(finalCheck){
              await autofillElement(finalCheck);
              //break;
          }

      }


        processedGroups.add(groupId || inputName);
        continue;
    }


    // everything else
    el.classList.add('autofill-highlight');
    el.setAttribute('data-autofilled','true');

    if(mapping?.type==='file' && el.type==='file' && inputName.includes('resume')){
      try{ await handleFileInput(el, val); await delay(120); }catch(e){ log('File handle error', e); }
    } else if(mapping?.type==='address'){
      const prefix = getSectionPrefix(el);
      await fillAddressFields(el, inputName, normalizedData, prefix);
    } else if(mapping?.type==='date'){
      await fillInput(el, formatDate(val));
    }
    // Phone with code (best-effort)
    else if(mapping?.type==='code' && mapping.handleCountryCode && mapping.dataKey==='phonenumber'){
      const prevSelect = el.previousElementSibling;
      if(prevSelect?.tagName?.toUpperCase()==='SELECT'){
        const parts = String(val).match(/^\+?(\d{1,3})?(\d+)$/);
        if(parts && parts[1]){
          const code = parts[1], num = parts[2];
          let set=false;
          for(const opt of prevSelect.options){
            if(opt.value.includes(code)){
              opt.selected=true;
              prevSelect.dispatchEvent(new Event('change',{bubbles:true}));
              await fillInput(el, num);
              set=true; break;
            }
          }
          if(!set) await fillInput(el, val);
        }else{
          await fillInput(el, val);
        }
      }else{
        await fillInput(el, val);
      }
    } else {
      await fillInput(el, val);
    }

    setTimeout(()=>el.classList.remove('autofill-highlight'), 260);
    await delay(80);
    if(groupId) processedGroups.add(groupId);
  }
}


// ====== Public init ======
let autofillData = null;
let val = null;
export async function autofillInit(tokenOrData, dataFromPopup=null){
  // Support both signatures: (data) or (token, dataFromPopup)
  const data = dataFromPopup ?? tokenOrData;
  if(!data){ log('No data provided to autofillInit'); return; }
  // Normalize & run
  autofillData = data;
  const inputs = inputSelection();
  await populateFields(inputs, data);
}

let debounce;
const form = document.querySelector("form") || document.body;
const observer = new MutationObserver(mutations => {
  clearTimeout(debounce);
  debounce = setTimeout(async () => {
    if (!autofillData) return;

    // Only continue if *any* added nodes contain form inputs
    const hasNewInputs = mutations.some(m =>
      [...m.addedNodes].some(n => n.querySelector?.("input, select, textarea"))
    );

    if (!hasNewInputs) return;

    const all = inputSelection();
    const unfilled = all.filter(i =>
      i.element.getAttribute("data-autofilled") !== "true" &&
      !i.element.disabled &&
      !i.element.readOnly
    );

    if (unfilled.length) {
      log(`New inputs detected: ${unfilled.length} — autofilling.`);
      await populateFields(unfilled, autofillData);
    }
    /*if (unfilled.length) {
      await populateFields(unfilled, autofillData);
      observer.disconnect(); // stop listening
    } */
  }, 400);
});
observer.observe(form, { childList:true, subtree:true });
// (Optionally expose for manual re-run)
export async function autofillRerun(){
  if(!autofillData) return;
  const inputs = inputSelection();
  await populateFields(inputs, autofillData);
}














