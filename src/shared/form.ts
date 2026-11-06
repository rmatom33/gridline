import type { Game, TeamForm } from './types';

/** Last result and current streak for a team, from finished games before `beforeIso`. */
export function teamForm(abbr: string, games: Game[], beforeIso: string): TeamForm | undefined {
  const past = games
    .filter((g) => g.status === 'final' && g.kickoff < beforeIso && (g.away.abbr === abbr || g.home.abbr === abbr))
    .sort((a, b) => b.kickoff.localeCompare(a.kickoff));
  if (!past.length) return undefined;
  const res = (g: Game) => {
    const atHome = g.home.abbr === abbr;
    const us = Number((atHome ? g.home : g.away).score ?? 0), them = Number((atHome ? g.away : g.home).score ?? 0);
    return { opp: atHome ? g.away.abbr : g.home.abbr, us, them, atHome, week: g.week, kind: (us > them ? 'W' : us < them ? 'L' : 'T') as 'W' | 'L' | 'T' };
  };
  const first = res(past[0]);
  let n = 0;
  for (const g of past) { if (res(g).kind !== first.kind) break; n++; }
  const { kind, ...last } = first;
  return { last, streak: { kind, n } };
}

export function gameForm(g: Game, season: Game[]) {
  return { away: teamForm(g.away.abbr, season, g.kickoff), home: teamForm(g.home.abbr, season, g.kickoff) };
}
