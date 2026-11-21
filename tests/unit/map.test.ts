import { describe, expect, it } from 'vitest';
import { countdown } from '../../apps/scan/src/dates.ts';

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
