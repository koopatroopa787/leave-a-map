import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { candidates, computeCounts, editDistance, memoryNames, nameMatches, safeCounts, shuffle, wilson, type Answer } from '../../packages/core/eval.ts';
import { rank } from '../../packages/core/rank.ts';
import { splitAllMessages } from '../../packages/core/mbox/split.ts';
import { KEEP_BODY_BYTES, readBody } from '../../packages/core/mbox/body.ts';
import { makeLinkContext } from '../../packages/core/rules/school-link.ts';
import { Aggregator } from '../../packages/core/rules/aggregate.ts';
import { SAMPLE_SETTINGS } from '../../packages/core/sample.ts';

const rules = (async () => {
  const agg = new Aggregator(makeLinkContext(SAMPLE_SETTINGS.schoolDomain, SAMPLE_SETTINGS.ownAddresses));
  for (const m of splitAllMessages(new Uint8Array(readFileSync(new URL('../../fixtures/sample.example.mbox', import.meta.url))), 4096, KEEP_BODY_BYTES)) agg.add(m.rec, await readBody(m.raw));
  return rank(agg.accountsOut());
})();

describe('eval maths (T27)', () => {
  it('Wilson interval matches the textbook value', () => {
    const w = wilson(8, 10);
    expect(w.p).toBe(0.8);
    expect(w.lo).toBeCloseTo(0.4902, 3);
    expect(w.hi).toBeCloseTo(0.9433, 3);
    expect(wilson(0, 0)).toEqual({ p: 0, lo: 0, hi: 0 });
  });
  it('the shuffle is seeded and complete', () => {
    const xs = Array.from({ length: 20 }, (_, i) => i);
    expect(shuffle(xs, 7)).toEqual(shuffle(xs, 7));
    expect(shuffle(xs, 7)).not.toEqual(shuffle(xs, 8));
    expect([...shuffle(xs, 7)].sort((a, b) => a - b)).toEqual(xs);
  });
  it('matches typed names loosely, and drops school-run names', () => {
    expect(editDistance('proofwrite', 'proofwright')).toBe(3);
    expect(nameMatches('proofwrite', { key: 'proofwright.example', name: 'Proofwright' })).toBe(true);
    expect(nameMatches('Fork', { key: 'forkyard.example', name: 'Forkyard' })).toBe(true);
    expect(nameMatches('bank', { key: 'brightpenny.example', name: 'Brightpenny' })).toBe(false);
    expect(memoryNames('Forkyard\nforkyard, Alderbrook Registrar; Latchkin', [{ key: 'alderbrook.example', name: 'Alderbrook Registrar' }])).toEqual(['Forkyard', 'Latchkin']);
  });
});

describe('counts on the sample, with a known owner (T27)', () => {
  it('computes every number from the arms and answers', async () => {
    const r = await rules;
    const cand = candidates([r], 42);
    // The owner says Yes to every main account except Parcelpine, No to every maybe account.
    const answers = new Map<string, Answer>(r.filter((a) => a.section === 'main' || a.section === 'maybe').map((a) => [a.key,
      a.section === 'maybe' || a.key === 'parcelpine.example' ? { q1: 'no', q2: [] } : { q1: 'yes', q2: a.bucket === 'rest' ? ['none'] : [a.bucket as 'sso'] }]));
    const c = computeCounts({ ramGB: 8, nanoAvailable: false, messages: 55, schoolLinkedMessages: 50, rules: r, nano: [],
      candidates: { ...cand, seed: 42 }, answers, ownerAddedMisses: 1, memory: { named: 3, matchedKeys: new Set(['forkyard.example', 'latchkin.example']) } });
    expect(c.candidates).toBe(21);
    expect(c.sampled).toBe(false);
    expect(c.excluded).toEqual({ schoolRun: 1, looksFake: 2, elsewhere: 1 });
    expect(c.rules).toEqual({ found: 13, tp: 12, fp: 1 });
    expect(c.labels).toEqual({ yes: 12, no: 9, notSure: 0 });
    expect(c.bucketAgree.rules).toEqual([12, 12]);
    expect(c.memory).toEqual({ named: 3, foundConfirmed: 12, overlap: 2, foundNotNamed: 10, namedNotFound: 1 });
    expect(c.arms).toEqual(['rules']);
  });
  it('only numbers, booleans, the commit and arm names survive the copy', async () => {
    const r = await rules;
    const c = computeCounts({ ramGB: null, nanoAvailable: false, messages: 1, schoolLinkedMessages: 1, rules: r, nano: [],
      candidates: { keys: [], sampled: false, seed: 1 }, answers: new Map(), ownerAddedMisses: 0, memory: { named: 0, matchedKeys: new Set() } });
    const poisoned = { ...c, evalCommit: 'forkyard.example', arms: ['rules', 'jordan.reyes@alderbrook.example'], extra: 'Brightpenny',
      labels: { yes: 'Forkyard', no: 1, notSure: 0, names: ['x'] }, memory: { ...c.memory, typed: ['Latchkin'] } };
    const strings: string[] = [];
    const walk = (v: unknown) => { if (typeof v === 'string') strings.push(v); else if (v && typeof v === 'object') Object.values(v).forEach(walk); };
    walk(safeCounts(poisoned));
    expect(strings.every((s) => s === '03b3f2a' || s === 'rules' || s === 'rules+nano')).toBe(true);
    expect(safeCounts(poisoned).labels).toEqual({ yes: 0, no: 1, notSure: 0 });
    expect(safeCounts(c)).toEqual(c);
  });
});
