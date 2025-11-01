// ==== resumechecking.js (isolated world) ====

// Send control commands TO the page probe
function controlProbe(cmd, args) {
  try { window.postMessage({ __resume_net_probe_ctl__: true, cmd, args }, '*'); } catch {}
}

// Wait until the page probe is ready (ready/pong), with timeout
async function ensureProbeReady(timeoutMs = 1500) {
  return new Promise((resolve) => {
    let done = false;
    const t = setTimeout(() => {
      if (!done) { done = true; window.removeEventListener('message', onMsg); resolve(false); }
    }, timeoutMs);

    function onMsg(ev) {
      const d = ev.data;
      if (!d) return;
      const isProbeEvent = d.__resume_net_probe__ === true || d.__resumeNetProbe === true;
      if (!isProbeEvent) return;
      if (d.type === 'ready' || d.type === 'pong') {
        if (!done) { done = true; clearTimeout(t); window.removeEventListener('message', onMsg); resolve(true); }
      }
    }

    window.addEventListener('message', onMsg);
    controlProbe('ping');
  });
}

export async function waitForResumeParseNetworkFirst(fileInput, options = {}) {
  // Make sure the page probe is present in THIS frame (icims often uses iframes)
  const ok = await ensureProbeReady(2500);
  if (!ok) console.warn('[resumecheck] probe not detected in this frame; continuing with timeout guard');

  const t0 = performance.now();
  const idleMs    = options.idleMs ?? 1200;
  const timeoutMs = options.timeoutMs ?? 20000;
  const maxEvents = options.maxEvents ?? 180;

  // Local enable time to guard "no upload" cutoff
  const enableAt = performance.now();
  const noUploadCutoffMs = 4000;

  // Common ATS patterns
  const KW = {
    uploadUrl: /(upload|attach|attachment|file|resume|cv)\b/i,
    parseUrl:  /(parse|analy[sz]e|extract|prefill|pre-fill|enrich)\b/i,
    okBody:    /\b(parsed|attached|uploaded|complete|extracted|prefilled|success|attachmentId|resumeId)\b/i,
    errBody:   /\b(fail|error|invalid|unsupported|timeout|too large|virus)\b/i,

    // Vendor hints (loose)
    vendorUrl: /(icims|greenhouse|lever|workday|ashby|smartrecruiters|workable|oraclecloud|myworkdayjobs)/i
  };

  let lastNetEvent = performance.now();
  let sawUpload = false, sawParse = false, sawError = false;
  const evidence = { requests: [], responses: [], notes: [] };

  function recordReq(detail = {}) {
    const { url = '', method = '' } = detail;
    const u = String(url);
    evidence.requests.push({ t: Date.now(), method, url: u });
    if (/POST|PUT|PATCH/i.test(method) && (KW.uploadUrl.test(u) || KW.vendorUrl.test(u))) sawUpload = true;
    if (KW.parseUrl.test(u)) sawParse = true;
  }
  function recordRes(detail = {}) {
    const { url = '', method = '', status, body = '', error } = detail;
    const u = String(url);
    const b = String(body || '');
    evidence.responses.push({ t: Date.now(), method, url: u, status, body: b.slice(0, 256), error });

    if (typeof status === 'number' && status >= 400) sawError = true;
    if (error && /network|abort|fail/i.test(String(error))) sawError = true;
    if (b) {
      if (KW.errBody.test(b)) sawError = true;
      if (KW.okBody.test(b))  sawParse = true;
    }
    if (KW.parseUrl.test(u) && status >= 200 && status < 300) sawParse = true;
  }

  function onMsg(ev) {
    const d = ev.data;
    if (!d) return;
    const isProbeEvent = d.__resume_net_probe__ === true || d.__resumeNetProbe === true;
    if (!isProbeEvent) return;

    if (d.type === 'req') { lastNetEvent = performance.now(); recordReq(d.detail || {}); }
    if (d.type === 'res') { lastNetEvent = performance.now(); recordRes(d.detail || {}); }
  }

  window.addEventListener('message', onMsg);

  // Turn the probe on in THIS frame
  controlProbe('enable', {
    filters: {
      methods: ['POST','PUT','PATCH','GET'],
      includes: [
        'upload','attachment','file','resume','cv','parse','extract','prefill','apply','candidate',
        'icims','greenhouse','lever','workday','oraclecloud','ashby'
      ],
      maxEvents
    }
  });

  const stop = () => {
    try { controlProbe('disable'); } catch {}
    try { window.removeEventListener('message', onMsg); } catch {}
    if (idleCheck) clearInterval(idleCheck);
    if (timeoutId) clearTimeout(timeoutId);
  };

  const fileChosen = !!(fileInput?.files && fileInput.files.length > 0);
  if (!fileChosen) evidence.notes.push('No file present on input at watch start.');

  let idleCheck = null, timeoutId = null;

  return new Promise((resolve) => {
    timeoutId = setTimeout(() => {
      stop();
      resolve({
        status: sawParse ? 'parsed' : (sawError ? 'failed' : 'timeout'),
        elapsedMs: Math.round(performance.now() - t0),
        evidence
      });
    }, timeoutMs);

    idleCheck = setInterval(() => {
      const now = performance.now();
      const idleFor = now - lastNetEvent;
      const idleEnough = idleFor >= idleMs;

      // If we never even saw an upload-ish request not long after enabling, call it attach-failed
      if (!sawUpload && (now - enableAt) > noUploadCutoffMs) {
        stop();
        return resolve({ status: 'attach-failed', elapsedMs: Math.round(performance.now() - t0), evidence });
      }

      // Hard errors → failed (once network has gone quiet briefly)
      if (sawError && idleEnough) {
        stop();
        return resolve({ status: 'failed', elapsedMs: Math.round(performance.now() - t0), evidence });
      }

      // Success signals: either explicit parse signals, or upload+2xx parse endpoints, after idle
      if (sawParse && idleEnough) {
        stop();
        return resolve({ status: 'parsed', elapsedMs: Math.round(performance.now() - t0), evidence });
      }
    }, 120);
  });
}
