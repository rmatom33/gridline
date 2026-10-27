// Team names are used as plain text (nominative use). No logos or marks are
// shipped; each team is shown as its abbreviation on its primary color.

export interface TeamInfo {
  abbr: string;
  city: string;
  name: string;
  conf: 'AFC' | 'NFC';
  div: 'East' | 'North' | 'South' | 'West';
  color: string;
  text: string; // readable text color on `color`
  dome?: boolean;
}

const T = (
  abbr: string, city: string, name: string, conf: 'AFC' | 'NFC', div: TeamInfo['div'],
  color: string, text = '#FFFFFF', dome = false
): TeamInfo => ({ abbr, city, name, conf, div, color, text, dome });

export const TEAMS: Record<string, TeamInfo> = Object.fromEntries([
  T('BUF', 'Buffalo', 'Bills', 'AFC', 'East', '#00338D'),
  T('MIA', 'Miami', 'Dolphins', 'AFC', 'East', '#008E97'),
  T('NE', 'New England', 'Patriots', 'AFC', 'East', '#002244'),
  T('NYJ', 'New York', 'Jets', 'AFC', 'East', '#125740'),
  T('BAL', 'Baltimore', 'Ravens', 'AFC', 'North', '#241773'),
  T('CIN', 'Cincinnati', 'Bengals', 'AFC', 'North', '#FB4F14', '#111111'),
  T('CLE', 'Cleveland', 'Browns', 'AFC', 'North', '#311D00'),
  T('PIT', 'Pittsburgh', 'Steelers', 'AFC', 'North', '#FFB612', '#111111'),
  T('HOU', 'Houston', 'Texans', 'AFC', 'South', '#03202F', '#FFFFFF', true),
  T('IND', 'Indianapolis', 'Colts', 'AFC', 'South', '#002C5F', '#FFFFFF', true),
  T('JAX', 'Jacksonville', 'Jaguars', 'AFC', 'South', '#006778'),
  T('TEN', 'Tennessee', 'Titans', 'AFC', 'South', '#4B92DB', '#111111'),
  T('DEN', 'Denver', 'Broncos', 'AFC', 'West', '#FB4F14', '#111111'),
  T('KC', 'Kansas City', 'Chiefs', 'AFC', 'West', '#E31837'),
  T('LV', 'Las Vegas', 'Raiders', 'AFC', 'West', '#3A3A3A', '#FFFFFF', true),
  T('LAC', 'Los Angeles', 'Chargers', 'AFC', 'West', '#0080C6', '#FFFFFF', true),
  T('DAL', 'Dallas', 'Cowboys', 'NFC', 'East', '#1B3A6B', '#FFFFFF', true),
  T('NYG', 'New York', 'Giants', 'NFC', 'East', '#0B2265'),
  T('PHI', 'Philadelphia', 'Eagles', 'NFC', 'East', '#004C54'),
  T('WAS', 'Washington', 'Commanders', 'NFC', 'East', '#5A1414'),
  T('CHI', 'Chicago', 'Bears', 'NFC', 'North', '#0B162A'),
  T('DET', 'Detroit', 'Lions', 'NFC', 'North', '#0076B6', '#FFFFFF', true),
  T('GB', 'Green Bay', 'Packers', 'NFC', 'North', '#203731'),
  T('MIN', 'Minnesota', 'Vikings', 'NFC', 'North', '#4F2683', '#FFFFFF', true),
  T('ATL', 'Atlanta', 'Falcons', 'NFC', 'South', '#A71930', '#FFFFFF', true),
  T('CAR', 'Carolina', 'Panthers', 'NFC', 'South', '#0085CA', '#111111'),
  T('NO', 'New Orleans', 'Saints', 'NFC', 'South', '#9F8958', '#111111', true),
  T('TB', 'Tampa Bay', 'Buccaneers', 'NFC', 'South', '#D50A0A'),
  T('ARI', 'Arizona', 'Cardinals', 'NFC', 'West', '#97233F', '#FFFFFF', true),
  T('LAR', 'Los Angeles', 'Rams', 'NFC', 'West', '#003594', '#FFFFFF', true),
  T('SF', 'San Francisco', '49ers', 'NFC', 'West', '#AA0000'),
  T('SEA', 'Seattle', 'Seahawks', 'NFC', 'West', '#002244')
].map((t) => [t.abbr, t]));

/** Provider abbreviations that differ from ours. */
const ALIASES: Record<string, string> = { JAC: 'JAX', LA: 'LAR', WSH: 'WAS', OAK: 'LV', SD: 'LAC', STL: 'LAR' };

export function normalizeAbbr(abbr: string | null | undefined): string {
  if (!abbr) return '';
  const a = abbr.toUpperCase();
  return ALIASES[a] ?? a;
}

export function team(abbr: string): TeamInfo {
  return TEAMS[abbr] ?? { abbr, city: abbr, name: '', conf: 'AFC', div: 'East', color: '#2A333F', text: '#FFFFFF' };
}
