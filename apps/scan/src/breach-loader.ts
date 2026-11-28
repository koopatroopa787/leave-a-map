// apps/scan/src/breach-loader.ts: the breach snapshot as its own chunk, loaded after the scan.
// Bundled, not fetched: the scan page can't fetch (connect-src 'none').
import type { BreachFile } from '../../../packages/core/breaches.ts';

let loading: Promise<BreachFile | null> | null = null;

export function loadBreaches(): Promise<BreachFile | null> {
  loading ??= import('../../../data/breaches.json').then((m) => m.default as unknown as BreachFile).catch(() => null);
  return loading;
}
