import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { signalWords } from '../../packages/core/signal-words.ts';

describe('plain words for evidence signals', () => {
  it('turns rule names into words', () => {
    expect(signalWords('TRANSACTIONAL ×2')).toBe('2 service emails, such as receipts, alerts or confirmations');
    expect(signalWords('TRANSACTIONAL ×1')).toBe('1 service email, such as a receipt, alert or confirmation');
    expect(signalWords('WELCOME')).toBe('a welcome email');
    expect(signalWords('Nano: money')).toBe('one of your emails is about money');
    expect(signalWords('typical for this kind of service (name-only)')).toBe('typical for this kind of service (guessed from the name)');
  });
  it('leaves text that is already words alone', () => {
    expect(signalWords('listed as a shop (sample entry)')).toBe('listed as a shop (sample entry)');
  });
  it('covers every signal name the rules can fire', () => {
    const src = readFileSync(new URL('../../packages/core/rules/signals.ts', import.meta.url), 'utf8');
    const union = /export type SignalName =([^;]+);/.exec(src)![1];
    const names = [...union.matchAll(/'([^']+)'/g)].map((m) => m[1]);
    expect(names.length).toBeGreaterThan(10);
    for (const n of [...names, 'IDP-NOTICE', 'newsletters only', 'Nano: account', 'Nano: work', 'Nano: holds documents', 'Nano: can reset other accounts'])
      expect(signalWords(n), n).not.toBe(n);
  });
});
