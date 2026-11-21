// packages/core/handoff.ts: the only data allowed to leave the scan site, and the only
// answers allowed back in. Locked: `{ id, senderDomain }` out, enums in (BUILD-PLAN section 1).
import { parseServiceFields, type ServiceFields } from './contract.ts';
import { ESCALATION_RULES, FIELD_NAMES, type EscalationRule, type FieldSources } from './cascade.ts';

/**
 * `sensitive` marks rows the consent window must not include in "Select all": a health or money
 * service. It travels only between the user's two windows; the model is only ever given the domain.
 */
export type Sensitive = 'health' | 'money';
export type OutboxItem = { id: string; senderDomain: string; sensitive?: Sensitive };
/** One lane 3 answer. Each field says which model it came from; `escalation` names the rule that re-asked the cloud. */
export type ServiceInfo = ServiceFields & { id: string; sources: FieldSources; escalation: EscalationRule | null };

function parseSources(v: unknown): FieldSources | null {
  const o = v as Record<string, unknown> | null;
  if (typeof o !== 'object' || o === null || Object.keys(o).length !== FIELD_NAMES.length) return null;
  for (const k of FIELD_NAMES) if (o[k] !== 'on_device' && o[k] !== 'in_cloud') return null;
  return o as FieldSources;
}

export const MAX_OUTBOX = 40;
const DOMAIN_RE = /^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

export function toOutboxItem(id: string, senderDomain: string, sensitive?: Sensitive): OutboxItem {
  const d = senderDomain.trim().toLowerCase();
  if (!DOMAIN_RE.test(d)) throw new Error('bad sender domain');
  if (!/^[a-z0-9-]{1,40}$/i.test(id)) throw new Error('bad id');
  if (sensitive !== undefined && sensitive !== 'health' && sensitive !== 'money') throw new Error('bad sensitive');
  return sensitive ? { id, senderDomain: d, sensitive } : { id, senderDomain: d };
}

/** Scan side: accept only enums, only for ids we actually sent. Anything else is dropped. */
export function parseServiceInfo(data: unknown, sentIds: ReadonlySet<string>): ServiceInfo[] {
  const msg = data as { type?: unknown; items?: unknown } | null;
  if (msg?.type !== 'lam.services' || !Array.isArray(msg.items)) return [];
  const seen = new Set<string>();
  return msg.items.flatMap((item: any) => {
    if (typeof item?.id !== 'string' || !sentIds.has(item.id) || seen.has(item.id)) return [];
    const sources = parseSources(item.sources);
    const escalation = item.escalation === null ? null : (ESCALATION_RULES as readonly unknown[]).includes(item.escalation) ? item.escalation as EscalationRule : undefined;
    const fields = parseServiceFields(item);
    if (!fields || !sources || escalation === undefined) return [];
    seen.add(item.id);
    return [{ id: item.id, ...fields, sources: { ...sources }, escalation }];
  });
}

/** Message names between the two sites. Everything else is ignored. */
export const MSG = { ready: 'lam.ready', outbox: 'lam.outbox', services: 'lam.services', cancelled: 'lam.cancelled' } as const;

/** Cloud side: accept an outbox only if every item is a valid `{ id, senderDomain, sensitive? }`, nothing more. */
export function parseOutbox(data: unknown): OutboxItem[] | null {
  const msg = data as { type?: unknown; items?: unknown } | null;
  if (msg?.type !== MSG.outbox || !Array.isArray(msg.items) || msg.items.length === 0 || msg.items.length > MAX_OUTBOX) return null;
  const out: OutboxItem[] = [];
  for (const item of msg.items) {
    const keys = typeof item === 'object' && item !== null ? Object.keys(item).sort().join() : '';
    if (keys !== 'id,senderDomain' && keys !== 'id,senderDomain,sensitive') return null;
    const it = item as OutboxItem;
    try { out.push(toOutboxItem(it.id, it.senderDomain, it.sensitive)); } catch { return null; }
  }
  return new Set(out.map((i) => i.id)).size === out.length ? out : null;
}
