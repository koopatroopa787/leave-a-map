// packages/core/rules/signals.ts: which service-mail signals one message fires (analyst.md 1.4, 1.5).
import type { MessageRecord } from '../types.ts';
import type { BodyInfo } from '../mbox/body.ts';
import { P, SSO_PHRASE } from './patterns.ts';
import { escapeRe } from './school-link.ts';

export type SignalName = 'WELCOME' | 'VERIFY' | 'RESET' | 'SECURITY' | 'RECEIPT' | 'STATEMENT' | 'RECURRING'
  | 'CARD ON FILE' | 'RECOVERY ADDRESS' | 'WORK STRONG' | 'WORK WEAK' | 'STUDENT DISCOUNT' | 'HEALTH' | 'SSO-WELCOME' | 'NO-PASSWORD HINT';
export type Fired = { name: SignalName; quote: string };

/** Signals that prove an account exists, and so stop List-Unsubscribe mail counting as bulk. */
export const EXISTENCE: ReadonlySet<SignalName> = new Set(['WELCOME', 'VERIFY', 'RESET', 'SECURITY', 'RECEIPT', 'STATEMENT']);

const QUOTE_MAX = 160;

/** A short quote around the match, copied exactly from the source text. */
function quoteAround(text: string, index: number, length: number): string {
  if (length >= QUOTE_MAX) return text.slice(index, index + QUOTE_MAX);
  const pad = Math.floor((QUOTE_MAX - length) / 2);
  let start = Math.max(0, index - pad);
  let end = Math.min(text.length, index + length + pad);
  const sp = text.lastIndexOf(' ', index);
  if (start > 0 && sp > start && sp < index) start = sp + 1;
  const ep = text.indexOf(' ', index + length);
  if (end < text.length && ep !== -1 && ep < end) end = ep;
  return text.slice(start, end).trim();
}

function find(re: RegExp, text: string): string | null {
  const m = re.exec(text);
  return m ? quoteAround(text, m.index, m[0].length) : null;
}

export function messageSignals(m: MessageRecord, body: BodyInfo, ownAddresses: readonly string[]): Fired[] {
  const S = m.subject;
  const B = body.text;
  const out: Fired[] = [];
  const add = (name: SignalName, quote: string | null) => { if (quote !== null) out.push({ name, quote }); };
  const either = (re: RegExp) => find(re, S) ?? find(re, B);

  add('WELCOME', find(P.WELCOME_S, S) ?? find(P.WELCOME_B, B));
  add('VERIFY', find(P.VERIFY_S, S) ?? find(P.VERIFY_B, B));
  add('RESET', find(P.RESET_S, S) ?? find(P.RESET_B, B));
  add('SECURITY', find(P.SECURITY_S, S));
  const amount = P.AMOUNT.test(S) || P.AMOUNT.test(B);
  const receipt = find(P.RECEIPT_S, S);
  if (receipt && amount) add('RECEIPT', receipt);
  else if (body.orderMarkup) add('RECEIPT', S || 'order details in the email');
  add('STATEMENT', find(P.STATEMENT_S, S));
  if (amount) add('RECURRING', either(P.RECURRING));
  add('CARD ON FILE', find(P.CARD_ON_FILE, B));
  add('WORK STRONG', either(P.WORK_STRONG));
  if (!out.some((f) => f.name === 'WORK STRONG')) add('WORK WEAK', either(P.WORK_WEAK));
  add('STUDENT DISCOUNT', either(P.STUDENT_DISCOUNT));
  add('HEALTH', either(P.HEALTH));
  add('SSO-WELCOME', find(P.SSO_WELCOME, B) ?? find(SSO_PHRASE, B));
  add('NO-PASSWORD HINT', find(P.NO_PASSWORD, B));

  // RECOVERY ADDRESS: the phrase, with one of the person's own addresses within 120 characters.
  const rec = P.RECOVERY_B.exec(B);
  if (rec) {
    const near = B.slice(Math.max(0, rec.index - 120), rec.index + rec[0].length + 120);
    if (ownAddresses.some((a) => new RegExp(escapeRe(a), 'i').test(near))) add('RECOVERY ADDRESS', quoteAround(B, rec.index, rec[0].length));
  }
  return out;
}
