import { describe, expect, it } from 'vitest';
import { parseLabel } from '../../packages/core/contract.ts';
import { parseServiceInfo, toOutboxItem } from '../../packages/core/handoff.ts';

describe('handoff', () => {
  it('sends only id and sender domain', () => {
    expect(toOutboxItem('a1', ' Forkyard.Example ')).toEqual({ id: 'a1', senderDomain: 'forkyard.example' });
    expect(() => toOutboxItem('a1', 'https://evil.example/x')).toThrow();
  });

  it('keeps valid enum answers for sent ids and drops everything else', () => {
    const ok = { id: 'a1', source: 'in_cloud', basis: 'recognised', category: 'work', usuallyHolds: 'documents', loginEmailChange: 'account-settings' };
    const out = parseServiceInfo({ type: 'lam.services', items: [
      { ...ok, url: 'https://phish.example' },
      { ...ok, id: 'not-sent' },
      { ...ok, id: 'a2', category: 'banking' },
      { ...ok, id: 'a3', source: 'somewhere' },
      { ...ok }, // duplicate id
    ] }, new Set(['a1', 'a2', 'a3']));
    expect(out).toEqual([ok]);
    expect(parseServiceInfo({ type: 'other', items: [ok] }, new Set(['a1']))).toEqual([]);
  });
});

describe('parseLabel', () => {
  it('blanks a quote the model did not copy', () => {
    const raw = JSON.stringify({ isAccount: true, type: 'work', holds: 'documents', quote: 'invented' });
    expect(parseLabel(raw, 'Your project was saved')?.quote).toBe('');
    expect(parseLabel('{"isAccount":true,"type":"bank","holds":"payment","quote":""}', '')).toBeNull();
  });
});

describe('outbox (cloud side)', async () => {
  const { parseOutbox } = await import('../../packages/core/handoff.ts');
  it('accepts only { id, senderDomain } items', () => {
    expect(parseOutbox({ type: 'lam.outbox', items: [{ id: 'a1', senderDomain: 'forkyard.example' }] })).toEqual([{ id: 'a1', senderDomain: 'forkyard.example' }]);
    expect(parseOutbox({ type: 'lam.outbox', items: [{ id: 'a1', senderDomain: 'forkyard.example', subject: 'Welcome' }] })).toBeNull();
    expect(parseOutbox({ type: 'lam.outbox', items: [{ id: 'a1', senderDomain: 'https://x.example/a' }] })).toBeNull();
    expect(parseOutbox({ type: 'lam.outbox', items: [{ id: 'a1', senderDomain: 'a.example' }, { id: 'a1', senderDomain: 'b.example' }] })).toBeNull();
    expect(parseOutbox({ type: 'lam.outbox', items: [] })).toBeNull();
    expect(parseOutbox({ type: 'other', items: [{ id: 'a1', senderDomain: 'a.example' }] })).toBeNull();
  });
});
