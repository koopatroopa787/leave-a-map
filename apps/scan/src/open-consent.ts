// apps/scan/src/open-consent.ts: hands sender domains to the consent window on the cloud site.
// The scan page's CSP never changes: a popup and postMessage are not network requests from
// this page. Only `{ id, senderDomain }` leaves, and only enum answers come back.
import { MSG, parseServiceInfo, type OutboxItem, type ServiceInfo } from '../../../packages/core/handoff.ts';
import { logHandoff } from './lockdown.ts';

export const CLOUD_ORIGIN: string = import.meta.env.VITE_SCAN_CLOUD_ORIGIN ?? 'https://leave-a-map-cloud.web.app';

export type HandoffResult =
  | { kind: 'answers'; items: ServiceInfo[] }
  | { kind: 'cancelled' }
  | { kind: 'blocked' }
  | { kind: 'timeout' };

/** Call from a click handler, or the browser blocks the popup. */
export function openConsent(items: OutboxItem[], timeoutMs = 10 * 60 * 1000): Promise<HandoffResult> {
  const popup = window.open(`${CLOUD_ORIGIN}/consent.html`, 'lam-consent', 'popup,width=560,height=720');
  if (!popup) return Promise.resolve({ kind: 'blocked' });
  const sentIds = new Set(items.map((i) => i.id));
  return new Promise((resolve) => {
    let sent = false;
    const done = (r: HandoffResult) => { removeEventListener('message', onMessage); clearTimeout(timer); clearInterval(watch); resolve(r); };
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== CLOUD_ORIGIN || e.source !== popup) return;
      const type = (e.data as { type?: unknown } | null)?.type;
      if (type === MSG.ready && !sent) {
        sent = true;
        popup.postMessage({ type: MSG.outbox, items }, CLOUD_ORIGIN);
        logHandoff(items.length);
      } else if (type === MSG.services) {
        done({ kind: 'answers', items: parseServiceInfo(e.data, sentIds) });
      } else if (type === MSG.cancelled) {
        done({ kind: 'cancelled' });
      }
    };
    addEventListener('message', onMessage);
    const timer = setTimeout(() => done({ kind: 'timeout' }), timeoutMs);
    const watch = setInterval(() => { if (popup.closed) done({ kind: 'cancelled' }); }, 500);
  });
}
