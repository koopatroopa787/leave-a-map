// apps/scan/src/dates.ts: date wording for the map. Pure, so it's easy to test.
const DAY = 86_400_000;

export function countdown(shutoffIso: string, now = Date.now()): string {
  const shutoff = Date.parse(`${shutoffIso}T00:00:00`);
  if (!Number.isFinite(shutoff)) return '';
  const days = Math.ceil((shutoff - now) / DAY);
  if (days > 1) return `in ${days} days`;
  if (days === 1) return 'tomorrow';
  if (days === 0) return 'today';
  return `${-days} day${days === -1 ? '' : 's'} ago`;
}

export const longDate = (iso: string) => {
  const t = Date.parse(`${iso}T00:00:00`);
  return Number.isFinite(t) ? new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : iso;
};

export const shortDate = (ms: number) => new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

/** The shutoff date as a letter would write it ("31 March 2027"), and whether it has passed. Nothing for a missing date. */
export function letterDate(iso: string, now = Date.now()): { date: string; past: boolean } | undefined {
  const t = Date.parse(`${iso}T00:00:00`);
  if (!Number.isFinite(t)) return undefined;
  return { date: new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }), past: t + DAY <= now };
}
