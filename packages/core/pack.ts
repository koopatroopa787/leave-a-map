// packages/core/pack.ts: the move pack (T28). A dated snapshot of public service lists
// (data/pack.generated.json, built by tools/build-pack.ts) plus links a person checked by hand
// (data/hand-links.json). Everything resolves on the device: the scan page never fetches it.
//
// Neither model ever returns a URL (BUILD-PLAN section 4). Every link on a card comes from here.
// A pack fact describes the *kind* of service, so like lane 3 it never creates an account and
// reaches Likely only when the mail already shows the account at Likely or better.
import { ACCOUNT_TYPES, HOLDS, type AccountType, type Holds } from './contract.ts';
import { maxTier } from './evidence.ts';
import { tierRank } from './tiers.ts';
import type { Account, Cond } from './types.ts';

/** One generated entry, with short keys to keep the file small. */
export type PackEntry = { n: string; c?: AccountType; h?: Holds; p?: 1; d?: string; dd?: string };
export type PackFile = { snapshot: { taken: string }; count: number; entries: Record<string, PackEntry> };

export type HandLink = {
  domain: string; name: string; category?: AccountType; usuallyHolds?: Holds[];
  loginEmailChange?: string; exportData?: string; example: boolean; checked: string | null;
};
export type HandLinksFile = { entries: HandLink[] };

export type Link = {
  url: string;
  /** A fictional sample link: show it as text, never as a link (.example doesn't resolve). */
  example: boolean;
  /** Date a person opened it, or null for list links and examples. */
  checked: string | null;
};
export type ServiceFacts = {
  name: string;
  category?: AccountType;
  holds: Holds[];
  passkeys: boolean;
  changeEmail?: Link;
  exportData?: Link;
  deleteAccount?: Link & { difficulty?: 'easy' | 'medium' | 'hard' | 'impossible' };
  /** Where the category came from: written by hand, a fictional sample entry, or the public lists. */
  from: 'hand' | 'example' | 'list';
};

export type Pack = {
  lookup(key: string): ServiceFacts | undefined;
  /** True when the pack can say what kind of service this is, so lane 3 needn't ask. */
  known(key: string): boolean;
  taken: string;
};

const DIFFICULTY = ['easy', 'medium', 'hard', 'impossible'] as const;
const has = <T extends string>(list: readonly T[], v: unknown): v is T => typeof v === 'string' && (list as readonly string[]).includes(v);

/** https only, no spaces or markup. An example link must point at a .example host. */
function safeLink(url: unknown, example: boolean, checked: string | null): Link | undefined {
  if (typeof url !== 'string' || url.length > 300 || !/^https:\/\/[^\s"'<>]+$/.test(url)) return undefined;
  let host: string;
  try { host = new URL(url).hostname; } catch { return undefined; }
  if (example !== host.endsWith('.example')) return undefined;
  return { url, example, checked: example ? null : checked };
}

export function makePack(file: PackFile, hand: HandLinksFile): Pack {
  const handBy = new Map<string, HandLink>();
  for (const h of hand.entries) if (typeof h.domain === 'string') handBy.set(h.domain.toLowerCase(), h);
  const entries = file.entries;
  const own = (key: string) => (Object.prototype.hasOwnProperty.call(entries, key) ? entries[key] : undefined);

  function lookup(key: string): ServiceFacts | undefined {
    const k = key.toLowerCase();
    const e = own(k);
    const h = handBy.get(k);
    if (!e && !h) return undefined;
    const hCat = has(ACCOUNT_TYPES, h?.category) ? h.category : undefined;
    const category = hCat ?? (has(ACCOUNT_TYPES, e?.c) ? e.c : undefined);
    const holds = hCat ? (h?.usuallyHolds ?? []).filter((x): x is Holds => has(HOLDS, x))
      : has(HOLDS, e?.h) && e.h !== 'nothing-seen' ? [e.h] : [];
    const from = !hCat ? 'list' : h?.example === true ? 'example' : 'hand';
    const facts: ServiceFacts = { name: h?.name ?? e?.n ?? k, holds, passkeys: e?.p === 1, from };
    if (category) facts.category = category;
    const example = h?.example === true;
    const checked = typeof h?.checked === 'string' ? h.checked : null;
    const change = safeLink(h?.loginEmailChange, example, checked);
    if (change) facts.changeEmail = change;
    const exp = safeLink(h?.exportData, example, checked);
    if (exp) facts.exportData = exp;
    const del = example ? undefined : safeLink(e?.d, false, null);
    if (del) facts.deleteAccount = { ...del, ...(has(DIFFICULTY, e?.dd) ? { difficulty: e.dd } : {}) };
    return facts;
  }
  return {
    lookup,
    known: (key) => lookup(key)?.category !== undefined,
    taken: typeof file.snapshot?.taken === 'string' ? file.snapshot.taken : '',
  };
}

/** Plain words for the card's signal. Each condition says what raised it: the kind of service, or what it usually holds. */
const KIND_WORD: Record<AccountType, string> = {
  money: 'a bank or payment service', identity: 'an account that can reset other accounts', school: 'a learning service',
  work: 'a place where people keep work', health: 'a health service', government: 'a government service',
  shopping: 'a shop', social: 'a social network', subscription: 'a subscription', other: 'a service',
};
const HOLDS_WORD: Record<Holds, string> = {
  payment: 'payment details', documents: 'files or documents', 'login-for-others': 'logins for other accounts',
  purchases: 'order history', 'nothing-seen': '',
};

/** Folds pack facts into accounts, under the evidence caps. Accounts the pack doesn't know are returned unchanged. */
export function applyPack<T extends Account>(accounts: readonly T[], pack: Pack | null): T[] {
  if (!pack) return accounts as T[];
  return accounts.map((a) => {
    if (a.key.startsWith('app:')) return a;
    const f = pack.lookup(a.key);
    if (!f?.category) return a;
    const cap = maxTier('pack', { exists: a.exists.tier });
    if (!cap) return a;
    const note = f.from === 'hand' ? ' (written by hand)' : f.from === 'example' ? ' (sample entry)' : '';
    // A category that names a bucket wins over the holds list: a bank's statements are documents,
    // but a bank doesn't belong under "Holds your work".
    const bucketKind = f.category === 'work' || f.category === 'identity' || f.category === 'money';
    const raise = (c: Cond, kind: AccountType, holds: Holds): Cond => {
      const byKind = f.category === kind;
      if (!(byKind || (!bucketKind && f.holds.includes(holds))) || tierRank(cap) <= tierRank(c.tier)) return c;
      const what = byKind ? `listed as ${KIND_WORD[kind]}` : `listed as usually holding ${HOLDS_WORD[holds]}`;
      return { tier: cap, source: 'pack', signal: `${what}${note}` };
    };
    const work = raise(a.work, 'work', 'documents');
    const reset = raise(a.reset, 'identity', 'login-for-others');
    const money = raise(a.money, 'money', 'payment');
    return work === a.work && reset === a.reset && money === a.money ? a : { ...a, work, reset, money };
  });
}
