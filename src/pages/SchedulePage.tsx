import { useState } from 'react';
import type { Game } from '../shared/types';
import { data } from '../data/source';
import { cached, useOnline, usePoll } from '../data/usePoll';
import { href } from '../data/router';
import { clockTime, etDateKey, kickoffDay } from '../shared/format';
import { Badge, CenterBar, ErrorCard, Footer, Icon, Nav, OfflineBanner, Skeleton, teamName } from '../ui/parts';
import { favoredText } from '../ui/GameRow';

const ET = 'America/New_York';
const mon = (ms: number) => new Date(ms).toLocaleDateString('en-US', { month: 'short', timeZone: ET });
const dayN = (ms: number) => Number(new Date(ms).toLocaleDateString('en-US', { day: 'numeric', timeZone: ET }));
const DAY = 86_400_000;

function rangeText(startMs: number, endMs: number) {
  return mon(startMs) === mon(endMs) ? `${mon(startMs)} ${dayN(startMs)} – ${dayN(endMs)}` : `${mon(startMs)} ${dayN(startMs)} – ${mon(endMs)} ${dayN(endMs)}`;
}

export function SchedulePage() {
  const online = useOnline();
  const sbq = usePoll(() => cached('sb-week', () => data.scoreboard(), 60_000), 0, []);
  const current = sbq.data?.week;
  const first = current != null ? current + 1 : undefined;
  const [picked, setPicked] = useState<number | null>(null);
  const week = picked ?? first;

  // Base dates come from next week's schedule; later weeks step forward 7 days at a time.
  const baseQ = usePoll(() => (first ? cached(`schedule-${first}`, () => data.schedule(first), 10 * 60_000) : Promise.resolve(null)), 0, [first]);
  const q = usePoll(() => (week ? cached(`schedule-${week}`, () => data.schedule(week), 10 * 60_000) : Promise.resolve(null)), 10 * 60_000, [week]);
  const st = usePoll(() => cached('standings', () => data.standings()), 0, []);
  const sc = q.data;

  const lastWeek = Math.max(18, ...(baseQ.data?.weeks ?? []).filter((w) => w <= 18));
  const weeks = first ? Array.from({ length: Math.max(1, lastWeek - first + 1) }, (_, i) => first + i) : [];
  const baseStart = baseQ.data?.games.length ? Math.min(...baseQ.data.games.map((g) => Date.parse(g.kickoff))) : null;
  const weekRange = (n: number) => {
    if (n === week && sc?.games.length) {
      const ks = sc.games.map((g) => Date.parse(g.kickoff));
      return rangeText(Math.min(...ks), Math.max(...ks));
    }
    if (baseStart == null || !first) return '';
    const s = baseStart + (n - first) * 7 * DAY;
    return rangeText(s, s + 4 * DAY);
  };
  const when = (n: number) => (first ? (n === first ? 'Next week' : `In ${n - first + 1} weeks`) : '');

  const byDay = new Map<string, Game[]>();
  for (const g of (sc?.games ?? []).slice().sort((a, b) => a.kickoff.localeCompare(b.kickoff))) {
    const k = etDateKey(g.kickoff);
    byDay.set(k, [...(byDay.get(k) ?? []), g]);
  }
  const days = [...byDay.values()];
  const total = sc?.games.length ?? 0;
  const rec = (abbr: string, fb?: string) => {
    const s = st.data?.find((x) => x.team === abbr);
    return s ? `${s.w}–${s.l}${s.t ? `–${s.t}` : ''}` : fb?.replace('-', '–') ?? '';
  };

  return (
    <div className="app">
      <header className="top" style={{ paddingBottom: 22 }}>
        <OfflineBanner online={online} stale={q.stale} updatedAt={q.updatedAt} retry={q.refresh} />
        <CenterBar fallback={href.games} backLabel="Back to all games">
          <span className="ttl" style={{ fontSize: 26, whiteSpace: 'nowrap' }}>Upcoming games</span>
        </CenterBar>
        {weeks.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
            <span className="pickweek">PICK A WEEK</span>
            <div className="tickets-wrap">
              <div className="tickets" role="tablist" aria-label="Choose a week">
                {weeks.map((n) => (
                  <button key={n} className="ticket" role="tab" aria-selected={n === week} onClick={() => setPicked(n)}>
                    <span className="top1"><small>WEEK</small><b>{n}</b></span>
                    <span className="perf" aria-hidden="true" />
                    <span className="notch a" aria-hidden="true" /><span className="notch b" aria-hidden="true" />
                    <span className="bot"><b>{weekRange(n)}</b><span>{when(n)}</span></span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
        <p className="sub" style={{ padding: '12px 20px 0', fontSize: 15, color: '#E4E0F2' }}>All times are Eastern. Tap a game for lineups and injuries.</p>
      </header>

      {!sc && q.error && <main className="page"><ErrorCard error={q.error} retry={q.refresh} /></main>}
      {!sc && !q.error && <Skeleton />}

      {sc && week && (
        <main className="page" style={{ gap: 22 }}>
          <div className="wk-title">
            <h2>Week {week} games</h2>
            <span style={{ fontSize: 17, color: 'var(--text3)' }}><b style={{ color: 'var(--text)' }}>{weekRange(week)}</b> · {when(week)} · {total} {total === 1 ? 'game' : 'games'}</span>
          </div>
          {!days.length && <p className="sub">No games scheduled for this week.</p>}
          {days.map((games) => (
            <section key={games[0].id} aria-label={kickoffDay(games[0].kickoff)} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <h3 className="sec-title" style={{ fontSize: 24, margin: 0 }}>{kickoffDay(games[0].kickoff)}</h3>
                <span className="sub">{games.length} {games.length === 1 ? 'game' : 'games'}</span>
              </div>
              <div className="card">
                {games.map((g) => <ScheduleRow key={g.id} g={g} rec={rec} />)}
              </div>
            </section>
          ))}
          <Footer />
        </main>
      )}
      <Nav active="games" />
    </div>
  );
}

function ScheduleRow({ g, rec }: { g: Game; rec: (abbr: string, fb?: string) => string }) {
  const t = clockTime(g.kickoff);
  const w = g.weather;
  const temp = w ? (w.dome ? 'Indoors' : w.tempF != null ? `${Math.round(w.tempF)}°F` : null) : null;
  const cond = w ? (w.dome ? 'Roof closed' : w.description ?? (w.windMph != null ? `Wind ${Math.round(w.windMph)} mph` : null)) : null;
  const fav = favoredText(g);
  return (
    <a className="srow" href={href.game(g.id)} aria-label={`${teamName(g.away.abbr, true)} at ${teamName(g.home.abbr, true)}, ${t}`}>
      <span style={{ paddingTop: 2, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
        <span className="tm"><b>{t.replace(/ [AP]M$/, '')}</b><span>{t.slice(-2)}</span></span>
        {temp && <span className="wx" style={{ width: '100%', boxSizing: 'border-box' }}><b>{temp}</b>{cond && <span>{cond.charAt(0).toUpperCase() + cond.slice(1)}</span>}</span>}
      </span>
      <span className="teams">
        {(['away', 'home'] as const).map((s) => (
          <span className="tl" key={s}>
            <Badge abbr={g[s].abbr} size={30} />
            <span className="nm">{teamName(g[s].abbr)}</span>
            <span className="rc">{rec(g[s].abbr, g[s].record)}</span>
          </span>
        ))}
        {fav && <span className="fav"><Icon name="trend" size={16} stroke={2.4} />{fav}</span>}
      </span>
    </a>
  );
}
