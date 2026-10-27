import type { Game, Standing } from '../shared/types';
import { href } from '../data/router';
import { clockTime, periodLabel, shortDay, spreadLabel, weatherShort } from '../shared/format';
import { Badge, teamName } from './parts';

export const isLive = (g: Game) => g.status === 'live' || g.status === 'halftime';

export function liveStatus(g: Game): string {
  if (g.status === 'halftime') return 'HALF';
  if (g.status === 'live') return `${periodLabel(g.quarter)} ${g.clock ?? ''}`.trim();
  if (g.status === 'final') return g.overtime ? 'FINAL/OT' : 'FINAL';
  if (g.status === 'postponed') return 'POSTPONED';
  return clockTime(g.kickoff);
}

export function GameRow({ g, mode = 'score', standings, showDay }: { g: Game; mode?: 'score' | 'schedule'; standings?: Standing[]; showDay?: boolean }) {
  const live = isLive(g);
  const done = g.status === 'final';
  const as = g.away.score ?? 0, hs = g.home.score ?? 0;
  const showScore = (live || done) && mode === 'score';
  const rec = (abbr: string, fallback?: string) => {
    const s = standings?.find((x) => x.team === abbr);
    return s ? `${s.w}-${s.l}${s.t ? `-${s.t}` : ''}` : fallback ?? '';
  };
  const label = `${teamName(g.away.abbr, true)}${showScore ? ` ${as}` : ''} at ${teamName(g.home.abbr, true)}${showScore ? ` ${hs}` : ''}, ${live ? 'live, ' : ''}${liveStatus(g)}`;
  const sub = live
    ? g.possession ? `${g[g.possession].abbr} ball` : ''
    : done ? '' : [showDay ? shortDay(g.kickoff) : null, spreadLabel(g)].filter(Boolean).join(' · ');

  return (
    <a className="game-row" href={href.game(g.id)} aria-label={label}>
      <div className="teams">
        {(['away', 'home'] as const).map((side) => {
          const t = g[side];
          const trail = showScore && done && ((side === 'away' && as < hs) || (side === 'home' && hs < as));
          return (
            <span className="team-line" key={side}>
              <Badge abbr={t.abbr} size={26} />
              <span className={`name ${trail ? 'trail-name' : ''}`}>
                {teamName(t.abbr)}
                {live && g.possession === side && <span className="poss" aria-hidden="true" />}
              </span>
              {showScore
                ? <span className={`score ${trail ? 'trail' : ''}`}>{t.score ?? 0}</span>
                : <span className="rec">{rec(t.abbr, t.record)}</span>}
            </span>
          );
        })}
      </div>
      <div className="status">
        <b className={live ? 'live-text' : done ? 'muted' : ''}>{live ? '● ' : ''}{liveStatus(g)}</b>
        {mode === 'schedule' && !done && !live && <span>{weatherShort(g) ?? ''}</span>}
        {sub && <span>{sub}</span>}
      </div>
    </a>
  );
}
