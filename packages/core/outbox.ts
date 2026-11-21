// packages/core/outbox.ts: picks which accounts the scan page offers for a lane 3 lookup.
// Only accounts on the main list that the rules couldn't place in a bucket, or in "maybe", never connected-app
// keys (those have no domain), at most MAX_OUTBOX, most urgent first. Health and money rows are
// marked so the consent window leaves them out of "Select all".
import { MAX_OUTBOX, toOutboxItem, type OutboxItem } from './handoff.ts';
import { tierRank } from './tiers.ts';
import type { RankedAccount } from './types.ts';

export type Outbox = { items: OutboxItem[]; keyById: Map<string, string> };

const DOMAIN_KEY = /^(?!app:)[a-z0-9.-]+\.[a-z]{2,63}$/;

export function outboxFor(accounts: readonly RankedAccount[], known: (domain: string) => boolean = () => false): Outbox {
  const items: OutboxItem[] = [];
  const keyById = new Map<string, string>();
  for (const a of accounts) {
    if (items.length >= MAX_OUTBOX) break;
    if ((a.section !== 'main' && a.section !== 'maybe') || a.bucket !== 'rest' || !DOMAIN_KEY.test(a.key) || known(a.key)) continue;
    const sensitive = a.flags.health ? 'health' : tierRank(a.money.tier) > 0 ? 'money' : undefined;
    const id = `s${items.length + 1}`;
    try { items.push(toOutboxItem(id, a.key, sensitive)); } catch { continue; }
    keyById.set(id, a.key);
  }
  return { items, keyById };
}
