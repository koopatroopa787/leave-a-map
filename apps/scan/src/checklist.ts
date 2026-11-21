// apps/scan/src/checklist.ts: which accounts the person has marked "moved". Kept only in this
// browser's localStorage, per school domain. Every access is wrapped: storage can be blocked
// (private windows, cleared site data) and the list must still work, just without memory.
type Store = Pick<Storage, 'getItem' | 'setItem'>;

const keyFor = (schoolDomain: string) => `lam.moved.${schoolDomain.toLowerCase()}`;

function storage(): Store | null {
  try { return globalThis.localStorage ?? null; } catch { return null; }
}

export function loadMoved(schoolDomain: string, store: Store | null = storage()): Set<string> {
  try {
    const raw = store?.getItem(keyFor(schoolDomain));
    const list: unknown = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(list) ? list.filter((k): k is string => typeof k === 'string').slice(0, 2000) : []);
  } catch {
    return new Set();
  }
}

/** Returns false when the browser wouldn't save it, so the page can say so. */
export function saveMoved(schoolDomain: string, moved: ReadonlySet<string>, store: Store | null = storage()): boolean {
  try {
    if (!store) return false;
    store.setItem(keyFor(schoolDomain), JSON.stringify([...moved]));
    return true;
  } catch {
    return false;
  }
}
