// ---------------------------------------------------------------------------
// Game-time weather. The data feed's forecast fields describe the day, not the
// kickoff hour, so for upcoming and live games we look up the hourly forecast
// at the stadium for the hour the game starts (Open-Meteo, free, no key).
// If the lookup fails, the feed's own values are kept.
// ---------------------------------------------------------------------------
import type { Game, Sky } from '../src/shared/types';

/** Home stadium coordinates, used when the feed gives none. */
const HOME: Record<string, [number, number]> = {
  ARI: [33.5276, -112.2626], ATL: [33.7554, -84.4008], BAL: [39.278, -76.6227], BUF: [42.7738, -78.787],
  CAR: [35.2258, -80.8528], CHI: [41.8623, -87.6167], CIN: [39.0955, -84.5161], CLE: [41.5061, -81.6995],
  DAL: [32.7473, -97.0945], DEN: [39.7439, -105.0201], DET: [42.34, -83.0456], GB: [44.5013, -88.0622],
  HOU: [29.6847, -95.4107], IND: [39.7601, -86.1639], JAX: [30.3239, -81.6373], KC: [39.0489, -94.4839],
  LV: [36.0909, -115.1833], LAC: [33.9535, -118.3392], LAR: [33.9535, -118.3392], MIA: [25.958, -80.2389],
  MIN: [44.9737, -93.2575], NE: [42.0909, -71.2643], NO: [29.9511, -90.0812], NYG: [40.8135, -74.0745],
  NYJ: [40.8135, -74.0745], PHI: [39.9008, -75.1675], PIT: [40.4468, -80.0158], SF: [37.403, -121.97],
  SEA: [47.5952, -122.3316], TB: [27.9759, -82.5033], TEN: [36.1665, -86.7713], WAS: [38.9078, -76.8645]
};

/** WMO weather code → the icon we show. */
export function skyFromCode(code: number | null | undefined): Sky | null {
  if (code == null) return null;
  if (code <= 1) return 'sun';
  if (code === 2) return 'partly';
  if (code === 3) return 'cloud';
  if (code === 45 || code === 48) return 'fog';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  if (code >= 95) return 'storm';
  if (code >= 51) return 'rain';
  return 'cloud';
}

/** Best guess from a text description such as "Mostly Cloudy" or "Light Snow". */
export function skyFromText(text: unknown): Sky | null {
  const t = String(text ?? '').toLowerCase();
  if (!t) return null;
  if (/thunder|storm/.test(t)) return 'storm';
  if (/snow|sleet|flurr|ice/.test(t)) return 'snow';
  if (/rain|shower|drizzle/.test(t)) return 'rain';
  if (/fog|mist|haze/.test(t)) return 'fog';
  if (/partly|mostly sunny|few clouds|scattered/.test(t)) return 'partly';
  if (/cloud|overcast/.test(t)) return 'cloud';
  if (/sun|clear|fair/.test(t)) return 'sun';
  return null;
}

const DESC: Record<Sky, string> = { sun: 'Clear', partly: 'Partly cloudy', cloud: 'Cloudy', fog: 'Fog', rain: 'Rain', snow: 'Snow', storm: 'Thunderstorms' };
const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

type Hourly = { time: string[]; temperature_2m: number[]; precipitation_probability: (number | null)[]; weather_code: number[]; wind_speed_10m: number[]; wind_direction_10m: number[] };
const cache = new Map<string, { at: number; p: Promise<Hourly | null> }>();
const TTL = 30 * 60_000;

function hourly(lat: number, lon: number, date: string): Promise<Hourly | null> {
  const key = `${lat.toFixed(2)},${lon.toFixed(2)},${date}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.p;
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    '&hourly=temperature_2m,precipitation_probability,weather_code,wind_speed_10m,wind_direction_10m' +
    `&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=GMT&start_date=${date}&end_date=${date}`;
  const p = (async () => {
    try {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), 2500);
      const res = await fetch(url, { signal: ctl.signal });
      clearTimeout(timer);
      if (!res.ok) return null;
      return ((await res.json()) as { hourly?: Hourly }).hourly ?? null;
    } catch {
      return null;
    }
  })();
  cache.set(key, { at: Date.now(), p });
  if (cache.size > 500) for (const [k, v] of cache) if (Date.now() - v.at > TTL) cache.delete(k);
  return p;
}

/** Replace feed weather with the forecast for each game's kickoff hour. Never throws. */
export async function applyKickoffWeather(games: Game[]): Promise<void> {
  const now = Date.now();
  await Promise.all(games.map(async (g) => {
    if (!g || g.weather?.dome) return;
    if (g.status !== 'scheduled' && g.status !== 'live' && g.status !== 'halftime') return;
    const ko = new Date(g.kickoff).getTime();
    // Open-Meteo forecasts 16 days ahead; live games keep their kickoff-hour forecast.
    if (!Number.isFinite(ko) || ko < now - 5 * 3600_000 || ko > now + 15 * 86400_000) return;
    const lat = g.venue?.lat ?? HOME[g.home.abbr]?.[0];
    const lon = g.venue?.lon ?? HOME[g.home.abbr]?.[1];
    if (lat == null || lon == null || !Number.isFinite(lat) || !Number.isFinite(lon)) return;
    const iso = new Date(Math.round(ko / 3600_000) * 3600_000).toISOString();
    const h = await hourly(lat, lon, iso.slice(0, 10));
    const i = h?.time.indexOf(iso.slice(0, 13) + ':00') ?? -1;
    if (!h || i < 0 || h.temperature_2m[i] == null) return;
    const sky = skyFromCode(h.weather_code[i]);
    const dir = h.wind_direction_10m[i];
    g.weather = {
      dome: false,
      tempF: Math.round(h.temperature_2m[i]),
      windMph: h.wind_speed_10m[i] != null ? Math.round(h.wind_speed_10m[i]) : null,
      windDir: dir != null ? COMPASS[Math.round(dir / 45) % 8] : null,
      precipPct: h.precipitation_probability[i] ?? null,
      sky,
      description: sky ? DESC[sky] : g.weather?.description ?? null,
      atKickoff: true
    };
  }));
}
