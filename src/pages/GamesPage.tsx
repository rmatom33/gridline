import { useState } from 'react';
import type { Game } from '../shared/types';
import { data } from '../data/source';
import { cached, useOnline, usePoll } from '../data/usePoll';
import { etDateKey, TZ, tzLong } from '../shared/format';
import { ErrorCard, Footer, Icon, Nav, OfflineBanner, Skeleton, TopBar } from '../ui/parts';
import { GameCard } from '../ui/GameRow';
import { pollEvery } from './HomePage';

const dayTitle = (iso: string) => new Date(iso).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: TZ });

/** Games: pick any week; games grouped by day with kickoff, TV, odds and weather. */
export function GamesPage({ initialWeek }: { initialWeek?: number } = {}) {
  const online = useOnline();
  const sbq = usePoll(() => data.scoreboard(), pollEvery, []);
  const st = usePoll(() => cached('standings', () => data.standings()), 0, []);
  const current = sbq.data?.week;
  const [picked, setPicked] = useState<number | null>(initialWeek ?? null);
  const week = picked ?? current;
  const other = week != null && week !== current;
  const scq = usePoll(() => (other && week ? cached(`schedule-${week}`, () => data.schedule(week), 5 * 60_000) : Promise.resolve(null)), 0, [other ? week : 0]);
  const lastWeek = Math.max(18, ...(scq.data?.weeks ?? []).filter((w) => w <= 22));
  const games: Game[] | undefined = other ? scq.data?.games : sbq.data?.games;
  const loading = !games && !(other ? scq.error : sbq.error);
  const error = other ? scq.error : sbq.error;
  const season = sbq.data?.season ?? new Date().getFullYear();

  const byDay = new Map<string, Game[]>();
  for (const g of (games ?? []).slice().sort((a, b) => a.kickoff.localeCompare(b.kickoff))) {
    const k = etDateKey(g.kickoff);
    byDay.set(k, [...(byDay.get(k) ?? []), g]);
  }

  // Three whole weeks always fit: the chosen week in the middle where possible.
  const mid = week ? Math.min(Math.max(week, 2), lastWeek - 1) : 2;
  const shown = [mid - 1, mid, mid + 1];
  const go = (n: number) => setPicked(Math.min(lastWeek, Math.max(1, n)));

  return (
    <div className="app">
      <header className="top">
        <OfflineBanner online={online} stale={sbq.stale} updatedAt={sbq.updatedAt} retry={sbq.refresh} />
        <TopBar />
        <div className="chero">
          <span className="wk-tag">Games</span><span>{season} regular season</span>
        </div>
      </header>
        {week != null && (
          <nav className="wkpick light" aria-label="Choose a week">
            <button className="arr" onClick={() => go(week - 1)} disabled={week <= 1} aria-label="Earlier week"><Icon name="back" size={20} stroke={2.6} /></button>
            {shown.map((n) => (
              <button key={n} aria-current={n === week ? 'true' : undefined} onClick={() => go(n)}>WEEK {n}</button>
            ))}
            <button className="arr" onClick={() => go(week + 1)} disabled={week >= lastWeek} aria-label="Later week"><Icon name="next" size={20} stroke={2.6} /></button>
          </nav>
        )}

      {error && !games && <main className="page"><ErrorCard error={error} retry={other ? scq.refresh : sbq.refresh} /></main>}
      {loading && <Skeleton />}

      {games && week != null && (
        <main className="page">
          <h2 className="wk-h">Week {week}{week === current ? ' · this week' : ''}</h2>
          <p className="tzline">Times in {tzLong()}</p>
          {!games.length && <p className="byes">No games scheduled for this week yet.</p>}
          {[...byDay.values()].map((list) => (
            <section key={list[0].id} className="glist" aria-label={dayTitle(list[0].kickoff)}>
              <div className="dayh"><b>{dayTitle(list[0].kickoff)}</b><i /></div>
              {list.map((g) => <GameCard key={g.id} g={g} standings={st.data ?? undefined} />)}
            </section>
          ))}
          <Footer />
        </main>
      )}
      <Nav active="games" />
    </div>
  );
}
