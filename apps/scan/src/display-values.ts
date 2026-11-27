// apps/scan/src/display-values.ts: the Display menu's settings and their allowed values. Pure, so the
// check of what comes back from localStorage can be tested without a browser.
export type Display = {
  text: 'm' | 'l' | 'xl'; theme: 'system' | 'light' | 'dark'; contrast: 'normal' | 'more';
  motion: 'system' | 'on' | 'off'; spacing: 'normal' | 'wide';
};

export const DEFAULT: Display = { text: 'm', theme: 'dark', contrast: 'normal', motion: 'system', spacing: 'normal' };

export const ALLOWED: { [K in keyof Display]: readonly Display[K][] } = {
  text: ['m', 'l', 'xl'], theme: ['system', 'light', 'dark'], contrast: ['normal', 'more'],
  motion: ['system', 'on', 'off'], spacing: ['normal', 'wide'],
};

/**
 * Whatever was stored, keep only known keys with allowed values; everything else falls back to the
 * default. Values end up in data-* attributes on <html>, so nothing unexpected gets through.
 */
export function cleanDisplay(raw: unknown): Display {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const out = { ...DEFAULT };
  for (const k of Object.keys(ALLOWED) as (keyof Display)[]) {
    if ((ALLOWED[k] as readonly unknown[]).includes(r[k])) (out as Record<string, unknown>)[k] = r[k];
  }
  return out;
}
