import { describe, expect, it } from 'vitest';
import { dropQuoted, nameTokens, prepForPrompt, redact, trimTo } from '../../packages/core/prompt-prep.ts';

describe('prompt prep (T16)', () => {
  it('strips links, addresses, codes and long numbers, but keeps amounts and plain words', () => {
    expect(redact('Visit https://forkyard.example/x?a=1 or www.forkyard.example now')).toBe('Visit [link] or [link] now');
    expect(redact('Sent to jreyes@alderbrook.example.')).toBe('Sent to [address].');
    expect(redact('Your code is 48K2X9. Order A7-1193.')).toBe('Your code is [code]. Order [code].');
    expect(redact('Card 4242 4242 4242 4242, call 555-0134')).toBe('Card [number], call [number]');
    expect(redact('You paid $120.00 for 3 items in 2 days')).toBe('You paid $120.00 for 3 items in 2 days');
    expect(redact('Welcome to the project workspace')).toBe('Welcome to the project workspace');
  });

  it('replaces the person\'s own name tokens', () => {
    expect(nameTokens(['jane.reyes@alderbrook.example', 'jr2@x.example'])).toEqual(['jane', 'reyes']);
    expect(redact('Hi Jane, welcome. Reyesville is nice.', ['jane', 'reyes'])).toBe('Hi [you], welcome. Reyesville is nice.');
  });

  it('drops quoted replies and forwarded blocks', () => {
    expect(dropQuoted('Thanks!\nOn Mon, 3 Mar 2025 at 10:00, Sam <s@x.example> wrote:\n> old text')).toBe('Thanks!\n');
    expect(dropQuoted('Top\n> quoted\nBottom')).toBe('Top\nBottom');
    expect(dropQuoted('FYI\n---------- Forwarded message ---------\nFrom: a\nWelcome to X')).toBe('FYI\n');
    expect(dropQuoted('Note\n-----Original Message-----\nold')).toBe('Note\n');
  });

  it('trims to budget at a word boundary', () => {
    expect(trimTo('one two three four', 9)).toBe('one two …');
    expect(trimTo('short', 100)).toBe('short');
  });

  it('builds the prompt text within budget', () => {
    const out = prepForPrompt('Welcome, Jane!', `Your account jreyes@alderbrook.example is ready: https://x.example/a\n${'word '.repeat(500)}`,
      { ownAddresses: ['jane.reyes@alderbrook.example'] });
    expect(out.startsWith('Subject: Welcome, [you]!\nYour account [address] is ready: [link]\n')).toBe(true);
    expect(out.length).toBeLessThanOrEqual(1202);
    expect(out.endsWith('…')).toBe(true);
  });
});
