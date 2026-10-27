import type { ReactNode } from 'react';
import type { Game, Injury, InjuryStatus, Standing, TeamStatRow, WinProbPoint } from '../shared/types';
import { team } from '../shared/teams';
import { back, href } from '../data/router';
import { IS_SAMPLE } from '../data/source';
import { agoText, downText } from '../shared/format';

// ---------- Icons ----------
const ICONS = {
  home: <><rect x="3" y="3" width="7" height="7" rx="2" /><rect x="14" y="3" width="7" height="7" rx="2" /><rect x="3" y="14" width="7" height="7" rx="2" /><rect x="14" y="14" width="7" height="7" rx="2" /></>,
  games: <><rect x="3" y="5" width="18" height="14" rx="3" /><path d="M12 5v14M3 12h4M17 12h4" /></>,
  standings: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  back: <path d="M15 5l-7 7 7 7" />,
  next: <path d="M9 5l7 7-7 7" />,
  down: <path d="M6 9l6 6 6-6" />,
  search: <><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M3 10h18M8 3v4M16 3v4" /></>,
  share: <><path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7" /><path d="M12 3v12M7 8l5-5 5 5" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>
};
export type IconName = keyof typeof ICONS;

export function Icon({ name, size = 20, stroke = 2 }: { name: IconName; size?: number; stroke?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
      {ICONS[name]}
    </svg>
  );
}

// ---------- Team badge (abbreviation on team color; no logos) ----------
export function Badge({ abbr, size = 36 }: { abbr: string; size?: number }) {
  const t = team(abbr);
  const font = size >= 44 ? 13 : size >= 36 ? 12 : size >= 30 ? 11 : 10;
  return (
    <span className="badge" aria-hidden="true" style={{ width: size, height: size, borderRadius: size >= 36 ? (size >= 44 ? 12 : 10) : size >= 30 ? 8 : 7, background: t.color, color: t.text, fontSize: font }}>
      {abbr}
    </span>
  );
}

export function teamName(abbr: string, full = false) {
  const t = team(abbr);
  return full ? `${t.city} ${t.name}` : t.name;
}

// ---------- Layout ----------
export function Card({ title, right, children, className = '', label }: { title?: ReactNode; right?: ReactNode; children: ReactNode; className?: string; label?: string }) {
  return (
    <section className={`card ${className}`} aria-label={label ?? (typeof title === 'string' ? title : undefined)}>
      {title != null && (
        <div className="card-head">
          <span className="card-title">{title}</span>
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

export function PadCard({ title, right, children, label }: { title?: ReactNode; right?: ReactNode; children: ReactNode; label?: string }) {
  return (
    <section className="card pad" aria-label={label ?? (typeof title === 'string' ? title : undefined)}>
      {title != null && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
          <span className="card-title">{title}</span>
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

export function LinkButton({ to, kind = 'tint', children }: { to: string; kind?: 'primary' | 'tint'; children: ReactNode }) {
  return (
    <a className={`btn ${kind}`} href={to}>
      {children}
      <Icon name="next" size={16} stroke={2.4} />
    </a>
  );
}

export function BackButton({ fallback, label = 'Back' }: { fallback: string; label?: string }) {
  return (
    <a className="icon-btn" href={fallback} onClick={back(fallback)} aria-label={label}>
      <Icon name="back" size={22} stroke={2.2} />
    </a>
  );
}

export function SampleBadge() {
  return IS_SAMPLE ? <span className="sample-pill" title="Fictional sample data replaying on a loop">SAMPLE</span> : null;
}

export function Nav({ active }: { active: 'home' | 'games' | 'standings' | 'none' }) {
  const items = [
    { key: 'home', label: 'Home', to: href.home },
    { key: 'games', label: 'Games', to: href.games },
    { key: 'standings', label: 'Standings', to: href.standings() }
  ] as const;
  return (
    <nav className="nav" aria-label="Main">
      <div className="nav-inner">
        {items.map((it) => (
          <a key={it.key} href={it.to} aria-current={active === it.key ? 'page' : undefined}>
            <Icon name={it.key} size={22} />
            {it.label}
          </a>
        ))}
      </div>
    </nav>
  );
}

export function Footer({ odds = true }: { odds?: boolean }) {
  return (
    <p className="footer-note">
      {odds ? 'Odds for information only. ' : ''}Win probability is calculated by Gridline. {IS_SAMPLE ? 'Fictional sample data. ' : 'Data under licence from our data providers. '}Not affiliated with the NFL.
    </p>
  );
}

// ---------- Offline / errors / loading ----------
export function OfflineBanner({ online, stale, updatedAt, retry }: { online: boolean; stale: boolean; updatedAt: number | null; retry: () => void }) {
  if (online && !stale) return null;
  return (
    <div className="offline" role="status">
      <span>{online ? "Can't reach live data." : "You're offline."}{updatedAt ? <> Showing what we had <b>{agoText(updatedAt)}</b>.</> : null}</span>
      <button onClick={retry}>Retry</button>
    </div>
  );
}

export function ErrorCard({ error, retry }: { error: Error; retry: () => void }) {
  return (
    <div className="alert" role="alert">
      <b>Couldn't load the latest data</b>
      <span className="sub">{error.message}. We'll keep trying automatically.</span>
      <button className="btn tint" onClick={retry}>Try again</button>
    </div>
  );
}

export function Skeleton() {
  return (
    <main className="page" aria-busy="true" aria-label="Loading">
      <section className="card pad">
        <span className="sk" style={{ width: 110, height: 14 }} />
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}><span className="sk" style={{ width: 36, height: 36, borderRadius: 10 }} /><span className="sk" style={{ flex: 1, height: 16 }} /><span className="sk" style={{ width: 34, height: 26 }} /></div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}><span className="sk" style={{ width: 36, height: 36, borderRadius: 10 }} /><span className="sk" style={{ flex: 1, height: 16 }} /><span className="sk" style={{ width: 34, height: 26 }} /></div>
        <span className="sk" style={{ height: 10 }} />
        <div className="grid2"><span className="sk" style={{ height: 72, borderRadius: 12 }} /><span className="sk" style={{ height: 72, borderRadius: 12 }} /></div>
        <span className="sk" style={{ height: 48, borderRadius: 12 }} />
      </section>
      <section className="card pad">
        <span className="sk" style={{ width: 90, height: 14 }} />
        <span className="sk" style={{ height: 44 }} />
        <span className="sk" style={{ height: 44 }} />
      </section>
    </main>
  );
}

// ---------- Field ----------
/** Geometry shared by both field drawings. Left = away end zone, right = home end zone. */
function fieldGeom(g: Game) {
  const s = g.situation;
  if (!s || s.yardsFromOwnGoal == null || !g.possession) return null;
  const towardHome = g.possession === 'away';
  const pos = (yfog: number) => Math.max(0, Math.min(100, towardHome ? yfog : 100 - yfog));
  const los = pos(s.yardsFromOwnGoal);
  const fd = s.distance != null && s.yardsFromOwnGoal + s.distance < 100 ? pos(s.yardsFromOwnGoal + s.distance) : null;
  const start = s.driveStart != null ? pos(s.driveStart) : null;
  return { s, towardHome, los, fd, start, poss: g[g.possession].abbr };
}

/** Compact field bar (home spotlight). */
export function FieldBar({ g }: { g: Game }) {
  const f = fieldGeom(g);
  if (!f) return null;
  const a = team(g.away.abbr), h = team(g.home.abbr);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div className="fieldbar" role="img" aria-label={`Field: ${a.name} end zone on the left, ${h.name} on the right. Ball on ${f.s.spot ?? 'the field'}, ${f.poss} driving ${f.towardHome ? 'right' : 'left'}.`}>
        <span className="tag" style={{ background: a.color, color: a.text }}>{a.abbr}</span>
        <div className="track">
          <div className="mid" />
          {f.start != null && <div className="drv" style={{ left: `${Math.min(f.start, f.los)}%`, width: `${Math.abs(f.los - f.start)}%` }} />}
          <div className="mk" style={{ left: `calc(${f.los}% - 2px)`, width: 4, background: 'var(--accent)' }} />
          {f.fd != null && <div className="mk" style={{ left: `calc(${f.fd}% - 1px)`, width: 3, background: 'var(--warn)' }} />}
        </div>
        <span className="tag" style={{ background: h.color, color: h.text }}>{h.abbr}</span>
      </div>
      <div className="field-legend" style={{ padding: '0 38px' }}>
        <span>{a.abbr} end</span><span>50</span><span>{h.abbr} end · {f.poss} {f.towardHome ? 'driving →' : '← driving'}</span>
      </div>
    </div>
  );
}

/** Full field (game page). */
export function Field({ g }: { g: Game }) {
  const f = fieldGeom(g);
  if (!f) return null;
  const a = team(g.away.abbr), h = team(g.home.abbr);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div className="field" role="img" aria-label={`Field: ${a.name} end zone on the left, ${h.name} on the right. Ball on ${f.s.spot ?? 'the field'}${f.fd != null ? `, first down ${f.s.distance} yards ahead` : ''}.`}>
        <span className="ez" style={{ background: a.color, color: a.text }}>{a.abbr}</span>
        <div className="turf">
          <div className="yards">{Array.from({ length: 10 }, (_, i) => <span key={i} />)}</div>
          {f.start != null && <div className="drive" style={{ left: `${Math.min(f.start, f.los)}%`, width: `${Math.abs(f.los - f.start)}%` }} />}
          <div className="los" style={{ left: `calc(${f.los}% - 1px)` }} />
          {f.fd != null && <div className="fd" style={{ left: `calc(${f.fd}% - 1px)` }} />}
        </div>
        <span className="ez" style={{ background: h.color, color: h.text }}>{h.abbr}</span>
      </div>
      <div className="field-legend"><span>{a.abbr} end zone</span><span>{f.poss} {f.towardHome ? 'driving →' : '← driving'}</span><span>{h.abbr} end zone</span></div>
    </div>
  );
}

export function situationText(g: Game): string | null {
  const s = g.situation;
  if (!s?.down) return null;
  const goal = s.yardsFromOwnGoal != null && s.distance != null && s.yardsFromOwnGoal + s.distance >= 100;
  return `${downText(s.down, s.distance, goal)}${s.spot ? ` at ${s.spot}` : ''}`;
}

// ---------- Win probability ----------
/** Line chart: home team's chance on top half, away on the bottom. */
export function WPChart({ series, g, label }: { series: WinProbPoint[]; g: Game; label?: string }) {
  if (series.length < 2) return <p className="sub">The chart fills in as the game is played.</p>;
  const W = 356, H = 110;
  const maxT = Math.max(3600, ...series.map((p) => p.t));
  const x = (t: number) => (t / maxT) * W;
  const y = (p: number) => (1 - p) * H;
  const pts = series.map((p) => `${x(p.t).toFixed(1)},${y(p.homeWinProb).toFixed(1)}`).join(' ');
  const last = series[series.length - 1];
  const h = team(g.home.abbr), a = team(g.away.abbr);
  const quarters = maxT > 3600 ? ['Q1', 'Q2', 'Q3', 'Q4', 'OT'] : ['Q1', 'Q2', 'Q3', 'Q4'];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <svg role="img" aria-label={label ?? `${h.name} win probability across the game, now ${Math.round(last.homeWinProb * 100)} percent`} viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block', overflow: 'visible' }}>
        <rect x="0" y="0" width={W} height={H / 2} fill={h.color} opacity="0.08" />
        <rect x="0" y={H / 2} width={W} height={H / 2} fill={a.color} opacity="0.12" />
        <line x1="0" y1={H / 2} x2={W} y2={H / 2} stroke="#2A3542" strokeDasharray="4 4" />
        {[900, 1800, 2700, 3600].filter((t) => t < maxT).map((t) => <line key={t} x1={x(t)} y1="0" x2={x(t)} y2={H} stroke="#1A222C" />)}
        <polyline fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinejoin="round" points={pts} />
        <circle cx={x(last.t)} cy={y(last.homeWinProb)} r="4" fill="var(--accent)" />
      </svg>
      <div className="mono" style={{ display: 'grid', gridTemplateColumns: `repeat(${quarters.length}, minmax(0,1fr))`, fontSize: 10, color: 'var(--muted)', textAlign: 'center' }}>
        {quarters.map((q) => <span key={q}>{q}</span>)}
      </div>
    </div>
  );
}

/** Two-color bar: away share on the left, home on the right. */
export function WPBar({ homeProb, g }: { homeProb: number; g: Game }) {
  const a = team(g.away.abbr), h = team(g.home.abbr);
  const ap = Math.round((1 - homeProb) * 100);
  return (
    <div className="wpbar" role="img" aria-label={`${a.name} ${ap} percent, ${h.name} ${100 - ap} percent`}>
      <div style={{ width: `${ap}%`, background: a.color }} />
      <div style={{ flex: 1, background: h.color }} />
    </div>
  );
}

// ---------- Stats ----------
export function StatBars({ rows, away, home }: { rows: TeamStatRow[]; away: string; home: string }) {
  return (
    <>
      {rows.map((s) => {
        const total = Math.abs(s.away) + Math.abs(s.home) || 1;
        // For turnovers and penalties, fewer is better, but bar length still shows the raw share.
        return (
          <div className="stat-row" key={s.label}>
            <div className="lbls"><b>{s.awayText ?? s.away}</b><span>{s.label}</span><b>{s.homeText ?? s.home}</b></div>
            <div className="statbars" aria-hidden="true">
              <div><i style={{ width: `${(Math.abs(s.away) / total) * 100}%`, background: '#8C97A6' }} /></div>
              <div><i style={{ width: `${(Math.abs(s.home) / total) * 100}%`, background: 'var(--accent)' }} /></div>
            </div>
          </div>
        );
      })}
      <span className="sr-only">{away} on the left, {home} on the right.</span>
    </>
  );
}

export function FormDots({ s }: { s?: Standing }) {
  if (!s) return null;
  return (
    <span className="form" aria-label={`Last ${s.last5.length}: ${s.last5.join(' ')}`}>
      {s.last5.map((r, i) => <i key={i} className={r === 'W' ? 'w' : r === 'T' ? 't' : ''} />)}
    </span>
  );
}

export function FormBoxes({ s }: { s?: Standing }) {
  if (!s) return null;
  return (
    <span className="form-lg" aria-label={`Last ${s.last5.length}, oldest first: ${s.last5.join(' ')}`}>
      {s.last5.map((r, i) => <span key={i} className={r === 'W' ? 'w' : ''}>{r}</span>)}
    </span>
  );
}

export function injuryClass(s: InjuryStatus): string {
  if (s === 'Out' || s === 'IR' || s === 'Doubtful') return 's-out';
  if (s === 'Questionable') return 's-q';
  return 's-ok';
}

export function InjuryRows({ list, showTeam = true, empty = 'No players on the injury report.' }: { list: Injury[]; showTeam?: boolean; empty?: string }) {
  if (!list.length) return <p className="empty">{empty}</p>;
  return (
    <>
      {list.map((i, n) => (
        <div className="row" key={`${i.team}-${i.name}-${n}`}>
          {showTeam && <span style={{ width: 36, fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>{i.team}</span>}
          <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 14, fontWeight: 600 }}>{i.name} <span className="muted" style={{ fontWeight: 400 }}>· {i.pos}</span></span>
            {i.detail && <span className="sub">{i.detail}</span>}
          </span>
          <span className={`status-pill ${injuryClass(i.status)}`}>{i.status}</span>
        </div>
      ))}
    </>
  );
}

export function TeamLine({ abbr, score, size = 36, trail, poss, nameSize = 16, scoreSize = 28, full = true, extra }: {
  abbr: string; score?: number | null; size?: number; trail?: boolean; poss?: boolean; nameSize?: number; scoreSize?: number; full?: boolean; extra?: ReactNode;
}) {
  return (
    <div className="team-line">
      <Badge abbr={abbr} size={size} />
      <span className={`name ${trail ? 'trail-name' : ''}`} style={{ fontSize: nameSize }}>
        {teamName(abbr, full)}
        {poss && <span className="poss" aria-label="Has the ball" />}
        {extra}
      </span>
      {score != null && <span className={`score ${trail ? 'trail' : ''}`} style={{ fontSize: scoreSize }}>{score}</span>}
    </div>
  );
}
