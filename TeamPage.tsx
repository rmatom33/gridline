import { useEffect } from 'react';
import { data } from '../data/source';
import { cached, useOnline, usePoll } from '../data/usePoll';
import { href } from '../data/router';
import { team, TEAMS } from '../shared/teams';
import { kickoffTime, record, shortDay, spreadLabel, streakText } from '../shared/format';
import { ordinalRank, winPct } from '../shared/teamdetail';
import { BackButton, Badge, Card, ErrorCard, Footer, Icon, InjuryRows, Nav, OfflineBanner, SampleBadge, situationText, Skeleton, teamName } from '../ui/parts';
import { liveStatus } from '../ui/GameRow';
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
        <div className="top-row slim">
          <BackButton fallback={href.standings(t.conf)} />
          <SampleBadge />
        </div>
        <div style={{ padding: '0 16px 14px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <Badge abbr={abbr} size={56} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
              <span style={{ fontSize: 22, fontWeight: 700 }}>{known ? `${t.city} ${t.name}` : abbr}</span>
              <span className="sub" style={{ fontSize: 13 }}>
                {t.conf} {t.div}{d?.divRank ? ` · ${ordinalRank(d.divRank)}` : ''}{s?.seed ? ` · Playoff seed ${s.seed}` : ''}
              </span>
            </div>
          </div>
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
          {lg && (
            <a className="card" href={href.game(lg.id)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 16, color: 'var(--text)', borderColor: '#5A3418' }}
              aria-label={`Live now: ${teamName(lg.away.abbr)} ${lg.away.score ?? 0} at ${teamName(lg.home.abbr)} ${lg.home.score ?? 0}, ${liveStatus(lg)}. Open game`}>
              <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span className="mono live-text" style={{ fontSize: 12, fontWeight: 700 }}>● LIVE NOW · {liveStatus(lg)}</span>
                <span style={{ fontSize: 17, fontWeight: 700 }}>{teamName(lg.away.abbr)} {lg.away.score ?? 0} · {teamName(lg.home.abbr)} {lg.home.score ?? 0}</span>
                <span className="sub">
                  {[lg.possession && situationText(lg) ? `${lg[lg.possession].abbr} ball, ${situationText(lg)}` : null,
                    lg.homeWinProb != null && !q.stale ? `${abbr} ${Math.round((lg.home.abbr === abbr ? lg.homeWinProb : 1 - lg.homeWinProb) * 100)}% to win` : null].filter(Boolean).join(' · ')}
                </span>
              </span>
              <Icon name="next" />
            </a>
          )}

          {ng && (
            <Card title="Next game" right={<span className="sub">Week {ng.week}</span>}>
              <a className="row" href={href.game(ng.id)}>
                <Badge abbr={ng.home.abbr === abbr ? ng.away.abbr : ng.home.abbr} size={36} />
                <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontSize: 15, fontWeight: 600 }}>{ng.home.abbr === abbr ? `vs ${teamName(ng.away.abbr, true)}` : `at ${teamName(ng.home.abbr, true)}`}</span>
                  <span className="sub">{shortDay(ng.kickoff)} · {kickoffTime(ng.kickoff)}{spreadLabel(ng) ? ` · ${spreadLabel(ng)}` : ''}</span>
                </span>
                <Icon name="next" size={16} />
              </a>
            </Card>
          )}

          <Card title={`Last ${d.results.length || 5} games`} label="Recent results">
            {d.results.length ? d.results.map((r, i) => {
              const res = r.us > r.them ? 'W' : r.us < r.them ? 'L' : 'T';
              const inner = (
                <>
                  <span style={{ width: 28, height: 28, borderRadius: 7, background: res === 'W' ? 'var(--accent)' : 'var(--track)', color: res === 'W' ? 'var(--on-accent)' : 'var(--text3)', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{res}</span>
                  <span style={{ flex: 1, fontSize: 14 }}>{r.home ? 'vs' : 'at'} {teamName(r.opp)}</span>
                  <span className="mono" style={{ fontSize: 14, fontWeight: 700 }}>{r.us}–{r.them}</span>
                  <span className="mono muted" style={{ width: 40, textAlign: 'right', fontSize: 11 }}>WK {r.week}</span>
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
