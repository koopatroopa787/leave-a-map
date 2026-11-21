import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { splitAllMessages } from '../../packages/core/mbox/split.ts';
import { KEEP_BODY_BYTES, readBody } from '../../packages/core/mbox/body.ts';
import { makeLinkContext } from '../../packages/core/rules/school-link.ts';
import { Aggregator } from '../../packages/core/rules/aggregate.ts';
import { rank } from '../../packages/core/rank.ts';

describe('synthetic 200-message mailbox (Gate C fallback)', () => {
  const bytes = new Uint8Array(readFileSync(new URL('../../fixtures/fixture-200.example.mbox', import.meta.url)));
  const msgs = splitAllMessages(bytes, 4096, KEEP_BODY_BYTES);
  const run = async () => {
    const agg = new Aggregator(makeLinkContext('alderbrook.example', ['jreyes@alderbrook.example']));
    for (const m of msgs) agg.add(m.rec, await readBody(m.raw));
    return rank(agg.accountsOut());
  };

  it('finds all 200 messages', () => expect(msgs).toHaveLength(200));
  it('puts each fictional sender in the right section and bucket', async () => {
    const out = await run();
    const where = (key: string) => { const a = out.find((x) => x.key === key); return a && `${a.section}/${a.bucket}`; };
    expect(where('app:sketchpadpro')).toBe('main/sso');
    expect(where('forkyard.example')).toBe('main/work');
    expect(where('quillbase.example')).toBe('main/work');
    expect(where('notewise.example')).toBe('main/reset');
    expect(where('ledgerly.example')).toBe('main/money');
    expect(where('tunebox.example')).toBe('main/money');
    expect(where('cartwheel.example')).toBe('main/rest');
    expect(where('pagewell.example')).toBe('maybe/rest');
    expect(where('alderbrook.example')).toBe('ends-anyway/rest');
    expect(where('mobilebank.example')).toBe('elsewhere/rest');
    expect(where('forkyard-security.example')).toBe('ignored/rest');
    expect(where('shopfront.example')).toBeUndefined();
    expect(where('mailbox.example')).toBeUndefined();
    expect(where('google.com')).toBeUndefined();
    expect(out.find((a) => a.key === 'tunebox.example')?.discount.tier).toBe('seen');
    // Bucket order holds: every main account's bucket is no earlier than the one before it.
    const order = { sso: 1, work: 2, reset: 3, money: 4, rest: 5 };
    const main = out.filter((a) => a.section === 'main').map((a) => order[a.bucket]);
    expect(main).toEqual([...main].sort((x, y) => x - y));
  });
});
