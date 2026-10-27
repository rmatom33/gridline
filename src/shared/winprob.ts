// Baseline live win-probability model (Stern-style normal model).
//
// It blends: current margin, the value of the current possession (expected
// points from field position), and the pre-game spread, which fades as time
// runs out. It is transparent and needs no training data, so it works on day
// one. Replace `homeWinProbability` with a model trained on historical
// play-by-play (e.g. the free nflverse data) once you have it - the UI only
// needs a number between 0 and 1.

import type { Game, HomeAway } from './types';

const SIGMA = 13.45; // std-dev of final NFL margin vs. expectation, in points
const REG_SECONDS = 3600;

function normalCdf(z: number): number {
  // Abramowitz–Stegun approximation
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
}

/** Rough expected points of a possession from yards to own goal (0-100). */
export function expectedPoints(yardsFromOwnGoal: number): number {
  return Math.max(-0.5, Math.min(6.2, 0.065 * yardsFromOwnGoal - 1.2));
}

export function clockToSeconds(clock: string | null | undefined): number {
  if (!clock) return 0;
  const [m, s] = clock.split(':').map((n) => parseInt(n, 10));
  return (m || 0) * 60 + (s || 0);
}

/** Seconds left in regulation. Overtime counts as a 600-second period. */
export function secondsRemaining(quarter: number | null, clock: string | null): number {
  if (!quarter) return REG_SECONDS;
  if (quarter >= 5) return clockToSeconds(clock);
  return (4 - quarter) * 900 + clockToSeconds(clock);
}

export interface WinProbInput {
  homeMargin: number;
  secondsLeft: number;
  possession: HomeAway | null;
  yardsFromOwnGoal: number | null;
  homeSpread: number | null; // negative = home favored
}

export function homeWinProbability(i: WinProbInput): number {
  const frac = Math.max(0, i.secondsLeft) / REG_SECONDS;
  const prior = i.homeSpread == null ? 0 : -i.homeSpread; // expected home margin pre-game
  let poss = 0;
  if (i.possession && i.yardsFromOwnGoal != null) {
    const ep = expectedPoints(i.yardsFromOwnGoal);
    poss = i.possession === 'home' ? ep : -ep;
  }
  const mean = i.homeMargin + poss + prior * frac;
  if (i.secondsLeft <= 0) return i.homeMargin > 0 ? 1 : i.homeMargin < 0 ? 0 : 0.5;
  const sd = SIGMA * Math.sqrt(frac + 0.012);
  return Math.min(0.995, Math.max(0.005, normalCdf(mean / sd)));
}

export function pregameHomeWinProbability(homeSpread: number | null): number {
  return homeWinProbability({ homeMargin: 0, secondsLeft: REG_SECONDS, possession: null, yardsFromOwnGoal: null, homeSpread });
}

export function gameWinProbability(g: Game): number {
  if (g.status === 'final') {
    const m = (g.home.score ?? 0) - (g.away.score ?? 0);
    return m > 0 ? 1 : m < 0 ? 0 : 0.5;
  }
  if (g.status === 'scheduled' || g.status === 'postponed') return pregameHomeWinProbability(g.odds?.spread ?? null);
  return homeWinProbability({
    homeMargin: (g.home.score ?? 0) - (g.away.score ?? 0),
    secondsLeft: g.status === 'halftime' ? 1800 : secondsRemaining(g.quarter, g.clock),
    possession: g.status === 'halftime' ? null : g.possession,
    yardsFromOwnGoal: g.situation?.yardsFromOwnGoal ?? null,
    homeSpread: g.odds?.spread ?? null
  });
}
