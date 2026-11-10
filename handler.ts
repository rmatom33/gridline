// Vercel serverless entry (deliberately not named vercel.ts: Vercel treats a
// root vercel.ts as a config file). scripts/build-vercel.mjs bundles this file into
// .vercel/output/functions/api.func and routes every /api/* request here.
// Set your keys in Vercel → Project → Settings → Environment Variables.
import type { IncomingMessage, ServerResponse } from 'node:http';
import { handleApi } from './api';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (!(await handleApi(req, res))) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  }
}
