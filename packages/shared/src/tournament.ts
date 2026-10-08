/**
 * Okey turnuvası (one per salon): up to 8 entrants pay an entry fee; two semi-final tables
 * play one hand each, the best two of each table (lowest totals) meet at the final table for
 * two hands. The prize pool is the humans' fees only (bots pay nothing and win nothing), so
 * filling the field with bots never prints money: 1st 50 %, 2nd 30 %, 3rd 20 %.
 */
export const TOUR_SIZE = 8;
export const TOUR_FEES = [0, 100, 250, 500] as const;
export const TOUR_PRIZES = [0.5, 0.3, 0.2] as const;
export const TOUR_HANDS = { semi: 1, final: 2 } as const;
/** pause between the semis and the final (ms) */
export const TOUR_BREAK_MS = 8000;

export type TourPhase = 'idle' | 'open' | 'semis' | 'final' | 'done';

export interface TourEntrant {
  id: string;
  name: string;
  bot: boolean;
}

export interface TourTableView {
  table: number;
  /** the four at the table (names; a player who left is shown as the bot that replaced them) */
  players: TourEntrant[];
  /** match totals once it has finished */
  totals: number[] | null;
}

export interface TourView {
  phase: TourPhase;
  fee: number;
  /** who opened it (starts it) */
  host: string;
  entrants: TourEntrant[];
  /** fees paid by humans */
  pool: number;
  semis: TourTableView[];
  final: TourTableView | null;
  /** final standings (done): place 1… with the prize paid */
  podium: { name: string; bot: boolean; prize: number }[];
}

/** Split the pool over the places (rounded down; the first place gets the remainder). */
export function tourPrizes(pool: number): number[] {
  const p = TOUR_PRIZES.map((f) => Math.floor(pool * f));
  p[0]! += pool - p.reduce((a, b) => a + b, 0);
  return p;
}

/** Order seats by match total (lowest first); ties keep the seat order. */
export function tourRanking(totals: readonly number[]): number[] {
  return totals.map((t, s) => [t, s] as const).sort((a, b) => a[0] - b[0] || a[1] - b[1]).map(([, s]) => s);
}
