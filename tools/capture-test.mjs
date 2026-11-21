// tools/capture-test.mjs: T25, the privacy capture test. Run it on a machine with Chrome (and,
// for the full lane 2 run, Gemini Nano). It needs no root.
//
//   1. STUN: a UDP listener on port 3478 counts packets. A page without our CSP opens an
//      RTCPeerConnection to it (positive control: packets expected). Then the scan page tries the
//      same directly and through a same-origin about:blank iframe (expected: 0 packets).
//   2. Capture: Chrome writes its own network log (--log-net-log) while the scan page runs the
//      sample and, where Nano exists, labels it on-device. Every request is listed; requests made
//      by the scan page (its network isolation key names the scan origin) must be 0.
//
// Usage: node tools/capture-test.mjs <dist/scan dir> <firebase.json> <chrome profile dir> [--no-nano]
// Prints a JSON summary. The raw net log stays on this machine.
import { createServer } from 'node:http';
import { createSocket } from 'node:dgram';
import { networkInterfaces, tmpdir } from 'node:os';
import { spawn } from 'node:child_process';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { join, extname, resolve, normalize } from 'node:path';

const [distDir, firebaseJson, profile] = process.argv.slice(2);
const withNano = !process.argv.includes('--no-nano');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const CDP = 9335, SCAN = 4190, PLAIN = 4191, SCAN_WEBRTC_BLOCK = 4192;

// --- servers ---------------------------------------------------------------------------------
const hosting = JSON.parse(await readFile(firebaseJson, 'utf8')).hosting.find((h) => h.target === 'scan');
const scanHeaders = Object.fromEntries(hosting.headers[0].headers.map((h) => [h.key, h.value]));
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
const root = resolve(distDir);
function serveDist(port, headers) {
  return new Promise((ok) => createServer(async (req, res) => {
    const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
    let file = join(root, path.endsWith('/') ? `${path}index.html` : path);
    const body = await readFile(file).catch(() => { file = join(root, 'index.html'); return readFile(file); });
    res.writeHead(200, { ...headers, 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' }).end(body);
  }).listen(port, '127.0.0.1', ok));
}
await serveDist(SCAN, scanHeaders);
// Experiment: the same CSP plus the CSP3 `webrtc 'block'` directive.
const csp = scanHeaders['Content-Security-Policy'];
await serveDist(SCAN_WEBRTC_BLOCK, { ...scanHeaders, 'Content-Security-Policy': `${csp}; webrtc 'block'` });
await new Promise((ok) => createServer((_, res) => res.writeHead(200, { 'Content-Type': 'text/html' }).end('<!doctype html><title>plain</title>')).listen(PLAIN, '127.0.0.1', ok));

// --- STUN listener ---------------------------------------------------------------------------
const ip = Object.values(networkInterfaces()).flat().find((i) => i && i.family === 'IPv4' && !i.internal)?.address;
if (!ip) throw new Error('no non-loopback IPv4 address for the STUN listener');
let stunPackets = 0;
const udp = createSocket('udp4');
udp.on('message', () => { stunPackets++; });
await new Promise((ok) => udp.bind(3478, '0.0.0.0', ok));
const STUN_URL = `stun:${ip}:3478`;

// --- Chrome ----------------------------------------------------------------------------------
const logDir = await mkdtemp(join(tmpdir(), 't25-'));
const netlog = join(logDir, 'netlog.json');
const chrome = spawn('google-chrome', ['--headless=new', `--user-data-dir=${profile}`, `--remote-debugging-port=${CDP}`,
  '--no-first-run', `--log-net-log=${netlog}`, '--net-log-capture-mode=Default', 'about:blank'], { stdio: 'ignore' });
await sleep(4000);

async function page() {
  const t = await (await fetch(`http://127.0.0.1:${CDP}/json/new?about:blank`, { method: 'PUT' })).json();
  const ws = new WebSocket(t.webSocketDebuggerUrl); await new Promise((r) => ws.addEventListener('open', r));
  let id = 0; const pending = new Map(); const requests = [];
  ws.addEventListener('message', (m) => {
    const d = JSON.parse(m.data);
    if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); }
    else if (d.method === 'Network.requestWillBeSent') requests.push(d.params.request.url.slice(0, 120));
  });
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async (expression, extra = {}) => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, ...extra });
    return r.result?.exceptionDetails ? `threw: ${(r.result.exceptionDetails.exception?.description ?? '').split('\n')[0]}` : r.result?.result?.value;
  };
  await send('Network.enable'); await send('Runtime.enable');
  return { send, ev, requests, close: async () => { await send('Page.close'); ws.close(); } };
}

// The probe: build a peer connection to our STUN listener and gather candidates for 3 s.
const probe = (ctor) => `(async () => {
  const C = ${ctor};
  if (typeof C !== 'function') return 'no RTCPeerConnection here';
  const pc = new C({ iceServers: [{ urls: '${STUN_URL}' }] });
  pc.createDataChannel('x');
  await pc.setLocalDescription(await pc.createOffer());
  await new Promise((r) => setTimeout(r, 3000));
  pc.close();
  return 'ran';
})()`;
const IFRAME = `(() => { const f = document.createElement('iframe'); document.body.append(f); return f.contentWindow.RTCPeerConnection; })()`;

async function stunCase(url, ctor) {
  const p = await page();
  await p.send('Page.navigate', { url }); await sleep(1500);
  const before = stunPackets;
  const result = await p.ev(probe(ctor));
  await sleep(500);
  await p.close();
  return { result, packets: stunPackets - before };
}

const out = { stunServer: 'local UDP listener on port 3478', stun: {}, capture: {} };
out.stun.control = await stunCase(`http://127.0.0.1:${PLAIN}/`, 'window.RTCPeerConnection');
out.stun.scanDirect = await stunCase(`http://127.0.0.1:${SCAN}/`, 'window.RTCPeerConnection');
out.stun.scanIframe = await stunCase(`http://127.0.0.1:${SCAN}/`, IFRAME);
out.stun.scanIframeWithWebrtcBlock = await stunCase(`http://127.0.0.1:${SCAN_WEBRTC_BLOCK}/`, IFRAME);

// Positive control for the net-log attribution: a plain page fetches one outside URL, and the
// parser below must attribute it to that page.
{
  const c = await page();
  await c.send('Page.navigate', { url: `http://127.0.0.1:${PLAIN}/` }); await sleep(1000);
  await c.ev(`fetch('https://example.com/?t25-control', { mode: 'no-cors' }).then(() => 'ok', (e) => String(e))`);
  await c.close();
}
// Other ways to reach a fresh window on the scan page, each expected to be refused.
{
  const c = await page();
  await c.send('Page.navigate', { url: `http://127.0.0.1:${SCAN}/` }); await sleep(1500);
  out.stun.otherRoutes = {
    innerHTML: await c.ev(`(() => { const d = document.createElement('div'); d.innerHTML = '<iframe></iframe>'; document.body.append(d); return d.querySelector('iframe') ? typeof d.querySelector('iframe').contentWindow?.RTCPeerConnection : 'no iframe'; })()`),
    domParser: await c.ev(`(() => { const doc = new DOMParser().parseFromString('<iframe></iframe>', 'text/html'); return 'parsed'; })()`),
    createElementNS: await c.ev(`(() => { document.createElementNS('http://www.w3.org/1999/xhtml', 'iframe'); return 'made'; })()`),
    otherDocument: await c.ev(`(() => { const d = document.implementation.createHTMLDocument(''); d.createElement('iframe'); return 'made'; })()`),
    windowOpenBlank: await c.ev(`(() => { const w = window.open('about:blank'); return w ? 'opened' : 'null'; })()`, { userGesture: true }),
  };
  await c.close();
}

// --- full scan capture ---------------------------------------------------------------------------
const stunBeforeScan = stunPackets;
const p = await page();
const scanStarted = Date.now();
await p.send('Page.navigate', { url: `http://127.0.0.1:${SCAN}/` }); await sleep(1500);
await p.ev(`localStorage.clear(); document.getElementById('try-sample').click()`);
for (let i = 0; i < 40 && !(await p.ev(`!!document.getElementById('moved-count')`)); i++) await sleep(250);
out.capture.scan = await p.ev(`document.querySelector('.summary')?.textContent.replace(/\\s+/g, ' ')`);
if (withNano) {
  for (let i = 0; i < 20 && (await p.ev(`document.getElementById('nano-start')?.disabled ?? true`)); i++) await sleep(500);
  const can = await p.ev(`!!document.getElementById('nano-start')`);
  if (can) {
    await p.ev(`document.getElementById('nano-start').click()`, { userGesture: true });
    for (let i = 0; i < 600 && !(await p.ev(`!!document.getElementById('nano-stats')`)); i++) await sleep(1000);
    const stats = JSON.parse((await p.ev(`document.getElementById('nano-stats')?.textContent`)) ?? '{}');
    out.capture.nano = { done: stats.done, total: stats.total, medianMs: stats.medianMs, egress: stats.egress };
  } else out.capture.nano = await p.ev(`document.querySelector('.nano p')?.textContent`);
}
out.capture.devtoolsRequests = p.requests.filter((u) => !u.startsWith(`http://127.0.0.1:${SCAN}/`));
out.capture.seconds = Math.round((Date.now() - scanStarted) / 1000);
out.capture.stunPacketsDuringScan = stunPackets - stunBeforeScan;
await p.close();

chrome.kill('SIGTERM');
await sleep(3000);
udp.close();

// --- read Chrome's own net log -------------------------------------------------------------------
let text = await readFile(netlog, 'utf8');
if (!text.trimEnd().endsWith('}')) text = text.replace(/,\s*$/, '') + ']}'; // log cut off at exit
const log = JSON.parse(text);
const types = Object.fromEntries(Object.entries(log.constants.logEventTypes).map(([k, v]) => [v, k]));
const bySource = new Map();
for (const e of log.events) {
  const t = types[e.type];
  if (t !== 'URL_REQUEST_START_JOB' && t !== 'REQUEST_ALIVE' && t !== 'CORS_REQUEST') continue;
  const s = bySource.get(e.source.id) ?? {};
  if (e.params?.url) s.url = e.params.url;
  const nik = e.params?.network_isolation_key ?? e.params?.network_anonymization_key ?? e.params?.isolation_info;
  if (nik) s.nik = typeof nik === 'string' ? nik : JSON.stringify(nik);
  if (e.params?.initiator) s.initiator = e.params.initiator;
  bySource.set(e.source.id, s);
}
const all = [...bySource.values()].filter((r) => r.url && !/^(?:https?:\/\/(?:127\.0\.0\.1|localhost)[:/]|data:|blob:|chrome)/.test(r.url));
const scanOrigin = `127.0.0.1:${SCAN}`;
const attributed = (r, origin) => (r.nik ?? '').includes(origin) || (r.initiator ?? '').includes(origin);
const fromScan = all.filter((r) => attributed(r, scanOrigin));
const control = all.filter((r) => attributed(r, `127.0.0.1:${PLAIN}`) && r.url.includes('t25-control'));
out.capture.netlog = {
  attributionControlFound: control.length > 0,
  outsideRequestsTotal: all.length,
  outsideRequestsFromScanPage: fromScan.length,
  fromScanPage: fromScan.map((r) => r.url.slice(0, 120)),
  otherHosts: [...new Set(all.filter((r) => !fromScan.includes(r) && !control.includes(r)).map((r) => new URL(r.url).host))],
};
await rm(logDir, { recursive: true, force: true });
console.log(JSON.stringify(out, null, 2));
process.exit(0);
