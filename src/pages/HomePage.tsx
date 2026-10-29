import type { Game, Scoreboard, Standing } from '../shared/types';
import { data } from '../data/source';
import { cached, useNow, useOnline, usePoll } from '../data/usePoll';
import { href } from '../data/router';
import { team, TEAMS } from '../shared/teams';
import { useState } from 'react';
import { clockTime, countdownText, etDateKey, spreadLabel } from '../shared/format';
import { Badge, Card, Countdown3, ErrorCard, Footer, LinkButton, Nav, OfflineBanner, Skeleton, situationText, teamName, TopBar, WatchOn, WinNums } from '../ui/parts';
import { GameCard, isLive, liveStatus, plainSituation, weatherLine } from '../ui/GameRow';

export const pollEvery = (sb: Scoreboard | null) => (sb?.games.some(isLive) ? 10_000 : 60_000);

export function pickSpotlight(games: Game[]): Game | undefined {
  return games
    .filter(isLive)
    .sort((a, b) => (b.status === 'live' ? 1 : 0) - (a.status === 'live' ? 1 : 0)
      || (b.quarter ?? 0) - (a.quarter ?? 0)
      || Math.abs((a.home.score ?? 0) - (a.away.score ?? 0)) - Math.abs((b.home.score ?? 0) - (b.away.score ?? 0)))[0];
}

const longDay = (ms: number) => new Date(ms).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'America/New_York' });


type Filter = 'all' | 'live' | 'later' | 'done';

export function HomePage() {
  const online = useOnline();
  const now = useNow(1_000);
  const [filter, setFilter] = useState<Filter>('all');
  const q = usePoll(() => data.scoreboard(), pollEvery, []);
  const st = usePoll(() => cached('standings', () => data.standings()), 0, []);
  const sb = q.data;
  const games = sb?.games ?? [];
  const live = games.filter(isLive);
  const spot = pickSpotlight(games);
  const upcoming = games.filter((g) => g.status === 'scheduled' || g.status === 'postponed').sort((a, b) => a.kickoff.localeCompare(b.kickoff));
  const upNext = upcoming[0];
  const finals = games.filter((g) => g.status === 'final').sort((a, b) => b.kickoff.localeCompare(a.kickoff));
  const today = etDateKey(now);
  const laterToday = upcoming.filter((g) => etDateKey(g.kickoff) === today).length;
  const gameDay = live.length > 0 || games.some((g) => etDateKey(g.kickoff) === today);
  const summary = !sb ? 'Getting this week’s games…'
    : live.length ? `${live.length} ${live.length === 1 ? 'game' : 'games'} on now${laterToday ? `, ${laterToday} more later today` : upcoming.length ? `, ${upcoming.length} more this week` : ''}.`
    : gameDay ? (upcoming.length ? `Next kickoff ${countdownText(upcoming[0].kickoff, now)}.` : 'Today’s games are finished.')
    : 'Catch up on the latest results, or see who plays next.';
  const playing = new Set(games.flatMap((g) => [g.away.abbr, g.home.abbr]));
  const byes = games.length ? Object.keys(TEAMS).filter((t) => !playing.has(t)).map((t) => TEAMS[t].name) : [];
  const show = (f: Filter) => filter === 'all' || filter === f;
  const st2 = st.data ?? undefined;

  return (
    <div className="app home">
      <header className="top">
        <OfflineBanner online={online} stale={q.stale} updatedAt={q.updatedAt} retry={q.refresh} />
        <TopBar />
        <div className="mhero">
          <span className="kick">{sb && <span className="wk-tag">Week {sb.week}</span>}<span>{longDay(now)}</span></span>
          <h1>{!sb ? 'Gridline' : gameDay ? 'Game day' : 'No games today'}</h1>
          <p>{summary}</p>
        </div>
        {sb && (
          <>
            <div className="mtiles" role="group" aria-label="Jump to">
              <button aria-pressed={filter === 'live'} onClick={() => setFilter(filter === 'live' ? 'all' : 'live')}><b className={live.length ? 'red' : ''}>{live.length}</b><span>Live now</span></button>
              <button aria-pressed={filter === 'later'} onClick={() => setFilter(filter === 'later' ? 'all' : 'later')}><b>{upcoming.length}</b><span>Kickoff later</span></button>
              <button aria-pressed={filter === 'done'} onClick={() => setFilter(filter === 'done' ? 'all' : 'done')}><b>{finals.length}</b><span>Final scores</span></button>
            </div>
            <div className="mpills" role="group" aria-label="Show">
              <button aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>All <i>{games.length}</i></button>
              <button aria-pressed={filter === 'live'} onClick={() => setFilter('live')}><span className="rd" />Live <i>{live.length}</i></button>
              <button aria-pressed={filter === 'later'} onClick={() => setFilter('later')}>Later <i>{upcoming.length}</i></button>
              <button aria-pressed={filter === 'done'} onClick={() => setFilter('done')}>Done <i>{finals.length}</i></button>
            </div>
          </>
        )}
      </header>

      {!sb && q.error && <main className="page"><ErrorCard error={q.error} retry={q.refresh} /></main>}
      {!sb && !q.error && <Skeleton />}

      {sb && (
        <main className="page">
          {show('live') && spot && <Spotlight g={spot} hideNumbers={q.stale || !online} />}

          {show('live') && live.length > (spot ? 1 : 0) && (
            <section className="glist" aria-label="Live now">
              <div className="sect-h"><h2><span className="lv" aria-hidden="true" />Live now</h2><span className="cnt">{live.length - (spot ? 1 : 0)}</span></div>
              {live.filter((g) => g !== spot).map((g) => <GameCard key={g.id} g={g} standings={st2} />)}
            </section>
          )}
          {filter === 'live' && !live.length && <p className="byes">No games are live right now.</p>}

          {show('later') && !live.length && upNext && upNext.status === 'scheduled' && <NextMatchup g={upNext} now={now} standings={st.data} />}

          {show('later') && upcoming.length > 0 && (
            <section className="glist" aria-label={gameDay ? 'Later' : 'Coming up'}>
              <div className="sect-h"><h2>{gameDay ? 'Later' : 'Coming up'}</h2><span className="cnt">{upcoming.length}</span></div>
              {upcoming.map((g) => <GameCard key={g.id} g={g} standings={st2} />)}
            </section>
          )}
          {filter === 'later' && !upcoming.length && <p className="byes">No more kickoffs this week.</p>}

          {show('done') && finals.length > 0 && (
            <section className="glist" aria-label="Final scores">
              <div className="sect-h"><h2>Final scores</h2><span className="cnt">{finals.length}</span></div>
              {finals.map((g) => <GameCard key={g.id} g={g} standings={st2} />)}
            </section>
          )}
          {filter === 'done' && !finals.length && <p className="byes">No games have finished yet this week.</p>}

          {!games.length && (
            <Card title="This week">
              <p className="empty">No games found for this week yet.</p>
              <LinkButton to={href.games}>See the schedule</LinkButton>
            </Card>
          )}

          {byes.length > 0 && <p className="byes">On bye this week: {byes.join(', ')}</p>}
          {q.updatedAt && <p className="updated">Updated {new Date(q.updatedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' })}</p>}
          <Footer />
        </main>
      )}
      <Nav active="home" />
    </div>
  );
}

function NextMatchup({ g, now, standings }: { g: Game; now: number; standings: Standing[] | null }) {
  const rec = (abbr: string, fb?: string) => {
    const s = standings?.find((x) => x.team === abbr);
    return s ? `${s.w}-${s.l}${s.t ? `-${s.t}` : ''}` : fb ?? '';
  };
  const day = new Date(g.kickoff).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'America/New_York' });
  const meta = [`${day}, ${clockTime(g.kickoff)}`, spreadLabel(g) ? `Favorite ${spreadLabel(g)}` : null, g.odds?.total != null ? `O/U ${g.odds.total}` : null, weatherLine(g)].filter(Boolean).join(' · ');
  return (
    <section className="card nextm" aria-label={`Next matchup: ${teamName(g.away.abbr)} at ${teamName(g.home.abbr)}`}>
      <span className="kk">NEXT MATCHUP</span>
      <a className="vs" href={href.game(g.id)}>
        <span><Badge abbr={g.away.abbr} size={48} /><b>{teamName(g.away.abbr)}</b><small>{rec(g.away.abbr, g.away.record)}</small></span>
        <span className="at">AT</span>
        <span><Badge abbr={g.home.abbr} size={48} /><b>{teamName(g.home.abbr)}</b><small>{rec(g.home.abbr, g.home.record)}</small></span>
      </a>
      <span className="meta">{meta}</span>
      <WatchOn tv={g.tv} big />
      <Countdown3 iso={g.kickoff} now={now} />
      <a className="btn primary" href={href.game(g.id)}>Preview the game</a>
    </section>
  );
}

export function FinalRow({ g }: { g: Game }) {
  const as = g.away.score ?? 0, hs = g.home.score ?? 0;
  const [w, l, ws, ls] = as >= hs ? [g.away.abbr, g.home.abbr, as, hs] : [g.home.abbr, g.away.abbr, hs, as];
  return (
    <a className="row" href={href.game(g.id)} style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}
      aria-label={`${teamName(w, true)} ${ws}, ${teamName(l, true)} ${ls}, ${liveStatus(g).toLowerCase()}`}>
      <span style={{ fontSize: 19 }}><b>{teamName(w)} {ws}</b>, {teamName(l)} {ls}</span>
      <span className="sub">{g.overtime ? 'Final, after overtime' : 'Final'}</span>
    </a>
  );
}

function Spotlight({ g, hideNumbers }: { g: Game; hideNumbers: boolean }) {
  const as = g.away.score ?? 0, hs = g.home.score ?? 0;
  const hp = g.homeWinProb ?? 0.5;
  const sentence = plainSituation(g);
  const sit = situationText(g);
  const q = g.quarter && g.quarter >= 5 ? 'OT' : ['1st', '2nd', '3rd', '4th'][(g.quarter ?? 1) - 1];
  const side = (s: 'away' | 'home') => {
    const t = team(g[s].abbr);
    const mine = s === 'away' ? as : hs, theirs = s === 'away' ? hs : as;
    return (
      <a className={`spot-team${mine < theirs ? ' dim' : ''}`} href={href.team(t.abbr)} key={s}>
        <Badge abbr={t.abbr} size={44} />
        <span className="tx">
          <small>{t.city}</small><b>{t.name}</b>
          {g.status === 'live' && g.possession === s ? <em><i />Has the ball</em> : s === 'home' ? <em>Home team</em> : null}
        </span>
        <span className="sc">{g[s].score ?? 0}</span>
      </a>
    );
  };
  return (
    <section className="spot" aria-label={`${teamName(g.away.abbr)} at ${teamName(g.home.abbr)}, live`}>
      <div className="spot-top">
        <span className="lv-pill">{g.status === 'halftime' ? 'HALF' : 'LIVE'}</span>
        {g.status === 'live' ? (
          <>
            <span className="k"><small>QUARTER</small><b>{q}</b></span>
            <span className="k"><small>TIME LEFT</small><b>{g.clock ?? '–'}</b></span>
          </>
        ) : <span className="k"><small>STATUS</small><b>Halftime</b></span>}
      </div>
      <div className="spot-teams">{side('away')}{side('home')}</div>
      <WatchOn tv={g.tv} dark />
      <div className="spot-body">
        {sit && <span className="dd">{sit}</span>}
        {sentence && <p>{sentence}</p>}
        {!hideNumbers && <WinNums g={g} homeProb={hp} />}
        <a className="btn primary" href={href.game(g.id)}>Open game center</a>
      </div>
    </section>
  );
}
