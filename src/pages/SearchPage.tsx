import { useEffect, useRef, useState } from 'react';
import { data } from '../data/source';
import { cached, usePoll } from '../data/usePoll';
import { back, href } from '../data/router';
import { TEAMS } from '../shared/teams';
import { record, shortDay } from '../shared/format';
import { Badge, Icon, Nav, teamName } from '../ui/parts';
import { isLive, liveStatus } from '../ui/GameRow';

// Recent teams are a per-device convenience only; the page works without storage.
const KEY = 'gridline.recentTeams';
function readRecent(): string[] {
  try { return (JSON.parse(localStorage.getItem(KEY) ?? '[]') as string[]).filter((a) => TEAMS[a]).slice(0, 6); } catch { return []; }
}
export function rememberTeam(abbr: string) {
  try { localStorage.setItem(KEY, JSON.stringify([abbr, ...readRecent().filter((a) => a !== abbr)].slice(0, 6))); } catch { /* storage unavailable */ }
}

function Highlight({ text, q }: { text: string; q: string }) {
  const i = q ? text.toLowerCase().indexOf(q.toLowerCase()) : -1;
  if (i < 0) return <>{text}</>;
  return <>{text.slice(0, i)}<mark>{text.slice(i, i + q.length)}</mark>{text.slice(i + q.length)}</>;
}

export function SearchPage() {
  const [q, setQ] = useState('');
  const [recent, setRecent] = useState<string[]>(readRecent);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { input.current?.focus(); }, []);
  const sb = usePoll(() => cached('sb-search', () => data.scoreboard(), 30_000), 0, []);
  const st = usePoll(() => cached('standings', () => data.standings()), 0, []);
  const term = q.trim().toLowerCase();

  const teams = term
    ? Object.values(TEAMS).filter((t) => `${t.city} ${t.name}`.toLowerCase().includes(term) || t.abbr.toLowerCase() === term || t.name.toLowerCase().startsWith(term))
    : [];
  const teamSet = new Set(teams.map((t) => t.abbr));
  const games = term ? (sb.data?.games ?? []).filter((g) => teamSet.has(g.away.abbr) || teamSet.has(g.home.abbr)) : [];
  const meta = (abbr: string) => {
    const t = TEAMS[abbr];
    const s = st.data?.find((x) => x.team === abbr);
    const playing = sb.data?.games.find((g) => isLive(g) && (g.home.abbr === abbr || g.away.abbr === abbr));
    return [`${t.conf} ${t.div}`, s ? record(s.w, s.l, s.t) : null, playing ? 'Playing now' : null].filter(Boolean).join(' · ');
  };

  return (
    <div className="app">
      <header className="top">
        <div className="top-row" style={{ gap: 10 }}>
          <label className="search-box" htmlFor="q">
            <Icon name="search" />
            <span className="sr-only">Search teams and games</span>
            <input id="q" ref={input} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Team, city or abbreviation" autoComplete="off" enterKeyHint="search" />
          </label>
          <a href={href.home} onClick={back(href.home)} style={{ fontSize: 15, fontWeight: 600, padding: '12px 4px' }}>Cancel</a>
        </div>
      </header>

      <main className="page">
        {term && (
          <section className="card" aria-label="Teams">
            <div className="card-head"><span className="card-title">Teams</span></div>
            {teams.length ? teams.map((t) => (
              <a className="row" key={t.abbr} href={href.team(t.abbr)}>
                <Badge abbr={t.abbr} />
                <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontSize: 15, fontWeight: 600 }}><Highlight text={`${t.city} ${t.name}`} q={q.trim()} /></span>
                  <span className="sub">{meta(t.abbr)}</span>
                </span>
                <Icon name="next" size={16} />
              </a>
            )) : <p className="empty">No teams match “{q.trim()}”. Try a city, nickname or abbreviation like KC.</p>}
          </section>
        )}

        {games.length > 0 && (
          <section className="card" aria-label="Games">
            <div className="card-head"><span className="card-title">Games this week</span></div>
            {games.map((g) => (
              <a className="row" key={g.id} href={href.game(g.id)}>
                <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{teamName(g.away.abbr)}{g.away.score != null ? ` ${g.away.score}` : ''} at {teamName(g.home.abbr)}{g.home.score != null ? ` ${g.home.score}` : ''}</span>
                  <span className="sub">Week {g.week} · {shortDay(g.kickoff)}</span>
                </span>
                <span className={`mono ${isLive(g) ? 'live-text' : 'muted'}`} style={{ fontSize: 12, fontWeight: 700 }}>{isLive(g) ? '● ' : ''}{liveStatus(g)}</span>
              </a>
            ))}
          </section>
        )}

        {!term && recent.length > 0 && (
          <section className="card" aria-label="Recent">
            <div className="card-head">
              <span className="card-title">Recent</span>
              <button onClick={() => { try { localStorage.removeItem(KEY); } catch { /* ignore */ } setRecent([]); }} style={{ background: 'none', border: 0, color: 'var(--accent)', fontWeight: 600, fontSize: 13, padding: 8 }}>Clear</button>
            </div>
            <div className="card-body" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {recent.map((a) => (
                <a key={a} href={href.team(a)} className="chip" style={{ height: 36, gap: 8, color: 'var(--text)' }}><Badge abbr={a} size={22} />{teamName(a)}</a>
              ))}
            </div>
          </section>
        )}

        {!term && (
          <section className="card pad" aria-label="Browse by division">
            <span className="card-title">Browse by division</span>
            {(['AFC', 'NFC'] as const).map((conf) => (
              <div key={conf} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {(['East', 'North', 'South', 'West'] as const).map((div) => (
                  <div key={div} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span className="kicker">{conf} {div}</span>
                    <div className="div-chips">
                      {Object.values(TEAMS).filter((t) => t.conf === conf && t.div === div).map((t) => (
                        <a key={t.abbr} href={href.team(t.abbr)} style={{ gap: 8 }}><Badge abbr={t.abbr} size={22} />{t.name}</a>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </section>
        )}
      </main>
      <Nav active="none" />
    </div>
  );
}
