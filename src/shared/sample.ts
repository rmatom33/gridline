// Sample data source with a live replay.
//
// Everything here is made up: players have invented names and the scores are
// fictional. The featured game (BUF at KC) replays its final two minutes on a
// loop, one play every 12 seconds, so live polling, win probability, player
// stats and the summary can all be seen changing without a real feed.

import type {
  DataSource, Game, GameDetail, GameStatus, Injury, LineupSlot, Odds, Play, PlayerLine,
  Schedule, Scoreboard, Situation, Standing, TeamStatRow, Weather
} from './types';
import { gameWinProbability, homeWinProbability, pregameHomeWinProbability, secondsRemaining } from './winprob';
import { buildSummary } from './summary';
import { buildTeamDetail } from './teamdetail';
import { TEAMS } from './teams';

const SEASON = 2026;
const WEEK = 8;
const STEP_MS = 12_000;
const HOUR = 3_600_000;
const FIVE_MIN = 300_000;
/** Kickoff relative to now, rounded to 5 minutes so times look real. */
const kick = (now: number, offsetH: number) => new Date(Math.round((now + offsetH * HOUR) / FIVE_MIN) * FIVE_MIN).toISOString();

// ---------------------------------------------------------------------------
// Featured game script: BUF at KC
// ---------------------------------------------------------------------------

type Delta = Record<string, { pass?: [number, number, number, number, number]; rush?: [number, number, number]; rec?: [number, number, number] }>;

interface Step {
  play: Omit<Play, 'id' | 'homeWinProb'>;
  quarterClock: string;
  score?: { away?: number; home?: number };
  possession: 'home' | 'away';
  down: number | null;
  distance: number | null;
  yfog: number | null; // yards from own goal of team in possession
  spot: string | null;
  delta?: Delta;
  awayTimeouts?: number;
  final?: boolean;
  turnover?: { team: 'home' | 'away' };
}

const SCRIPT: Step[] = [
  { play: { quarter: 4, clock: '1:41', team: 'BUF', down: 1, distance: 10, spot: 'KC 34', text: 'J. Okafor run up the middle for 4 yards.', kind: 'run', yards: 4 },
    quarterClock: '1:41', possession: 'away', down: 2, distance: 6, yfog: 70, spot: 'KC 30', delta: { okafor: { rush: [1, 4, 0] } } },
  { play: { quarter: 4, clock: '1:05', team: 'BUF', down: 2, distance: 6, spot: 'KC 30', text: 'A. Carter pass deep right to D. Mills for 18 yards.', kind: 'pass', yards: 18 },
    quarterClock: '1:05', possession: 'away', down: 1, distance: 10, yfog: 88, spot: 'KC 12', delta: { carter: { pass: [1, 1, 18, 0, 0] }, mills: { rec: [1, 18, 0] } } },
  { play: { quarter: 4, clock: '0:59', team: 'BUF', down: 1, distance: 10, spot: 'KC 12', text: 'A. Carter pass incomplete short left intended for T. Reyes.', kind: 'pass', yards: 0 },
    quarterClock: '0:59', possession: 'away', down: 2, distance: 10, yfog: 88, spot: 'KC 12', delta: { carter: { pass: [0, 1, 0, 0, 0] } } },
  { play: { quarter: 4, clock: '0:54', team: 'BUF', down: 2, distance: 10, spot: 'KC 12', text: 'J. Okafor run right end for 5 yards.', kind: 'run', yards: 5 },
    quarterClock: '0:54', possession: 'away', down: 3, distance: 5, yfog: 93, spot: 'KC 7', delta: { okafor: { rush: [1, 5, 0] } } },
  { play: { quarter: 4, clock: '0:27', team: 'BUF', text: 'Timeout #2 by BUF.', kind: 'timeout' },
    quarterClock: '0:27', possession: 'away', down: 3, distance: 5, yfog: 93, spot: 'KC 7', awayTimeouts: 1 },
  { play: { quarter: 4, clock: '0:21', team: 'BUF', down: 3, distance: 5, spot: 'KC 7', text: 'A. Carter pass short middle to T. Reyes for 7 yards, TOUCHDOWN.', kind: 'score', yards: 7 },
    quarterClock: '0:21', score: { away: 27 }, possession: 'away', down: null, distance: null, yfog: null, spot: null, awayTimeouts: 1,
    delta: { carter: { pass: [1, 1, 7, 1, 0] }, reyes: { rec: [1, 7, 1] } } },
  { play: { quarter: 4, clock: '0:21', team: 'BUF', text: 'B. Holm extra point is good. BUF leads 28-24.', kind: 'kick' },
    quarterClock: '0:21', score: { away: 28 }, possession: 'away', down: null, distance: null, yfog: null, spot: null, awayTimeouts: 1 },
  { play: { quarter: 4, clock: '0:21', team: 'BUF', text: 'B. Holm kicks off into the end zone, touchback.', kind: 'kick' },
    quarterClock: '0:21', possession: 'home', down: 1, distance: 10, yfog: 25, spot: 'KC 25', awayTimeouts: 1 },
  { play: { quarter: 4, clock: '0:14', team: 'KC', down: 1, distance: 10, spot: 'KC 25', text: 'R. Hayes pass short right to M. Price for 17 yards.', kind: 'pass', yards: 17 },
    quarterClock: '0:14', possession: 'home', down: 1, distance: 10, yfog: 42, spot: 'KC 42', awayTimeouts: 1,
    delta: { hayes: { pass: [1, 1, 17, 0, 0] }, price: { rec: [1, 17, 0] } } },
  { play: { quarter: 4, clock: '0:00', team: 'KC', down: 1, distance: 10, spot: 'KC 42', text: 'R. Hayes pass deep middle intercepted by K. Doyle at the BUF 5. End of game.', kind: 'turnover' },
    quarterClock: '0:00', possession: 'home', down: null, distance: null, yfog: null, spot: null, awayTimeouts: 1, final: true,
    delta: { hayes: { pass: [0, 1, 0, 0, 1] } }, turnover: { team: 'home' } }
];

const HOLD_FINAL_STEPS = 6; // stay on "Final" for ~72s before replaying

const BASE_PLAYS: Omit<Play, 'id' | 'homeWinProb'>[] = [
  { quarter: 4, clock: '2:14', team: 'BUF', down: 3, distance: 3, spot: 'KC 44', text: 'A. Carter pass short right to D. Mills for 10 yards. First down.', kind: 'pass', yards: 10 },
  { quarter: 4, clock: '2:51', team: 'BUF', down: 2, distance: 7, spot: 'KC 48', text: 'A. Carter scrambles up the middle for 4 yards.', kind: 'run', yards: 4 },
  { quarter: 4, clock: '3:30', team: 'BUF', down: 1, distance: 10, spot: 'BUF 49', text: 'J. Okafor run left tackle for 3 yards.', kind: 'run', yards: 3 },
  { quarter: 4, clock: '3:58', team: 'BUF', down: 1, distance: 10, spot: 'BUF 25', text: 'A. Carter pass deep left to T. Reyes for 24 yards.', kind: 'pass', yards: 24 },
  { quarter: 4, clock: '4:06', team: 'KC', text: 'T. Lindqvist punts 46 yards, returned to the BUF 25 by K. Doyle.', kind: 'punt' },
  { quarter: 4, clock: '4:48', team: 'KC', down: 3, distance: 6, spot: 'KC 39', text: 'R. Hayes pass incomplete deep left intended for M. Price.', kind: 'pass', yards: 0 },
  { quarter: 4, clock: '9:30', team: 'BUF', down: 2, distance: 5, spot: 'KC 22', text: 'A. Carter pass to D. Mills for 22 yards, TOUCHDOWN.', kind: 'score', yards: 22 },
  { quarter: 4, clock: '11:02', team: 'KC', down: 2, distance: 9, spot: 'BUF 40', text: 'R. Hayes pass intercepted by K. Doyle at the BUF 31.', kind: 'turnover' },
  { quarter: 3, clock: '4:15', team: 'KC', down: 2, distance: 3, spot: 'BUF 3', text: 'K. Bishop run up the middle for 3 yards, TOUCHDOWN.', kind: 'score', yards: 3 },
  { quarter: 2, clock: '0:31', team: 'KC', down: 1, distance: 6, spot: 'BUF 6', text: 'R. Hayes pass to J. Kemp for 6 yards, TOUCHDOWN.', kind: 'score', yards: 6 },
  { quarter: 2, clock: '3:10', team: 'BUF', down: 3, distance: 8, spot: 'KC 8', text: 'A. Carter pass to D. Mills for 8 yards, TOUCHDOWN.', kind: 'score', yards: 8 },
  { quarter: 2, clock: '9:44', team: 'KC', down: 2, distance: 7, spot: 'BUF 15', text: 'R. Hayes pass to M. Price for 15 yards, TOUCHDOWN.', kind: 'score', yards: 15 },
  { quarter: 1, clock: '2:05', team: 'KC', down: 4, distance: 4, spot: 'BUF 23', text: 'H. Bauer 41-yard field goal is good.', kind: 'score' },
  { quarter: 1, clock: '8:01', team: 'BUF', down: 1, distance: 2, spot: 'KC 2', text: 'J. Okafor run left guard for 2 yards, TOUCHDOWN.', kind: 'score', yards: 2 }
];

// Margin (home minus away) through the game, used to draw the early win-probability curve.
const MARGIN_EVENTS: [number, number][] = [
  [0, 0], [420, -7], [780, -4], [1250, 3], [1610, -4], [1770, 3], [2445, 10], [3030, 3]
];

function basePlayers(): PlayerLine[] {
  return [
    { id: 'carter', name: 'A. Carter', team: 'BUF', pos: 'QB', passing: { cmp: 22, att: 31, yds: 248, td: 2, int: 0 }, rushing: { att: 6, yds: 34, td: 0 } },
    { id: 'okafor', name: 'J. Okafor', team: 'BUF', pos: 'RB', rushing: { att: 15, yds: 61, td: 1 }, receiving: { rec: 2, yds: 14, td: 0 } },
    { id: 'mills', name: 'D. Mills', team: 'BUF', pos: 'WR', receiving: { rec: 7, yds: 96, td: 2 } },
    { id: 'reyes', name: 'T. Reyes', team: 'BUF', pos: 'WR', receiving: { rec: 4, yds: 52, td: 0 } },
    { id: 'hayes', name: 'R. Hayes', team: 'KC', pos: 'QB', passing: { cmp: 19, att: 30, yds: 231, td: 2, int: 1 }, rushing: { att: 2, yds: 9, td: 0 } },
    { id: 'bishop', name: 'K. Bishop', team: 'KC', pos: 'RB', rushing: { att: 18, yds: 82, td: 1 }, receiving: { rec: 3, yds: 21, td: 0 } },
    { id: 'price', name: 'M. Price', team: 'KC', pos: 'WR', receiving: { rec: 6, yds: 88, td: 1 } },
    { id: 'kemp', name: 'J. Kemp', team: 'KC', pos: 'TE', receiving: { rec: 4, yds: 41, td: 1 } }
  ];
}

function applyDelta(players: PlayerLine[], d: Delta) {
  for (const [id, change] of Object.entries(d)) {
    const p = players.find((x) => x.id === id);
    if (!p) continue;
    if (change.pass) {
      p.passing ??= { cmp: 0, att: 0, yds: 0, td: 0, int: 0 };
      const [c, a, y, t, i] = change.pass;
      p.passing.cmp += c; p.passing.att += a; p.passing.yds += y; p.passing.td += t; p.passing.int += i;
    }
    if (change.rush) {
      p.rushing ??= { att: 0, yds: 0, td: 0 };
      const [a, y, t] = change.rush;
      p.rushing.att += a; p.rushing.yds += y; p.rushing.td += t;
    }
    if (change.rec) {
      p.receiving ??= { rec: 0, yds: 0, td: 0 };
      const [r, y, t] = change.rec;
      p.receiving.rec += r; p.receiving.yds += y; p.receiving.td += t;
    }
  }
}

const KC_ODDS: Odds = { spread: -2.5, total: 47.5, homeMoneyline: -135, awayMoneyline: 115 };

function featuredStep(now: number): number {
  const cycle = SCRIPT.length + 1 + HOLD_FINAL_STEPS;
  return Math.floor(now / STEP_MS) % cycle; // 0 = the 2:14 snapshot, SCRIPT.length = final
}

function featuredGame(now: number): GameDetail {
  const step = Math.min(featuredStep(now), SCRIPT.length);
  const players = basePlayers();
  let away = 21, home = 24, awayTimeouts = 2, final = false;
  let possession: 'home' | 'away' = 'away';
  let clock = '2:14';
  let situation: Situation = { down: 1, distance: 10, yardsFromOwnGoal: 66, spot: 'KC 34', drivePlays: 4, driveYards: 41, driveTime: '1:52', driveStart: 25 };
  let turnovers = { away: 0, home: 1 };

  const tFor = (c: string) => 2700 + (900 - secondsRemaining(4, c) );
  const prePlays: Play[] = BASE_PLAYS.map((p, i) => ({ ...p, id: `b${i}` }));
  const series = MARGIN_EVENTS.flatMap(([t, m], i) => {
    const next = MARGIN_EVENTS[i + 1]?.[0] ?? 3466;
    const pts = [];
    for (let x = t; x < next; x += 120) {
      pts.push({ t: x, homeWinProb: homeWinProbability({ homeMargin: m, secondsLeft: 3600 - x, possession: null, yardsFromOwnGoal: null, homeSpread: KC_ODDS.spread }) });
    }
    return pts;
  });
  const snap = homeWinProbability({ homeMargin: 3, secondsLeft: 134, possession: 'away', yardsFromOwnGoal: 66, homeSpread: KC_ODDS.spread });
  series.push({ t: 3466, homeWinProb: snap });
  prePlays[0].homeWinProb = snap;

  const livePlays: Play[] = [];
  for (let i = 0; i < step; i++) {
    const s = SCRIPT[i];
    if (s.score?.away != null) away = s.score.away;
    if (s.score?.home != null) home = s.score.home;
    if (s.awayTimeouts != null) awayTimeouts = s.awayTimeouts;
    if (s.delta) applyDelta(players, s.delta);
    if (s.turnover) turnovers = { ...turnovers, [s.turnover.team]: turnovers[s.turnover.team] + 1 };
    possession = s.possession;
    clock = s.quarterClock;
    final = !!s.final;
    const driveContinues = s.possession === 'away' && i < 5;
    situation = {
      down: s.down, distance: s.distance, yardsFromOwnGoal: s.yfog, spot: s.spot,
      drivePlays: driveContinues ? situation.drivePlays! + (s.play.kind === 'timeout' ? 0 : 1) : s.possession === 'home' ? (i >= 8 ? 1 : 0) : situation.drivePlays,
      driveYards: driveContinues ? situation.driveYards! + (s.play.yards ?? 0) : s.possession === 'home' ? (i >= 8 ? 17 : 0) : situation.driveYards,
      driveTime: situation.driveTime,
      driveStart: s.possession === 'home' ? 25 : 25
    };
    const wp = final ? 0 : homeWinProbability({
      homeMargin: home - away, secondsLeft: secondsRemaining(4, clock), possession,
      yardsFromOwnGoal: s.yfog, homeSpread: KC_ODDS.spread
    });
    livePlays.unshift({ ...s.play, id: `s${i}`, homeWinProb: wp });
    series.push({ t: Math.min(3600, tFor(clock)), homeWinProb: wp });
  }

  const status: GameStatus = final ? 'final' : 'live';
  const passYds = (t: string) => players.filter((p) => p.team === t).reduce((n, p) => n + (p.passing?.yds ?? 0), 0);
  const rushYds = (t: string) => players.filter((p) => p.team === t).reduce((n, p) => n + (p.rushing?.yds ?? 0), 0);
  const teamStats: TeamStatRow[] = [
    { label: 'Total yards', away: passYds('BUF') + rushYds('BUF'), home: passYds('KC') + rushYds('KC') },
    { label: 'Passing', away: passYds('BUF'), home: passYds('KC') },
    { label: 'Rushing', away: rushYds('BUF'), home: rushYds('KC') },
    { label: '3rd down', away: 6, home: 4, awayText: '6/12', homeText: '4/11' },
    { label: 'Turnovers', away: turnovers.away, home: turnovers.home },
    { label: 'Possession', away: 31, home: 25, awayText: '31:04', homeText: '24:42' }
  ];

  const g: GameDetail = {
    id: 'buf-kc', season: SEASON, week: WEEK,
    kickoff: kick(now, -3.1),
    status, quarter: 4, clock: final ? '0:00' : clock,
    away: { abbr: 'BUF', score: away, record: '6-1', timeouts: awayTimeouts },
    home: { abbr: 'KC', score: home, record: '5-2', timeouts: 3 },
    possession: final ? null : possession,
    situation: final ? undefined : situation,
    odds: { spread: final ? KC_ODDS.spread : step >= 6 ? 4.5 : -1.5, total: 47.5, homeMoneyline: step >= 6 ? 210 : -125, awayMoneyline: step >= 6 ? -260 : 105, isLive: !final },
    weather: { dome: false, tempF: 48, windMph: 12, windDir: 'NW', description: 'Cloudy', precipPct: 10 },
    venue: { city: 'Kansas City', state: 'MO' },
    quarters: { away: [7, 7, 0, away - 14], home: [3, 14, 7, home - 24] },
    plays: [...livePlays, ...prePlays],
    winProbSeries: series,
    players,
    teamStats,
    injuries: [
      { team: 'KC', name: 'M. Price', pos: 'WR', detail: 'Hamstring', status: 'Questionable' },
      { team: 'BUF', name: 'L. Grant', pos: 'CB', detail: 'Knee', status: 'Out' },
      { team: 'KC', name: 'S. Bell', pos: 'OT', detail: 'Ankle', status: 'Returned' }
    ],
    lineups: {
      away: lineup(['QB A. Carter', 'RB J. Okafor', 'WR D. Mills', 'WR T. Reyes', 'WR P. Nash', 'TE G. Ward', 'K B. Holm']),
      home: lineup(['QB R. Hayes', 'RB K. Bishop', 'WR M. Price:Questionable', 'WR C. Duarte', 'WR E. Lowe', 'TE J. Kemp', 'K H. Bauer'])
    },
    pregameHomeWinProb: pregameHomeWinProbability(KC_ODDS.spread)
  };
  g.homeWinProb = final ? gameWinProbability(g) : (livePlays[0]?.homeWinProb ?? snap);
  g.lastPlay = g.plays.find((p) => p.kind !== 'timeout')?.text;
  if (final) g.overtime = false;
  g.summary = buildSummary(g);
  return g;
}

function lineup(rows: string[]): LineupSlot[] {
  return rows.map((r) => {
    const [main, status] = r.split(':');
    const [pos, ...name] = main.split(' ');
    return { pos, name: name.join(' '), status: status as LineupSlot['status'] };
  });
}

// ---------------------------------------------------------------------------
// Other games (static snapshots)
// ---------------------------------------------------------------------------

interface Static {
  id: string; away: string; home: string; aRec: string; hRec: string;
  status: GameStatus; kickoffOffsetH: number;
  as?: number; hs?: number; quarter?: number; clock?: string; possession?: 'home' | 'away';
  situation?: Situation; odds: Odds; weather: Weather; city: string; state: string;
  quarters?: { away: number[]; home: number[] }; overtime?: boolean;
  plays?: Omit<Play, 'id' | 'homeWinProb'>[]; players?: PlayerLine[]; injuries?: Injury[];
}

const WX = (tempF: number, windMph: number, description: string, precipPct = 0, windDir = 'W'): Weather => ({ dome: false, tempF, windMph, windDir, description, precipPct });
const DOME: Weather = { dome: true };

const STATIC: Static[] = [
  { id: 'phi-dal', away: 'PHI', home: 'DAL', aRec: '5-2', hRec: '3-4', status: 'live', kickoffOffsetH: -2.2, as: 17, hs: 13, quarter: 3, clock: '6:41', possession: 'away',
    situation: { down: 3, distance: 2, yardsFromOwnGoal: 55, spot: 'DAL 45' }, odds: { spread: 1.5, total: 46.5, homeMoneyline: 110, awayMoneyline: -130, isLive: true },
    weather: DOME, city: 'Arlington', state: 'TX', quarters: { away: [7, 3, 7], home: [3, 10, 0] },
    plays: [{ quarter: 3, clock: '7:20', team: 'PHI', text: 'S. Okoro run right for 14 yards.', kind: 'run', yards: 14 },
      { quarter: 3, clock: '10:02', team: 'PHI', text: 'L. Ferris pass to N. Abara for 31 yards, TOUCHDOWN.', kind: 'score' }],
    players: [{ id: 'ferris', name: 'L. Ferris', team: 'PHI', pos: 'QB', passing: { cmp: 15, att: 22, yds: 201, td: 1, int: 0 }, rushing: { att: 4, yds: 22, td: 0 } },
      { id: 'abara', name: 'N. Abara', team: 'PHI', pos: 'WR', receiving: { rec: 5, yds: 94, td: 1 } },
      { id: 'okoro', name: 'S. Okoro', team: 'PHI', pos: 'RB', rushing: { att: 14, yds: 71, td: 1 } }] },
  { id: 'sf-det', away: 'SF', home: 'DET', aRec: '4-3', hRec: '6-1', status: 'halftime', kickoffOffsetH: -1.6, as: 10, hs: 20, quarter: 2, clock: '0:00',
    odds: { spread: -3.5, total: 50.5, homeMoneyline: -180, awayMoneyline: 150, isLive: true }, weather: DOME, city: 'Detroit', state: 'MI',
    quarters: { away: [7, 3], home: [10, 10] },
    plays: [{ quarter: 2, clock: '0:04', team: 'DET', text: 'R. Vance 48-yard field goal is good.', kind: 'score' }],
    players: [{ id: 'mercer', name: 'T. Mercer', team: 'DET', pos: 'RB', rushing: { att: 11, yds: 67, td: 1 }, receiving: { rec: 3, yds: 28, td: 0 } }] },
  { id: 'bal-cin', away: 'BAL', home: 'CIN', aRec: '5-2', hRec: '3-4', status: 'final', kickoffOffsetH: -4.5, as: 27, hs: 24,
    odds: { spread: 2.5, total: 49.5, homeMoneyline: 120, awayMoneyline: -140 }, weather: WX(52, 6, 'Partly cloudy'), city: 'Cincinnati', state: 'OH',
    quarters: { away: [7, 10, 3, 7], home: [3, 7, 7, 7] },
    plays: [{ quarter: 4, clock: '0:38', team: 'BAL', text: 'D. Kessler run up the middle for 9 yards, TOUCHDOWN.', kind: 'score' }],
    players: [{ id: 'kessler', name: 'D. Kessler', team: 'BAL', pos: 'QB', passing: { cmp: 20, att: 29, yds: 236, td: 1, int: 0 }, rushing: { att: 9, yds: 72, td: 2 } }] },
  { id: 'gb-min', away: 'GB', home: 'MIN', aRec: '4-3', hRec: '4-3', status: 'final', kickoffOffsetH: -4.5, as: 31, hs: 28, overtime: true,
    odds: { spread: -1, total: 45.5, homeMoneyline: -115, awayMoneyline: -105 }, weather: DOME, city: 'Minneapolis', state: 'MN',
    quarters: { away: [7, 7, 7, 7, 3], home: [0, 14, 7, 7, 0] },
    plays: [{ quarter: 5, clock: '4:12', team: 'GB', text: 'E. Strand 33-yard field goal is good. GB wins.', kind: 'score' }],
    players: [{ id: 'ruiz', name: 'A. Ruiz', team: 'GB', pos: 'WR', receiving: { rec: 8, yds: 124, td: 1 } },
      { id: 'strand', name: 'E. Strand', team: 'GB', pos: 'K' }] },
  { id: 'mia-nyj', away: 'MIA', home: 'NYJ', aRec: '2-5', hRec: '3-4', status: 'scheduled', kickoffOffsetH: 2.08,
    odds: { spread: 3.5, total: 42, homeMoneyline: 150, awayMoneyline: -175 }, weather: WX(61, 8, 'Clear', 0, 'SW'), city: 'East Rutherford', state: 'NJ',
    injuries: [{ team: 'MIA', name: 'J. Whitfield', pos: 'RB', detail: 'Ankle', status: 'Questionable' },
      { team: 'MIA', name: 'B. Lindell', pos: 'WR', detail: 'Groin', status: 'Questionable' },
      { team: 'NYJ', name: 'R. Castillo', pos: 'LB', detail: 'Knee', status: 'Out' }] },
  { id: 'lar-sea', away: 'LAR', home: 'SEA', aRec: '4-3', hRec: '4-3', status: 'scheduled', kickoffOffsetH: 5.95,
    odds: { spread: -1, total: 45, homeMoneyline: -115, awayMoneyline: -105 }, weather: WX(53, 11, 'Rain likely', 40, 'S'), city: 'Seattle', state: 'WA' }
];

function staticGame(s: Static, now: number): GameDetail {
  const g: GameDetail = {
    id: s.id, season: SEASON, week: WEEK,
    kickoff: kick(now, s.kickoffOffsetH),
    status: s.status, quarter: s.quarter ?? (s.status === 'final' ? 4 : null), clock: s.clock ?? null,
    away: { abbr: s.away, score: s.as ?? null, record: s.aRec, timeouts: 3 },
    home: { abbr: s.home, score: s.hs ?? null, record: s.hRec, timeouts: 3 },
    possession: s.possession ?? null, situation: s.situation, odds: s.odds, weather: s.weather,
    venue: { city: s.city, state: s.state }, overtime: s.overtime,
    quarters: s.quarters ?? { away: [], home: [] },
    plays: (s.plays ?? []).map((p, i) => ({ ...p, id: `${s.id}-${i}` })),
    winProbSeries: [], players: s.players ?? [], teamStats: [],
    injuries: s.injuries ?? [], lineups: { away: [], home: [] },
    pregameHomeWinProb: pregameHomeWinProbability(s.odds.spread)
  };
  g.homeWinProb = gameWinProbability(g);
  g.winProbSeries = quarterSeries(g);
  g.lastPlay = g.plays[0]?.text;
  g.summary = buildSummary(g);
  return g;
}

/** Coarse win-probability curve from quarter-end scores (for games without play data). */
function quarterSeries(g: GameDetail): GameDetail['winProbSeries'] {
  if (g.status === 'scheduled' || g.status === 'postponed') return [];
  const pts = [{ t: 0, homeWinProb: g.pregameHomeWinProb ?? 0.5 }];
  let a = 0, h = 0;
  const n = Math.min(4, Math.max(g.quarters.away.length, g.quarters.home.length));
  for (let q = 0; q < n; q++) {
    a += g.quarters.away[q] ?? 0; h += g.quarters.home[q] ?? 0;
    const t = (q + 1) * 900;
    const done = g.status === 'final' || q < n - 1 || g.status === 'halftime';
    if (!done) break;
    pts.push({ t, homeWinProb: homeWinProbability({ homeMargin: h - a, secondsLeft: 3600 - t, possession: null, yardsFromOwnGoal: null, homeSpread: g.odds?.spread ?? null }) });
  }
  if (g.status === 'live') pts.push({ t: 3600 - secondsRemaining(g.quarter, g.clock), homeWinProb: g.homeWinProb ?? 0.5 });
  if (g.status === 'final') pts[pts.length - 1] = { t: 3600, homeWinProb: g.homeWinProb ?? 0.5 };
  return pts;
}

function allGames(now: number): GameDetail[] {
  return [featuredGame(now), ...STATIC.map((s) => staticGame(s, now))];
}

function toGame(d: GameDetail): Game {
  const { quarters: _q, plays: _p, winProbSeries: _w, players: _pl, teamStats: _t, injuries: _i, lineups: _l, summary: _s, pregameHomeWinProb: _pg, ...g } = d;
  return g;
}

// ---------------------------------------------------------------------------
// Next week's schedule, standings
// ---------------------------------------------------------------------------

type Slot = 'thu' | 'sun1' | 'sun4' | 'mon';
const NEXT_WEEK: [string, string, string, string, Slot, number, number, Weather][] = [
  ['NE', '4-4', 'NYJ', '3-5', 'thu', -1, 41.5, WX(52, 14, 'Breezy')],
  ['PIT', '5-3', 'CLE', '2-6', 'sun1', 4, 38.5, WX(44, 9, 'Snow showers', 20)],
  ['HOU', '5-3', 'IND', '4-4', 'sun1', 1.5, 45, DOME],
  ['ATL', '4-4', 'TB', '6-2', 'sun1', -5, 47, WX(78, 5, 'Clear')],
  ['DEN', '3-5', 'LV', '2-6', 'sun4', 2.5, 40, DOME],
  ['CHI', '3-5', 'WAS', '5-3', 'mon', -3.5, 44, WX(55, 7, 'Showers', 30)]
];

/** Real-looking kickoff slots (US Eastern, DST-aware) for next week. */
function slotTime(now: number, slot: Slot): string {
  const d = new Date(now + 24 * HOUR);
  const toThu = (4 - d.getUTCDay() + 7) % 7;
  const thu = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + toThu);
  const at = (days: number, h: number, m: number) => {
    const wall = new Date(thu + days * 24 * HOUR + h * HOUR + m * 60_000); // ET wall time, written as if UTC
    const et = new Date(wall.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const utcAsLocal = new Date(wall.toLocaleString('en-US', { timeZone: 'UTC' }));
    return new Date(wall.getTime() + (utcAsLocal.getTime() - et.getTime())).toISOString();
  };
  return slot === 'thu' ? at(0, 20, 15) : slot === 'sun1' ? at(3, 13, 0) : slot === 'sun4' ? at(3, 16, 5) : at(4, 20, 15);
}

function nextWeekGames(now: number): Game[] {
  return NEXT_WEEK.map(([a, ar, h, hr, slot, spread, total, weather], i) => ({
    id: `w9-${i}`, season: SEASON, week: WEEK + 1,
    kickoff: slotTime(now, slot), status: 'scheduled' as const,
    quarter: null, clock: null, possession: null,
    away: { abbr: a, score: null, record: ar }, home: { abbr: h, score: null, record: hr },
    odds: { spread, total, homeMoneyline: null, awayMoneyline: null }, weather,
    homeWinProb: pregameHomeWinProbability(spread)
  }));
}

const STANDINGS: Standing[] = [
  ['BUF', 6, 1, 71, 'W4', 'WWWWL', 1], ['NE', 4, 3, 12, 'L1', 'LWWLW', 7], ['NYJ', 3, 4, -18, 'W1', 'WLLWL'], ['MIA', 2, 5, -44, 'L3', 'LLLWL'],
  ['BAL', 5, 2, 48, 'W2', 'WWLWW', 3], ['PIT', 5, 2, 30, 'W1', 'WLWWL', 5], ['CIN', 3, 4, -5, 'L1', 'LWLWW'], ['CLE', 2, 5, -51, 'L2', 'LLWLL'],
  ['HOU', 4, 3, 9, 'W2', 'WWLLW', 4], ['IND', 4, 3, 3, 'L1', 'LWWLW'], ['JAX', 2, 5, -37, 'L2', 'LLWLW'], ['TEN', 1, 6, -80, 'L5', 'LLLLL'],
  ['KC', 5, 2, 55, 'W3', 'WWWLW', 2], ['LAC', 4, 3, 16, 'W1', 'WLWLW', 6], ['DEN', 3, 4, -2, 'L1', 'LWLWW'], ['LV', 2, 5, -40, 'L2', 'LLWLL'],
  ['PHI', 5, 2, 44, 'W3', 'WWWLW', 2], ['WAS', 5, 2, 26, 'W1', 'WLWWL', 5], ['DAL', 3, 4, -9, 'L2', 'LLWWL'], ['NYG', 2, 5, -38, 'L1', 'LWLLW'],
  ['DET', 6, 1, 82, 'W5', 'WWWWW', 1], ['GB', 4, 3, 11, 'L1', 'LWWLW', 7], ['MIN', 4, 3, 6, 'W1', 'WLWLW'], ['CHI', 3, 4, -15, 'L2', 'LLWWL'],
  ['TB', 6, 2, 39, 'W2', 'WWLWW', 3], ['ATL', 4, 4, -2, 'L1', 'LWLWW'], ['NO', 3, 4, -12, 'W1', 'WLLWL'], ['CAR', 1, 6, -71, 'L4', 'LLLLW'],
  ['SF', 4, 3, 21, 'L1', 'LWWWL', 4], ['SEA', 4, 3, 8, 'W2', 'WWLLW', 6], ['LAR', 4, 3, 2, 'L1', 'LWLWW'], ['ARI', 2, 5, -33, 'L3', 'LLLWW']
].map(([team, w, l, diff, streak, form, seed]) => {
  const pf = 160 + Math.max(0, diff as number);
  return {
    team: team as string, w: w as number, l: l as number, t: 0, pf, pa: pf - (diff as number),
    streak: streak as string, last5: (form as string).split('').reverse() as Standing['last5'], seed: seed as number | undefined
  };
});

// ---------------------------------------------------------------------------

export function createSampleSource(clock: () => number = () => Date.now()): DataSource {
  const delay = <T>(v: T) => new Promise<T>((r) => setTimeout(() => r(structuredClone(v)), 120));
  return {
    async scoreboard(week = WEEK) {
      const now = clock();
      const games = week === WEEK ? allGames(now).map(toGame) : week === WEEK + 1 ? nextWeekGames(now) : [];
      const sb: Scoreboard = { season: SEASON, week, games, updatedAt: new Date(now).toISOString() };
      return delay(sb);
    },
    async game(id) {
      const g = allGames(clock()).find((x) => x.id === id);
      if (!g) {
        const up = nextWeekGames(clock()).find((x) => x.id === id);
        if (!up) throw new Error('Game not found');
        const d: GameDetail = { ...up, quarters: { away: [], home: [] }, plays: [], winProbSeries: [], players: [], teamStats: [], injuries: [], lineups: { away: [], home: [] }, pregameHomeWinProb: up.homeWinProb };
        d.summary = buildSummary(d);
        return delay(d);
      }
      return delay(g);
    },
    async schedule(week = WEEK + 1) {
      const now = clock();
      const games = week === WEEK ? allGames(now).map(toGame) : week === WEEK + 1 ? nextWeekGames(now) : [];
      const s: Schedule = { season: SEASON, week, weeks: Array.from({ length: 18 }, (_, i) => i + 1), games };
      return delay(s);
    },
    async standings() {
      return delay(STANDINGS);
    },
    async team(abbr) {
      const now = clock();
      if (!TEAMS[abbr]) throw new Error('Team not found');
      const current = allGames(now);
      const games: Game[] = [...pastResults(abbr, now), ...current.map(toGame), ...nextWeekGames(now)];
      const injuries = current.flatMap((g) => g.injuries);
      return delay(buildTeamDetail(abbr, STANDINGS, games, injuries, now));
    }
  };
}

/** Fictional earlier results so every team page has a "last 5" list that matches its form. */
function pastResults(abbr: string, now: number): Game[] {
  const st = STANDINGS.find((s) => s.team === abbr);
  if (!st) return [];
  const others = Object.keys(TEAMS).filter((t) => t !== abbr);
  const seed = abbr.charCodeAt(0) + abbr.charCodeAt(abbr.length - 1);
  // last5 is oldest-first and ends with the week before the current one.
  return st.last5.map((r, i) => {
    const week = WEEK - st.last5.length + i;
    const opp = others[(seed + i * 7) % others.length];
    const home = (seed + i) % 2 === 0;
    const winScore = 20 + ((seed + i * 5) % 15), loseScore = 10 + ((seed + i * 3) % 10);
    const us = r === 'W' ? winScore : r === 'L' ? loseScore : 20, them = r === 'W' ? loseScore : r === 'L' ? winScore : 20;
    return {
      id: '', season: SEASON, week, kickoff: new Date(now - (WEEK - week) * 7 * 24 * HOUR).toISOString(),
      status: 'final' as const, quarter: 4, clock: '0:00', possession: null,
      home: { abbr: home ? abbr : opp, score: home ? us : them },
      away: { abbr: home ? opp : abbr, score: home ? them : us }
    };
  });
}

export const SAMPLE_WEEK = WEEK;
