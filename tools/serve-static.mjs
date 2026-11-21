// tools/serve-static.mjs: serves a built site with the same headers as Firebase Hosting, for
// testing the CSP on machines without Vite (such as the Nano machine).
// Usage: node tools/serve-static.mjs <dist dir> <hosting target> <port> [firebase.json]
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, normalize, extname, resolve } from 'node:path';

const [dir = 'dist/scan', target = 'scan', port = '4180', config = 'firebase.json'] = process.argv.slice(2);
const root = resolve(dir);
const hosting = JSON.parse(await readFile(config, 'utf8')).hosting.find((h) => h.target === target);
const headers = Object.fromEntries(hosting.headers[0].headers.map((h) => [h.key, h.value]));
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };

createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
  let file = join(root, path.endsWith('/') ? `${path}index.html` : path);
  if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
  try {
    const body = await readFile(file).catch(() => { file = join(root, 'index.html'); return readFile(file); });
    res.writeHead(200, { ...headers, 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' }).end(body);
  } catch {
    res.writeHead(404, headers).end('not found');
  }
}).listen(Number(port), '127.0.0.1', () => console.log(`serving ${root} as ${target} on http://127.0.0.1:${port}`));
