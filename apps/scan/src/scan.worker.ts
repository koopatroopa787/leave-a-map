// apps/scan/src/scan.worker.ts: reads the .mbox file in a Worker so the page stays responsive.
// Nothing here can reach the network: the scan site's CSP sets connect-src 'none'.
import { MboxSplitter, type SplitMessage } from '../../../packages/core/mbox/split.ts';
import { KEEP_BODY_BYTES, readBody } from '../../../packages/core/mbox/body.ts';
import { makeLinkContext } from '../../../packages/core/rules/school-link.ts';
import { Aggregator } from '../../../packages/core/rules/aggregate.ts';
import { rank } from '../../../packages/core/rank.ts';
import type { FromWorker, ToWorker } from '../../../packages/core/types.ts';

const post = (m: FromWorker) => (self as unknown as { postMessage(m: FromWorker): void }).postMessage(m);

self.onmessage = async (e: MessageEvent<ToWorker>) => {
  if (e.data?.type !== 'scan') return;
  const { file, settings } = e.data;
  const started = performance.now();
  try {
    const agg = new Aggregator(makeLinkContext(settings.schoolDomain, settings.ownAddresses));
    const splitter = new MboxSplitter({ keepBodyBytes: KEEP_BODY_BYTES });
    const reader = file.stream().getReader();
    let bytesRead = 0;
    let messages = 0;
    let lastPost = 0;
    const take = async (msgs: SplitMessage[]) => {
      for (const m of msgs) agg.add(m.rec, await readBody(m.raw));
      messages += msgs.length;
    };
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      await take(splitter.pushMessages(value));
      bytesRead += value.byteLength;
      const now = performance.now();
      if (now - lastPost > 150) { lastPost = now; post({ type: 'progress', bytesRead, totalBytes: file.size, messages }); }
    }
    await take(splitter.endMessages());
    if (messages === 0) {
      post({ type: 'error', message: 'No emails found. Is this an .mbox file? Look for a file ending in .mbox inside your export.' });
      return;
    }
    agg.stats.bytes = bytesRead;
    post({ type: 'progress', bytesRead, totalBytes: file.size, messages });
    const accounts = rank(agg.accountsOut());
    post({ type: 'done', accounts, stats: agg.stats, ms: Math.round(performance.now() - started), nanoItems: agg.nanoItems(accounts) });
  } catch (err) {
    post({ type: 'error', message: err instanceof Error ? err.message : String(err) });
  }
};
