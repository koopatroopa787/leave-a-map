// packages/core/rules/idp-notice.ts: "<App> was granted access to your account" notices from the
// school's sign-in provider (analyst.md 1.5, BUILD-PLAN section 4). Google only; there is no
// Microsoft email rule. A hint only: the Linked apps page is the main source.
import IDP_SENDERS from '../../../data/idp-senders.json' with { type: 'json' };
import type { MessageRecord } from '../types.ts';
import type { BodyInfo } from '../mbox/body.ts';
import type { AuthVerdict } from './sender-auth.ts';

type IdpSender = { id: string; from: string; subject: string; appPatterns: string[] };
const SENDERS = (IDP_SENDERS as IdpSender[]).map((s) => ({
  ...s, subjectRe: new RegExp(s.subject, 'i'), appRes: s.appPatterns.map((p) => new RegExp(p, 'im')),
}));

export const isIdpSender = (address: string) => SENDERS.some((s) => s.from === address);

/** Normalised app name for matching to accounts: lower-case, letters and digits, no "app", "inc", "ltd". */
export const normaliseApp = (name: string) =>
  name.toLowerCase().replace(/\b(?:app|inc|ltd|llc)\b/g, '').replace(/[^a-z0-9]/g, '');

export type IdpNotice = { provider: string; app: string; quote: string };

/**
 * Seen only when the sender matches exactly, auth passes, the message is tied to the school
 * address by a header rule, and one of the person's own addresses is in the body. The last two
 * guard against the 2025 replayed-notice trick, which passes DKIM.
 */
export function idpNotice(m: MessageRecord, body: BodyInfo, auth: AuthVerdict, headerLinked: boolean,
  ownAddresses: readonly string[]): IdpNotice | null {
  if (!m.from || auth !== 'pass' || !headerLinked) return null;
  const s = SENDERS.find((x) => x.from === m.from!.address);
  if (!s || !s.subjectRe.test(m.subject)) return null;
  const text = body.text.toLowerCase();
  if (!ownAddresses.some((a) => text.includes(a.toLowerCase()))) return null;
  for (const piece of body.text.split('\n')) {
    for (const re of s.appRes) {
      const hit = re.exec(piece);
      if (hit?.[1]) return { provider: s.id, app: hit[1].trim(), quote: hit[0].trim().slice(0, 160) };
    }
  }
  return null;
}
