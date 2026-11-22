import { describe, expect, it } from 'vitest';
import { blockedBy, canSend, cloudTier, FREE_TIER_MAX } from '../../packages/core/cloud-tier.ts';

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
