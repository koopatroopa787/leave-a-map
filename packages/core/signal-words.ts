// packages/core/signal-words.ts: plain words for the rule and label names that evidence carries.
// Display only: the stored signal ids stay as they are, because tests, the golden file and the
// evaluation read them. Anything not listed (pack, lane 3, "you confirmed") is already words.
import { BASIS_WORD } from './lane3.ts';
import type { Basis } from './contract.ts';

const WORDS: Record<string, string> = {
  WELCOME: 'a welcome email',
  VERIFY: 'a request to confirm your email address',
  RESET: 'a password-reset email',
  SECURITY: 'a security alert',
  RECEIPT: 'a receipt',
  STATEMENT: 'a statement or payment notice',
  RECURRING: 'a renewal or subscription notice',
  'CARD ON FILE': 'a saved card or payment method',
  HEALTH: 'health-related mail',
  'RECOVERY ADDRESS': 'your old address set as a recovery address',
  'PASSWORD MANAGER': 'a password manager, which can open your other accounts',
  'SSO-WELCOME': 'a sign-up with your school or work account',
  'NO-PASSWORD HINT': 'a sign the account has no password of its own',
  'IDP-NOTICE': 'a notice that it was given access to your school or work account',
  'STUDENT DISCOUNT': 'a student discount',
  'WORK STRONG': 'activity on your work, such as edits, comments or merges',
  'WORK WEAK': 'signs that you keep work there',
  'newsletters only': 'only newsletters so far',
  'Nano: account': 'one of your emails reads like an account',
  'Nano: work': 'one of your emails reads like work',
  'Nano: holds documents': 'one of your emails mentions your files or documents',
  'Nano: can reset other accounts': 'one of your emails reads like it can reset other accounts',
  'Nano: money': 'one of your emails is about money',
};

export function signalWords(signal: string): string {
  const n = /^TRANSACTIONAL ×(\d+)$/.exec(signal);
  if (n) return Number(n[1]) === 1 ? '1 service email, such as a receipt, alert or confirmation'
    : `${n[1]} service emails, such as receipts, alerts or confirmations`;
  const typical = /^typical for this kind of service \(([a-z-]+)\)$/.exec(signal);
  if (typical && typical[1] in BASIS_WORD) return `typical for this kind of service (${BASIS_WORD[typical[1] as Basis]})`;
  return WORDS[signal] ?? signal;
}
