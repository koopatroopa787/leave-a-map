import { describe, expect, it } from 'vitest';
import { loadNotes, NOTE_MAX, saveNotes } from '../../apps/scan/src/checklist.ts';
import { blanks } from '../../apps/scan/src/nano.ts';

const mem = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) }; };

describe('notes per account', () => {
  it('round-trips and keeps lists apart', () => {
    const s = mem();
    expect(saveNotes('loss.a@x.example', { 'bank.example': 'rang 3 Dec, ref 88120' }, s)).toBe(true);
    expect(loadNotes('loss.a@x.example', s)).toEqual({ 'bank.example': 'rang 3 Dec, ref 88120' });
    expect(loadNotes('uni.example', s)).toEqual({});
  });
  it('drops anything that is not text and caps the length', () => {
    const s = mem();
    s.setItem('lam.notes.l', JSON.stringify({ a: 5, b: '', c: 'x'.repeat(NOTE_MAX + 10) }));
    expect(loadNotes('l', s)).toEqual({ c: 'x'.repeat(NOTE_MAX) });
    s.setItem('lam.notes.l', '[1,2]');
    expect(loadNotes('l', s)).toEqual({});
  });
  it('works with no storage', () => {
    expect(loadNotes('l', null)).toEqual({});
    expect(saveNotes('l', {}, null)).toBe(false);
  });
});

describe('blanks in a draft', () => {
  it('finds each [blank] once', () => {
    expect(blanks('Dear team, [their full name] died on [date of death]. [their full name]')).toEqual(['[their full name]', '[date of death]']);
  });
});
