// apps/scan/src/receipt.ts: turns the page's own log into the privacy receipt (T26). Pure, so the
// numbers are tested. The receipt is built here, from what this page saw, and never sent anywhere.
import type { EgressEvent } from './lockdown.ts';

export type Receipt = {
  /** Things this page loaded from other sites. The claim is that this stays 0. */
  outside: EgressEvent[];
  /** Attempts the CSP or lockdown stopped. */
  blocked: EgressEvent[];
  /** Each time web addresses went to the consent window, and what came back. */
  handoffs: { at: string; shown: string[]; approved: string[] | null; outcome: string }[];
  local: EgressEvent[];
};

export function buildReceipt(events: readonly EgressEvent[]): Receipt {
  const r: Receipt = { outside: [], blocked: [], handoffs: [], local: [] };
  // Chrome also makes a resource-timing entry for a load the CSP stopped before it reached the
  // network. That one is listed once, as blocked, not as a request.
  const blockedUris = new Set(events.filter((e) => e.kind === 'blocked').map((e) => e.detail.slice(e.detail.indexOf(' ') + 1)));
  for (const e of events) {
    if (e.kind === 'resource') { if (!blockedUris.has(e.detail)) r.outside.push(e); }
    else if (e.kind === 'blocked') r.blocked.push(e);
    else if (e.kind === 'local') r.local.push(e);
    else if (e.kind === 'handoff') r.handoffs.push({ at: e.at, shown: e.domains ?? [], approved: null, outcome: 'Window still open' });
    else if (e.kind === 'answers') {
      const h = r.handoffs[r.handoffs.length - 1];
      if (h) { h.approved = e.domains ?? []; h.outcome = e.detail; }
    }
  }
  return r;
}

/** The headline: "N web addresses looked up with your approval, 0 other requests". */
export function headline(r: Receipt): string {
  const approved = r.handoffs.reduce((n, h) => n + (h.approved?.length ?? 0), 0);
  const looked = approved === 0 ? 'Nothing looked up in the cloud' : `${approved} web address${approved === 1 ? '' : 'es'} looked up with your approval`;
  return `${looked}, ${r.outside.length} other request${r.outside.length === 1 ? '' : 's'} from this page`;
}

/** Plain text, for saving a copy. */
export function receiptText(r: Receipt, now = new Date().toISOString()): string {
  const lines = [`Leave a Map privacy receipt, ${now}`, headline(r), ''];
  lines.push('Done on this device:', ...(r.local.length ? r.local.map((e) => `  ${e.at}  ${e.detail}`) : ['  (nothing recorded)']), '');
  lines.push('Consent window:', ...(r.handoffs.length ? r.handoffs.flatMap((h) => [
    `  ${h.at}  shown: ${h.shown.join(', ')}`, `  ${' '.repeat(h.at.length)}  ${h.outcome}${h.approved?.length ? `: ${h.approved.join(', ')}` : ''}`,
  ]) : ['  (not used)']), '');
  lines.push(`Requests from this page to other sites: ${r.outside.length}`, ...r.outside.map((e) => `  ${e.at}  ${e.detail}`), '');
  lines.push(`Blocked attempts: ${r.blocked.length}`, ...r.blocked.map((e) => `  ${e.at}  ${e.detail}`), '');
  lines.push("Made on this page from what it saw. It can't see your browser's own traffic, such as updates or sign-in.");
  return lines.join('\n');
}
