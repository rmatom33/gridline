import type { Game, Scoreboard, Standing } from '../shared/types';
import { data } from '../data/source';
import { cached, useNow, useOnline, usePoll } from '../data/usePoll';
import { href } from '../data/router';
import { team, TEAMS } from '../shared/teams';
import { useState, type ReactNode } from 'react';
import { clockTime, countdownText, etDateKey, tzAbbr, TZ } from '../shared/format';
import { Badge, Card, ErrorCard, Footer, LinkButton, Nav, OfflineBanner, Skeleton, situationText, teamName, TopBar, WatchOn, WinNums, WxIcon, skyOf, venuePlace } from '../ui/parts';
import { GameCard, isLive, liveStatus, plainSituation, weatherLine } from '../ui/GameRow';

export const pollEvery = (sb: Scoreboard | null) => (sb?.games.some(isLive) ? 10_000 : 60_000);

export function pickSpotlight(games: Game[]): Game | undefined {
  return games
    .filter(isLive)
    .sort((a, b) => (b.status === 'live' ? 1 : 0) - (a.status === 'live' ? 1 : 0)
      || (b.quarter ?? 0) - (a.quarter ?? 0)
      || Math.abs((a.home.score ?? 0) - (a.away.score ?? 0)) - Math.abs((b.home.score ?? 0) - (b.away.score ?? 0)))[0];
}



type Filter = 'all' | 'live' | 'later' | 'done';

export function HomePage() {
  const online = useOnline();
  const now = useNow(30_000);
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
  const gameDay = live.length > 0 || games.some((g) => etDateKey(g.kickoff) === today);
  const playing = new Set(games.flatMap((g) => [g.away.abbr, g.home.abbr]));
  const byes = games.length ? Object.keys(TEAMS).filter((t) => !playing.has(t)).map((t) => TEAMS[t].name) : [];
  const show = (f: Filter) => filter === 'all' || filter === f;
  const st2 = st.data ?? undefined;

  return (
    <div className="app home">
      <header className="top">
        <OfflineBanner online={online} stale={q.stale} updatedAt={q.updatedAt} retry={q.refresh} />
        <TopBar />
        <div className="chero">
          {sb && <span className="wk-tag">Week {sb.week}</span>}
        </div>
      </header>
      {sb && (
        <nav className="gtabs" role="tablist" aria-label="Show games">
          {([['all', 'All'], ['live', 'Live'], ['later', 'Later'], ['done', 'Final']] as const).map(([f, label]) => (
            <button key={f} role="tab" aria-selected={filter === f} onClick={() => setFilter(f)}>
              {f === 'live' && live.length > 0 && <span className="rd" aria-hidden="true" />}{label}
            </button>
          ))}
        </nav>
      )}

      {!sb && q.error && <main className="page"><ErrorCard error={q.error} retry={q.refresh} /></main>}
      {!sb && !q.error && <Skeleton />}

      {sb && (
        <main className="page">
          {show('live') && spot && <Spotlight g={spot} hideNumbers={q.stale || !online} />}

          {show('live') && live.length > (spot ? 1 : 0) && (
            <section className="glist" aria-label="Live">
              <div className="sect-h"><h2><span className="lv" aria-hidden="true" />Live</h2></div>
              {live.filter((g) => g !== spot).map((g) => <GameCard key={g.id} g={g} standings={st2} />)}
            </section>
          )}
          {filter === 'live' && !live.length && (
            <EmptyState kind="live" title="No games live right now"
              text={upNext ? `Next kickoff ${shortDayTime(upNext.kickoff)} ${tzAbbr(upNext.kickoff)}, ${countdownText(upNext.kickoff, now)}. Scores show here the moment it starts.` : 'Scores show here the moment a game kicks off.'}
              game={upNext}
              actions={[upcoming.length ? { label: 'See upcoming games', go: () => setFilter('later') } : null, finals.length ? { label: 'See final scores', go: () => setFilter('done') } : null]} />
          )}

          {show('later') && !live.length && upNext && upNext.status === 'scheduled' && <NextMatchup g={upNext} standings={st.data} />}

          {show('later') && upcoming.length > 0 && (
            <section className="glist" aria-label={gameDay ? 'Later' : 'Coming up'}>
              <div className="sect-h"><h2>{gameDay ? 'Later' : 'Coming up'}</h2></div>
              {upcoming.map((g) => <GameCard key={g.id} g={g} standings={st2} />)}
            </section>
          )}
          {filter === 'later' && !upcoming.length && (
            <EmptyState kind="later" title="No more kickoffs this week" text="Next week's games are on the Games tab."
              actions={[{ label: 'See next week', href: href.games }, finals.length ? { label: 'See final scores', go: () => setFilter('done') } : null]} />
          )}

          {show('done') && finals.length > 0 && (
            <section className="glist" aria-label="Final scores">
              <div className="sect-h"><h2>Final scores</h2></div>
              {finals.map((g) => <GameCard key={g.id} g={g} standings={st2} />)}
            </section>
          )}
          {filter === 'done' && !finals.length && (
            <EmptyState kind="done" title="No final scores yet" text="Results appear here as soon as each game ends."
              actions={[upcoming.length ? { label: 'See upcoming games', go: () => setFilter('later') } : null, live.length ? { label: 'See live games', go: () => setFilter('live') } : null]} />
          )}

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

type Act = { label: string; go?: () => void; href?: string } | null;
const shortDayTime = (iso: string) => `${new Date(iso).toLocaleDateString('en-US', { weekday: 'short', timeZone: TZ })} ${clockTime(iso)}`;

/** Friendly card when a filter has nothing to show: icon, what's going on, what's next, and where to go. */
function EmptyState({ kind, title, text, game, actions }: { kind: 'live' | 'later' | 'done'; title: string; text: string; game?: Game; actions: Act[] }) {
  const acts = actions.filter((a): a is NonNullable<Act> => !!a);
  return (
    <section className="card empty-m" aria-live="polite">
      <span className={`em-ic ${kind}`} aria-hidden="true">
        {kind === 'live' ? <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="12" cy="12" r="3" /><path d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4M5 5a10 10 0 0 0 0 14M19 5a10 10 0 0 1 0 14" /></svg>
          : kind === 'later' ? <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>
          : <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z" /><path d="M7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3" /></svg>}
      </span>
      <h3>{title}</h3>
      <p>{text}</p>
      {game && (
        <a className="em-game" href={href.game(game.id)}>
          <Badge abbr={game.away.abbr} size={30} /><b>{teamName(game.away.abbr)}</b><span>at</span><b>{teamName(game.home.abbr)}</b><Badge abbr={game.home.abbr} size={30} />
        </a>
      )}
      {acts.length > 0 && (
        <div className="em-acts">
          {acts.map((a, i) => a.href
            ? <a key={a.label} className={`btn ${i === 0 ? 'primary' : 'tint'}`} href={a.href}>{a.label}</a>
            : <button key={a.label} className={`btn ${i === 0 ? 'primary' : 'tint'}`} onClick={a.go}>{a.label}</button>)}
        </div>
      )}
    </section>
  );
}

function NextMatchup({ g, standings }: { g: Game; standings: Standing[] | null }) {
  const rec = (abbr: string, fb?: string) => {
    const s = standings?.find((x) => x.team === abbr);
    return s ? `${s.w}-${s.l}${s.t ? `-${s.t}` : ''}` : fb ?? '';
  };
  const when = `${new Date(g.kickoff).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: TZ })} · ${clockTime(g.kickoff)}`.toUpperCase();
  const sp = g.odds?.spread;
  const favorite = sp == null ? null : sp === 0 ? 'Even matchup' : `${teamName(sp < 0 ? g.home.abbr : g.away.abbr)} −${Math.abs(sp)}`;
  const place = venuePlace(g.venue);
  const sky = skyOf(g.weather);
  const w = g.weather;
  const cells: [string, ReactNode, ReactNode?][] = [
    ['LOCATION', g.venue?.name ?? place, g.venue?.name ? place : null],
    ['FAVORITE', favorite],
    ['OVER/UNDER', g.odds?.total != null ? `${g.odds.total} Points` : null],
    ['WEATHER', sky && sky !== 'dome' && w?.tempF != null ? <><WxIcon sky={sky} /> {Math.round(w.tempF)}°</> : null,
      sky && sky !== 'dome' ? weatherLine({ ...g, weather: { ...w!, tempF: null } }) : null]
  ];
  return (
    <section className="card nextm" aria-label={`Next matchup: ${teamName(g.away.abbr)} at ${teamName(g.home.abbr)}`}>
      <span className="kk">{when}</span>
      <a className="vs" href={href.game(g.id)}>
        <span><Badge abbr={g.away.abbr} size={48} /><b>{teamName(g.away.abbr)}</b><small>{rec(g.away.abbr, g.away.record)}</small></span>
        <span className="at">AT</span>
        <span><Badge abbr={g.home.abbr} size={48} /><b>{teamName(g.home.abbr)}</b><small>{rec(g.home.abbr, g.home.record)}</small></span>
      </a>
      <div className="nm-grid">{cells.map(([k, v, sub]) => <div key={k}><span>{k}</span><b>{v ?? '–'}</b>{sub && <small>{sub}</small>}</div>)}</div>
      <WatchOn tv={g.tv} big />
      <a className="btn primary" href={href.game(g.id)}>Game preview</a>
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
