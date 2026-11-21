// apps/scan/src/pack-loader.ts: loads the move pack (T28) as its own chunk after the scan, so the
// first screen stays small. Bundled, not fetched: the scan page can't fetch (connect-src 'none').
import { makePack, type HandLinksFile, type Pack, type PackFile } from '../../../packages/core/pack.ts';

let loading: Promise<Pack | null> | null = null;

export function loadPack(): Promise<Pack | null> {
  loading ??= Promise.all([import('../../../data/pack.generated.json'), import('../../../data/hand-links.json')])
    .then(([p, h]) => makePack(p.default as unknown as PackFile, h.default as unknown as HandLinksFile))
    .catch(() => null); // Without the pack, cards fall back to "open <domain> → account settings".
  return loading;
}
