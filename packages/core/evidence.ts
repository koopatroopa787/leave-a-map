// packages/core/evidence.ts: evidence tiers and the caps that keep them honest (analyst.md 2.2,
// BUILD-PLAN section 4). No AI output is ever Seen.
import type { Account, Cond, Source, Tier } from './types.ts';
import type { Basis, Label } from './contract.ts';
import type { ServiceInfo } from './handoff.ts';
import { tierRank } from './tiers.ts';

export const TIER_WORD = { seen: 'Seen', likely: 'Likely', possible: 'Possible' } as const;
export const SOURCE_WORD: Record<Source, string> = {
  rules: 'rules', user: 'you confirmed', pack: 'service list', on_device: 'on-device AI', in_cloud: 'cloud AI (you approved)',
};

const atLeastLikely = (t: Tier) => tierRank(t) >= tierRank('likely');

/** The highest tier a source may give. Rules are capped by sender authentication in the aggregator. */
export function maxTier(source: Source, opts: { quote?: boolean; basis?: Basis; exists?: Tier } = {}): Tier {
  switch (source) {
    case 'rules':
    case 'user':
      return 'seen';
    case 'pack':
      return atLeastLikely(opts.exists ?? null) ? 'likely' : null;
    case 'on_device':
    case 'in_cloud':
      if (opts.basis === undefined) return opts.quote ? 'likely' : 'possible'; // lane 2: a label about your mail
      if (opts.basis === 'recognised') return atLeastLikely(opts.exists ?? null) ? 'likely' : null; // lane 3
      return opts.basis === 'name-only' ? 'possible' : null;
  }
}

/** True when a condition respects its source's cap. Used by tests and as a last check before display. */
export function isHonest(c: Cond): boolean {
  if (c.tier === null) return true;
  if (c.source === 'on_device' || c.source === 'in_cloud' || c.source === 'pack') return c.tier !== 'seen';
  return true;
}

/** Raises a condition only if the new evidence is stronger. Never lowers it. */
function raise(c: Cond, tier: Tier, next: Omit<Cond, 'tier'>): Cond {
  return tier && tierRank(tier) > tierRank(c.tier) ? { ...next, tier } : c;
}

/**
 * Lane 2: folds a Nano label for one message into an account (analyst.md 2.3). A label with a
 * verified quote reaches Likely; without one, Possible.
 */
export function applyLabel(a: Account, label: Label, msg: { msgId: string; date?: number }): Account {
  const cap = maxTier('on_device', { quote: label.quote !== '' });
  const base = { source: 'on_device' as const, msgId: msg.msgId, ...(label.quote ? { quote: label.quote } : {}),
    ...(msg.date ? { date: msg.date } : {}) };
  const out = { ...a };
  if (label.isAccount) out.exists = raise(a.exists, cap, { ...base, signal: 'Nano: account' });
  if (label.type === 'work' || label.holds === 'documents') out.work = raise(a.work, cap, { ...base, signal: `Nano: ${label.holds === 'documents' ? 'holds documents' : 'work'}` });
  if (label.holds === 'login-for-others' || label.type === 'identity') out.reset = raise(a.reset, cap, { ...base, signal: 'Nano: can reset other accounts' });
  if (label.holds === 'payment' || label.type === 'money') out.money = raise(a.money, cap, { ...base, signal: 'Nano: money' });
  return out;
}

/**
 * Lane 3: folds a service lookup into an account. It describes what this *kind* of service
 * usually holds, so it never creates existence and is capped by `basis`.
 */
export function applyServiceInfo(a: Account, info: ServiceInfo): Account {
  const cap = maxTier(info.source, { basis: info.basis, exists: a.exists.tier });
  if (!cap) return a;
  const base = { source: info.source, signal: `typical for this kind of service (${info.basis})` };
  const out = { ...a };
  if (info.category === 'work' || info.usuallyHolds === 'documents') out.work = raise(a.work, cap, base);
  if (info.category === 'identity' || info.usuallyHolds === 'login-for-others') out.reset = raise(a.reset, cap, base);
  if (info.category === 'money' || info.usuallyHolds === 'payment') out.money = raise(a.money, cap, base);
  return out;
}

/** "Likely · on-device AI · 3 Mar 2025 · “your project was saved”". */
export function describe(c: Cond): string {
  if (!c.tier) return '';
  const parts: string[] = [TIER_WORD[c.tier], SOURCE_WORD[c.source]];
  if (c.date) parts.push(new Date(c.date).toISOString().slice(0, 10));
  if (c.quote) parts.push(`“${c.quote}”`);
  return parts.join(' · ');
}

