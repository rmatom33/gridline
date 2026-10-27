import { useState } from 'react';
import type { Game } from '../shared/types';
import { data } from '../data/source';
import { cached, useNow, useOnline, usePoll } from '../data/usePoll';
import { href } from '../data/router';
import { clockTime, countdown, etDateKey, shortDay } from '../shared/format';
import { Badge, Card, ErrorCard, Footer, Icon, LinkButton, Nav, OfflineBanner, SampleBadge, Skeleton, teamName } from '../ui/parts';
import { GameRow, isLive } from '../ui/GameRow';
import { FinalRow, pollEvery } from './HomePage';

type Filter = 'all' | 'live' | 'upcoming' | 'final';

export function GamesPage() {
  const online = useOnline();
  const now = useNow();
  const [filter, setFilter] = useState<Filter>('all');
  const q = usePoll(() => data.scoreboard(), pollEvery, []);
  const st = usePoll(() => cached('standings', () => data.standings()), 0, []);
  const sb = q.data;
  const games = sb?.games ?? [];
  const today = etDateKey(now);
  const anyToday = games.some((g) => isLive(g) || etDateKey(g.kickoff) === today);

  const live = games.filter(isLive);
  const upcoming = games.filter((g) => g.status === 'scheduled' || g.status === 'postponed').sort((a, b) => a.kickoff.localeCompare(b.kickoff));
  const finals = games.filter((g) => g.status === 'final').sort((a, b) => b.kickoff.localeCompare(a.kickoff));

  // "No games today": show the next kickoff and this week's results.
  const noGames = sb && !anyToday;
  const next = useNextKickoff(noGames ? upcoming[0] : undefined, sb?.week);

  const groups: { title: string; games: Game[]; key: Filter }[] = [
    { title: 'Live now', games: live, key: 'live' },
    { title: 'Up next', games: upcoming, key: 'upcoming' },
    { title: 'Final', games: finals, key: 'final' }
  ];
  const filters: [Filter, string][] = [['all', 'All'], ['live', `Live${live.length ? ` · ${live.length}` : ''}`], ['upcoming', 'Upcoming'], ['final', 'Final']];

  return (
    <div className="app">
      <header className="top">
        <OfflineBanner online={online} stale={q.stale} updatedAt={q.updatedAt} retry={q.refresh} />
        <div className="top-row">
          <div className="brand">
            <span className="title-lg">Games</span>
            <span className="sub">{noGames ? new Date(now).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }) : sb ? `Week ${sb.week} · ${shortDay(now)}` : ''}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <SampleBadge />
            <a className="btn tint" href={href.schedule} style={{ height: 40, width: 'auto', fontSize: 13 }}><Icon name="calendar" size={16} /> Schedule</a>
          </div>
        </div>
        {!noGames && (
          <div className="pills" role="group" aria-label="Filter games">
            {filters.map(([k, label]) => <button key={k} aria-pressed={filter === k} onClick={() => setFilter(k)}>{label}</button>)}
          </div>
        )}
      </header>

      {!sb && q.error && <main className="page"><ErrorCard error={q.error} retry={q.refresh} /></main>}
      {!sb && !q.error && <Skeleton />}

      {sb && noGames && (
        <main className="page">
          <section className="card pad" aria-label="No games today" style={{ alignItems: 'center', textAlign: 'center', gap: 10, padding: '24px 16px' }}>
            <span style={{ width: 52, height: 52, borderRadius: 26, background: 'var(--tint-bg)', color: 'var(--tint-fg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="calendar" size={24} /></span>
            <span style={{ fontSize: 20, fontWeight: 700 }}>No games today</span>
            {next ? (
              <>
                <span className="sub" style={{ fontSize: 14 }}>Next kickoff is {shortDay(next.kickoff)}.</span>
                <a href={href.game(next.id)} style={{ width: '100%', background: 'var(--panel2)', borderRadius: 14, padding: 14, display: 'flex', flexDirection: 'column', gap: 12, color: 'var(--text)' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center' }}>
                    <Badge abbr={next.away.abbr} size={30} />
                    <span style={{ fontWeight: 600 }}>{teamName(next.away.abbr)} at {teamName(next.home.abbr)}</span>
                    <Badge abbr={next.home.abbr} size={30} />
                  </span>
                  <Countdown iso={next.kickoff} now={now} />
                </a>
              </>
            ) : <span className="sub" style={{ fontSize: 14 }}>Check the schedule for upcoming games.</span>}
            <LinkButton to={href.schedule} kind="primary">See the schedule</LinkButton>
          </section>

          {finals.length > 0 && (
            <Card title={`Week ${sb.week} results`} right={<span className="mono muted" style={{ fontSize: 12 }}>{finals.length} of {games.length}</span>}>
              {finals.map((g) => <FinalRow key={g.id} g={g} />)}
            </Card>
          )}
          {upcoming.length > 1 && (
            <Card title="Later this week">
              {upcoming.map((g) => <GameRow key={g.id} g={g} standings={st.data ?? undefined} showDay />)}
            </Card>
          )}
          <Footer />
        </main>
      )}

      {sb && !noGames && (
        <main className="page">
          {groups.filter((grp) => (filter === 'all' || filter === grp.key)).map((grp) => grp.games.length ? (
            <Card key={grp.key} title={grp.title} right={<span className="mono muted" style={{ fontSize: 12 }}>{grp.games.length}</span>}>
              {grp.games.map((g) => <GameRow key={g.id} g={g} standings={st.data ?? undefined} showDay={grp.key === 'upcoming' && etDateKey(g.kickoff) !== today} />)}
            </Card>
          ) : filter === grp.key ? <Card key={grp.key} title={grp.title}><p className="empty">No {grp.title.toLowerCase()} games right now.</p></Card> : null)}
          <Footer />
        </main>
      )}
      <Nav active="games" />
    </div>
  );
}

/** Next scheduled game: this week's first upcoming game, or next week's first game. */
function useNextKickoff(thisWeek: Game | undefined, week: number | undefined): Game | undefined {
  const nw = usePoll(() => (thisWeek || !week ? Promise.resolve(null) : cached(`schedule-${week + 1}`, () => data.schedule(week + 1))), 0, [thisWeek?.id, week]);
  if (thisWeek) return thisWeek;
  return nw.data?.games.filter((g) => g.status === 'scheduled').sort((a, b) => a.kickoff.localeCompare(b.kickoff))[0];
}

export function Countdown({ iso, now }: { iso: string; now: number }) {
  const c = countdown(iso, now);
  const label = c.days > 0 ? `Kickoff in ${c.days} days ${c.hours} hours` : `Kickoff in ${c.hours} hours ${c.mins} minutes`;
  const cells = c.days > 0
    ? [[String(c.days), c.days === 1 ? 'day' : 'days'], [String(c.hours).padStart(2, '0'), 'hours']]
    : [[String(c.hours).padStart(2, '0'), 'hours'], [String(c.mins).padStart(2, '0'), 'min']];
  const day = new Date(iso).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'America/New_York' });
  return (
    <div className="countdown" role="timer" aria-label={label}>
      {cells.map(([v, k]) => <div key={k}><div className="v">{v}</div><div className="k">{k}</div></div>)}
      <div><div className="v">{clockTime(iso).replace(/ [AP]M$/, '')}</div><div className="k">{clockTime(iso).slice(-2)} ET{c.days > 0 ? ` ${day}` : ' kickoff'}</div></div>
    </div>
  );
}
