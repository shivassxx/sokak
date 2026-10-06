import type { Aabb, MapObject, PropKind, Vec2 } from './map';
import { CollisionWorld } from './physics';

/**
 * The kahvehane interior: 26 m × 20 m hall with okey tables, the ocak
 * (tea counter) with the çaycı, a tavla corner, TV and benches.
 * x = east, z = south; the door is in the south wall.
 */
export const KAHVE_HALF_X = 13;
export const KAHVE_HALF_Z = 10;
export const KAHVE_HALF = 13;
export const TABLE_COUNT = 6;
/** where the çaycı stands behind the counter */
export const CAYCI_SPOT: Vec2 = { x: 1, z: -8.6 };
export const KAHVE_SPAWN: Vec2 = { x: 0, z: 7.6 };

export type KahveKind = PropKind | 'okeyTable' | 'chair' | 'counter' | 'tavla' | 'tv' | 'shelf' | 'pillar';

export interface KahveObject extends Omit<MapObject, 'kind'> {
  kind: KahveKind;
}

const objs: KahveObject[] = [];
function box(kind: KahveKind, x: number, z: number, w: number, d: number, h: number, o: { y?: number; solid?: boolean; tint?: number } = {}): void {
  objs.push({ kind, x, z, w, d, h, y: o.y ?? 0, solid: o.solid ?? true, opaque: true, tint: o.tint });
}

// outer walls (door gap in the south wall)
box('wall', 0, -KAHVE_HALF_Z - 0.25, KAHVE_HALF_X * 2 + 1, 0.5, 4);
box('wall', -KAHVE_HALF_X - 0.25, 0, 0.5, KAHVE_HALF_Z * 2, 4);
box('wall', KAHVE_HALF_X + 0.25, 0, 0.5, KAHVE_HALF_Z * 2, 4);
box('wall', -7.5, KAHVE_HALF_Z + 0.25, 11.5, 0.5, 4);
box('wall', 7.5, KAHVE_HALF_Z + 0.25, 11.5, 0.5, 4);

// ocak: tea counter along the north wall
box('counter', 1, -7.6, 9, 1.1, 1.1);
box('shelf', 1, -9.6, 8, 0.5, 2.6, { solid: false });

// tavla corner + TV + pillars + benches
box('tavla', -10.5, -7.5, 1.2, 1.2, 0.75);
box('tavla', 10.5, -7.5, 1.2, 1.2, 0.75);
box('tv', 10.5, 9.6, 2.2, 0.2, 1.3, { y: 1.9, solid: false });
box('pillar', -4, 1.2, 0.6, 0.6, 4);
box('pillar', 4, 1.2, 0.6, 0.6, 4);
box('bench', -12.3, 1.5, 0.8, 5, 0.5);
box('bench', 12.3, 1.5, 0.8, 5, 0.5);

/** Okey table centres. */
export const TABLES: readonly Vec2[] = [
  { x: -8, z: -2.5 },
  { x: 0, z: -2.5 },
  { x: 8, z: -2.5 },
  { x: -8, z: 4.8 },
  { x: 0, z: 4.8 },
  { x: 8, z: 4.8 },
];
for (const t of TABLES) box('okeyTable', t.x, t.z, 1.3, 1.3, 0.76);

/**
 * Seat order goes round the table so that seat s+1 is on the right of seat s
 * (viewed from seat s facing the table). Seat 0 = south side.
 */
const SEAT_OFFSETS: readonly Vec2[] = [
  { x: 0, z: 1.05 },
  { x: 1.05, z: 0 },
  { x: 0, z: -1.05 },
  { x: -1.05, z: 0 },
];

export function seatPosition(table: number, seat: number): Vec2 & { yaw: number } {
  const t = TABLES[table]!;
  const o = SEAT_OFFSETS[seat]!;
  // face the table centre (yaw 0 = facing -z)
  return { x: t.x + o.x, z: t.z + o.z, yaw: Math.atan2(o.x, o.z) };
}

// chairs are visual only (players sit by teleport), but block nothing
for (let i = 0; i < TABLES.length; i++) for (let s = 0; s < 4; s++) {
  const p = seatPosition(i, s);
  box('chair', p.x, p.z, 0.5, 0.5, 0.48, { solid: false });
}

export const KAHVE_OBJECTS: readonly KahveObject[] = objs;
export const KAHVE_COLLIDERS: readonly Aabb[] = objs.map((o) => ({
  minX: o.x - o.w / 2,
  maxX: o.x + o.w / 2,
  minY: o.y,
  maxY: o.y + o.h,
  minZ: o.z - o.d / 2,
  maxZ: o.z + o.d / 2,
  solid: o.solid,
  opaque: o.opaque,
}));
export const KAHVE_WORLD = new CollisionWorld(KAHVE_COLLIDERS, KAHVE_HALF);

/** Sit if within this distance of the table centre. */
export const SIT_REACH = 3.2;

// ------------------------------------------------------------------ menu & money
export interface MenuItem {
  id: string;
  name: string;
  price: number;
  emoji: string;
}

export const MENU: readonly MenuItem[] = [
  { id: 'cay', name: 'Çay', price: 5, emoji: '🍵' },
  { id: 'oralet', name: 'Oralet', price: 5, emoji: '🍊' },
  { id: 'kahve', name: 'Türk kahvesi', price: 12, emoji: '☕' },
  { id: 'gazoz', name: 'Gazoz', price: 10, emoji: '🥤' },
  { id: 'ayran', name: 'Ayran', price: 8, emoji: '🥛' },
  { id: 'simit', name: 'Simit', price: 7, emoji: '🥯' },
  { id: 'tost', name: 'Kaşarlı tost', price: 15, emoji: '🥪' },
];

export const START_MONEY = 1000;
export const BET_OPTIONS = [0, 10, 50, 100, 250] as const;
export const HAND_OPTIONS = [1, 3, 5] as const;
/** "Veresiye": a broke player can ask for this once every few minutes */
export const CREDIT_AMOUNT = 200;
export const CREDIT_COOLDOWN_MS = 5 * 60 * 1000;
export const STEAL_FINE = 50;
export const FALSE_ACCUSE_FINE = 20;
export const TURN_SECONDS = 30;
export const MAX_KAHVE_PLAYERS = 40;

export const QUICK_CHAT_OKEY = ['Çaylar benden!', 'Hadi oyna!', 'Okey bende!', 'Bu el benim!', 'Hile var!', 'Bir el daha!', 'Eyvallah!'] as const;
