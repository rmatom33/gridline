// Minimal .env loader (avoids a dependency). Existing env vars win.
import { readFileSync } from 'node:fs';

export function loadEnv(path = '.env') {
  let text = '';
  try { text = readFileSync(path, 'utf8'); } catch { return; }
  for (const line of text.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m || line.trim().startsWith('#')) continue;
    const [, k, raw] = m;
    if (process.env[k] === undefined) process.env[k] = raw.replace(/^['"]|['"]$/g, '');
  }
}
