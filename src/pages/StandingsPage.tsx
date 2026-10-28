import { useState } from 'react';
import type { Standing } from '../shared/types';
import { data } from '../data/source';
import { cached, useOnline, usePoll } from '../data/usePoll';
import { href } from '../data/router';
import { TEAMS } from '../shared/teams';
import { record, streakText } from '../shared/format';
import { winPct } from '../shared/teamdetail';
import { Badge, ErrorCard, Footer, FormDots, Nav, OfflineBanner, SampleBadge, Skeleton, teamName, WeekChip } from '../ui/parts';

const DIVS = ['East', 'North', 'South', 'West'] as const;
const byRecord = (a: Standing, b: Standing) => winPct(b) - winPct(a) || (b.pf - b.pa) - (a.pf - a.pa);
const diff = (s: Standing) => s.pf - s.pa;
const fmt = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0');
const streakN = (s: Standing) => {
  const m = s.streak.match(/^([WL])(\d+)$/);
  return m ? (m[1] === 'W' ? 1 : -1) * Number(m[2]) : 0;
};

export function StandingsPage({ conf: initial }: { conf?: 'AFC' | 'NFC' }) {
  const online = useOnline();
  const [conf, setConf] = useState<'AFC' | 'NFC'>(initial ?? 'AFC');
  const [view, setView] = useState<'division' | 'playoffs'>('division');
  const q = usePoll(() => cached('standings', () => data.standings(), 60_000), 5 * 60_000, []);
  const sbq = usePoll(() => cached('sb-week', () => data.scoreboard(), 60_000), 0, []);
  const rows = q.data ?? [];
  const inConf = rows.filter((s) => TEAMS[s.team]?.conf === conf);
  const hot = rows.slice().sort((a, b) => streakN(b) - streakN(a) || diff(b) - diff(a))[0];
  const cold = rows.slice().sort((a, b) => streakN(a) - streakN(b) || diff(a) - diff(b))[0];
  const gamesPlayed = rows.length ? Math.max(...rows.map((s) => s.w + s.l + s.t)) : 0;
  const through = sbq.data ? (sbq.data.games.every((g) => g.status === 'final') ? sbq.data.week : sbq.data.week - 1) : gamesPlayed;

  return (
    <div className="app">
      <header className="top">
        <OfflineBanner online={online} stale={q.stale} updatedAt={q.updatedAt} retry={q.refresh} />
        <div className="top-row" style={{ paddingTop: 22, alignItems: 'flex-end' }}>
          <span className="title-lg" style={{ fontSize: 34 }}>Standings</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><SampleBadge />{through > 0 && <WeekChip left={`WEEK ${through}`} right="Latest" />}</span>
        </div>
        <div style={{ padding: '4px 20px 14px' }}>
          <div className="seg" role="tablist" aria-label="Conference" style={{ borderRadius: 28 }}>
            {(['AFC', 'NFC'] as const).map((c) => <button key={c} role="tab" aria-selected={conf === c} onClick={() => setConf(c)} style={{ height: 48, fontSize: 17 }}>{c}</button>)}
          </div>
        </div>
        <div className="viewbtns" role="tablist" aria-label="View">
          <button role="tab" aria-selected={view === 'division'} onClick={() => setView('division')}>By division</button>
          <button role="tab" aria-selected={view === 'playoffs'} onClick={() => setView('playoffs')}>Playoff race</button>
        </div>
      </header>

      {!q.data && q.error && <main className="page"><ErrorCard error={q.error} retry={q.refresh} /></main>}
      {!q.data && !q.error && <Skeleton />}

      {q.data && (
        <main className="page">
          {hot && cold && (
            <section className="hotcold" aria-label="Hot and cold streaks">
              <a href={href.team(hot.team)}>
                <span className="kicker" style={{ color: 'var(--accent)' }}>On a roll</span>
                <b>{hot.team} · {streakText(hot.streak)}</b>
                <span className="sub">{fmt(diff(hot))} point differential</span>
              </a>
              <a href={href.team(cold.team)}>
                <span className="kicker" style={{ color: 'var(--down)' }}>Struggling</span>
                <b>{cold.team} · {streakText(cold.streak)}</b>
                <span className="sub">{fmt(diff(cold))} point differential</span>
              </a>
            </section>
          )}

          {view === 'division' && DIVS.map((div) => {
            const teams = inConf.filter((s) => TEAMS[s.team].div === div).sort(byRecord);
            return <Table key={div} title={`${conf} ${div}`} teams={teams} />;
          })}

          {view === 'playoffs' && (() => {
            const seeded = inConf.filter((s) => s.seed).sort((a, b) => (a.seed ?? 0) - (b.seed ?? 0));
            const rest = inConf.filter((s) => !s.seed).sort(byRecord);
            return (
              <>
                <Table title={`${conf} playoff picture`} teams={seeded} sub={['DIVISION LEADERS · SEEDS 1–4', 4, 'WILD CARDS · SEEDS 5–7']} />
                <Table title="In the hunt" teams={rest} />
              </>
            );
          })()}

          <div className="legend">
            <span><span className="form"><i className="w" /></span>Win</span>
            <span><span className="form"><i className="l" /></span>Loss</span>
            <span><span className="seed">1</span>Current playoff seed</span>
          </div>
          <p className="footer-note fine">Seeds use a simplified tiebreak (record, then point differential), so they can differ from the official NFL order in close races.</p>
          <Footer odds={false} />
        </main>
      )}
      <Nav active="standings" />
    </div>
  );
}

function Table({ title, teams, sub }: { title: string; teams: Standing[]; sub?: [string, number, string] }) {
  return (
    <section className="card" aria-label={title}>
      <div className="st-head" role="row">
        <span>{title}</span><span>Record</span><span>Streak</span><span>Last 5</span>
      </div>
      {teams.map((s, i) => (
        <div key={s.team}>
          {sub && i === 0 && <div className="sub-head">{sub[0]}</div>}
          {sub && i === sub[1] && <div className="sub-head">{sub[2]}</div>}
          <a className="st-row" href={href.team(s.team)} aria-label={`${teamName(s.team, true)}, ${record(s.w, s.l, s.t)}${s.seed ? `, seed ${s.seed}` : ''}`}>
            <span className="tm"><Badge abbr={s.team} size={26} />{s.team}{s.seed ? <span className="seed">{s.seed}</span> : null}</span>
            <span className="num">{record(s.w, s.l, s.t)}</span>
            <span className="num">{s.streak}</span>
            <FormDots s={s} />
          </a>
        </div>
      ))}
      {!teams.length && <p className="empty">No teams.</p>}
    </section>
  );
}
