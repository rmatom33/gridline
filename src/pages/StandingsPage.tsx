import { useState } from 'react';
import type { Standing } from '../shared/types';
import { data } from '../data/source';
import { cached, useOnline, usePoll } from '../data/usePoll';
import { href } from '../data/router';
import { TEAMS } from '../shared/teams';
import { record } from '../shared/format';
import { winPct } from '../shared/teamdetail';
import { Badge, ErrorCard, Footer, Nav, OfflineBanner, Skeleton, teamName, TopBar } from '../ui/parts';

const DIVS = ['East', 'North', 'South', 'West'] as const;
const byRecord = (a: Standing, b: Standing) => winPct(b) - winPct(a) || (b.pf - b.pa) - (a.pf - a.pa);
const pctText = (s: Standing) => winPct(s).toFixed(3).replace(/^0/, '');
const diff = (s: Standing) => s.pf - s.pa;

export function StandingsPage({ conf: initial }: { conf?: 'AFC' | 'NFC' }) {
  const online = useOnline();
  const [conf, setConf] = useState<'AFC' | 'NFC'>(initial ?? 'AFC');
  const [view, setView] = useState<'division' | 'playoffs'>('division');
  const q = usePoll(() => cached('standings', () => data.standings(), 60_000), 5 * 60_000, []);
  const sbq = usePoll(() => cached('sb-week', () => data.scoreboard(), 60_000), 0, []);
  const rows = q.data ?? [];
  const inConf = rows.filter((s) => TEAMS[s.team]?.conf === conf);
  const league = rows.slice().sort(byRecord);
  const rank = (abbr: string) => league.findIndex((s) => s.team === abbr) + 1;
  const season = sbq.data?.season ?? new Date().getFullYear();

  return (
    <div className="app">
      <header className="top">
        <OfflineBanner online={online} stale={q.stale} updatedAt={q.updatedAt} retry={q.refresh} />
        <TopBar />
        <div className="mhero">
          <span className="over">{season} season</span>
          <h1>Standings</h1>
        </div>
        {/* One row of four pills that always fits the screen width. */}
        <div className="stbar">
          <div role="tablist" aria-label="Conference">
            {(['AFC', 'NFC'] as const).map((c) => <button key={c} role="tab" aria-selected={conf === c} onClick={() => setConf(c)}>{c}</button>)}
          </div>
          <div className="vw" role="tablist" aria-label="View">
            <button role="tab" aria-selected={view === 'division'} onClick={() => setView('division')}>Divisions</button>
            <button role="tab" aria-selected={view === 'playoffs'} onClick={() => setView('playoffs')}>Playoff race</button>
          </div>
        </div>
      </header>

      {!q.data && q.error && <main className="page"><ErrorCard error={q.error} retry={q.refresh} /></main>}
      {!q.data && !q.error && <Skeleton />}

      {q.data && (
        <main className="page">
          {view === 'division' && DIVS.map((div) => (
            <Table key={div} title={`${conf} ${div}`} teams={inConf.filter((s) => TEAMS[s.team].div === div).sort(byRecord)} rank={rank} />
          ))}
          {view === 'playoffs' && (() => {
            const seeded = inConf.filter((s) => s.seed).sort((a, b) => (a.seed ?? 0) - (b.seed ?? 0));
            const rest = inConf.filter((s) => !s.seed).sort(byRecord);
            return (
              <>
                <Table title={`${conf} playoff picture`} teams={seeded} rank={rank} split={4} />
                <Table title="Chasing a place" teams={rest} rank={rank} />
              </>
            );
          })()}
          <p className="byes">Rank = league-wide ranking by record, then point difference. The green bar and number mark a playoff seed.</p>
          <p className="footer-note fine">Seeds use a simplified tiebreak (record, then point differential), so they can differ from the official NFL order in close races.</p>
          <Footer odds={false} />
        </main>
      )}
      <Nav active="standings" />
    </div>
  );
}

function Table({ title, teams, rank, split }: { title: string; teams: Standing[]; rank: (abbr: string) => number; split?: number }) {
  return (
    <section className="card" aria-label={title}>
      <div className="card-head"><span className="card-title">{title}</span></div>
      <div className="stt-head" aria-hidden="true"><span>TEAM</span><span>W</span><span>L</span><span>PCT</span><span>DIFF</span></div>
      {teams.map((s, i) => {
        const d = diff(s);
        return (
          <div key={s.team}>
            {split != null && i === 0 && <div className="stt-sub">DIVISION LEADERS · SEEDS 1–{split}</div>}
            {split != null && i === split && <div className="stt-sub">WILD CARDS · SEEDS {split + 1}–7</div>}
            <a className={`stt-row${s.seed ? ' seeded' : ''}`} href={href.team(s.team)}
              aria-label={`${teamName(s.team, true)}, ${record(s.w, s.l, s.t)}, point difference ${d}${s.seed ? `, playoff seed ${s.seed}` : ''}`}>
              <span className="tm">
                <span className="rk">{rank(s.team)}</span>
                <Badge abbr={s.team} size={26} />
                <b>{teamName(s.team, true)}</b>
                {s.seed ? <span className="sd">{s.seed}</span> : null}
              </span>
              <span>{s.w}</span>
              <span>{s.l}{s.t ? `-${s.t}` : ''}</span>
              <span>{pctText(s)}</span>
              <span className={d > 0 ? 'pos' : d < 0 ? 'neg' : ''}>{d > 0 ? `+${d}` : d}</span>
            </a>
          </div>
        );
      })}
      {!teams.length && <p className="empty">No teams.</p>}
    </section>
  );
}
