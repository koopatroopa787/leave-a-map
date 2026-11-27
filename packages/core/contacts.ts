// packages/core/contacts.ts: how to reach each company, read from its own emails on this device.
// Email addresses on the company's own domain, phone numbers that follow words like "call", and
// postal address lines that end in a postcode. Only from emails that are linked to the address,
// aren't suspicious and passed the sender checks (Aggregator `onTrusted`), so a scam email can't
// put its phone number on a card. Nothing here leaves the device.
import type { MessageRecord } from './types.ts';
import type { BodyInfo } from './mbox/body.ts';
import { registrableDomain } from './rules/account-key.ts';

export type Contacts = { emails: string[]; phones: string[]; addresses: string[] };
/** Sent by the scan Worker just before `done`: contacts by account key, only for keys with any. */
export type ContactsMsg = { type: 'contacts'; byKey: Record<string, Contacts> };

const EMAIL = /[a-z0-9][a-z0-9._%+-]*@[a-z0-9-]+(?:\.[a-z0-9-]+)+/gi;
// Addresses nobody reads, or that only send.
const NOBODY = /^(?:no-?reply|do-?not-?reply|donotreply|bounces?|mailer-daemon|postmaster|unsubscribe|notify|notifications?|alerts?|news(?:letter)?|marketing|offers|receipts|statements|billing|orders)(?:[._+-]|$)/i;
// Shown first: the team for families, then the teams a customer would write to.
const FAMILY = /bereave|estate|deceased|probate/i;
const HELP = /^(?:claims|care|help|support|customer|contact|members|service)/i;
const score = (v: string) => (FAMILY.test(v) ? 2 : HELP.test(v) ? 1 : 0);
const PHONE = /\+?\d[\d ().-]{7,18}\d/g;
const PHONE_CUE = /\b(?:call|phone|tel|telephone|helpline|ring|freephone|number|contact|help)\b[^\n\d]{0,30}$/i;
const POSTCODE = [
  /\b[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}$/, // UK
  /,\s*[A-Z]{2}\s+\d{5}(?:-\d{4})?$/, // US
  /[A-Za-z][,\s-]+\d{3}\s?\d{3}$/, // India PIN, after a place name
];

/** One email's contact details. `key` is the account's registrable domain; `own` are the person's addresses. */
export function extractContacts(text: string, key: string, own: readonly string[] = []): Contacts & { familyPhones: string[] } {
  const emails: string[] = [];
  const phones: string[] = [];
  const familyPhones: string[] = [];
  const addresses: string[] = [];
  const mine = new Set(own.map((a) => a.toLowerCase()));
  for (const raw of text.match(EMAIL) ?? []) {
    const a = raw.toLowerCase().replace(/\.+$/, '');
    const [local, host] = a.split('@');
    if (mine.has(a) || NOBODY.test(local) || registrableDomain(host) !== key) continue;
    if (!emails.includes(a)) emails.push(a);
  }
  for (const m of text.matchAll(PHONE)) {
    const n = m[0].trim();
    const digits = n.replace(/\D/g, '');
    if (digits.length < 10 || digits.length > 15 || /\d[./]\d{1,2}[./]\d/.test(n)) continue;
    const before = text.slice(Math.max(0, m.index! - 40), m.index);
    if (!PHONE_CUE.test(before)) continue;
    if (!phones.includes(n)) phones.push(n);
    if (FAMILY.test(before.split('\n').pop() ?? '') && !familyPhones.includes(n)) familyPhones.push(n);
  }
  for (const line of text.split('\n')) {
    const l = line.trim().replace(/^(?:registered office|address|write to us at|post)\s*:\s*/i, '').replace(/[.;]+$/, '');
    if (l.length < 12 || l.length > 160 || /@|https?:|www\./i.test(l) || !/[A-Za-z]{3}/.test(l) || !l.includes(',')) continue;
    if (POSTCODE.some((r) => r.test(l)) && !addresses.includes(l)) addresses.push(l);
  }
  return { emails, phones, addresses, familyPhones };
}

/** Collects contacts across a mailbox, keeping the most common few for each account. */
export class ContactBook {
  private readonly seen = new Map<string, { emails: Map<string, number>; phones: Map<string, number>; addresses: Map<string, number>; family: Set<string> }>();
  constructor(private readonly own: readonly string[] = []) {}

  add(key: string, _m: MessageRecord, body: BodyInfo) {
    if (key.startsWith('app:')) return;
    const text = body.tail ? `${body.text}\n${body.tail}` : body.text;
    if (!text) return;
    const c = extractContacts(text, key, this.own);
    if (!c.emails.length && !c.phones.length && !c.addresses.length) return;
    let s = this.seen.get(key);
    if (!s) { s = { emails: new Map(), phones: new Map(), addresses: new Map(), family: new Set() }; this.seen.set(key, s); }
    for (const p of c.familyPhones) s.family.add(p);
    for (const k of ['emails', 'phones', 'addresses'] as const) for (const v of c[k]) s[k].set(v, (s[k].get(v) ?? 0) + 1);
  }

  out(): Record<string, Contacts> {
    const top = (m: Map<string, number>, n: number, rank: (v: string) => number = () => 0) => [...m.entries()]
      .sort((a, b) => rank(b[0]) - rank(a[0]) || b[1] - a[1])
      .slice(0, n).map(([v]) => v);
    const res: Record<string, Contacts> = {};
    for (const [key, s] of this.seen) {
      res[key] = { emails: top(s.emails, 3, score), phones: top(s.phones, 3, (p) => (s.family.has(p) ? 1 : 0)), addresses: top(s.addresses, 2) };
    }
    return res;
  }
}
