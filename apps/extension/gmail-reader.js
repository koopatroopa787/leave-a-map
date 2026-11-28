// apps/extension/gmail-reader.js: injected into the Gmail tab the person has open, only when they
// press "Read from Gmail". It searches their own mailbox for account mail, opens each message's
// "Show original" (the raw email, headers included) and hands the text to the extension page over a
// local port. It talks to nothing but mail.google.com, the site it runs on, with the person's own
// session. Nothing is changed in the mailbox.
(() => {
  if (window.__leaveAMapReader) return;
  window.__leaveAMapReader = true;

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const base = (location.pathname.match(/^\/mail\/u\/\d+\//) || ['/mail/u/0/'])[0];
  const visible = (el) => !!el && el.offsetParent !== null;
  const EMAIL = /[\w.+'-]+@[\w-]+(?:\.[\w-]+)+/;

  // Words that service mail uses: sign-ups, codes, receipts, bills, security alerts, shares.
  // Mail from people mostly has none of them, and the scan skips it anyway.
  const QUERY = '{welcome verify confirm activate receipt order invoice statement password "sign in" "sign-in" "signed in" ' +
    '"security alert" "new device" renew renewed renewal subscription "your account" "your plan" billing payment trial ' +
    '"shared with you" invited commented mentioned "pull request" recovery "student" appointment policy}';
  const PER_SENDER = 6; // oldest 3 and newest 3 from each company: enough to show what the account is
  const MAX_RAW = 200_000; // the scan keeps the headers and the first 96 KB of a body anyway

  const address = () => ((document.title.match(EMAIL) || [])[0] || '').toLowerCase();

  // Gmail's page key ("ik"), which its own "Show original" links carry.
  function findKey(text) {
    const m = text.match(/GM_ID_KEY\s*=\s*['"]([0-9a-f]+)['"]/) || text.match(/"ik"\s*:\s*"([0-9a-f]+)"/)
      || text.match(/GLOBALS\s*=\s*\[[^\]]*?"([0-9a-f]{10})"/);
    return m ? m[1] : null;
  }
  async function pageKey() {
    for (const s of document.scripts) { const k = findKey(s.textContent || ''); if (k) return k; }
    const res = await fetch(base, { credentials: 'include' });
    return findKey(await res.text());
  }

  // The conversations Gmail lists on the page now: id (hex) and the sender's address.
  function rowsOnPage() {
    const main = document.querySelector('div[role="main"]') || document.body;
    const out = new Map();
    for (const s of main.querySelectorAll('[email]')) {
      if (!visible(s)) continue;
      const row = s.closest('tr') || s.closest('[role="row"]');
      const idEl = row && row.querySelector('[data-legacy-thread-id]');
      const id = idEl && idEl.getAttribute('data-legacy-thread-id');
      if (id && /^[0-9a-f]{12,20}$/i.test(id) && !out.has(id)) out.set(id, (s.getAttribute('email') || '').toLowerCase());
    }
    return [...out].map(([id, from]) => ({ id, from }));
  }
  const olderButton = () => [...document.querySelectorAll('[aria-label="Older"],[data-tooltip="Older"],[aria-label="Next results"],[data-tooltip="Next results"],[aria-label="Older messages"]')].find(visible);
  const firstIds = () => rowsOnPage().slice(0, 3).map((r) => r.id).join();

  async function listAll(query, maxThreads, say) {
    location.hash = '#search/' + encodeURIComponent(query);
    for (let i = 0; i < 40 && rowsOnPage().length === 0; i++) await sleep(500);
    await sleep(1000);
    const seen = new Map();
    for (let page = 1; page <= 200 && seen.size < maxThreads; page++) {
      for (const r of rowsOnPage()) if (!seen.has(r.id)) seen.set(r.id, r.from);
      say({ stage: 'list', found: seen.size });
      const btn = olderButton();
      if (!btn || btn.getAttribute('aria-disabled') === 'true') break;
      const before = firstIds();
      btn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      btn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      btn.click();
      let moved = false;
      for (let i = 0; i < 30 && !moved; i++) { await sleep(300); moved = firstIds() !== before && rowsOnPage().length > 0; }
      if (!moved) break;
    }
    return [...seen].map(([id, from]) => ({ id, from }));
  }

  // Up to PER_SENDER conversations per company (by the last two parts of the sender's domain),
  // the oldest and the newest: the welcome email and the latest bill matter most.
  function pick(rows) {
    const by = new Map();
    for (const r of rows) {
      const d = (r.from.split('@')[1] || '').split('.').slice(-2).join('.') || r.from;
      if (!by.has(d)) by.set(d, []);
      by.get(d).push(r);
    }
    const out = [];
    for (const list of by.values()) {
      if (list.length <= PER_SENDER) out.push(...list);
      else out.push(...list.slice(0, PER_SENDER / 2), ...list.slice(-PER_SENDER / 2));
    }
    return { rows: out, senders: by.size };
  }

  const ENTITY = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'", nbsp: ' ' };
  const decode = (s) => s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) =>
    e[0] === '#' ? String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : (ENTITY[e.toLowerCase()] ?? m));

  async function original(key, hex) {
    const id = BigInt('0x' + hex).toString();
    const res = await fetch(`${base}?ik=${key}&view=om&permmsgid=msg-f:${id}`, { credentials: 'include' });
    if (!res.ok) return null;
    const html = await res.text();
    const m = html.match(/<pre[^>]*id="raw_message_text"[^>]*>([\s\S]*?)<\/pre>/i);
    return m ? decode(m[1]).slice(0, MAX_RAW) : null;
  }

  chrome.runtime.onConnect.addListener((port) => {
    if (port.name !== 'leave-a-map-gmail') return;
    let stopped = false;
    port.onDisconnect.addListener(() => { stopped = true; });
    port.onMessage.addListener(async (msg) => {
      if (msg.type !== 'read') return;
      const say = (m) => { if (!stopped) port.postMessage({ type: 'progress', ...m }); };
      const back = location.hash;
      try {
        const key = await pageKey();
        if (!key) { port.postMessage({ type: 'error', message: 'no-key' }); return; }
        const all = await listAll(QUERY, msg.maxThreads || 3000, say);
        const { rows, senders } = pick(all);
        say({ stage: 'fetch', done: 0, of: rows.length, senders, listed: all.length });
        let next = 0, done = 0, failed = 0;
        const worker = async () => {
          while (!stopped && next < rows.length) {
            const r = rows[next++];
            let raw = null;
            try { raw = await original(key, r.id); } catch { /* counted below */ }
            if (raw) port.postMessage({ type: 'message', raw }); else failed++;
            done++;
            if (done % 10 === 0 || done === rows.length) say({ stage: 'fetch', done, of: rows.length, senders, listed: all.length });
            await sleep(80);
          }
        };
        await Promise.all([worker(), worker(), worker()]);
        if (!stopped) port.postMessage({ type: 'done', address: address(), listed: all.length, fetched: done - failed, failed, senders });
      } catch (e) {
        if (!stopped) port.postMessage({ type: 'error', message: String(e && e.message || e) });
      } finally {
        location.hash = back;
      }
    });
  });
})();
