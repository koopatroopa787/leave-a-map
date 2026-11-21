// packages/core/cascade.ts: lane 3's escalation rule and per-field merge (BUILD-PLAN section 4).
// Pure functions, so the rule is tested here and the cloud window only wires models to it.
//
// Ask the PREFER_ON_DEVICE model first. Re-ask with ONLY_IN_CLOUD when the first answer came from
// the device and any of these holds: the reply is invalid, basis isn't "recognised", category is
// "other", or a field is blank. Then merge field by field, each field keeping the source it came from.
//
// `field-unknown` was added after the first run on the Nano machine (21 Nov): Nano said
// "recognised" for every real domain, so the other rules almost never fired. A "disagrees with the
// rules" rule was dropped (22 Nov review): the scan page never sends its own category guess, so it
// could never fire.
import type { ServiceFields } from './contract.ts';

export type AnswerSource = 'on_device' | 'in_cloud';
export type FieldName = keyof ServiceFields;
export type FieldSources = Record<FieldName, AnswerSource>;

export const ESCALATION_RULES = ['invalid', 'not-recognised', 'category-other', 'field-unknown'] as const;
export type EscalationRule = (typeof ESCALATION_RULES)[number];

export type Answer = { fields: ServiceFields | null; source: AnswerSource };
export type Merged = { fields: ServiceFields; sources: FieldSources; escalation: EscalationRule | null };

export const FIELD_NAMES: readonly FieldName[] = ['basis', 'category', 'usuallyHolds', 'loginEmailChange'];

export const SERVICE_SYSTEM_PROMPT =
  'You describe one online service from its web domain alone. You are not shown any email. ' +
  'basis: "recognised" only if you know this specific service; "name-only" if you are guessing ' +
  'from the words in the domain; "unknown" otherwise. category: the kind of service. usuallyHolds: ' +
  'what an account with this kind of service typically holds. loginEmailChange: where such services ' +
  'usually let you change the login email. Never invent details. Answer with the JSON schema only.';

export const buildServicePrompt = (senderDomain: string) => `Service domain: ${senderDomain}`;

/** Which rule sends a first answer to the cloud model, or null to keep it. Only device answers escalate. */
export function escalationReason(first: Answer): EscalationRule | null {
  if (first.source !== 'on_device') return null;
  const f = first.fields;
  if (!f) return 'invalid';
  if (f.basis !== 'recognised') return 'not-recognised';
  if (f.category === 'other') return 'category-other';
  if (f.usuallyHolds === 'nothing-seen' || f.loginEmailChange === 'unknown') return 'field-unknown';
  return null;
}

/** A value that says "I don't know" for its field. */
const WEAK: { [K in FieldName]: (v: ServiceFields[K]) => boolean } = {
  basis: (v) => v !== 'recognised',
  category: (v) => v === 'other',
  usuallyHolds: (v) => v === 'nothing-seen',
  loginEmailChange: (v) => v === 'unknown',
};

const UNKNOWN: ServiceFields = { basis: 'unknown', category: 'other', usuallyHolds: 'nothing-seen', loginEmailChange: 'unknown' };

/**
 * Merge a first answer with the cloud's second answer. A field takes the cloud value when the
 * first had nothing (invalid reply), or when the first value was weak and the cloud's isn't.
 * `basis` follows `category`, because basis is what justifies the category.
 */
export function mergeAnswers(first: Answer, second: Answer | null, escalation: EscalationRule | null): Merged {
  const allFrom = (src: AnswerSource): FieldSources => ({ basis: src, category: src, usuallyHolds: src, loginEmailChange: src });
  const a = first.fields;
  const b = second?.fields ?? null;
  if (!b) return { fields: a ?? UNKNOWN, sources: allFrom(first.source), escalation };
  if (!a) return { fields: b, sources: allFrom(second!.source), escalation };

  const fields = { ...a };
  const sources = allFrom(first.source);
  const take = <K extends FieldName>(k: K) => { (fields[k] as ServiceFields[K]) = b[k]; sources[k] = second!.source; };

  const categoryFromCloud =
    (WEAK.category(a.category) && !WEAK.category(b.category)) ||
    (WEAK.basis(a.basis) && b.basis === 'recognised');
  if (categoryFromCloud) { take('category'); take('basis'); }
  if (WEAK.usuallyHolds(a.usuallyHolds) && !WEAK.usuallyHolds(b.usuallyHolds)) take('usuallyHolds');
  if (WEAK.loginEmailChange(a.loginEmailChange) && !WEAK.loginEmailChange(b.loginEmailChange)) take('loginEmailChange');
  return { fields, sources, escalation };
}
