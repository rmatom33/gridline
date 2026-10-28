import { useState } from 'react';
import type { Standing } from '../shared/types';
import { data } from '../data/source';
import { cached, useOnline, usePoll } from '../data/usePoll';
import { href } from '../data/router';
import { TEAMS } from '../shared/teams';
import { record } from '../shared/format';
import { winPct } from '../shared/teamdetail';
import { Badge, ErrorCard, Footer, FormDots, Nav, OfflineBanner, SampleBadge, Skeleton, teamName, WeekChip } from '../ui/parts';

const DIVS = ['East', 'North', 'South', 'West'] as const;
const byRecord = (a: Standing, b: Standing) => winPct(b) - winPct(a) || (b.pf - b.pa) - (a.pf - a.pa);

export function StandingsPage({ conf: initial }: { conf?: 'AFC' | 'NFC' }) {
  const online = useOnline();
  const [conf, setConf] = useState<'AFC' | 'NFC'>(initial ?? 'AFC');
  const [view, setView] = useState<'division' | 'playoffs'>('division');
  const q = usePoll(() => cached('standings', () => data.standings(), 60_000), 5 * 60_000, []);
  const sbq = usePoll(() => cached('sb-week', () => data.scoreboard(), 60_000), 0, []);
  const rows = q.data ?? [];
  const inConf = rows.filter((s) => TEAMS[s.team]?.conf === conf);
  const gamesPlayed = rows.length ? Math.max(...rows.map((s) => s.w + s.l + s.t)) : 0;
  const through = sbq.data ? (sbq.data.games.every((g) => g.status === 'final') ? sbq.data.week : sbq.data.week - 1) : gamesPlayed;

  return (
    <div className="app">
      <header className="top">
        <OfflineBanner online={online} stale={q.stale} updatedAt={q.updatedAt} retry={q.refresh} />
        <div className="top-row" style={{ paddingTop: 22 }}>
          <span className="title-lg" style={{ fontSize: 34 }}>Standings</span>
          <SampleBadge />
        </div>
        {through > 0 && <div style={{ padding: '0 20px 12px', display: 'flex' }}><WeekChip left={`WEEK ${through}`} right="Latest" /></div>}
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
                <Table title="Chasing a place" teams={rest} startPos={8} />
              </>
            );
          })()}

          <div className="legend">
            <span><span className="form"><i className="w" /></span>Win</span>
            <span><span className="form"><i className="l" /></span>Loss</span>
            <span>Last 5 games, oldest first</span>
            <span style={{ flexBasis: '100%' }}>PF = points scored · PA = points allowed</span>
          </div>
          <p className="footer-note fine">Seeds use a simplified tiebreak (record, then point differential), so they can differ from the official NFL order in close races.</p>
          <Footer odds={false} />
        </main>
      )}
      <Nav active="standings" />
    </div>
  );
}

function Table({ title, teams, sub, startPos = 1 }: { title: string; teams: Standing[]; sub?: [string, number, string]; startPos?: number }) {
  return (
    <section className="card" aria-label={title}>
      <div className="st-card-head"><span className="card-title">{title}</span><span>{teams.length} teams</span></div>
      {teams.map((s, i) => (
        <div key={s.team}>
          {sub && i === 0 && <div className="sub-head">{sub[0]}</div>}
          {sub && i === sub[1] && <div className="sub-head">{sub[2]}</div>}
          <a className={`strow ${i === 0 && !sub ? 'lead' : ''}`} href={href.team(s.team)} aria-label={`${teamName(s.team, true)}, ${record(s.w, s.l, s.t)}, ${s.pf} points scored, ${s.pa} allowed${s.seed ? `, playoff place ${s.seed}` : ''}`}>
            <span className="strow-top">
              <span className="pos">{sub ? s.seed ?? startPos + i : startPos + i}</span>
              <Badge abbr={s.team} size={38} />
              <span className="nm"><b>{teamName(s.team)}</b>{s.seed ? <span className="seedtx">Playoff seed {s.seed}</span> : null}</span>
              <span className="wl"><small>W–L</small><b>{record(s.w, s.l, s.t).replace(/-/g, '–')}</b></span>
            </span>
            <span className="stline">
              <span><small>LAST 5</small><FormDots s={s} /></span>
              <span className="c"><small>PF</small><b>{s.pf}</b></span>
              <span className="c"><small>PA</small><b>{s.pa}</b></span>
            </span>
          </a>
        </div>
      ))}
      {!teams.length && <p className="empty">No teams.</p>}
    </section>
  );
}
