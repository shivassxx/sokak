import * as THREE from 'three';
import type { KahveObject } from '@sokak/shared';
import { Builder, hash } from './world';
import { PAT } from './materials';

/**
 * The corner market's fit-out (bakkal / market): gondola shelving with real-looking stock
 * (identical facings in brand blocks — boxes, bottles, cans, bags, jars — on shelves with
 * price strips), glass-door drinks coolers, an open dairy cooler, the counter with a cash
 * register, card terminal, chocolate rack and newspapers, the cigarette cabinet behind it,
 * an ice-cream chest freezer and fruit & vegetable crates outside. Everything goes into the
 * shared Builder (no extra draw calls); glass panes go to `glass`.
 */

/** brand-ish colour pairs: [packaging, label] */
const BRANDS: [number, number][] = [
  [0xd8473b, 0xf4ecd8],
  [0xf2c94c, 0x7a2a22],
  [0x2f6fb0, 0xf6f3ea],
  [0x3f8f5a, 0xf2e6c4],
  [0xe67e22, 0x2b2b2b],
  [0x7b3fa0, 0xf2c94c],
  [0xf4f1e8, 0xd8473b],
  [0x1d3a63, 0xe9c46a],
  [0x8c1d2c, 0xf6f3ea],
  [0x2b2b2b, 0xe9b33a],
  [0x8fd18a, 0x1e5a32],
  [0xf3a8bd, 0x7a2a52],
];
const SILVER = 0xb9bec4;
const STEEL = 0x5d6369;

type Kind = 'box' | 'bottle' | 'can' | 'bag' | 'jar' | 'carton';

/** One product standing on a shelf (y = shelf top), facing ±z or ±x. */
function product(b: Builder, kind: Kind, x: number, y: number, z: number, along: 'x' | 'z', c: [number, number], size: number): void {
  const [main, label] = c;
  const fw = (w: number, d: number): [number, number] => (along === 'x' ? [w, d] : [d, w]);
  switch (kind) {
    case 'box': {
      const h = 0.22 + size * 0.1;
      b.box(x, y, z, ...whd(fw(0.17 + size * 0.06, 0.07), h), main);
      b.box(x, y + h * 0.42, z, ...whd(fw(0.15 + size * 0.06, 0.075), h * 0.3), label);
      break;
    }
    case 'bottle': {
      const h = 0.2 + size * 0.1;
      b.add(new THREE.CylinderGeometry(0.035, 0.038, h, 6), main, x, y + h / 2, z);
      b.add(new THREE.CylinderGeometry(0.039, 0.039, h * 0.32, 6), label, x, y + h * 0.45, z);
      b.add(new THREE.CylinderGeometry(0.014, 0.03, 0.08, 5), label, x, y + h + 0.04, z);
      break;
    }
    case 'can':
      b.add(new THREE.CylinderGeometry(0.032, 0.032, 0.115, 7), main, x, y + 0.058, z);
      b.add(new THREE.CylinderGeometry(0.033, 0.033, 0.04, 7), label, x, y + 0.06, z);
      break;
    case 'bag': {
      // a pillow pack: body, crimped top and bottom seals, a label window
      b.box(x, y + 0.02, z, ...whd(fw(0.19, 0.075), 0.26), main);
      b.box(x, y + 0.28, z, ...whd(fw(0.19, 0.02), 0.03), label);
      b.box(x, y, z, ...whd(fw(0.19, 0.03), 0.025), main);
      b.box(x, y + 0.08, z, ...whd(fw(0.13, 0.08), 0.11), label);
      break;
    }
    case 'jar':
      b.add(new THREE.CylinderGeometry(0.045, 0.045, 0.12, 8), main, x, y + 0.06, z);
      b.add(new THREE.CylinderGeometry(0.047, 0.047, 0.025, 8), label, x, y + 0.13, z);
      break;
    case 'carton':
      b.box(x, y, z, ...whd(fw(0.07, 0.07), 0.2), main);
      b.box(x, y + 0.08, z, ...whd(fw(0.072, 0.072), 0.06), label);
      b.add(new THREE.ConeGeometry(0.05, 0.04, 4), main, x, y + 0.22, z, 0, Math.PI / 4, 0);
      break;
  }
}
const whd = ([w, d]: [number, number], h: number): [number, number, number] => [w, h, d];
const PITCH: Record<Kind, number> = { box: 0.24, bottle: 0.1, can: 0.075, bag: 0.24, jar: 0.11, carton: 0.09 };

/** Fill a shelf run from a to e (along x or z) at height y with blocks of identical facings. */
function stockRun(b: Builder, along: 'x' | 'z', a: number, e: number, y: number, front: number, kinds: Kind[], seed: number): void {
  let p = a + 0.06;
  let k = 0;
  while (p < e - 0.08) {
    const kind = kinds[Math.floor(hash(seed + k * 1.7) * kinds.length)]!;
    const brand = BRANDS[Math.floor(hash(seed * 3 + k) * BRANDS.length)]!;
    const size = hash(seed + k * 5);
    const n = 3 + Math.floor(hash(seed + k * 9) * 4);
    const pitch = PITCH[kind] + (kind === 'box' || kind === 'bag' ? size * 0.05 : 0);
    for (let i = 0; i < n && p + pitch / 2 < e - 0.04; i++) {
      // one row of facings: the rows behind them are never seen past the front ones
      const x = along === 'x' ? p + pitch / 2 : front;
      const z = along === 'x' ? front : p + pitch / 2;
      product(b, kind, x, y, z, along, brand, size);
      p += pitch;
    }
    p += 0.02;
    k++;
  }
}

export function marketFitout(b: Builder, M: { x0: number; x1: number; z0: number; z1: number; h: number; doorX: number; doorW: number }, objects: readonly KahveObject[], glass: THREE.BufferGeometry[]): void {
  const pat = b.pat;
  const bucket = b.bucket;
  b.bucket = 'detail';
  // tiled lower walls, a suspended ceiling with LED panels
  b.pat = PAT.tiles;
  b.box((M.x0 + M.x1) / 2, 0, M.z0 + 0.01, M.x1 - M.x0 - 0.6, 1.3, 0.04, 0xeef0ee);
  for (const x of [M.x0 + 0.32, M.x1 - 0.32]) b.box(x, 0, (M.z0 + M.z1) / 2, 0.04, 1.3, M.z1 - M.z0, 0xeef0ee);
  b.pat = PAT.none;
  for (let i = 0; i < 4; i++)
    for (let j = 0; j < 3; j++) b.box(M.x0 + 2 + i * 3.4, M.h - 0.07, M.z0 + 2.5 + j * 4.2, 1.2, 0.04, 0.6, 0x8f8d88, 'glow');
  for (const o of objects) {
    if (o.kind === 'marketShelf') gondola(b, o);
    else if (o.kind === 'fridge') cooler(b, o, (M.x0 + M.x1) / 2, glass);
    else if (o.kind === 'marketCounter') counter(b, o);
    else if (o.kind === 'freezer') freezer(b, o, glass);
    else if (o.kind === 'crates') crates(b, o);
  }
  b.pat = pat;
  b.bucket = bucket;
}

/** double-sided gondola along x: base, back panel, 4 shelves a side with price strips and stock */
function gondola(b: Builder, o: KahveObject): void {
  b.box(o.x, 0, o.z, o.w, 0.12, o.d - 0.05, 0x4a4f55);
  b.box(o.x, 0.12, o.z, o.w, o.h - 0.12, 0.05, 0xdfe2e4);
  for (const sx of [-1, 1]) b.box(o.x + sx * (o.w / 2 - 0.02), 0, o.z, 0.04, o.h, o.d, 0xc9cdd1);
  const levels = [0.14, 0.56, 0.98, 1.4];
  levels.forEach((y, li) => {
    for (const s of [-1, 1]) {
      const fz = o.z + s * (o.d / 2 - 0.02);
      b.box(o.x, y - 0.03, o.z + s * (o.d / 4 + 0.01), o.w - 0.08, 0.03, o.d / 2 - 0.04, 0xe8eaec);
      b.box(o.x, y - 0.06, fz, o.w - 0.08, 0.045, 0.012, li % 2 ? 0xf2d24b : 0xf6f6f2);
      const kinds: Kind[] = li === 0 ? ['bottle', 'jar', 'box'] : li === 3 ? ['box', 'bag'] : ['box', 'bag', 'can', 'jar', 'bottle'];
      stockRun(b, 'x', o.x - o.w / 2, o.x + o.w / 2, y, o.z + s * (o.d / 2 - 0.12), kinds, o.x * 7 + o.z * 3 + li * 11 + (s > 0 ? 5 : 0));
    }
  });
}

/** an upright cooler: glass doors with steel mullions (drinks) or an open front (dairy) */
function cooler(b: Builder, o: KahveObject, midX: number, glass: THREE.BufferGeometry[]): void {
  const alongZ = o.d > o.w;
  const len = alongZ ? o.d : o.w;
  const depth = alongZ ? o.w : o.d;
  // outward direction of the open side (towards the room centre)
  const sgn = alongZ ? (o.x > midX ? -1 : 1) : 1;
  const front = (alongZ ? o.x : o.z) + (sgn * depth) / 2;
  const at = (t: number, dep: number): [number, number] => (alongZ ? [front - sgn * dep, t] : [t, front - sgn * dep]);
  const c0 = (alongZ ? o.z : o.x) - len / 2;
  const boxA = (t: number, y: number, dep: number, l: number, h: number, dd: number, col: number, bucket?: 'glow') => {
    const [x, z] = at(t, dep);
    if (alongZ) b.box(x, y, z, dd, h, l, col, bucket);
    else b.box(x, y, z, l, h, dd, col, bucket);
  };
  const mid = c0 + len / 2;
  const drinks = len > 6;
  // carcass: back (softly lit), plinth, header with a red band, end panels
  boxA(mid, 0.25, depth - 0.04, len, o.h - 0.6, 0.04, 0x55606a, 'glow');
  boxA(mid, 0, depth / 2, len, 0.25, depth, 0x2b2f33);
  boxA(mid, o.h - 0.35, depth / 2, len, 0.35, depth, 0xe9ecef);
  boxA(mid, o.h - 0.28, -0.005, len, 0.2, 0.02, drinks ? 0xc0262d : 0x2f6fb0);
  for (const e of [c0 + 0.02, c0 + len - 0.02]) boxA(e, 0, depth / 2, 0.04, o.h, depth, 0xe9ecef);
  const shelves = drinks ? [0.3, 0.72, 1.12, 1.48] : [0.3, 0.68, 1.06, 1.42];
  const kinds: Kind[] = drinks ? ['bottle', 'can', 'carton', 'bottle'] : ['carton', 'jar', 'box'];
  for (const y of shelves) {
    boxA(mid, y - 0.02, depth / 2, len - 0.08, 0.02, depth - 0.12, 0x9aa2a8);
    stockRun(b, alongZ ? 'z' : 'x', c0, c0 + len, y, front - sgn * 0.16, kinds, y * 31 + o.z + o.x);
  }
  if (drinks) {
    // doors: mullions, handles and glass
    const n = Math.round(len / 0.75);
    for (let k = 0; k <= n; k++) {
      const t = c0 + (k * len) / n;
      boxA(t, 0.25, -0.01, 0.05, o.h - 0.6, 0.05, STEEL);
      if (k < n) boxA(t + len / n - 0.1, 0.8, -0.04, 0.025, 0.5, 0.03, SILVER);
    }
    const g = new THREE.PlaneGeometry(len, o.h - 0.6);
    if (alongZ) g.rotateY(Math.PI / 2);
    const [gx, gz] = at(mid, -0.005);
    g.translate(gx, 0.25 + (o.h - 0.6) / 2, gz);
    glass.push(g);
  } else {
    // open dairy deck: a price strip on every shelf edge
    for (const y of shelves) boxA(mid, y - 0.05, 0.02, len - 0.08, 0.04, 0.012, 0xf6f6f2);
  }
}

/** the counter: slatted wood front, laminate top, register, card terminal, chocolates, papers */
function counter(b: Builder, o: KahveObject): void {
  const fz = o.z + o.d / 2;
  b.pat = PAT.wood;
  b.box(o.x, 0, o.z, o.w, o.h - 0.04, o.d, 0x7a5a40);
  for (let k = 0; k < 12; k++) b.box(o.x - o.w / 2 + 0.15 + k * ((o.w - 0.3) / 11), 0.08, fz + 0.01, 0.06, o.h - 0.2, 0.02, 0x5e4430);
  b.pat = PAT.none;
  b.box(o.x, o.h - 0.04, o.z, o.w + 0.08, 0.04, o.d + 0.08, 0xe9e4da);
  b.box(o.x, 0, fz - 0.02, o.w + 0.02, 0.1, 0.04, 0x2b2b2b);
  // cash register (seller side) and card terminal
  const rx = o.x + 0.9;
  b.box(rx, o.h, o.z - 0.1, 0.38, 0.09, 0.34, 0x2e3236);
  b.box(rx, o.h + 0.09, o.z - 0.12, 0.3, 0.05, 0.24, 0x3a3f44);
  b.add(new THREE.BoxGeometry(0.26, 0.17, 0.02), 0x1b2a3a, rx, o.h + 0.24, o.z - 0.2, -0.35, 0, 0, 'cars');
  b.box(rx + 0.24, o.h, o.z - 0.05, 0.1, 0.12, 0.16, 0xd9dcdf);
  b.box(rx - 0.45, o.h, o.z + 0.1, 0.08, 0.03, 0.17, 0x1e1e1e);
  b.add(new THREE.BoxGeometry(0.06, 0.04, 0.005), 0x2f6f5a, rx - 0.45, o.h + 0.035, o.z + 0.12, -1.3, 0, 0, 'glow');
  // chocolate & gum rack on the customer side
  for (let tier = 0; tier < 3; tier++) {
    const y = o.h + tier * 0.09;
    const z = fz - 0.12 - tier * 0.08;
    b.box(o.x - 0.6, y, z, 0.7, 0.012, 0.1, 0xc9cdd1);
    for (let k = 0; k < 9; k++) {
      const c = BRANDS[(k + tier * 4) % BRANDS.length]!;
      b.box(o.x - 0.92 + k * 0.08, y + 0.012, z, 0.065, 0.025, 0.11, c[0]);
      b.box(o.x - 0.92 + k * 0.08, y + 0.037, z + 0.02, 0.05, 0.004, 0.05, c[1]);
    }
  }
  // newspapers: a stack with headlines
  for (let k = 0; k < 3; k++) {
    const px = o.x - 1.45 + k * 0.32;
    for (let s = 0; s < 5; s++) b.box(px, o.h + s * 0.012, o.z + 0.1, 0.28, 0.011, 0.4, 0xeeeae0);
    b.box(px, o.h + 0.061, o.z + 0.23, 0.24, 0.004, 0.07, k === 1 ? 0xc0262d : 0x2b2b2b);
    b.box(px - 0.04, o.h + 0.061, o.z + 0.06, 0.14, 0.004, 0.12, 0x8a9aa8);
  }
  // behind the seller: a low back counter and the cigarette cabinet (packs in brand blocks)
  const bz = o.z - 1.55;
  b.box(o.x, 0, bz - 0.2, o.w - 0.2, 0.95, 0.5, 0x5e4430);
  b.box(o.x, 0.95, bz - 0.2, o.w - 0.16, 0.03, 0.52, 0xe9e4da);
  b.box(o.x, 1.05, bz - 0.38, o.w - 0.3, 1.45, 0.12, 0x1f2124);
  const PACKS: [number, number][] = [
    [0xf4f1ea, 0xc0262d],
    [0xf4f1ea, 0x2f6fb0],
    [0x1d2c4a, 0xd9dcdf],
    [0xd4b25a, 0x2b2b2b],
    [0x2b2b2b, 0xd4b25a],
    [0xc9ccd0, 0x1d3a63],
    [0x7a1d26, 0xf4f1ea],
    [0xf4f1ea, 0x3f8f5a],
  ];
  for (let row = 0; row < 6; row++) {
    const y = 1.12 + row * 0.22;
    b.box(o.x, y - 0.015, bz - 0.3, o.w - 0.36, 0.012, 0.1, 0x3a3d42);
    let k = 0;
    for (let x = o.x - (o.w - 0.4) / 2; x < o.x + (o.w - 0.4) / 2 - 0.06; x += 0.068) {
      const pk = PACKS[Math.floor(hash(row * 13 + Math.floor(k / 4)) * PACKS.length)]!;
      b.box(x + 0.03, y, bz - 0.29, 0.055, 0.085, 0.022, pk[0]);
      b.box(x + 0.03, y + 0.06, bz - 0.277, 0.056, 0.026, 0.002, pk[1]);
      k++;
    }
  }
}

/** ice-cream chest freezer: white body, sliding glass lid, colourful packs, a blue sign */
function freezer(b: Builder, o: KahveObject, glass: THREE.BufferGeometry[]): void {
  b.box(o.x, 0, o.z, o.w, o.h - 0.05, o.d, 0xf3f4f5);
  b.box(o.x, o.h - 0.05, o.z, o.w, 0.05, o.d, 0xc9cdd1);
  b.box(o.x, 0, o.z, o.w + 0.01, 0.12, o.d + 0.01, 0x2f6fb0);
  for (let i = 0; i < 4; i++)
    for (let j = 0; j < 7; j++) {
      const c = BRANDS[(i * 7 + j * 3) % BRANDS.length]!;
      b.box(o.x - o.w / 2 + 0.17 + i * 0.22, o.h - 0.22, o.z - o.d / 2 + 0.16 + j * 0.22, 0.18, 0.08, 0.12, c[0]);
      b.box(o.x - o.w / 2 + 0.17 + i * 0.22, o.h - 0.14, o.z - o.d / 2 + 0.16 + j * 0.22, 0.12, 0.003, 0.06, c[1]);
    }
  const g = new THREE.PlaneGeometry(o.w - 0.1, o.d - 0.1);
  g.rotateX(-Math.PI / 2);
  g.translate(o.x, o.h - 0.01, o.z);
  glass.push(g);
  // a sign on a post
  b.box(o.x + o.w / 2 - 0.1, o.h, o.z, 0.03, 0.5, 0.03, SILVER);
  b.box(o.x + o.w / 2 - 0.1, o.h + 0.5, o.z, 0.04, 0.32, 0.6, 0x2f6fb0);
}

/** fruit & vegetable crates on a stepped stand outside the shop */
function crates(b: Builder, o: KahveObject): void {
  b.box(o.x, 0, o.z, o.w, 0.35, o.d, 0x4a4f55);
  const PRODUCE = [0xf28c28, 0xd8312b, 0x9cc43a, 0xf2d24b, 0x6b2a5a, 0xe5552e];
  const n = Math.floor(o.w / 0.62);
  for (const [row, y, dz] of [
    [0, 0.35, 0.22],
    [1, 0.62, -0.18],
  ] as const) {
    for (let k = 0; k < n; k++) {
      const cx = o.x - o.w / 2 + 0.32 + k * ((o.w - 0.64) / (n - 1));
      const cz = o.z + dz;
      b.pat = PAT.wood;
      b.box(cx, y, cz, 0.56, 0.2, 0.4, 0xb08a5a);
      b.pat = PAT.none;
      const col = PRODUCE[(k * 3 + row * 2 + Math.round(o.x)) % PRODUCE.length]!;
      for (let i = 0; i < 6; i++)
        for (let j = 0; j < 4; j++) b.blob(cx - 0.21 + i * 0.084 + (j % 2) * 0.03, y + 0.21 + hash(i + j * 7 + k) * 0.03, cz - 0.13 + j * 0.088, 0.045, col, 0.9, 0);
      // a price card on a stick
      b.box(cx + 0.2, y + 0.2, cz + 0.17, 0.01, 0.16, 0.01, 0x8a6a40);
      b.box(cx + 0.2, y + 0.34, cz + 0.17, 0.12, 0.08, 0.005, 0xf6f6f2);
    }
  }
}
