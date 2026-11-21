import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

// `--mode check` builds the cascade check page and the setup smoke page into dist/cloud-check,
// for running on the Nano machine. Neither is part of the deployed site, so nobody can use them
// to spend the project's quota. The deployed site is a static home page and the consent window.
export default defineConfig(({ mode }) => ({
  root: r('.'),
  envDir: r('../..'),
  envPrefix: 'VITE_CLOUD_',
  build: {
    outDir: r(mode === 'check' ? '../../dist/cloud-check' : '../../dist/cloud'),
    emptyOutDir: true,
    rollupOptions: {
      input: (mode === 'check'
        ? { 'cascade-check': r('cascade-check.html'), smoke: r('smoke.html') }
        : { index: r('index.html'), consent: r('consent.html') }) as Record<string, string>,
    },
  },
}));
