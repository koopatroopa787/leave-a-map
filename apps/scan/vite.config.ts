import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

// `vite preview` serves the same headers as Firebase Hosting, so the CSP is tested locally.
const hosting = JSON.parse(readFileSync(r('../../firebase.json'), 'utf8')).hosting;
const scanHeaders: Record<string, string> = Object.fromEntries(
  hosting.find((h: any) => h.target === 'scan').headers[0].headers.map((h: any) => [h.key, h.value]));

export default defineConfig({
  root: r('.'),
  envDir: r('../..'),
  // The scan site holds no Firebase config: only VITE_SCAN_* variables reach it, plus the
  // VITE_CLOUD_LOOKUP switch (not a secret), so both sites agree on whether the lookup is on.
  envPrefix: ['VITE_SCAN_', 'VITE_CLOUD_LOOKUP'],
  esbuild: { jsx: 'automatic', jsxImportSource: 'preact' },
  build: { outDir: r('../../dist/scan'), emptyOutDir: true, modulePreload: { polyfill: false } },
  worker: { format: 'es' },
  preview: { headers: scanHeaders, port: 4173, strictPort: true },
});
