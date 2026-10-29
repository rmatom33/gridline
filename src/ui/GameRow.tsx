import type { Game, Standing } from '../shared/types';
import { href } from '../data/router';
import { clockTime, countdownText, periodLabel, shortDay, spreadLabel, weatherShort } from '../shared/format';
import { team } from '../shared/teams';
import { useNow } from '../data/usePoll';
import { Badge, situationText, teamName, WatchOn } from './parts';

/** "Dolphins favored by 3.5" in plain words. */
export function favoredText(g: Game): string | null {
  const s = g.odds?.spread;
  if (s == null) return null;
  if (s === 0) return 'Even matchup';
  const fav = s < 0 ? g.home.abbr : g.away.abbr;
  return `${teamName(fav)} favored by ${Math.abs(s)}`;
}

export const isLive = (g: Game) => g.status === 'live' || g.status === 'halftime';

const QUARTER = ['1st quarter', '2nd quarter', '3rd quarter', '4th quarter'];

/** Plain-language game status, e.g. "4th quarter · 2:14 left". */
export function liveStatus(g: Game): string {
  if (g.status === 'halftime') return 'Halftime';
  if (g.status === 'live') {
    const q = g.quarter && g.quarter >= 5 ? 'Overtime' : QUARTER[(g.quarter ?? 1) - 1] ?? periodLabel(g.quarter);
    return g.clock ? `${q} · ${g.clock} left` : q;
  }
  if (g.status === 'final') return g.overtime ? 'Final, overtime' : 'Final';
  if (g.status === 'postponed') return 'Postponed';
  return clockTime(g.kickoff);
}

/** Compact status for list rows, e.g. "4th · 2:14". */
export function shortStatus(g: Game): string {
  if (g.status === 'live') {
    const q = g.quarter && g.quarter >= 5 ? 'OT' : ['1st', '2nd', '3rd', '4th'][(g.quarter ?? 1) - 1];
    return g.clock ? `${q} · ${g.clock}` : q ?? '';
  }
  return liveStatus(g);
}

/** One sentence on what's happening, e.g. "The Bills have the ball on the Chiefs' 34. First down, 10 yards to go." */
export function plainSituation(g: Game): string | null {
  if (g.status === 'halftime') return 'It\u2019s halftime. The second half starts soon.';
  const s = g.situation;
  if (g.status !== 'live' || !s || !g.possession) return g.lastPlay ? `Last play: ${g.lastPlay}` : null;
  const off = teamName(g[g.possession].abbr);
  const other = g.possession === 'home' ? g.away.abbr : g.home.abbr;
  let where = '';
  if (s.yardsFromOwnGoal != null) {
    const y = s.yardsFromOwnGoal;
    where = y === 50 ? ' at midfield' : y > 50 ? ` on the ${teamName(other)}\u2019 ${100 - y}-yard line` : ` on their own ${y}-yard line`;
  }
  const downs = ['First', 'Second', 'Third', 'Fourth'];
  const goal = s.yardsFromOwnGoal != null && s.distance != null && s.yardsFromOwnGoal + s.distance >= 100;
  const down = s.down ? ` ${downs[s.down - 1] ?? ''} down, ${goal ? 'goal to go' : `${s.distance ?? ''} ${s.distance === 1 ? 'yard' : 'yards'} to go`}.` : '';
  return `The ${off} have the ball${where}.${down}`;
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
    ? g.possession ? `${teamName(g[g.possession].abbr)} ball` : ''
    : done ? '' : [showDay ? shortDay(g.kickoff) : null, favoredText(g)].filter(Boolean).join(' · ');

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
        <b className={live ? 'live-text' : done ? 'muted' : ''}>{live ? '● ' : ''}{shortStatus(g)}</b>
        {mode === 'schedule' && !done && !live && <span>{weatherShort(g) ?? ''}</span>}
        {sub && <span>{sub}</span>}
      </div>
    </a>
  );
}

/** One game as its own card, in the live-site style: status line, both teams, "Watch on" network row, then odds/weather or the live situation. */
export function GameCard({ g, standings, showDay = true }: { g: Game; standings?: Standing[]; showDay?: boolean }) {
  const now = useNow(30_000);
  const live = isLive(g);
  const done = g.status === 'final';
  const as = g.away.score ?? 0, hs = g.home.score ?? 0;
  const showScore = live || done;
  const rec = (abbr: string, fallback?: string) => {
    const s = standings?.find((x) => x.team === abbr);
    return s ? `${s.w}-${s.l}${s.t ? `-${s.t}` : ''}` : fallback ?? '';
  };
  const label = `${teamName(g.away.abbr, true)}${showScore ? ` ${as}` : ''} at ${teamName(g.home.abbr, true)}${showScore ? ` ${hs}` : ''}, ${live ? 'live, ' : ''}${liveStatus(g)}`;
  const q = g.quarter && g.quarter >= 5 ? 'OT' : ['1ST', '2ND', '3RD', '4TH'][(g.quarter ?? 1) - 1];
  const hp = g.homeWinProb;
  const winText = hp != null ? (hp >= 0.5 ? `${g.home.abbr} ${Math.round(hp * 100)}% to win` : `${g.away.abbr} ${Math.round((1 - hp) * 100)}% to win`) : null;
  const sit = g.status === 'live' ? situationText(g) : null;
  const odds = [spreadLabel(g), g.odds?.total != null ? `O/U ${g.odds.total}` : null].filter(Boolean).join(' · ');
  const wx = weatherLine(g);
  return (
    <a className={`mcard${live ? ' is-live' : ''}`} href={href.game(g.id)} aria-label={label}>
      <div className="mc-head">
        {live ? (
          <span className="when red"><span className="lv-pill">{g.status === 'halftime' ? 'HALF' : 'LIVE'}</span>{g.status === 'halftime' ? 'HALFTIME' : `${q}${g.clock ? ` · ${g.clock} LEFT` : ''}`}</span>
        ) : done ? (
          <span className="when">{g.overtime ? 'Final · OT' : 'Final'}</span>
        ) : g.status === 'postponed' ? (
          <span className="when">Postponed</span>
        ) : (
          <span className="when">{showDay ? `${shortDay(g.kickoff).split(',')[0]} ` : ''}{clockTime(g.kickoff)}<em>{countdownText(g.kickoff, now)}</em></span>
        )}
      </div>
      <div className="mc-teams">
        {(['away', 'home'] as const).map((side) => {
          const t = g[side];
          const mine = side === 'away' ? as : hs, theirs = side === 'away' ? hs : as;
          const dim = done && mine < theirs;
          const city = team(t.abbr).city;
          return (
            <span className={`mc-row${dim ? ' dim' : ''}`} key={side}>
              <Badge abbr={t.abbr} size={28} />
              <span className="nm"><b>{city}</b> {team(t.abbr).name}</span>
              {live && g.possession === side && <span className="ball" title="Has the ball" />}
              <span className="rc">{rec(t.abbr, t.record)}</span>
              {showScore && <span className="sc">{t.score ?? 0}</span>}
            </span>
          );
        })}
      </div>
      <WatchOn tv={g.tv} label={done ? 'Aired on' : 'Watch on'} />
      {live ? (
        <div className="mc-foot live">
          <span className="sit">{g.status === 'halftime' ? <span style={{ color: 'var(--text)' }}>Halftime</span> : sit ?? 'In progress'}{g.situation?.redZone && <span className="rz">RED ZONE</span>}</span>
          {winText && <b>{winText}</b>}
        </div>
      ) : !done && (odds || wx) ? (
        <div className="mc-foot"><span>{odds}</span><span>{wx}</span></div>
      ) : null}
    </a>
  );
}

/** "48° · 22 mph N", "Indoors". */
export function weatherLine(g: Game): string | null {
  const w = g.weather;
  if (!w) return null;
  if (w.dome) return 'Indoors';
  return [w.tempF != null ? `${Math.round(w.tempF)}°` : null, w.windMph != null ? `${Math.round(w.windMph)} mph${w.windDir ? ` ${w.windDir}` : ''}` : null, w.precipPct ? `${w.precipPct}% rain` : null].filter(Boolean).join(' · ') || null;
}
