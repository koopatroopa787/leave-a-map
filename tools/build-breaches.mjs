// tools/build-breaches.mjs: snapshot of Have I Been Pwned's public list of breaches (no key needed;
// the breach data is CC BY 4.0, credited in NOTICE.md). Bundled into the scan site, which can't
// fetch anything. Keeps only what a card shows. Usage: node tools/build-breaches.mjs
import { writeFileSync } from 'node:fs';

const res = await fetch('https://haveibeenpwned.com/api/v3/breaches', { headers: { 'user-agent': 'leave-a-map-build' } });
if (!res.ok) throw new Error(`HIBP answered ${res.status}`);
const all = await res.json();
const byDomain = {};
for (const b of all) {
  // Spam lists, fabricated and unverified breaches say nothing reliable about an account.
  if (!b.Domain || b.IsSpamList || b.IsFabricated || !b.IsVerified || b.IsRetired) continue;
  const domain = b.Domain.toLowerCase().replace(/^www\./, '');
  (byDomain[domain] ??= []).push({ title: b.Title, date: b.BreachDate, count: b.PwnCount, data: b.DataClasses.slice(0, 6) });
}
for (const list of Object.values(byDomain)) list.sort((x, y) => y.date.localeCompare(x.date));
const out = { taken: new Date().toISOString().slice(0, 10), source: 'Have I Been Pwned (haveibeenpwned.com), CC BY 4.0', byDomain };
writeFileSync('data/breaches.json', JSON.stringify(out) + '\n');
console.log(`wrote data/breaches.json: ${Object.keys(byDomain).length} domains from ${all.length} breaches`);
