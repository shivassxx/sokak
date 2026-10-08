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
  /** get on the vapur (docked, at the pier) / get off it (docked) */
  board: 'board',
  alight: 'alight',
  /** sit at a tavla table { table, seat? } (stand / config / start / bots reuse the table messages) */
  tavlaSit: 'tavlaSit',
  /** tavla action (TavlaAction) */
  tavla: 'tavla',
  /** tavla event relayed to everybody (TavlaEventMsg) */
  tavlaEvent: 'tavlaEvent',
  /** server → everybody: staff announcement banner text ("📢 Duyuru: …") */
  announce: 'announce',
  /** seyirci: watch a running match { kind: 'okey' | 'tavla', table } / stop watching */
  watch: 'watch',
  unwatch: 'unwatch',
  /** server → the table's players and spectators at hand end: HandReplayMsg */
  replay: 'replay',
  /** aksesuarlar: buy one (AccBuyMsg) / put one on or take it off (AccWearMsg) */
  accBuy: 'accBuy',
  accWear: 'accWear',
} as const;

/** Spectators (seyirci) allowed per table. */
export const SPECTATOR_LIMIT = 6;

/** One public move of an okey hand ("El sonu tekrarı"). Deck draws never carry the tile. */
export type ReplayMove =
  | { s: number; k: 'draw'; from: 'deck' | 'left'; tile?: number }
  | { s: number; k: 'discard'; tile: number; islek?: boolean }
  | { s: number; k: 'open'; mode: OpenMode; points: number }
  | { s: number; k: 'lay'; tiles: number[] }
  | { s: number; k: 'add'; tile: number; meld: number }
  | { s: number; k: 'swap'; meld: number }
  | { s: number; k: 'show'; tile: number };

/** End-of-hand replay: the finisher's melds (public by then) and the last public moves. */
export interface HandReplayMsg {
  table: number;
  handNo: number;
  finisher: number | null;
  okeyFinish: boolean;
  okey: { color: number; num: number };
  gosterge: number;
  /** melds owned by the finisher, as laid down */
  melds: Meld[];
  /** the last few public moves, oldest first */
  moves: ReplayMove[];
}

/** Close codes when staff remove a player (client shows a Turkish notice instead of reconnecting). */
export const STAFF_KICK_CODE = 4101;
export const STAFF_CLOSE_CODE = 4102;

/** Admin panel: one salon with its players (GET /api/admin/salons). Never carries device tokens. */
export interface StaffSalonInfo {
  roomId: string;
  name: string;
  private: boolean;
  players: { sessionId: string; name: string; money: number; isBot: boolean; connected: boolean; table: number }[];
}

/** Client → server tavla actions. `from` 24 = the bar, `to` 25 = bearing off. */
export type TavlaAction = { t: 'roll' } | { t: 'move'; from: number; to: number } | { t: 'undo' } | { t: 'end' };

/** tavla event relayed to everybody in the room (the client filters by table) */
export interface TavlaEventMsg {
  table: number;
  e: { type: string; [k: string]: unknown };
}

/** A tavla table (state schema → JSON). `view` is the engine's TavlaView as JSON. */
export interface KTavlaView {
  id: number;
  status: 'open' | 'playing' | 'between' | 'result';
  bet: number;
  /** points needed to win the match (1, 3 or 5) */
  target: number;
  /** game number within the match */
  game: number;
  seats: string[];
  hostId: string;
  score: number[];
  pot: number;
  turnEndsAt: number;
  view: string;
  /** JSON TavlaGameResultView of the last finished game */
  lastGame: string;
  /** JSON TavlaMatchResultView when the match is over */
  lastMatch: string;
}

export interface TavlaGameResultView {
  winner: number;
  value: number;
  mars: boolean;
  score: number[];
}

export interface TavlaMatchResultView {
  score: number[];
  winner: number;
  pot: number;
  /** money change per seat */
  payout: number[];
}

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

/** One row of the weekly leaderboard (never carries a device token). */
export interface WeeklyLeader {
  name: string;
  /** matches won / finished this week */
  wins: number;
  played: number;
  /** play money won from matches minus bets paid this week (can be negative) */
  net: number;
}

/** GET /api/leaders/weekly[?week=last][&device=…] */
export interface WeeklyBoard {
  /** ISO week in Istanbul time, e.g. "2026-W41", and its Monday / Sunday (YYYY-MM-DD) */
  week: string;
  start: string;
  end: string;
  /** top 10 by net winnings (ties: more wins first) */
  top: WeeklyLeader[];
  /** the asking device's own row and rank, null if it has no finished match that week */
  me: (WeeklyLeader & { rank: number }) | null;
  /** current week only: last week's winner ("Geçen haftanın şampiyonu") */
  champion?: WeeklyLeader | null;
}

/** Someone used their held item (smoke, eat, drink, read). */
export interface UsedMsg {
  id: string;
  item: string;
  /** fishing: what came out of the water (FISH id) */
  fish?: string;
}

/** "Masa ayarları" (host of an open table): okey bet/hands/mode/turn, tavla bet/points. Invalid values are ignored. */
export interface TableConfigMsg {
  bet?: unknown;
  hands?: unknown;
  /** okey: 'tekli' | 'esli' */
  mode?: unknown;
  /** okey: turn seconds, one of TURN_OPTIONS */
  turn?: unknown;
  /** tavla: match length */
  points?: unknown;
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
  /** discards made by each seat this hand */
  turnsDone: number[];
  /** eşli 101 (seats 0+2 vs 1+3) */
  partners?: boolean;
}

export interface HandResultView {
  finisher: number | null;
  scores: number[];
  multiplier: number;
  reason: 'finished' | 'deckEmpty';
  okeyFinish: boolean;
  /** eşli: this hand's team totals [seats 0+2, seats 1+3] */
  teams?: number[];
}

export interface MatchResultView {
  totals: number[];
  winners: number[];
  pot: number;
  /** money change per seat */
  payout: number[];
  /** eşli: match team totals [seats 0+2, seats 1+3] and the winning team(s) */
  teams?: number[];
  winnerTeams?: number[];
}

export interface OrderMsg {
  item: string;
  /** player id, 'table' for everybody at my table, or 'all' for the whole salon ("herkese çay benden") */
  to: string;
}

/** Çay zinciri: a round for the whole salon within this long of the last one (by someone else) adds a link. */
export const TEA_CHAIN_MS = 10 * 60_000;

export interface ServedMsg {
  from: string;
  to: string[];
  item: string;
  /** a round for the whole salon: which link of the çay zinciri it is (1 = a new chain) */
  chain?: number;
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
  /** index into AVATARS */
  avatar: number;
  /** worn / owned accessories (bitmasks over ACCESSORIES) */
  acc: number;
  accOwned: number;
  isBot: boolean;
  connected: boolean;
  money: number;
  table: number;
  seat: number;
  /** tavla table index (seat is then 0 or 1), −1 otherwise */
  tavla: number;
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
  /** today's mission progress (JSON MissionState) */
  missions: string;
  /** rank 1–3 on this week's leaderboard ("Haftanın en iyileri"), 0 otherwise */
  trophy: number;
  /** riding the vapur */
  aboard: boolean;
  /** seyirci: okey / tavla table being watched, −1 otherwise */
  watch: number;
  watchTavla: number;
}

export interface KTableView {
  id: number;
  status: 'open' | 'playing' | 'between' | 'result';
  bet: number;
  hands: number;
  /** eşli 101 (partners opposite each other) */
  partners: boolean;
  /** turn time in seconds (TURN_OPTIONS) */
  turnSecs: number;
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
  tavla: KTavlaView[];
  /** JSON TvBroadcast, '' when the TV shows its normal programme */
  tv?: string;
  /** mevsimlik olay (FestivalId), '' = none */
  festival?: string;
}
