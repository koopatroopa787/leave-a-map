import { describe, expect, it } from 'vitest';
import { mboxEntry } from '../../apps/scan/src/gmail-source.ts';
import { splitAllMessages } from '../../packages/core/mbox/split.ts';
import { KEEP_BODY_BYTES } from '../../packages/core/mbox/body.ts';

const raw = 'Delivered-To: a@uni.example\r\nFrom: Shop <hi@shop.example>\r\nDate: Tue, 3 Mar 2026 10:00:00 +0000\r\nSubject: Welcome\r\n\r\nHi\r\nFrom here on, thanks.\r\n';

describe('Gmail originals as an mbox', () => {
  it('dates the separator from the Date header and escapes "From " lines', () => {
    const e = mboxEntry(raw);
    expect(e.startsWith('From gmail-reader Tue Mar 03 10:00:00 2026\n')).toBe(true);
    expect(e).toContain('\n>From here on, thanks.');
    expect(e).not.toContain('\r');
  });
  it('splits back into the same messages', () => {
    const bytes = new TextEncoder().encode(mboxEntry(raw) + mboxEntry(raw.replace('Welcome', 'Receipt')));
    const msgs = [...splitAllMessages(bytes, 4096, KEEP_BODY_BYTES)];
    expect(msgs.map((m) => m.rec.subject)).toEqual(['Welcome', 'Receipt']);
    expect(msgs[0].rec.from?.address).toBe('hi@shop.example');
  });
});
