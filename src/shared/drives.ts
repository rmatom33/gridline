// Groups play-by-play into drives (a new drive starts when possession changes).
import type { Play } from './types';
import { clockToSeconds } from './winprob';

export interface Drive {
  key: string;
  team: string;
  quarter: number; // quarter the drive started in
  plays: Play[]; // oldest first
  result: string;
  playCount: number;
  yards: number;
  time: string; // m:ss
  scoring: boolean;
}

const elapsed = (p: Play) => (Math.min(p.quarter, 5) - 1) * 900 + (900 - clockToSeconds(p.clock));

function resultOf(last: Play | undefined, inProgress: boolean): { result: string; scoring: boolean } {
  if (!last) return { result: 'Drive', scoring: false };
  const t = last.text.toLowerCase();
  if (last.kind === 'score') {
    if (t.includes('field goal')) return { result: 'Field goal', scoring: true };
    if (t.includes('safety')) return { result: 'Safety', scoring: true };
    return { result: 'Touchdown', scoring: true };
  }
  if (last.kind === 'turnover') {
    if (t.includes('intercept')) return { result: 'Interception', scoring: false };
    if (t.includes('fumble')) return { result: 'Fumble', scoring: false };
    if (t.includes('downs')) return { result: 'Turnover on downs', scoring: false };
    return { result: 'Turnover', scoring: false };
  }
  if (last.kind === 'punt') return { result: 'Punt', scoring: false };
  if (t.includes('field goal') && (t.includes('no good') || t.includes('missed') || t.includes('blocked'))) return { result: 'Missed FG', scoring: false };
  if (inProgress) return { result: 'In progress', scoring: false };
  if (t.includes('end of') || t.includes('kneel')) return { result: 'End of half', scoring: false };
  return { result: 'Drive', scoring: false };
}

/** `plays` newest first (as the API returns). Drives come back newest first. */
export function groupDrives(plays: Play[], live: boolean): Drive[] {
  const asc = plays.slice().reverse();
  const groups: Play[][] = [];
  const isKickoff = (p: Play) => p.kind === 'kick' && /kicks? off|kickoff/i.test(p.text);
  const owner = (g: Play[]) => g.find((p) => !isKickoff(p) && p.kind !== 'timeout')?.team;
  for (const p of asc) {
    const cur = groups[groups.length - 1];
    if (!cur) { groups.push([p]); continue; }
    // Kickoffs and timeouts stay with the drive before them; a snap by the other team starts a new drive.
    if (isKickoff(p) || p.kind === 'timeout') { cur.push(p); continue; }
    const team = owner(cur);
    if (team && team !== p.team) groups.push([p]);
    else cur.push(p);
  }
  const drives = groups.map((g, i): Drive => {
    const counted = g.filter((p) => p.kind !== 'timeout' && !isKickoff(p));
    // Ignore the extra-point try when naming the result (the touchdown decides it).
    const last = counted.filter((p) => !(p.kind === 'kick' && /extra point|two-point|2-pt/i.test(p.text))).pop() ?? counted[counted.length - 1];
    const first = counted[0] ?? g[0];
    const isLast = i === groups.length - 1;
    const { result, scoring } = resultOf(last, live && isLast);
    const secs = last ? Math.max(0, elapsed(last) - elapsed(first)) : 0;
    return {
      key: `${first.id}-${i}`,
      team: owner(g) ?? first.team,
      quarter: first.quarter,
      plays: g,
      result,
      scoring,
      playCount: counted.filter((p) => p.kind !== 'penalty').length,
      yards: counted.reduce((n, p) => n + (p.kind === 'punt' || p.kind === 'kick' ? 0 : p.yards ?? 0), 0),
      time: `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`
    };
  });
  return drives.reverse();
}

/** Win-probability change (home perspective, in points) caused by each play. Keyed by play id. */
export function wpDeltas(plays: Play[], pregame?: number): Map<string, number> {
  const asc = plays.slice().reverse();
  const out = new Map<string, number>();
  let prev = pregame;
  for (const p of asc) {
    if (p.homeWinProb == null) continue;
    if (prev != null) out.set(p.id, Math.round((p.homeWinProb - prev) * 100));
    prev = p.homeWinProb;
  }
  return out;
}
