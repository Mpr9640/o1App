// extension/scripts/page_probe.js  (runs in the page's MAIN world)
(() => {
  if (window.__ResumeNetProbe) return;

  const BUS_FLAG = '__resume_net_probe__';
  const CTL_FLAG = '__resume_net_probe_ctl__';

  const probe = { active: false, filters: null, seen: 0 };

  function post(type, detail) {
    try { window.postMessage({ [BUS_FLAG]: true, type, detail }, '*'); } catch {}
  }

  function shouldLog(url, method) {
    if (!probe.active || !url) return false;
    const f = probe.filters;
    if (!f) return true;
    if (f.methods?.length && !f.methods.includes(method)) return false;
    if (f.startsWith?.length && !f.startsWith.some(p => url.startsWith(p))) return false;
    if (f.includes?.length && !f.includes.some(p => url.includes(p))) return false;
    if (typeof f.maxEvents === 'number' && probe.seen >= f.maxEvents) return false;
    probe.seen++;
    return true;
  }

  const _fetch = window.fetch;
  window.fetch = async function(input, init) {
    if (!probe.active) return _fetch(input, init);
    const url = (typeof input === 'string') ? input : (input?.url ?? '');
    const method = (init?.method || 'GET').toUpperCase();
    if (shouldLog(url, method)) post('req', { api:'fetch', url, method });
    try {
      const res = await _fetch(input, init);
      if (shouldLog(url, method)) {
        const clone = res.clone();
        let body = '';
        try { body = (await clone.text()).slice(0, 4096); } catch {}
        post('res', { api:'fetch', url, method, status: res.status, body });
      }
      return res;
    } catch (err) {
      if (shouldLog(url, method)) post('res', { api:'fetch', url, method, error: String(err) });
      throw err;
    }
  };

  const _open = XMLHttpRequest.prototype.open;
  const _send = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function(method, url) {
    this.__probe = { method: (method || 'GET').toUpperCase(), url: String(url || '') };
    return _open.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send = function(body) {
    if (probe.active && this.__probe) {
      const { method, url } = this.__probe;
      if (shouldLog(url, method)) post('req', { api:'xhr', url, method });
      this.addEventListener('loadend', function() {
        if (!probe.active) return;
        try {
          const status = this.status;
          let body = '';
          try { body = String(this.responseText || '').slice(0, 4096); } catch {}
          if (shouldLog(url, method)) post('res', { api:'xhr', url, method, status, body });
        } catch {}
      });
    }
    return _send.apply(this, arguments);
  };

  window.__ResumeNetProbe = {
    enable(filters) { probe.active = true; probe.filters = filters || null; probe.seen = 0; },
    disable() { probe.active = false; probe.filters = null; },
    isActive() { return !!probe.active; }
  };

  window.addEventListener('message', (ev) => {
    const d = ev.data;
    if (!d || d[CTL_FLAG] !== true) return;
    const { cmd, args } = d;
    if (cmd === 'enable') window.__ResumeNetProbe.enable(args?.filters);
    if (cmd === 'disable') window.__ResumeNetProbe.disable();
    if (cmd === 'ping') post('pong', { active: window.__ResumeNetProbe.isActive() });
  });

  post('ready', {});
})();
