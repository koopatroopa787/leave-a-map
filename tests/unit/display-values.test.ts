import { describe, expect, it } from 'vitest';
import { cleanDisplay, DEFAULT } from '../../apps/scan/src/display-values.ts';

describe('Display settings read back from storage', () => {
  it('keeps allowed values', () => {
    expect(cleanDisplay({ text: 'xl', theme: 'light', contrast: 'more', motion: 'off', spacing: 'wide' }))
      .toEqual({ text: 'xl', theme: 'light', contrast: 'more', motion: 'off', spacing: 'wide' });
  });
  it('replaces unknown values and drops unknown keys', () => {
    expect(cleanDisplay({ text: 'huge', theme: '"><script>', motion: 'on', extra: 1 })).toEqual({ ...DEFAULT, motion: 'on' });
  });
  it('falls back to the defaults for anything that is not an object', () => {
    for (const raw of [null, 'dark', 42, [], undefined]) expect(cleanDisplay(raw)).toEqual(DEFAULT);
  });
});
