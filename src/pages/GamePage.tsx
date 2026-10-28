import { useState } from 'react';
import type { GameDetail, Play, Standing } from '../shared/types';
import { team } from '../shared/teams';
import { data } from '../data/source';
import { cached, useNow, useOnline, usePoll } from '../data/usePoll';
import { href } from '../data/router';
import { clockTime, countdown, kickoffTime, moneyline, periodLabel, record, shortDay, spreadLabel, streakText } from '../shared/format';
import { impact, statLine } from '../shared/stats';
import { groupDrives, wpDeltas } from '../shared/drives';
import {
  Badge, CenterBar, GoArrow, injuryWords, Card, ErrorCard, Field, Footer, FormBoxes, Icon, InjuryRows, LinkButton, Nav, OfflineBanner,
  PadCard, posWords, situationText, Skeleton, StatBars, teamName, WeekChip, WPBar, WPChart
} from '../ui/parts';
import { favoredText, liveStatus } from '../ui/GameRow';

const isLiveG = (g: GameDetail) => g.status === 'live' || g.status === 'halftime';

export function GamePage({ id }: { id: string }) {
  const online = useOnline();
  const q = usePoll(() => data.game(id), (g) => (g && isLiveG(g) ? 8_000 : g?.status === 'final' ? 0 : 60_000), [id]);
  const st = usePoll(() => cached('standings', () => data.standings()), 0, []);
  const g = q.data;
  const stale = q.stale || !online;

  return (
    <div className="app">
      <div className="top">
        <OfflineBanner online={online} stale={q.stale} updatedAt={q.updatedAt} retry={q.refresh} />
        <CenterBar fallback={href.games} backLabel="Back to all games" right={g?.status === 'final' ? <ShareButton g={g} /> : undefined}>
          <span className="ttl">{g ? `${teamName(g.away.abbr)} at ${teamName(g.home.abbr)}` : 'Game'}</span>
          {g && <WeekChip left={`WEEK ${g.week}`} right={g.venue?.city ?? null} />}
        </CenterBar>
        {g && g.status !== 'scheduled' && g.status !== 'postponed' && <ScoreHeader g={g} standings={st.data} stale={stale} />}
        {g && (g.status === 'scheduled' || g.status === 'postponed') && <PregameHeader g={g} standings={st.data} />}
      </div>

      {!g && q.error && <main className="page"><ErrorCard error={q.error} retry={q.refresh} /></main>}
      {!g && !q.error && <Skeleton />}

      {g && (
        <main className="page tight">
          {(g.status === 'scheduled' || g.status === 'postponed') && <Pregame g={g} standings={st.data} stale={stale} />}
          {g.status === 'live' && <Live g={g} standings={st.data} stale={stale} />}
          {g.status === 'halftime' && <Halftime g={g} stale={stale} />}
          {g.status === 'final' && <Final g={g} />}
          <Footer odds={g.status !== 'final'} />
        </main>
      )}
      <Nav active="games" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------

function ScoreHeader({ g, standings, stale }: { g: GameDetail; standings: Standing[] | null; stale: boolean }) {
  const as = g.away.score ?? 0, hs = g.home.score ?? 0;
  const final = g.status === 'final';
  const winner = final ? (as > hs ? 'away' : hs > as ? 'home' : null) : null;
  const words = (abbr: string) => {
    const s = standings?.find((x) => x.team === abbr);
    return s ? `Record ${s.w}–${s.l}${s.t ? `–${s.t}` : ''}` : '';
  };
  const side = (s: 'away' | 'home') => {
    const t = g[s];
    const hasBall = g.status === 'live' && g.possession === s;
    const meta = final ? (winner === s ? 'won' : winner ? 'lost' : 'tied') : hasBall ? 'has the ball' : s === 'home' ? 'home team' : words(t.abbr);
    return (
      <a href={href.team(t.abbr)} className="sb-side" aria-label={`${teamName(t.abbr, true)}, ${meta}`}>
        <Badge abbr={t.abbr} size={60} />
        <span className="tname">{teamName(t.abbr)}</span>
        <span className="meta">
          {winner === s ? <span className="sb-status" style={{ height: 26, fontSize: 13 }}>WON</span> : <span style={{ whiteSpace: 'nowrap' }}>{meta}</span>}
          {g.status === 'live' && t.timeouts != null && (
            <span className="timeouts" aria-label={`${t.timeouts} timeouts left`}>
              {[0, 1, 2].map((n) => <span key={n} className={n < t.timeouts! ? 'on' : ''} />)}
            </span>
          )}
        </span>
      </a>
    );
  };
  const dim = (mine: number, theirs: number) => (mine < theirs ? { color: 'var(--dim-on-navy)' } : undefined);
  return (
    <div className="scoreboard" aria-label="Scoreboard">
      {side('away')}
      <div className="sb-mid" aria-label={`${teamName(g.away.abbr)} ${as}, ${teamName(g.home.abbr)} ${hs}, ${liveStatus(g)}`}>
        <span className="sb-score"><span style={dim(as, hs)}>{as}</span><span className="sep"> – </span><span style={dim(hs, as)}>{hs}</span></span>
        <span className={`sb-status ${final || g.status === 'halftime' ? 'final' : ''}`}>
          {final ? liveStatus(g) : g.status === 'halftime' ? 'Halftime' : `${periodLabel(g.quarter) === 'OT' ? 'OT' : ['1st', '2nd', '3rd', '4th'][(g.quarter ?? 1) - 1]} \u00b7 ${g.clock ?? ''} left${stale ? ' \u00b7 paused' : ''}`}
        </span>
      </div>
      {side('home')}
    </div>
  );
}

function ShareButton({ g }: { g: GameDetail }) {
  const [done, setDone] = useState(false);
  const text = `${teamName(g.away.abbr)} ${g.away.score} – ${teamName(g.home.abbr)} ${g.home.score} (${liveStatus(g).toLowerCase()})`;
  const onClick = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: 'Gridline', text, url });
      else { await navigator.clipboard.writeText(`${text} ${url}`); setDone(true); setTimeout(() => setDone(false), 2000); }
    } catch { /* cancelled */ }
  };
  return (
    <button className="icon-btn" onClick={onClick} aria-label={done ? 'Link copied' : 'Share this result'} title={done ? 'Link copied' : 'Share'}>
      {done ? <span className="mono" style={{ fontSize: 10, color: 'var(--accent)' }}>COPIED</span> : <Icon name="share" />}
    </button>
  );
}

function PregameHeader({ g, standings }: { g: GameDetail; standings: Standing[] | null }) {
  const now = useNow();
  const rec = (abbr: string, fb?: string) => {
    const s = standings?.find((x) => x.team === abbr);
    return s ? `Record ${s.w}–${s.l}${s.t ? `–${s.t}` : ''}` : fb ? `Record ${fb.replace('-', '–')}` : '';
  };
  const c = countdown(g.kickoff, now);
  const cells: [string, string][] = c.days > 0
    ? [[String(c.days), c.days === 1 ? 'day' : 'days'], [String(c.hours), c.hours === 1 ? 'hour' : 'hours']]
    : [[String(c.hours), c.hours === 1 ? 'hour' : 'hours'], [String(c.mins).padStart(2, '0'), 'minutes']];
  const t = clockTime(g.kickoff);
  const day = c.days > 0 ? new Date(g.kickoff).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'America/New_York' }) : 'today';
  return (
    <>
      <div className="pg-teams">
        {(['away', 'home'] as const).map((side, i) => [
          i === 1 ? <span key="at" className="at">at</span> : null,
          <a key={side} href={href.team(g[side].abbr)}>
            <Badge abbr={g[side].abbr} size={64} />
            <span style={{ fontSize: 19, fontWeight: 700 }}>{teamName(g[side].abbr)}</span>
            <span className="sub" style={{ fontSize: 14, whiteSpace: 'nowrap' }}>{rec(g[side].abbr, g[side].record)}</span>
          </a>
        ])}
      </div>
      {g.status !== 'postponed' && (
        <div className="kickboard" role="timer" aria-label={`Kickoff ${day} at ${t}, in ${cells.map(([v, k]) => `${v} ${k}`).join(' ')}`}>
          <div className="cd">
            <span className="cap">KICKOFF IN</span>
            <span className="nums">
              <span className="n"><b>{cells[0][0]}</b><span>{cells[0][1]}</span></span>
              <span className="colon" aria-hidden="true">:</span>
              <span className="n"><b>{cells[1][0]}</b><span>{cells[1][1]}</span></span>
            </span>
          </div>
          <div className="ko"><small>KICKOFF</small><b>{t.replace(/ [AP]M$/, '')}</b><span>{t.slice(-2)} {day}</span></div>
        </div>
      )}
      <div style={{ height: 20 }} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Shared sections
// ---------------------------------------------------------------------------

function LineScore({ g, half = false }: { g: GameDetail; half?: boolean }) {
  const n = half ? 2 : Math.max(4, g.quarters.away.length, g.quarters.home.length);
  const heads = Array.from({ length: n }, (_, i) => (i >= 4 ? 'OT' : `Q${i + 1}`));
  const sum = (arr: number[]) => arr.slice(0, n).reduce((a, b) => a + b, 0);
  const cols = `minmax(0,1.4fr) repeat(${n + 1}, minmax(0,1fr))`;
  return (
    <div className="linescore" style={{ gridTemplateColumns: cols }} role="table" aria-label="Score by quarter">
      <span className="h t" role="columnheader">TEAM</span>
      {heads.map((h, i) => <span className="h" key={i} role="columnheader">{h}</span>)}
      <span className="h" role="columnheader">{half ? 'HALF' : 'T'}</span>
      {(['away', 'home'] as const).map((s) => (
        <span key={s} style={{ display: 'contents' }} role="row">
          <span className="t">{g[s].abbr}</span>
          {Array.from({ length: n }, (_, i) => <span key={i}>{g.quarters[s][i] ?? '–'}</span>)}
          <span className="tot">{half ? sum(g.quarters[s]) : g[s].score ?? 0}</span>
        </span>
      ))}
    </div>
  );
}

function PlayerCard({ g, title, count }: { g: GameDetail; title: string; count: number }) {
  const top = g.players.slice().sort((a, b) => impact(b) - impact(a)).slice(0, count);
  if (!top.length) return null;
  return (
    <Card title={title}>
      {top.map((p) => (
        <div className="row" key={p.id}>
          <span style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--panel2)', border: `2px solid ${team(p.team).color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>{p.pos}</span>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 14, fontWeight: 600 }}>{p.name} · {p.team}</span>
            <span className="sub">{statLine(p)}</span>
          </div>
        </div>
      ))}
    </Card>
  );
}

function TeamStats({ g, title = 'Team stats' }: { g: GameDetail; title?: string }) {
  if (!g.teamStats.length) return null;
  return (
    <PadCard label={title}>
      <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between' }}><span>{g.away.abbr}</span><span>{title}</span><span>{g.home.abbr}</span></div>
      <StatBars rows={g.teamStats} away={g.away.abbr} home={g.home.abbr} />
    </PadCard>
  );
}

function FormCard({ g, standings, title = 'Last 5 games', season = false }: { g: GameDetail; standings: Standing[] | null; title?: string; season?: boolean }) {
  const a = standings?.find((s) => s.team === g.away.abbr), h = standings?.find((s) => s.team === g.home.abbr);
  if (!a && !h) return null;
  const gp = (s?: Standing) => Math.max(1, (s?.w ?? 0) + (s?.l ?? 0) + (s?.t ?? 0));
  const rows = a && h ? [
    ['Record', record(a.w, a.l, a.t), record(h.w, h.l, h.t)],
    ['Points / game', (a.pf / gp(a)).toFixed(1), (h.pf / gp(h)).toFixed(1)],
    ['Allowed / game', (a.pa / gp(a)).toFixed(1), (h.pa / gp(h)).toFixed(1)],
    ['Point diff', fmtDiff(a.pf - a.pa), fmtDiff(h.pf - h.pa)]
  ] : [];
  return (
    <PadCard title={title}>
      {[a, h].map((s, i) => s && (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 40, fontSize: 13, fontWeight: 700 }}>{s.team}</span>
          <span style={{ flex: 1 }}><FormBoxes s={s} /></span>
          <span className="sub">{streakText(s.streak)}</span>
        </div>
      ))}
      {season && rows.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', borderTop: '1px solid var(--line)', paddingTop: 4 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--muted)', padding: '6px 0' }} className="mono"><span>{g.away.abbr}</span><span>SEASON</span><span>{g.home.abbr}</span></div>
          {rows.map(([label, av, hv]) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--line)', fontSize: 14 }}>
              <b className="mono" style={{ fontSize: 13 }}>{av}</b><span className="muted" style={{ fontSize: 13 }}>{label}</span><b className="mono" style={{ fontSize: 13 }}>{hv}</b>
            </div>
          ))}
        </div>
      )}
    </PadCard>
  );
}

const fmtDiff = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0');

function OddsWeather({ g, stale, live }: { g: GameDetail; stale: boolean; live: boolean }) {
  const o = g.odds;
  const w = g.weather;
  return (
    <div className="grid2">
      <section className="mini" aria-label="Betting line">
        <span className="label">{live ? 'Betting line now' : 'Betting line'}</span>
        {stale ? <span className="sub">Hidden until you're back online</span> : (
          <>
            <span className="big">{favoredText(g)?.replace(' favored', '') ?? 'No line yet'}</span>
            <span className="sub">
              {o?.homeMoneyline != null || o?.awayMoneyline != null ? <>ML {g.away.abbr} {moneyline(o?.awayMoneyline)} / {g.home.abbr} {moneyline(o?.homeMoneyline)}<br /></> : null}
              {o?.total != null ? `Total ${o.total}` : ''}
            </span>
          </>
        )}
      </section>
      <section className="mini" aria-label="Weather">
        <span className="label">Weather</span>
        {w?.dome ? (
          <><span className="big">Indoors</span><span className="sub">Dome · no weather effect</span></>
        ) : (
          <>
            <span className="big">{w?.tempF != null ? `${Math.round(w.tempF)}°F` : '–'}</span>
            <span className="sub">
              {[w?.description, w?.windMph != null ? `${w.windDir ? `${w.windDir} ` : ''}${Math.round(w.windMph)} mph` : null].filter(Boolean).join(' · ')}
              {w?.precipPct != null ? <><br />Rain {w.precipPct}% · Outdoor</> : <><br />Outdoor</>}
            </span>
          </>
        )}
      </section>
    </div>
  );
}

function playTag(p: Play): string {
  const t = p.text.toLowerCase();
  if (p.kind === 'score') return t.includes('field goal') ? `FIELD GOAL · ${p.team}` : t.includes('safety') ? `SAFETY · ${p.team}` : `TOUCHDOWN · ${p.team}`;
  if (p.kind === 'turnover') return t.includes('intercept') ? 'INTERCEPTION' : t.includes('fumble') ? 'FUMBLE' : 'TURNOVER';
  if (p.kind === 'punt') return `PUNT · ${p.team}`;
  if (p.kind === 'kick') return /extra point/i.test(p.text) ? `EXTRA POINT · ${p.team}` : /kicks? off|kickoff/i.test(p.text) ? `KICKOFF · ${p.team}` : `KICK · ${p.team}`;
  if (p.kind === 'penalty') return 'PENALTY';
  if (p.kind === 'timeout') return 'TIMEOUT';
  if (p.down) return `${['1st', '2nd', '3rd', '4th'][p.down - 1]} & ${p.distance ?? ''}${p.spot ? ` · ${p.spot}` : ''}`;
  return p.team;
}
const highlight = (p: Play) => p.kind === 'score' || p.kind === 'turnover' || p.kind === 'punt' || p.kind === 'kick';

export function PlayRow({ p, delta }: { p: Play; delta?: number }) {
  const col = delta == null || delta === 0 ? 'var(--muted)' : delta > 0 ? 'var(--accent)' : 'var(--down)';
  return (
    <div className="play">
      <span className="clk">{p.clock}</span>
      <div className="body">
        <span className="tag" style={{ color: p.kind === 'score' ? 'var(--accent)' : highlight(p) ? 'var(--live)' : 'var(--text)' }}>{playTag(p)}</span>
        <span className="txt">{p.text}</span>
      </div>
      {delta != null && <span className="wp" style={{ color: col }} aria-label={`Win chance change ${delta} points`}>{delta > 0 ? `+${delta}` : delta < 0 ? `−${Math.abs(delta)}` : '0'}</span>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pre-game
// ---------------------------------------------------------------------------

function Pregame({ g, standings, stale }: { g: GameDetail; standings: Standing[] | null; stale: boolean }) {
  const [tab, setTab] = useState<'away' | 'home'>('away');
  const hp = g.pregameHomeWinProb ?? g.homeWinProb ?? 0.5;
  const o = g.odds;
  const fav = o?.spread != null ? (o.spread <= 0 ? 'home' : 'away') : null;
  const dog = fav === 'home' ? 'away' : 'home';
  const lineup = g.lineups[tab];
  const venue = [g.venue?.name, [g.venue?.city, g.venue?.state].filter(Boolean).join(', ')].filter(Boolean).join(' · ');
  return (
    <>
      {g.status === 'postponed' && <div className="alert"><b>Postponed</b><span className="sub">A new kickoff time hasn't been announced yet.</span></div>}
      <p className="sub" style={{ textAlign: 'center' }}>{shortDay(g.kickoff)} · {kickoffTime(g.kickoff)}{venue ? ` · ${venue}` : ''}</p>

      {!stale && (
        <PadCard title="Who's expected to win">
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 18, fontWeight: 700 }}>
            <span>{g.away.abbr} {Math.round((1 - hp) * 100)}%</span><span>{g.home.abbr} {Math.round(hp * 100)}%</span>
          </div>
          <WPBar homeProb={hp} g={g} />
          <span className="sub">Based on the betting line. This updates after every play once the game starts.</span>
        </PadCard>
      )}

      {!stale && o && (o.spread != null || o.total != null) && (
        <section className="card pad" aria-label="The betting line">
          <span className="card-title">The betting line</span>
          {o.spread != null && <div className="tile"><span className="label">Point spread</span><b style={{ fontSize: 19 }}>{favoredText(g) ?? '–'}</b></div>}
          {o.total != null && <div className="tile"><span className="label">Total points expected</span><span style={{ fontSize: 19 }}><b>{o.total}</b> between both teams</span></div>}
          {fav && (o.homeMoneyline != null || o.awayMoneyline != null) && <div className="tile"><span className="label">Moneyline</span><span style={{ fontSize: 19 }}>{teamName(g[fav].abbr)} {moneyline(o[fav === 'home' ? 'homeMoneyline' : 'awayMoneyline'])} · {teamName(g[dog].abbr)} {moneyline(o[dog === 'home' ? 'homeMoneyline' : 'awayMoneyline'])}</span></div>}
          <span className="note">For information only.</span>
        </section>
      )}

      {(g.lineups.away.length > 0 || g.lineups.home.length > 0) && (
        <section className="card pad" aria-label="Starting lineups">
          <span className="card-title">Starting lineups</span>
          <div className="teampick" role="tablist" aria-label="Pick a team">
            {(['away', 'home'] as const).map((side) => {
              const tm = team(g[side].abbr);
              const on = tab === side;
              return (
                <button key={side} role="tab" aria-selected={on} onClick={() => setTab(side)}
                  style={on ? { background: `radial-gradient(120% 140% at 0% 0%, ${tm.color}CC 0%, ${tm.color} 50%, #0B0A1C 140%)`, borderColor: tm.color } : undefined}>
                  <span className="badge" style={{ width: 42, height: 42, borderRadius: 13, fontSize: 13, background: on ? '#FFFFFF' : tm.color, color: on ? tm.color : tm.text }}>{tm.abbr}</span>
                  {tm.name}
                </button>
              );
            })}
          </div>
          <span className="sub">Expected starters on offense. Confirmed about 90 minutes before kickoff.</span>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {lineup.length ? lineup.map((p, i) => (
              <div key={`${p.pos}-${i}`} style={{ padding: '12px 0', borderTop: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ width: 104, fontSize: 15, fontWeight: 700, color: 'var(--muted)' }}>{posWords(p.pos)}</span>
                <span style={{ flex: 1, fontSize: 18, fontWeight: 700 }}>{p.name}</span>
                {p.status && <span className={`status-pill ${p.status === 'Questionable' ? 's-q' : p.status === 'Out' || p.status === 'Doubtful' || p.status === 'IR' ? 's-out' : 's-ok'}`}>{injuryWords(p.status)}</span>}
              </div>
            )) : <p className="sub">Lineup not available yet.</p>}
          </div>
        </section>
      )}

      <Card title="Injury report"><InjuryRows list={g.injuries} /></Card>
      <FormCard g={g} standings={standings} title="Last 5 games" season />
    </>
  );
}


// ---------------------------------------------------------------------------
// Live
// ---------------------------------------------------------------------------

function Live({ g, standings, stale }: { g: GameDetail; standings: Standing[] | null; stale: boolean }) {
  const s = g.situation;
  const sit = situationText(g);
  const deltas = wpDeltas(g.plays, g.pregameHomeWinProb);
  const hp = g.homeWinProb ?? 0.5;
  const leader = hp >= 0.5 ? g.home.abbr : g.away.abbr;
  const lp = Math.round(Math.max(hp, 1 - hp) * 100);
  const pre = g.pregameHomeWinProb;
  return (
    <>
      {g.summary && (
        <PadCard title="The story so far">
          <p className="prose">{g.summary}</p>
          <span className="note">Written automatically from the play-by-play</span>
        </PadCard>
      )}

      {sit && g.possession && (
        <PadCard label="Game situation">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 22, fontWeight: 700 }}>{sit.replace(' at ', ' · ')}</span>
            <span className="mono muted" style={{ fontSize: 11 }}>{g[g.possession].abbr} DRIVE</span>
          </div>
          <Field g={g} />
          {s?.drivePlays != null && (
            <div className="grid3" style={{ textAlign: 'center' }}>
              <div className="stat-box"><div className="v">{s.drivePlays}</div><div className="k">Plays</div></div>
              <div className="stat-box"><div className="v">{s.driveYards ?? 0}</div><div className="k">Yards</div></div>
              <div className="stat-box"><div className="v">{s.driveTime ?? '–'}</div><div className="k">Drive time</div></div>
            </div>
          )}
        </PadCard>
      )}

      {stale ? (
        <PadCard title="Chance to win"><span className="sub">Back when you're online. We hide it so you never see an out-of-date number as if it were live.</span></PadCard>
      ) : (
        <PadCard title="Chance to win" right={<span style={{ fontSize: 15, fontWeight: 700 }}>{leader} {lp}%</span>}>
          <WPChart series={g.winProbSeries} g={g} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--muted)', gap: 8 }}>
            <span>{g.home.abbr} side ↑</span>
            {pre != null && <span>Pre-game {pre >= 0.5 ? g.home.abbr : g.away.abbr} {Math.round(Math.max(pre, 1 - pre) * 100)}%</span>}
            <span>{g.away.abbr} side ↓</span>
          </div>
        </PadCard>
      )}

      <OddsWeather g={g} stale={stale} live />

      <Card title="Latest plays" right={<span className="sub">{teamName(g.home.abbr)} chance</span>}>
        {g.plays.length ? g.plays.slice(0, 5).map((p) => <PlayRow key={p.id} p={p} delta={stale ? undefined : deltas.get(p.id)} />) : <p className="empty">Plays will appear here.</p>}
        <LinkButton to={href.plays(g.id)}>See every play</LinkButton>
      </Card>

      <PlayerCard g={g} title="Players to watch" count={4} />
      <TeamStats g={g} />
      <FormCard g={g} standings={standings} />
      <Card title="Injuries"><InjuryRows list={g.injuries} /></Card>
    </>
  );
}

// ---------------------------------------------------------------------------
// Halftime
// ---------------------------------------------------------------------------

function Halftime({ g, stale }: { g: GameDetail; stale: boolean }) {
  const hp = g.homeWinProb ?? 0.5;
  const pre = g.pregameHomeWinProb;
  const scoring = g.plays.filter((p) => p.kind === 'score').slice().reverse();
  return (
    <>
      <section className="card pad" aria-label="Second half" style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <span style={{ width: 56, height: 56, borderRadius: 14, background: 'var(--tint-bg)', color: 'var(--tint-fg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon name="clock" size={26} /></span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <b style={{ fontSize: 19 }}>Second half coming up</b>
          <span className="sub">This page switches back to live play-by-play when the third quarter starts.</span>
        </div>
      </section>

      <PadCard title="First half in brief">
        {g.summary && <p className="prose">{g.summary}</p>}
        <LineScore g={g} half />
      </PadCard>

      {!stale && (
        <PadCard title="Chance to win" right={<span style={{ fontSize: 15, fontWeight: 700 }}>{hp >= 0.5 ? g.home.abbr : g.away.abbr} {Math.round(Math.max(hp, 1 - hp) * 100)}%</span>}>
          <WPBar homeProb={hp} g={g} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--muted)', gap: 8 }}>
            <span>{g.away.abbr} {Math.round((1 - hp) * 100)}%</span>
            {pre != null && <span>Pre-game {pre >= 0.5 ? g.home.abbr : g.away.abbr} {Math.round(Math.max(pre, 1 - pre) * 100)}%</span>}
            <span>{g.home.abbr} {Math.round(hp * 100)}%</span>
          </div>
        </PadCard>
      )}

      <TeamStats g={g} title="First half" />
      <PlayerCard g={g} title="First-half leaders" count={3} />

      {scoring.length > 0 && (
        <Card title="Scoring so far">
          {scoring.map((p) => (
            <div className="row" key={p.id}>
              <span className="mono" style={{ width: 64, fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{periodLabel(p.quarter)} {p.clock}</span>
              <span style={{ flex: 1, fontSize: 13, lineHeight: 1.45, color: 'var(--text2)' }}>{p.text}</span>
              <Badge abbr={p.team} size={26} />
            </div>
          ))}
        </Card>
      )}
      <OddsWeather g={g} stale={stale} live />
    </>
  );
}

// ---------------------------------------------------------------------------
// Final
// ---------------------------------------------------------------------------

function Final({ g }: { g: GameDetail }) {
  const as = g.away.score ?? 0, hs = g.home.score ?? 0;
  const winner = as > hs ? 'away' : hs > as ? 'home' : null;
  const loser = winner === 'away' ? 'home' : winner === 'home' ? 'away' : null;
  const drives = groupDrives(g.plays, false);
  const gwd = winner ? drives.find((d) => d.team === g[winner].abbr && d.scoring && d.quarter >= 4) : undefined;
  const big = gwd?.plays.filter((p) => p.yards != null && p.kind !== 'punt').sort((a, b) => (b.yards ?? 0) - (a.yards ?? 0))[0];
  const deltas = wpDeltas(g.plays, g.pregameHomeWinProb);
  const key = g.plays
    .filter((p) => p.kind === 'score' || p.kind === 'turnover')
    .sort((a, b) => Math.abs(deltas.get(b.id) ?? 0) - Math.abs(deltas.get(a.id) ?? 0))
    .slice(0, 5)
    .sort((a, b) => g.plays.indexOf(b) - g.plays.indexOf(a));

  // Loser's best moment, for the "how it swung" headline.
  let peak: { p: number; q: string } | null = null;
  if (loser) {
    for (const pt of g.winProbSeries) {
      const v = loser === 'home' ? pt.homeWinProb : 1 - pt.homeWinProb;
      if (!peak || v > peak.p) peak = { p: v, q: pt.t >= 3600 ? 'OT' : `Q${Math.min(4, Math.floor(pt.t / 900) + 1)}` };
    }
  }

  return (
    <>
      <PadCard title="What happened">
        {g.summary && <p className="prose">{g.summary}</p>}
        <LineScore g={g} />
      </PadCard>

      {gwd && winner && gwd.playCount >= 2 && (
        <WinningDrive g={g} winner={winner} drive={gwd} big={big?.text} />
      )}

      {g.winProbSeries.length > 1 && (
        <PadCard title="How it swung" right={peak && loser ? <span className="sub">{g[loser].abbr} peaked at {Math.round(peak.p * 100)}% ({peak.q})</span> : undefined}>
          <WPChart series={g.winProbSeries} g={g} label={`${teamName(g.home.abbr)} win probability across the game`} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--muted)' }}><span>{g.home.abbr} side ↑</span><span>{g.away.abbr} side ↓</span></div>
        </PadCard>
      )}

      {key.length > 0 && (
        <Card title="Key plays" right={<span className="sub">{teamName(g.home.abbr)} chance</span>}>
          {key.map((p) => <PlayRow key={p.id} p={{ ...p, clock: `${periodLabel(p.quarter)} ${p.clock}` }} delta={deltas.get(p.id)} />)}
          <LinkButton to={href.plays(g.id)}>See every play</LinkButton>
        </Card>
      )}
      {!key.length && g.plays.length > 0 && <LinkButton to={href.plays(g.id)}>See every play</LinkButton>}

      <PlayerCard g={g} title="Players of the game" count={5} />
      <TeamStats g={g} />
      <UpNext g={g} />
    </>
  );
}

function UpNext({ g }: { g: GameDetail }) {
  const q = usePoll(() => cached(`schedule-${g.week + 1}`, () => data.schedule(g.week + 1)), 0, [g.week]);
  const games = q.data?.games ?? [];
  const fullWeek = games.length >= 13;
  const rows = (['away', 'home'] as const).map((s) => {
    const abbr = g[s].abbr;
    const next = games.find((x) => x.home.abbr === abbr || x.away.abbr === abbr);
    return { abbr, next };
  }).filter((r) => r.next || fullWeek);
  if (!q.data || !rows.length) return null;
  return (
    <Card title="Up next" label="Up next for both teams">
      {rows.map(({ abbr, next }) => (
        <a className="row" key={abbr} href={next ? href.game(next.id) : href.team(abbr)}>
          <Badge abbr={abbr} size={30} />
          <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 14, fontWeight: 600 }}>
              {next ? (next.home.abbr === abbr ? `vs ${teamName(next.away.abbr, true)}` : `at ${teamName(next.home.abbr, true)}`) : 'Bye week'}
            </span>
            <span className="sub">{next ? `${shortDay(next.kickoff)} · ${kickoffTime(next.kickoff)}${spreadLabel(next) ? ` · ${spreadLabel(next)}` : ''}` : `Week ${g.week + 1}`}</span>
          </span>
          <GoArrow />
        </a>
      ))}
    </Card>
  );
}

function WinningDrive({ g, winner, drive, big }: { g: GameDetail; winner: 'away' | 'home'; drive: { playCount: number; yards: number; time: string; quarter: number; plays: Play[] }; big?: string }) {
  const me = team(g[winner].abbr), them = team(g[winner === 'away' ? 'home' : 'away'].abbr);
  const last = drive.plays[drive.plays.length - 1] ?? drive.plays[0];
  const scoreText = last?.text?.toLowerCase().includes('field goal') ? 'field goal' : 'touchdown';
  const startPct = Math.max(0, Math.min(95, 100 - drive.yards));
  const mins = drive.time.split(':');
  const timeWords = mins.length === 2 ? `${Number(mins[0])} minute${Number(mins[0]) === 1 ? '' : 's'} ${Number(mins[1])} seconds` : drive.time;
  return (
    <section className="card pad" aria-label="The winning drive" style={{ gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Badge abbr={me.abbr} size={44} />
        <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
          <span className="card-title">The winning drive</span>
          <span className="sub">{me.name} {scoreText} · {periodLabel(drive.quarter) === 'OT' ? 'overtime' : '4th quarter'}{last?.clock ? `, ${last.clock} left` : ''}</span>
        </span>
      </div>
      <div role="img" aria-label={`The ${me.name} drove ${drive.yards} yards into the ${them.name} end zone`} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div className="drivefield">
          <span className="ez left" style={{ background: me.color }}>{me.name.toUpperCase()}</span>
          <span className="turf">
            <span className="path" style={{ left: `${startPct}%`, right: 0 }} />
            <span className="start" style={{ left: `${startPct}%` }} />
            <span className="startlbl" style={{ left: `${startPct}%` }}>START</span>
            <span className="fifty">50</span>
          </span>
          <span className="ez" style={{ background: them.color }}>{them.name.toUpperCase()}</span>
          <span className="ball" aria-hidden="true" style={{ right: 8 }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 700, color: 'var(--muted)' }}>
          <span>{drive.yards >= 50 ? `${me.name}' own ${100 - drive.yards}` : `${them.name}' ${drive.yards}`}</span><span style={{ color: 'var(--accent-text)' }}>{scoreText === 'touchdown' ? 'Touchdown' : 'Field goal'}</span>
        </div>
      </div>
      <p style={{ fontSize: 19, lineHeight: 1.4 }}>The {me.name} went <b>{drive.yards} yards</b> in <b>{drive.playCount} plays</b>, using up <b>{timeWords}</b> of the clock.</p>
      {big && (
        <div className="callout">
          <span className="ic" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7-6.2-3.7-6.2 3.7 1.6-7L2 9.2l7.1-.6z" /></svg></span>
          <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}><b style={{ fontSize: 15, color: 'var(--accent-text)' }}>Biggest play</b><span style={{ fontSize: 17 }}>{big}</span></span>
        </div>
      )}
    </section>
  );
}
