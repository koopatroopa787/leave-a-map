// tools/build-pack.ts: builds data/pack.generated.json, the move pack (T28), from dated snapshots
// of three public lists. Run by a person, never by the app: the scan page can't fetch anything.
//
//   2FA Directory (MIT)           api.2fa.directory/v3/all.json: names and categories
//   Passkeys directory (CC BY 4.0) passkeys-api.2fa.directory/v1/all.json: which services take passkeys
//   JustDeleteMe (MIT)            jdm-contrib/jdm _data/sites.json: delete-account page, difficulty
//
// Usage: node tools/build-pack.ts <dir with twofa-v3.json, passkeys.json, jdm.json> <snapshot-info.json>
// Credits: NOTICE.md. The downloaded files are untrusted data: parsed as JSON, never run.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { registrableDomain } from '../packages/core/rules/account-key.ts';
import type { AccountType, Holds } from '../packages/core/contract.ts';

const [dir, infoPath] = process.argv.slice(2);
if (!dir || !infoPath) throw new Error('usage: node tools/build-pack.ts <raw dir> <snapshot-info.json>');
const read = (f: string) => JSON.parse(readFileSync(join(dir, f), 'utf8'));
const info = JSON.parse(readFileSync(infoPath, 'utf8'));

/** 2FA Directory keyword → the app's category and what such a service usually holds. */
const KEYWORD: Record<string, [AccountType, Holds]> = {
  banking: ['money', 'payment'], finance: ['money', 'payment'], investing: ['money', 'payment'], payments: ['money', 'payment'],
  cryptocurrencies: ['money', 'payment'], insurance: ['money', 'payment'], crowdfunding: ['money', 'payment'], betting: ['money', 'payment'],
  identity: ['identity', 'login-for-others'], email: ['identity', 'login-for-others'],
  developer: ['work', 'documents'], hosting: ['work', 'documents'], cloud: ['work', 'documents'], backup: ['work', 'documents'],
  task: ['work', 'documents'], creativity: ['work', 'documents'], remote: ['work', 'nothing-seen'],
  universities: ['school', 'nothing-seen'], education: ['school', 'documents'],
  health: ['health', 'nothing-seen'], government: ['government', 'nothing-seen'],
  retail: ['shopping', 'purchases'], food: ['shopping', 'purchases'], tickets: ['shopping', 'purchases'], travel: ['shopping', 'purchases'],
  transport: ['shopping', 'purchases'], postal: ['shopping', 'purchases'], domains: ['subscription', 'payment'],
  social: ['social', 'nothing-seen'], communication: ['social', 'nothing-seen'], entertainment: ['subscription', 'payment'],
  gaming: ['subscription', 'purchases'], vpn: ['subscription', 'payment'], utilities: ['subscription', 'payment'],
};
// When a service has several keywords, the most urgent one wins (same order as the buckets).
const PRIORITY: AccountType[] = ['identity', 'money', 'work', 'school', 'health', 'government', 'subscription', 'shopping', 'social', 'other'];

export type PackEntry = {
  /** Display name. */ n: string;
  /** Category. */ c?: AccountType;
  /** Usually holds. */ h?: Holds;
  /** Takes passkeys. */ p?: 1;
  /** Delete-account page (JustDeleteMe) and its difficulty. */ d?: string; dd?: string;
};

const pack = new Map<string, PackEntry>();
const key = (host: string) => { try { return registrableDomain(String(host).trim().toLowerCase()); } catch { return ''; } };
const entry = (k: string, name: string) => { let e = pack.get(k); if (!e) { e = { n: name.slice(0, 60) }; pack.set(k, e); } return e; };
// A delete link must be https and go deeper than a home page, which tells the person nothing.
const httpsOnly = (u: unknown) =>
  (typeof u === 'string' && /^https:\/\/[^\s"<>/]+\/[^\s"<>]+$/.test(u) && u.length < 300 ? u : undefined);

for (const [name, v] of read('twofa-v3.json') as [string, any][]) {
  const kws: string[] = Array.isArray(v.keywords) ? v.keywords : [];
  const mapped = kws.map((k) => KEYWORD[k]).filter(Boolean);
  mapped.sort((a, b) => PRIORITY.indexOf(a[0]) - PRIORITY.indexOf(b[0]));
  for (const host of [v.domain, ...(v['additional-domains'] ?? [])]) {
    const k = key(host);
    if (!k) continue;
    const e = entry(k, name);
    if (mapped[0] && !e.c) { e.c = mapped[0][0]; e.h = mapped[0][1]; }
  }
}
for (const [host, v] of Object.entries(read('passkeys.json') as Record<string, any>)) {
  const k = key(host);
  // Only marks services already in the pack: this list has no names or categories.
  const e = k ? pack.get(k) : undefined;
  if (e && (v?.passwordless || v?.mfa)) e.p = 1;
}
for (const s of read('jdm.json') as any[]) {
  const url = httpsOnly(s.url);
  for (const host of s.domains ?? []) {
    const k = key(host);
    if (!k) continue;
    const e = entry(k, String(s.name ?? k));
    if (url && !e.d) { e.d = url; e.dd = ['easy', 'medium', 'hard', 'impossible'].includes(s.difficulty) ? s.difficulty : undefined; }
  }
}
// Keep only entries that tell the app something (a category or a delete page), and never a
// reserved .example domain: those belong to the sample and hand-links.json.
for (const [k, e] of [...pack.entries()]) if (k.endsWith('.example') || (!e.c && !e.d)) pack.delete(k);

const out = { snapshot: info, count: pack.size, entries: Object.fromEntries([...pack.entries()].sort(([a], [b]) => a.localeCompare(b))) };
writeFileSync('data/pack.generated.json', JSON.stringify(out) + '\n');
// The sample's held-out domains (tools/make-sample-mbox.mjs) must stay out of the pack.
const held = ['arxiv.org', 'zenodo.org', 'openreview.net'];
console.log(`wrote data/pack.generated.json: ${pack.size} domains`);
console.log('held-out domains absent from the pack:', held.filter((h) => !pack.has(h)).join(', ') || 'none');
console.log('held-out domains IN the pack (pick others):', held.filter((h) => pack.has(h)).join(', ') || 'none');
