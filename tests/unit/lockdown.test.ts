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
