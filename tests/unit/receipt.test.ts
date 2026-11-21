import { describe, expect, it } from 'vitest';
import { buildReceipt, headline, receiptText } from '../../apps/scan/src/receipt.ts';
import type { EgressEvent } from '../../apps/scan/src/lockdown.ts';

const ev = (kind: EgressEvent['kind'], detail: string, domains?: string[]): EgressEvent => ({ at: '2026-11-21T18:00:00.000Z', kind, detail, ...(domains ? { domains } : {}) });

describe('privacy receipt (T26)', () => {
  it('pairs each handoff with its result and counts only approved domains', () => {
    const r = buildReceipt([
      ev('local', 'Read 55 emails in a Worker on this device'),
      ev('handoff', '3 shown', ['a.example', 'b.example', 'clinic.example']),
      ev('answers', 'You approved 2; 2 enum answers came back', ['a.example', 'b.example']),
      ev('blocked', 'createElement(iframe)'),
    ]);
    expect(r.handoffs).toEqual([{ at: expect.any(String), shown: ['a.example', 'b.example', 'clinic.example'], approved: ['a.example', 'b.example'], outcome: 'You approved 2; 2 enum answers came back' }]);
    expect(headline(r)).toBe('2 web addresses looked up with your approval, 0 other requests from this page');
    expect(r.blocked).toHaveLength(1);
  });
  it('lists a CSP-blocked load once, as blocked, not as a request', () => {
    const r = buildReceipt([ev('resource', 'https://tracker.example/p.gif'), ev('blocked', 'img-src https://tracker.example/p.gif')]);
    expect(r.outside).toHaveLength(0);
    expect(r.blocked).toHaveLength(1);
  });
  it('says so when nothing was looked up, and counts any outside request', () => {
    expect(headline(buildReceipt([]))).toBe('Nothing looked up in the cloud, 0 other requests from this page');
    const r = buildReceipt([ev('handoff', '1 shown', ['a.example']), ev('answers', 'Cancelled: nothing was looked up'), ev('resource', 'https://x.example/a.png')]);
    expect(headline(r)).toBe('Nothing looked up in the cloud, 1 other request from this page');
    expect(receiptText(r, 'T')).toContain('Requests from this page to other sites: 1');
    expect(receiptText(r, 'T')).toContain('Cancelled: nothing was looked up');
  });
});
