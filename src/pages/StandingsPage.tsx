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

export function StandingsPage({ conf: initial }: { conf?: 'AFC' | 'NFC' }) {
  const online = useOnline();
  const [conf, setConf] = useState<'AFC' | 'NFC'>(initial ?? 'AFC');
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
        <div className="chero">
          <span className="wk-tag">Standings</span><span>{season} season</span>
        </div>
      </header>
      <nav className="gtabs" role="tablist" aria-label="Conference">
        {(['AFC', 'NFC'] as const).map((c) => <button key={c} role="tab" aria-selected={conf === c} onClick={() => setConf(c)}>{c}</button>)}
      </nav>

      {!q.data && q.error && <main className="page"><ErrorCard error={q.error} retry={q.refresh} /></main>}
      {!q.data && !q.error && <Skeleton />}

      {q.data && (
        <main className="page">
          {DIVS.map((div) => (
            <Table key={div} title={`${conf} ${div}`} teams={inConf.filter((s) => TEAMS[s.team].div === div).sort(byRecord)} rank={rank} />
          ))}
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
      <div className="stt-head" aria-hidden="true"><span /><span>W</span><span>L</span><span>PCT</span></div>
      {teams.map((s, i) => {
        return (
          <div key={s.team}>
            {split != null && i === 0 && <div className="stt-sub">DIVISION LEADERS · SEEDS 1–{split}</div>}
            {split != null && i === split && <div className="stt-sub">WILD CARDS · SEEDS {split + 1}–7</div>}
            <a className={`stt-row${s.seed ? ' seeded' : ''}`} href={href.team(s.team)}
              aria-label={`${teamName(s.team, true)}, ${record(s.w, s.l, s.t)}${s.seed ? `, playoff seed ${s.seed}` : ''}`}>
              <span className="tm">
                <span className="rk">{rank(s.team)}</span>
                <Badge abbr={s.team} size={26} />
                <b>{teamName(s.team, true)}</b>
                {s.seed ? <span className="sd">{s.seed}</span> : null}
              </span>
              <span>{s.w}</span>
              <span>{s.l}{s.t ? `-${s.t}` : ''}</span>
              <span>{pctText(s)}</span>
            </a>
          </div>
        );
      })}
      {!teams.length && <p className="empty">No teams.</p>}
    </section>
  );
}
