/** Network protocol shared by client, server and headless bots. */

export const OUTFIT_COLORS = [
  '#e74c3c',
  '#3498db',
  '#2ecc71',
  '#f1c40f',
  '#9b59b6',
  '#e67e22',
  '#1abc9c',
  '#ff6fb5',
  '#ecf0f1',
  '#34495e',
] as const;

export const NAME_MIN = 2;
export const NAME_MAX = 14;

export const MSG = {
  input: 'i',
  snapshot: 's',
  start: 'start',
  addBot: 'addBot',
  removeBot: 'removeBot',
  spot: 'spot',
  emote: 'emote',
  chat: 'chat',
  event: 'ev',
  summary: 'summary',
  teleport: 'tp',
} as const;

export interface JoinOptions {
  name?: string;
  color?: string;
}

/** client → server, one per simulation step */
export interface InputMsg {
  /** sequence number */
  s: number;
  mx: number;
  mz: number;
  /** jump / crouch as 0|1 */
  j: number;
  c: number;
  /** facing yaw */
  y: number;
}

/** [id, x, y, z, yaw, flags] — flags bit0 = crouching */
export type PlayerSnap = [string, number, number, number, number, number];

/** server → client, every tick */
export interface SnapshotMsg {
  /** server time ms */
  t: number;
  /** last processed input seq of the receiver */
  a: number;
  /** receiver's own authoritative body: x, y, z, vy, onGround(0|1) */
  me?: [number, number, number, number, number];
  /** other visible players */
  p: PlayerSnap[];
}

export interface TeleportMsg {
  x: number;
  y: number;
  z: number;
  yaw: number;
}

export const EMOTES = ['wave', 'laugh', 'dance', 'point'] as const;
export type EmoteId = (typeof EMOTES)[number];

export const QUICK_CHAT = ['Burası benim yerim!', 'Ebe geliyor!', 'Sobe!', 'Çok bekledim ya', 'Bir el daha!', 'Hadi ama!'] as const;

export interface EmoteMsg {
  id: string;
  e: EmoteId;
}

export interface ChatMsg {
  id: string;
  /** index into QUICK_CHAT */
  q: number;
}

/** Plain-JSON view of the replicated room state (what the UI reads). */
export type Phase = 'lobby' | 'ebeSelection' | 'counting' | 'seeking' | 'roundEnd';
export type Role = 'none' | 'ebe' | 'hider' | 'spectator';
export type HiderStatus = 'none' | 'hiding' | 'spotted' | 'caught' | 'safe';

export interface PlayerView {
  id: string;
  name: string;
  color: string;
  isBot: boolean;
  connected: boolean;
  role: Role;
  status: HiderStatus;
  score: number;
}

export interface RoomView {
  phase: Phase;
  timeLeft: number;
  round: number;
  ebeId: string;
  hostId: string;
  players: Record<string, PlayerView>;
}

/** Round summary as broadcast by the server (mirrors rules RoundSummary). */
export interface SummaryMsg {
  round: number;
  reason: 'allDone' | 'timeout' | 'ebeLeft';
  ebeId: string;
  firstCaughtId: string | null;
  bestHiderId: string | null;
  bestHiderMs: number;
  bestHiderSpot: string | null;
  longestSurvivorId: string | null;
  longestSurvivorMs: number;
  caught: string[];
  safe: string[];
  herkesKurtuldu: boolean;
  nextEbeId: string | null;
}

/** Rule events as broadcast by the server (mirrors rules GameEvent, minus roundEnd). */
export type EventMsg =
  | { type: 'phase'; phase: Phase }
  | { type: 'ebeChosen'; id: string; reason: 'random' | 'firstCaught' | 'sameEbe' }
  | { type: 'countingDone' }
  | { type: 'spotted'; id: string }
  | { type: 'caught'; id: string }
  | { type: 'safe'; id: string; how: 'base' | 'timeout' }
  | { type: 'herkesKurtuldu'; by: string; freed: string[] };
