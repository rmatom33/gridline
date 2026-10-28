import { useState } from 'react';
import { data } from '../data/source';
import { useOnline, usePoll } from '../data/usePoll';
import { href } from '../data/router';
import { groupDrives, wpDeltas, type Drive } from '../shared/drives';
import { Badge, CenterBar, ErrorCard, Icon, Nav, OfflineBanner, Skeleton, teamName } from '../ui/parts';
import { liveStatus } from '../ui/GameRow';
import { PlayRow } from './GamePage';

type Filter = 'all' | 'scoring' | 'turnovers' | 'away' | 'home';
const QNAME = ['1st quarter', '2nd quarter', '3rd quarter', '4th quarter', 'Overtime'];

export function PlaysPage({ id }: { id: string }) {
  const online = useOnline();
  const q = usePoll(() => data.game(id), (g) => (g && (g.status === 'live' || g.status === 'halftime') ? 8_000 : 0), [id]);
  const [filter, setFilter] = useState<Filter>('all');
  const [open, setOpen] = useState<Record<number, boolean>>({});
  const g = q.data;

  const drives = g ? groupDrives(g.plays, g.status === 'live') : [];
  const deltas = g ? wpDeltas(g.plays, g.pregameHomeWinProb) : new Map<string, number>();
  const keep = (d: Drive): Drive | null => {
    if (!g) return null;
    if (filter === 'away' || filter === 'home') return d.team === g[filter].abbr ? d : null;
    if (filter === 'all') return d;
    const plays = d.plays.filter((p) => (filter === 'scoring' ? p.kind === 'score' : p.kind === 'turnover'));
    return plays.length ? { ...d, plays } : null;
  };
  const shown = drives.map(keep).filter((d): d is Drive => !!d);
  const quarters = [...new Set(shown.map((d) => Math.min(d.quarter, 5)))].sort((a, b) => b - a);
  const latestQ = quarters[0];

  const filters: [Filter, string][] = g ? [['all', 'All plays'], ['scoring', 'Scores'], ['turnovers', 'Turnovers'], ['away', g.away.abbr], ['home', g.home.abbr]] : [];

  return (
    <div className="app">
      <div className="top">
        <OfflineBanner online={online} stale={q.stale} updatedAt={q.updatedAt} retry={q.refresh} />
        <CenterBar fallback={href.game(id)} backLabel="Back to game">
          <span className="ttl">Every play</span>
          {g && <span style={{ marginTop: 8, fontSize: 18, fontWeight: 800, whiteSpace: 'nowrap' }}>{teamName(g.away.abbr)} {g.away.score ?? 0} · {teamName(g.home.abbr)} {g.home.score ?? 0}</span>}
          {g && <span className="gpill" style={{ marginTop: 8, background: 'var(--navy2)', color: '#E4E0F2' }}>{(g.status === 'live' || g.status === 'halftime') && <span className="dot" style={{ background: '#F97316' }} />}{liveStatus(g)}</span>}
        </CenterBar>
        <div style={{ height: 14 }} />
        {g && (
          <div className="pills" role="group" aria-label="Filter plays">
            {filters.map(([k, label]) => <button key={k} aria-pressed={filter === k} onClick={() => setFilter(k)}>{label}</button>)}
          </div>
        )}
      </div>

      {!g && q.error && <main className="page"><ErrorCard error={q.error} retry={q.refresh} /></main>}
      {!g && !q.error && <Skeleton />}

      {g && (
        <main className="page tight">
          {!shown.length && <p className="empty">{g.plays.length ? 'No plays match this filter.' : 'Plays will appear once the game starts.'}</p>}
          {quarters.map((qn) => {
            const qDrives = shown.filter((d) => Math.min(d.quarter, 5) === qn);
            const expanded = qn === latestQ || open[qn] || filter !== 'all';
            if (!expanded) {
              return (
                <button key={qn} className="expander" onClick={() => setOpen({ ...open, [qn]: true })} aria-expanded="false">
                  <span>{QNAME[qn - 1]} · {qDrives.length} drive{qDrives.length === 1 ? '' : 's'}</span>
                  <Icon name="down" size={18} />
                </button>
              );
            }
            return (
              <div key={qn} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="q-head">{QNAME[qn - 1]}</div>
                {qDrives.map((d) => (
                  <section className="card" key={d.key} aria-label={`${teamName(d.team)} drive: ${d.result}`}>
                    <div className="drive-head">
                      <Badge abbr={d.team} size={30} />
                      <span className="what">
                        <b style={{ color: d.scoring ? 'var(--accent)' : undefined }}>{d.result}</b>
                        <span>{d.playCount} play{d.playCount === 1 ? '' : 's'} · {d.yards} yds · {d.time}</span>
                      </span>
                    </div>
                    {d.plays.slice().reverse().map((p) => <PlayRow key={p.id} p={p} delta={q.stale ? undefined : deltas.get(p.id)} />)}
                  </section>
                ))}
              </div>
            );
          })}
          {shown.length > 0 && <p className="note fine">The right column shows how each play moved {teamName(g.home.abbr, true)}' chance to win, in percentage points.</p>}
        </main>
      )}
      <Nav active="games" />
    </div>
  );
}
