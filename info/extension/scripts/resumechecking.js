// ==== resumechecking.js (isolated world) ====

/** Listen to probe events coming from page world */
const noUploadCutoffMs = 4000;
const firstEnableAt = performance.now();
function onProbeEvent(handler) {
  window.addEventListener('message', (ev) => {
    const d = ev.data;
    if (!d) return;
    // Accept both snake and old camel in case of drift
    const isProbeEvent = d.__resume_net_probe__ === true || d.__resumeNetProbe === true;
    if (!isProbeEvent) return;
    handler(d.type, d.detail);
  });
}
/** Send control commands TO the page probe */
function controlProbe(cmd, args) {
  // Use the snake_case key the page probe expects
  window.postMessage({ __resume_net_probe_ctl__: true, cmd, args }, '*');
}

/** Wait until the page probe is ready (ready/pong), with timeout */
async function ensureProbeReady(timeoutMs = 1500) {
  return new Promise((resolve) => {
    let ready = false;
    const t = setTimeout(() => resolve(false), timeoutMs);

    const handler = (type) => {
      if (type === 'ready' || type === 'pong') {
        if (!ready) {
          ready = true;
          clearTimeout(t);
          window.removeEventListener('message', listener);
          resolve(true);
        }
      }
    };

    const listener = (ev) => {
      const d = ev.data;
      if (!d) return;
      const isProbeEvent = d.__resume_net_probe__ === true || d.__resumeNetProbe === true;
      if (!isProbeEvent) return;
      handler(d.type, d.detail);
    };

    window.addEventListener('message', listener);
    // Ask the probe to respond if it exists
    try { controlProbe('ping'); } catch {}
  });
}
export async function waitForResumeParseNetworkFirst(fileInput, options = {}) {
  // 1) Make sure the page probe is present in THIS frame (icims often uses iframes)
  const ok = await ensureProbeReady(2500);
  if (!ok) {
    console.warn('[resumecheck] probe not detected in this frame; continuing with timeout guard');
  }

  const t0 = performance.now();
  const idleMs    = options.idleMs ?? 1200;
  const timeoutMs = options.timeoutMs ?? 30000;
  const maxEvents = options.maxEvents ?? 120;

  const KW = {
    uploadUrl: /(upload|attachment|file|resume|cv)/i,
    parseUrl: /(parse|analy[sz]e|extract|prefill|pre-fill|enrich)/i,
    okBody: /(parsed|attached|uploaded|complete|extracted|prefilled|success|attachmentId)/i,
    errBody: /(fail|error|invalid|unsupported|couldn'?t|timeout|too large)/i
  };

  let lastNetEvent = performance.now();
  let sawUpload = false, sawParse = false, sawError = false;
  const evidence = { requests: [], responses: [], notes: [] };

  const netListener = (type, detail) => {
    if (type === 'ready' || type === 'pong') return;
    lastNetEvent = performance.now();

    if (type === 'req') {
      const { url = '', method = '' } = detail || {};
      const u = String(url);
      evidence.requests.push({ t: Date.now(), method, url: u });
      if (method === 'POST' && KW.uploadUrl.test(u)) sawUpload = true;
      if (KW.parseUrl.test(u)) sawParse = true;
    }
    if (type === 'res') {
      const { url = '', method = '', status, body = '', error } = detail || {};
      const u = String(url);
      evidence.responses.push({ t: Date.now(), method, url: u, status, body: String(body || '').slice(0, 256), error });

      if (typeof status === 'number' && status >= 400) sawError = true;
      if (error && /network|abort|fail/i.test(String(error))) sawError = true;
      if (body) {
        if (KW.errBody.test(body)) sawError = true;
        if (KW.okBody.test(body))  sawParse = true;
      }
      if (KW.parseUrl.test(u) && status >= 200 && status < 300) sawParse = true;
    }
  };

  //onProbeEvent(netListener);
  const listener = (ev) => {
    const d = ev.data;
    if (!d) return;
    const isProbeEvent = d.__resume_net_probe__ === true || d.__resumeNetProbe === true;
    if (!isProbeEvent) return;
    netListener(d.type, d.detail);
  };
  window.addEventListener('message', listener);

  // 2) Turn the probe on in THIS frame
  controlProbe('enable', {
    filters: {
      methods: ['POST','PUT','PATCH','GET'],
      includes: ['upload','attachment','file','resume','cv','parse','extract','prefill','apply','candidate'],
      maxEvents
    }
  });

  let idleCheck = null, timeoutId = null;

  const stop = () => {
    try { controlProbe('disable'); } catch {}
    if (idleCheck) clearInterval(idleCheck);
    if (timeoutId) clearTimeout(timeoutId);
    try { window.removeEventListener('message', listener); } catch {};
  };

  const fileChosen = !!(fileInput?.files && fileInput.files.length > 0);
  if (!fileChosen) evidence.notes.push('No file present on input at watch start.');

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
      if (!sawUpload && now - firstEnableAt > noUploadCutoffMs) {
        stop();
        return resolve({ status: 'attach-failed', elapsedMs: Math.round(performance.now() - t0), evidence });
      }
      if (sawError && idleEnough) {
        stop();
        return resolve({ status: 'failed', elapsedMs: Math.round(performance.now() - t0), evidence });
      }
      if (sawUpload && sawParse && idleEnough) {
        stop();
        return resolve({ status: 'parsed', elapsedMs: Math.round(performance.now() - t0), evidence });
      }
      if (sawUpload && !sawError && idleEnough) {
        stop();
        return resolve({ status: 'parsed', elapsedMs: Math.round(performance.now() - t0), evidence });
      }
    }, 120);
  });
}
