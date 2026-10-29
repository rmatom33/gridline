import type { Game } from './types';

export function periodLabel(q: number | null): string {
  if (!q) return '';
  return q >= 5 ? 'OT' : `Q${q}`;
}

export function ordinal(n: number): string {
  return ['1st', '2nd', '3rd', '4th'][n - 1] ?? `${n}th`;
}

export function downText(down: number | null | undefined, dist: number | null | undefined, goalToGo = false): string {
  if (!down) return '';
  return `${ordinal(down)} & ${goalToGo ? 'Goal' : dist ?? ''}`;
}

const ET = 'America/New_York';

export function kickoffTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: ET }) + ' ET';
}

export function kickoffDay(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', timeZone: ET });
}

export function statusText(g: Game): string {
  switch (g.status) {
    case 'live': return `${periodLabel(g.quarter)} · ${g.clock ?? ''}`;
    case 'halftime': return 'Half';
    case 'final': return g.overtime ? 'Final/OT' : 'Final';
    case 'postponed': return 'Postponed';
    default: return kickoffTime(g.kickoff);
  }
}

export function spreadText(g: Game): string | null {
  const s = g.odds?.spread;
  if (s == null) return null;
  if (s === 0) return 'PK';
  const fav = s < 0 ? g.home.abbr : g.away.abbr;
  return `${fav} -${Math.abs(s)}`;
}

export function moneyline(n: number | null | undefined): string {
  if (n == null) return '–';
  return n > 0 ? `+${n}` : `${n}`;
}

export function pct(p: number): string {
  return `${Math.round(p * 100)}%`;
}

// ---- Additional display helpers ----

/** "Sun, Nov 1" in Eastern time. */
export function shortDay(iso: string | number): string {
  return new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: ET });
}

/** "SUN NOV 1" for mono kickers. */
export function kickerDay(iso: string | number): string {
  return shortDay(iso).replace(',', '').toUpperCase();
}

/** "4:25 PM" (ET, no suffix). */
export function clockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: ET });
}

/** Eastern calendar date key, e.g. "2026-11-01". */
export function etDateKey(iso: string | number): string {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: ET });
}

/** Parts for a kickoff countdown. */
export function countdown(iso: string, now = Date.now()) {
  const ms = Math.max(0, Date.parse(iso) - now);
  const mins = Math.floor(ms / 60_000);
  const days = Math.floor(mins / 1440), hours = Math.floor((mins % 1440) / 60), m = mins % 60;
  return { ms, days, hours, mins: m };
}

export function countdownText(iso: string, now = Date.now()): string {
  const c = countdown(iso, now);
  if (c.ms <= 0) return 'Starting soon';
  if (c.days > 0) return `in ${c.days}d ${c.hours}h`;
  if (c.hours > 0) return `in ${c.hours}h ${String(c.mins).padStart(2, '0')}m`;
  return `in ${c.mins} min`;
}

export function agoText(ms: number, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - ms) / 1000));
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  return m < 60 ? `${m} min ago` : `${Math.round(m / 60)} h ago`;
}

export function signed(n: number): string {
  return n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0';
}

/** Use a true minus sign for display. */
export function spreadLabel(g: Game): string | null {
  const s = g.odds?.spread;
  if (s == null) return null;
  if (s === 0) return 'Pick’em';
  const fav = s < 0 ? g.home.abbr : g.away.abbr;
  return `${fav} −${Math.abs(s)}`;
}

export function weatherShort(g: Game): string | null {
  const w = g.weather;
  if (!w) return null;
  if (w.dome) return 'Indoors';
  const parts = [w.tempF != null ? `${Math.round(w.tempF)}°F` : null, w.windMph != null ? `Wind ${Math.round(w.windMph)}` : null].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}

export function streakText(s: string): string {
  const m = s.match(/^([WLT])(\d+)$/);
  if (!m) return '–';
  return `${m[1] === 'W' ? 'Won' : m[1] === 'L' ? 'Lost' : 'Tied'} ${m[2]}`;
}

export function record(w: number, l: number, t: number): string {
  return `${w}-${l}${t ? `-${t}` : ''}`;
}

// ---- TV networks: always shown in full, never abbreviated ----
const NETWORKS: Record<string, string> = {
  AMZN: 'Prime Video', AMAZON: 'Prime Video', PRIME: 'Prime Video', 'PRIME VIDEO': 'Prime Video',
  'CBS/P': 'CBS · Paramount+', 'CBS/PARAMOUNT+': 'CBS · Paramount+', 'PARAMOUNT+': 'Paramount+',
  'NBC/P': 'NBC · Peacock', 'NBC/PEACOCK': 'NBC · Peacock', PEACOCK: 'Peacock',
  NFLN: 'NFL Network', 'NFL NETWORK': 'NFL Network', NFLNET: 'NFL Network',
  'ESPN/ABC': 'ESPN · ABC', 'ABC/ESPN': 'ABC · ESPN', ESPN2: 'ESPN2', 'ESPN+': 'ESPN+',
  NETFLIX: 'Netflix', NFLX: 'Netflix', YOUTUBE: 'YouTube', YT: 'YouTube', 'NFL+': 'NFL+',
  FOX: 'FOX', CBS: 'CBS', NBC: 'NBC', ABC: 'ABC', ESPN: 'ESPN'
};
/** Full network name for display, e.g. "AMZN" -> "Prime Video". */
export function networkName(tv?: string | null): string | null {
  if (!tv) return null;
  const k = tv.trim().toUpperCase();
  return NETWORKS[k] ?? tv.trim();
}
