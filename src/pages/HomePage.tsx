import type { Game, Scoreboard, Standing } from '../shared/types';
import { data } from '../data/source';
import { cached, useNow, useOnline, usePoll } from '../data/usePoll';
import { href } from '../data/router';
import { team, TEAMS } from '../shared/teams';
import { clockTime, countdownText, kickerDay, moneyline, spreadLabel, streakText, weatherShort } from '../shared/format';
import { Badge, Card, ErrorCard, FieldBar, Footer, FormDots, Icon, LinkButton, Nav, OfflineBanner, SampleBadge, situationText, Skeleton, teamName, TeamLine } from '../ui/parts';
import { GameRow, isLive, liveStatus } from '../ui/GameRow';
import { winPct } from '../shared/teamdetail';

export const pollEvery = (sb: Scoreboard | null) => (sb?.games.some(isLive) ? 10_000 : 60_000);

export function pickSpotlight(games: Game[]): Game | undefined {
  return games
    .filter(isLive)
    .sort((a, b) => (b.status === 'live' ? 1 : 0) - (a.status === 'live' ? 1 : 0)
      || (b.quarter ?? 0) - (a.quarter ?? 0)
      || Math.abs((a.home.score ?? 0) - (a.away.score ?? 0)) - Math.abs((b.home.score ?? 0) - (b.away.score ?? 0)))[0];
}

export function HomePage() {
  const online = useOnline();
  const now = useNow();
  const q = usePoll(() => data.scoreboard(), pollEvery, []);
  const st = usePoll(() => cached('standings', () => data.standings()), 0, []);
  const sb = q.data;
  const games = sb?.games ?? [];
  const live = games.filter(isLive);
  const spot = pickSpotlight(games);
  const upNext = games.filter((g) => g.status === 'scheduled').sort((a, b) => a.kickoff.localeCompare(b.kickoff))[0];
  const finals = games.filter((g) => g.status === 'final').sort((a, b) => b.kickoff.localeCompare(a.kickoff));

  return (
    <div className="app">
      <header className="top">
        <OfflineBanner online={online} stale={q.stale} updatedAt={q.updatedAt} retry={q.refresh} />
        <div className="top-row">
          <div className="brand">
            <b>Gridline</b>
            <span className="kicker">{sb ? `WK ${sb.week} · ${kickerDay(now)}` : 'NFL LIVE'}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <SampleBadge />
            {live.length > 0 && <span className="live-pill"><span className="dot" />{live.length} LIVE</span>}
            <a className="icon-btn boxed" href={href.search} aria-label="Search teams and games"><Icon name="search" /></a>
          </div>
        </div>
      </header>

      {!sb && q.error && <main className="page"><ErrorCard error={q.error} retry={q.refresh} /></main>}
      {!sb && !q.error && <Skeleton />}

      {sb && (
        <main className="page">
          {spot && <Spotlight g={spot} hideNumbers={q.stale || !online} />}

          {live.length > (spot ? 1 : 0) && (
            <Card title={spot ? 'Also live' : 'Live now'} right={<a href={href.games}>All games</a>}>
              {live.filter((g) => g !== spot).map((g) => <GameRow key={g.id} g={g} />)}
            </Card>
          )}

          {upNext && (
            <Card title="Up next" label="Up next" right={<span className="mono" style={{ fontSize: 12, fontWeight: 700 }}>{clockTime(upNext.kickoff)} ET · {countdownText(upNext.kickoff, now)}</span>}>
              <div className="card-body" style={{ gap: 12 }}>
                <a href={href.game(upNext.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text)' }}>
                  <Badge abbr={upNext.away.abbr} />
                  <span style={{ fontSize: 15, fontWeight: 600 }}>{teamName(upNext.away.abbr)}</span>
                  <span className="muted" style={{ fontSize: 13 }}>at</span>
                  <span style={{ fontSize: 15, fontWeight: 600 }}>{teamName(upNext.home.abbr)}</span>
                  <Badge abbr={upNext.home.abbr} />
                </a>
                <div className="chips">
                  {spreadLabel(upNext) && <span className="chip">{spreadLabel(upNext)}{upNext.odds?.total != null ? ` · O/U ${upNext.odds.total}` : ''}</span>}
                  {weatherShort(upNext) && <span className="chip">{weatherShort(upNext)}</span>}
                </div>
              </div>
              <LinkButton to={href.game(upNext.id)}>Lineups, injuries &amp; preview</LinkButton>
            </Card>
          )}

          {finals.length > 0 && (
            <Card title="Final">
              {finals.map((g) => <FinalRow key={g.id} g={g} />)}
            </Card>
          )}

          {!games.length && (
            <Card title="This week">
              <p className="empty">No games found for this week yet.</p>
              <LinkButton to={href.schedule}>See the schedule</LinkButton>
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

export function FinalRow({ g }: { g: Game }) {
  const as = g.away.score ?? 0, hs = g.home.score ?? 0;
  const [w, l, ws, ls] = as > hs ? [g.away.abbr, g.home.abbr, as, hs] : [g.home.abbr, g.away.abbr, hs, as];
  const tie = as === hs;
  return (
    <a className="row" href={href.game(g.id)} aria-label={`${teamName(w, true)} ${ws}, ${teamName(l, true)} ${ls}, ${liveStatus(g).toLowerCase()}`}>
      <span style={{ flex: 1, fontSize: 14 }}>
        <b>{teamName(w)}</b> <span className="mono" style={{ fontWeight: 700 }}>{ws}</span>{' '}
        <span className="muted">{tie ? '· ' : '· '}{teamName(l)} {ls}</span>
      </span>
      <span className="mono muted" style={{ fontSize: 11, fontWeight: 700 }}>{liveStatus(g)}</span>
    </a>
  );
}

function Spotlight({ g, hideNumbers }: { g: Game; hideNumbers: boolean }) {
  const as = g.away.score ?? 0, hs = g.home.score ?? 0;
  const hp = g.homeWinProb ?? 0.5;
  const lead = hp >= 0.5 ? g.home.abbr : g.away.abbr;
  const leadP = Math.round(Math.max(hp, 1 - hp) * 100);
  const fav = g.odds?.spread != null ? (g.odds.spread <= 0 ? 'home' : 'away') : null;
  const sit = g.status === 'live' ? situationText(g) : null;
  const s = g.situation;
  const w = g.weather;
  return (
    <section className="card" aria-label="Spotlight game">
      <div className="card-head">
        <span className="card-title">Spotlight</span>
        <span className="mono live-text" style={{ fontSize: 12, fontWeight: 700 }}>● {g.status === 'halftime' ? 'HALFTIME' : liveStatus(g)}</span>
      </div>
      <div className="card-body">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <TeamLine abbr={g.away.abbr} score={as} trail={as < hs} poss={g.possession === 'away'} />
          <TeamLine abbr={g.home.abbr} score={hs} trail={hs < as} poss={g.possession === 'home'} />
        </div>
        {sit && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, gap: 8 }}>
              <span style={{ fontWeight: 600 }}>{sit}</span>
              {s?.drivePlays != null && <span className="muted">Drive {s.drivePlays} plays · {s.driveYards ?? 0} yds</span>}
            </div>
            <FieldBar g={g} />
          </div>
        )}
        {!hideNumbers && (
          <div className="grid2" style={{ gap: 8 }}>
            <div className="tile">
              <span className="label">Win prob</span>
              <span style={{ fontSize: 20, fontWeight: 700 }}>{lead} {leadP}%</span>
              <div className="meter"><div style={{ width: `${leadP}%` }} /></div>
            </div>
            <div className="tile">
              <span className="label">{g.odds?.isLive ? 'Live odds' : 'Line'}</span>
              <span style={{ fontSize: 20, fontWeight: 700 }}>{spreadLabel(g) ?? '–'}</span>
              <span className="sub">
                {g.odds?.total != null ? `O/U ${g.odds.total}` : ''}
                {fav && g.odds?.[fav === 'home' ? 'homeMoneyline' : 'awayMoneyline'] != null ? ` · ML ${moneyline(g.odds[fav === 'home' ? 'homeMoneyline' : 'awayMoneyline'])}` : ''}
              </span>
            </div>
          </div>
        )}
        {w && <span className="sub">{w.dome ? 'Indoors · no weather effect' : [w.tempF != null ? `${Math.round(w.tempF)}°F` : null, w.description, w.windMph != null ? `Wind ${Math.round(w.windMph)} mph` : null].filter(Boolean).join(' · ')}</span>}
        {g.lastPlay && <p style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--text3)' }}><span className="muted">Last play ·</span> {g.lastPlay}</p>}
      </div>
      <a className="btn primary" href={href.game(g.id)}>Open game <Icon name="next" size={16} stroke={2.4} /></a>
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
    <Card title="Division leaders" right={<a href={href.standings()}>All standings</a>}>
      {rows.map(({ conf, div, s }) => (
        <a className="row" key={`${conf}-${div}`} href={href.team(s.team)} aria-label={`${conf} ${div} leader: ${teamName(s.team, true)}, ${s.w}-${s.l}`}>
          <Badge abbr={s.team} size={30} />
          <span style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 14, fontWeight: 600 }}>{conf} {div} · {team(s.team).name}</span>
            <span className="sub">{s.w}-{s.l}{s.t ? `-${s.t}` : ''} · {streakText(s.streak)}</span>
          </span>
          <FormDots s={s} />
        </a>
      ))}
    </Card>
  );
}
