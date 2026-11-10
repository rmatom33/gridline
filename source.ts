import type { DataSource } from '../shared/types';
import { createSampleSource } from '../shared/sample';

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(path, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json() as Promise<T>;
}

const q = (week?: number) => (week ? `?week=${week}` : '');

const httpSource: DataSource = {
  scoreboard: (week) => getJson(`./api/scoreboard${q(week)}`),
  game: (id) => getJson(`./api/game/${encodeURIComponent(id)}`),
  schedule: (week) => getJson(`./api/schedule${q(week)}`),
  standings: () => getJson('./api/standings'),
  team: (abbr) => getJson(`./api/team/${encodeURIComponent(abbr)}`)
};

/** `VITE_DATA_MODE=sample` runs entirely in the browser on the sample replay. */
export const IS_SAMPLE = import.meta.env.VITE_DATA_MODE === 'sample';
export const data: DataSource = IS_SAMPLE ? createSampleSource() : httpSource;
