// packages/core/answer-key.ts: what a person would expect from each sample mailbox, written from the
// generators (tools/make-sample-mbox.mjs, tools/make-estate-mbox.mjs), not from the scan's output.
// Scored on the list as the page shows it (rules plus the move pack). The map shows the score on the samples, misses included, so a judge can check the scan in a minute.
import type { Bucket, RankedAccount, Section } from './types.ts';

/** An account the sample holds. `line`: the line a person would put it in; 'listed' means Maybe is fine too. */
export type Planted = { key: string; name: string; line: Bucket | 'listed' };
/** A trap: mail that looks like an account but isn't one of theirs. */
export type Trap = { key: string; what: string; want: Section | 'absent' | 'not-main' | 'fake-ignored' };
export type AnswerKey = { planted: Planted[]; traps: Trap[] };

const p = (key: string, name: string, line: Planted['line']): Planted => ({ key, name, line });

const SCHOOL: AnswerKey = {
  planted: [
    p('forkyard.example', 'Forkyard', 'sso'), p('notebloom.example', 'Notebloom', 'sso'),
    p('proofwright.example', 'Proofwright', 'work'), p('sketchloom.example', 'Sketchloom', 'work'), p('stowbin.example', 'Stowbin', 'work'),
    p('tidemail.example', 'Tidemail', 'reset'), p('latchkin.example', 'Latchkin', 'reset'),
    p('brightpenny.example', 'Brightpenny', 'money'), p('paywisp.example', 'Paywisp', 'money'), p('tunefield.example', 'Tunefield', 'money'),
    // A shop that keeps a card on file: the move pack says Parcelpine usually holds a payment method.
    p('parcelpine.example', 'Parcelpine', 'money'), p('munchroute.example', 'Munchroute', 'rest'), p('mendwise.example', 'Mendwise', 'rest'),
    // One email each, so Maybe is a fair place for them.
    p('learnridge.example', 'Learnridge', 'listed'), p('citewell.example', 'Citewell', 'listed'), p('chirpline.example', 'Chirpline', 'listed'),
    p('tallyquiz.example', 'Tallyquiz', 'listed'), p('arxiv.org', 'arXiv', 'listed'), p('zenodo.org', 'Zenodo', 'listed'), p('openreview.net', 'OpenReview', 'listed'),
  ],
  traps: [
    { key: 'brightpenny.example', what: 'A fake Brightpenny email that failed the sender checks', want: 'fake-ignored' },
    { key: 'notebioom.example', what: 'A lookalike of Notebloom, spelt with a capital I', want: 'ignored' },
    { key: 'forkyard-verify.example', what: 'A lookalike of Forkyard asking for a password', want: 'ignored' },
    { key: 'hireloft.example', what: 'A friend forwarding their own Hireloft welcome', want: 'absent' },
    { key: 'pixelquay.example', what: 'Pixelquay mail forwarded in from a personal address', want: 'elsewhere' },
    { key: 'alderbrook.example', what: 'Mail run by the school itself', want: 'ends-anyway' },
    { key: 'vistaroam.example', what: 'Vistaroam: offers only, no account', want: 'not-main' },
  ],
};

const LOSS: AnswerKey = {
  planted: [
    p('harbourline.example', 'Harbourline Bank', 'money'), p('oakmere-pensions.example', 'Oakmere Pensions', 'money'),
    p('kestrelmutual.example', 'Kestrel Mutual', 'money'), p('coinpurse.example', 'Coinpurse', 'money'),
    p('brightwell-energy.example', 'Brightwell Energy', 'money'), p('fernway.example', 'Fernway Broadband', 'money'),
    p('reelhouse.example', 'Reelhouse', 'money'), p('signalpoint.example', 'Signalpoint Mobile', 'money'),
    p('lumenbox.example', 'Lumenbox', 'work'), p('inkwell.example', 'Inkwell Notes', 'work'),
    p('latchvault.example', 'Latchvault', 'reset'),
    p('larkspur-books.example', 'Larkspur Books', 'rest'), p('thornfield-gardens.example', 'Thornfield Garden Club', 'rest'), p('murmur.example', 'Murmur', 'rest'),
    p('riverside-surgery.example', 'Riverside Surgery', 'listed'),
  ],
  traps: [
    { key: 'harbourline-secure.example', what: 'A fake Harbourline Bank email asking to "verify now"', want: 'ignored' },
    { key: 'mailbox.example', what: 'Mail from their own email provider', want: 'ends-anyway' },
    { key: 'wayfarer-travel.example', what: 'Wayfarer Travel: offers only, no account', want: 'not-main' },
  ],
};

export const answerKey = (mode: 'school' | 'loss'): AnswerKey => (mode === 'loss' ? LOSS : SCHOOL);

export type Score = {
  found: number; plantedOf: number; sorted: number; sortedOf: number; caught: number; trapsOf: number;
  /** One plain line per miss, for the page. */
  misses: string[];
};

export function scoreSample(accounts: RankedAccount[], key: AnswerKey, lineName: (b: Bucket) => string): Score {
  const by = new Map(accounts.map((a) => [a.key, a]));
  const misses: string[] = [];
  let found = 0, sorted = 0, sortedOf = 0, caught = 0;
  for (const x of key.planted) {
    const a = by.get(x.key);
    const listed = a?.section === 'main' || (x.line === 'listed' && a?.section === 'maybe');
    if (listed) found++; else misses.push(`${x.name} wasn't ${x.line === 'listed' ? 'listed' : 'on the main list'}${a ? ` (it's under "${a.section}")` : ''}.`);
    if (x.line === 'listed') continue;
    sortedOf++;
    if (a?.section === 'main' && a.bucket === x.line) sorted++;
    else if (a?.section === 'main') misses.push(`${x.name} is under "${lineName(a.bucket)}", not "${lineName(x.line)}".`);
  }
  for (const t of key.traps) {
    const a = by.get(t.key);
    const ok = t.want === 'absent' ? !a
      : t.want === 'not-main' ? a?.section !== 'main'
      : t.want === 'fake-ignored' ? (a?.flags.suspiciousIgnored ?? 0) > 0
      : a?.section === t.want;
    if (ok) caught++; else misses.push(`Trap missed: ${t.what}.`);
  }
  return { found, plantedOf: key.planted.length, sorted, sortedOf, caught, trapsOf: key.traps.length, misses };
}
