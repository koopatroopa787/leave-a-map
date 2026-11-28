// tools/build-extension.mjs: builds the Chrome extension into dist/extension: the scan app with
// "Read from Gmail" switched on, plus the manifest, the toolbar script, the Gmail reader and icons.
// Load it at chrome://extensions (Developer mode, Load unpacked). Usage: node tools/build-extension.mjs
import { execSync } from 'node:child_process';
import { cpSync } from 'node:fs';
import { resolve } from 'node:path';

const out = 'dist/extension';
// No VITE_CLOUD_LOOKUP: the extension is on-device only, so the cloud lookup stays off.
execSync(`npx vite build --config apps/scan/vite.config.ts --outDir "${resolve(out)}"`, {
  stdio: 'inherit', env: { ...process.env, VITE_SCAN_EXTENSION: '1', VITE_CLOUD_LOOKUP: '' },
});
for (const f of ['manifest.json', 'background.js', 'gmail-reader.js', 'icons']) cpSync(`apps/extension/${f}`, `${out}/${f}`, { recursive: true });
console.log(`built ${out}`);
