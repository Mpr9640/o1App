// background.js — canonical URLs + instant applied cache + ML ranking + sticky job context

import apiClient from "../src/axios.js";
import {
  extractSkillCandidates,
  getUserSkillsSet,
  fuzzyMatch,
  normalizeSkill,
  refreshTaxonomyIfStale,
  setRemoteTaxonomy,
} from './scripts/skillmatching.js';

import { pipeline } from '@huggingface/transformers';

const DEBUG = false;
const USE_REMOTE_TAXONOMY = false;
const log = (...a) => DEBUG && console.log('[bg]', ...a);

/* =================== ML infra (lightweight + circuit breaker) =================== */

let zeroShotPipePromise = null;
let zeroShotDisabledUntil = 0;
let zeroShotTimeoutsInRow = 0;

const jobCtxByTab = new Map(); // tabId -> { canonical, first_canonical, meta, updated_at, confidence }

async function getZeroShot() {
  if (Date.now() < zeroShotDisabledUntil) throw new Error('zs-disabled');
  if (!zeroShotPipePromise) {
    zeroShotPipePromise = pipeline('zero-shot-classification', 'Xenova/mobilebert-uncased-mnli', { quantized: true, use_cache: true, dtype: 'q8' });
  }
  return zeroShotPipePromise;
}
function sanitizeTitle(t) {
  const s = (t||'').trim();
  if (!s) return s;
  if (/^thank\s+you\s+for\s+applying\.?$/i.test(s)) return ''; // treat as empty → fall back to ctx
  if (/^application\s+(submitted|received)\.?$/i.test(s)) return '';
  return s;
}

function noteZSTimeout(){
  zeroShotTimeoutsInRow += 1;
  if (zeroShotTimeoutsInRow >= 2) zeroShotDisabledUntil = Date.now() + 5*60*1000;
}
function noteZSSuccess(){ zeroShotTimeoutsInRow = 0; }

/* NER infra  */
let nerPipePromise = null;
let nerDisabledUntil = 0;
let nerTimeoutsInRow = 0;
async function getNER() {
  if (Date.now() < nerDisabledUntil) throw new Error('ner-disabled');
  if (!nerPipePromise) {
    nerPipePromise = pipeline('token-classification', 'chrisdepallan/ner-skills-distilbert', { quantized: true, use_cache: true, dtype: 'q8' });
  }
  return nerPipePromise;
}
function noteNERTimeout(){ nerTimeoutsInRow+=1; if(nerTimeoutsInRow>=2) nerDisabledUntil=Date.now()+5*60*1000; }
function noteNERSuccess(){ nerTimeoutsInRow=0; }

/* Timeout helper */
const timeout = (p, ms) => new Promise((resolve, reject) => {
  let done = false;
  const to = setTimeout(() => { if (!done) { done = true; reject(new Error('timeout')); } }, ms);
  p.then(v => { if (done) return; clearTimeout(to); done = true; resolve(v); })
   .catch(e => { if (done) return; clearTimeout(to); done = true; reject(e); });
});

/* =================== Taxonomy refresh (optional) =================== */
async function maybeRefreshTaxonomy() {
  try {
    const stale = await refreshTaxonomyIfStale();
    if (!stale || !USE_REMOTE_TAXONOMY) return;
    try {
      const resp = await apiClient.get('/api/skills-taxonomy', { withCredentials: true });
      if (resp?.data && Array.isArray(resp.data?.skills)) {
        setRemoteTaxonomy(resp.data.skills, resp.data.synonyms || {});
        console.log('[bg] Applied remote taxonomy');
      }
    } catch {}
  } catch {}
}

/* =================== Canonicalization + instant "applied" cache =================== */

function safeHttpUrl(u) {
  if (!u || typeof u !== 'string') return null;
  try {
    const x = new URL(u);
    if (x.protocol === 'http:' || x.protocol === 'https:') return x.href;
  } catch {}
  return null;
}

async function rememberAppliedInstant(url, iso) {
  try {
    const canon = canonicalJobUrl(url);
    if (!canon) return;
    const key = 'appliedInstantMap';
    const cur = await new Promise(res => chrome.storage.local.get(key, v => res(v[key] || {})));
    cur[canon] = iso || new Date().toISOString();
    await new Promise(res => chrome.storage.local.set({ [key]: cur }, () => res()));
  } catch {}
}

async function getInstantApplied(url) {
  try {
    const canon = canonicalJobUrl(url);
    const key = 'appliedInstantMap';
    const cur = await new Promise(res => chrome.storage.local.get(key, v => res(v[key] || {})));
    return canon ? cur[canon] || null : null;
  } catch { return null; }
}

/** Canonical URL builder (used as stable job key) */
function canonicalJobUrl(u) {
  if (!u) return null;
  try {
    const x = new URL(u);

    const host = x.hostname.toLowerCase();
    const path = x.pathname;

    const strip = (url) => {
      const t = new URL(url);
      t.search = ''; t.hash = '';
      return t.toString();
    };

    // Aggregators
    if (host.endsWith('linkedin.com')) {
      const m = path.match(/\/jobs\/view\/(\d+)/);
      const id = m?.[1] || x.searchParams.get('currentJobId');
      return id ? `https://www.linkedin.com/jobs/view/${id}/` : strip(x);
    }
    if (host.match(/(^|\.)indeed\.com$/)) {
      const jk = x.searchParams.get('jk') || x.searchParams.get('vjk');
      return jk ? `https://${x.hostname}/viewjob?jk=${jk}` : strip(x);
    }
    if (host.match(/(^|\.)dice\.com$/)) {
      const j = x.searchParams.get('jobid') || x.searchParams.get('id');
      return j ? `https://${x.hostname}/job-detail/${j}` : strip(x);
    }
    if (host.match(/(^|\.)monster\.com$/)) {
      const m = path.match(/\/job\/([^/]+)/);
      return m ? `https://${x.hostname}/job/${m[1]}` : strip(x);
    }
    if (host.match(/(^|\.)glassdoor\.com$/)) {
      const jobListingId = x.searchParams.get('jl');
      return jobListingId ? `https://${x.hostname}/job-listing/-${jobListingId}.htm` : strip(x);
    }

    // ATS vendors
    // Greenhouse confirmation → normalize to /jobs/<id>
    if (host.includes('greenhouse.io')) {
      const m = path.match(/\/jobs\/(\d+)/);
      if (m) return `https://${x.hostname}/jobs/${m[1]}`; // drop /application or /confirmation suffixes & queries
      return strip(x);
    }

    if (host.includes('jobs.lever.co')) {
      const bits = path.split('/').filter(Boolean);
      const id = bits[2];
      return id ? `https://${x.hostname}/${bits[0]}/${id}` : strip(x);
    }
    if (host.includes('myworkdayjobs.com')) {
      const segs = path.split('/').filter(Boolean);
      const last = segs[segs.length - 1] || '';
      return last.match(/[A-Z0-9]{8,}/i) ? `https://${x.hostname}/${segs.slice(0,4).join('/')}/${last}` : strip(x);
    }
    if (host.includes('icims.com')) {
      const m = path.match(/\/jobs\/(\d+)/i);
      return m ? `https://${x.hostname}/jobs/${m[1]}/` : strip(x);
    }
    if (host.includes('smartrecruiters.com')) {
      return strip(x);
    }
    if (host.includes('ashbyhq.com')) {
      const segs = path.split('/').filter(Boolean).slice(0, 3);
      return `https://${x.hostname}/${segs.join('/')}`;
    }
    if (host.includes('apply.workable.com')) {
      const m = path.match(/\/j\/([A-Za-z0-9]+)/);
      return m ? `https://${x.hostname}/j/${m[1]}/` : strip(x);
    }
    if (host.includes('bamboohr.com')) {
      const m = path.match(/\/careers\/(\d+)/);
      return m ? `https://${x.hostname}/careers/${m[1]}` : strip(x);
    }
    if (host.includes('taleo.net') || host.includes('oraclecloud.com')) {
      const jobId = x.searchParams.get('job') || x.searchParams.get('jobId');
      return jobId ? `${x.origin}${path.split('/').slice(0, 3).join('/')}/?job=${jobId}` : strip(x);
    }
    if (host.includes('successfactors.com')) {
      const jobId = x.searchParams.get('jobId') || x.searchParams.get('jobID');
      return jobId ? `${x.origin}${path.split('?')[0]}?jobId=${jobId}` : strip(x);
    }
    if (host.includes('workforcenow.adp.com') || host.endsWith('.adp.com')) {
      const jobId = x.searchParams.get('uid') || x.searchParams.get('jobId');
      return jobId ? `${x.origin}${path.split('?')[0]}?uid=${jobId}` : strip(x);
    }
    if (host.includes('applytojob.com') || host.includes('app.jazz.co')) {
      const m = path.match(/\/apply\/([A-Za-z0-9]+)/);
      return m ? `https://${x.hostname}/apply/${m[1]}` : strip(x);
    }

    // Fallback: host + path w/o query/hash
    x.search = ''; x.hash = '';
    return x.toString();
  } catch {
    return (u || '').split(/[?#]/)[0];
  }
}

/* =================== Matching (unchanged core) =================== */
const PROPER_CASE = new Map([
  ['javascript','JavaScript'],['typescript','TypeScript'],['java','Java'],
  ['react','React'],['node.js','Node.js'],['nodejs','Node.js'],['node','Node.js'],
  ['postgres','PostgreSQL'],['postgresql','PostgreSQL'],
  ['github','GitHub'],['github actions','GitHub Actions'],
  ['docker','Docker'],['kubernetes','Kubernetes'],
  ['aws','AWS'],['amazon web services','AWS'],
  ['gcp','GCP'],['google cloud platform','GCP'],
  ['azure','Azure'],['microsoft azure','Azure'],
  ['ai','AI'],['artificial intelligence','AI'],
  ['ml','ML'],['machine learning','ML'],
  ['control systems','Control Systems'],
]);
// (… glue helpers unchanged …)
const LEADING_GLUE = /\b(?:experience|experienced|with|using|leverag(?:e|ing)|we|ideally|strong|solid|working|hands[- ]?on|proficiency|proficient|knowledge|understanding|ability|capability|exposure|familiar(?:ity)?|background|in|on|for|of|and|or|the|a|an)\b\s*/i;
const TRAILING_GLUE = /\s*\b(?:experience|preferred|plus|considered|also|etc|skills?|knowledge|background|exposure)\b\.?$/i;
function stripGlue(s){ let t=s.trim(); for(let i=0;i<4;i++){ const b=t; t=t.replace(LEADING_GLUE,'').replace(TRAILING_GLUE,'').trim(); if(t===b)break;} return t; }
function normalizeFreeText(s){ let t=(s||'').toLowerCase(); t=t.replace(/[–—]/g,'-').replace(/[“”]/g,'"').replace(/[’']/g,"'"); t=t.replace(/[^a-z0-9+#.\s]/g,' ').replace(/\s+/g,' ').trim(); t=t.replace(/\bto\s+\w.+$/i,'').trim(); return t; }
function normalizeCoreSkill(s){ const raw=stripGlue(normalizeFreeText(s)); if(!raw) return ''; const d=PROPER_CASE.get(raw); if(d) return d; if(raw.includes('amazon web services')) return 'AWS'; if(raw.includes('google cloud platform')) return 'GCP'; if(raw.includes('microsoft azure')) return 'Azure'; const pc=PROPER_CASE.get(raw.replace(/\./g,''))||PROPER_CASE.get(raw); if(pc) return pc; const words=raw.split(' ').filter(Boolean).map(w=>{ if(['aws','gcp','ai','ml','sql','nosql','nlp','ci','cd'].includes(w))return w.toUpperCase(); if(w==='github')return'GitHub'; if(w==='postgresql'||w==='postgres')return'PostgreSQL'; if(w==='javascript')return'JavaScript'; if(w==='typescript')return'TypeScript'; if(w==='react')return'React'; if(/^[a-z]/.test(w))return w[0].toUpperCase()+w.slice(1); return w; }); return words.join(' '); }
function dropGlueExpansions(canonArr){ const stop=new Set(['with','using','to','and','or','the','a','an','of','in','on','for','build','develop','design','leverage','we','ideally','experience','preferred','plus','also','considered']); const tokens=s=>s.toLowerCase().split(/\s+/).filter(Boolean); const keep=new Set(canonArr); const arr=Array.from(keep); for(let i=0;i<arr.length;i++){ for(let j=0;j<arr.length;j++){ if(i===j)continue; const a=arr[i],b=arr[j]; if(!a||!b)continue; const ta=tokens(a),tb=tokens(b); const idx=tb.join(' ').indexOf(ta.join(' ')); if(idx===-1)continue; const rest=tb.filter(w=>!ta.includes(w)); if(rest.length && rest.every(w=>stop.has(w))){ keep.delete(b);} } } return Array.from(keep); }
function postProcessSkills(raw){ const canon=raw.map(normalizeCoreSkill).filter(Boolean); const uniq=[]; const seen=new Set(); for(const s of canon){ const k=s.toLowerCase(); if(!seen.has(k)){ seen.add(k); uniq.push(s);} } const pruned=dropGlueExpansions(uniq); return pruned.slice(0,200); }

async function extractSkillsHybrid(jdText){
  await maybeRefreshTaxonomy();
  let skills=new Set(extractSkillCandidates(jdText));
  if(skills.size<8 || skills.size>200){
    try{
      const ner=await getNER();
      // smaller slice, similar recall, lower latency (2A)
      const run = timeout(ner(jdText.slice(0,6000), { aggregation_strategy: 'simple' }), 1200);
      const out=await run; noteNERSuccess();
      for(const ent of out||[]){ const w=normalizeSkill(ent.word||ent.entity||ent.entity_group||''); if(!w)continue; if(!/[a-z0-9+#.]/i.test(w))continue; skills.add(w); if(skills.size>=180)break; }
    }catch(e){ if(String(e?.message||e).includes('timeout')) noteNERTimeout(); }
  }
  return postProcessSkills(Array.from(skills));
}
function percent(m,t){ return t? (m/t)*100 : 0; }
function matchJDToUser(jobSkillsArr,userSkillsSet){ const matched=[]; for(const jd of jobSkillsArr){ for(const us of userSkillsSet){ if(fuzzyMatch(jd,us)){ matched.push(jd); break; } } } return Array.from(new Set(matched)); }

/* =================== Per-tab LI meta cache (unchanged) =================== */
const liActiveMetaByTab = new Map();

/* =================== Listener =================== */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  (async () => {
    try {
      function scoreMeta(m = {}) {
        let s = 0;
        if (m.title) s += 2;
        if (m.company) s += 2;
        if (m.location) s += 1;
        if (m.logoUrl || m.logo_url) s += 1;
        if (m.jobId) s += 1;
        return s;
      }
      function nonEmptyMerge(base, patch) {
        const out = { ...base };
        for (const [k, v] of Object.entries(patch || {})) {
          if (v !== undefined && v !== null && String(v).trim() !== '') out[k] = v;
        }
        return out;
      }
      function updateCtx(tabId, canonical, meta, confidence = 0.8) {
        const prev = jobCtxByTab.get(tabId);
        const canon = canonical || prev?.canonical || null;

        if (!prev || prev.canonical !== canon) {
          jobCtxByTab.set(tabId, {
            canonical: canon,
            first_canonical: prev?.first_canonical || canon || null, // preserve first seen
            meta: { ...meta },
            updated_at: Date.now(),
            confidence
          });
          return jobCtxByTab.get(tabId);
        }
        const oldScore = scoreMeta(prev.meta);
        const newScore = scoreMeta(meta);
        const mergedMeta = nonEmptyMerge(prev.meta, meta); // never overwrite with blanks

        jobCtxByTab.set(tabId, {
          canonical: canon,
          first_canonical: prev.first_canonical || canon || null,
          meta: (newScore >= oldScore) ? mergedMeta : prev.meta,
          updated_at: Date.now(),
          confidence: Math.max(confidence, prev.confidence || 0)
        });
        return jobCtxByTab.get(tabId);
      }

      // Helper 2B: prefer first_canonical for applied & lookups
      function preferCtxCanonical(sender, reqUrl) {
        try {
          const tabId = sender?.tab?.id;
          const ctx = (tabId && jobCtxByTab.get(tabId)) || null;
          const pick = ctx?.first_canonical || ctx?.canonical || reqUrl || sender?.url || '';
          return canonicalJobUrl(pick);
        } catch { return canonicalJobUrl(reqUrl || sender?.url || ''); }
      }

      if (request.action === 'canonicalizeUrl') {
        const canonical = canonicalJobUrl(request.url || sender?.url || '');
        sendResponse?.({ canonical });
        return;
      }

      // NEW: lock in first canonical seen when UI first appears
      if (request.action === 'noteFirstJobUrl') {
        const tabId = sender.tab?.id;
        const canon = canonicalJobUrl(request.url || sender?.url || '');
        if (tabId && canon) {
          const cur = jobCtxByTab.get(tabId) || { canonical: canon, first_canonical: canon, meta: {}, confidence: 0 };
          if (!cur.first_canonical) cur.first_canonical = canon;
          if (!cur.canonical) cur.canonical = canon;
          cur.updated_at = Date.now();
          jobCtxByTab.set(tabId, cur);
          sendResponse?.({ ok: true, first: cur.first_canonical });
        } else sendResponse?.({ ok: false });
        return;
      }

      if (request.action === 'updateJobContext') {
        const tabId = sender.tab?.id;
        if (!tabId) { sendResponse?.({ ok:false, error: 'no tab' }); return; }
        const canonical = canonicalJobUrl(request.canonical || sender.url || request.url || '');
        const meta = request.meta || {};
        const confidence = typeof request.confidence === 'number' ? request.confidence : 0.8;
        const ctx = updateCtx(tabId, canonical, meta, confidence);
        sendResponse?.({ ok: true, ctx });
        return;
      }

      if (request.action === 'getJobContext') {
        const deliver = (tid) => {
          const ctx = jobCtxByTab.get(tid) || null;
          sendResponse?.({ ok: true, ctx });
        };
        if (sender.tab?.id) deliver(sender.tab.id);
        else chrome.tabs.query({ active: true, lastFocusedWindow: true }, tabs => deliver(tabs?.[0]?.id));
        return true;
      }

      if (request.action === 'openPopup') {
        if (sender.tab?.id) {
          try {
            await new Promise((resolve) => chrome.tabs.sendMessage(sender.tab.id, { action: 'forceScanNow' }, () => resolve()));
            await new Promise(r => setTimeout(r, 150));
          } catch {}
        }
        chrome.action.openPopup();
        fetchDataFromBackend();
        sendResponse({ success: true, message: 'Popup opened.' });
        return;
      }

      if (request.action === 'liActiveJobCard') {
        if (sender.tab?.id) liActiveMetaByTab.set(sender.tab.id, request.meta || null);
        sendResponse?.({ ok: true });
        return;
      }

      if (request.action === 'getActiveJobMeta') {
        const deliver = (tid) => sendResponse?.(liActiveMetaByTab.get(tid) || null);
        if (sender.tab?.id) deliver(sender.tab.id);
        else chrome.tabs.query({ active: true, lastFocusedWindow: true }, tabs => deliver(tabs?.[0]?.id));
        return true;
      }

      if (request.action === 'classifyJobPageAdvanced') {
        const { sample = '' } = request || {};
        let mlBoost = 0;
        try {
          const zs = await timeout(getZeroShot(), 900);
          const out = await timeout(zs(sample, ['job_page','non_job_page'], { multi_label: false }), 1100);
          const score = Array.isArray(out?.scores) ? out.scores[0] || 0 : 0;
          mlBoost = Math.max(0, Math.min(0.8, score));
          noteZSSuccess();
        } catch { noteZSTimeout(); }
        sendResponse?.({ ok: true, mlBoost });
        return;
      }

      if (request.action === 'rankJDCandidates') {
        const items = Array.isArray(request.items) ? request.items.slice(0, 6) : [];
        let bestIndex = 0;
        if (items.length >= 2) {
          try {
            const zs = await timeout(getZeroShot(), 900);
            const promises = items.map(txt => timeout(zs(txt, ['job_description','not_job_description'], { multi_label:false }), 1100));
            const outs = await Promise.allSettled(promises);
            let bestScore = -1;
            outs.forEach((st, i) => {
              if (st.status === 'fulfilled') {
                const score = Array.isArray(st.value?.scores) ? st.value.scores[0] || 0 : 0;
                if (score > bestScore) { bestScore = score; bestIndex = i; }
              }
            });
            noteZSSuccess();
          } catch { noteZSTimeout(); }
        }
        sendResponse?.({ ok: true, bestIndex });
        return;
      }

      if (request.action === 'fetching cookie') {
        const response = await apiClient.post('/api/refresh', { withCredentials: true });
        sendResponse({ success: true, data: response.data });
        return;
      }
      if (request.action === 'fetchResume') {
        const file = await fetchResumeFile(request.fileUrl);
        if (file) {
          const reader = new FileReader();
          reader.onload = () => sendResponse({ success: true, fileData: reader.result, filename: file.name, type: file.type || "application/pdf" });
          reader.onerror = () => sendResponse({ success: false, error: 'Failed to read file' });
          reader.readAsDataURL(file);
        } else sendResponse({ success: false, error: 'Failed to fetch file' });
        return true;
      }

      if (request.action === 'jdText' && request.text) {
        const work = (async () => {
          const jdSkills = await extractSkillsHybrid(request.text);
          const userSkillSet = await getUserSkillsSet();
          const matchedWords = matchJDToUser(jdSkills, userSkillSet);
          const percentage = percent(matchedWords.length, jdSkills.length);
          if (sender.tab?.id) {
            chrome.tabs.sendMessage(sender.tab.id, { action:'displayPercentage', percentage, matchedWords, allSkills: jdSkills, jobKey: request.jobKey || null });
          }
          return true;
        })();
        try { await timeout(work, 2000); } catch {}
        sendResponse({ status: 'Job text processed.' });
        return;
      }

      // Apply & remember — ALWAYS key by first_canonical when available (2B)
      if (request.type === 'JOB_AID__APPLIED' || request.action === 'appliedJob' || request.action === 'markApplied') {
        const p = request.payload || request;

        const canonical = preferCtxCanonical(sender, p.canon || p.source_url || p.url);
        const applied_at = p.applied_at || new Date().toISOString();

        // Update instant cache immediately so UI can reflect applied state fast
        await rememberAppliedInstant(canonical, applied_at);

        const rawUrl = safeHttpUrl(p.source_url || p.url || sender?.url || '');

        // Grab sticky context for this tab (helps fill metadata)
        const tabId = sender.tab?.id;
        const ctx = tabId ? jobCtxByTab.get(tabId) : null;

        // sanitize misleading titles from confirmation pages
        const maybeTitle = sanitizeTitle(p.title);
        const merged = {
          title: maybeTitle || ctx?.meta?.title || 'Unknown',
          company: p.company || ctx?.meta?.company || '',
          location: p.location || ctx?.meta?.location || '',
          logo_url: p.logo_url || ctx?.meta?.logoUrl || null,
        };

        const body = {
          title: merged.title,
          company: merged.company,
          location: merged.location,
          url: canonical || rawUrl,                    // ALWAYS the canonical detail URL
          status: 'applied',
          source: p.ats_vendor || 'extension',
          company_logo_url: merged.logo_url,
          applied_at,
        };

        // Persist to backend, but even if it fails, instant cache is already set
        try {
          const res = await apiClient.post('/api/jobs', body, { withCredentials: true });
          if (sender.tab?.id) {
            chrome.tabs.sendMessage(sender.tab.id, { action: 'appliedJobSaved', ok: true, data: res.data, title: body.title, company: body.company });
          }
          sendResponse({ ok: true, data: res.data, applied_at, canonical });
          try {
            chrome.notifications?.create({ type: 'basic', iconUrl: 'images/icon.jpeg', title: 'Added into your applied job list', message: `${body.title} · ${body.company}` });
          } catch {}
        } catch (e) {
          const msg = e?.response?.data?.detail || e.message || 'save failed';
          if (sender.tab?.id) chrome.tabs.sendMessage(sender.tab.id, { action: 'appliedJobSaved', ok: false, error: msg });
          sendResponse({ ok: false, error: msg, applied_at, canonical });
        }
        return;
      }
      // Fast-path: remember applied instantly (used by ATS watchers toast path)
      if (request.action === 'rememberAppliedInstant') {
        try {
          // prefer the tab’s first_canonical if present
          const canonical = (typeof preferCtxCanonical === 'function')
            ? preferCtxCanonical(sender, request.url || '')
            : canonicalJobUrl(request.url || sender?.url || '');

          if (!canonical) { sendResponse?.({ ok: false, error: 'no canonical' }); return; }

          const applied_at = request.applied_at || new Date().toISOString();
          await rememberAppliedInstant(canonical, applied_at);
          sendResponse?.({ ok: true, canonical, applied_at });
        } catch (e) {
          sendResponse?.({ ok: false, error: String(e?.message || e) });
        }
        return;
      }

      // Lookup: instant cache FIRST, then API
      if (request.action === 'checkAppliedForUrl') {
        const reqCanon = preferCtxCanonical(sender, request.url || '');
        try {
          // 1) fast local check
          const instant = await getInstantApplied(reqCanon || request.url || '');
          if (instant) { sendResponse({ ok: true, applied_at: instant, canonical: reqCanon }); return; }

          // 2) backend fallback
          const { data } = await apiClient.get('/api/jobs', { withCredentials: true });
          const canon = (u) => { try { return canonicalJobUrl(u || '') || ''; } catch { return ''; } };
          const hit = (data || []).find(j => canon(j.url) === reqCanon);
          sendResponse({ ok: true, applied_at: hit?.applied_at || null, canonical: reqCanon });
        } catch (e) {
          sendResponse({ ok: false, error: e?.response?.data?.detail || e.message || 'lookup failed' });
        }
        return;
      }

      sendResponse({ ok: false, error: 'Unknown request type' });
    } catch (e) {
      console.error('Background listener error:', e);
      sendResponse({ ok: false, error: String(e?.message || e) });
    }
  })();
  return true;
});

/* =================== Backend & resume helpers =================== */
async function fetchDataFromBackend(){
  try{
    const response=await apiClient.get('api/candidate',{withCredentials:true});
    const data=response.data;
    data['residence_location']=`${data['residence_city']},${data['residence_state']}`;
    data['school_location']=`${data['school_city']},${data['school_state']}`;
    data['job_location']=`${data['job_city']},${data['job_state']}`;
    await chrome.storage.local.set({autofillData:data});
    return data;
  }catch(e){ console.error("Error fetching candidate data:",e); return null;}
}
async function fetchResumeFile(fileUrl){
  try{
    const res=await fetch(fileUrl); if(!res.ok) return null;
    const blob=await res.blob(); const filename=fileUrl.split('/').pop()||'autofilled_file';
    return new File([blob], filename, { type: blob.type });
  }catch(e){ console.error('Error fetching resume file:',e); return null;}
}

/* =================== Housekeeping =================== */
chrome.tabs.onRemoved.addListener((tabId) => { liActiveMetaByTab.delete(tabId); });
chrome.tabs.onUpdated.addListener((tabId, info) => { if (info.status === 'loading') liActiveMetaByTab.delete(tabId); });

setInterval(fetchDataFromBackend, 10 * 60 * 1000);
console.log('Background service worker initialized.');
