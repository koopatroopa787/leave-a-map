import { describe, expect, it } from 'vitest';
import { splitAll } from '../../packages/core/mbox/split.ts';

const enc = (s: string) => new TextEncoder().encode(s);

// Takeout-style: LF endings, numeric sender on the separator line, mboxrd ">From " escape.
const TAKEOUT = [
  'From 1781234567890123456@xxx Sat Nov 21 10:00:00 +0000 2026',
  'X-GM-THRID: 1781234567890123456',
  'Delivered-To: jreyes@alderbrook.example',
  'From: "Forkyard" <no-reply@mail.forkyard.example>',
  'To: jreyes@alderbrook.example',
  'Subject: =?UTF-8?B?V2VsY29tZSB0byBGb3JreWFyZCDinKg=?=',
  'Date: Sat, 21 Nov 2026 10:00:00 +0000 (UTC)',
  '',
  'Hello,',
  '>From now on you can sign in.',
  'From the team at Forkyard',
  '',
  'From 1781234567890123457@xxx Sun Nov 22 11:30:00 +0000 2026',
  'Delivered-To: jreyes@alderbrook.example',
  'From: Pagewell <news@pagewell.example>',
  'To: undisclosed-recipients:;',
  'List-Unsubscribe: <mailto:u@pagewell.example>',
  'Subject: This week',
  ' on Pagewell',
  'Date: Sun, 22 Nov 2026 11:30:00 +0000',
  '',
  'News.',
  '',
].join('\n');

// Apple-Mail-style: CRLF endings and an email address on the separator line.
const APPLE = [
  'From sender@quillbase.example Tue Mar  1 12:00:00 2016',
  'From: Quillbase <hello@quillbase.example>',
  'To: J Reyes <jreyes@alderbrook.example>, other@friend.example',
  'Subject: Verify your email',
  'Date: Tue, 1 Mar 2016 12:00:00 -0500',
  '',
  'Body line',
  'From sender@quillbase.example Wed Mar  2 08:05:00 2016',
  'From: Quillbase <hello@quillbase.example>',
  'Subject: No body here',
  '',
].join('\r\n');

describe('MboxSplitter', () => {
  it('splits a Takeout-style file and keeps >From and plain "From the" lines in the body', () => {
    const bytes = enc(TAKEOUT);
    const msgs = splitAll(bytes);
    expect(msgs).toHaveLength(2);
    const [a, b] = msgs;
    expect(a.from).toEqual({ name: 'Forkyard', address: 'no-reply@mail.forkyard.example' });
    expect(a.subject).toBe('Welcome to Forkyard ✨');
    expect(a.deliveredTo).toEqual(['jreyes@alderbrook.example']);
    expect(a.date).toBe(Date.UTC(2026, 10, 21, 10, 0, 0));
    expect(a.bulk).toBe(false);
    expect(b.subject).toBe('This week on Pagewell');
    expect(b.bulk).toBe(true);
    expect(b.to).toEqual([]);
    const text = new TextDecoder().decode(bytes);
    expect(text.slice(a.start, a.start + 5)).toBe('From ');
    expect(text.slice(b.start, b.start + 5)).toBe('From ');
    expect(a.end).toBe(b.start);
    expect(b.end).toBe(bytes.length);
    expect(text.slice(a.bodyStart, a.end)).toContain('>From now on');
    expect(text.slice(a.bodyStart, a.end)).toContain('From the team');
  });

  it('gives identical results whatever the chunk size', () => {
    const bytes = enc(TAKEOUT + APPLE.replace(/^From sender/, 'From sender'));
    const whole = splitAll(bytes);
    for (const size of [1, 2, 7, 64, 1000]) expect(splitAll(bytes, size)).toEqual(whole);
  });

  it('splits an Apple-Mail-style CRLF file', () => {
    const msgs = splitAll(enc(APPLE), 5);
    expect(msgs).toHaveLength(2);
    expect(msgs[0].to).toEqual(['jreyes@alderbrook.example', 'other@friend.example']);
    expect(msgs[0].subject).toBe('Verify your email');
    expect(msgs[1].subject).toBe('No body here');
    expect(msgs[1].bodyStart).toBe(msgs[1].end);
  });

  it('accepts a Thunderbird-style separator and reports leading junk', () => {
    const msgs = splitAll(enc('junk line\nFrom - Sat Nov 21 10:00:00 2026\nFrom: a@b.example\n\nx\n'));
    expect(msgs).toHaveLength(1);
    expect(msgs[0].from?.address).toBe('a@b.example');
  });

  it('returns nothing for a file with no separators', () => {
    expect(splitAll(enc('Subject: hi\n\nnot an mbox\n'))).toEqual([]);
  });
});
