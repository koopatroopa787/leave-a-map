// T26: the privacy receipt. Built on this page from the page's own log (lockdown.ts), updated live,
// and never sent anywhere. Its numbers are the ones the T25 capture checks from outside.
import { useEffect, useState } from 'preact/hooks';
import { egressLog, logLocal, onEgress } from '../lockdown.ts';
import { buildReceipt, headline, receiptText } from '../receipt.ts';

const time = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

// Real attempts to reach another site, for anyone who wants to see the page stop them. example.com is
// reserved for tests (RFC 2606), and nothing about the person goes in the address.
const TEST_URL = 'https://example.com/leave-a-map-test';
async function tryToLeak(): Promise<string> {
  const before = egressLog.filter((e) => e.kind === 'blocked').length;
  try { await fetch(TEST_URL, { cache: 'no-store' }); } catch { /* blocked by connect-src 'none' */ }
  await new Promise<void>((done) => { const img = new Image(); img.onload = img.onerror = () => done(); img.src = `${TEST_URL}.gif`; setTimeout(done, 1500); });
  const webrtc = typeof (globalThis as { RTCPeerConnection?: unknown }).RTCPeerConnection === 'undefined';
  logLocal(`Leak test: tried a fetch and an image from example.com${webrtc ? '; WebRTC is removed from this page' : ''}`);
  await new Promise((r) => setTimeout(r, 50));
  const stopped = egressLog.filter((e) => e.kind === 'blocked').length - before;
  return `Tried 2 ways to reach example.com: ${stopped} stopped by the page's rules, ${2 - Math.min(2, stopped)} got through.${webrtc ? ' WebRTC, a third way out, isn’t on this page at all.' : ''}`;
}

export function Receipt() {
  const [, bump] = useState(0);
  const [test, setTest] = useState('');
  useEffect(() => onEgress(() => bump((n) => n + 1)), []);
  const r = buildReceipt(egressLog);

  const save = () => {
    const url = URL.createObjectURL(new Blob([receiptText(r)], { type: 'text/plain' }));
    const a = document.createElement('a');
    a.href = url; a.download = 'leave-a-map-receipt.txt';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <section class="receipt" id="privacy-receipt" aria-labelledby="receipt-title">
      <h2 id="receipt-title">Privacy receipt</h2>
      <p class="receipt-head" id="receipt-headline"><strong>{headline(r)}.</strong></p>
      <dl>
        <dt>Done on this device</dt>
        <dd>{r.local.length ? <ul>{r.local.map((e, i) => <li key={i}>{e.detail} <span class="meta">{time(e.at)}</span></li>)}</ul> : 'Nothing yet.'}</dd>

        <dt>Shown in the consent window</dt>
        <dd>{r.handoffs.length === 0 ? 'Not used. No web address left this page.' : (
          <ul>{r.handoffs.map((h, i) => (
            <li key={i}>
              {h.shown.length} web address{h.shown.length === 1 ? '' : 'es'} shown <span class="meta">{time(h.at)}</span>. {h.outcome}
              {h.approved && h.approved.length > 0 && <>: <span class="domain">{h.approved.join(', ')}</span></>}.
            </li>
          ))}</ul>
        )}</dd>

        <dt>Requests from this page to other sites</dt>
        <dd id="receipt-outside">{r.outside.length === 0 ? '0' : <ul>{r.outside.map((e, i) => <li key={i}>{e.detail} <span class="meta">{time(e.at)}</span></li>)}</ul>}</dd>

        <dt>Blocked attempts</dt>
        <dd id="receipt-blocked">{r.blocked.length === 0 ? '0' : <ul>{r.blocked.map((e, i) => <li key={i}>{e.detail} <span class="meta">{time(e.at)}</span></li>)}</ul>}</dd>
      </dl>
      <p class="meta">
        Made on this page from what it saw, and not sent anywhere. It can't see your browser's own traffic, such as
        updates or sign-in. How we tested it: docs/PRIVACY.md in the project's code.
      </p>
      <div class="draft-actions">
        <button type="button" class="secondary" onClick={save}>Save a copy</button>
        <button type="button" class="secondary" onClick={() => { setTest('Trying…'); void tryToLeak().then(setTest); }}>Try to send something out</button>
      </div>
      <p class="meta" role="status">{test}</p>
    </section>
  );
}
