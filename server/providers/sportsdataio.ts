// SportsDataIO (NFL v3) adapter. Runs on the server only, so the API key never
// reaches the browser.
//
// IMPORTANT - VERIFY BEFORE LAUNCH: endpoint paths and field names below were
// written from SportsDataIO's NFL v3 docs as we know them, without live access.
// Every field is read defensively (missing fields become null), but check each
// `// VERIFY` against https://sportsdata.io/developers/api-documentation/nfl
// with your key, and run `npm run check:sdio` (see README) to dump real
// responses. Your plan level decides which endpoints you can call (play-by-play
// and box scores are usually separate products).

import type {
  DataSource, Game, GameDetail, GameStatus, Injury, InjuryStatus, LineupSlot, Play, PlayKind,
  PlayerLine, Schedule, Scoreboard, Standing, TeamStatRow
} from '../../src/shared/types';
import { normalizeAbbr, team, TEAMS } from '../../src/shared/teams';
import { gameWinProbability, homeWinProbability, pregameHomeWinProbability, secondsRemaining } from '../../src/shared/winprob';
import { buildSummary } from '../../src/shared/summary';
import { buildTeamDetail } from '../../src/shared/teamdetail';

type J = Record<string, any>;

const BASE = 'https://api.sportsdata.io/v3/nfl';

interface CacheEntry { at: number; ttl: number; data: unknown }
const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<unknown>>();

export interface SdioOptions { apiKey: string; seasonType?: 'REG' | 'PRE' | 'POST' }

export function createSportsDataIOSource(opts: SdioOptions): DataSource {
  if (!opts.apiKey) throw new Error('SPORTSDATAIO_API_KEY is not set');
  const seasonType = opts.seasonType ?? 'REG';

  async function get<T = J>(path: string, ttlMs: number): Promise<T> {
    const hit = cache.get(path);
    if (hit && Date.now() - hit.at < hit.ttl) return hit.data as T;
    const running = inflight.get(path);
    if (running) return running as Promise<T>;
    const p = (async () => {
      const res = await fetch(`${BASE}${path}`, { headers: { 'Ocp-Apim-Subscription-Key': opts.apiKey } });
      if (!res.ok) {
        if (hit) return hit.data; // serve stale data rather than failing during a game
        throw new Error(`SportsDataIO ${res.status} on ${path}`);
      }
      const data = await res.json();
      cache.set(path, { at: Date.now(), ttl: ttlMs, data });
      return data;
    })().finally(() => inflight.delete(path));
    inflight.set(path, p);
    return p as Promise<T>;
  }

  // Current season/week. VERIFY: Timeframes/current returns [{ Season, Week, SeasonType, ApiSeason, ApiWeek }]
  async function current(): Promise<{ season: number; week: number; apiSeason: string }> {
    const tf = await get<J[]>('/scores/json/Timeframes/current', 10 * 60_000);
    const t = tf?.[0] ?? {};
    const season = Number(t.Season) || new Date().getFullYear();
    const week = Number(t.ApiWeek ?? t.Week) || 1;
    return { season, week, apiSeason: t.ApiSeason ?? `${season}${seasonType}` };
  }

  async function scoresForWeek(apiSeason: string, week: number): Promise<J[]> {
    // Short cache: this is the call that drives live scores. Keep within your plan's rate limit.
    return get<J[]>(`/scores/json/ScoresByWeek/${apiSeason}/${week}`, 5_000); // VERIFY
  }

  async function standingsRows(): Promise<Standing[]> {
    const { season, apiSeason } = await current();
    const rows = await get<J[]>(`/scores/json/Standings/${apiSeason}`, 10 * 60_000); // VERIFY
    const seasonScores = await get<J[]>(`/scores/json/Scores/${apiSeason}`, 10 * 60_000).catch(() => [] as J[]); // VERIFY
    void season;
    const out: Standing[] = rows.map((r) => {
      const abbr = normalizeAbbr(r.Team);
      const streakN = Number(r.Streak ?? 0); // VERIFY: positive = win streak, negative = losing streak
      return {
        team: abbr,
        w: Number(r.Wins ?? 0), l: Number(r.Losses ?? 0), t: Number(r.Ties ?? 0),
        pf: Number(r.PointsFor ?? 0), pa: Number(r.PointsAgainst ?? 0),
        streak: streakN === 0 ? '–' : streakN > 0 ? `W${streakN}` : `L${-streakN}`,
        last5: lastFive(abbr, seasonScores)
      };
    });
    return assignSeeds(out);
  }

  async function gameDetail(id: string): Promise<GameDetail> {
    const { week, apiSeason } = await current();
    // Game ids are SportsDataIO ScoreIDs. Find the game in this week or the season.
    let score = (await scoresForWeek(apiSeason, week)).find((s) => String(s.ScoreID) === id);
    if (!score) {
      const all = await get<J[]>(`/scores/json/Scores/${apiSeason}`, 10 * 60_000);
      score = all.find((s) => String(s.ScoreID) === id);
    }
    if (!score) throw new Error('Game not found');
    const base = mapScore(score);
    const live = base.status === 'live' || base.status === 'halftime';
    const ttl = live ? 8_000 : 5 * 60_000;

    const [pbp, box, depth, injuries] = await Promise.all([
      base.status === 'scheduled' ? null : get<J>(`/pbp/json/PlayByPlay/${apiSeason}/${base.week}/${score.HomeTeam}`, ttl).catch(() => null), // VERIFY
      base.status === 'scheduled' ? null : get<J>(`/stats/json/BoxScoreByScoreIDV3/${id}`, ttl).catch(() => null), // VERIFY
      get<J[]>('/scores/json/DepthCharts', 6 * 3_600_000).catch(() => [] as J[]), // VERIFY
      get<J[]>(`/scores/json/Injuries/${apiSeason}/${base.week}`, 30 * 60_000).catch(() => [] as J[]) // VERIFY (may be InjuriesByWeek on newer plans)
    ]);

    const plays = mapPlays(pbp?.Plays ?? [], base);
    const players = mapPlayers(box?.PlayerGames ?? []);
    const detail: GameDetail = {
      ...base,
      quarters: {
        away: [1, 2, 3, 4].map((q) => Number(score![`AwayScoreQuarter${q}`] ?? 0)).concat(score.AwayScoreOvertime ? [Number(score.AwayScoreOvertime)] : []),
        home: [1, 2, 3, 4].map((q) => Number(score![`HomeScoreQuarter${q}`] ?? 0)).concat(score.HomeScoreOvertime ? [Number(score.HomeScoreOvertime)] : [])
      },
      plays,
      winProbSeries: plays.slice().reverse().filter((p) => p.homeWinProb != null).map((p) => ({
        t: 3600 - secondsRemaining(p.quarter, p.clock), homeWinProb: p.homeWinProb!
      })),
      players,
      teamStats: mapTeamStats(box?.TeamGames ?? [], base),
      injuries: mapInjuries(injuries, [base.away.abbr, base.home.abbr]),
      lineups: { away: mapLineup(depth, base.away.abbr, score.AwayTeamID, injuries), home: mapLineup(depth, base.home.abbr, score.HomeTeamID, injuries) },
      pregameHomeWinProb: pregameHomeWinProbability(base.odds?.spread ?? null)
    };
    detail.summary = buildSummary(detail);
    return detail;
  }

  return {
    async scoreboard(week) {
      const cur = await current();
      const w = week ?? cur.week;
      const games = (await scoresForWeek(cur.apiSeason, w)).map(mapScore);
      await attachRecords(games);
      return { season: cur.season, week: w, games, updatedAt: new Date().toISOString() } satisfies Scoreboard;
    },
    game: gameDetail,
    async schedule(week) {
      const cur = await current();
      const w = week ?? cur.week;
      const games = (await scoresForWeek(cur.apiSeason, w)).map(mapScore);
      await attachRecords(games);
      const weeks = Array.from({ length: seasonType === 'REG' ? 18 : seasonType === 'PRE' ? 3 : 4 }, (_, i) => i + 1);
      return { season: cur.season, week: w, weeks, games } satisfies Schedule;
    },
    standings: standingsRows,
    async team(abbr) {
      const code = normalizeAbbr(abbr);
      if (!TEAMS[code]) throw new Error('Unknown team');
      const { week, apiSeason } = await current();
      const [standings, season, injuries] = await Promise.all([
        standingsRows(),
        get<J[]>(`/scores/json/Scores/${apiSeason}`, 10 * 60_000).catch(() => [] as J[]), // VERIFY
        get<J[]>(`/scores/json/Injuries/${apiSeason}/${week}`, 30 * 60_000).catch(() => [] as J[]) // VERIFY
      ]);
      // Live games come from the short-cache weekly call so the team page stays current.
      const thisWeek = await scoresForWeek(apiSeason, week).catch(() => [] as J[]);
      const byId = new Map<string, Game>();
      for (const s of season) { const g = mapScore(s); byId.set(g.id, g); }
      for (const s of thisWeek) { const g = mapScore(s); byId.set(g.id, g); }
      const games = [...byId.values()];
      await attachRecords(games.filter((g) => g.home.abbr === code || g.away.abbr === code));
      return buildTeamDetail(code, standings, games, mapInjuries(injuries, [code]));
    }
  };

  async function attachRecords(games: Game[]) {
    const st = await standingsRows().catch(() => [] as Standing[]);
    const rec = new Map(st.map((s) => [s.team, `${s.w}-${s.l}${s.t ? `-${s.t}` : ''}`]));
    for (const g of games) {
      g.away.record = rec.get(g.away.abbr);
      g.home.record = rec.get(g.home.abbr);
    }
  }
}

// ---------------------------------------------------------------------------
// Mapping helpers
// ---------------------------------------------------------------------------

function mapStatus(s: J): GameStatus {
  const status = String(s.Status ?? '');
  if (s.Quarter === 'Half') return 'halftime';
  if (status === 'InProgress' || (s.IsInProgress && !s.IsOver)) return 'live';
  if (status.startsWith('F') || s.IsOver) return 'final';
  if (status === 'Postponed' || status === 'Canceled' || status === 'Suspended') return 'postponed';
  return 'scheduled';
}

function quarterNumber(q: unknown): number | null {
  if (q == null) return null;
  const s = String(q);
  if (s === 'OT' || s === 'F/OT') return 5;
  if (s === 'Half') return 2;
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
}

/** SportsDataIO `DateTime` is US Eastern local time without an offset. */
function easternToIso(local: string | null | undefined, utc?: string | null): string {
  if (utc) return new Date(utc.endsWith('Z') ? utc : `${utc}Z`).toISOString();
  if (!local) return new Date().toISOString();
  const guess = new Date(`${local}Z`);
  // Find the Eastern offset for that date (handles EDT/EST).
  const et = new Date(guess.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const offset = guess.getTime() - et.getTime();
  return new Date(guess.getTime() + offset).toISOString();
}

function mapScore(s: J): Game {
  const away = normalizeAbbr(s.AwayTeam), home = normalizeAbbr(s.HomeTeam);
  const status = mapStatus(s);
  const poss = normalizeAbbr(s.Possession);
  const possession = poss === home ? 'home' : poss === away ? 'away' : null;
  const yl = s.YardLine != null ? Number(s.YardLine) : null;
  const terr = normalizeAbbr(s.YardLineTerritory);
  const yfog = yl == null || !possession ? null : terr === poss ? yl : 100 - yl;
  const stadium: J = s.StadiumDetails ?? {};
  const dome = /dome/i.test(String(stadium.Type ?? '')) || !!TEAMS[home]?.dome;
  const g: Game = {
    id: String(s.ScoreID ?? s.GameKey),
    season: Number(s.Season), week: Number(s.Week),
    kickoff: easternToIso(s.DateTime ?? s.Date, s.DateTimeUTC),
    status,
    quarter: quarterNumber(s.Quarter),
    clock: s.TimeRemaining ?? null,
    away: { abbr: away, score: s.AwayScore ?? null, timeouts: s.AwayTimeouts ?? undefined },
    home: { abbr: home, score: s.HomeScore ?? null, timeouts: s.HomeTimeouts ?? undefined },
    possession: status === 'live' ? possession : null,
    situation: status === 'live' ? {
      down: s.Down ?? null, distance: s.Distance ?? null, yardsFromOwnGoal: yfog,
      spot: yl != null && terr ? `${terr} ${yl}` : null, redZone: !!s.RedZone
    } : undefined,
    odds: {
      spread: s.PointSpread ?? null, // VERIFY: home-team perspective
      total: s.OverUnder ?? null,
      homeMoneyline: s.HomeTeamMoneyLine ?? null,
      awayMoneyline: s.AwayTeamMoneyLine ?? null
    },
    weather: dome ? { dome: true } : {
      dome: false,
      tempF: s.ForecastTempHigh ?? s.ForecastTempLow ?? null,
      windMph: s.ForecastWindSpeed ?? null,
      description: s.ForecastDescription ?? null,
      precipPct: null
    },
    venue: { name: stadium.Name, city: stadium.City, state: stadium.State },
    lastPlay: s.LastPlay ?? undefined,
    tv: s.Channel ?? null,
    overtime: String(s.Status ?? '').includes('OT') || s.Quarter === 'OT'
  };
  g.homeWinProb = gameWinProbability(g);
  return g;
}

function playKind(p: J): PlayKind {
  const t = String(p.Type ?? '');
  if (p.IsScoringPlay) return 'score';
  if (/Interception|Fumble/i.test(t)) return 'turnover';
  if (/Pass|Sack/i.test(t)) return 'pass';
  if (/Rush/i.test(t)) return 'run';
  if (/Punt/i.test(t)) return 'punt';
  if (/FieldGoal|ExtraPoint|Kickoff/i.test(t)) return 'kick';
  if (/Penalty/i.test(t)) return 'penalty';
  if (/Timeout/i.test(t)) return 'timeout';
  return 'other';
}

function mapPlays(raw: J[], g: Game): Play[] {
  // Walk forward through the game to compute win probability after each play.
  let awayScore = 0, homeScore = 0;
  const out: Play[] = [];
  const sorted = raw.slice().sort((a, b) => Number(a.Sequence ?? a.PlayID) - Number(b.Sequence ?? b.PlayID));
  for (const p of sorted) {
    const q = quarterNumber(p.QuarterName) ?? 1;
    const clock = `${p.TimeRemainingMinutes ?? 0}:${String(p.TimeRemainingSeconds ?? 0).padStart(2, '0')}`;
    const teamAbbr = normalizeAbbr(p.Team);
    const kind = playKind(p);
    if (p.IsScoringPlay) {
      // VERIFY: scoring plays may carry AwayScore/HomeScore after the play; fall back to points from type.
      if (p.AwayScore != null) awayScore = Number(p.AwayScore);
      if (p.HomeScore != null) homeScore = Number(p.HomeScore);
    }
    const possession = teamAbbr === g.home.abbr ? 'home' : 'away';
    const yl = p.YardLine != null ? Number(p.YardLine) : null;
    const terr = normalizeAbbr(p.YardLineTerritory);
    const yfog = yl == null ? null : terr === teamAbbr ? yl : 100 - yl;
    out.push({
      id: String(p.PlayID), quarter: q, clock, team: teamAbbr,
      down: p.Down ?? null, distance: p.Distance ?? null,
      spot: yl != null && terr ? `${terr} ${yl}` : null,
      text: String(p.Description ?? ''), kind, yards: p.YardsGained ?? undefined,
      homeWinProb: homeWinProbability({
        homeMargin: homeScore - awayScore, secondsLeft: secondsRemaining(q, clock),
        possession, yardsFromOwnGoal: yfog, homeSpread: g.odds?.spread ?? null
      })
    });
  }
  return out.reverse();
}

function mapPlayers(raw: J[]): PlayerLine[] {
  return raw.map((p) => ({
    id: String(p.PlayerID), name: shortName(p.Name), team: normalizeAbbr(p.Team), pos: String(p.Position ?? ''),
    passing: p.PassingAttempts ? { cmp: +p.PassingCompletions || 0, att: +p.PassingAttempts || 0, yds: +p.PassingYards || 0, td: +p.PassingTouchdowns || 0, int: +p.PassingInterceptions || 0 } : undefined,
    rushing: p.RushingAttempts ? { att: +p.RushingAttempts || 0, yds: +p.RushingYards || 0, td: +p.RushingTouchdowns || 0 } : undefined,
    receiving: p.Receptions ? { rec: +p.Receptions || 0, tgt: +p.ReceivingTargets || 0, yds: +p.ReceivingYards || 0, td: +p.ReceivingTouchdowns || 0 } : undefined,
    fumblesLost: +p.FumblesLost || 0,
    twoPt: (+p.TwoPointConversionPasses || 0) + (+p.TwoPointConversionRuns || 0) + (+p.TwoPointConversionReceptions || 0)
  })).filter((p) => p.passing || p.rushing || p.receiving);
}

function shortName(full: unknown): string {
  const s = String(full ?? '').trim();
  const parts = s.split(/\s+/);
  return parts.length > 1 ? `${parts[0][0]}. ${parts.slice(1).join(' ')}` : s;
}

function mapTeamStats(raw: J[], g: Game): TeamStatRow[] {
  const a = raw.find((t) => normalizeAbbr(t.Team) === g.away.abbr);
  const h = raw.find((t) => normalizeAbbr(t.Team) === g.home.abbr);
  if (!a || !h) return [];
  // VERIFY all TeamGame field names.
  const row = (label: string, key: string): TeamStatRow => ({ label, away: +a[key] || 0, home: +h[key] || 0 });
  return [
    row('Total yards', 'OffensiveYards'),
    row('Passing', 'PassingYards'),
    row('Rushing', 'RushingYards'),
    { label: '3rd down', away: +a.ThirdDownConversions || 0, home: +h.ThirdDownConversions || 0,
      awayText: `${a.ThirdDownConversions ?? 0}/${a.ThirdDownAttempts ?? 0}`, homeText: `${h.ThirdDownConversions ?? 0}/${h.ThirdDownAttempts ?? 0}` },
    row('Turnovers', 'Giveaways'),
    { label: 'Possession', away: mins(a.TimeOfPossession), home: mins(h.TimeOfPossession), awayText: a.TimeOfPossession, homeText: h.TimeOfPossession }
  ];
}

function mins(top: unknown): number {
  const [m, s] = String(top ?? '0:0').split(':').map(Number);
  return (m || 0) + (s || 0) / 60;
}

function injuryStatus(s: unknown): InjuryStatus {
  const v = String(s ?? '').toLowerCase();
  if (v.includes('ir') || v.includes('reserve')) return 'IR';
  if (v.startsWith('out')) return 'Out';
  if (v.startsWith('doubt')) return 'Doubtful';
  if (v.startsWith('prob')) return 'Probable';
  return 'Questionable';
}

function mapInjuries(raw: J[], teams: string[]): Injury[] {
  return raw
    .filter((r) => teams.includes(normalizeAbbr(r.Team)))
    .map((r) => ({ team: normalizeAbbr(r.Team), name: shortName(r.Name), pos: String(r.Position ?? ''), detail: r.BodyPart ?? undefined, status: injuryStatus(r.Status) }));
}

const LINEUP_POS: Record<string, string> = { QB: 'QB', RB: 'RB', HB: 'RB', FB: 'RB', WR: 'WR', LWR: 'WR', RWR: 'WR', SWR: 'WR', SLWR: 'WR', TE: 'TE', K: 'K', PK: 'K' };
const lineupPos = (p: unknown) => LINEUP_POS[String(p ?? '').toUpperCase().replace(/\d/g, '')] ?? null;

function mapLineup(depth: J[], abbr: string, teamId: unknown, injuries: J[]): LineupSlot[] {
  // DepthCharts returns one entry per team: { TeamID, Offense: [{ Name, Position, DepthOrder, Team? }], Defense, SpecialTeams }.
  // Some plans omit the team abbreviation at the top level, so match by TeamID or by the players' own Team field too.
  const d = depth.find((t) =>
    (t.Team && normalizeAbbr(t.Team) === abbr) ||
    (teamId != null && t.TeamID != null && String(t.TeamID) === String(teamId)) ||
    (Array.isArray(t.Offense) && t.Offense.some((p: J) => p.Team && normalizeAbbr(p.Team) === abbr)));
  if (!d) return [];
  const want = ['QB', 'RB', 'WR', 'WR', 'WR', 'TE', 'K'];
  const used = new Set<string>();
  const out: LineupSlot[] = [];
  const all: J[] = [...(d.Offense ?? []), ...(d.SpecialTeams ?? [])];
  for (const pos of want) {
    const pick = all
      .filter((p) => lineupPos(p.Position) === pos && p.Name && !used.has(p.Name))
      .sort((x, y) => Number(x.DepthOrder ?? 99) - Number(y.DepthOrder ?? 99))[0];
    if (!pick) continue;
    used.add(pick.Name);
    const inj = injuries.find((i) => i.Name === pick.Name);
    out.push({ pos, name: shortName(pick.Name), status: inj ? injuryStatus(inj.Status) : undefined });
  }
  return out;
}

function lastFive(abbr: string, scores: J[]): Standing['last5'] {
  return scores
    .filter((s) => (normalizeAbbr(s.AwayTeam) === abbr || normalizeAbbr(s.HomeTeam) === abbr) && (s.IsOver || String(s.Status).startsWith('F')))
    .sort((a, b) => String(b.DateTime ?? b.Date).localeCompare(String(a.DateTime ?? a.Date)))
    .slice(0, 5)
    .map((s) => {
      const isHome = normalizeAbbr(s.HomeTeam) === abbr;
      const mine = Number(isHome ? s.HomeScore : s.AwayScore), theirs = Number(isHome ? s.AwayScore : s.HomeScore);
      return mine > theirs ? 'W' : mine < theirs ? 'L' : 'T';
    })
    .reverse() as Standing['last5'];
}

/** Simple seeding: division leaders 1-4, then best records 5-7. Ignores NFL tiebreakers. */
export function assignSeeds(rows: Standing[]): Standing[] {
  const pct = (s: Standing) => (s.w + s.t / 2) / Math.max(1, s.w + s.l + s.t);
  for (const conf of ['AFC', 'NFC'] as const) {
    const inConf = rows.filter((r) => team(r.team).conf === conf);
    const leaders = (['East', 'North', 'South', 'West'] as const)
      .map((div) => inConf.filter((r) => team(r.team).div === div).sort((a, b) => pct(b) - pct(a))[0])
      .filter(Boolean)
      .sort((a, b) => pct(b) - pct(a));
    leaders.forEach((s, i) => (s.seed = i + 1));
    inConf.filter((r) => !leaders.includes(r)).sort((a, b) => pct(b) - pct(a)).slice(0, 3).forEach((s, i) => (s.seed = 5 + i));
  }
  return rows;
}
