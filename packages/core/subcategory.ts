// packages/core/subcategory.ts: groups inside each line of the list, so a long line reads as
// "Banks and payments", "Insurance", "Bills and utilities" and so on. Decided from words in the
// service's name, its domain and the subjects quoted as evidence. Pure, and only for display:
// it never changes the order of the lines or which line an account is in.
import type { Account, Bucket } from './types.ts';

type Rule = [label: string, words: RegExp];

const RULES: Record<Bucket, Rule[]> = {
  money: [
    ['Insurance', /insur|mutual|assur|\bpolicy\b|\bcover\b|claim/i],
    ['Pensions and investments', /pension|retire|invest|\bisa\b|shares|stocks?|broker|\bfunds?\b|crypto/i],
    ['Bills and utilities', /energy|electric|\bgas\b|water|council|broadband|fibre|fiber|mobile|telecom|internet|\bphone\b|\bbill\b|bill is|utility/i],
    ['Subscriptions', /subscri|renew|stream|membership|premium|plan renewed/i],
    ['Banks and payments', /bank|current account|savings|credit|card|\bpay|wallet|purse|money|loan|mortgage|transfer|sent £|sent \$/i],
  ],
  work: [
    ['Photos', /photo|album|picture|image|gallery/i],
    ['Code', /\bgit|code|repo|commit|pull request/i],
    ['Files and notes', /file|folder|drive|docs?\b|document|notes?|notebook|page|cloud|storage|box/i],
  ],
  reset: [
    ['Passwords', /password|vault|keychain|\bpass\b|authenticator|2fa/i],
    ['Phone', /mobile|phone|\bsim\b|carrier/i],
    ['Email', /mail|inbox/i],
  ],
  sso: [],
  rest: [
    ['Shopping', /order|shop|store|books?\b|cart|deliver|receipt|purchase|market/i],
    ['Social and community', /club|community|social|forum|friend|chat|network|group|garden|church|neighbo|messag/i],
    ['Entertainment and media', /music|video|film|movie|stream|\btv\b|game|podcast|news/i],
    ['Travel', /travel|airline|flight|hotel|booking|rail|trip/i],
    ['Learning and research', /course|universit|college|learn|research|journal|arxiv|zenodo|openreview|library/i],
  ],
};

/** The order groups are shown in: the most important kinds first, whatever the list order. */
const SHOW: Record<Bucket, string[]> = {
  money: ['Banks and payments', 'Pensions and investments', 'Insurance', 'Bills and utilities', 'Subscriptions', 'Other money'],
  work: ['Photos', 'Files and notes', 'Code', 'Other files'],
  reset: ['Email', 'Phone', 'Passwords', 'Other'],
  sso: [],
  rest: ['Shopping', 'Social and community', 'Entertainment and media', 'Travel', 'Learning and research', 'Other sites'],
};

const OTHER: Record<Bucket, string> = {
  money: 'Other money', work: 'Other files', reset: 'Other', sso: '', rest: 'Other sites',
};

/** The group an account goes in, within its line. '' means the line has no groups. */
export function subcategory(a: Pick<Account, 'name' | 'key' | 'exists' | 'money' | 'work' | 'reset' | 'sso'>, bucket: Bucket): string {
  const rules = RULES[bucket];
  if (!rules.length) return '';
  const text = [a.name, a.key, a.exists.quote, a.money.quote, a.work.quote, a.reset.quote, a.sso.quote].filter(Boolean).join(' ');
  return rules.find(([, re]) => re.test(text))?.[0] ?? OTHER[bucket];
}

/**
 * Split a ranked line into groups, keeping the list order inside each group and showing the groups
 * in a fixed order (banks before subscriptions). A line with one group comes back as one unnamed group.
 */
export function groupLine<T extends Parameters<typeof subcategory>[0]>(list: T[], bucket: Bucket): { label: string; items: T[] }[] {
  const groups = new Map<string, T[]>();
  for (const a of list) {
    const k = subcategory(a, bucket);
    groups.set(k, [...(groups.get(k) ?? []), a]);
  }
  if (groups.size <= 1) return [{ label: '', items: list }];
  const at = (l: string) => SHOW[bucket].indexOf(l);
  return [...groups.entries()].sort((x, y) => at(x[0]) - at(y[0])).map(([label, items]) => ({ label, items }));
}
