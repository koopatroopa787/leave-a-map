// packages/core/mbox/headers.ts: turns a raw header block into the fields the rules need.
import { addressParser, decodeWords } from 'postal-mime';
import type { Address, MessageRecord } from '../types.ts';

const utf8 = new TextDecoder('utf-8');
const KEEP = new Set(['from', 'to', 'cc', 'delivered-to', 'x-original-to', 'x-forwarded-for',
  'return-path', 'resent-from', 'list-id', 'list-unsubscribe', 'precedence', 'subject', 'date',
  'authentication-results', 'arc-authentication-results', 'x-gmail-labels']);

export type HeaderFields = Omit<MessageRecord, 'index' | 'start' | 'bodyStart' | 'end'>;

/** Unfolded header lines, lower-cased names, only the headers we use. */
export function readHeaders(block: Uint8Array): Map<string, string[]> {
  const text = utf8.decode(block).replace(/\r?\n(?=[ \t])/g, '');
  const map = new Map<string, string[]>();
  for (const line of text.split(/\r?\n/)) {
    const i = line.indexOf(':');
    if (i <= 0) continue;
    const name = line.slice(0, i).trim().toLowerCase();
    if (!KEEP.has(name)) continue;
    const value = line.slice(i + 1).trim();
    const list = map.get(name);
    if (list) list.push(value); else map.set(name, [value]);
  }
  return map;
}

type Parsed = { name?: string; address?: string; group?: Parsed[] };

export function parseAddresses(values: string[] | undefined): Address[] {
  if (!values) return [];
  const out: Address[] = [];
  const walk = (items: Parsed[]) => {
    for (const a of items) {
      if (a.group) walk(a.group);
      else if (a.address && a.address.includes('@')) {
        out.push({ name: decodeWords(a.name ?? '').trim(), address: a.address.trim().toLowerCase() });
      }
    }
  };
  for (const v of values) {
    try { walk(addressParser(v) as Parsed[]); } catch { /* unreadable header: skip it */ }
  }
  return out;
}

const bare = (values: string[] | undefined) =>
  (values ?? []).map((v) => v.replace(/^<|>$/g, '').trim().toLowerCase()).filter((v) => v.includes('@'));

export function parseDate(value: string | undefined): number | null {
  if (!value) return null;
  const t = Date.parse(value.replace(/\([^)]*\)\s*$/, '').trim());
  return Number.isFinite(t) ? t : null;
}

export function parseHeaderBlock(block: Uint8Array): HeaderFields {
  const h = readHeaders(block);
  const precedence = (h.get('precedence')?.[0] ?? '').toLowerCase();
  return {
    from: parseAddresses(h.get('from'))[0] ?? null,
    to: parseAddresses(h.get('to')).map((a) => a.address),
    cc: parseAddresses(h.get('cc')).map((a) => a.address),
    deliveredTo: bare(h.get('delivered-to')),
    xOriginalTo: bare(h.get('x-original-to')),
    xForwardedFor: h.get('x-forwarded-for') ?? [],
    returnPath: h.get('return-path')?.[0] ?? null,
    resentFrom: parseAddresses(h.get('resent-from')).map((a) => a.address),
    listId: h.get('list-id')?.[0] ?? null,
    subject: decodeWords(h.get('subject')?.[0] ?? '').slice(0, 300),
    date: parseDate(h.get('date')?.[0]),
    bulk: precedence === 'bulk' || precedence === 'list' || precedence === 'junk'
      || /(?:^|,)\s*Category Promotions\s*(?:,|$)/i.test(h.get('x-gmail-labels')?.join(',') ?? ''),
    listUnsubscribe: h.has('list-unsubscribe'),
    authResults: h.get('authentication-results')?.[0] ?? null,
    arcResults: h.get('arc-authentication-results')?.find((v) => /^\s*i\s*=\s*1\s*;/.test(v)) ?? null,
  };
}
