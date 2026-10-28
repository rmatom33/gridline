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
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  trend: <><path d="M3 17l6-6 4 4 8-8" /><path d="M15 7h6v6" /></>,
  star: <path d="M12 3l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.4l-5.7 3.1 1.2-6.4L2.8 9.7l6.4-.8z" />,
  where: <path d="M4 11l8-7 8 7v9H4z" />
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
  const font = size >= 56 ? 17 : size >= 44 ? 15 : size >= 36 ? 13 : size >= 30 ? 12 : 10;
  return (
    <span className="badge" aria-hidden="true" style={{ width: size, height: size, borderRadius: Math.round(size * 0.31), background: t.color, color: t.text, fontSize: font }}>
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

export function LinkButton({ to, kind = 'primary', children }: { to: string; kind?: 'primary' | 'tint'; children: ReactNode }) {
  return (
    <a className={`btn ${kind}`} href={to}>
      {children}
      <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M5 12h12M13 6l6 6-6 6" /></svg>
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

const NAV_ICONS = {
  home: (
    <>
      <path d="M3 13c0-3 5.8-6 13-6s13 3 13 6v9c0 3-5.8 6-13 6S3 25 3 22z" fill="#6B6690" />
      <path d="M3 13c0 3 5.8 6 13 6s13-3 13-6" fill="none" stroke="#3E3A63" strokeWidth="1.4" />
      <ellipse cx="16" cy="16.5" rx="9" ry="4.2" fill="#22A447" />
      <path d="M16 12.4v8.2M11 13.2v6.6M21 13.2v6.6" stroke="#FFFFFF" strokeWidth="1" opacity=".8" />
      <path d="M6 6V3M26 6V3" stroke="#3E3A63" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="6" cy="3" r="1.8" fill="#FACC15" /><circle cx="26" cy="3" r="1.8" fill="#FACC15" />
    </>
  ),
  games: (
    <g transform="rotate(-35 16 16)">
      <ellipse cx="16" cy="16" rx="13" ry="7.8" fill="#8B4513" stroke="#4A230A" strokeWidth="1.6" />
      <path d="M6 12.5q10-3.5 20 0M6 19.5q10 3.5 20 0" fill="none" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M11.5 16h9" stroke="#FFFFFF" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M13.5 14.2v3.6M16 14.2v3.6M18.5 14.2v3.6" stroke="#FFFFFF" strokeWidth="1.3" strokeLinecap="round" />
    </g>
  ),
  standings: (
    <>
      <path d="M9 4h14v7a7 7 0 0 1-14 0z" fill="#FACC15" stroke="#B45309" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M9 6H5v2a5 5 0 0 0 5 5M23 6h4v2a5 5 0 0 1-5 5" fill="none" stroke="#B45309" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M16 18v5" stroke="#B45309" strokeWidth="2.2" />
      <path d="M10 28h12l-1.5-5h-9z" fill="#C2410C" stroke="#7C2D12" strokeWidth="1.4" strokeLinejoin="round" />
    </>
  )
};

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
            <svg aria-hidden="true" width="30" height="30" viewBox="0 0 32 32">{NAV_ICONS[it.key]}</svg>
            {it.label}
          </a>
        ))}
      </div>
    </nav>
  );
}

/** Two-part tag that never wraps: orange "WEEK 8" + navy date or place. */
export function WeekChip({ left, right, size = 'md' }: { left: string; right?: string | null; size?: 'md' | 'lg' }) {
  return (
    <span className={`week-chip ${size}`}>
      <span className="l">{left}</span>
      {right ? <><span className="sep" aria-hidden="true" /><span className="r">{right}</span></> : null}
    </span>
  );
}

/** Round tinted arrow used on every tappable row/card. */
export function GoArrow() {
  return (
    <span className="go" aria-hidden="true">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5l7 7-7 7" /></svg>
    </span>
  );
}

/** Centered header row: back button | title (+ extra lines) | right slot or spacer. */
export function CenterBar({ fallback, backLabel, right, children }: { fallback: string; backLabel?: string; right?: ReactNode; children: ReactNode }) {
  return (
    <header className="center-bar">
      <BackButton fallback={fallback} label={backLabel} />
      <div className="mid">{children}</div>
      {right ?? <span aria-hidden="true" />}
    </header>
  );
}

export function Footer({ odds = true }: { odds?: boolean }) {
  return (
    <p className="footer-note fine">
      {odds ? 'Odds for information only. ' : ''}Chance to win is calculated by Gridline. {IS_SAMPLE ? 'Fictional sample data. ' : 'Data under licence from our data providers. '}Not affiliated with the NFL.
    </p>
  );
}

// ---------- Offline / errors / loading ----------
export function OfflineBanner({ online, stale, updatedAt, retry }: { online: boolean; stale: boolean; updatedAt: number | null; retry: () => void }) {
  if (online && !stale) return null;
  return (
    <div className="offline" role="status">
      <span><b>{online ? "Can't reach live scores." : "You're offline."}</b>{updatedAt ? <> Showing the score from {agoText(updatedAt)}.</> : null}</span>
      <button onClick={retry}>Try again</button>
    </div>
  );
}

export function ErrorCard({ error, retry }: { error: Error; retry: () => void }) {
  return (
    <div className="alert" role="alert">
      <b>We couldn't load the latest scores</b>
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
          {f.fd != null && <div className="mk" style={{ left: `calc(${f.fd}% - 1px)`, width: 3, background: 'var(--navy)' }} />}
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
      {s.last5.map((r, i) => <i key={i} className={r === 'W' ? 'w' : r === 'T' ? 't' : 'l'} />)}
    </span>
  );
}

export function FormBoxes({ s }: { s?: Standing }) {
  if (!s) return null;
  return (
    <span className="form-lg" aria-label={`Last ${s.last5.length}, oldest first: ${s.last5.join(' ')}`}>
      {s.last5.map((r, i) => <span key={i} className={r === 'W' ? 'w' : r === 'L' ? 'l' : ''}>{r}</span>)}
    </span>
  );
}

const STATUS_WORDS: Record<InjuryStatus, string> = {
  Out: 'Out', IR: 'Out long-term', Doubtful: 'Unlikely to play', Questionable: 'May not play', Probable: 'Likely to play', Returned: 'Back playing'
};
export const injuryWords = (s: InjuryStatus) => STATUS_WORDS[s] ?? s;

export function injuryClass(s: InjuryStatus): string {
  if (s === 'Out' || s === 'IR' || s === 'Doubtful') return 's-out';
  if (s === 'Questionable') return 's-q';
  return 's-ok';
}

const POS_WORDS: Record<string, string> = {
  QB: 'Quarterback', RB: 'Running back', FB: 'Fullback', WR: 'Receiver', TE: 'Tight end', OL: 'Offensive line', LT: 'Left tackle', RT: 'Right tackle',
  LG: 'Left guard', RG: 'Right guard', OT: 'Tackle', T: 'Tackle', OG: 'Guard', G: 'Guard', NT: 'Nose tackle', EDGE: 'Edge rusher', C: 'Center', DL: 'Defensive line', DE: 'Defensive end', DT: 'Defensive tackle', LB: 'Linebacker', OLB: 'Linebacker',
  ILB: 'Linebacker', MLB: 'Linebacker', CB: 'Cornerback', S: 'Safety', FS: 'Safety', SS: 'Safety', DB: 'Defensive back', K: 'Kicker', P: 'Punter', LS: 'Long snapper'
};
export const posWords = (pos: string) => POS_WORDS[pos?.toUpperCase()] ?? pos;

export function InjuryRows({ list, showTeam = true, empty = 'No players on the injury report.' }: { list: Injury[]; showTeam?: boolean; empty?: string }) {
  if (!list.length) return <p className="empty">{empty}</p>;
  return (
    <>
      {list.map((i, n) => (
        <div className="row inj" key={`${i.team}-${i.name}-${n}`}>
          <span className="who">
            <b>{i.name}</b>
            <span className="sub">{showTeam ? `${teamName(i.team)} · ` : ''}{posWords(i.pos)}</span>
            {i.detail && (
              <span className="hurt">
                <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C2410C" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="8" width="18" height="8" rx="4" transform="rotate(-35 12 12)" /><path d="M10.5 11.2h.01M13.5 12.8h.01M12 10.5h.01M12 13.5h.01" /></svg>
                {i.detail.charAt(0).toUpperCase() + i.detail.slice(1)}{/injur/i.test(i.detail) ? '' : ' injury'}
              </span>
            )}
          </span>
          <span className={`status-pill ${injuryClass(i.status)}`}>{injuryWords(i.status)}</span>
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
