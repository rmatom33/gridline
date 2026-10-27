import type { Game } from '../shared/types';
import { data } from '../data/source';
import { cached, useOnline, usePoll } from '../data/usePoll';
import { href } from '../data/router';
import { etDateKey, kickoffDay } from '../shared/format';
import { BackButton, Card, ErrorCard, Footer, Nav, OfflineBanner, SampleBadge, Skeleton } from '../ui/parts';
import { GameRow } from '../ui/GameRow';

export function SchedulePage() {
  const online = useOnline();
  // Next week's games. The current week lives on the Games tab.
  const q = usePoll(async () => {
    const sb = await data.scoreboard();
    const week = sb.week + 1;
    return cached(`schedule-${week}`, () => data.schedule(week), 10 * 60_000);
  }, 10 * 60_000, []);
  const st = usePoll(() => cached('standings', () => data.standings()), 0, []);
  const sc = q.data;

  const byDay = new Map<string, Game[]>();
  for (const g of (sc?.games ?? []).slice().sort((a, b) => a.kickoff.localeCompare(b.kickoff))) {
    const k = etDateKey(g.kickoff);
    byDay.set(k, [...(byDay.get(k) ?? []), g]);
  }
  const days = [...byDay.values()];
  const range = days.length
    ? `${new Date(days[0][0].kickoff).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/New_York' })}–${new Date(days[days.length - 1][0].kickoff).toLocaleDateString('en-US', { day: 'numeric', timeZone: 'America/New_York' })}`
    : '';

  return (
    <div className="app">
      <header className="top">
        <OfflineBanner online={online} stale={q.stale} updatedAt={q.updatedAt} retry={q.refresh} />
        <div className="top-row slim">
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
            <BackButton fallback={href.games} label="Back to games" />
            <span className="brand">
              <span style={{ fontSize: 18, fontWeight: 700 }}>Schedule</span>
              <span className="sub">{sc ? `Week ${sc.week}${range ? ` · ${range}` : ''}` : ''}</span>
            </span>
          </div>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><SampleBadge /><span className="kicker">TIMES IN ET</span></span>
        </div>
      </header>

      {!sc && q.error && <main className="page"><ErrorCard error={q.error} retry={q.refresh} /></main>}
      {!sc && !q.error && <Skeleton />}

      {sc && (
        <main className="page">
          {!days.length && <Card title={`Week ${sc.week}`}><p className="empty">No games scheduled for this week.</p></Card>}
          {days.map((games) => (
            <Card key={games[0].id} title={kickoffDay(games[0].kickoff)} right={<span className="mono muted" style={{ fontSize: 12 }}>{games.length} game{games.length === 1 ? '' : 's'}</span>}>
              {games.map((g) => <GameRow key={g.id} g={g} mode="schedule" standings={st.data ?? undefined} />)}
            </Card>
          ))}
          <Footer />
        </main>
      )}
      <Nav active="games" />
    </div>
  );
}
