// Player stat helpers for box scores.
import type { PlayerLine } from './types';

/** Rough "biggest impact" ordering for the player list: yards plus touchdowns, minus turnovers. */
export function impact(p: PlayerLine): number {
  const yds = (p.passing?.yds ?? 0) * 0.5 + (p.rushing?.yds ?? 0) + (p.receiving?.yds ?? 0);
  const td = (p.passing?.td ?? 0) + (p.rushing?.td ?? 0) + (p.receiving?.td ?? 0);
  const to = (p.passing?.int ?? 0) + (p.fumblesLost ?? 0);
  return yds + td * 25 - to * 20;
}

export function statLine(p: PlayerLine): string {
  const parts: string[] = [];
  if (p.passing && p.passing.att > 0) {
    parts.push(`${p.passing.cmp}/${p.passing.att} · ${p.passing.yds} yds · ${p.passing.td} TD${p.passing.int ? ` · ${p.passing.int} INT` : ''}`);
  }
  if (p.rushing && p.rushing.att > 0) parts.push(`${p.rushing.att} car · ${p.rushing.yds} yds${p.rushing.td ? ` · ${p.rushing.td} TD` : ''}`);
  if (p.receiving && p.receiving.rec > 0) parts.push(`${p.receiving.rec} rec · ${p.receiving.yds} yds${p.receiving.td ? ` · ${p.receiving.td} TD` : ''}`);
  return parts.join(' · ');
}
