import { describe, expect, it } from 'vitest';
import { breachesFor, breachLine, hadPasswords, type BreachFile } from '../../packages/core/breaches.ts';

const file: BreachFile = { taken: '2026-11-28', source: 'test', byDomain: {
  'canva.com': [{ title: 'Canva', date: '2019-05-24', count: 1, data: ['Email addresses', 'Names', 'Passwords'] }],
  'hints.com': [{ title: 'Hints', date: '2013-10-04', count: 1, data: ['Email addresses', 'Password hints'] }],
} };

describe('known data breaches', () => {
  it('matches by domain and says it in words', () => {
    expect(breachesFor(file, 'canva.com').map(breachLine)).toEqual(['Canva, May 2019: email addresses, names and passwords']);
    expect(breachesFor(file, 'example.org')).toEqual([]);
    expect(breachesFor(null, 'canva.com')).toEqual([]);
  });
  it('only the samples get made-up breaches, and they are marked', () => {
    expect(breachesFor(file, 'sketchloom.example')[0].sample).toBe(true);
    expect(breachesFor(file, 'forkyard.example')).toEqual([]);
  });
  it('a password hint is not a password', () => {
    expect(hadPasswords(breachesFor(file, 'canva.com'))).toBe(true);
    expect(hadPasswords(breachesFor(file, 'hints.com'))).toBe(false);
  });
});
