// packages/core/tiers.ts: ordering of evidence tiers. Kept tiny so UI code can use it cheaply.
import type { Tier } from './types.ts';

const RANK: Record<Exclude<Tier, null>, number> = { seen: 3, likely: 2, possible: 1 };
export const tierRank = (t: Tier) => (t ? RANK[t] : 0);
export const bestTier = (a: Tier, b: Tier): Tier => (tierRank(a) >= tierRank(b) ? a : b);
