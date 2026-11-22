import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

describe('lockdown (T25)', () => {
  it('is the first import of the scan page', () => {
    const firstImport = read('apps/scan/src/main.tsx').split('\n').find((l) => /^\s*import\b/.test(l));
    expect(firstImport?.trim()).toBe("import './lockdown.ts';");
  });
  it('the scan CSP blocks connections, frames and HTML-string sinks, and never reports out', () => {
    const scan = JSON.parse(read('firebase.json')).hosting.find((h: { target: string }) => h.target === 'scan');
    const csp: string = scan.headers[0].headers.find((h: { key: string }) => h.key === 'Content-Security-Policy').value;
    for (const d of ["connect-src 'none'", "frame-src 'none'", "object-src 'none'", "require-trusted-types-for 'script'", "trusted-types default", "script-src 'self'"]) {
      expect(csp).toContain(d);
    }
    expect(csp).not.toMatch(/report-(?:uri|to)/);
  });
});

describe('hosting cache rules', () => {
  // Pages are re-checked on every load, so a deploy shows up at once. Built files have hashed
  // names, so they can be kept for a year.
  const hosting = JSON.parse(read('firebase.json')).hosting as { target: string; headers: { source: string; headers: { key: string; value: string }[] }[] }[];
  const cache = (h: (typeof hosting)[number], source: string) =>
    h.headers.find((x) => x.source === source)?.headers.find((x) => x.key === 'Cache-Control')?.value;
  it.each(['scan', 'cloud'])('%s: pages no-cache, hashed assets immutable, CSP block still first', (target) => {
    const h = hosting.find((x) => x.target === target)!;
    expect(cache(h, '/')).toBe('no-cache');
    expect(cache(h, '**/*.html')).toBe('no-cache');
    expect(cache(h, '/assets/**')).toMatch(/immutable/);
    expect(h.headers[0].source).toBe('**');
    expect(h.headers[0].headers.some((x) => x.key === 'Content-Security-Policy')).toBe(true);
  });
});

describe('scan site environment', () => {
  it('exposes no Firebase config, only VITE_SCAN_* and the lookup switch', () => {
    const cfg = read('apps/scan/vite.config.ts');
    expect(/envPrefix: \['VITE_SCAN_', 'VITE_CLOUD_LOOKUP'\],/.test(cfg)).toBe(true);
    const keys = [...read('.env.example').matchAll(/^#?\s*(VITE_[A-Z_]+)=/gm)].map((m) => m[1]);
    const leaked = keys.filter((k) => k.startsWith('VITE_SCAN_') || k.startsWith('VITE_CLOUD_LOOKUP')).filter((k) => k !== 'VITE_CLOUD_LOOKUP');
    expect(leaked).toEqual([]);
  });
});
