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

/** T19: services the person confirmed on their school account's connected-apps page. */
const connKey = (schoolDomain: string) => `lam.connections.${schoolDomain.toLowerCase()}`;
const strings = (v: unknown) => (Array.isArray(v) ? v.filter((k): k is string => typeof k === 'string').slice(0, 500) : []);

export function loadConnections(schoolDomain: string, store: Store | null = storage()): { ticked: string[]; added: string[] } {
  try {
    const raw = store?.getItem(connKey(schoolDomain));
    const o = (raw ? JSON.parse(raw) : {}) as { ticked?: unknown; added?: unknown };
    return { ticked: strings(o?.ticked), added: strings(o?.added) };
  } catch {
    return { ticked: [], added: [] };
  }
}

export function saveConnections(schoolDomain: string, c: { ticked: string[]; added: string[] }, store: Store | null = storage()): boolean {
  try {
    if (!store) return false;
    store.setItem(connKey(schoolDomain), JSON.stringify({ ticked: c.ticked, added: c.added }));
    return true;
  } catch {
    return false;
  }
}

/** Notes per account ("rang them on 3 Dec, ref 88120"), per list. Only in this browser. */
const notesKey = (list: string) => `lam.notes.${list.toLowerCase()}`;
export const NOTE_MAX = 2000;

export function loadNotes(list: string, store: Store | null = storage()): Record<string, string> {
  try {
    const raw = store?.getItem(notesKey(list));
    const o: unknown = raw ? JSON.parse(raw) : {};
    if (!o || typeof o !== 'object' || Array.isArray(o)) return {};
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(o).slice(0, 2000)) if (typeof v === 'string' && v) out[k] = v.slice(0, NOTE_MAX);
    return out;
  } catch {
    return {};
  }
}

export function saveNotes(list: string, notes: Record<string, string>, store: Store | null = storage()): boolean {
  try {
    if (!store) return false;
    store.setItem(notesKey(list), JSON.stringify(notes));
    return true;
  } catch {
    return false;
  }
}
