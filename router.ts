import { useEffect, useState } from 'react';

// Hash routing works on any static host with no server rewrites. Routes are
// plain names so links can be shared anywhere:
//   #home  #games  #game-<id>  #plays-<id>  #schedule  #standings[-afc|-nfc]  #team-KC  #search
export type Route =
  | { name: 'home' }
  | { name: 'games' }
  | { name: 'game'; id: string }
  | { name: 'plays'; id: string }
  | { name: 'schedule' }
  | { name: 'standings'; conf?: 'AFC' | 'NFC' }
  | { name: 'team'; abbr: string }
  | { name: 'search' };

export function parse(hash: string): Route {
  const path = hash.replace(/^#\/?/, '');
  let m = path.match(/^game[-/]([\w-]+)/);
  if (m) return { name: 'game', id: m[1] };
  m = path.match(/^plays[-/]([\w-]+)/);
  if (m) return { name: 'plays', id: m[1] };
  m = path.match(/^team[-/]([A-Za-z]{2,4})/);
  if (m) return { name: 'team', abbr: m[1].toUpperCase() };
  m = path.match(/^standings(?:[-/](afc|nfc))?/i);
  if (m) return { name: 'standings', conf: m[1] ? (m[1].toUpperCase() as 'AFC' | 'NFC') : undefined };
  if (path.startsWith('games') || path.startsWith('scores')) return { name: 'games' };
  if (path.startsWith('schedule')) return { name: 'schedule' };
  if (path.startsWith('search')) return { name: 'search' };
  return { name: 'home' };
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parse(window.location.hash));
  useEffect(() => {
    const on = () => {
      setRoute(parse(window.location.hash));
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}

export const href = {
  home: '#home',
  games: '#games',
  game: (id: string) => `#game-${id}`,
  plays: (id: string) => `#plays-${id}`,
  schedule: '#schedule',
  standings: (conf?: 'AFC' | 'NFC') => (conf ? `#standings-${conf.toLowerCase()}` : '#standings'),
  team: (abbr: string) => `#team-${abbr}`,
  search: '#search'
};

/** Back button: return to the previous Gridline page if there is one, otherwise go to `fallback`. */
let navigated = false;
if (typeof window !== 'undefined') window.addEventListener('hashchange', () => { navigated = true; });

export function back(fallback: string) {
  return (e: { preventDefault: () => void }) => {
    e.preventDefault();
    if (navigated) window.history.back();
    else window.location.hash = fallback;
  };
}
