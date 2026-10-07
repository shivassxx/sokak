/**
 * The kıraathane TV: staff (owner/admins) put a derby on and every salon watches the same
 * simulated match. Team names are colour nicknames only — no real club names or logos.
 */
export interface TvTeam {
  id: string;
  /** shown on the scoreboard (Turkish) */
  name: string;
  /** 3-letter scoreboard code */
  short: string;
  /** shirt colours [main, second] as #rrggbb */
  colors: [string, string];
}

export const TV_TEAMS: readonly TvTeam[] = [
  { id: 'sarikirmizi', name: 'Sarı-Kırmızılar', short: 'SKR', colors: ['#a90432', '#fdb912'] },
  { id: 'sarilacivert', name: 'Sarı-Lacivertliler', short: 'SLC', colors: ['#002d72', '#ffed00'] },
  { id: 'siyahbeyaz', name: 'Siyah-Beyazlılar', short: 'SYB', colors: ['#111111', '#ffffff'] },
  { id: 'bordomavi', name: 'Bordo-Mavililer', short: 'BRM', colors: ['#7b1c2e', '#5fa8dd'] },
  { id: 'yesilbeyaz', name: 'Yeşil-Beyazlılar', short: 'YŞB', colors: ['#00843d', '#ffffff'] },
];

export const tvTeam = (id: string): TvTeam | undefined => TV_TEAMS.find((t) => t.id === id);

/** What the server broadcasts to every salon: the match is deterministic from `seed` and `startedAt`. */
export interface TvBroadcast {
  /** unique per broadcast */
  id: string;
  home: string;
  away: string;
  /** epoch ms (server clock) of the kick-off */
  startedAt: number;
  seed: number;
  /** staff username that started it (shown in the admin panel only) */
  by: string;
}
