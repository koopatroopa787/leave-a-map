import { describe, expect, it } from 'vitest';
import { sampleFailed, sampleLoaded, sampleWanted } from '../../apps/scan/src/stale-page.ts';

const memory = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), m };
};

describe('Try the sample on a page older than the site', () => {
  it('reloads once, then the fresh page runs the sample', () => {
    const s = memory(); let reloads = 0;
    expect(sampleWanted(s)).toBe(false); // a normal start-up runs nothing
    expect(sampleFailed(s, () => reloads++)).toBe('reloading');
    expect(reloads).toBe(1);
    expect(sampleWanted(s)).toBe(true); // the fresh page
    sampleLoaded(s);
    expect(s.m.size).toBe(0);
    expect(sampleWanted(s)).toBe(false);
  });
  it('gives up instead of looping when the fresh page fails too', () => {
    const s = memory(); let reloads = 0;
    sampleFailed(s, () => reloads++);
    expect(sampleWanted(s)).toBe(true);
    expect(sampleFailed(s, () => reloads++)).toBe('gave-up');
    expect(reloads).toBe(1);
    expect(s.m.size).toBe(0); // the next press can try a reload again
  });
  it('gives up straight away when storage is blocked', () => {
    let reloads = 0;
    const blocked = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); }, removeItem: () => { throw new Error('blocked'); } };
    expect(sampleFailed(blocked, () => reloads++)).toBe('gave-up');
    expect(sampleFailed(null, () => reloads++)).toBe('gave-up');
    expect(sampleWanted(blocked)).toBe(false);
    expect(reloads).toBe(0);
  });
});
