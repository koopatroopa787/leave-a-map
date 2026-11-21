import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { sampleRulesOnly } from '../../tools/sample-golden.ts';

const golden = JSON.parse(readFileSync(new URL('../../fixtures/sample.expected.json', import.meta.url), 'utf8'));
const bytes = new Uint8Array(readFileSync(new URL('../../fixtures/sample.example.mbox', import.meta.url)));

describe('sample mailbox, rules only (T29 golden)', () => {
  it('matches fixtures/sample.expected.json exactly: sections, buckets and order', async () => {
    expect(await sampleRulesOnly(bytes)).toEqual(golden.rulesOnly);
  });
  it('covers the traps the analyst listed', () => {
    const where = (k: string) => golden.rulesOnly.find((r: { key: string }) => r.key === k);
    expect(where('forkyard-verify.example').section).toBe('ignored'); // P4 lookalike
    expect(where('notebioom.example').section).toBe('ignored'); // P3 lookalike
    expect(where('notebloom.example').section).toBe('main'); // the genuine one survives
    expect(where('brightpenny.example').suspiciousIgnored).toBe(1); // spoof
    expect(where('pixelquay.example').section).toBe('elsewhere'); // auto-forward
    expect(where('alderbrook.example').section).toBe('ends-anyway'); // school-run
    expect(where('hireloft.example')).toBeUndefined(); // only inside a friend's forward
    expect(where('vistaroam.example').discount).toBeNull(); // student words in bulk mail only
    expect(where('munchroute.example').section).toBe('main'); // one receipt linked only by Received-for
  });
});
