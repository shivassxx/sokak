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
  buy: 'buy',
  use: 'use',
  drop: 'drop',
  sitSpot: 'sitSpot',
  used: 'used',
  quickSeat: 'quickSeat',
  fillBots: 'fillBots',
  notice: 'notice',
  voice: 'voice',
  signal: 'signal',
  /** client is wired up (after a reload / reconnect): resend private state */
  resync: 'resync',
} as const;

/** WebRTC signalling relayed by the server between two voice users. */
export interface SignalMsg {
  /** recipient (client → server) or sender (server → client) */
  peer: string;
  /** SDP offer/answer or ICE candidate */
  data: { sdp?: { type: string; sdp: string }; ice?: unknown };
}

/** Lobby listing of a kahvehane room (GET /api/salons). */
export interface SalonInfo {
  roomId: string;
  name: string;
  players: number;
  max: number;
  /** tables with a match going on */
  playing: number;
  /** open tables where somebody is waiting for players */
  waiting: number;
}

/** Room metadata kept by the server for the lobby. */
export interface SalonMeta {
  name: string;
  private: boolean;
  playing: number;
  waiting: number;
  humans: number;
  /** richest players right now (public salons feed the lobby leaderboard) */
  top?: { name: string; money: number }[];
}

/** One row of the lobby leaderboard (online players, all public salons). */
export interface LeaderInfo {
  name: string;
  money: number;
  salon: string;
}

/** Someone used their held item (smoke, eat, drink, read). */
export interface UsedMsg {
  id: string;
  item: string;
  /** fishing: what came out of the water (FISH id) */
  fish?: string;
}

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
  | { t: 'accuse' }
  | { t: 'show' };

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
  /** who showed the gösterge this hand (−101) */
  shown: boolean[];
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
  holding: string;
  uses: number;
  spot: number;
  /** opted into voice chat */
  voice: boolean;
  /** fishing: 0 none, 1 line in the water, 2 a bite */
  fish: number;
  /** finished matches / wins (kept with the device wallet) */
  played: number;
  won: number;
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
  name?: string;
  players: Record<string, KPlayerView>;
  tables: KTableView[];
}
