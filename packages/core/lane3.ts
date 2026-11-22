// packages/core/lane3.ts: what the scan page does with lane 3 answers (T24). Applies them under
// the evidence caps and turns each answer into card lines, one per field, each with the model it
// came from, plus the cascade trail ("On-device: not recognised → asked the cloud").
// Wording rule (BUILD-PLAN section 4): "typical for this kind of service", never "your account holds".
import type { AccountType, Holds, LoginEmailChange, Basis } from './contract.ts';
import type { AnswerSource, EscalationRule } from './cascade.ts';
import type { ServiceInfo } from './handoff.ts';
import type { Account } from './types.ts';
import { applyServiceInfo } from './evidence.ts';

export const CATEGORY_WORD: Record<AccountType, string> = {
  money: 'a bank or payment service', identity: 'an account that can reset other accounts', school: 'a learning service',
  work: 'a place where people keep work', health: 'a health service', government: 'a government service',
  shopping: 'a shop', social: 'a social network', subscription: 'a subscription', other: '',
};
export const HOLDS_WORD: Record<Holds, string> = {
  payment: 'payment details', documents: 'files or documents', 'login-for-others': 'logins for other accounts',
  purchases: 'order history', 'nothing-seen': '',
};
export const CHANGE_WORD: Record<LoginEmailChange, string> = {
  'account-settings': 'usually in account settings', 'security-settings': 'usually in security settings',
  'contact-support': 'usually by contacting support', unknown: '',
};
export const BASIS_WORD: Record<Basis, string> = { recognised: 'a service the model knows', 'name-only': 'guessed from the name', unknown: 'not recognised' };
export const RULE_WORD: Record<EscalationRule, string> = {
  invalid: 'no usable answer', 'not-recognised': 'not recognised', 'category-other': "couldn't say what kind of service",
  'field-unknown': 'left a field blank',
};

export type Line = { label: string; value: string; source: AnswerSource };

/**
 * One line per field the models could fill. Blank answers ("other", "unknown") are left out, and
 * so is everything when the final answer is "not recognised": a model that says it doesn't know
 * the service shouldn't be shown guessing what it holds.
 */
export function serviceLines(info: ServiceInfo): Line[] {
  const lines: Line[] = [];
  if (info.basis === 'unknown') return lines;
  if (CATEGORY_WORD[info.category]) lines.push({ label: 'Kind of service', value: CATEGORY_WORD[info.category], source: info.sources.category });
  if (HOLDS_WORD[info.usuallyHolds]) lines.push({ label: 'Usually holds', value: HOLDS_WORD[info.usuallyHolds], source: info.sources.usuallyHolds });
  if (CHANGE_WORD[info.loginEmailChange]) lines.push({ label: 'Where to change the login email', value: `${CHANGE_WORD[info.loginEmailChange]} (suggested, not checked)`, source: info.sources.loginEmailChange });
  return lines;
}

/** How the answer was reached, in one line. */
export function trail(info: ServiceInfo): string {
  const sources = Object.values(info.sources);
  if (info.escalation) return `On-device: ${RULE_WORD[info.escalation]} → asked the cloud`;
  if (sources.every((s) => s === 'in_cloud')) return 'On-device AI not available in the lookup window → cloud';
  return 'Answered on-device';
}

/** Answers keyed by account key, ignoring ids the scan page never sent. */
export function answersByKey(answers: readonly ServiceInfo[], keyById: ReadonlyMap<string, string>): Map<string, ServiceInfo> {
  const out = new Map<string, ServiceInfo>();
  for (const a of answers) { const k = keyById.get(a.id); if (k) out.set(k, a); }
  return out;
}

export function applyLane3<T extends Account>(accounts: readonly T[], byKey: ReadonlyMap<string, ServiceInfo>): T[] {
  return accounts.map((a) => { const i = byKey.get(a.key); return i ? applyServiceInfo(a, i) as T : a; });
}
