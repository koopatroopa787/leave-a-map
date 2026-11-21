import { describe, expect, it } from 'vitest';
import { outboxFor } from '../../packages/core/outbox.ts';
import type { RankedAccount } from '../../packages/core/types.ts';

const none = { tier: null, source: 'rules', signal: '' } as const;
const acct = (key: string, extra: Partial<RankedAccount> = {}): RankedAccount => ({
  key, name: key, link: 'seen', exists: { ...none, tier: 'seen' }, sso: none, work: none, reset: none, money: none, discount: none,
  flags: { schoolRun: false, forwardedIn: null, suspiciousOnly: false, bulkOnly: false, suspiciousIgnored: 0, health: false },
  lastDate: 0, nMsgs: 1, nLinked: 1, nAll: 1, section: 'main', bucket: 'rest', primaryTier: 'seen', alsoCount: 0, ...extra,
} as RankedAccount);

describe('outboxFor (T22)', () => {
  it('offers only unplaced main-list domains, marks health and money, and maps ids back', () => {
    const out = outboxFor([
      acct('forkyard.example', { bucket: 'work' }),
      acct('quillpad.example'),
      acct('app:sketchpad'),
      acct('clinic.example', { flags: { ...acct('x').flags, health: true } }),
      acct('penny.example', { money: { tier: 'possible', source: 'rules', signal: 'receipt' } }),
      acct('elsewhere.example', { section: 'elsewhere' }),
      acct('known.example'),
    ], (d) => d === 'known.example');
    expect(out.items).toEqual([
      { id: 's1', senderDomain: 'quillpad.example' },
      { id: 's2', senderDomain: 'clinic.example', sensitive: 'health' },
      { id: 's3', senderDomain: 'penny.example', sensitive: 'money' },
    ]);
    expect(out.keyById.get('s2')).toBe('clinic.example');
  });
  it('stops at 40', () => {
    expect(outboxFor(Array.from({ length: 60 }, (_, i) => acct(`svc${i}.example`))).items).toHaveLength(40);
  });
});
