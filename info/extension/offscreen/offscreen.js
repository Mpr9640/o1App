// extension/offscreen/offscreen.js

let tfm = null;

async function getPipeline() {
  if (!tfm) {
    tfm = await import('@huggingface/transformers');
    const { env } = tfm;

    // 1) Point to local assets
    env.backends.onnx.wasm.wasmPaths = chrome.runtime.getURL('offscreen/vendor/onnx/');

    // 2) MV3-safe: no blob worker
    env.backends.onnx.wasm.proxy = false;

    // If you ship ALL variants (recommended), you may omit these two:
    // env.backends.onnx.wasm.simd = true;     // let ONNX pick SIMD when available
    // env.backends.onnx.wasm.numThreads = 2;  // or higher if you want
    //
    // If you want minimal files (plain only), force these:
    // env.backends.onnx.wasm.simd = false;
    // env.backends.onnx.wasm.numThreads = 1;

    env.useBrowserCache = true;
    env.allowLocalModels = false;
  }
  return tfm.pipeline;
}


// --- the rest of your file stays the same ---
let zsPromise = null;
let nerPromise = null;
let embedPromise = null;

const EMBED_MODEL = 'Xenova/bge-small-en-v1.5';

async function getZeroShot() {
  if (!zsPromise) {
    const pipeline = await getPipeline();
    zsPromise = pipeline('zero-shot-classification', 'Xenova/mobilebert-uncased-mnli', {
      quantized: true, use_cache: true, dtype: 'q8',
    });
  }
  return zsPromise;
}
async function getNER() {
  if (!nerPromise) {
    const pipeline = await getPipeline();
    nerPromise = pipeline('token-classification', 'chrisdepallan/ner-skills-distilbert', {
      quantized: true, use_cache: true, dtype: 'q8',
    });
  }
  return nerPromise;
}
async function getEmbedder() {
  if (!embedPromise) {
    const pipeline = await getPipeline();
    embedPromise = pipeline('feature-extraction', EMBED_MODEL, {
      quantized: true, use_cache: true, dtype: 'q8',
    });
  }
  return embedPromise;
}

const timeout = (p, ms) => new Promise((res, rej) => {
  let done = false;
  const t = setTimeout(() => { if (!done) { done = true; rej(new Error('timeout')); } }, ms);
  p.then(v => { if (done) return; clearTimeout(t); done = true; res(v); })
   .catch(e => { if (done) return; clearTimeout(t); done = true; rej(e); });
});

const makeLRU = (cap=64) => {
  const m = new Map();
  return {
    get(k){ if (!m.has(k)) return null; const v = m.get(k); m.delete(k); m.set(k, v); return v; },
    set(k,v){ if (m.has(k)) m.delete(k); m.set(k,v); if (m.size>cap) m.delete(m.keys().next().value); }
  };
};
const zsCache   = makeLRU(64);
const nerCache  = makeLRU(64);
const bestCache = makeLRU(64);

function dot(a, b) { let s = 0; const n = Math.min(a.length, b.length); for (let i=0;i<n;i++) s += a[i]*b[i]; return s; }
function cosine(a, b) { return dot(a, b); } // embeddings are normalized

const norm = (s) => String(s || "")
  .replace(/[_\-]+/g, " ")
  .replace(/([a-z])([A-Z])/g, "$1 $2")
  .toLowerCase()
  .trim();

export async function handleZeroShot({ text, labels, multi=false }) {
  const key = JSON.stringify({ text: text?.slice(0,1600), labels, multi });
  const cached = zsCache.get(key); if (cached) return { ok: true, data: cached };

  const pipe = await getZeroShot();
  const out = await timeout(pipe(text, labels, { multi_label: !!multi }), 2500);
  zsCache.set(key, out);
  return { ok: true, data: out };
}

export async function handleNER({ text }) {
  const key = text?.slice(0,4000) || '';
  const cached = nerCache.get(key); if (cached) return { ok: true, data: cached };

  const pipe = await getNER();
  const out = await timeout(pipe(key, { aggregation_strategy: 'simple' }), 3000);
  nerCache.set(key, out);
  return { ok: true, data: out };
}
// Replace your handleBestMatch with this version:

export async function handleBestMatch({ labels = [], answer = '', method = 'auto' }) {
  const q = JSON.stringify({ labels, answer, method });
  const cached = bestCache.get(q); if (cached) return cached;

  // Guard
  if (!labels.length || !answer) {
    const res = { ok: true, labelIndex: -1, score: 0, method: 'none' };
    bestCache.set(q, res);
    return res;
  }

  const normLabels = labels.map(norm);
  const normAnswer = norm(answer);

  // Helper: convert whatever transformers returns into a flat Float32Array
  function toVec(x) {
    try {
      if (!x) return null;
      if (x instanceof Float32Array) return x;
      if (Array.isArray(x)) return new Float32Array(x.flat(Infinity));
      if (x.data instanceof Float32Array) return x.data;
      if (Array.isArray(x.data)) return new Float32Array(x.data.flat?.(Infinity) ?? x.data);
      if (x.tensor?.data instanceof Float32Array) return x.tensor.data;
      if (Array.isArray(x.tensor?.data)) return new Float32Array(x.tensor.data.flat?.(Infinity) ?? x.tensor.data);
    } catch {}
    return null;
  }

  // Try embedding route (unless forced 'zs')
  if (method !== 'zs') {
    try {
      const embed = await getEmbedder();
      const out = await timeout(
        embed([normAnswer, ...normLabels], { pooling: 'mean', normalize: true }),
        3000
      );

      // transformers.js sometimes returns a single tensor, sometimes an array
      const arr = Array.isArray(out) ? out : [out];
      const ansVec = toVec(arr[0]);
      const labelVecs = arr.slice(1).map(toVec).filter(Boolean);

      // Basic sanity
      if (!ansVec || !labelVecs.length || !labelVecs[0]) {
        // fall through to zero-shot
      } else {
        // Compute cosine
        let bestIdx = -1, bestScore = -Infinity;
        for (let i = 0; i < labelVecs.length; i++) {
          const lv = labelVecs[i];
          const n = Math.min(ansVec.length, lv.length);
          let s = 0;
          for (let j = 0; j < n; j++) s += ansVec[j] * lv[j];
          if (s > bestScore) { bestScore = s; bestIdx = i; }
        }

        // If score looks valid and decent, return it
        if (Number.isFinite(bestScore)) {
          const res = {
            ok: true,
            labelIndex: bestScore >= 0.35 ? bestIdx : -1,
            score: Number(bestScore),
            method: 'embed'
          };
          // If below threshold, try zero-shot instead of giving up
          if (res.labelIndex >= 0) { bestCache.set(q, res); return res; }
          // else fall through to zero-shot
        }
      }
    } catch (e) {
      // ignore; we’ll try zero-shot
    }
  }
  // Fallback / forced zero-shot route (slower, but robust)
  try {
    const pipe = await getZeroShot();
    const out = await timeout(pipe(normAnswer, normLabels, { multi_label: false }), 3000);

    // transformers.js returns labels & scores sorted desc by score
    const bestLabel  = Array.isArray(out?.labels)  ? out.labels[0]  : null;
    const bestScore  = Array.isArray(out?.scores)  ? out.scores[0]  : 0;
    const bestIdxOri = bestLabel ? normLabels.indexOf(bestLabel) : -1;

    const res = { ok: true,
      labelIndex: (bestIdxOri >= 0 && bestScore >= 0.40) ? bestIdxOri : -1,
      score: Number(bestScore || 0),
      method: 'zs'
    };
    bestCache.set(q, res);
    return res;
  } catch (e) {
    const res = { ok:false, error:`zs_failed: ${String(e?.message || e)}` };
    bestCache.set(q, res);
    return res;
  }

}


/*export async function handleBestMatch({ labels = [], answer = '', method = 'auto' }) {
  const q = JSON.stringify({ labels, answer, method });
  const cached = bestCache.get(q); if (cached) return cached;

  if (!labels.length || !answer) {
    const res = { ok: true, labelIndex: -1, score: 0, method: 'none' };
    bestCache.set(q, res);
    return res;
  }

  const normLabels = labels.map(norm);
  const normAnswer = norm(answer);

  if (method !== 'zs') {
    try {
      const embed = await getEmbedder();
      const data = await timeout(
        embed([normAnswer, ...normLabels], { pooling: 'mean', normalize: true }),
        2500
      );
      const vecs = Array.isArray(data) ? data : [data];
      const ansVec = vecs[0];
      const labelVecs = vecs.slice(1);

      let bestIdx = -1, bestScore = -Infinity;
      for (let i = 0; i < labelVecs.length; i++) {
        const score = cosine(ansVec, labelVecs[i]);
        if (score > bestScore) { bestScore = score; bestIdx = i; }
      }
      const res = { ok: true, labelIndex: bestScore >= 0.40 ? bestIdx : -1, score: Number(bestScore || 0), method: 'embed' };
      bestCache.set(q, res);
      return res;
    } catch (e) {
      if (method === 'embed') {
        const res = { ok:false, error:`embed_failed: ${String(e?.message || e)}` };
        bestCache.set(q, res);
        return res;
      }
    }
  }

  try {
    const pipe = await getZeroShot();
    const out = await timeout(pipe(normAnswer, normLabels, { multi_label: false }), 3000);
    let bestIdx = -1, bestScore = 0;
    if (out && Array.isArray(out.scores)) {
      out.scores.forEach((s, i) => { if (s > bestScore) { bestScore = s; bestIdx = i; }});
    }
    const res = { ok: true, labelIndex: bestScore >= 0.40 ? bestIdx : -1, score: bestScore, method: 'zs' };
    bestCache.set(q, res);
    return res;
  } catch (e) {
    const res = { ok:false, error:`zs_failed: ${String(e?.message || e)}` };
    bestCache.set(q, res);
    return res;
  }
} */
