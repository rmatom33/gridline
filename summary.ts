// Writes a short game summary from the play-by-play and score.
// Deterministic and template based, so it never invents facts. You can later
// swap in an LLM, feeding it only these licensed facts.
import type { GameDetail, Play } from './types';
import { team } from './teams';

function name(abbr: string) {
  return team(abbr).city;
}

export function buildSummary(g: GameDetail): string {
  const a = g.away, h = g.home;
  const as = a.score ?? 0, hs = h.score ?? 0;
  if (g.status === 'scheduled' || g.status === 'postponed') {
    const fav = g.odds?.spread == null ? null : g.odds.spread < 0 ? h.abbr : a.abbr;
    const line = g.odds?.spread == null ? '' : ` ${name(fav!)} is favored by ${Math.abs(g.odds.spread)}.`;
    return `${name(a.abbr)} (${a.record ?? '–'}) visits ${name(h.abbr)} (${h.record ?? '–'}).${line}`;
  }
  const scoring = g.plays.filter((p) => p.kind === 'score' || p.kind === 'turnover').slice(0, 3);
  const leader = as === hs ? null : as > hs ? a.abbr : h.abbr;
  const trailer = leader === a.abbr ? h.abbr : a.abbr;
  const margin = Math.abs(as - hs);
  const scoreText = `${name(a.abbr)} ${as}, ${name(h.abbr)} ${hs}`;
  let open: string;
  if (g.status === 'final') {
    open = leader ? `${name(leader)} beat ${name(trailer)} ${Math.max(as, hs)}-${Math.min(as, hs)}${g.overtime ? ' in overtime' : ''}.` : `${scoreText}, final.`;
  } else if (g.status === 'halftime') {
    open = leader ? `${name(leader)} leads ${name(trailer)} by ${margin} at halftime (${scoreText}).` : `Tied ${as}-${hs} at halftime.`;
  } else {
    const q = g.quarter && g.quarter >= 5 ? 'overtime' : `the ${['1st', '2nd', '3rd', '4th'][(g.quarter ?? 1) - 1]} quarter`;
    open = leader ? `${name(leader)} leads by ${margin} with ${g.clock} left in ${q} (${scoreText}).` : `Tied ${as}-${hs} with ${g.clock} left in ${q}.`;
  }
  const moments = scoring.map((p: Play) => describe(p)).filter(Boolean);
  const now = g.status === 'live' && g.possession && g.situation?.spot
    ? ` ${name(g.possession === 'home' ? h.abbr : a.abbr)} has the ball at the ${g.situation.spot}.`
    : '';
  return [open, moments.length ? `Key moments: ${moments.join(' ')}` : '', now].filter(Boolean).join(' ').trim();
}

function describe(p: Play): string {
  const q = p.quarter >= 5 ? 'OT' : `Q${p.quarter}`;
  return `${p.text.replace(/\.$/, '')} (${q} ${p.clock}).`;
}
