import { useRoute } from './data/router';
import { HomePage } from './pages/HomePage';
import { GamesPage } from './pages/GamesPage';
import { GamePage } from './pages/GamePage';
import { PlaysPage } from './pages/PlaysPage';
import { StandingsPage } from './pages/StandingsPage';
import { TeamPage } from './pages/TeamPage';
import { SearchPage } from './pages/SearchPage';

export function App() {
  const r = useRoute();
  switch (r.name) {
    case 'games': return <GamesPage />;
    case 'game': return <GamePage key={r.id} id={r.id} />;
    case 'plays': return <PlaysPage key={r.id} id={r.id} />;
    case 'schedule': return <GamesPage />;
    case 'standings': return <StandingsPage key={r.conf ?? 'all'} conf={r.conf} />;
    case 'team': return <TeamPage key={r.abbr} abbr={r.abbr} />;
    case 'search': return <SearchPage />;
    default: return <HomePage />;
  }
}
