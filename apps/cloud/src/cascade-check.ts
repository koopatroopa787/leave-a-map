// T21 acceptance check: run held-out domains through the cascade on the Nano machine and print
// which model answered each field. Built only with `vite build --mode check`; never deployed.
import { lastError, lookupAll, type LookupLog } from './egress.ts';

const out = document.getElementById('out')!;
const domains = (new URLSearchParams(location.search).get('d') ?? '').split(',').map((d) => d.trim()).filter(Boolean).slice(0, 5);

document.getElementById('run')!.addEventListener('click', async () => {
  const logs: LookupLog[] = [];
  const nano = await (globalThis as { LanguageModel?: { availability(o: unknown): Promise<string> } }).LanguageModel
    ?.availability({ expectedInputs: [{ type: 'text', languages: ['en'] }], expectedOutputs: [{ type: 'text', languages: ['en'] }] })
    .catch((e: Error) => `error: ${e.message}`) ?? 'no LanguageModel';
  try {
    const items = domains.map((d, i) => ({ id: `d${i}`, senderDomain: d }));
    const answers = await lookupAll(items, undefined, (l) => logs.push(l));
    out.textContent = JSON.stringify({ nano, lastError, results: answers.map((a, i) => ({ domain: domains[i], ...a, log: logs[i] })) }, null, 2);
  } catch (e) {
    out.textContent = JSON.stringify({ nano, error: (e as Error).message });
  }
  out.dataset.done = '1';
});
