import { useEffect, useState } from 'react';
import { data } from '../data/source';
import { cached, useOnline, usePoll } from '../data/usePoll';
import { href } from '../data/router';
import { team, TEAMS } from '../shared/teams';
import { clockTime, kickoffDay, record, streakText } from '../shared/format';
import { ordinalRank, winPct } from '../shared/teamdetail';
import { Badge, Card, CenterBar, ErrorCard, Footer, GoArrow, Icon, InjuryRows, Nav, OfflineBanner, SampleBadge, Skeleton, teamName } from '../ui/parts';
import { favoredText, liveStatus } from '../ui/GameRow';
import { rememberTeam } from './SearchPage';

export function TeamPage({ abbr }: { abbr: string }) {
  const online = useOnline();
  const known = !!TEAMS[abbr];
  const q = usePoll(() => (known ? data.team(abbr) : Promise.reject(new Error('Unknown team'))), (d) => (d?.liveGame ? 15_000 : 5 * 60_000), [abbr]);
  const st = usePoll(() => cached('standings', () => data.standings()), 0, []);
  useEffect(() => { if (known) rememberTeam(abbr); }, [abbr, known]);
  const d = q.data;
  const t = team(abbr);
  const s = d?.standing;
  const gp = s ? Math.max(1, s.w + s.l + s.t) : 1;
  const division = (st.data ?? []).filter((x) => TEAMS[x.team]?.conf === t.conf && TEAMS[x.team]?.div === t.div)
    .sort((a, b) => winPct(b) - winPct(a) || (b.pf - b.pa) - (a.pf - a.pa));
  const lg = d?.liveGame;
  const ng = d?.nextGame;
  const [followed, setFollowed] = useState(() => { try { return localStorage.getItem('gridline.follow') === abbr; } catch { return false; } });
  const toggleFollow = () => {
    const next = !followed;
    setFollowed(next);
    try { if (next) localStorage.setItem('gridline.follow', abbr); else localStorage.removeItem('gridline.follow'); } catch { /* storage unavailable */ }
  };

  return (
    <div className="app">
      <header className="top">
        <OfflineBanner online={online} stale={q.stale} updatedAt={q.updatedAt} retry={q.refresh} />
        <CenterBar fallback={href.standings(t.conf)} backLabel="Back to standings" right={
          <button className="star" aria-pressed={followed} onClick={toggleFollow} aria-label={followed ? `Following the ${t.name}` : `Follow the ${t.name}`}><Icon name="star" size={24} stroke={2.2} /></button>
        }>
          <span className="lbl">TEAM</span>
        </CenterBar>
        <div className="team-id">
          <Badge abbr={abbr} size={84} />
          <h1>{known ? `${t.city} ${t.name}` : abbr}</h1>
          <span className="sub" style={{ fontSize: 16 }}>{t.conf} {t.div}{d?.divRank ? ` · ${ordinalRank(d.divRank)} in division` : ''}{s?.seed ? ` · playoff place ${s.seed}` : ''}</span>
          <SampleBadge />
        </div>
        <div style={{ padding: '18px 20px 14px' }}>
          {s && (
            <div className="grid4" style={{ textAlign: 'center' }}>
              <div className="stat-box"><div className="v">{record(s.w, s.l, s.t)}</div><div className="k">Record</div></div>
              <div className="stat-box"><div className="v">{s.streak}</div><div className="k">Streak</div></div>
              <div className="stat-box"><div className="v">{fmt(s.pf - s.pa)}</div><div className="k">Pt diff</div></div>
              <div className="stat-box"><div className="v">{d?.divRank ? ordinalRank(d.divRank) : '–'}</div><div className="k">In division</div></div>
            </div>
          )}
        </div>
      </header>

      {!d && q.error && <main className="page"><ErrorCard error={q.error} retry={q.refresh} /></main>}
      {!d && !q.error && <Skeleton />}

      {d && (
        <main className="page">
          {lg && <LiveCard lg={lg} stale={q.stale} />}

          {ng && (
            <section className="card pad" aria-label="Next game" style={{ gap: 16 }}>
              <span className="card-title">Next game</span>
              <a href={href.game(ng.id)} style={{ display: 'flex', flexDirection: 'column', gap: 14, color: 'var(--text)' }}>
                <span style={{ display: 'grid', gridTemplateColumns: '52px minmax(0,1fr) 38px', alignItems: 'center', gap: 14 }}>
                  <Badge abbr={ng.home.abbr === abbr ? ng.away.abbr : ng.home.abbr} size={52} />
                  <b style={{ fontSize: 20, lineHeight: 1.2 }}>{teamName(ng.home.abbr === abbr ? ng.away.abbr : ng.home.abbr, true)}</b>
                  <GoArrow />
                </span>
                <span className="ng-grid">
                  <span><span className="k"><Icon name="calendar" size={18} stroke={2.2} />Date</span><b>{kickoffDay(ng.kickoff)}</b></span>
                  <span><span className="k"><Icon name="clock" size={18} stroke={2.2} />Kickoff</span><b>{clockTime(ng.kickoff)}</b></span>
                  <span><span className="k"><Icon name="where" size={18} stroke={2.2} />Where</span><b>{ng.home.abbr === abbr ? 'At home' : `At ${team(ng.home.abbr).city}`}</b></span>
                  <span><span className="k"><Icon name="trend" size={18} stroke={2.2} />Favored</span><b>{favoredText(ng)?.replace(' favored by ', ' by ') ?? 'No line yet'}</b></span>
                </span>
              </a>
            </section>
          )}

          <Card title={`Last ${d.results.length || 5} games`} label="Recent results">
            {d.results.length ? d.results.map((r, i) => {
              const res = r.us > r.them ? 'W' : r.us < r.them ? 'L' : 'T';
              const inner = (
                <>
                  <span className="res-box" style={{ background: res === 'W' ? 'var(--win)' : res === 'L' ? 'var(--loss)' : 'var(--muted)' }}>{res}</span>
                  <span style={{ flex: 1, fontSize: 17 }}>{r.home ? 'vs' : 'at'} {teamName(r.opp)}</span>
                  <span className="mono" style={{ fontSize: 17, fontWeight: 800 }}>{r.us}–{r.them}</span>
                  <span className="muted" style={{ width: 64, textAlign: 'right', fontSize: 14 }}>Week {r.week}</span>
                </>
              );
              return r.gameId ? <a className="row" key={i} href={href.game(r.gameId)}>{inner}</a> : <div className="row" key={i}>{inner}</div>;
            }) : <p className="empty">No games played yet this season.</p>}
          </Card>

          {s && d.ranks && (
            <Card title="Season" right={<span className="sub">League rank</span>}>
              {[
                ['Points per game', (s.pf / gp).toFixed(1), d.ranks.pointsFor],
                ['Points allowed per game', (s.pa / gp).toFixed(1), d.ranks.pointsAgainst],
                ['Point differential', fmt(s.pf - s.pa), d.ranks.diff],
                ['Streak', streakText(s.streak), null]
              ].map(([label, v, rank]) => (
                <div className="row" key={String(label)}>
                  <span style={{ flex: 1, fontSize: 14, color: 'var(--text3)' }}>{label}</span>
                  <span className="mono" style={{ fontSize: 15, fontWeight: 700 }}>{v}</span>
                  <span className="mono" style={{ width: 44, textAlign: 'right', fontSize: 12, color: rank != null && Number(rank) <= 8 ? 'var(--accent)' : 'var(--muted)' }}>{rank != null ? ordinalRank(Number(rank)) : ''}</span>
                </div>
              ))}
            </Card>
          )}

          <Card title="Injury report"><InjuryRows list={d.injuries} showTeam={false} /></Card>

          {division.length > 0 && (
            <Card title={`${t.conf} ${t.div}`} right={<a href={href.standings(t.conf)}>Full standings</a>}>
              {division.map((x, i) => (
                <a className="row" key={x.team} href={href.team(x.team)} aria-current={x.team === abbr ? 'true' : undefined} style={x.team === abbr ? { background: 'var(--tint-bg)' } : undefined}>
                  <span className="mono muted" style={{ width: 16, fontSize: 12 }}>{i + 1}</span>
                  <Badge abbr={x.team} size={26} />
                  <span style={{ flex: 1, fontSize: 14, fontWeight: x.team === abbr ? 700 : 500 }}>{teamName(x.team)}</span>
                  <span className="mono" style={{ fontSize: 13 }}>{record(x.w, x.l, x.t)}</span>
                </a>
              ))}
            </Card>
          )}
          <Footer odds={!!ng} />
        </main>
      )}
      <Nav active="standings" />
    </div>
  );
}

const fmt = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0');

function LiveCard({ lg, stale }: { lg: import('../shared/types').Game; stale: boolean }) {
  const as = lg.away.score ?? 0, hs = lg.home.score ?? 0;
  const hp = lg.homeWinProb ?? 0.5;
  const q = lg.status === 'halftime' ? 'HALFTIME' : lg.quarter && lg.quarter >= 5 ? 'OVERTIME' : `${['1ST', '2ND', '3RD', '4TH'][(lg.quarter ?? 1) - 1]} QUARTER`;
  return (
    <a className="livecard" href={href.game(lg.id)} aria-label={`Playing now: ${teamName(lg.away.abbr)} ${as}, ${teamName(lg.home.abbr)} ${hs}, ${liveStatus(lg)}. Follow this game`}>
      <span className="sbline">
        <span className="lvp"><span className="dot" style={{ background: '#FFFFFF' }} />LIVE</span>
        <span className="qq">{q}</span>
        {lg.status === 'live' && lg.clock && <><span aria-hidden="true" style={{ width: 5, height: 5, borderRadius: 3, background: '#6B6690' }} /><span style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}><span className="tt">{lg.clock}</span><span style={{ fontSize: 13, fontWeight: 700, color: 'var(--on-navy-muted)' }}>left</span></span></>}
      </span>
      <span style={{ padding: '16px 20px 6px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {(['away', 'home'] as const).map((side) => {
          const mine = side === 'away' ? as : hs, theirs = side === 'away' ? hs : as;
          return (
            <span key={side} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Badge abbr={lg[side].abbr} size={40} />
              <span style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, fontSize: 20, fontWeight: mine >= theirs ? 800 : 700, color: mine >= theirs ? 'var(--text)' : 'var(--text3)' }}>
                {teamName(lg[side].abbr)}
                {lg.possession === side && lg.status === 'live' && (
                  <svg aria-label="Has the ball" width="22" height="22" viewBox="0 0 24 24"><g transform="rotate(-35 12 12)"><ellipse cx="12" cy="12" rx="9" ry="5.4" fill="#8B4513" stroke="#4A230A" strokeWidth="1.4" /><path d="M8.5 12h7M10 10.6v2.8M12 10.6v2.8M14 10.6v2.8" stroke="#FFFFFF" strokeWidth="1.3" strokeLinecap="round" /></g></svg>
                )}
              </span>
              <span className={`sbox ${mine >= theirs ? 'lead' : ''}`}>{mine}</span>
            </span>
          );
        })}
      </span>
      {!stale && lg.homeWinProb != null && (
        <span style={{ padding: '10px 20px 0', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 700, color: 'var(--muted)' }}>
            <span>{teamName(lg.away.abbr)} {Math.round((1 - hp) * 100)}%</span><span style={{ color: 'var(--text)' }}>{teamName(lg.home.abbr)} {Math.round(hp * 100)}% to win</span>
          </span>
          <span aria-hidden="true" style={{ display: 'flex', height: 10, borderRadius: 5, overflow: 'hidden', gap: 3 }}>
            <span style={{ width: `${(1 - hp) * 100}%`, background: team(lg.away.abbr).color }} /><span style={{ flex: 1, background: team(lg.home.abbr).color }} />
          </span>
        </span>
      )}
      <span className="btn primary" style={{ margin: '16px 20px 20px', width: 'auto', minHeight: 52 }}>Follow this game <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M5 12h12M13 6l6 6-6 6" /></svg></span>
    </a>
  );
}
