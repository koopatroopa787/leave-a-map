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

/** Folds letters that look alike once lower-cased (i, l, 1; o, 0; rn, m; vv, w) so lookalikes compare equal. */
export const skeleton = (label: string) =>
  label.toLowerCase().replace(/rn/g, 'm').replace(/vv/g, 'w').replace(/[il1|]/g, 'l').replace(/0/g, 'o');

/**
 * P3/P4 against the mailbox's own services, for when the pack doesn't know the brand: a sender
 * whose label is a lookalike of, or a "<label>-verify" style variant of, a service that sent
 * authenticated mail to this same mailbox. `trusted` maps each such label to its count of
 * authenticated messages. Letter folding is symmetric, so for P3 the side with more authenticated
 * mail is taken as genuine, and a tie flags neither. Display names are not used here: real services
 * often send under one name from several domains.
 */
export function mailboxLookalike(org: string, trusted: ReadonlyMap<string, number>): string | null {
  const label = labelOf(org);
  if (label.length < 5) return null;
  const mine = trusted.get(label) ?? 0;
  const sk = skeleton(label);
  for (const [t, n] of trusted) if (t !== label && t.length >= 5 && n > mine && skeleton(t) === sk) return `P3 looks like ${t}`;
  const bp = BRAND_PLUS.exec(label);
  const base = bp?.[1] ?? bp?.[2];
  if (base && trusted.has(base)) return `P4 ${base} plus a word`;
  return null;
}
