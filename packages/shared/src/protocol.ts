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

/** Look customisation (indices are sent over the wire). */
export const HATS = ['yok', 'kasket', 'bere', 'hasir', 'tac', 'kulaklik'] as const;
export const HAT_NAMES = ['Şapkasız', 'Kasket', 'Bere', 'Hasır şapka', 'Taç', 'Kulaklık'] as const;
export const HAIRS = ['kisa', 'kivircik', 'atkuyrugu', 'orgu', 'dikdik'] as const;
export const HAIR_NAMES = ['Kısa', 'Kıvırcık', 'At kuyruğu', 'Örgülü', 'Diken diken'] as const;
export const SKINS = ['#f3cfa9', '#e2b083', '#c58c5c', '#8d5a3b'] as const;

export interface Look {
  color: string;
  hat: number;
  hair: number;
  skin: number;
}

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
  /** hider throws a pebble to make noise somewhere else */
  throwPebble: 'throw',
  /** hider gets into / out of a çöp konteyneri */
  interact: 'interact',
  /** server → all: a pebble landed here */
  pebble: 'pebble',
} as const;

/** Seconds between two pebbles of the same player. */
export const PEBBLE_COOLDOWN = 12;
/** Max distance a pebble flies. */
export const PEBBLE_RANGE = 11;
/** A hider can climb into a container from this close (to its edge). */
export const CONTAINER_REACH = 1.4;

export interface JoinOptions {
  name?: string;
  color?: string;
  hat?: number;
  hair?: number;
  skin?: number;
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
  /** sprint 0|1 */
  r?: number;
}

/** [id, x, y, z, yaw, flags] — flags bit0 = crouching, bit1 = sprinting */
export type PlayerSnap = [string, number, number, number, number, number];

/** server → client, every tick */
export interface SnapshotMsg {
  /** server time ms */
  t: number;
  /** last processed input seq of the receiver */
  a: number;
  /** receiver's own authoritative body: x, y, z, vy, onGround(0|1), stamina, tired(0|1), container index or -1 */
  me?: [number, number, number, number, number, number, number, number];
  /** other visible players */
  p: PlayerSnap[];
  /** Ebe only: footsteps it can hear but not see — [world angle (rad), loudness 0..1] */
  n?: [number, number][];
  /** hiders only: how close the Ebe is, 0 (far) .. 1 (right here) */
  e?: number;
}

export interface PebbleMsg {
  x: number;
  z: number;
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
  hat: number;
  hair: number;
  skin: number;
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
  | { type: 'herkesKurtuldu'; by: string; freed: string[] }
  /** only sent to the Ebe: "Gördüm!" found nobody / Ebe is standing at the base */
  | { type: 'spotMiss'; reason: 'base' | 'none' };
