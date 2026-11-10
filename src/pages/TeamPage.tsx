import { useEffect } from 'react';
import { data } from '../data/source';
import { cached, useOnline, usePoll } from '../data/usePoll';
import { href } from '../data/router';
import { team, TEAMS } from '../shared/teams';
import { clockTime, kickoffDay, record, streakText } from '../shared/format';
import { ordinalRank, winPct } from '../shared/teamdetail';
import { Badge, Card, CenterBar, ErrorCard, Footer, GoArrow, Icon, InjuryRows, Nav, OfflineBanner, Skeleton, teamName, WatchOn } from '../ui/parts';
import { favoredText, GameCard } from '../ui/GameRow';
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

  return (
    <div className="app">
      <header className="top">
        <OfflineBanner online={online} stale={q.stale} updatedAt={q.updatedAt} retry={q.refresh} />
        <CenterBar fallback={href.standings(t.conf)} backLabel="Back to standings">
          <span className="lbl">TEAM</span>
        </CenterBar>
        <div className="team-id">
          <Badge abbr={abbr} size={84} />
          <h1>{known ? `${t.city} ${t.name}` : abbr}</h1>
          <span className="sub" style={{ fontSize: 16 }}>{t.conf} {t.div}{d?.divRank ? ` · ${ordinalRank(d.divRank)} in division` : ''}{s?.seed ? ` · playoff place ${s.seed}` : ''}</span>
        </div>
        <div style={{ padding: '18px 20px 14px' }}>
          {s && (
            <div className="stat4" aria-label="Season so far">
              <div><span className="ic"><svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 4h6v5a3 3 0 0 1-6 0z" /><path d="M12 12v4M8 20h8M9 16h6" /></svg></span><span className="tx"><span className="k">Record</span><span className="v">{record(s.w, s.l, s.t).replace(/-/g, '–')}</span></span></div>
              <div><span className="ic"><svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 3L5 14h6l-1 7 8-11h-6z" /></svg></span><span className="tx"><span className="k">Streak</span><span className="v">{streakText(s.streak)}</span></span></div>
              <div><span className="ic"><Icon name="trend" size={20} stroke={2.2} /></span><span className="tx"><span className="k">Point diff</span><span className="v">{fmt(s.pf - s.pa)}</span></span></div>
              <div><span className="ic"><svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></svg></span><span className="tx"><span className="k">Division</span><span className="v">{d?.divRank ? `${ordinalRank(d.divRank)} of 4` : '–'}</span></span></div>
            </div>
          )}
        </div>
      </header>

      {!d && q.error && <main className="page"><ErrorCard error={q.error} retry={q.refresh} /></main>}
      {!d && !q.error && <Skeleton />}

      {d && (
        <main className="page">
          {lg && <GameCard g={lg} />}

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
                <WatchOn tv={ng.tv} />
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
