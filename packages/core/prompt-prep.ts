// packages/core/prompt-prep.ts: shortens and cleans one email before Nano reads it (BUILD-PLAN
// section 4, "Redaction becomes 2 hours of prompt prep"). Nano runs on the device, so this is for
// quality and prompt-injection hygiene, not privacy: fewer tokens, no links to follow, no codes.

/** Characters of email text given to Nano per message. Nano's context is small; this keeps it fast. */
export const PROMPT_BUDGET = 1200;

const REPLY_MARKERS = [
  /^On .{4,200}\bwrote:\s*$/m,
  /^-{2,}\s*Original Message\s*-{2,}\s*$/im,
  /^-{5,}\s*Forwarded message\s*-{5,}\s*$/im,
  /^Begin forwarded message:\s*$/im,
  /^From: .+\n(?:Sent|Date): .+\n/im,
];

/** Cuts the text at the first quoted reply or forwarded block, and drops `>` lines. */
export function dropQuoted(text: string): string {
  let cut = text.length;
  for (const re of REPLY_MARKERS) {
    const m = re.exec(text);
    if (m && m.index < cut) cut = m.index;
  }
  return text.slice(0, cut).split('\n').filter((l) => !/^\s*>/.test(l)).join('\n');
}

const LINK = /\b(?:https?:\/\/|www\.)[^\s<>"')\]]+/gi;
const ADDRESS = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
// 4–12 characters, letters and digits mixed, with at least one digit: one-time codes, order ids.
const CODE = /\b(?=[a-z0-9-]{4,12}\b)(?=[a-z0-9-]*\d)(?=[a-z0-9-]*[a-z])[a-z0-9]+(?:-[a-z0-9]+)*\b/gi;
// Four or more digits, possibly spaced or dashed: card, phone and account numbers. Amounts like 120.00 stay.
const LONG_NUMBER = /\b\d(?:[\s-]?\d){3,}\b/g;

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Replaces links, addresses, codes, long numbers and the person's own name with placeholders. */
export function redact(text: string, ownTokens: readonly string[] = []): string {
  let out = text.replace(LINK, '[link]').replace(ADDRESS, '[address]').replace(CODE, '[code]').replace(LONG_NUMBER, '[number]');
  for (const t of ownTokens) {
    if (t.length < 3) continue;
    out = out.replace(new RegExp(`\\b${escapeRe(t)}\\b`, 'gi'), '[you]');
  }
  return out;
}

/** Trims to `budget` characters at a word boundary. */
export function trimTo(text: string, budget: number): string {
  if (text.length <= budget) return text;
  const cut = text.lastIndexOf(' ', budget);
  return `${text.slice(0, cut > 0 ? cut : budget).trimEnd()} …`;
}

/** Name tokens from an address like "jane.reyes@school.edu": ["jane", "reyes"]. */
export function nameTokens(addresses: readonly string[]): string[] {
  return [...new Set(addresses.flatMap((a) => a.split('@')[0].split(/[._+-]+/)).filter((t) => /^[a-z]{3,}$/i.test(t)))];
}

/** The text Nano reads for one message: cleaned subject and body, within budget. */
export function prepForPrompt(subject: string, bodyText: string, opts: { ownAddresses?: readonly string[]; budget?: number } = {}): string {
  const tokens = nameTokens(opts.ownAddresses ?? []);
  const clean = (s: string) => redact(s, tokens).replace(/[^\S\n]+/g, ' ').replace(/\n{2,}/g, '\n').trim();
  const subj = clean(subject);
  const body = clean(dropQuoted(bodyText));
  return trimTo(`Subject: ${subj}\n${body}`, opts.budget ?? PROMPT_BUDGET);
}
