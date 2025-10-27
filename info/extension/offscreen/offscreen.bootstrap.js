// offscreen.bootstrap.js
// Tiny dispatcher: replies to PING immediately, then lazy-imports the heavy bundle once.

let ready = false;
let mod = null;       // ESM module namespace from offscreen.bundle.js
const queue = [];     // messages that arrive before the bundle is ready

chrome.runtime.onMessage.addListener((req, _s, sendResponse) => {
  // Always answer readiness pings immediately
  if (req?.type === 'OFFSCREEN_PING') {
    sendResponse({ ok: true });
    return;
  }
  // Ignore everything that isn't explicitly for the offscreen module
  if (!req || typeof req.action !== 'string' || !req.action.startsWith('offscreen.')) {
    // DO NOT send any response here — let background handle it
    return; // returning undefined means "no async work; not handling"
  }

  // If not ready yet, queue and start loading bundle
  if (!ready) {
    queue.push({ req, sendResponse });
    (async () => {
      if (!mod) {
        // BUNDLE IS AT DIST ROOT (per your build): offscreen.bundle.js
        const url = chrome.runtime.getURL('offscreen.bundle.js');
        mod = await import(url); // ESM bundle generated from offscreen.js
      }
      ready = true;
      // Drain queued messages
      for (const item of queue.splice(0)) {
        dispatch(item.req, item.sendResponse);
      }
    })();
    return true; // keep the channel open for queued response
  }

  // Ready: route immediately
  return dispatch(req, sendResponse);
});

function dispatch(req, sendResponse) {
  try {
    if (req.action === 'offscreen.bestMatch') {
      mod.handleBestMatch(req.payload || {}).then(sendResponse);
      return true;
    }
    if (req.action === 'offscreen.zs') {
      mod.handleZeroShot(req.payload || {}).then(sendResponse);
      return true;
    }
    if (req.action === 'offscreen.ner') {
      mod.handleNER(req.payload || {}).then(sendResponse);
      return true;
    }
    sendResponse({ ok: false, error: 'Unknown offscreen action' });
  } catch (e) {
    sendResponse({ ok: false, error: String(e?.message || e) });
  }
  return false;
}
