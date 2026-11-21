// apps/scan/src/nano-run.ts: lane 2 over a whole scan. Labels up to 200 chosen emails one at a
// time, folds each label into its account (evidence caps from T12) and re-ranks as it goes.
import type { Label } from '../../../packages/core/contract.ts';
import type { Account, NanoItem, RankedAccount } from '../../../packages/core/types.ts';
import { applyLabel } from '../../../packages/core/evidence.ts';
import { rank } from '../../../packages/core/rank.ts';

export type Classifier = { classify(id: string, senderDomain: string, text: string): Promise<Label | null> };
export type Timing = { id: string; ms: number; valid: boolean };

export type NanoRunStats = {
  total: number;
  done: number;
  labelled: number;
  invalid: number;
  errors: number;
  /** Set when the run stopped early, e.g. an answer that didn't come from the device. */
  stopped: string | null;
  /** U2: the first 50 answers. */
  first50: { n: number; medianMs: number; invalidPct: number };
  medianMs: number;
};

export const median = (xs: number[]) => {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
};

export function summarise(total: number, timings: Timing[], errors: number, stopped: string | null): NanoRunStats {
  const first = timings.slice(0, 50);
  const invalid = timings.filter((t) => !t.valid).length;
  return {
    total, done: timings.length + errors, labelled: timings.length - invalid, invalid, errors, stopped,
    first50: { n: first.length, medianMs: median(first.map((t) => t.ms)),
      invalidPct: first.length ? Math.round((first.filter((t) => !t.valid).length / first.length) * 1000) / 10 : 0 },
    medianMs: median(timings.map((t) => t.ms)),
  };
}

/**
 * Runs every item through the classifier. `timings` is filled by the classifier's log callback.
 * An answer that left the device stops the whole run: lane 2 must never use the cloud.
 */
export async function labelAccounts(items: readonly NanoItem[], start: readonly RankedAccount[], nano: Classifier,
  timings: Timing[], onUpdate: (accounts: RankedAccount[], stats: NanoRunStats) => void): Promise<RankedAccount[]> {
  const byKey = new Map<string, Account>(start.map((a) => [a.key, a]));
  let errors = 0;
  let stopped: string | null = null;
  let ranked = [...start];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    try {
      const label = await nano.classify(item.msgId, item.senderDomain, item.text);
      const acc = byKey.get(item.key);
      if (label && acc) byKey.set(item.key, applyLabel(acc, label, { msgId: item.msgId, date: item.date }));
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      if (message.startsWith('left the device')) { stopped = message; break; }
      errors++;
    }
    if (i % 5 === 4 || i === items.length - 1) {
      ranked = rank([...byKey.values()]);
      onUpdate(ranked, summarise(items.length, timings, errors, stopped));
    }
  }
  ranked = rank([...byKey.values()]);
  onUpdate(ranked, summarise(items.length, timings, errors, stopped));
  return ranked;
}
