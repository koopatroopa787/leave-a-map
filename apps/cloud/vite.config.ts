import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  root: r('.'),
  envDir: r('../..'),
  envPrefix: 'VITE_CLOUD_',
  build: { outDir: r('../../dist/cloud'), emptyOutDir: true },
});
