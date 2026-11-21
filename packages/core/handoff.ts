// packages/core/handoff.ts: the only data allowed to leave the scan site, and the only
// answers allowed back in. Locked: `{ id, senderDomain }` out, enums in (BUILD-PLAN section 1).
import { parseServiceFields, type ServiceFields } from './contract.ts';

export type OutboxItem = { id: string; senderDomain: string };
export type ServiceInfo = ServiceFields & { id: string; source: 'on_device' | 'in_cloud' };

export const MAX_OUTBOX = 40;
const DOMAIN_RE = /^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

export function toOutboxItem(id: string, senderDomain: string): OutboxItem {
  const d = senderDomain.trim().toLowerCase();
  if (!DOMAIN_RE.test(d)) throw new Error('bad sender domain');
  if (!/^[a-z0-9-]{1,40}$/i.test(id)) throw new Error('bad id');
  return { id, senderDomain: d };
}

/** Scan side: accept only enums, only for ids we actually sent. Anything else is dropped. */
export function parseServiceInfo(data: unknown, sentIds: ReadonlySet<string>): ServiceInfo[] {
  const msg = data as { type?: unknown; items?: unknown } | null;
  if (msg?.type !== 'lam.services' || !Array.isArray(msg.items)) return [];
  const seen = new Set<string>();
  return msg.items.flatMap((item: any) => {
    if (typeof item?.id !== 'string' || !sentIds.has(item.id) || seen.has(item.id)) return [];
    if (item.source !== 'on_device' && item.source !== 'in_cloud') return [];
    const fields = parseServiceFields(item);
    if (!fields) return [];
    seen.add(item.id);
    return [{ id: item.id, source: item.source, ...fields }];
  });
}

/** Message names between the two sites. Everything else is ignored. */
export const MSG = { ready: 'lam.ready', outbox: 'lam.outbox', services: 'lam.services', cancelled: 'lam.cancelled' } as const;

/** Cloud side: accept an outbox only if every item is a valid `{ id, senderDomain }`, nothing more. */
export function parseOutbox(data: unknown): OutboxItem[] | null {
  const msg = data as { type?: unknown; items?: unknown } | null;
  if (msg?.type !== MSG.outbox || !Array.isArray(msg.items) || msg.items.length === 0 || msg.items.length > MAX_OUTBOX) return null;
  const out: OutboxItem[] = [];
  for (const item of msg.items) {
    if (typeof item !== 'object' || item === null || Object.keys(item).sort().join() !== 'id,senderDomain') return null;
    try { out.push(toOutboxItem((item as OutboxItem).id, (item as OutboxItem).senderDomain)); } catch { return null; }
  }
  return new Set(out.map((i) => i.id)).size === out.length ? out : null;
}
