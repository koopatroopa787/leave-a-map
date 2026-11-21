import { describe, expect, it } from 'vitest';
import { answersByKey, serviceLines, trail } from '../../packages/core/lane3.ts';
import type { ServiceInfo } from '../../packages/core/handoff.ts';

const info = (over: Partial<ServiceInfo> = {}): ServiceInfo => ({
  id: 's1', basis: 'recognised', category: 'work', usuallyHolds: 'documents', loginEmailChange: 'account-settings',
  sources: { basis: 'on_device', category: 'on_device', usuallyHolds: 'in_cloud', loginEmailChange: 'on_device' }, escalation: 'field-unknown', ...over,
});

describe('lane 3 on the card (T24)', () => {
  it('gives each field its own source and never says "your account holds"', () => {
    const lines = serviceLines(info());
    expect(lines.map((l) => [l.label, l.source])).toEqual([
      ['Kind of service', 'on_device'], ['Usually holds', 'in_cloud'], ['Where to change the login email', 'on_device'],
    ]);
    expect(lines[2].value).toContain('suggested, not checked');
    expect(lines.map((l) => l.value).join(' ')).not.toMatch(/your account/i);
  });
  it('shows no guesses when the answer is "not recognised"', () => {
    expect(serviceLines(info({ basis: 'unknown' }))).toEqual([]);
    expect(serviceLines(info({ basis: 'name-only' }))).toHaveLength(3);
  });
  it('leaves out blank answers', () => {
    expect(serviceLines(info({ category: 'other', usuallyHolds: 'nothing-seen', loginEmailChange: 'unknown' }))).toEqual([]);
  });
  it('explains the cascade', () => {
    expect(trail(info())).toBe('On-device: left a field blank → asked the cloud');
    const cloudOnly = { basis: 'in_cloud', category: 'in_cloud', usuallyHolds: 'in_cloud', loginEmailChange: 'in_cloud' } as const;
    expect(trail(info({ escalation: null, sources: cloudOnly }))).toMatch(/not available.*cloud/);
    const devOnly = { basis: 'on_device', category: 'on_device', usuallyHolds: 'on_device', loginEmailChange: 'on_device' } as const;
    expect(trail(info({ escalation: null, sources: devOnly }))).toBe('Answered on-device');
  });
  it('maps answers back to accounts only for ids that were sent', () => {
    const m = answersByKey([info(), info({ id: 'zz' })], new Map([['s1', 'citewell.example']]));
    expect([...m.keys()]).toEqual(['citewell.example']);
  });
});
