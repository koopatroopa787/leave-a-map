// packages/core/rank.ts: the ranking algorithm from analyst.md 2.4. In v1 the sso/work/reset/money
// conditions are still empty, so every main account lands in REST until T10 and T11 fill them.
import type { Account, Bucket, RankedAccount, Tier } from './types.ts';
import { tierRank } from './rules/aggregate.ts';

const BUCKETS: Exclude<Bucket, 'rest'>[] = ['sso', 'work', 'reset', 'money'];
const ORDER: Record<Bucket, number> = { sso: 1, work: 2, reset: 3, money: 4, rest: 5 };
const strong = (t: Tier) => t === 'seen' || t === 'likely';

export function classify(a: Account): RankedAccount | null {
  const base = { bucket: 'rest' as Bucket, primaryTier: a.exists.tier, alsoCount: 0 };
  if (a.flags.suspiciousOnly) return { ...a, ...base, section: 'ignored' };
  if (a.flags.schoolRun) return { ...a, ...base, section: 'ends-anyway' };
  if (a.flags.forwardedIn) return { ...a, ...base, section: 'elsewhere' };
  if (a.link === null) return null;
  if (!strong(a.exists.tier)) return { ...a, ...base, section: 'maybe' };
  const bucket = BUCKETS.find((b) => strong(a[b].tier)) ?? 'rest';
  const primaryTier = bucket === 'rest' ? a.exists.tier : a[bucket].tier;
  const alsoCount = BUCKETS.filter((b) => b !== bucket && strong(a[b].tier)).length;
  return { ...a, section: 'main', bucket, primaryTier, alsoCount };
}

const byName = (x: RankedAccount, y: RankedAccount) => x.name.localeCompare(y.name, 'en') || x.key.localeCompare(y.key);

export function rank(accounts: Account[]): RankedAccount[] {
  const ranked = accounts.map(classify).filter((a): a is RankedAccount => a !== null);
  const main = ranked.filter((a) => a.section === 'main').sort((x, y) =>
    ORDER[x.bucket] - ORDER[y.bucket]
    || tierRank(y.primaryTier) - tierRank(x.primaryTier)
    || tierRank(y.exists.tier) - tierRank(x.exists.tier)
    || y.alsoCount - x.alsoCount
    || y.lastDate - x.lastDate
    || y.nMsgs - x.nMsgs
    || byName(x, y));
  const maybe = ranked.filter((a) => a.section === 'maybe').sort((x, y) => y.nMsgs - x.nMsgs || y.nLinked - x.nLinked || byName(x, y));
  const rest = (s: RankedAccount['section']) => ranked.filter((a) => a.section === s).sort(byName);
  return [...main, ...maybe, ...rest('ends-anyway'), ...rest('elsewhere'), ...rest('ignored')];
}
