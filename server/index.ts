// Gridline Node server: the API (server/api.ts) plus the built site from ./dist.
// Used locally and on Render. On Vercel, server/handler.ts is used instead.
//   GET /api/scoreboard?week=8
//   GET /api/game/:id
//   GET /api/schedule?week=9
//   GET /api/standings
//   GET /api/team/:abbr
//   GET /api/health      (which providers are on, odds credits left; never shows keys)
// It also serves the built site from ./dist when that folder exists (after `npm run build`).

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnv } from './env';

// Load .env before the API module reads process.env.
loadEnv();
const { handleApi, describe } = await import('./api');

const PORT = Number(process.env.PORT ?? 8787);
const DIST = fileURLToPath(new URL('../dist/', import.meta.url));
const HAS_DIST = existsSync(join(DIST, 'index.html'));
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png'
};

const server = createServer(async (req, res) => {
  if (await handleApi(req, res)) return;
  const url = new URL(req.url ?? '/', 'http://localhost');

  if (!HAS_DIST) {
    res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Gridline API is running. Run `npm run build` to serve the site here, or `npm run dev` while developing.');
    return;
  }
  // Static files
  const rel = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '');
  let file = join(DIST, rel === '/' ? 'index.html' : rel);
  try {
    if (!(await stat(file)).isFile()) file = join(DIST, 'index.html');
  } catch {
    file = join(DIST, 'index.html');
  }
  try {
    const body = await readFile(file);
    const ext = extname(file);
    res.writeHead(200, {
      'Content-Type': TYPES[ext] ?? 'application/octet-stream',
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable'
    });
    res.end(body);
  } catch {
    res.writeHead(404).end('Not found');
  }
});

server.listen(PORT, () => {
  console.log(`Gridline (${describe()}) on http://localhost:${PORT}`);
  if (!HAS_DIST) console.log('No dist/ folder yet: run `npm run build` to serve the site from this server.');
});
