// Serves a built site under SITE_BASE, as a static host does. The smoke tests use this server.
// SITE_DIR picks the build folder (default _site; the test builds are _site-fixture, _site-button, _site-url).
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const SITE_DIR = process.env.SITE_DIR ?? '_site';
const ROOT = join(import.meta.dirname, '..', SITE_DIR);
const BASE = (process.env.SITE_BASE ?? '').replace(/\/$/, '');
const PORT = Number(process.env.PORT ?? 4100);
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ktx2': 'image/ktx2',
  '.ogg': 'audio/ogg',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8'
};

async function statOrNull(file) {
  try {
    return await stat(file);
  } catch {
    return null;
  }
}

async function resolve(urlPath) {
  const file = join(ROOT, normalize(decodeURIComponent(urlPath)));
  if (!file.startsWith(ROOT)) return null;
  const info = await statOrNull(file);
  if (info?.isDirectory()) return resolve(join(urlPath, 'index.html'));
  return info ? file : null;
}

createServer(async (req, res) => {
  const { pathname } = new URL(req.url, 'http://localhost');
  const file = pathname.startsWith(`${BASE}/`) ? await resolve(pathname.slice(BASE.length)) : null;
  if (file === null) {
    res.writeHead(404, { 'Content-Type': TYPES['.html'] });
    const page = join(ROOT, '404.html');
    res.end((await statOrNull(page)) ? await readFile(page) : 'Not found');
    return;
  }
  res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' });
  res.end(await readFile(file));
}).listen(PORT, () => console.log(`[serve] ${SITE_DIR} on http://127.0.0.1:${PORT}${BASE}/`));
