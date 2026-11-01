// Petit serveur statique sans dépendance : sert le dépôt à la racine ET sous /duo-quiz/
// (même sous-dossier que GitHub Pages, pour vérifier que tous les chemins sont relatifs).
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const PORT = Number(process.argv[2] || process.env.PORT || 4173);
const BASE = '/duo-quiz';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
};

export function resolvePath(urlPath) {
  let p = decodeURIComponent(urlPath.split('?')[0]);
  if (p === BASE) p = '/';
  else if (p.startsWith(BASE + '/')) p = p.slice(BASE.length);
  if (p.endsWith('/')) p += 'index.html';
  const full = normalize(join(ROOT, p));
  return full.startsWith(ROOT) ? full : null;
}

const server = createServer(async (req, res) => {
  const file = resolvePath(req.url || '/');
  try {
    if (!file || !(await stat(file)).isFile()) throw new Error('404');
    const body = await readFile(file);
    res.writeHead(200, {
      'Content-Type': TYPES[extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    res.end(body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Introuvable');
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Duo Quiz → http://127.0.0.1:${PORT}${BASE}/?demo=1`);
});
