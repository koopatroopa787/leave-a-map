// packages/core/rules/suspicious.ts: fake-looking mail (analyst.md 1.7). Suspicious messages give
// no evidence and are counted in "Looks fake". P3–P5 use pack names, which arrive with T28.
import type { MessageRecord } from '../types.ts';
import type { AuthVerdict } from './sender-auth.ts';
import { domainOf, registrableDomain } from './account-key.ts';
import { isPersonSender } from './school-link.ts';

export type PackNames = { labels: ReadonlySet<string>; byName: ReadonlyMap<string, string> };
export const EMPTY_PACK: PackNames = { labels: new Set(), byName: new Map() };

const BRAND_WORDS = 'secure|security|verify|verification|login|signin|account|accounts|support|alert|alerts|update|billing|help';
const BRAND_PLUS = new RegExp(`^(?:(.+)-(?:${BRAND_WORDS})|(?:${BRAND_WORDS})-(.+))$`);

/** `forkyard.example` → `forkyard`. */
export const labelOf = (org: string) => org.split('.')[0];
const unglyph = (s: string) => s.replace(/rn/g, 'm').replace(/vv/g, 'w').replace(/[I1]/g, 'l').replace(/0/g, 'o');

export function suspiciousReason(m: MessageRecord, auth: AuthVerdict, pack: PackNames = EMPTY_PACK): string | null {
  if (!m.from) return null;
  if (auth === 'fail') return 'P1 sender authentication failed';
  const org = registrableDomain(domainOf(m.from.address));
  const label = labelOf(org);
  if (label.startsWith('xn--') || org.includes('xn--')) return 'P2 internationalised lookalike domain';
  if (label.length >= 5 && !pack.labels.has(label)) {
    const g = unglyph(label);
    if (g !== label && pack.labels.has(g)) return `P3 looks like ${g}`;
    const bp = BRAND_PLUS.exec(label);
    const base = bp?.[1] ?? bp?.[2];
    if (base && pack.labels.has(base)) return `P4 ${base} plus a word`;
  }
  const claimed = pack.byName.get(m.from.name.trim().toLowerCase());
  if (claimed && claimed !== org && !isPersonSender(m.from.address)) return `P5 display name claims ${claimed}`;
  return null;
}
