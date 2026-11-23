import { describe, expect, it } from 'vitest';
import { blockedBy, busyWords, canSend, cloudTier, FREE_TIER_MAX, isQuotaError, LookupBusy, lookupEach } from '../../packages/core/cloud-tier.ts';

describe('cloud tier switch', () => {
  it('reads the two switch values and is off otherwise in production', () => {
    expect(cloudTier('paid-tier-on', false)).toBe('paid');
    expect(cloudTier('free-tier-on', false)).toBe('free');
    for (const v of [undefined, '', 'on', 'true', 'PAID-TIER-ON', 'free']) expect(cloudTier(v, false)).toBe('off');
  });
  it('is always on in development, following the switch when it is set', () => {
    expect(cloudTier(undefined, true)).toBe('paid');
    expect(cloudTier('free-tier-on', true)).toBe('free');
  });
});

describe('what each tier may send', () => {
  const plain = { id: 'a', senderDomain: 'quillpad.example' };
  const health = { id: 'b', senderDomain: 'clinic.example', sensitive: 'health' as const };
  const money = { id: 'c', senderDomain: 'penny.example', sensitive: 'money' as const };
  it('paid sends every row; free never sends health or money; off sends nothing', () => {
    expect([plain, health, money].map((i) => canSend('paid', i))).toEqual([true, true, true]);
    expect([plain, health, money].map((i) => canSend('free', i))).toEqual([true, false, false]);
    expect([plain, health, money].map((i) => canSend('off', i))).toEqual([false, false, false]);
  });
});

describe('the send button', () => {
  const ok = { adult: true, region: true, ticked: 1 };
  it('needs the 18+ box and one tick on both tiers', () => {
    for (const t of ['paid', 'free'] as const) {
      expect(blockedBy(t, ok)).toBeNull();
      expect(blockedBy(t, { ...ok, adult: false })).toBe('adult');
      expect(blockedBy(t, { ...ok, ticked: 0 })).toBe('none-ticked');
    }
  });
  it('needs the region box only on the free tier', () => {
    expect(blockedBy('free', { ...ok, region: false })).toBe('region');
    expect(blockedBy('paid', { ...ok, region: false })).toBeNull();
  });
  it('caps a free lookup, not a paid one', () => {
    expect(blockedBy('free', { ...ok, ticked: FREE_TIER_MAX })).toBeNull();
    expect(blockedBy('free', { ...ok, ticked: FREE_TIER_MAX + 1 })).toBe('too-many');
    expect(blockedBy('paid', { ...ok, ticked: 40 })).toBeNull();
  });
  it('never sends while off', () => {
    expect(blockedBy('off', ok)).toBe('off');
  });
});

describe('running out of quota', () => {
  const quota = Object.assign(new Error('Error fetching from https://x: [429 ] Resource exhausted'), { customErrorData: { status: 429 } });
  it('recognises a 429 from the SDK, by status or by message', () => {
    expect(isQuotaError(quota)).toBe(true);
    expect(isQuotaError(new Error('[429 Too Many Requests] RESOURCE_EXHAUSTED'))).toBe(true);
    expect(isQuotaError(new Error('[403 ] App attestation failed'))).toBe(false);
    expect(isQuotaError(new Error('reply was not JSON'))).toBe(false);
    expect(isQuotaError(null)).toBe(false);
  });
  it('stops at the first 429 and keeps the answers already got', async () => {
    const seen: string[] = [];
    const one = async (d: string) => { seen.push(d); if (d === 'c') throw quota; return d.toUpperCase(); };
    const err = await lookupEach(['a', 'b', 'c', 'd'], one).catch((e) => e);
    expect(err).toBeInstanceOf(LookupBusy);
    expect((err as LookupBusy<string>).partial).toEqual(['A', 'B']);
    expect(seen).toEqual(['a', 'b', 'c']); // never asks for d
  });
  it('passes other errors through and reports progress', async () => {
    await expect(lookupEach(['a'], async () => { throw new Error('not-configured'); })).rejects.toThrow('not-configured');
    const done: number[] = [];
    expect(await lookupEach(['a', 'b'], async (d) => d, (n) => done.push(n))).toEqual(['a', 'b']);
    expect(done).toEqual([1, 2]);
  });
  it('says plainly what happened', () => {
    expect(busyWords(0, 5)).toMatch(/busy right now.*Nothing was looked up or sent back\.$/);
    expect(busyWords(2, 5)).toMatch(/2 of 5 services were looked up first, and only those answers were sent back\.$/);
    expect(busyWords(0, 5)).not.toMatch(/\d{3}|quota|429/);
  });
});
