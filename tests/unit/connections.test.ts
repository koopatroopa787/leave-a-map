import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { applyConnections } from '../../packages/core/connections.ts';
import { rank } from '../../packages/core/rank.ts';
import { splitAllMessages } from '../../packages/core/mbox/split.ts';
import { KEEP_BODY_BYTES, readBody } from '../../packages/core/mbox/body.ts';
import { makeLinkContext } from '../../packages/core/rules/school-link.ts';
import { Aggregator } from '../../packages/core/rules/aggregate.ts';
import { SAMPLE_SETTINGS } from '../../packages/core/sample.ts';

const accounts = (async () => {
  const agg = new Aggregator(makeLinkContext(SAMPLE_SETTINGS.schoolDomain, SAMPLE_SETTINGS.ownAddresses));
  const bytes = new Uint8Array(readFileSync(new URL('../../fixtures/sample.example.mbox', import.meta.url)));
  for (const m of splitAllMessages(bytes, 4096, KEEP_BODY_BYTES)) agg.add(m.rec, await readBody(m.raw));
  return agg.accountsOut();
})();

describe('school-login step (T19)', () => {
  it('a tick moves a service to rank 1 as Seen, "you confirmed"', async () => {
    const out = rank(applyConnections(await accounts, { ticked: ['notebloom.example', 'learnridge.example'], added: [] }));
    const sso = out.filter((a) => a.section === 'main' && a.bucket === 'sso').map((a) => a.key);
    expect(sso).toEqual(expect.arrayContaining(['forkyard.example', 'notebloom.example', 'learnridge.example']));
    const nb = out.find((a) => a.key === 'notebloom.example')!;
    expect(nb.sso).toMatchObject({ tier: 'seen', source: 'user' });
    expect(out.find((a) => a.key === 'learnridge.example')!.section).toBe('main'); // was maybe
  });
  it('a typed name with no email becomes its own rank 1 entry; a typed known name ticks that account', async () => {
    const out = rank(applyConnections(await accounts, { ticked: [], added: ['Pollpad', ' Citewell ', 'pollpad'] }));
    const pollpad = out.filter((a) => a.key === 'app:pollpad');
    expect(pollpad).toHaveLength(1);
    expect(pollpad[0]).toMatchObject({ section: 'main', bucket: 'sso', name: 'Pollpad' });
    expect(out.find((a) => a.key === 'citewell.example')!.bucket).toBe('sso');
    expect(out.some((a) => a.key === 'app:citewell')).toBe(false);
  });
  it('ignores ticks on fake-looking or school-run senders, and unticking restores the scan', async () => {
    const base = await accounts;
    const out = rank(applyConnections(base, { ticked: ['forkyard-verify.example', 'alderbrook.example'], added: [] }));
    expect(out.find((a) => a.key === 'forkyard-verify.example')!.section).toBe('ignored');
    expect(out.find((a) => a.key === 'alderbrook.example')!.section).toBe('ends-anyway');
    expect(rank(applyConnections(base, { ticked: [], added: [] }))).toEqual(rank(base));
  });
});
