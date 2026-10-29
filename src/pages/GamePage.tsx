import { useState } from 'react';
import type { GameDetail, Play, Standing } from '../shared/types';
import { team } from '../shared/teams';
import { data } from '../data/source';
import { cached, useNow, useOnline, usePoll } from '../data/usePoll';
import { href } from '../data/router';
import { clockTime, kickoffTime, moneyline, periodLabel, record, shortDay, spreadLabel, streakText } from '../shared/format';
import { impact, statLine } from '../shared/stats';
import { groupDrives, wpDeltas } from '../shared/drives';
import {
  Badge, Card, Countdown3, ErrorCard, GoArrow, Field, Footer, FormBoxes, Icon, injuryClass, injuryWords, InjuryRows, LinkButton, Nav, OfflineBanner,
  PadCard, posWords, situationText, Skeleton, StatBars, teamName, TopBar, WatchOn, WinNums, WPBar, WPChart
} from '../ui/parts';
import { liveStatus, plainSituation } from '../ui/GameRow';

const isLiveG = (g: GameDetail) => g.status === 'live' || g.status === 'halftime';

type Tab = 'preview' | 'lineups' | 'injuries' | 'odds' | 'center' | 'box';

export function GamePage({ id }: { id: string }) {
  const online = useOnline();
  const q = usePoll(() => data.game(id), (g) => (g && isLiveG(g) ? 8_000 : g?.status === 'final' ? 0 : 60_000), [id]);
  const st = usePoll(() => cached('standings', () => data.standings()), 0, []);
  const [tabSel, setTab] = useState<Tab | null>(null);
  const g = q.data;
  const stale = q.stale || !online;
  const pre = !!g && (g.status === 'scheduled' || g.status === 'postponed');
  const tabs: [Tab | 'plays', string][] = pre
    ? [['preview', 'Preview'], ['lineups', 'Lineups'], ['injuries', 'Injuries'], ['odds', 'Odds']]
    : [['center', g?.status === 'final' ? 'Recap' : 'Game center'], ['plays', 'Play-by-play'], ['box', 'Box score']];
  const valid = tabs.some(([k]) => k === tabSel);
  const tab: Tab = valid && tabSel ? tabSel : pre ? 'preview' : 'center';

  return (
    <div className="app">
      <div className="top">
        <OfflineBanner online={online} stale={q.stale} updatedAt={q.updatedAt} retry={q.refresh} />
        <TopBar fallback={href.games} backLabel="Back to all games" right={g?.status === 'final' ? <ShareButton g={g} /> : undefined} />
        {g && <GameHeader g={g} standings={st.data} stale={stale} />}
        {!g && <div className="cb-mid"><span className="ttl">Game</span></div>}
      </div>
      {g && g.status === 'live' && situationText(g) && (
        <div className="gsit"><b>{situationText(g)}</b>{g.lastPlay && <p>Last play: {g.lastPlay}</p>}</div>
      )}
      {g && (
        <nav className="gtabs" role="tablist" aria-label="Game sections">
          {tabs.map(([k, label]) => k === 'plays'
            ? <a key={k} role="tab" aria-selected="false" href={href.plays(g.id)}>{label}</a>
            : <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{label}</button>)}
        </nav>
      )}

      {!g && q.error && <main className="page"><ErrorCard error={q.error} retry={q.refresh} /></main>}
      {!g && !q.error && <Skeleton />}

      {g && (
        <main className="page tight">
          {pre && tab === 'preview' && <Pregame g={g} standings={st.data} stale={stale} onLineups={() => setTab('lineups')} />}
          {pre && tab === 'lineups' && <Lineups g={g} />}
          {pre && tab === 'injuries' && <Card title="Injury report"><InjuryRows list={g.injuries} /></Card>}
          {pre && tab === 'odds' && <>{!stale && <BetCard g={g} />}{!stale && <ChanceCard g={g} />}</>}
          {g.status === 'live' && tab === 'center' && <Live g={g} stale={stale} />}
          {g.status === 'halftime' && tab === 'center' && <Halftime g={g} stale={stale} />}
          {g.status === 'final' && tab === 'center' && <Final g={g} />}
          {!pre && tab === 'box' && <BoxScore g={g} standings={st.data} />}
          {q.updatedAt && <p className="updated">Updated {new Date(q.updatedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' })}</p>}
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

function GameHeader({ g, standings, stale }: { g: GameDetail; standings: Standing[] | null; stale: boolean }) {
  const as = g.away.score ?? 0, hs = g.home.score ?? 0;
  const pre = g.status === 'scheduled' || g.status === 'postponed';
  const final = g.status === 'final';
  const winner = final ? (as > hs ? 'away' : hs > as ? 'home' : null) : null;
  const rec = (abbr: string, fb?: string) => {
    const s = standings?.find((x) => x.team === abbr);
    return s ? record(s.w, s.l, s.t) : fb ?? '';
  };
  const where = [g.venue?.city, g.venue?.state].filter(Boolean).join(', ');
  const q = g.quarter && g.quarter >= 5 ? 'OT' : ['1ST', '2ND', '3RD', '4TH'][(g.quarter ?? 1) - 1];
  const side = (s: 'away' | 'home') => {
    const t = team(g[s].abbr);
    const r = rec(t.abbr, g[s].record);
    return (
      <a href={href.team(t.abbr)} className="gh-side" aria-label={`${t.city} ${t.name}${r ? `, ${r}` : ''}`}>
        <Badge abbr={t.abbr} size={56} />
        <small>{t.city}</small>
        <b>{t.name}</b>
        <span className="rec">{r ? `${r} · ` : ''}{s === 'home' ? 'Home' : 'Away'}</span>
        {g.status === 'live' && g.possession === s && <span className="hb"><i />HAS THE BALL</span>}
        {winner === s && <span className="won">WON</span>}
        {g.status === 'live' && g[s].timeouts != null && (
          <span className="timeouts" aria-label={`${g[s].timeouts} timeouts left`}>
            {[0, 1, 2].map((n) => <span key={n} className={n < g[s].timeouts! ? 'on' : ''} />)}
          </span>
        )}
      </a>
    );
  };
  const t = clockTime(g.kickoff);
  const day = new Date(g.kickoff).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'America/New_York' }).toUpperCase();
  return (
    <>
      <div className="gh-meta"><span>Week {g.week}{where ? ` · ${where}` : ''}</span></div>
      <div className="gh">
        {side('away')}
        {pre ? (
          <div className="gh-mid" aria-label={`Kickoff ${day} at ${t} Eastern`}>
            <span className="day">{day}</span>
            <span className="time">{g.status === 'postponed' ? 'TBD' : t}</span>
            <span className="cap">{g.status === 'postponed' ? 'POSTPONED' : 'KICKOFF · ET'}</span>
          </div>
        ) : (
          <div className="gh-mid" aria-label={`${teamName(g.away.abbr)} ${as}, ${teamName(g.home.abbr)} ${hs}, ${liveStatus(g)}`}>
            <span className="score"><span className={final && as < hs ? 'lo' : ''}>{as}</span><i>–</i><span className={final && hs < as ? 'lo' : ''}>{hs}</span></span>
            {final ? <span className="st done">{g.overtime ? 'FINAL · OT' : 'FINAL'}</span>
              : g.status === 'halftime' ? <span className="st"><span className="lv-pill">HALF</span>HALFTIME</span>
              : <span className="st"><span className="lv-pill">LIVE</span>{q} · {g.clock ?? ''}{stale ? ' · PAUSED' : ''}</span>}
          </div>
        )}
        {side('home')}
      </div>
      <WatchOn tv={g.tv} label={final ? 'Aired on' : 'Watch on'} dark big style={{ margin: '14px 16px 16px' }} />
      {!g.tv && <div style={{ height: 16 }} />}
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

/** Implied chance from an American moneyline. */
const implied = (ml: number | null | undefined) => (ml == null ? null : ml < 0 ? -ml / (-ml + 100) : 100 / (ml + 100));

function BetCard({ g, live = false }: { g: GameDetail; live?: boolean }) {
  const o = g.odds;
  if (!o || (o.spread == null && o.total == null && o.homeMoneyline == null)) return <PadCard title="Betting line"><span className="sub">No betting line yet.</span></PadCard>;
  const fav = o.spread == null || o.spread === 0 ? null : o.spread < 0 ? g.home.abbr : g.away.abbr;
  const spread = o.spread == null ? '–' : o.spread === 0 ? 'Even matchup' : `${teamName(fav!)} by ${Math.abs(o.spread)} ${Math.abs(o.spread) === 1 ? 'point' : 'points'}`;
  const rows = ([['away', o.awayMoneyline], ['home', o.homeMoneyline]] as const);
  return (
    <PadCard title={live ? 'Current betting line' : 'Betting line'}>
      <div className="bet2">
        <div><small>POINT SPREAD</small><b>{spread}</b></div>
        <div><small>TOTAL POINTS (O/U)</small><b>{o.total ?? '–'}</b></div>
      </div>
      {(o.homeMoneyline != null || o.awayMoneyline != null) && (
        <div role="table" aria-label="Moneyline">
          <div className="mltab-h" role="row"><span>TEAM</span><span>MONEYLINE</span><span>CHANCE</span></div>
          {rows.map(([side, ml]) => (
            <div className="mltab-r" role="row" key={side}>
              <span><Badge abbr={g[side].abbr} size={24} />{teamName(g[side].abbr)}</span>
              <span>{moneyline(ml)}</span>
              <span>{implied(ml) != null ? `${Math.round(implied(ml)! * 100)}%` : '–'}</span>
            </div>
          ))}
        </div>
      )}
      <span className="note">For information only. Lines change. 21+. Gambling problem? Call 1-800-GAMBLER.</span>
    </PadCard>
  );
}

function ChanceCard({ g, note }: { g: GameDetail; note?: string }) {
  const hp = g.homeWinProb ?? g.pregameHomeWinProb;
  if (hp == null) return null;
  return (
    <PadCard title="Chance to win">
      <WinNums g={g} homeProb={hp} />
      <span className="note">{note ?? 'Based on the betting line. Updates after every play once the game starts.'}</span>
    </PadCard>
  );
}

function WeatherCard({ g, title = 'Weather at kickoff' }: { g: GameDetail; title?: string }) {
  const w = g.weather;
  if (!w) return null;
  if (w.dome) return <PadCard title={title}><div className="wx-top"><span className="go" style={{ width: 48, height: 48 }}><Icon name="where" size={24} /></span><span><strong>Indoors</strong><span className="sub" style={{ display: 'block' }}>Roof closed, so weather has no effect.</span></span></div></PadCard>;
  const windy = (w.windMph ?? 0) >= 18;
  const wet = (w.precipPct ?? 0) >= 40;
  const note = windy ? 'Strong wind may affect kicks and deep passes.' : wet ? 'Rain is likely: watch for fumbles.' : 'Good conditions for football.';
  const cond = w.description ? w.description.charAt(0).toUpperCase() + w.description.slice(1) : windy ? 'Windy' : '–';
  return (
    <PadCard title={title}>
      <div className="wx-top"><b>{w.tempF != null ? `${Math.round(w.tempF)}°` : '–'}</b><span><strong>{cond}</strong><span className="sub" style={{ display: 'block' }}>{note}</span></span></div>
      <div className="wx3">
        <div><Icon name="wind" size={18} /><span>Wind</span><b>{w.windMph != null ? `${Math.round(w.windMph)} mph${w.windDir ? ` ${w.windDir}` : ''}` : '–'}</b></div>
        <div><Icon name="drop" size={18} /><span>Rain</span><b>{w.precipPct != null ? `${w.precipPct}%` : '–'}</b></div>
        <div><Icon name="temp" size={18} /><span>Temp</span><b>{w.tempF != null ? `${Math.round(w.tempF)}°F` : '–'}</b></div>
      </div>
    </PadCard>
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
    <button className="sq-btn" onClick={onClick} aria-label={done ? 'Link copied' : 'Share this result'} title={done ? 'Link copied' : 'Share'}>
      {done ? <span style={{ fontSize: 9, fontWeight: 800 }}>COPIED</span> : <Icon name="share" />}
    </button>
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

function previewText(g: GameDetail, standings: Standing[] | null): string {
  const rec = (abbr: string, fb?: string) => {
    const s = standings?.find((x) => x.team === abbr);
    return s ? record(s.w, s.l, s.t) : fb;
  };
  const a = team(g.away.abbr), h = team(g.home.abbr);
  const ar = rec(a.abbr, g.away.record), hr = rec(h.abbr, g.home.record);
  let t = `${a.city}${ar ? ` (${ar})` : ''} visits ${h.city}${hr ? ` (${hr})` : ''}.`;
  const o = g.odds;
  if (o?.spread != null && o.spread !== 0) {
    const fav = o.spread < 0 ? h : a;
    t += ` ${fav.name} are ${Math.abs(o.spread)}-point favorites${o.total != null ? `, with ${o.total} total points expected` : ''}.`;
  } else if (o?.total != null) t += ` ${o.total} total points expected.`;
  return t;
}

function Pregame({ g, standings, stale, onLineups }: { g: GameDetail; standings: Standing[] | null; stale: boolean; onLineups: () => void }) {
  const now = useNow(1_000);
  const venue = [g.venue?.name, [g.venue?.city, g.venue?.state].filter(Boolean).join(', ')].filter(Boolean).join(' · ');
  const day = new Date(g.kickoff).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'America/New_York' });
  const hasLineups = g.lineups.away.length > 0 || g.lineups.home.length > 0;
  return (
    <>
      {g.status === 'postponed' && <div className="alert"><b>Postponed</b><span className="sub">A new kickoff time hasn't been announced yet.</span></div>}
      <section className="callout-m" aria-label="Game preview"><small>Game preview</small><p>{previewText(g, standings)}</p></section>

      {g.status !== 'postponed' && (
        <PadCard title="Kickoff">
          <Countdown3 iso={g.kickoff} now={now} />
          <div className="kv"><span>Date</span><b>{day}, {kickoffTime(g.kickoff)}</b></div>
          {venue && <div className="kv"><span>Venue</span><b>{venue}{g.weather ? (g.weather.dome ? ' · indoors' : ' · outdoors') : ''}</b></div>}
          <WatchOn tv={g.tv} big />
        </PadCard>
      )}

      <PadCard title="Expected starters" right={hasLineups ? <button className="link" style={{ background: 'none', border: 0, padding: 0 }} onClick={onLineups}>Full lineups</button> : undefined}>
        {hasLineups ? (['away', 'home'] as const).map((side) => (
          <div key={side}>
            <div className="lu-team"><Badge abbr={g[side].abbr} size={24} />{teamName(g[side].abbr)}</div>
            {g.lineups[side].slice(0, 8).map((p, i) => (
              <div className="lu-row" key={`${p.pos}-${i}`} style={i === 0 ? { background: '#FFF6F0' } : undefined}>
                <span className="p">{p.pos}</span><span>{p.name}</span>
                {p.status ? <span className={`status-pill ${injuryClass(p.status)}`}>{injuryWords(p.status)}</span> : <span />}
              </div>
            ))}
          </div>
        )) : <span className="sub">Lineups aren't available from our data provider yet. They usually appear a few days before kickoff and are confirmed about 90 minutes before.</span>}
      </PadCard>

      <Card title="Injury report"><InjuryRows list={g.injuries} /></Card>
      <RecentCard g={g} standings={standings} />
      {!stale && <ChanceCard g={g} />}
      {!stale && <BetCard g={g} />}
      <WeatherCard g={g} />
    </>
  );
}

function RecentCard({ g, standings }: { g: GameDetail; standings: Standing[] | null }) {
  const rows = (['away', 'home'] as const).map((side) => ({ side, s: standings?.find((x) => x.team === g[side].abbr) })).filter((r) => r.s);
  if (!rows.length) return null;
  return (
    <Card title="Recent results">
      <div style={{ padding: '0 16px 4px' }}>
        {rows.map(({ side, s }) => (
          <div className="recent" key={side}>
            <div className="hd"><Badge abbr={g[side].abbr} size={24} /><b>{teamName(g[side].abbr)}</b><em>{record(s!.w, s!.l, s!.t)}</em><FormBoxes s={s} /></div>
            <span className="sub">{streakText(s!.streak)} · {s!.pf} points scored, {s!.pa} allowed</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function Lineups({ g }: { g: GameDetail }) {
  return (
    <>
      <section className="callout-m"><small>Lineups</small><p>Expected starters from each team's depth chart. Final lineups post about 90 minutes before kickoff.</p></section>
      {(['away', 'home'] as const).map((side) => (
        <PadCard key={side} title={`${team(g[side].abbr).city} ${team(g[side].abbr).name}`}>
          {g.lineups[side].length ? g.lineups[side].map((p, i) => (
            <div className="lu-row" key={`${p.pos}-${i}`}>
              <span className="p">{p.pos}</span><span>{p.name}<span className="sub" style={{ display: 'block', fontSize: 13 }}>{posWords(p.pos)}</span></span>
              {p.status ? <span className={`status-pill ${injuryClass(p.status)}`}>{injuryWords(p.status)}</span> : <span />}
            </div>
          )) : <span className="sub">Not available yet. Lineups usually appear a few days before kickoff.</span>}
        </PadCard>
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Live
// ---------------------------------------------------------------------------

function Live({ g, stale }: { g: GameDetail; stale: boolean }) {
  const s = g.situation;
  const deltas = wpDeltas(g.plays, g.pregameHomeWinProb);
  const hp = g.homeWinProb ?? 0.5;
  const pre = g.pregameHomeWinProb;
  const sentence = plainSituation(g);
  return (
    <>
      <PadCard title="What's happening">
        {sentence && <p style={{ fontSize: 18, lineHeight: 1.45, fontWeight: 600 }}>{sentence}</p>}
        {g.possession && <Field g={g} />}
        {s?.drivePlays != null && (
          <div className="drivestats" aria-label={`This drive: ${s.drivePlays} plays, ${s.driveYards ?? 0} yards, ${s.driveTime ?? ''}`}>
            <div><b>{s.drivePlays}</b><span>PLAYS</span></div>
            <div><b>{s.driveYards ?? 0}</b><span>YARDS</span></div>
            <div><b>{s.driveTime ?? '–'}</b><span>DRIVE TIME</span></div>
          </div>
        )}
      </PadCard>

      {g.summary && <section className="callout-m" aria-label="The story so far"><small>The story so far</small><p>{g.summary}</p></section>}

      <Card title="Latest plays" right={<a href={href.plays(g.id)}>Every play</a>}>
        {g.plays.length ? g.plays.slice(0, 6).map((p) => <PlayRow key={p.id} p={p} delta={stale ? undefined : deltas.get(p.id)} />) : <p className="empty">Plays will appear here.</p>}
      </Card>

      {stale ? (
        <PadCard title="Chance to win"><span className="sub">Back when you're online. We hide it so you never see an out-of-date number as if it were live.</span></PadCard>
      ) : (
        <>
          <ChanceCard g={g} note={`Updates after every play.${pre != null ? ` Before kickoff: ${pre >= 0.5 ? teamName(g.home.abbr) : teamName(g.away.abbr)} ${Math.round(Math.max(pre, 1 - pre) * 100)}%.` : ''}`} />
          <PadCard title="Win probability over time">
            <WPChart series={g.winProbSeries} g={g} />
            <span className="note">Above the line: {teamName(g.home.abbr)} more likely to win. Below: {teamName(g.away.abbr)}. Now {hp >= 0.5 ? teamName(g.home.abbr) : teamName(g.away.abbr)} {Math.round(Math.max(hp, 1 - hp) * 100)}%.</span>
          </PadCard>
        </>
      )}
      <PlayerCard g={g} title="Player stats" count={6} />
      {!stale && <BetCard g={g} live />}
      <WeatherCard g={g} />
    </>
  );
}

function BoxScore({ g, standings }: { g: GameDetail; standings: Standing[] | null }) {
  return (
    <>
      <PadCard title="Scoring by quarter"><LineScore g={g} half={g.status === 'halftime'} /></PadCard>
      <TeamStats g={g} />
      <PlayerCard g={g} title="Player stats" count={10} />
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
      {!stale && <BetCard g={g} live />}
      <WeatherCard g={g} />
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
