// Dumps real SportsDataIO responses so you can verify the field names the
// adapter relies on. Usage: SPORTSDATAIO_API_KEY=... npm run check:sdio
import { writeFile, mkdir } from 'node:fs/promises';
import { loadEnv } from './env';

loadEnv();
const key = process.env.SPORTSDATAIO_API_KEY;
if (!key) { console.error('Set SPORTSDATAIO_API_KEY first.'); process.exit(1); }
const type = process.env.SPORTSDATAIO_SEASON_TYPE ?? 'REG';
const base = 'https://api.sportsdata.io/v3/nfl';

async function get(path: string) {
  const res = await fetch(base + path, { headers: { 'Ocp-Apim-Subscription-Key': key! } });
  const body = res.ok ? await res.json() : await res.text();
  console.log(res.status, path);
  return { status: res.status, body };
}

const out: Record<string, unknown> = {};
const tf = await get('/scores/json/Timeframes/current');
out.timeframe = tf;
const t = Array.isArray(tf.body) ? tf.body[0] : {};
const season = t?.ApiSeason ?? `${new Date().getFullYear()}${type}`;
const week = t?.ApiWeek ?? t?.Week ?? 1;
const scores = await get(`/scores/json/ScoresByWeek/${season}/${week}`);
out.scoresByWeek = scores;
const first = Array.isArray(scores.body) ? scores.body.find((s: any) => s.HasStarted) ?? scores.body[0] : null;
out.standings = await get(`/scores/json/Standings/${season}`);
out.injuries = await get(`/scores/json/Injuries/${season}/${week}`);
out.depthCharts = await get('/scores/json/DepthCharts');
if (first) {
  out.playByPlay = await get(`/pbp/json/PlayByPlay/${season}/${week}/${first.HomeTeam}`);
  out.boxScore = await get(`/stats/json/BoxScoreByScoreIDV3/${first.ScoreID}`);
}
await mkdir('sdio-samples', { recursive: true });
await writeFile('sdio-samples/responses.json', JSON.stringify(out, null, 2));
console.log('Wrote sdio-samples/responses.json - compare against the // VERIFY notes in server/providers/sportsdataio.ts');
