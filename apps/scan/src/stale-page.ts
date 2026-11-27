// apps/scan/src/stale-page.ts: "Try the sample" on a page that's older than the site.
// The sample is a lazily loaded chunk with a hashed name. A page opened before a deploy asks for
// the old name, Hosting answers 404, and the import fails. Before this, that failure was silent:
// the button did nothing. Now the page reloads once and runs the sample from the fresh copy. If it
// fails again, it says so instead of looping. Only this one flag is kept, in sessionStorage.
type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null;

const KEY = 'leave-a-map:sample-after-reload';

export const STALE_MESSAGE = 'The sample couldn’t load. Reload the page and try again.';

export function storage(): Store {
  try { return globalThis.sessionStorage ?? null; } catch { return null; }
}

function get(s: Store) { try { return s?.getItem(KEY) ?? null; } catch { return null; } }
function set(s: Store, v: string) { if (!s) return false; try { s.setItem(KEY, v); return true; } catch { return false; } }
function clear(s: Store) { try { s?.removeItem(KEY); } catch { /* nothing to clear */ } }

/** On start-up: true when the last page reloaded to run the sample. Marks that try as used. */
export function sampleWanted(s: Store): boolean {
  if (get(s) !== 'reload') return false;
  set(s, 'tried');
  return true;
}

/** The sample loaded: forget any retry. */
export function sampleLoaded(s: Store): void { clear(s); }

/**
 * The sample chunk didn't load. Reload once (when storage works, so the fresh page knows to run
 * it), otherwise give up and let the caller show STALE_MESSAGE.
 */
export function sampleFailed(s: Store, reload: () => void): 'reloading' | 'gave-up' {
  if (get(s) === null && set(s, 'reload')) { reload(); return 'reloading'; }
  clear(s);
  return 'gave-up';
}
