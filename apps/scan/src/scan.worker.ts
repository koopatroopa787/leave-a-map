// apps/scan/src/scan.worker.ts: reads the .mbox file in a Worker so the page stays responsive.
// Nothing here can reach the network: the scan site's CSP sets connect-src 'none'.
import { MboxSplitter } from '../../../packages/core/mbox/split.ts';
import { makeLinkContext } from '../../../packages/core/rules/school-link.ts';
import { Aggregator } from '../../../packages/core/rules/aggregate.ts';
import { rank } from '../../../packages/core/rank.ts';
import type { FromWorker, MessageRecord, ToWorker } from '../../../packages/core/types.ts';

const post = (m: FromWorker) => (self as unknown as { postMessage(m: FromWorker): void }).postMessage(m);

self.onmessage = async (e: MessageEvent<ToWorker>) => {
  if (e.data?.type !== 'scan') return;
  const { file, settings } = e.data;
  const started = performance.now();
  try {
    const agg = new Aggregator(makeLinkContext(settings.schoolDomain, settings.ownAddresses));
    const splitter = new MboxSplitter();
    const reader = file.stream().getReader();
    let bytesRead = 0;
    let messages = 0;
    let lastPost = 0;
    const take = (recs: MessageRecord[]) => { for (const r of recs) agg.add(r); messages += recs.length; };
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      take(splitter.push(value));
      bytesRead += value.byteLength;
      const now = performance.now();
      if (now - lastPost > 150) { lastPost = now; post({ type: 'progress', bytesRead, totalBytes: file.size, messages }); }
    }
    take(splitter.end());
    if (messages === 0) {
      post({ type: 'error', message: 'No emails found. Is this an .mbox file? Look for a file ending in .mbox inside your export.' });
      return;
    }
    agg.stats.bytes = bytesRead;
    post({ type: 'progress', bytesRead, totalBytes: file.size, messages });
    post({ type: 'done', accounts: rank(agg.accountsOut()), stats: agg.stats, ms: Math.round(performance.now() - started) });
  } catch (err) {
    post({ type: 'error', message: err instanceof Error ? err.message : String(err) });
  }
};
