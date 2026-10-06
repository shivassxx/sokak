/**
 * The mahalle map: hand-authored, axis-aligned, ~120 m × 120 m.
 * Coordinates: x = east, z = south, y = up. Origin = Ebe Duvarı (base).
 *
 * Every object yields one AABB collider. `solid` blocks movement,
 * `opaque` blocks line of sight. Bushes / laundry sheets / tree canopies
 * are opaque but walk-through, which makes them great hiding spots.
 */

export type PropKind =
  | 'ground'
  | 'boundary'
  | 'building'
  | 'shop'
  | 'kiosk'
  | 'ebeWall'
  | 'wall'
  | 'fence'
  | 'car'
  | 'brokenCar'
  | 'minibus'
  | 'crate'
  | 'container'
  | 'trunk'
  | 'canopy'
  | 'bush'
  | 'step'
  | 'slab'
  | 'railing'
  | 'slide'
  | 'table'
  | 'stool'
  | 'bench'
  | 'pole'
  | 'lamp'
  | 'sheet';

export interface MapObject {
  kind: PropKind;
  /** center x/z */
  x: number;
  z: number;
  /** size along x / z */
  w: number;
  d: number;
  /** bottom y and height */
  y: number;
  h: number;
  solid: boolean;
  opaque: boolean;
  /** optional palette index for buildings / cars */
  tint?: number;
}

export interface Aabb {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
  solid: boolean;
  opaque: boolean;
}

export interface Zone {
  name: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface Vec2 {
  x: number;
  z: number;
}

export const MAP_HALF = 60;
export const BASE: Vec2 = { x: 0, z: 0 };
export const BASE_RADIUS = 2.6;
/** Where the Ebe stands while counting (facing the wall, -z). */
export const EBE_COUNT_SPOT: Vec2 = { x: 0, z: -0.9 };

const objects: MapObject[] = [];

interface BoxOpts {
  y?: number;
  solid?: boolean;
  opaque?: boolean;
  tint?: number;
}

function box(kind: PropKind, x: number, z: number, w: number, d: number, h: number, o: BoxOpts = {}): void {
  objects.push({
    kind,
    x,
    z,
    w,
    d,
    h,
    y: o.y ?? 0,
    solid: o.solid ?? true,
    opaque: o.opaque ?? true,
    tint: o.tint,
  });
}

/** Box given by min/max corners on the ground plane. */
function rect(kind: PropKind, x0: number, z0: number, x1: number, z1: number, h: number, o: BoxOpts = {}): void {
  box(kind, (x0 + x1) / 2, (z0 + z1) / 2, Math.abs(x1 - x0), Math.abs(z1 - z0), h, o);
}

function tree(x: number, z: number, big = false): void {
  box('trunk', x, z, 0.5, 0.5, big ? 3 : 2.4);
  const s = big ? 4.2 : 3.4;
  box('canopy', x, z, s, s, big ? 3.2 : 2.6, { y: big ? 2.4 : 1.9, solid: false });
}

function car(x: number, z: number, alongX: boolean, tint: number): void {
  if (alongX) box('car', x, z, 4.2, 1.9, 1.45, { tint });
  else box('car', x, z, 1.9, 4.2, 1.45, { tint });
}

function lamp(x: number, z: number): void {
  box('lamp', x, z, 0.25, 0.25, 5.2);
}

/**
 * Apartment with a recessed entrance on its south (+z) face.
 * Entrance is `gap` wide and 2 m deep, centered at `ex`.
 */
function apartment(x0: number, z0: number, x1: number, z1: number, h: number, ex: number, tint: number, gap = 3): void {
  const g0 = ex - gap / 2;
  const g1 = ex + gap / 2;
  rect('building', x0, z0, g0, z1, h, { tint });
  rect('building', g1, z0, x1, z1, h, { tint });
  rect('building', g0, z0, g1, z1 - 2, h, { tint });
  // canopy over the entrance (visual + blocks view from above)
  rect('slab', g0, z1 - 2, g1, z1 + 0.6, 0.2, { y: 2.6, tint });
}

// ---------------------------------------------------------------- boundary
rect('boundary', -MAP_HALF - 1, -MAP_HALF - 1, MAP_HALF + 1, -MAP_HALF, 7);
rect('boundary', -MAP_HALF - 1, MAP_HALF, MAP_HALF + 1, MAP_HALF + 1, 7);
rect('boundary', -MAP_HALF - 1, -MAP_HALF, -MAP_HALF, MAP_HALF, 7);
rect('boundary', MAP_HALF, -MAP_HALF, MAP_HALF + 1, MAP_HALF, 7);

// ---------------------------------------------------------------- center
box('ebeWall', 0, -2.2, 5, 0.6, 2.4);
lamp(-7, -7);
lamp(7, 7);
lamp(-7, 7);
lamp(7, -7);
box('bench', -5, 11.5, 2, 0.6, 0.5);
box('bench', 5, 11.5, 2, 0.6, 0.5);
tree(-11, 11, true);
tree(11, -11, true);

// ---------------------------------------------------------------- NW: apartments, stairs, alley, laundry yard
apartment(-56, -56, -30, -40, 12, -43.5, 0);
// external stairs on east face going north up to a balcony
for (let i = 0; i < 7; i++) {
  const top = 0.4 * (i + 1);
  box('step', -29.25, -36.5 - i, 1.5, 1, 0.3, { y: top - 0.3 });
}
rect('slab', -30, -50, -26.5, -43, 0.3, { y: 2.8 });
rect('railing', -26.7, -50, -26.5, -43, 1, { y: 3.1, opaque: false });
rect('railing', -30, -50.2, -26.5, -50, 1, { y: 3.1, opaque: false });
// second block, separated by a narrow alley (z -40 .. -37.5)
apartment(-56, -37.5, -34, -18, 9, -40, 1);
// low wall with a gap, laundry yard behind it
rect('wall', -27, -16.2, -19.5, -15.8, 2.2);
rect('wall', -18.3, -16.2, -10, -15.8, 2.2);
for (const z of [-21, -26]) {
  box('pole', -26, z, 0.15, 0.15, 2.4);
  box('pole', -12, z, 0.15, 0.15, 2.4);
  box('sheet', -22.5, z, 2.2, 0.08, 1.3, { y: 0.8, solid: false });
  box('sheet', -19, z, 1.8, 0.08, 1.1, { y: 1.0, solid: false });
  box('sheet', -15.5, z, 2.2, 0.08, 1.3, { y: 0.8, solid: false });
}
car(-42, -11.2, true, 0);
car(-30, -11.2, true, 2);
box('container', -16, -10.8, 2, 1.3, 1.5);
box('container', -13.6, -10.8, 2, 1.3, 1.5);
lamp(-24, -8);

// ---------------------------------------------------------------- NE: bakkal, minibus, broken car, apartment B
apartment(28, -56, 56, -36, 15, 40, 2);
rect('building', 8, -56, 24, -34, 10, { tint: 3 });
// bakkal (corner shop) with crates
rect('shop', 12, -26, 25, -15, 4.5);
rect('slab', 12, -15, 25, -13.6, 0.15, { y: 2.8, solid: false, opaque: false, tint: 9 });
for (const [cx, cz, cy] of [
  [13.5, -13, 0],
  [14.4, -13, 0],
  [13.9, -13, 0.8],
  [26, -18, 0],
  [26, -18.9, 0],
  [26.9, -18.4, 0],
  [26, -18.45, 0.8],
  [23.5, -13, 0],
] as const) {
  box('crate', cx, cz, 0.85, 0.85, 0.8, { y: cy });
}
box('minibus', 40, -11.4, 6.6, 2.3, 2.7);
box('brokenCar', 50, -26, 1.8, 4.3, 1.35);
box('container', 31, -30, 2, 1.3, 1.5);
box('container', 33.4, -30, 2, 1.3, 1.5);
car(18, -10.8, true, 1);
tree(46, -18);
lamp(24, -8);

// ---------------------------------------------------------------- SW: park
rect('fence', -54, 12, -36, 12.3, 0.85, { opaque: false });
rect('fence', -28, 12, -12.3, 12.3, 0.85, { opaque: false });
rect('fence', -12.3, 12, -12, 26, 0.85, { opaque: false });
rect('fence', -12.3, 32, -12, 54, 0.85, { opaque: false });
for (const [tx, tz, big] of [
  [-48, 20, true],
  [-40, 26, false],
  [-22, 18, false],
  [-18, 42, true],
  [-46, 45, false],
  [-31, 50, true],
  [-52, 34, false],
  [-27, 32, false],
] as const) {
  tree(tx, tz, big);
}
for (const [bx, bz, bw, bd] of [
  [-36, 18, 3, 2],
  [-20, 27, 2.5, 2.5],
  [-46, 30, 3.5, 2],
  [-34, 40, 2.5, 3],
  [-16, 49, 3, 2],
  [-52, 51, 3, 3],
  [-40, 52, 2.5, 2],
] as const) {
  box('bush', bx, bz, bw, bd, 1.35, { solid: false });
}
// slide: ladder steps up to a platform, the slide itself, room to hide below
for (let i = 0; i < 4; i++) box('step', -28, 24.6 - i * 0.35, 1, 0.35, 0.12, { y: 0.33 + i * 0.45 });
box('slab', -28, 23.2, 1.2, 1.2, 0.15, { y: 1.8 });
box('slide', -28, 20.3, 0.9, 4.6, 0.25, { y: 0.9, solid: false });
box('bench', -38, 34, 2, 0.6, 0.5);
box('bench', -24, 44, 0.6, 2, 0.5);
lamp(-12.6, 29);
rect('building', -60, 54, -8, 60, 10, { tint: 1 });
car(-36, 9.2, true, 3);

// ---------------------------------------------------------------- SE: tea garden, apartment C, house D
rect('fence', 18, 16, 46, 16.3, 0.9, { opaque: false });
rect('fence', 18, 16, 18.3, 24, 0.9, { opaque: false });
rect('fence', 18, 28, 18.3, 38, 0.9, { opaque: false });
for (const [tx, tz] of [
  [22, 20],
  [28, 20],
  [34, 20],
  [22, 26],
  [28, 26],
  [34, 26],
  [22, 32],
  [28, 32],
] as const) {
  box('table', tx, tz, 1.1, 1.1, 0.75);
  box('stool', tx - 1, tz, 0.45, 0.45, 0.45);
  box('stool', tx + 1, tz, 0.45, 0.45, 0.45);
}
rect('kiosk', 40, 28, 46, 36, 3.2);
tree(44, 20, true);
tree(26, 36);
apartment(30, 42, 56, 56, 12, 43, 3);
// stairs + balcony on west face of apartment C
for (let i = 0; i < 7; i++) {
  const top = 0.4 * (i + 1);
  box('step', 28.75, 39 + i, 1.5, 1, 0.3, { y: top - 0.3 });
}
rect('slab', 26.5, 45.5, 30, 52, 0.3, { y: 2.8 });
rect('railing', 26.5, 45.5, 26.7, 52, 1, { y: 3.1, opaque: false });
rect('railing', 26.5, 52, 30, 52.2, 1, { y: 3.1, opaque: false });
rect('building', 8, 44, 20, 56, 7, { tint: 0 });
box('container', 50, 22, 2, 1.3, 1.5);
box('container', 52.4, 22, 2, 1.3, 1.5);
car(20, 10.8, true, 0);
car(34, 10.8, true, 2);
car(52, 33, false, 1);
lamp(24, 8);
lamp(14, 30);

// ---------------------------------------------------------------- side streets fillers
rect('building', -60, -8, -56, 8, 8, { tint: 2 });
rect('building', 56, -8, 60, 8, 8, { tint: 0 });
rect('building', -8, -60, -2, -50, 9, { tint: 3 });
rect('building', 2, 52, 8, 60, 9, { tint: 2 });

export const MAP_OBJECTS: readonly MapObject[] = objects;

export const COLLIDERS: readonly Aabb[] = objects.map((o) => ({
  minX: o.x - o.w / 2,
  maxX: o.x + o.w / 2,
  minY: o.y,
  maxY: o.y + o.h,
  minZ: o.z - o.d / 2,
  maxZ: o.z + o.d / 2,
  solid: o.solid,
  opaque: o.opaque,
}));

/** Named areas for the round summary ("best hiding spot"). First match wins. */
export const ZONES: readonly Zone[] = [
  { name: 'Ebe Duvarı', minX: -5, maxX: 5, minZ: -5, maxZ: 5 },
  { name: 'Meydan', minX: -10, maxX: 10, minZ: -9, maxZ: 13 },
  { name: 'Merdiven altı', minX: -31, maxX: -27.5, minZ: -44, maxZ: -35 },
  { name: 'A Apartmanı balkonu', minX: -30, maxX: -26, minZ: -50, maxZ: -43 },
  { name: 'A Apartmanı girişi', minX: -46, maxX: -41, minZ: -43, maxZ: -38 },
  { name: 'Dar sokak', minX: -56, maxX: -30, minZ: -40, maxZ: -37.5 },
  { name: 'Çamaşır ipleri', minX: -27, maxX: -10, minZ: -28, maxZ: -16 },
  { name: 'Bakkalın önü', minX: 11, maxX: 28, minZ: -15, maxZ: -12 },
  { name: 'Bakkalın arkası', minX: 11, maxX: 28, minZ: -34, maxZ: -26 },
  { name: 'Kasa yığını', minX: 25, maxX: 28, minZ: -21, maxZ: -16 },
  { name: 'Minibüsün arkası', minX: 35, maxX: 45, minZ: -15, maxZ: -9 },
  { name: 'Hurda araba', minX: 47, maxX: 53, minZ: -30, maxZ: -22 },
  { name: 'Çöp konteynerleri', minX: 29, maxX: 36, minZ: -33, maxZ: -27 },
  { name: 'Kaydırak', minX: -30, maxX: -26, minZ: 17, maxZ: 26 },
  { name: 'Park', minX: -60, maxX: -12, minZ: 12, maxZ: 54 },
  { name: 'Çay bahçesi', minX: 18, maxX: 46, minZ: 16, maxZ: 38 },
  { name: 'C Apartmanı balkonu', minX: 26.5, maxX: 30, minZ: 45.5, maxZ: 52 },
  { name: 'C Apartmanı merdiveni', minX: 27.5, maxX: 30, minZ: 38, maxZ: 45.5 },
  { name: 'C Apartmanı girişi', minX: 41, maxX: 45, minZ: 52, maxZ: 57 },
  { name: 'Park edilmiş arabalar', minX: -60, maxX: 60, minZ: -13, maxZ: -9 },
  { name: 'Park edilmiş arabalar', minX: -60, maxX: 60, minZ: 8, maxZ: 13 },
];

export function zoneAt(x: number, z: number): string {
  for (const zone of ZONES) {
    if (x >= zone.minX && x <= zone.maxX && z >= zone.minZ && z <= zone.maxZ) return zone.name;
  }
  return 'Mahalle arası';
}

/** Hand-picked cover points used by hiding bots. */
export const HIDING_SPOTS: readonly Vec2[] = [
  { x: -29.3, z: -41.8 },
  { x: -43.5, z: -40.6 },
  { x: -50, z: -38.7 },
  { x: -22.5, z: -23.5 },
  { x: -15, z: -18 },
  { x: -42, z: -13 },
  { x: -15, z: -12.8 },
  { x: 18, z: -28 },
  { x: 27.5, z: -19.5 },
  { x: 40, z: -13.6 },
  { x: 50, z: -21 },
  { x: 32, z: -32 },
  { x: -36, z: 18 },
  { x: -20, z: 27 },
  { x: -46, z: 30 },
  { x: -34, z: 40 },
  { x: -28, z: 22.9 },
  { x: -52, z: 51 },
  { x: 47, z: 31 },
  { x: 38.5, z: 33 },
  { x: 28.75, z: 44.2 },
  { x: 43, z: 41 },
  { x: 51, z: 24 },
  { x: 14, z: 41 },
];

export function spawnPoint(index: number): Vec2 {
  const a = (index / 10) * Math.PI * 2;
  return { x: Math.sin(a) * 5.5, z: 6 + Math.cos(a) * 3 };
}

/** Çöp konteynerleri a hider can climb into (index = container id). */
export const CONTAINERS: readonly MapObject[] = objects.filter((o) => o.kind === 'container');
