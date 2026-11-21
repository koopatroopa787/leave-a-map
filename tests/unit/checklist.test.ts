import { describe, expect, it } from 'vitest';
import { loadMoved, saveMoved } from '../../apps/scan/src/checklist.ts';

const memory = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); } }; };

describe('checklist storage (T15)', () => {
  it('round-trips per school domain', () => {
    const s = memory();
    expect(saveMoved('Alderbrook.example', new Set(['forkyard.example', 'app:sketchpadpro']), s)).toBe(true);
    expect([...loadMoved('alderbrook.example', s)]).toEqual(['forkyard.example', 'app:sketchpadpro']);
    expect(loadMoved('other.example', s).size).toBe(0);
  });
  it('survives blocked or corrupt storage', () => {
    const throwing = { getItem: () => { throw new Error('SecurityError'); }, setItem: () => { throw new Error('QuotaExceeded'); } };
    expect(loadMoved('a.example', throwing).size).toBe(0);
    expect(saveMoved('a.example', new Set(['x']), throwing)).toBe(false);
    expect(saveMoved('a.example', new Set(['x']), null)).toBe(false);
    const corrupt = { getItem: () => '{not json', setItem: () => {} };
    expect(loadMoved('a.example', corrupt).size).toBe(0);
    const wrongShape = { getItem: () => '[1, "ok", null]', setItem: () => {} };
    expect([...loadMoved('a.example', wrongShape)]).toEqual(['ok']);
  });
});
