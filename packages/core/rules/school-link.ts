// packages/core/rules/school-link.ts: how a message is tied to the school address (analyst.md 1.1).
// Header rules only. D4 (Received for) and D5 (address in body) come with body reading in T09/T10.
import type { MessageRecord, SchoolLink } from '../types.ts';
import { domainOf, registrableDomain } from './account-key.ts';

export const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export type LinkContext = { school: string; own: ReadonlySet<string>; isSchool: (address: string) => boolean };

export function makeLinkContext(schoolDomain: string, ownAddresses: string[]): LinkContext {
  const school = schoolDomain.trim().toLowerCase().replace(/^@/, '');
  const re = new RegExp('^[^@\\s]+@(?:[a-z0-9-]+\\.)*' + escapeRe(school) + '$', 'i');
  return { school, own: new Set(ownAddresses.map((a) => a.trim().toLowerCase()).filter(Boolean)),
    isSchool: (a) => re.test(a) };
}

const CAF_RE = /^<?([^+@\s]+)\+caf_=([^=@\s]+)=([^@\s]+)@([^>\s]+)>?$/i;

function forwardLink(original: string, destination: string, ctx: LinkContext, rule: string): SchoolLink | null {
  const o = original.toLowerCase();
  const d = destination.toLowerCase();
  if (ctx.own.has(o) || ctx.isSchool(o)) return { kind: 'forwarded-from-school', tier: 'seen', rule };
  if (ctx.own.has(d) || ctx.isSchool(d)) return { kind: 'other-address', address: o, rule };
  return null;
}

function directLink(addresses: string[], ctx: LinkContext, rule: string): SchoolLink | null {
  if (addresses.some((a) => ctx.own.has(a))) return { kind: 'school', tier: 'seen', rule };
  if (addresses.some((a) => ctx.isSchool(a))) return { kind: 'school', tier: 'likely', rule };
  return null;
}

/** First rule that fires wins. Forward rules come first so they can mark mail as tied elsewhere. */
export function schoolLink(m: MessageRecord, ctx: LinkContext): SchoolLink {
  for (const v of m.xForwardedFor) {
    const [original, destination] = v.split(/\s+/);
    if (original?.includes('@') && destination?.includes('@')) {
      const r = forwardLink(original, destination, ctx, 'F1/F2 X-Forwarded-For');
      if (r) return r;
    }
  }
  const caf = m.returnPath ? CAF_RE.exec(m.returnPath.trim()) : null;
  if (caf) {
    const r = forwardLink(`${caf[1]}@${caf[4]}`, `${caf[2]}@${caf[3]}`, ctx, 'F3 forward envelope');
    if (r) return r;
  }
  if (m.resentFrom.some((a) => ctx.own.has(a) || ctx.isSchool(a))) {
    return { kind: 'forwarded-from-school', tier: 'likely', rule: 'F5 Resent-From' };
  }
  return directLink(m.deliveredTo, ctx, 'D1 Delivered-To')
    ?? directLink(m.xOriginalTo, ctx, 'D2 X-Original-To')
    ?? directLink([...m.to, ...m.cc], ctx, 'D3 To/Cc')
    ?? { kind: 'none' };
}

/** T1: a forward the person made by hand. It's evidence only for its own From domain. */
export const isManualForward = (m: MessageRecord) => /^\s*(?:fwd?|fw|tr|wg|rv|enc)\s*:/i.test(m.subject);

/** Mailbox providers, for T2. Moves into the pack (`category: identity`, `kind: mailbox`) in T10/T28. */
const MAILBOX_DOMAINS = new Set(['gmail.com', 'googlemail.com', 'outlook.com', 'hotmail.com', 'live.com',
  'msn.com', 'yahoo.com', 'ymail.com', 'icloud.com', 'me.com', 'mac.com', 'aol.com', 'proton.me',
  'protonmail.com', 'gmx.com', 'gmx.net', 'zoho.com', 'yandex.com', 'mail.com', 'fastmail.com',
  // Fictional mailbox provider used by the synthetic fixtures and the sample mailbox.
  'mailbox.example']);
const ROBOT_LOCAL = /^(?:no-?reply|notifications?|security|alerts?|accounts?|support|hello|team|info|billing|mailer-daemon)\b/i;

/** T2: person-to-person mail from a mailbox provider. Not account evidence for anyone. */
export function isPersonSender(address: string): boolean {
  const at = address.lastIndexOf('@');
  return MAILBOX_DOMAINS.has(registrableDomain(domainOf(address))) && !ROBOT_LOCAL.test(address.slice(0, at));
}

/** T3: mailing-list mail not sent to the person directly. Evidence goes to the list host. */
export function listHost(m: MessageRecord, ctx: LinkContext): string | null {
  if (!m.listId) return null;
  if ([...m.to, ...m.cc].some((a) => ctx.own.has(a))) return null;
  const inner = /<([^>]+)>/.exec(m.listId)?.[1] ?? m.listId;
  const host = inner.trim().toLowerCase();
  return /\.[a-z]{2,}$/.test(host) ? registrableDomain(host) : null;
}
