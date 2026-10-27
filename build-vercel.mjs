// Builds Gridline for Vercel using the Build Output API
// (https://vercel.com/docs/build-output-api/v3). Run by `npm run build:vercel`,
// which Vercel calls via vercel.json. Produces:
//   .vercel/output/static/              the site (from dist/)
//   .vercel/output/functions/api.func/  one Node function that serves /api/*
//   .vercel/output/config.json          routing
import { build } from 'esbuild';
import { cp, mkdir, rm, writeFile } from 'node:fs/promises';

const out = '.vercel/output';
await rm(out, { recursive: true, force: true });
await mkdir(`${out}/functions/api.func`, { recursive: true });

await cp('dist', `${out}/static`, { recursive: true });

await build({
  entryPoints: ['server/vercel.ts'],
  outfile: `${out}/functions/api.func/index.mjs`,
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  logLevel: 'info'
});

await writeFile(`${out}/functions/api.func/.vc-config.json`, JSON.stringify({
  runtime: 'nodejs22.x',
  handler: 'index.mjs',
  launcherType: 'Nodejs',
  maxDuration: 15
}, null, 2));

await writeFile(`${out}/config.json`, JSON.stringify({
  version: 3,
  routes: [
    // Hashed assets never change: cache them for a year.
    { src: '/assets/(.*)', headers: { 'Cache-Control': 'public, max-age=31536000, immutable' }, continue: true },
    { src: '/api/(.*)', dest: '/api' },
    { handle: 'filesystem' },
    { src: '/(.*)', dest: '/index.html' }
  ]
}, null, 2));

console.log('Vercel output ready in .vercel/output');
