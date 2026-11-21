import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { splitAll } from '../../packages/core/mbox/split.ts';
import { makeLinkContext } from '../../packages/core/rules/school-link.ts';
import { Aggregator } from '../../packages/core/rules/aggregate.ts';
import { rank } from '../../packages/core/rank.ts';

describe('synthetic 200-message mailbox (Gate C fallback)', () => {
  const bytes = new Uint8Array(readFileSync(new URL('../../fixtures/fixture-200.example.mbox', import.meta.url)));
  const msgs = splitAll(bytes, 4096);
  const agg = new Aggregator(makeLinkContext('alderbrook.example', ['jreyes@alderbrook.example']));
  msgs.forEach((m) => agg.add(m));
  const out = rank(agg.accountsOut());
  const section = (key: string) => out.find((a) => a.key === key)?.section;

  it('finds all 200 messages', () => expect(msgs).toHaveLength(200));
  it('puts each fictional sender where it belongs', () => {
    expect(section('forkyard.example')).toBe('main');
    expect(section('ledgerly.example')).toBe('main');
    expect(section('pagewell.example')).toBe('maybe');
    expect(section('alderbrook.example')).toBe('ends-anyway');
    expect(section('mobilebank.example')).toBe('elsewhere');
    expect(section('shopfront.example')).toBeUndefined();
    expect(out.some((a) => a.key === 'mailbox.example')).toBe(false);
  });
});
