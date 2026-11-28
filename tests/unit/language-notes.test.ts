import { describe, expect, it } from 'vitest';
import { NOTES, noteWords } from '../../apps/scan/src/language-notes.ts';

// translate.ts touches localStorage only when called, so importing the list is safe here.
const { LANGUAGES } = await import('../../apps/scan/src/translate.ts');
const KEYS = ['about', 'privacy', 'working', 'done', 'unsupported', 'unavailable', 'failed', 'ok'] as const;

describe('language notes', () => {
  it('has a complete note for every language in the picker', () => {
    for (const [code] of LANGUAGES) {
      const n = NOTES[code];
      expect(n, code).toBeDefined();
      for (const k of KEYS) expect(n[k].trim().length, `${code}.${k}`).toBeGreaterThan(0);
    }
  });
  it('is written in the language, not left in English', () => {
    for (const [code] of LANGUAGES) {
      if (code === 'en') continue;
      for (const k of KEYS) if (k !== 'ok') expect(NOTES[code][k], `${code}.${k}`).not.toBe(NOTES.en[k]);
    }
  });
  it('keeps the product name as it is', () => {
    for (const [code] of LANGUAGES) expect(NOTES[code].about, code).toContain('Leave a Map');
  });
  it('falls back to English', () => {
    expect(noteWords('xx')).toBe(NOTES.en);
  });
});
