// The Odds API (v4) adapter: https://the-odds-api.com/liveapi/guides/v4/
// Runs on the server only, so ODDS_API_KEY never reaches the browser.
//
// Quota: each call costs (number of markets x number of regions) credits.
// Defaults here (2 markets, 1 region, 3-hour cache, fetched only when someone
// opens the site) keep a 500-credit free plan inside its monthly limit.
// The server stops calling when the remaining credits fall below ODDS_MIN_REMAINING
// and keeps showing the last odds it had.

import type { Game, Odds } from '../../src/shared/types';
import { TEAMS } from '../../src/shared/teams';
import { gameWinProbability } from '../../src/shared/winprob';

type J = Record<string, any>;

export interface OddsOptions {
  apiKey: string;
  cacheMinutes?: number;
  markets?: string; // e.g. "h2h,spreads" or "h2h,spreads,totals"
  regions?: string; // e.g. "us"
  bookmaker?: string; // e.g. "draftkings"; empty = consensus (median) of all books
  minRemaining?: number;
}

export interface OddsStatus { enabled: boolean; remaining: number | null; used: number | null; lastFetch: string | null; lastError: string | null }

// "Kansas City Chiefs" -> "KC". Built from our team list, plus the nickname alone as a fallback.
const BY_NAME = new Map<string, string>();
for (const t of Object.values(TEAMS)) {
  BY_NAME.set(`${t.city} ${t.name}`.toLowerCase(), t.abbr);
  BY_NAME.set(t.name.toLowerCase(), t.abbr);
}
function abbrFor(name: string): string | undefined {
  const n = String(name ?? '').toLowerCase().trim();
  return BY_NAME.get(n) ?? BY_NAME.get(n.split(' ').pop() ?? '');
}

const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = xs.slice().sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const roundHalf = (n: number | null) => (n == null ? null : Math.round(n * 2) / 2);
const roundInt = (n: number | null) => (n == null ? null : Math.round(n));

interface EventOdds { home: string; away: string; commence: number; odds: Odds }

export function createOddsClient(opts: OddsOptions) {
  const ttl = Math.max(5, opts.cacheMinutes ?? 180) * 60_000;
  const markets = opts.markets || 'h2h,spreads';
  const regions = opts.regions || 'us';
  const minRemaining = opts.minRemaining ?? 25;
  const status: OddsStatus = { enabled: !!opts.apiKey, remaining: null, used: null, lastFetch: null, lastError: null };
  let events: EventOdds[] = [];
  let fetchedAt = 0;
  let inflight: Promise<void> | null = null;

  async function refresh() {
    if (!opts.apiKey) return;
    if (status.remaining != null && status.remaining < minRemaining) return; // protect the quota
    const url = new URL('https://api.the-odds-api.com/v4/sports/americanfootball_nfl/odds');
    url.searchParams.set('apiKey', opts.apiKey);
    url.searchParams.set('regions', regions);
    url.searchParams.set('markets', markets);
    url.searchParams.set('oddsFormat', 'american');
    if (opts.bookmaker) url.searchParams.set('bookmakers', opts.bookmaker);
    try {
      const res = await fetch(url);
      const rem = res.headers.get('x-requests-remaining');
      const used = res.headers.get('x-requests-used');
      if (rem != null) status.remaining = Number(rem);
      if (used != null) status.used = Number(used);
      if (!res.ok) throw new Error(`The Odds API ${res.status}`);
      const body = (await res.json()) as J[];
      events = body.map(parseEvent).filter((e): e is EventOdds => !!e);
      status.lastFetch = new Date().toISOString();
      status.lastError = null;
    } catch (err) {
      status.lastError = (err as Error).message;
      console.warn('[odds]', status.lastError);
    } finally {
      fetchedAt = Date.now(); // also on failure, so a bad key doesn't burn requests
    }
  }

  function parseEvent(e: J): EventOdds | null {
    const home = abbrFor(e.home_team), away = abbrFor(e.away_team);
    if (!home || !away) return null;
    const spreads: number[] = [], totals: number[] = [], homeML: number[] = [], awayML: number[] = [];
    for (const b of (e.bookmakers ?? []) as J[]) {
      for (const m of (b.markets ?? []) as J[]) {
        for (const o of (m.outcomes ?? []) as J[]) {
          const isHome = o.name === e.home_team, isAway = o.name === e.away_team;
          if (m.key === 'spreads' && isHome && typeof o.point === 'number') spreads.push(o.point);
          if (m.key === 'totals' && o.name === 'Over' && typeof o.point === 'number') totals.push(o.point);
          if (m.key === 'h2h' && isHome && typeof o.price === 'number') homeML.push(o.price);
          if (m.key === 'h2h' && isAway && typeof o.price === 'number') awayML.push(o.price);
        }
      }
    }
    return {
      home, away, commence: Date.parse(e.commence_time),
      odds: {
        spread: roundHalf(median(spreads)), // home perspective, negative = home favored
        total: roundHalf(median(totals)),
        homeMoneyline: roundInt(median(homeML)),
        awayMoneyline: roundInt(median(awayML))
      }
    };
  }

  async function ensureFresh() {
    if (!opts.apiKey || Date.now() - fetchedAt < ttl) return;
    inflight ??= refresh().finally(() => (inflight = null));
    await inflight;
  }

  /** Fills in odds on games (in place). Provider odds are replaced only when The Odds API has a line. */
  async function apply<T extends Game>(games: T[]): Promise<T[]> {
    if (!opts.apiKey) return games;
    await ensureFresh();
    for (const g of games) {
      if (g.status === 'final' || g.status === 'postponed') continue;
      const kick = Date.parse(g.kickoff);
      const ev = events.find((e) => e.home === g.home.abbr && e.away === g.away.abbr && Math.abs(e.commence - kick) < 36 * 3_600_000);
      if (!ev) continue;
      const o = ev.odds;
      g.odds = {
        spread: o.spread ?? g.odds?.spread ?? null,
        total: o.total ?? g.odds?.total ?? null,
        homeMoneyline: o.homeMoneyline ?? g.odds?.homeMoneyline ?? null,
        awayMoneyline: o.awayMoneyline ?? g.odds?.awayMoneyline ?? null,
        isLive: g.status === 'live' || g.status === 'halftime'
      };
      g.homeWinProb = gameWinProbability(g);
    }
    return games;
  }

  return { apply, status: () => ({ ...status }) };
}
