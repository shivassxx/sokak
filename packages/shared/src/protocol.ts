/** Network protocol shared by client and server (movement, looks, emotes, chat). */

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
  emote: 'emote',
  chat: 'chat',
  teleport: 'tp',
} as const;

export interface JoinOptions {
  name?: string;
  color?: string;
  hat?: number;
  hair?: number;
  skin?: number;
  /** kahvehane: seat me at a table right away */
  quick?: boolean;
  /** kahvehane: when creating a salon, hide it from the lobby list */
  private?: boolean;
  /** kahvehane: anonymous random device token for the play-money wallet */
  device?: string;
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
  /** receiver's own authoritative body: x, y, z, vy, onGround(0|1), stamina, tired(0|1), unused (-1) */
  me?: [number, number, number, number, number, number, number, number];
  /** other players */
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

export interface EmoteMsg {
  id: string;
  e: EmoteId;
}

export interface ChatMsg {
  id: string;
  /** index into QUICK_CHAT_OKEY */
  q: number;
}
