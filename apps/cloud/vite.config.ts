import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

// `--mode check` builds the cascade check page into dist/cloud-check for running on the Nano
// machine. It is never part of the deployed site, so nobody can use it to spend the project's quota.
export default defineConfig(({ mode }) => ({
  root: r('.'),
  envDir: r('../..'),
  envPrefix: 'VITE_CLOUD_',
  build: {
    outDir: r(mode === 'check' ? '../../dist/cloud-check' : '../../dist/cloud'),
    emptyOutDir: true,
    rollupOptions: {
      input: (mode === 'check'
        ? { 'cascade-check': r('cascade-check.html') }
        : { index: r('index.html'), consent: r('consent.html') }) as Record<string, string>,
    },
  },
}));
