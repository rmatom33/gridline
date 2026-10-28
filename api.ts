// The Gridline JSON API, shared by the Node server (server/index.ts, used
// locally and on Render) and the Vercel function (server/handler.ts).
//   GET /api/scoreboard?week=8
//   GET /api/game/:id
//   GET /api/schedule?week=9
//   GET /api/standings
//   GET /api/team/:abbr
//   GET /api/health      (which providers are on; never shows keys)

import type { IncomingMessage, ServerResponse } from 'node:http';
import type { DataSource } from '../src/shared/types';
import { createSampleSource } from '../src/shared/sample';
import { pregameHomeWinProbability } from '../src/shared/winprob';
import { createSportsDataIOSource } from './providers/sportsdataio';
import { createOddsClient } from './providers/theoddsapi';

export const provider = (process.env.DATA_PROVIDER ?? 'sample').toLowerCase();

const source: DataSource = provider === 'sportsdataio'
  ? createSportsDataIOSource({
      apiKey: process.env.SPORTSDATAIO_API_KEY ?? '',
      seasonType: (process.env.SPORTSDATAIO_SEASON_TYPE as 'REG' | 'PRE' | 'POST') ?? 'REG'
    })
  : createSampleSource();

// Odds: by default Gridline shows the betting line that comes with the
// SportsDataIO scores. Set ODDS_PROVIDER=theoddsapi to use the-odds-api.com instead.
export const oddsProvider = (process.env.ODDS_PROVIDER ?? 'sportsdataio').toLowerCase();
const odds = createOddsClient({
  apiKey: oddsProvider === 'theoddsapi' ? process.env.ODDS_API_KEY ?? '' : '',
  cacheMinutes: Number(process.env.ODDS_CACHE_MINUTES ?? 180),
  markets: process.env.ODDS_MARKETS,
  regions: process.env.ODDS_REGIONS,
  bookmaker: process.env.ODDS_BOOKMAKER,
  minRemaining: process.env.ODDS_MIN_REMAINING ? Number(process.env.ODDS_MIN_REMAINING) : undefined
});

export const describe = () => `${provider}${odds.status().enabled ? ' + The Odds API' : ''}`;

function send(res: ServerResponse, status: number, body: unknown, maxAge = 0) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    // s-maxage lets a CDN (Vercel, Cloudflare) answer repeat requests, so the
    // data provider is called at most once per window however many people visit.
    'Cache-Control': maxAge ? `public, max-age=0, s-maxage=${maxAge}, stale-while-revalidate=${maxAge * 4}` : 'no-store'
  });
  res.end(JSON.stringify(body));
}

function weekParam(url: URL): number | undefined {
  const w = url.searchParams.get('week');
  const n = w ? parseInt(w, 10) : NaN;
  return Number.isFinite(n) && n > 0 && n < 30 ? n : undefined;
}

/** Handles /api/* requests. Returns false for anything else. */
export async function handleApi(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const path = url.pathname.replace(/\/+$/, '');
  if (!path.startsWith('/api')) return false;
  try {
    if (path === '/api/health') {
      send(res, 200, {
        ok: true, provider,
        sportsdataioKey: provider === 'sportsdataio' ? !!process.env.SPORTSDATAIO_API_KEY : undefined,
        odds: { provider: oddsProvider, ...odds.status() },
        time: new Date().toISOString()
      });
      return true;
    }
    if (path === '/api/check') {
      send(res, 200, await checkFeeds(), 600);
      return true;
    }
    if (path === '/api/scoreboard') {
      const sb = await source.scoreboard(weekParam(url));
      await odds.apply(sb.games);
      send(res, 200, sb, 5);
      return true;
    }
    if (path === '/api/schedule') {
      const sc = await source.schedule(weekParam(url));
      await odds.apply(sc.games);
      send(res, 200, sc, 60);
      return true;
    }
    if (path === '/api/standings') {
      send(res, 200, await source.standings(), 300);
      return true;
    }
    const m = path.match(/^\/api\/game\/([\w-]+)$/);
    if (m) {
      const g = await source.game(m[1]);
      const before = g.odds?.spread;
      await odds.apply([g]);
      if (g.odds?.spread != null && g.odds.spread !== before) g.pregameHomeWinProb = pregameHomeWinProbability(g.odds.spread);
      send(res, 200, g, 5);
      return true;
    }
    const t = path.match(/^\/api\/team\/([A-Za-z]{2,4})$/);
    if (t) {
      const d = await source.team(t[1].toUpperCase());
      await odds.apply([d.liveGame, d.nextGame].filter((x): x is NonNullable<typeof x> => !!x));
      send(res, 200, d, 30);
      return true;
    }
    send(res, 404, { error: 'Not found' });
  } catch (err) {
    console.error(err);
    const msg = (err as Error).message ?? '';
    // Pass through a safe hint (status code only) so setup problems are easy to spot.
    const hint = /SportsDataIO (\d{3})/.exec(msg)?.[1];
    send(res, 502, { error: 'Data source unavailable', ...(hint ? { providerStatus: Number(hint) } : {}) });
  }
  return true;
}

// ---------------------------------------------------------------------------
// /api/check: which SportsDataIO feeds your key can use (status codes only, no
// data and never the key). The browser version of `npm run check:sdio`.
// ---------------------------------------------------------------------------
let lastCheck: { at: number; body: unknown } | null = null;

async function checkFeeds() {
  if (lastCheck && Date.now() - lastCheck.at < 10 * 60_000) return lastCheck.body;
  const key = process.env.SPORTSDATAIO_API_KEY;
  if (provider !== 'sportsdataio' || !key) {
    return { ok: false, message: 'Set DATA_PROVIDER=sportsdataio and SPORTSDATAIO_API_KEY, then redeploy.' };
  }
  const base = 'https://api.sportsdata.io/v3/nfl';
  const hit = async (path: string) => {
    try {
      const r = await fetch(base + path, { headers: { 'Ocp-Apim-Subscription-Key': key } });
      const json = r.ok ? await r.json().catch(() => null) : null;
      return { status: r.status, json };
    } catch (e) {
      return { status: 0, json: null, error: (e as Error).message };
    }
  };
  const tf = await hit('/scores/json/Timeframes/current');
  const t = Array.isArray(tf.json) ? tf.json[0] ?? {} : {};
  const type = process.env.SPORTSDATAIO_SEASON_TYPE ?? 'REG';
  const season = t.ApiSeason ?? `${new Date().getFullYear()}${type}`;
  const week = t.ApiWeek ?? t.Week ?? 1;
  const scores = await hit(`/scores/json/ScoresByWeek/${season}/${week}`);
  const games = Array.isArray(scores.json) ? scores.json : [];
  const started = games.find((g: any) => g.HasStarted) ?? games[0];
  const rest = await Promise.all([
    ['Standings', `/scores/json/Standings/${season}`],
    ['Season scores', `/scores/json/Scores/${season}`],
    ['Injuries', `/scores/json/Injuries/${season}/${week}`],
    ['Depth charts (lineups)', '/scores/json/DepthCharts'],
    ...(started ? [
      ['Play-by-play', `/pbp/json/PlayByPlay/${season}/${started.Week}/${started.HomeTeam}`],
      ['Box score (player stats)', `/stats/json/BoxScoreByScoreIDV3/${started.ScoreID}`]
    ] : [])
  ].map(async ([name, path]) => [name, (await hit(path)).status] as const));
  const feeds: Record<string, number> = { 'Current week': tf.status, 'Scores this week': scores.status, ...Object.fromEntries(rest) };
  const body = {
    ok: tf.status === 200 && scores.status === 200,
    season, week,
    gamesThisWeek: games.length,
    oddsInScores: games.some((g: any) => g.PointSpread != null),
    feeds,
    meaning: '200 = working. 401/403 = not in your plan or wrong key. 404 = endpoint name differs on your plan. 0 = could not connect.',
    checkedAt: new Date().toISOString()
  };
  lastCheck = { at: Date.now(), body };
  return body;
}
