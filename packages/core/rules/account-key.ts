// packages/core/rules/account-key.ts: one account per registrable sender domain (analyst.md 1.2).
import { getDomain } from 'tldts';

export function domainOf(address: string): string {
  const at = address.lastIndexOf('@');
  return (at === -1 ? address : address.slice(at + 1)).trim().toLowerCase().replace(/\.$/, '');
}

/** `mail.forkyard.example` → `forkyard.example`. Falls back to the host itself. */
export function registrableDomain(host: string): string {
  const h = host.trim().toLowerCase().replace(/\.$/, '');
  return getDomain(h) ?? h;
}

export const accountKey = (address: string) => registrableDomain(domainOf(address));

const NOISE = /\b(?:no-?reply|do-?not-?reply|notifications?|mailer|team|support)\b/gi;

/** Cleans a display name: drops quotes and words like "no-reply". */
export function cleanName(name: string): string {
  return name.replace(/["']/g, '').replace(NOISE, '').replace(/\s{2,}/g, ' ').replace(/^[\s,.\-|:]+|[\s,.\-|:]+$/g, '').trim();
}
