import type { Aabb, MapObject, Vec2 } from './geometry';
import { CollisionWorld } from './physics';

/**
 * The okey world: a modern kıraathane on the Üsküdar waterfront.
 * x = east, z = south (the Bosphorus is to the south, Kız Kulesi out in the water).
 *
 *   z −30 … −24   houses behind
 *   z −24 … 0     kıraathane hall (x −20 … 14), market next door (x 16 … 30)
 *   z   0 … 7     terrace with tables / pavement in front of the market
 *   z   7 … 10    pavement, z 10 … 17 cobbled street, z 17 … 19 pavement
 *   z  19 … 34    sahil promenade (trees, benches, simitçi, çay bahçesi, iskele)
 *   z  34         sea wall + railing; water beyond
 */
export const KAHVE_HALF = 48;
/** the hall */
export const HALL = { x0: -20, x1: 14, z0: -24, z1: 0, h: 4.4 } as const;
export const HALL_DOOR = { x: -3, w: 3 } as const;
/** stretch of the sea wall that is a low ledge to sit on (no railing) */
export const LEDGE = { x0: -13.5, x1: 4.5 } as const;
export const TERRACE = { z1: 7 } as const;
export const STREET = { z0: 10, z1: 17 } as const;
export const PROMENADE = { z0: 19, z1: 34 } as const;
export const SEA_Z = 34;
/** the iskele (ferry pier hall); its sea face is z1 */
export const PIER = { x0: 32, x1: 48, z0: 22, z1: 38 } as const;
export const MARKET = { x0: 16, x1: 30, z0: -14, z1: 0, h: 4, doorX: 23, doorW: 3 } as const;
/** legacy names used by the scene for the hall's inner half sizes */
export const KAHVE_HALF_X = (HALL.x1 - HALL.x0) / 2;
export const KAHVE_HALF_Z = (HALL.z1 - HALL.z0) / 2;

/** where the çaycı stands behind the counter */
export const CAYCI_SPOT: Vec2 = { x: -3, z: -22.8 };
/** new arrivals appear just inside the door */
export const KAHVE_SPAWN: Vec2 = { x: -3, z: -2.6 };

export type KahveKind =
  | 'wall'
  | 'building'
  | 'fence'
  | 'railing'
  | 'car'
  | 'bench'
  | 'okeyTable'
  | 'chair'
  | 'counter'
  | 'tv'
  | 'shelf'
  | 'pillar'
  | 'planter'
  | 'glass'
  | 'marketShelf'
  | 'fridge'
  | 'marketCounter'
  | 'freezer'
  | 'crates'
  | 'cart'
  | 'pier'
  | 'lamp'
  | 'stool'
  | 'lowTable'
  | 'parasol'
  | 'heater'
  | 'seaWall'
  | 'ledge'
  | 'tavla';

export type KahveObject = MapObject<KahveKind>;

const objs: KahveObject[] = [];
function box(kind: KahveKind, x: number, z: number, w: number, d: number, h: number, o: { y?: number; solid?: boolean; opaque?: boolean; tint?: number } = {}): void {
  objs.push({ kind, x, z, w, d, h, y: o.y ?? 0, solid: o.solid ?? true, opaque: o.opaque ?? true, tint: o.tint });
}
/** box from min/max corners */
function span(kind: KahveKind, x0: number, x1: number, z0: number, z1: number, h: number, o: { y?: number; solid?: boolean; opaque?: boolean; tint?: number } = {}): void {
  box(kind, (x0 + x1) / 2, (z0 + z1) / 2, x1 - x0, z1 - z0, h, o);
}

// ------------------------------------------------------------------ the hall
const T = 0.4;
span('wall', HALL.x0 - T, HALL.x1 + T, HALL.z0 - T, HALL.z0, HALL.h);
span('wall', HALL.x0 - T, HALL.x0, HALL.z0, HALL.z1, HALL.h);
span('wall', HALL.x1, HALL.x1 + T, HALL.z0, HALL.z1, HALL.h);
// glass storefront with the door in the middle (blocks walking, not sight)
span('glass', HALL.x0 - T, HALL_DOOR.x - HALL_DOOR.w / 2, -0.15, 0.15, HALL.h, { opaque: false });
span('glass', HALL_DOOR.x + HALL_DOOR.w / 2, HALL.x1 + T, -0.15, 0.15, HALL.h, { opaque: false });
// çay ocağı counter and the shelves behind it
span('counter', -9, 3, -21.6, -20.4, 1.1);
span('shelf', -9, 3, HALL.z0 + 0.05, HALL.z0 + 0.5, 2.8, { solid: false });
// TVs and big plants in the entrance lounge
box('tv', -14, HALL.z1 - 0.3, 2.4, 0.2, 1.4, { y: 2.2, solid: false });
box('tv', 8, HALL.z1 - 0.3, 2.4, 0.2, 1.4, { y: 2.2, solid: false });
box('tv', HALL.x0 + 0.3, -12, 0.2, 2.4, 1.4, { y: 2.2, solid: false });
box('tv', HALL.x1 - 0.3, -12, 0.2, 2.4, 1.4, { y: 2.2, solid: false });
for (const [x, z] of [
  [HALL.x0 + 0.8, -1.2],
  [HALL.x1 - 0.8, -1.2],
  [HALL.x0 + 0.8, -22.6],
  [HALL.x1 - 0.8, -22.6],
  [-9.5, -2],
  [3.5, -2],
] as const)
  box('planter', x, z, 0.9, 0.9, 0.7);

/**
 * Playable tavla tables in the entrance lounge, two either side of the door. The board's
 * long side runs along x; seat 0 (white) sits on the south side, seat 1 (black) on the north.
 */
export const TAVLA_TABLES: readonly Vec2[] = [
  { x: -16.5, z: -2.6 },
  { x: -12.5, z: -2.6 },
  { x: 6.5, z: -2.6 },
  { x: 10.5, z: -2.6 },
];
export const TAVLA_COUNT = TAVLA_TABLES.length;
for (const t of TAVLA_TABLES) box('tavla', t.x, t.z, 0.9, 0.9, 0.75);
/** chair distance from the tavla table centre */
export const TAVLA_SEAT_DIST = 0.85;
/** Sit at a tavla table if within this distance of its centre. */
export const TAVLA_REACH = 2.2;

export function tavlaSeatPosition(table: number, seat: number): Vec2 & { yaw: number } {
  const t = TAVLA_TABLES[table]!;
  // seat 0 south facing north (yaw 0), seat 1 north facing south
  return seat === 0 ? { x: t.x, z: t.z + TAVLA_SEAT_DIST, yaw: 0 } : { x: t.x, z: t.z - TAVLA_SEAT_DIST, yaw: Math.PI };
}
for (let i = 0; i < TAVLA_TABLES.length; i++)
  for (let s = 0; s < 2; s++) {
    const p = tavlaSeatPosition(i, s);
    box('chair', p.x, p.z, 0.5, 0.5, 0.48, { solid: false });
  }

/** The regulars (NPC amcas) sit on chairs along the side walls, watching the room. */
export const REGULAR_SEATS: readonly (Vec2 & { yaw: number })[] = [
  { x: HALL.x0 + 0.9, z: -9, yaw: -Math.PI / 2 },
  { x: HALL.x0 + 0.9, z: -14.2, yaw: -Math.PI / 2 },
  { x: HALL.x1 - 0.9, z: -9, yaw: Math.PI / 2 },
  { x: HALL.x1 - 0.9, z: -14.2, yaw: Math.PI / 2 },
];

/** Okey table centres: 6 × 3 in the hall, 4 on the terrace. */
const TABLE_LIST: Vec2[] = [];
for (const z of [-16.5, -11.5, -6.5]) for (const x of [-15.5, -10.5, -5.5, -0.5, 4.5, 9.5]) TABLE_LIST.push({ x, z });
for (const x of [-16, -10.5, 4, 9.5]) TABLE_LIST.push({ x, z: 3.5 });
export const TABLES: readonly Vec2[] = TABLE_LIST;
export const TABLE_COUNT = TABLES.length;
export const TERRACE_TABLE_FIRST = 18;
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

// chairs are visual only (players sit by teleport), they block nothing
for (let i = 0; i < TABLES.length; i++)
  for (let s = 0; s < 4; s++) {
    const p = seatPosition(i, s);
    box('chair', p.x, p.z, 0.5, 0.5, 0.48, { solid: false });
  }

// ------------------------------------------------------------------ terrace
span('railing', HALL.x0 - T, HALL_DOOR.x - HALL_DOOR.w / 2, TERRACE.z1 - 0.1, TERRACE.z1 + 0.1, 1.1, { opaque: false });
span('railing', HALL_DOOR.x + HALL_DOOR.w / 2, HALL.x1 + T, TERRACE.z1 - 0.1, TERRACE.z1 + 0.1, 1.1, { opaque: false });
span('railing', HALL.x0 - T, HALL.x0, 0, TERRACE.z1, 1.1, { opaque: false });
span('railing', HALL.x1, HALL.x1 + T, 0, TERRACE.z1, 1.1, { opaque: false });
for (const x of [-13.25, 6.75]) box('heater', x, 5.6, 0.4, 0.4, 2.2);
for (const x of [HALL.x0 + 0.6, HALL.x1 - 0.6]) box('planter', x, 6.3, 0.8, 0.8, 0.7);

// ------------------------------------------------------------------ market next door
const M = MARKET;
span('wall', M.x0, M.x1, M.z0 - 0.3, M.z0, M.h);
span('wall', M.x0, M.x0 + 0.3, M.z0, M.z1, M.h);
span('wall', M.x1 - 0.3, M.x1, M.z0, M.z1, M.h);
span('glass', M.x0, M.doorX - M.doorW / 2, -0.15, 0.15, M.h, { opaque: false });
span('glass', M.doorX + M.doorW / 2, M.x1, -0.15, 0.15, M.h, { opaque: false });
span('marketCounter', 17.6, 21.2, -4.2, -3.2, 1.0);
span('marketShelf', 22.6, 28.6, -7.6, -6.8, 1.9);
span('marketShelf', 22.6, 28.6, -10.8, -10.0, 1.9);
span('marketShelf', 17.0, 21.0, -11.6, -10.8, 1.9);
span('fridge', 29.0, 29.7, -13.4, -1.4, 2.1);
span('fridge', 16.3, 17.0, -9.6, -6.0, 2.1);
// ice-cream chest freezer by the window, fruit & vegetable crates either side of the door
span('freezer', 16.35, 17.35, -2.3, -0.65, 0.9);
span('crates', 17.0, 20.8, 0.3, 1.3, 0.95);
span('crates', 25.2, 29.0, 0.3, 1.3, 0.95);

/** where you shop: stand here (within SHOP_REACH) */
export interface Shop {
  id: 'market' | 'simitci' | 'vapur';
  name: string;
  x: number;
  z: number;
  /** where the seller stands */
  seller: Vec2 & { yaw: number };
  items: readonly string[];
  /** on the vapur's deck: x, z and the seller are deck-local and you must be aboard */
  deck?: boolean;
}

// ------------------------------------------------------------------ neighbours (blocked)
span('building', -KAHVE_HALF, HALL.x0 - T, -KAHVE_HALF, TERRACE.z1 + 0.1, 12);
span('building', HALL.x0 - T, HALL.x1 + T, -KAHVE_HALF, HALL.z0 - T, 12);
span('building', HALL.x1 + T, M.x0, -KAHVE_HALF, TERRACE.z1 - 3.5, 12);
span('fence', HALL.x1 + T, M.x0, TERRACE.z1 - 3.5, TERRACE.z1 + 0.1, 1.6);
span('building', M.x0, KAHVE_HALF, -KAHVE_HALF, M.z0 - 0.3, 12);
span('building', M.x1, KAHVE_HALF, M.z0 - 0.3, TERRACE.z1 + 0.1, 12);

// ------------------------------------------------------------------ street furniture & cars
box('car', -30, STREET.z0 + 1.1, 4.2, 1.8, 1.5, { tint: 0 });
box('car', 22, STREET.z1 - 1.1, 4.2, 1.8, 1.5, { tint: 1 });
box('car', 12, STREET.z0 + 1.1, 4.2, 1.8, 1.5, { tint: 2 });
box('car', -40, STREET.z1 - 1.1, 4.2, 1.8, 1.5, { tint: 3 });
for (let x = -42; x <= 30; x += 12) box('lamp', x, STREET.z1 + 0.6, 0.25, 0.25, 4.5);

// ------------------------------------------------------------------ sahil
for (const x of [-40, -28, -16, -4, 8, 20]) box('planter', x, PROMENADE.z0 + 2.2, 1.4, 1.4, 0.6);
const BENCHES = [-34, -22, -10, 2, 14];
for (const x of BENCHES) box('bench', x, PROMENADE.z0 + 8, 2.0, 0.6, 0.45);
box('cart', 6, PROMENADE.z0 + 4.6, 1.8, 1.0, 1.7);
// çay bahçesi by the water: low tables and stools (stools are walk-through)
const CAY_BAHCESI: Vec2[] = [];
for (const x of [-44, -40, -36, -32]) CAY_BAHCESI.push({ x, z: SEA_Z - 2.4 });
for (const t of CAY_BAHCESI) box('lowTable', t.x, t.z, 0.7, 0.7, 0.45);
for (const t of CAY_BAHCESI) for (const dx of [-0.75, 0.75]) box('stool', t.x + dx, t.z, 0.45, 0.45, 0.32, { solid: false });
// iskele (ferry pier building)
span('pier', PIER.x0, PIER.x1, PIER.z0, PIER.z1, 7);
// sea wall + railing; an invisible high wall stops jumping over the railing
span('railing', -KAHVE_HALF, LEDGE.x0, SEA_Z - 0.1, SEA_Z + 0.1, 1.1, { opaque: false });
span('railing', LEDGE.x1, 32, SEA_Z - 0.1, SEA_Z + 0.1, 1.1, { opaque: false });
// Salacak-style low stone ledge instead of the railing: sit on it, legs over the water
span('ledge', LEDGE.x0, LEDGE.x1, SEA_Z - 0.45, SEA_Z + 0.1, 0.5);
span('seaWall', -KAHVE_HALF, 32, SEA_Z + 0.1, SEA_Z + 0.6, 3.5, { opaque: false });

export const SHOPS: readonly Shop[] = [
  { id: 'market', name: 'Market', x: 19.4, z: -2.3, seller: { x: 19.4, z: -5.0, yaw: Math.PI }, items: ['sigara', 'su', 'gazoz', 'cekirdek', 'cikolata', 'dondurma', 'gazete', 'olta'] },
  { id: 'simitci', name: 'Simitçi', x: 6, z: PROMENADE.z0 + 6, seller: { x: 6, z: PROMENADE.z0 + 3.6, yaw: Math.PI }, items: ['simit', 'cay', 'su'] },
  // the çaycı on the vapur's open stern deck, in front of the upper cabin (deck-local, facing aft)
  { id: 'vapur', name: 'Vapur çaycısı', x: -12.6, z: 0, seller: { x: -11.35, z: 0, yaw: Math.PI / 2 }, items: ['cay', 'simit', 'su'], deck: true },
];
export const SHOP_REACH = 2.4;

/** Places to sit outside of the okey tables (benches, stools, terrace lounge). */
export interface SitSpot extends Vec2 {
  yaw: number;
  /** seat height in metres */
  h: number;
  /** shown in the sit prompt */
  label: string;
  /** where you stand up (default: a step forward) */
  stand?: Vec2;
}
const SPOTS: SitSpot[] = [];
// benches face the sea (+z → yaw π)
for (const x of BENCHES) for (const dx of [-0.5, 0.5]) SPOTS.push({ x: x + dx, z: PROMENADE.z0 + 8, yaw: Math.PI, h: 0.45, label: 'Bank' });
// stools around the low tables, facing the table
for (const t of CAY_BAHCESI) {
  SPOTS.push({ x: t.x - 0.75, z: t.z, yaw: -Math.PI / 2, h: 0.32, label: 'Tabure' });
  SPOTS.push({ x: t.x + 0.75, z: t.z, yaw: Math.PI / 2, h: 0.32, label: 'Tabure' });
}
// the sahil ledge: facing Kız Kulesi; you get up back onto the promenade
for (let x = LEDGE.x0 + 0.8; x <= LEDGE.x1 - 0.8; x += 1.3)
  SPOTS.push({ x, z: SEA_Z - 0.2, yaw: Math.PI, h: 0.5, label: 'Sahil duvarı', stand: { x, z: SEA_Z - 1.1 } });
export const SIT_SPOTS: readonly SitSpot[] = SPOTS;
export const SPOT_REACH = 1.8;

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

/** Is a point inside the hall (roofed)? */
export function inHall(x: number, z: number): boolean {
  return x > HALL.x0 && x < HALL.x1 && z > HALL.z0 && z < HALL.z1;
}

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

/** Things you can buy at the market / simitçi and carry around. */
export interface ShopItem {
  id: string;
  name: string;
  price: number;
  emoji: string;
  /** how many times it can be used (smoked, eaten, sipped) */
  uses: number;
  /** what using it looks like */
  use: 'smoke' | 'eat' | 'drink' | 'read' | 'fish';
  note?: string;
}

export const SHOP_ITEMS: readonly ShopItem[] = [
  { id: 'sigara', name: 'Sigara (paket)', price: 60, emoji: '🚬', uses: 20, use: 'smoke', note: 'Sigara içmek sağlığa zararlıdır. Sadece oyun içi, sanal bir eşyadır.' },
  { id: 'su', name: 'Su', price: 5, emoji: '💧', uses: 4, use: 'drink' },
  { id: 'gazoz', name: 'Gazoz', price: 10, emoji: '🥤', uses: 4, use: 'drink' },
  { id: 'cekirdek', name: 'Çekirdek', price: 15, emoji: '🌻', uses: 12, use: 'eat' },
  { id: 'cikolata', name: 'Çikolata', price: 12, emoji: '🍫', uses: 4, use: 'eat' },
  { id: 'dondurma', name: 'Dondurma', price: 20, emoji: '🍦', uses: 5, use: 'eat' },
  { id: 'gazete', name: 'Gazete', price: 8, emoji: '📰', uses: 6, use: 'read' },
  { id: 'simit', name: 'Simit', price: 7, emoji: '🥯', uses: 4, use: 'eat' },
  { id: 'cay', name: 'Çay', price: 5, emoji: '🍵', uses: 4, use: 'drink' },
  { id: 'olta', name: 'Olta', price: 30, emoji: '🎣', uses: 8, use: 'fish', note: 'Sahilde denize karşı Q ile at; "Vurdu!" deyince hemen çek.' },
];

/** At the sea railing or the ledge (not on the pier): where you can fish or feed the gulls. */
export function bySea(x: number, z: number): boolean {
  return z > SEA_Z - 3.2 && x < 32;
}

/** What bites on the line, with relative chances (a shoe now and then for the laughs). */
export const FISH: readonly { id: string; name: string; emoji: string; w: number }[] = [
  { id: 'istavrit', name: 'istavrit', emoji: '🐟', w: 45 },
  { id: 'cinekop', name: 'çinekop', emoji: '🐟', w: 25 },
  { id: 'lufer', name: 'lüfer', emoji: '🐠', w: 15 },
  { id: 'palamut', name: 'palamut', emoji: '🐠', w: 10 },
  { id: 'ayakkabi', name: 'eski bir ayakkabı', emoji: '🥾', w: 5 },
];

export const START_MONEY = 1000;

/** Daily missions: small goals around the kahve, rewarded with play money once a day. */
export const DAILY_MISSIONS: readonly { id: string; text: string; goal: number; reward: number }[] = [
  { id: 'match', text: 'Bir okey ya da tavla maçı bitir', goal: 1, reward: 150 },
  { id: 'tea', text: 'Masana çay ısmarla', goal: 1, reward: 40 },
  { id: 'fish', text: 'Sahilde bir balık tut', goal: 1, reward: 60 },
  { id: 'gulls', text: 'Martılara 3 kez simit at', goal: 3, reward: 40 },
];
export type MissionId = 'match' | 'tea' | 'fish' | 'gulls';
/** Progress of today's missions (JSON in the player schema). */
export interface MissionState {
  /** the day (Istanbul time) this progress belongs to, e.g. "2026-10-07" */
  day: string;
  progress: Record<string, number>;
}
/** Today's date in Istanbul (UTC+3) — missions reset at local midnight. */
export function missionDay(now = Date.now()): string {
  return new Date(now + 3 * 3600 * 1000).toISOString().slice(0, 10);
}

/** Level from finished matches and wins: quick at first, slower later. */
export function levelOf(played: number, won: number): number {
  return 1 + Math.floor(Math.sqrt((played * 10 + won * 25) / 40));
}
const TITLES: [number, string][] = [
  [18, 'Efsane'],
  [12, 'Okey ağası'],
  [8, 'Usta'],
  [5, 'Kahve müdavimi'],
  [3, 'Mahalle oyuncusu'],
  [2, 'Acemi'],
  [1, 'Çaylak'],
];
export function levelTitle(level: number): string {
  return TITLES.find(([l]) => level >= l)?.[1] ?? 'Çaylak';
}
export const BET_OPTIONS = [0, 10, 50, 100, 250] as const;
export const HAND_OPTIONS = [1, 3, 5, 7, 9] as const;
/** "Masa ayarları" turn time per move (seconds); Normal = TURN_SECONDS */
export const TURN_OPTIONS = [
  { secs: 15, label: 'Hızlı' },
  { secs: 30, label: 'Normal' },
  { secs: 45, label: 'Yavaş' },
] as const;
export const turnLabel = (secs: number): string => TURN_OPTIONS.find((o) => o.secs === secs)?.label ?? `${secs} sn`;
/** Eşli 101: seats 0+2 and 1+3 are partners */
export const TEAM_NAMES = ['Mavi takım', 'Kırmızı takım'] as const;
export const TEAM_COLORS = ['#3d8bfd', '#e5534b'] as const;
/** "Veresiye": a broke player can ask for this once every few minutes */
export const CREDIT_AMOUNT = 200;
export const CREDIT_COOLDOWN_MS = 5 * 60 * 1000;
export const STEAL_FINE = 50;
export const FALSE_ACCUSE_FINE = 20;
export const TURN_SECONDS = 30;
export const MAX_KAHVE_PLAYERS = 60;

export const QUICK_CHAT_OKEY = ['Çaylar benden!', 'Hadi oyna!', 'Okey bende!', 'Bu el benim!', 'Hile var!', 'Bir el daha!', 'Eyvallah!', 'Sahile inelim mi?', 'Manzaraya bak!', 'Rastgele! 🎣', 'Simit alan var mı?', 'Hadi bir çay daha!'] as const;
