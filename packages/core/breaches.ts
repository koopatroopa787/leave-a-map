// packages/core/breaches.ts: known data breaches per account, from a bundled snapshot of Have I Been
// Pwned's public list (tools/build-breaches.mjs, CC BY 4.0). Matched on this device by domain only.
export type Breach = { title: string; date: string; count: number; data: string[]; sample?: true };
export type BreachFile = { taken: string; source: string; byDomain: Record<string, Breach[]> };

// The samples use made-up .example services, so each sample gets one made-up breach, labelled as such,
// to show what a real one looks like.
const SAMPLE: Record<string, Breach[]> = {
  'sketchloom.example': [{ title: 'Sketchloom', date: '2025-09-14', count: 2_400_000, data: ['Email addresses', 'Passwords', 'Names'], sample: true }],
  'reelhouse.example': [{ title: 'Reelhouse', date: '2024-03-02', count: 860_000, data: ['Email addresses', 'Passwords', 'Payment histories'], sample: true }],
};

export function breachesFor(file: BreachFile | null, key: string): Breach[] {
  if (/\.example$/.test(key)) return SAMPLE[key] ?? [];
  return file?.byDomain[key] ?? [];
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Canva, May 2019: email addresses, passwords and names" */
export function breachLine(b: Breach): string {
  const [y, m] = b.date.split('-');
  const data = b.data.map((d) => d.toLowerCase());
  const what = data.length > 1 ? `${data.slice(0, -1).join(', ')} and ${data[data.length - 1]}` : data[0] ?? 'details';
  return `${b.title}, ${MONTHS[Number(m) - 1]} ${y}: ${what}`;
}

/** A password was in the breach, so changing it matters most. */
export const hadPasswords = (list: Breach[]) => list.some((b) => b.data.some((d) => /password/i.test(d) && !/hint/i.test(d)));
