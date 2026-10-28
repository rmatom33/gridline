import type { Game, Scoreboard, Standing } from '../shared/types';
import { data } from '../data/source';
import { cached, useNow, useOnline, usePoll } from '../data/usePoll';
import { href } from '../data/router';
import { team, TEAMS } from '../shared/teams';
import { clockTime, countdownText, streakText, weatherShort } from '../shared/format';
import { Badge, Card, ErrorCard, FieldBar, Footer, FormDots, Icon, LinkButton, Nav, OfflineBanner, SampleBadge, Skeleton, teamName, TeamLine, WeekChip } from '../ui/parts';
import { favoredText, GameCard, isLive, liveStatus, plainSituation } from '../ui/GameRow';
import { winPct } from '../shared/teamdetail';

export const pollEvery = (sb: Scoreboard | null) => (sb?.games.some(isLive) ? 10_000 : 60_000);

export function pickSpotlight(games: Game[]): Game | undefined {
  return games
    .filter(isLive)
    .sort((a, b) => (b.status === 'live' ? 1 : 0) - (a.status === 'live' ? 1 : 0)
      || (b.quarter ?? 0) - (a.quarter ?? 0)
      || Math.abs((a.home.score ?? 0) - (a.away.score ?? 0)) - Math.abs((b.home.score ?? 0) - (b.away.score ?? 0)))[0];
}

const longDay = (ms: number) => new Date(ms).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'America/New_York' });

const MEDAL = {
  live: <svg aria-hidden="true" width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="12" rx="9.6" ry="5.6" transform="rotate(-35 12 12)" /><path d="M9.3 14.7l5.4-5.4M10.2 11.4l2.4 2.4M11.8 9.8l2.4 2.4M8.6 13l2.4 2.4" /></svg>,
  later: <svg aria-hidden="true" width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="9" rx="4.2" ry="6.4" /><path d="M12 4.8v8.4M10.5 7.2h3M10.5 9.4h3M10.5 11.6h3" /><path d="M9.4 15.6h5.2l1.8 5.4H7.6z" /></svg>,
  done: <svg aria-hidden="true" width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21v-8.5M6 12.5h12M6 12.5V3M18 12.5V3" /><path d="M9 21h6" /></svg>
};

export function HomePage() {
  const online = useOnline();
  const now = useNow();
  const q = usePoll(() => data.scoreboard(), pollEvery, []);
  const st = usePoll(() => cached('standings', () => data.standings()), 0, []);
  const sb = q.data;
  const games = sb?.games ?? [];
  const live = games.filter(isLive);
  const spot = pickSpotlight(games);
  const upcoming = games.filter((g) => g.status === 'scheduled').sort((a, b) => a.kickoff.localeCompare(b.kickoff));
  const upNext = upcoming[0];
  const finals = games.filter((g) => g.status === 'final').sort((a, b) => b.kickoff.localeCompare(a.kickoff));
  const summary = !sb ? 'Getting today’s games…'
    : live.length ? `${live.length} ${live.length === 1 ? 'game' : 'games'} on now${upcoming.length ? `, ${upcoming.length} more to come` : ''}`
    : upcoming.length ? `Next kickoff ${countdownText(upcoming[0].kickoff, now)}` : 'All of this week’s games are finished';

  return (
    <div className="app home">
      <header className="top">
        <OfflineBanner online={online} stale={q.stale} updatedAt={q.updatedAt} retry={q.refresh} />
        <div className="top-row">
          <div className="brand"><b>Gridline</b></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <SampleBadge />
            <a className="icon-btn" href={href.search} aria-label="Search for a team or game"><Icon name="search" size={24} /></a>
          </div>
        </div>
        <div className="hero">
          <WeekChip left={sb ? `WEEK ${sb.week}` : 'TODAY'} right={longDay(now)} size="lg" />
          <h1>{live.length ? 'Game day' : 'This week'}</h1>
          <span className="sub">{summary}</span>
        </div>
        <a className="search-pill" href={href.search}>Find a team or game <Icon name="search" size={24} /></a>
      </header>

      {sb && (
        <nav className="medals" aria-label="Show games">
          <a href={href.games} className={live.length ? 'on' : ''} aria-label={`Live now: ${live.length} games`}><span className="disc">{MEDAL.live}<span className="count">{live.length}</span></span><b>Live now</b></a>
          <a href={href.games} aria-label={`Kickoff later: ${upcoming.length} games`}><span className="disc">{MEDAL.later}<span className="count">{upcoming.length}</span></span><b>Kickoff later</b></a>
          <a href={href.games} aria-label={`Final scores: ${finals.length} games`}><span className="disc">{MEDAL.done}<span className="count">{finals.length}</span></span><b>Final scores</b></a>
        </nav>
      )}

      {!sb && q.error && <main className="page"><ErrorCard error={q.error} retry={q.refresh} /></main>}
      {!sb && !q.error && <Skeleton />}

      {sb && (
        <main className="page">
          {spot && <Spotlight g={spot} hideNumbers={q.stale || !online} />}

          {live.length > (spot ? 1 : 0) && (
            <section className="glist" aria-label={spot ? 'Also live' : 'Live now'}>
              <div className="glist-title"><h2 className="sec-title">{spot ? 'Also live' : 'Live now'}</h2><a className="link" href={href.games}>All games</a></div>
              {live.filter((g) => g !== spot).map((g) => <GameCard key={g.id} g={g} />)}
            </section>
          )}

          {upNext && (
            <section className="card pad" aria-label={`Coming up: ${teamName(upNext.away.abbr)} at ${teamName(upNext.home.abbr)}`}>
              <span className="card-title">Coming up</span>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontSize: 26, fontWeight: 800 }}>{clockTime(upNext.kickoff)}</span>
                <span className="sub" style={{ fontSize: 16 }}>Starts {countdownText(upNext.kickoff, now)}</span>
              </div>
              <a href={href.game(upNext.id)} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto minmax(0,1fr)', alignItems: 'center', gap: 10, textAlign: 'center', color: 'var(--text)' }}>
                <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}><Badge abbr={upNext.away.abbr} size={56} /><b style={{ fontSize: 19 }}>{teamName(upNext.away.abbr)}</b>{recordWords(st.data, upNext.away.abbr)}</span>
                <span style={{ fontFamily: 'var(--display)', fontStyle: 'italic', fontWeight: 800, fontSize: 20, color: 'var(--muted)' }}>at</span>
                <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}><Badge abbr={upNext.home.abbr} size={56} /><b style={{ fontSize: 19 }}>{teamName(upNext.home.abbr)}</b>{recordWords(st.data, upNext.home.abbr)}</span>
              </a>
              <div className="chips">
                {favoredText(upNext) && <span className="chip">{favoredText(upNext)}</span>}
                {weatherShort(upNext) && <span className="chip">{weatherShort(upNext)}</span>}
              </div>
              <LinkButton to={href.game(upNext.id)} kind="primary">Lineups and preview</LinkButton>
            </section>
          )}

          {finals.length > 0 && (
            <section className="glist" aria-label="Final scores">
              <h2 className="sec-title">Final scores</h2>
              {finals.map((g) => <GameCard key={g.id} g={g} />)}
            </section>
          )}

          {!games.length && (
            <Card title="This week">
              <p className="empty">No games found for this week yet.</p>
              <LinkButton to={href.schedule}>See next week</LinkButton>
            </Card>
          )}

          {st.data && <Leaders standings={st.data} />}
          <Footer />
        </main>
      )}
      <Nav active="home" />
    </div>
  );
}

function recordWords(standings: Standing[] | null, abbr: string) {
  const s = standings?.find((x) => x.team === abbr);
  if (!s) return null;
  return <span className="sub" style={{ whiteSpace: 'nowrap' }}>Record {s.w}–{s.l}{s.t ? `–${s.t}` : ''}</span>;
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
  const ap = 1 - hp;
  const sentence = plainSituation(g);
  return (
    <section className="card pad" aria-label={`${teamName(g.away.abbr)} at ${teamName(g.home.abbr)}, live`}>
      {g.status === 'live' ? (
        <div className="sbcall" aria-label={liveStatus(g)}>
          <span><span className="k">QUARTER</span><span className="q">{g.quarter && g.quarter >= 5 ? 'OT' : ['1st', '2nd', '3rd', '4th'][(g.quarter ?? 1) - 1]}</span></span>
          <span><span className="k">TIME LEFT</span><span className="t">{g.clock ?? '–'}</span></span>
          <span className="lv"><span className="dot" style={{ background: '#FFFFFF' }} />LIVE</span>
        </div>
      ) : (
        <div className="sbline"><span className="lvp"><span className="dot" style={{ background: '#FFFFFF' }} />LIVE</span><span className="qq">HALFTIME</span></div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <TeamLine abbr={g.away.abbr} score={as} trail={as < hs} poss={g.possession === 'away'} size={52} nameSize={21} scoreSize={44} full={false} />
        <TeamLine abbr={g.home.abbr} score={hs} trail={hs < as} poss={g.possession === 'home'} size={52} nameSize={21} scoreSize={44} full={false} />
      </div>
      {sentence && <p className="plain">{sentence}</p>}
      {g.status === 'live' && <FieldBar g={g} />}
      {!hideNumbers && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, gap: 8 }}>
            <b>Chance to win</b>
            <span>{hp >= 0.5
              ? <><b>{teamName(g.home.abbr)} {Math.round(hp * 100)}%</b> · {teamName(g.away.abbr)} {Math.round(ap * 100)}%</>
              : <><b>{teamName(g.away.abbr)} {Math.round(ap * 100)}%</b> · {teamName(g.home.abbr)} {Math.round(hp * 100)}%</>}</span>
          </div>
          <div className="wpbar" aria-hidden="true">
            <div style={{ width: `${ap * 100}%`, background: team(g.away.abbr).color }} />
            <div style={{ flex: 1, background: team(g.home.abbr).color }} />
          </div>
        </div>
      )}
      <a className="btn primary" href={href.game(g.id)}>Follow this game <Icon name="next" size={20} stroke={2.6} /></a>
    </section>
  );
}

function Leaders({ standings }: { standings: Standing[] }) {
  const rows = (['AFC', 'NFC'] as const).flatMap((conf) =>
    (['East', 'North', 'South', 'West'] as const).map((div) => {
      const inDiv = standings.filter((s) => TEAMS[s.team]?.conf === conf && TEAMS[s.team]?.div === div);
      const top = inDiv.sort((a, b) => winPct(b) - winPct(a) || (b.pf - b.pa) - (a.pf - a.pa))[0];
      return top ? { conf, div, s: top } : null;
    })
  ).filter((x): x is NonNullable<typeof x> => !!x);
  if (!rows.length) return null;
  return (
    <Card title="Top of each division" right={<a href={href.standings()}>Standings</a>}>
      {rows.map(({ conf, div, s }) => (
        <a className="row" key={`${conf}-${div}`} href={href.team(s.team)} aria-label={`${conf} ${div} leader: ${teamName(s.team, true)}, ${s.w} wins and ${s.l} losses`}>
          <Badge abbr={s.team} size={38} />
          <span style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 18, fontWeight: 700 }}>{team(s.team).name}</span>
            <span className="sub">{conf} {div} · {s.w}–{s.l}{s.t ? `–${s.t}` : ''} · {streakText(s.streak)}</span>
          </span>
          <FormDots s={s} />
        </a>
      ))}
    </Card>
  );
}

