// tools/extension-e2e.mjs: loads dist/extension into Chromium and checks it end to end, against a
// stand-in for Gmail served on this machine as mail.google.com. The stand-in lists the sample
// mailbox's messages 20 to a page with an "Older" button, and serves each one through
// "?view=om&permmsgid=msg-f:<id>" the way Gmail's "Show original" does. It proves the pipe (inject,
// list, page, fetch, rebuild the mbox, scan), not Gmail's own markup, which can change.
// Usage: node tools/extension-e2e.mjs <chromium.exe>   (Playwright's Chromium: Chrome ignores --load-extension)
import { spawn, execFileSync } from 'node:child_process';
import { createServer } from 'node:https';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const CHROMIUM = process.argv[2];
const tmp = mkdtempSync(join(tmpdir(), 'lam-ext-'));
// A config of our own: a stray OPENSSL_CONF on this machine can point at a file that isn't there.
writeFileSync(join(tmp, 'o.cnf'), '[req]\ndistinguished_name = dn\n[dn]\n');
execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-subj', '/CN=mail.google.com', '-keyout', join(tmp, 'k.pem'), '-out', join(tmp, 'c.pem'), '-days', '1'], { stdio: 'ignore', env: { ...process.env, OPENSSL_CONF: join(tmp, 'o.cnf') } });

// The sample mailbox, one message per "From " line, each given a Gmail-style hex id.
const mbox = readFileSync('fixtures/sample.example.mbox', 'utf8');
const msgs = mbox.replace(/\r\n/g, '\n').split(/^From \S+ .*\n/m).filter((m) => m.trim()).map((raw, i) => ({
  hex: (0x18f0000000000000n + BigInt(i * 7919)).toString(16), raw: raw.replace(/^>(>*From )/gm, '$1'),
  from: (/^From:.*?<([^>]+)>/m.exec(raw) ?? /^From:\s*(\S+@\S+)/m.exec(raw) ?? [, 'x@x.example'])[1],
}));
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const PAGE = `<!doctype html><title>Inbox - jordan.reyes@alderbrook.example - Alderbrook Mail</title>
<script>var GM_ID_KEY = '0a1b2c3d4e';</script><div role="main"><table id="t"></table></div>
<div aria-label="Older" role="button" id="older">Older</div>
<script>const rows = ${JSON.stringify(msgs.map(({ hex, from }) => ({ hex, from })))}; let page = 0;
function draw() { document.getElementById('t').innerHTML = rows.slice(page * 20, page * 20 + 20).map(r =>
  '<tr><td><span email="' + r.from + '">' + r.from + '</span></td><td><span data-legacy-thread-id="' + r.hex + '">subject</span></td></tr>').join('');
  document.getElementById('older').setAttribute('aria-disabled', String((page + 1) * 20 >= rows.length)); }
document.getElementById('older').onclick = () => { if ((page + 1) * 20 < rows.length) { page++; setTimeout(draw, 200); } }; draw();</script>`;

const server = createServer({ key: readFileSync(`${tmp}/k.pem`), cert: readFileSync(`${tmp}/c.pem`) }, (req, res) => {
  const u = new URL(req.url, 'https://mail.google.com');
  if (u.searchParams.get('view') === 'om') {
    const id = BigInt(u.searchParams.get('permmsgid').replace('msg-f:', '')).toString(16);
    const m = u.searchParams.get('ik') === '0a1b2c3d4e' && msgs.find((x) => x.hex === id);
    res.writeHead(m ? 200 : 404, { 'content-type': 'text/html' }).end(m ? `<html><body><pre class="raw_message_text" id="raw_message_text">${esc(m.raw)}</pre></body></html>` : 'no');
  } else res.writeHead(200, { 'content-type': 'text/html' }).end(PAGE);
}).listen(443);

const port = 9341;
const chrome = spawn(CHROMIUM, [`--user-data-dir=${tmp}/profile`, `--remote-debugging-port=${port}`, '--headless=new', '--no-first-run',
  `--disable-extensions-except=${resolve('dist/extension')}`, `--load-extension=${resolve('dist/extension')}`,
  '--host-resolver-rules=MAP mail.google.com 127.0.0.1', '--ignore-certificate-errors', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Ours is the one with background.js; Chromium lists its own built-in extensions too.
const OURS = /^chrome-extension:\/\/([a-p]+)\/background\.js$/;
let targets = [];
for (let i = 0; i < 40; i++) { await sleep(500); try { targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); if (targets.some((t) => OURS.test(t.url))) break; } catch { /* starting */ } }
const extId = targets.map((t) => OURS.exec(t.url)?.[1]).find(Boolean);
if (!extId) throw new Error('extension did not load');

async function tab(url) {
  const t = await (await fetch(`http://127.0.0.1:${port}/json/new?${url}`, { method: 'PUT' })).json();
  const ws = new WebSocket(t.webSocketDebuggerUrl); await new Promise((r) => ws.addEventListener('open', r));
  let id = 0; const pending = new Map(); const errors = []; const outside = new Set();
  ws.addEventListener('message', (m) => { const d = JSON.parse(m.data);
    if (d.id) { pending.get(d.id)?.(d); pending.delete(d.id); }
    else if (d.method === 'Runtime.exceptionThrown') errors.push(d.params.exceptionDetails.exception?.description?.slice(0, 200));
    else if (d.method === 'Network.requestWillBeSent' && !/^(chrome-extension|data|blob):/.test(d.params.request.url)) outside.add(d.params.request.url.slice(0, 80)); });
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  await send('Runtime.enable'); await send('Network.enable');
  const ev = async (expression) => { const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture: true }); return r.result?.result?.value ?? r.result?.exceptionDetails?.exception?.description; };
  return { ev, errors, outside, close: () => ws.close() };
}

const gmail = await tab('https://mail.google.com/mail/u/0/');
await sleep(1500);
const app = await tab(`chrome-extension://${extId}/index.html`);
await sleep(2500);
console.log("page:", await app.ev(`document.title + " | " + document.body.innerText.slice(0, 300) + " | buttons: " + [...document.querySelectorAll("button")].map(b => b.textContent).join(", ")`));
const result = await app.ev(`(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const btn = (re) => [...document.querySelectorAll('button')].find((b) => re.test(b.textContent));
  btn(/Read from Gmail/).click();
  let said = '';
  for (let i = 0; i < 120; i++) { await wait(500); said = document.querySelector('.from-gmail [role=status]').textContent; if (/^Read \\d|Open Gmail|didn|No account|stopped|Gmail:/.test(said)) break; }
  const email = document.getElementById('f-email').value;
  document.querySelectorAll('.quick button')[2].click();
  document.getElementById('f-own').click();
  await wait(200);
  btn(/Find my accounts/).click();
  for (let i = 0; i < 60 && !document.querySelector('.map'); i++) await wait(250);
  return { said, email, summary: document.querySelector('.summary')?.innerText, outside: document.querySelector('#receipt-outside')?.innerText,
    main: [...document.querySelectorAll('.cards .domain')].map((d) => d.textContent).sort().join(' ') };
})()`);
console.log(JSON.stringify(result, null, 2));
console.log('extension page: requests to other sites', [...app.outside], 'exceptions', app.errors);
console.log('gmail stand-in: exceptions', gmail.errors);
app.close(); gmail.close(); chrome.kill(); server.close();
const ok = /^Read \d+ emails/.test(result.said) && result.outside === '0' && app.outside.size === 0 && app.errors.length === 0;
console.log(ok ? 'PASS' : 'FAIL');
process.exit(ok ? 0 : 1);
