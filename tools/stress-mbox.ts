// tools/stress-mbox.ts: streams a generated mailbox of N MB through the scan pipeline and reports
// speed and peak memory. Nothing is written to disk. Usage: node tools/stress-mbox.ts [MB]
import { MboxSplitter } from '../packages/core/mbox/split.ts';
import { KEEP_BODY_BYTES, readBody } from '../packages/core/mbox/body.ts';
import { makeLinkContext } from '../packages/core/rules/school-link.ts';
import { Aggregator } from '../packages/core/rules/aggregate.ts';
import { rank } from '../packages/core/rank.ts';

const targetMB = Number(process.argv[2] ?? 256);
const enc = new TextEncoder();
const attachment = Buffer.alloc(2 * 1024 * 1024, 7).toString('base64').replace(/.{76}/g, '$&\n');
const htmlBody = '<html><body>' + '<p>Your weekly digest from Pagewell. </p>'.repeat(700) + '</body></html>';
let seq = 0;

function message(): string {
  const i = seq++;
  const kind = i % 20;
  const domain = `service${i % 400}.example`;
  const head = [`From ${i}@xxx Sat Nov 21 10:00:00 +0000 2026`, 'Delivered-To: jreyes@alderbrook.example',
    `From: Service ${i % 400} <no-reply@${domain}>`, 'To: jreyes@alderbrook.example', `Subject: Message ${i}`,
    'Date: Sat, 21 Nov 2026 10:00:00 +0000', 'MIME-Version: 1.0'];
  if (kind === 0) {
    return [...head, 'Content-Type: multipart/mixed; boundary="m"', '', '--m', 'Content-Type: text/plain', '',
      'See the attached file.', '--m', 'Content-Type: application/octet-stream', 'Content-Transfer-Encoding: base64', '',
      attachment, '--m--', ''].join('\n');
  }
  if (kind < 6) return [...head, 'Content-Type: text/html; charset=utf-8', '', htmlBody, ''].join('\n');
  return [...head, 'Content-Type: text/plain; charset=utf-8', '', 'Welcome to the service. '.repeat(120), ''].join('\n');
}

const splitter = new MboxSplitter({ keepBodyBytes: KEEP_BODY_BYTES });
const agg = new Aggregator(makeLinkContext('alderbrook.example', ['jreyes@alderbrook.example']));
let bytes = 0, messages = 0, peakRss = 0, peakHeap = 0;
const sample = () => {
  const m = process.memoryUsage();
  peakRss = Math.max(peakRss, m.rss); peakHeap = Math.max(peakHeap, m.heapUsed);
};
const t0 = performance.now();
let nextReport = 512;
while (bytes < targetMB * 1024 * 1024) {
  let chunkText = '';
  while (chunkText.length < 1024 * 1024) chunkText += message() + '\n';
  const chunk = enc.encode(chunkText);
  bytes += chunk.length;
  for (const m of splitter.pushMessages(chunk)) { agg.add(m.rec, await readBody(m.raw)); messages++; }
  sample();
  if (bytes / 1048576 >= nextReport) {
    console.log(`${Math.round(bytes / 1048576)} MB, ${messages} messages, peak RSS ${Math.round(peakRss / 1048576)} MB`);
    nextReport += 512;
  }
}
for (const m of splitter.endMessages()) { agg.add(m.rec, await readBody(m.raw)); messages++; }
const accounts = rank(agg.accountsOut());
sample();
const s = (performance.now() - t0) / 1000;
console.log(JSON.stringify({ MB: Math.round(bytes / 1048576), messages, accounts: accounts.length, seconds: Math.round(s),
  MBperSecond: Math.round(bytes / 1048576 / s), peakRssMB: Math.round(peakRss / 1048576), peakHeapMB: Math.round(peakHeap / 1048576) }));
