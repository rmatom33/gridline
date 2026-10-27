// Normalized data model. Every data provider maps its own feed into these
// shapes, so the UI never depends on one vendor's field names.

export type GameStatus = 'scheduled' | 'live' | 'halftime' | 'final' | 'postponed';
export type HomeAway = 'home' | 'away';

export interface Side {
  abbr: string;
  score: number | null;
  record?: string; // "6-1"
  timeouts?: number;
}

export interface Situation {
  down: number | null;
  distance: number | null;
  /** Yards from the possessing team's own goal line (0–100). */
  yardsFromOwnGoal: number | null;
  /** Human text, e.g. "KC 34". */
  spot: string | null;
  redZone?: boolean;
  drivePlays?: number;
  driveYards?: number;
  driveTime?: string;
  /** Where the current drive started, in yards from own goal. */
  driveStart?: number;
}

export interface Odds {
  /** Home-team spread. Negative = home favored. */
  spread: number | null;
  total: number | null;
  homeMoneyline: number | null;
  awayMoneyline: number | null;
  isLive?: boolean;
}

export interface Weather {
  dome: boolean;
  tempF?: number | null;
  windMph?: number | null;
  windDir?: string | null;
  description?: string | null;
  precipPct?: number | null;
}

export interface Venue {
  name?: string;
  city?: string;
  state?: string;
}

export interface Game {
  id: string;
  season: number;
  week: number;
  kickoff: string; // ISO 8601, UTC
  status: GameStatus;
  quarter: number | null; // 5 = OT
  clock: string | null; // "2:14"
  away: Side;
  home: Side;
  possession: HomeAway | null;
  situation?: Situation;
  odds?: Odds;
  weather?: Weather;
  venue?: Venue;
  /** Home win probability 0–1 (computed by Gridline). */
  homeWinProb?: number;
  lastPlay?: string;
  overtime?: boolean;
}

export type PlayKind = 'pass' | 'run' | 'punt' | 'kick' | 'score' | 'turnover' | 'penalty' | 'timeout' | 'other';

export interface Play {
  id: string;
  quarter: number;
  clock: string;
  team: string; // abbr with the ball
  down?: number | null;
  distance?: number | null;
  spot?: string | null;
  text: string;
  kind: PlayKind;
  yards?: number;
  /** Home win probability after the play. */
  homeWinProb?: number;
}

export interface PassLine { cmp: number; att: number; yds: number; td: number; int: number }
export interface RushLine { att: number; yds: number; td: number }
export interface RecLine { rec: number; tgt?: number; yds: number; td: number }

export interface PlayerLine {
  id: string;
  name: string;
  team: string;
  pos: string;
  passing?: PassLine;
  rushing?: RushLine;
  receiving?: RecLine;
  fumblesLost?: number;
  twoPt?: number;
}

export interface TeamStatRow {
  label: string;
  away: number;
  home: number;
  /** Optional display override, e.g. "6/12" or "31:04". */
  awayText?: string;
  homeText?: string;
}

export type InjuryStatus = 'Out' | 'Doubtful' | 'Questionable' | 'Probable' | 'IR' | 'Returned';

export interface Injury {
  team: string;
  name: string;
  pos: string;
  detail?: string;
  status: InjuryStatus;
}

export interface LineupSlot {
  pos: string;
  name: string;
  status?: InjuryStatus;
}

export interface WinProbPoint {
  /** Seconds elapsed in regulation (0–3600). */
  t: number;
  homeWinProb: number;
}

export interface GameDetail extends Game {
  quarters: { away: number[]; home: number[] };
  plays: Play[]; // newest first
  winProbSeries: WinProbPoint[];
  players: PlayerLine[];
  teamStats: TeamStatRow[];
  injuries: Injury[];
  lineups: { away: LineupSlot[]; home: LineupSlot[] };
  pregameHomeWinProb?: number;
  summary?: string;
}

export interface Standing {
  team: string;
  w: number;
  l: number;
  t: number;
  pf: number;
  pa: number;
  streak: string; // "W4"
  /** Oldest first, newest last. */
  last5: ('W' | 'L' | 'T')[];
  seed?: number;
}

export interface TeamResult {
  gameId: string;
  week: number;
  home: boolean;
  opp: string;
  us: number;
  them: number;
}

export interface TeamDetail {
  team: string;
  standing?: Standing;
  /** Division rank, 1-4. */
  divRank?: number;
  liveGame?: Game;
  nextGame?: Game;
  /** Newest first. */
  results: TeamResult[];
  injuries: Injury[];
  /** League ranks (1 = best) computed from standings. */
  ranks?: { pointsFor: number; pointsAgainst: number; diff: number };
}

export interface Scoreboard {
  season: number;
  week: number;
  games: Game[];
  updatedAt: string;
}

export interface Schedule {
  season: number;
  week: number;
  weeks: number[];
  games: Game[];
}

/** Anything that can serve Gridline data: the sample replay, or a real provider. */
export interface DataSource {
  scoreboard(week?: number): Promise<Scoreboard>;
  game(id: string): Promise<GameDetail>;
  schedule(week?: number): Promise<Schedule>;
  standings(): Promise<Standing[]>;
  team(abbr: string): Promise<TeamDetail>;
}
