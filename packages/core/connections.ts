// packages/core/connections.ts: the school-login step (T19). The person opens their school
// account's connected-apps page and ticks each service listed there. A tick is the strongest
// evidence there is: Seen, labelled "you confirmed" (analyst.md CONNECTIONS-TICK), so the service
// moves to rank 1. Ticks are applied on top of the scanned accounts, never stored in them, so
// unticking simply drops the tick.
import { normaliseApp } from './rules/idp-notice.ts';
// Not imported from rules/suspicious.ts: that pulls the domain parser into the main bundle.
const labelOf = (org: string) => org.split('.')[0];
import { tierRank } from './tiers.ts';
import type { Account, Cond } from './types.ts';

export type Connections = { ticked: string[]; added: string[] };
export const NO_CONNECTIONS: Connections = { ticked: [], added: [] };

const SIGNAL = 'listed on your school or work account\u2019s connected-apps page';
const userCond = (): Cond => ({ tier: 'seen', source: 'user', signal: SIGNAL });

const confirm = (a: Account): Account => {
  const sso = userCond();
  return {
    ...a, sso, link: 'seen',
    exists: tierRank(a.exists.tier) < tierRank('seen') ? sso : a.exists,
    flags: { ...a.flags, forwardedIn: null },
  };
};

/** Which account a typed service name refers to, if the scan already found it. */
export function matchName(accounts: readonly Account[], name: string): Account | undefined {
  const k = normaliseApp(name);
  if (!k) return undefined;
  return accounts.find((a) => !a.flags.suspiciousOnly && !a.flags.schoolRun &&
    (normaliseApp(a.name) === k || (!a.key.startsWith('app:') && normaliseApp(labelOf(a.key)) === k) || a.key === `app:${k}`));
}

export function applyConnections(accounts: readonly Account[], c: Connections): Account[] {
  const ticked = new Set(c.ticked);
  const out = accounts.map((a) => (ticked.has(a.key) && !a.flags.suspiciousOnly && !a.flags.schoolRun ? confirm(a) : a));
  const seen = new Set<string>();
  for (const raw of c.added) {
    const name = raw.trim().replace(/\s+/g, ' ').slice(0, 80);
    const k = normaliseApp(name);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    const match = matchName(out, name);
    if (match) { out[out.indexOf(match)] = confirm(match); continue; }
    const sso = userCond();
    const none: Cond = { tier: null, source: 'rules', signal: '' };
    out.push({
      key: `app:${k}`, name, link: 'seen', exists: sso, sso, work: none, reset: none, money: none, discount: none,
      flags: { schoolRun: false, forwardedIn: null, suspiciousOnly: false, bulkOnly: false, suspiciousIgnored: 0, health: false },
      lastDate: 0, nMsgs: 0, nLinked: 0, nAll: 0,
    });
  }
  return out;
}
