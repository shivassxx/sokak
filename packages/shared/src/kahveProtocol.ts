import type { Meld, OpenMode } from './kahveTypes';

/** Messages of the kahvehane room. */
export const KMSG = {
  sit: 'sit',
  stand: 'stand',
  tableConfig: 'tableConfig',
  tableStart: 'tableStart',
  tableBot: 'tableBot',
  okey: 'okey',
  hand: 'hand',
  okeyEvent: 'okeyEvent',
  okeyError: 'okeyError',
  order: 'order',
  served: 'served',
  credit: 'credit',
  money: 'money',
} as const;

/** Client → server okey actions. */
export type OkeyAction =
  | { t: 'draw' }
  | { t: 'take' }
  | { t: 'putBack' }
  | { t: 'open'; groups: number[][] }
  | { t: 'lay'; tiles: number[] }
  | { t: 'add'; tile: number; meld: number }
  | { t: 'swap'; tile: number; meld: number }
  | { t: 'discard'; tile: number }
  | { t: 'deckEmpty' }
  | { t: 'steal'; tile: number; pile: number }
  | { t: 'accuse' };

/** Public table view (JSON in the schema). */
export interface TableView {
  gosterge: number;
  okey: { color: number; num: number };
  deck: number;
  handCounts: number[];
  discards: number[][];
  melds: Meld[];
  opened: (OpenMode | null)[];
  penalties: number[];
  turn: number;
  phase: 'draw' | 'play' | 'ended';
  takenFromLeft: boolean;
  stealUsed: boolean[];
  dealer: number;
}

export interface HandResultView {
  finisher: number | null;
  scores: number[];
  multiplier: number;
  reason: 'finished' | 'deckEmpty';
  okeyFinish: boolean;
}

export interface MatchResultView {
  totals: number[];
  winners: number[];
  pot: number;
  /** money change per seat */
  payout: number[];
}

export interface OrderMsg {
  item: string;
  /** player id, or 'table' for everybody at my table */
  to: string;
}

export interface ServedMsg {
  from: string;
  to: string[];
  item: string;
}

/** okey event relayed to everybody at the table (+ names resolved client-side) */
export interface OkeyEventMsg {
  table: number;
  e: { type: string; [k: string]: unknown };
}

export interface KPlayerView {
  id: string;
  name: string;
  color: string;
  hat: number;
  hair: number;
  skin: number;
  isBot: boolean;
  connected: boolean;
  money: number;
  table: number;
  seat: number;
}

export interface KTableView {
  id: number;
  status: 'open' | 'playing' | 'between' | 'result';
  bet: number;
  hands: number;
  handNo: number;
  seats: string[];
  hostId: string;
  totals: number[];
  pot: number;
  turnEndsAt: number;
  view: string;
  lastHand: string;
  lastMatch: string;
}

export interface KahveView {
  players: Record<string, KPlayerView>;
  tables: KTableView[];
}
