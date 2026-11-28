import { describe, expect, it } from 'vitest';
import { countdown, letterDate } from '../../apps/scan/src/dates.ts';

describe('countdown (T14)', () => {
  const now = Date.parse('2026-11-21T15:00:00');
  it('counts whole days to the shutoff date', () => {
    expect(countdown('2026-12-31', now)).toBe('in 40 days');
    expect(countdown('2026-11-22', now)).toBe('tomorrow');
    expect(countdown('2026-11-21', now)).toBe('today');
    expect(countdown('2026-11-19', now)).toBe('2 days ago');
    expect(countdown('2026-11-20', now)).toBe('1 day ago');
    expect(countdown('not a date', now)).toBe('');
  });
});

describe('letterDate', () => {
  const now = Date.parse('2026-11-28T12:00:00');
  it('writes the month in full', () => {
    expect(letterDate('2027-03-31', now)).toEqual({ date: '31 March 2027', past: false });
  });
  it('counts the shutoff day itself as not yet passed', () => {
    expect(letterDate('2026-11-28', now)?.past).toBe(false);
    expect(letterDate('2026-11-27', now)?.past).toBe(true);
  });
  it('gives nothing for a missing date', () => {
    expect(letterDate('', now)).toBeUndefined();
  });
});
