import { describe, expect, it } from 'vitest';
import { messageFromSlice, splitAllMessages } from '../../packages/core/mbox/split.ts';
import { htmlToText, readBody } from '../../packages/core/mbox/body.ts';

const enc = (s: string) => new TextEncoder().encode(s);

// Thunderbird-style: "From - " separators, Mozilla headers, multipart with base64 HTML only.
const html = '<html><head><style>p{color:red}</style></head><body><p>Welcome&nbsp;to <b>Quillbase</b>!</p>' +
  '<script type="application/ld+json">{"@type": "Order"}</script></body></html>';
const THUNDERBIRD = [
  'From - Sat Nov 21 10:00:00 2026',
  'X-Mozilla-Status: 0001',
  'X-Mozilla-Status2: 00000000',
  'From: Quillbase <hello@quillbase.example>',
  'To: jreyes@alderbrook.example',
  'Subject: Your order',
  'MIME-Version: 1.0',
  'Content-Type: multipart/alternative; boundary="b1"',
  '',
  '--b1',
  'Content-Type: text/html; charset=utf-8',
  'Content-Transfer-Encoding: base64',
  '',
  Buffer.from(html).toString('base64'),
  '--b1--',
  '',
  'From - Sun Nov 22 10:00:00 2026',
  'From: Forkyard <no-reply@forkyard.example>',
  'Subject: Plain',
  'Content-Type: text/plain; charset=utf-8',
  '',
  'Line one',
  '>From the archive',
  '>>From nested',
  '',
].join('\n');

describe('bodies (T09)', () => {
  it('reads a base64 HTML-only body as text and spots order markup', async () => {
    const [m] = splitAllMessages(enc(THUNDERBIRD), 13, 64 * 1024);
    const body = await readBody(m.raw);
    expect(body.text).toBe('Welcome to Quillbase !');
    expect(body.orderMarkup).toBe(true);
  });

  it('unescapes >From lines in kept bodies and in slices read later by offset', async () => {
    const bytes = enc(THUNDERBIRD);
    const msgs = splitAllMessages(bytes, 7, 64 * 1024);
    expect(msgs).toHaveLength(2);
    expect((await readBody(msgs[1].raw)).text).toBe('Line one\nFrom the archive\n>From nested');
    const { start, end } = msgs[1].rec;
    const again = messageFromSlice(bytes.subarray(start, end));
    expect((await readBody(again)).text).toBe('Line one\nFrom the archive\n>From nested');
  });

  it('caps the kept body and flags truncation, without losing the next message', async () => {
    const big = 'x'.repeat(100) + '\n';
    const mbox = ['From a@b.example Sat Nov 21 10:00:00 2026', 'From: a@b.example', 'Subject: big', '', big.repeat(50),
      'From c@d.example Sat Nov 21 11:00:00 2026', 'From: c@d.example', 'Subject: next', '', 'hi', ''].join('\n');
    const msgs = splitAllMessages(enc(mbox), 64, 1000);
    expect(msgs).toHaveLength(2);
    expect(msgs[0].truncated).toBe(true);
    expect(msgs[0].raw!.length).toBeLessThan(1300);
    expect(msgs[1].rec.subject).toBe('next');
    expect((await readBody(msgs[1].raw)).text).toBe('hi');
  });

  it('keeps no body bytes unless asked', () => {
    expect(splitAllMessages(enc(THUNDERBIRD))[0].raw).toBeNull();
  });

  it('never throws on junk', async () => {
    expect(await readBody(enc('\u0000\u0001 not mail'))).toEqual(expect.objectContaining({ orderMarkup: false }));
    expect(await readBody(null)).toEqual({ text: '', orderMarkup: false });
  });

  it('turns HTML into text', () => {
    expect(htmlToText('a<br>b&amp;c&#39;d&#x41;<style>x</style>')).toBe('a\nb&c\'dA ');
  });
});
