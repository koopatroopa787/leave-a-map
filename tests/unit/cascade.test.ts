import { describe, expect, it } from 'vitest';
import { escalationReason, mergeAnswers, type Answer } from '../../packages/core/cascade.ts';
import type { ServiceFields } from '../../packages/core/contract.ts';

const good: ServiceFields = { basis: 'recognised', category: 'work', usuallyHolds: 'documents', loginEmailChange: 'account-settings' };
const dev = (fields: ServiceFields | null): Answer => ({ fields, source: 'on_device' });
const cloud = (fields: ServiceFields | null): Answer => ({ fields, source: 'in_cloud' });

describe('escalation rule (T21)', () => {
  it('keeps a confident device answer', () => {
    expect(escalationReason(dev(good))).toBeNull();
  });
  it('fires each rule in order', () => {
    expect(escalationReason(dev(null))).toBe('invalid');
    expect(escalationReason(dev({ ...good, basis: 'name-only' }))).toBe('not-recognised');
    expect(escalationReason(dev({ ...good, category: 'other' }))).toBe('category-other');
    expect(escalationReason(dev({ ...good, usuallyHolds: 'nothing-seen' }))).toBe('field-unknown');
    expect(escalationReason(dev({ ...good, loginEmailChange: 'unknown' }))).toBe('field-unknown');
  });
  it('field-unknown fills only the blank field from the cloud', () => {
    const m = mergeAnswers(dev({ ...good, usuallyHolds: 'nothing-seen' }), cloud({ ...good, category: 'money', usuallyHolds: 'payment' }), 'field-unknown');
    expect(m.fields).toEqual({ ...good, usuallyHolds: 'payment' });
    expect(m.sources).toEqual({ basis: 'on_device', category: 'on_device', usuallyHolds: 'in_cloud', loginEmailChange: 'on_device' });
  });
  it('never re-asks when the first answer already came from the cloud', () => {
    expect(escalationReason(cloud(null))).toBeNull();
    expect(escalationReason(cloud({ ...good, basis: 'unknown' }))).toBeNull();
  });
});

describe('per-field merge (T21)', () => {
  it('without a second answer, every field keeps the first source', () => {
    const m = mergeAnswers(dev(good), null, null);
    expect(m.fields).toEqual(good);
    expect(Object.values(m.sources)).toEqual(['on_device', 'on_device', 'on_device', 'on_device']);
  });
  it('takes everything from the cloud when the device reply was invalid', () => {
    const m = mergeAnswers(dev(null), cloud(good), 'invalid');
    expect(m.fields).toEqual(good);
    expect(m.sources.category).toBe('in_cloud');
    expect(m.escalation).toBe('invalid');
  });
  it('mixes sources: device keeps what it knew, cloud fills what it did not', () => {
    const device = { basis: 'name-only', category: 'work', usuallyHolds: 'documents', loginEmailChange: 'unknown' } as const;
    const fromCloud = { basis: 'recognised', category: 'work', usuallyHolds: 'nothing-seen', loginEmailChange: 'security-settings' } as const;
    const m = mergeAnswers(dev(device), cloud(fromCloud), 'not-recognised');
    expect(m.fields).toEqual({ basis: 'recognised', category: 'work', usuallyHolds: 'documents', loginEmailChange: 'security-settings' });
    expect(m.sources).toEqual({ basis: 'in_cloud', category: 'in_cloud', usuallyHolds: 'on_device', loginEmailChange: 'in_cloud' });
  });
  it('keeps the device category when the cloud is no surer', () => {
    const device = { ...good, basis: 'name-only' } as const;
    const m = mergeAnswers(dev(device), cloud({ ...good, basis: 'name-only', category: 'money' }), 'not-recognised');
    expect(m.fields.category).toBe('work');
    expect(m.sources.category).toBe('on_device');
  });
  it('a failed cloud reply leaves the device answer whole', () => {
    const m = mergeAnswers(dev({ ...good, category: 'other' }), cloud(null), 'category-other');
    expect(m.fields.category).toBe('other');
    expect(m.sources.category).toBe('on_device');
    expect(m.escalation).toBe('category-other');
  });
});
