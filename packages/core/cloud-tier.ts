// packages/core/cloud-tier.ts: which Gemini tier the cloud lookup (lane 3) runs on in this build,
// and what that changes in the consent window. One build switch, VITE_CLOUD_LOOKUP, read by both
// sites so they agree:
//   paid-tier-on  the project is on Gemini's paid tier (Blaze). Paid-terms notice.
//   free-tier-on  the project is on the free tier (Spark). Free-terms notice, a required "not in
//                 the EEA, Switzerland or the UK" box, health and money rows can't be sent, and at
//                 most FREE_TIER_MAX services per lookup.
//   anything else off in production: the scan site hides the lookup, the consent window refuses it.
// Local development is always on: it follows the switch when set, and uses the paid wording otherwise.
import type { OutboxItem } from './handoff.ts';

export type CloudTier = 'paid' | 'free' | 'off';

export function cloudTier(switchValue: string | undefined, dev: boolean): CloudTier {
  if (switchValue === 'paid-tier-on') return 'paid';
  if (switchValue === 'free-tier-on') return 'free';
  return dev ? 'paid' : 'off';
}

/** The free tier's rate limits are low, so one lookup sends at most this many services. */
export const FREE_TIER_MAX = 10;

/**
 * The free terms ask for no sensitive or personal information, so on the free tier a health or
 * money row can't be ticked at all. On the paid tier it can, ticked on its own.
 */
export function canSend(tier: CloudTier, item: OutboxItem): boolean {
  if (tier === 'off') return false;
  return tier === 'paid' || !item.sensitive;
}

export interface Gate { adult: boolean; region: boolean; ticked: number }

/** Why the send button is off, or null when it can send. Order matches what the window asks for. */
export function blockedBy(tier: CloudTier, g: Gate): 'off' | 'adult' | 'region' | 'none-ticked' | 'too-many' | null {
  if (tier === 'off') return 'off';
  if (!g.adult) return 'adult';
  if (tier === 'free' && !g.region) return 'region';
  if (g.ticked === 0) return 'none-ticked';
  if (tier === 'free' && g.ticked > FREE_TIER_MAX) return 'too-many';
  return null;
}

/**
 * True when the model refused because the project is out of quota (HTTP 429). Quota is per
 * project, shared by everyone using the site, so on the free tier this is expected on busy days.
 */
export function isQuotaError(e: unknown): boolean {
  const err = e as { customErrorData?: { status?: number }; message?: unknown } | null;
  if (err?.customErrorData?.status === 429) return true;
  return typeof err?.message === 'string' && /\[429\b|RESOURCE_EXHAUSTED/.test(err.message);
}

/** Thrown by the lookup when quota runs out. Carries the answers it got before that. */
export class LookupBusy<T> extends Error {
  constructor(readonly partial: T[]) { super('busy'); this.name = 'LookupBusy'; }
}

/** What the consent window says when the lookup is busy. */
export function busyWords(done: number, total: number): string {
  const lead = 'The cloud lookup is busy right now, because too many people are using it. Try again later.';
  if (done === 0) return `${lead} Nothing was looked up or sent back.`;
  return `${lead} ${done} of ${total} ${total === 1 ? 'service was' : 'services were'} looked up first, and only those answers were sent back.`;
}

/**
 * Runs `one` on each item in order. If quota runs out, stops and throws LookupBusy with the
 * answers so far; any other error passes through unchanged.
 */
export async function lookupEach<I, T>(items: I[], one: (item: I) => Promise<T>, onProgress?: (done: number) => void): Promise<T[]> {
  const out: T[] = [];
  for (const item of items) {
    try {
      out.push(await one(item));
    } catch (e) {
      if (isQuotaError(e)) throw new LookupBusy(out);
      throw e;
    }
    onProgress?.(out.length);
  }
  return out;
}
