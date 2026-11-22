// T11: the ranking order from analyst.md 2.4, one sort key at a time.
import { describe, expect, it } from 'vitest';
import { classify, rank } from '../../packages/core/rank.ts';
import type { Account, Cond, Tier } from '../../packages/core/types.ts';

const c = (tier: Tier): Cond => ({ tier, source: 'rules', signal: '' });
const acct = (key: string, o: Partial<Omit<Account, 'flags'>> & { flags?: Partial<Account['flags']> } = {}): Account => ({
  key, name: key, link: 'seen', exists: c('seen'), sso: c(null), work: c(null), reset: c(null), money: c(null), discount: c(null),
  lastDate: 0, nMsgs: 1, nLinked: 1, nAll: 1, ...o,
  flags: { schoolRun: false, forwardedIn: null, suspiciousOnly: false, bulkOnly: false, suspiciousIgnored: 0, health: false, ...o.flags },
} as Account);
const keys = (as: Account[]) => rank(as).map((a) => a.key);

describe('sections (analyst.md 2.4 steps 1–5)', () => {
  it('checks looks-fake, then school-run, then forwarded, then the school link, then existence', () => {
    expect(classify(acct('a', { flags: { suspiciousOnly: true, schoolRun: true } }))?.section).toBe('ignored');
    expect(classify(acct('a', { flags: { schoolRun: true, forwardedIn: 'x@y.example' } }))?.section).toBe('ends-anyway');
    expect(classify(acct('a', { flags: { forwardedIn: 'x@y.example' } }))?.section).toBe('elsewhere');
    expect(classify(acct('a', { link: null }))).toBeNull();
    expect(classify(acct('a', { exists: c('possible') }))?.section).toBe('maybe');
    expect(classify(acct('a'))?.section).toBe('main');
  });
  it('puts an account in the first bucket that is Likely or Seen, and counts the others', () => {
    const a = classify(acct('a', { sso: c('possible'), work: c('likely'), money: c('seen') }))!;
    expect([a.bucket, a.primaryTier, a.alsoCount]).toEqual(['work', 'likely', 1]);
    expect(classify(acct('b', { exists: c('likely') }))).toMatchObject({ bucket: 'rest', primaryTier: 'likely', alsoCount: 0 });
  });
});

describe('main list order (analyst.md 2.4)', () => {
  it('1. bucket order', () => {
    expect(keys([acct('rest'), acct('money', { money: c('seen') }), acct('reset', { reset: c('seen') }),
      acct('work', { work: c('seen') }), acct('sso', { sso: c('seen') })])).toEqual(['sso', 'work', 'reset', 'money', 'rest']);
  });
  it('2. within a bucket, Seen before Likely', () => {
    expect(keys([acct('l', { work: c('likely') }), acct('s', { work: c('seen') })])).toEqual(['s', 'l']);
  });
  it('3. then stronger existence', () => {
    expect(keys([acct('l', { exists: c('likely'), work: c('seen') }), acct('s', { work: c('seen') })])).toEqual(['s', 'l']);
  });
  it('4. then more other conditions', () => {
    expect(keys([acct('one', { work: c('seen') }), acct('two', { work: c('seen'), money: c('likely') })])).toEqual(['two', 'one']);
  });
  it('5. then the newest email', () => {
    expect(keys([acct('old', { lastDate: 1 }), acct('new', { lastDate: 2 })])).toEqual(['new', 'old']);
  });
  it('6. then more emails', () => {
    expect(keys([acct('few', { nMsgs: 1 }), acct('many', { nMsgs: 5 })])).toEqual(['many', 'few']);
  });
  it('7. then name, A to Z, so the order is the same every time', () => {
    expect(keys([acct('b.example', { name: 'Beta' }), acct('a.example', { name: 'Alpha' })])).toEqual(['a.example', 'b.example']);
  });
});

describe('other sections', () => {
  it('lists main, maybe (most emails first), ends anyway, elsewhere, then looks fake', () => {
    const out = keys([
      acct('fake', { flags: { suspiciousOnly: true } }), acct('fwd', { flags: { forwardedIn: 'x@y.example' } }),
      acct('school', { flags: { schoolRun: true } }), acct('m1', { exists: c('possible'), nMsgs: 1 }),
      acct('m3', { exists: c('possible'), nMsgs: 3 }), acct('main'),
    ]);
    expect(out).toEqual(['main', 'm3', 'm1', 'school', 'fwd', 'fake']);
  });
  it('the student-discount tag never changes the order', () => {
    const plain = [acct('a', { work: c('seen'), lastDate: 1 }), acct('b', { work: c('seen'), lastDate: 2 })];
    const tagged = [acct('a', { work: c('seen'), lastDate: 1, discount: c('seen') }), plain[1]];
    expect(keys(tagged)).toEqual(keys(plain));
  });
});
