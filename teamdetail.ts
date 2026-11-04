// Builds a team page from data every provider already has: standings, the
// season's games and the injury report. No extra API calls needed.
import type { Game, Injury, Standing, TeamDetail, TeamResult } from './types';
import { team } from './teams';

export const winPct = (s: Standing) => (s.w + s.t / 2) / Math.max(1, s.w + s.l + s.t);

export function buildTeamDetail(abbr: string, standings: Standing[], games: Game[], injuries: Injury[], now = Date.now()): TeamDetail {
  const mine = games.filter((g) => g.home.abbr === abbr || g.away.abbr === abbr);
  const results: TeamResult[] = mine
    .filter((g) => g.status === 'final')
    .sort((a, b) => b.kickoff.localeCompare(a.kickoff))
    .slice(0, 5)
    .map((g) => {
      const home = g.home.abbr === abbr;
      return {
        gameId: g.id, week: g.week, home,
        opp: home ? g.away.abbr : g.home.abbr,
        us: (home ? g.home.score : g.away.score) ?? 0,
        them: (home ? g.away.score : g.home.score) ?? 0
      };
    });
  const liveGame = mine.find((g) => g.status === 'live' || g.status === 'halftime');
  const nextGame = mine
    .filter((g) => g.status === 'scheduled' && Date.parse(g.kickoff) > now - 3 * 3_600_000)
    .sort((a, b) => a.kickoff.localeCompare(b.kickoff))[0];

  const standing = standings.find((s) => s.team === abbr);
  const info = team(abbr);
  const division = standings
    .filter((s) => team(s.team).conf === info.conf && team(s.team).div === info.div)
    .sort((a, b) => winPct(b) - winPct(a) || (b.pf - b.pa) - (a.pf - a.pa));
  const divRank = division.findIndex((s) => s.team === abbr) + 1 || undefined;

  let ranks: TeamDetail['ranks'];
  if (standing) {
    const gp = (s: Standing) => Math.max(1, s.w + s.l + s.t);
    const rankBy = (val: (s: Standing) => number, highIsGood: boolean) =>
      standings.slice().sort((a, b) => (highIsGood ? val(b) - val(a) : val(a) - val(b))).findIndex((s) => s.team === abbr) + 1;
    ranks = {
      pointsFor: rankBy((s) => s.pf / gp(s), true),
      pointsAgainst: rankBy((s) => s.pa / gp(s), false),
      diff: rankBy((s) => s.pf - s.pa, true)
    };
  }

  return {
    team: abbr, standing, divRank, liveGame, nextGame, results,
    injuries: injuries.filter((i) => i.team === abbr),
    ranks
  };
}

export function ordinalRank(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
