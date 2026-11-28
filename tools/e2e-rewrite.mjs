// tools/e2e-rewrite.mjs: end to end on Nano, over the Chrome DevTools port (9334) of a Chrome with Gemini Nano: the built site, a real button click per style, both sample letters, N runs each.
// Usage: start that Chrome with --remote-debugging-port=9334, serve dist/scan, then node tools/e2e-rewrite.mjs <site url> [runs]
const PORT = 9334, SITE = process.argv[2] || 'http://127.0.0.1:4181/', N = Number(process.argv[3] || 3);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const target = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json();
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r));
let id = 0; const pending = new Map(); const outside = new Set(); const errors = [];
ws.addEventListener('message', (m) => {
  const d = JSON.parse(m.data);
  if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); }
  else if (d.method === 'Network.requestWillBeSent') { const u = d.params.request.url; if (!u.startsWith(SITE) && !u.startsWith('data:')) outside.add(u.slice(0, 100)); }
  else if (d.method === 'Runtime.exceptionThrown') errors.push(d.params.exceptionDetails.exception?.description?.slice(0, 160));
});
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expression) => (await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture: true })).result?.result?.value;
await send('Network.enable'); await send('Runtime.enable');
const blanksOf = (s) => [...new Set(s.match(/\[[^\]\n]{1,80}\]/g) ?? [])];
const GENDER = /\b(he|she|him|his|her|hers)\b/gi;
const rows = [];
for (const [mode, radio, summary] of [['loss', '/loss/i', '/Write to Harbourline/i'], ['school', '/closing/i', '/Ask .* to change the email/i']]) {
  for (const [style, label] of [['shorter', 'Shorter'], ['formal', 'More formal'], ['simple', 'Simpler words']]) {
    for (let i = 0; i < N; i++) {
      await send('Page.navigate', { url: SITE }); await sleep(3000);
      const r = await ev(`(async () => {
        [...document.querySelectorAll('input[type=radio]')].find(r => ${radio}.test(r.closest('label')?.textContent || ''))?.click();
        await new Promise(r => setTimeout(r, 300));
        [...document.querySelectorAll('button')].find(b => /made-up sample|try the sample/i.test(b.textContent))?.click();
        await new Promise(r => setTimeout(r, 6000));
        const s = [...document.querySelectorAll('summary')].find(e => ${summary}.test(e.textContent)); s.click();
        await new Promise(r => setTimeout(r, 300));
        const d = s.closest('details'), before = d.querySelector('textarea').value;
        const t0 = Date.now();
        [...d.querySelectorAll('button')].find(b => b.textContent.trim() === ${JSON.stringify(label)}).click();
        let st = '';
        for (let k = 0; k < 90; k++) { await new Promise(r => setTimeout(r, 1000)); st = [...d.querySelectorAll('p')].map(p => p.textContent.trim()).filter(t => /rewrit|kept|unchanged|couldn/i.test(t)).join(' | '); if (st && !/Rewriting on this device/i.test(st)) break; }
        return { before, after: d.querySelector('textarea').value, status: st, ms: Date.now() - t0 };
      })()`);
      const ok = /Rewritten on this device by Gemini Nano/.test(r.status);
      const added = blanksOf(r.after).filter((b) => !blanksOf(r.before).includes(b));
      const lost = blanksOf(r.before).filter((b) => !r.after.includes(b));
      const g = (r.after.match(GENDER) || []).filter((w) => !new RegExp(`\\b${w}\\b`, 'i').test(r.before));
      rows.push({ mode, style, ok, ms: r.ms, status: r.status.slice(0, 90), lost, added, g, after: r.after });
      console.log(`${mode}/${style}#${i + 1}: ${ok ? 'REWRITTEN' : 'KEPT'} ${r.ms} ms | ${r.status.slice(0, 90)}${lost.length || added.length || g.length ? ` | !! lost ${lost} added ${added} gender ${g}` : ''}`);
    }
  }
}
const rewritten = rows.filter((r) => r.ok);
console.log(`\n${rewritten.length}/${rows.length} rewritten, ${rows.length - rewritten.length} kept by the check; bad text shown to the user: ${rewritten.filter((r) => r.lost.length || r.added.length || r.g.length).length}`);
console.log(`avg ${Math.round(rewritten.reduce((a, r) => a + r.ms, 0) / Math.max(1, rewritten.length))} ms; outside requests: ${JSON.stringify([...outside])}; exceptions: ${JSON.stringify(errors)}`);
console.log('\n--- loss / More formal ---\n' + (rows.find((r) => r.mode === 'loss' && r.style === 'formal' && r.ok)?.after ?? 'none'));
ws.close();
