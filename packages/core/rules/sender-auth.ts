// packages/core/rules/sender-auth.ts: is the From domain authentic? (analyst.md 1.3, RFC 8601, RFC 8617)
// Only the topmost Authentication-Results counts: the person's own provider adds it, and lower
// ones can be forged by senders.
import type { MessageRecord } from '../types.ts';
import { domainOf, registrableDomain } from './account-key.ts';

export type AuthVerdict = 'pass' | 'pass-forwarded' | 'fail' | 'unknown';

const DMARC = /\bdmarc=(pass|fail|none|bestguesspass|temperror|permerror)\b[^;]*?\bheader\.from=([^\s;]+)/i;
const DKIM = /\bdkim=(pass|fail|neutral|none|policy|temperror|permerror)\b[^;]*?\bheader\.(?:d|i)=@?([^\s;]+)/gi;
const SPF = /\bspf=(pass|fail|softfail|neutral|none|temperror|permerror)\b/i;
const ARC = /\barc=(pass|fail|none)\b/i;

const org = (d: string) => registrableDomain(domainOf(d.replace(/^["<]+|[">]+$/g, '')));

function judge(results: string, fromOrg: string): 'pass' | 'fail' | 'other' {
  const dmarc = DMARC.exec(results);
  const dkimAligned = [...results.matchAll(DKIM)].some((m) => m[1].toLowerCase() === 'pass' && org(m[2]) === fromOrg);
  if (dmarc && dmarc[1].toLowerCase() === 'pass' && org(dmarc[2]) === fromOrg) return 'pass';
  if (dkimAligned) return 'pass';
  if (dmarc && dmarc[1].toLowerCase() === 'fail') return 'fail';
  const spf = SPF.exec(results)?.[1].toLowerCase();
  if (spf === 'fail' || spf === 'softfail') return 'fail';
  return 'other';
}

export function senderAuth(m: MessageRecord): AuthVerdict {
  if (!m.from || !m.authResults) return 'unknown';
  const fromOrg = accountOrg(m.from.address);
  const outer = judge(m.authResults, fromOrg);
  if (outer === 'pass') return 'pass';
  if (ARC.exec(m.authResults)?.[1].toLowerCase() === 'pass' && m.arcResults && judge(m.arcResults, fromOrg) === 'pass') {
    return 'pass-forwarded';
  }
  return outer === 'fail' ? 'fail' : 'unknown';
}

const accountOrg = (address: string) => registrableDomain(domainOf(address));
