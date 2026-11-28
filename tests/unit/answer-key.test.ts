import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { splitAllMessages } from '../../packages/core/mbox/split.ts';
import { KEEP_BODY_BYTES, readBody } from '../../packages/core/mbox/body.ts';
import { makeLinkContext } from '../../packages/core/rules/school-link.ts';
import { Aggregator } from '../../packages/core/rules/aggregate.ts';
import { rank } from '../../packages/core/rank.ts';
import { answerKey, scoreSample } from '../../packages/core/answer-key.ts';
import { applyPack, makePack, type HandLinksFile, type PackFile } from '../../packages/core/pack.ts';

const json = (f: string) => JSON.parse(readFileSync(new URL(`../../data/${f}`, import.meta.url), 'utf8'));
const pack = makePack(json('pack.generated.json') as PackFile, json('hand-links.json') as HandLinksFile);

async function rulesOnly(file: string, domain: string, own: string[]) {
  const agg = new Aggregator(makeLinkContext(domain, own));
  for (const m of splitAllMessages(new Uint8Array(readFileSync(new URL(`../../fixtures/${file}`, import.meta.url))), 4096, KEEP_BODY_BYTES)) agg.add(m.rec, await readBody(m.raw));
  // As the page does it: the move pack on top of the rules.
  return rank(applyPack(agg.accountsOut(), pack));
}

describe('sample answer keys, rules and the move pack, no AI', () => {
  it('school sample: every account found and sorted, every trap caught', async () => {
    const s = scoreSample(await rulesOnly('sample.example.mbox', 'alderbrook.example', ['jordan.reyes@alderbrook.example', 'jreyes@alderbrook.example']), answerKey('school'), String);
    expect(s.misses).toEqual([]);
    expect([s.found, s.plantedOf, s.sorted, s.sortedOf, s.caught, s.trapsOf]).toEqual([20, 20, 13, 13, 7, 7]);
  });
  it('after-a-loss sample: the same', async () => {
    const s = scoreSample(await rulesOnly('estate.example.mbox', 'mailbox.example', ['robin.hale@mailbox.example']), answerKey('loss'), String);
    expect(s.misses).toEqual([]);
    expect([s.found, s.plantedOf, s.sorted, s.sortedOf, s.caught, s.trapsOf]).toEqual([15, 15, 14, 14, 3, 3]);
  });
  it('reports a miss in plain words', () => {
    const s = scoreSample([], answerKey('loss'), String);
    expect(s.found).toBe(0);
    expect(s.misses[0]).toBe("Harbourline Bank wasn't on the main list.");
  });
});
