import { describe as group, expect, it } from 'vitest';
import type { Account, Cond } from '../../packages/core/types.ts';
import { applyLabel, applyServiceInfo, describe, isHonest, maxTier } from '../../packages/core/evidence.ts';
import { makeLinkContext } from '../../packages/core/rules/school-link.ts';
import { Aggregator } from '../../packages/core/rules/aggregate.ts';

const none = (): Cond => ({ tier: null, source: 'rules', signal: '' });
const account = (exists: Cond = { tier: 'likely', source: 'rules', signal: 'TRANSACTIONAL ×3' }): Account => ({
  key: 'forkyard.example', name: 'Forkyard', link: 'seen', exists, sso: none(), work: none(), reset: none(), money: none(),
  discount: none(), flags: { schoolRun: false, forwardedIn: null, suspiciousOnly: false, bulkOnly: false, suspiciousIgnored: 0, health: false },
  lastDate: 0, nMsgs: 3, nLinked: 3, nAll: 3,
});

group('tier caps', () => {
  it('never lets AI or the pack reach Seen', () => {
    for (const source of ['on_device', 'in_cloud'] as const) {
      expect(maxTier(source, { quote: true })).toBe('likely');
      expect(maxTier(source, { quote: false })).toBe('possible');
      expect(maxTier(source, { basis: 'recognised', exists: 'seen' })).toBe('likely');
      expect(maxTier(source, { basis: 'recognised', exists: 'possible' })).toBeNull();
      expect(maxTier(source, { basis: 'name-only', exists: 'seen' })).toBe('possible');
      expect(maxTier(source, { basis: 'unknown', exists: 'seen' })).toBeNull();
    }
    expect(maxTier('pack', { exists: 'likely' })).toBe('likely');
    expect(maxTier('pack', { exists: 'possible' })).toBeNull();
    expect(maxTier('user')).toBe('seen');
  });

  it('applies a Nano label at Likely with a quote, Possible without, and never lowers rules evidence', () => {
    const a = account();
    const withQuote = applyLabel(a, { isAccount: true, type: 'work', holds: 'documents', quote: 'your project was saved' }, { msgId: '4', date: Date.UTC(2025, 2, 3) });
    expect(withQuote.work).toMatchObject({ tier: 'likely', source: 'on_device', quote: 'your project was saved' });
    expect(withQuote.exists).toBe(a.exists); // rules already Likely; Nano doesn't replace it
    const noQuote = applyLabel(a, { isAccount: true, type: 'money', holds: 'payment', quote: '' }, { msgId: '5' });
    expect(noQuote.money).toMatchObject({ tier: 'possible', source: 'on_device' });
    const seenRules = { ...a, work: { tier: 'seen', source: 'rules', signal: 'WORK STRONG' } as Cond };
    expect(applyLabel(seenRules, { isAccount: true, type: 'work', holds: 'documents', quote: 'x' }, { msgId: '6' }).work.tier).toBe('seen');
    for (const c of [withQuote.work, noQuote.money]) expect(isHonest(c)).toBe(true);
  });

  it('caps lane 3 answers by basis and never creates existence', () => {
    const cloudAll = { basis: 'in_cloud', category: 'in_cloud', usuallyHolds: 'in_cloud', loginEmailChange: 'in_cloud' } as const;
    const info = { id: 'a1', sources: cloudAll, escalation: null, basis: 'recognised' as const, category: 'work' as const, usuallyHolds: 'documents' as const, loginEmailChange: 'account-settings' as const };
    expect(applyServiceInfo(account(), info).work).toMatchObject({ tier: 'likely', source: 'in_cloud' });
    expect(applyServiceInfo(account(), { ...info, basis: 'name-only' }).work.tier).toBe('possible');
    const weak = account({ tier: 'possible', source: 'rules', signal: 'TRANSACTIONAL ×1' });
    expect(applyServiceInfo(weak, info)).toBe(weak);
    expect(applyServiceInfo(account(), info).exists.source).toBe('rules');
  });
});

group('evidence from the rules', () => {
  it('carries an exact quote and the message date', () => {
    const ME = 'jreyes@alderbrook.example';
    const agg = new Aggregator(makeLinkContext('alderbrook.example', [ME]));
    const date = Date.UTC(2025, 4, 6);
    agg.add({ index: 0, start: 0, bodyStart: 0, end: 0, from: { name: 'Forkyard', address: 'a@forkyard.example' }, to: [ME], cc: [],
      deliveredTo: [ME], xOriginalTo: [], xForwardedFor: [], returnPath: null, resentFrom: [], listId: null,
      subject: 'Welcome to Forkyard', date, bulk: false, listUnsubscribe: false, authResults: null, arcResults: null });
    const [a] = agg.accountsOut();
    expect(a.exists).toMatchObject({ tier: 'likely', signal: 'WELCOME', quote: 'Welcome to Forkyard', date, msgId: '0' });
    expect(describe(a.exists)).toBe('Likely · rules · 2025-05-06 · “Welcome to Forkyard”');
  });
});
