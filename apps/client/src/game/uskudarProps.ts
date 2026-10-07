import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Builder, canvasTex, hash } from './world';
import { PAT, patternize } from './materials';
import type { Foliage } from './foliage';

/**
 * The Üsküdar waterfront in code: wooden houses with cumbas, plane trees,
 * benches, classic lamp posts, the simitçi cart, the iskele, Kız Kulesi on
 * its rock, a passing vapur, gulls, the sea and the historic peninsula on
 * the horizon at sunset.
 */

const IRON = 0x1f2326;
const HOUSE_COLORS = [0xc98f5e, 0x9c3f32, 0xe3c58e, 0x8fb0b8, 0xd8a3a0, 0xb7c49a, 0xe9dcc0];

/**
 * A row of old wooden houses along a street-facing line (facade at z, facing +z or -z).
 * `far` rows (only ever seen from a distance) get plain windows to save triangles.
 */
export function houseRow(b: Builder, x0: number, x1: number, z: number, facing: 1 | -1, seed = 1, tall = 0, far = false): void {
  let x = x0;
  let i = 0;
  while (x < x1 - 2) {
    const w = Math.min(x1 - x, 6 + hash(seed * 31 + i) * 4);
    const floors = 2 + Math.floor(hash(seed * 17 + i) * 2) + tall;
    house(b, x + w / 2, z, w - 0.2, floors, HOUSE_COLORS[(seed * 3 + i) % HOUSE_COLORS.length]!, facing, seed * 100 + i, far);
    x += w;
    i++;
  }
}

function house(b: Builder, cx: number, zFace: number, w: number, floors: number, color: number, facing: 1 | -1, seed: number, far: boolean): void {
  const fh = 3.1;
  const depth = 8;
  const zc = zFace - (facing * depth) / 2;
  const pat = b.pat;
  // ground floor (stone) + wooden upper floors with a cumba (bay) on the first floor
  b.pat = PAT.stone;
  b.box(cx, 0, zc, w, fh, depth, 0xb9ab95);
  b.pat = PAT.wood;
  b.box(cx, fh, zc, w, fh * (floors - 1), depth, color);
  const cumbaW = Math.min(w * 0.55, 3.6);
  b.box(cx, fh + 0.1, zFace + facing * 0.45, cumbaW, fh * Math.min(2, floors - 1) - 0.4, 0.9, color);
  b.pat = PAT.none;
  // eaves and roof
  b.box(cx, fh * floors, zc, w + 0.6, 0.18, depth + 0.8, 0x5a3a28);
  const roof = new THREE.ConeGeometry(Math.hypot(w, depth) * 0.55, 1.8, 4);
  roof.rotateY(Math.PI / 4);
  roof.scale(w / Math.hypot(w, depth) * 1.35, 1, depth / Math.hypot(w, depth) * 1.35);
  b.pat = PAT.roof;
  b.add(roof, 0xa24a32, cx, fh * floors + 1.0, zc);
  b.pat = PAT.none;
  // trim: corner boards and floor bands on the wooden storeys
  const TRIM = 0x6b4a33;
  for (const s of [-1, 1]) b.box(cx + s * (w / 2 - 0.07), fh, zFace + facing * 0.03, 0.14, fh * (floors - 1), 0.08, TRIM);
  for (let f = 1; f < floors; f++) b.box(cx, f * fh - 0.07, zFace + facing * 0.03, w, 0.14, 0.08, TRIM);
  // windows: framed sashes, glossy glass or a lit room, shutters and flower boxes on some
  const zw = zFace + facing * 0.02;
  for (let f = 0; f < floors; f++) {
    const y = f * fh + 1.0;
    const n = Math.max(1, Math.floor(w / 1.8));
    for (let k = 0; k < n; k++) {
      const x = cx - w / 2 + (k + 0.5) * (w / n);
      const onCumba = f >= 1 && Math.abs(x - cx) < cumbaW / 2 - 0.3;
      const zz = onCumba ? zFace + facing * 0.92 : zw;
      if (f === 0 && k === Math.floor(n / 2)) {
        // the door: panelled, under a little hood, on a step
        b.box(x, 0, zz, 1.3, 2.4, 0.06, 0xf2ece0);
        b.box(x, 0, zz + facing * 0.03, 1.1, 2.25, 0.04, 0x5a3420);
        for (const dy of [0.35, 1.35]) b.box(x, dy, zz + facing * 0.055, 0.8, 0.7, 0.02, 0x4a2a18);
        b.box(x, 2.45, zz + facing * 0.3, 1.6, 0.08, 0.6, 0x5a3a28);
        b.box(x, 0, zz + facing * 0.25, 1.5, 0.12, 0.5, 0xb9ab95);
        continue;
      }
      const lit = hash(seed * 7 + f * 13 + k) > 0.55;
      if (far) {
        b.box(x, y, zz, 0.9, 1.35, 0.06, 0xf2ece0);
        b.box(x, y + 0.08, zz + facing * 0.02, 0.72, 1.18, 0.04, lit ? 0x9a7444 : 0x3b4250, lit ? 'glow' : b.bucket);
        continue;
      }
      const sh = hash(seed + k * 3 + f) > 0.6 ? SHUTTERS[Math.floor(hash(seed + k) * SHUTTERS.length)]! : undefined;
      facadeWindow(b, x, y, zz, facing, 0.86, 1.3, lit, sh, f > 0 && hash(seed * 3 + k + f * 5) > 0.7);
    }
  }
  b.pat = pat;
}

const SHUTTERS = [0x2f5d3a, 0x3d6f8a, 0x7a3b28, 0x5b6f7d];

/**
 * A sash window on a facade facing ±z (y = bottom of the frame): white frame, glossy glass
 * (the 'cars' bucket = clearcoat) or a warmly lit room, mullion and transom, a stone sill
 * and a hood; optional louvred-look shutters and a flower box.
 */
export function facadeWindow(b: Builder, x: number, y: number, z: number, facing: 1 | -1, w: number, h: number, lit: boolean, shutters?: number, flowers = false): void {
  const o = (d: number) => z + facing * d;
  const pat = b.pat;
  const bucket = b.bucket;
  b.pat = PAT.none;
  b.bucket = 'detail';
  b.box(x, y - 0.05, o(0), w + 0.16, h + 0.1, 0.06, 0xf2ece0);
  b.box(x, y + 0.03, o(0.035), w - 0.08, h - 0.08, 0.03, lit ? (hash(x * 3 + y) < 0.5 ? 0x9a7444 : 0x8c6038) : 0x26303a, lit ? 'glow' : 'cars');
  b.box(x, y + 0.03, o(0.055), 0.05, h - 0.08, 0.03, 0xf2ece0);
  b.box(x, y + h * 0.66, o(0.055), w - 0.08, 0.05, 0.03, 0xf2ece0);
  b.box(x, y - 0.13, o(0.08), w + 0.3, 0.07, 0.18, 0xe6dccb);
  b.box(x, y + h + 0.02, o(0.06), w + 0.34, 0.09, 0.14, 0xe6dccb);
  if (shutters !== undefined) {
    const dark = new THREE.Color(shutters).multiplyScalar(0.72).getHex();
    for (const s of [-1, 1]) {
      const sx = x + s * (w / 2 + 0.24);
      b.box(sx, y - 0.03, o(0.03), 0.4, h + 0.04, 0.04, shutters);
      for (let k = 0; k < 4; k++) b.box(sx, y + 0.08 + k * ((h - 0.16) / 4), o(0.055), 0.32, 0.05, 0.02, dark);
    }
  }
  if (flowers) {
    b.box(x, y - 0.1, o(0.2), w, 0.16, 0.2, 0x8a4b2f);
    for (let k = 0; k < 4; k++) b.blob(x - w / 2 + 0.14 + (k * (w - 0.28)) / 3, y + 0.1, o(0.2), 0.1, k % 2 ? 0xd8473b : 0x4f8a3a, 0.8, 0, 'foliage');
  }
  b.pat = pat;
  b.bucket = bucket;
}

/** A plane tree (çınar) in a round stone planter: mottled trunk, limbs and leaf-card crowns. */
export function planeTree(b: Builder, x: number, z: number, s = 1, leaves?: Foliage): void {
  b.pat = PAT.stone;
  b.cyl(x, 0, z, 0.72, 0.6, 0xb8ad9a, 16);
  b.pat = PAT.grass;
  b.cyl(x, 0.6, z, 0.64, 0.02, 0x5d6a3a, 16);
  if (!leaves) {
    b.pat = PAT.none;
    b.cyl(x, 0.6, z, 0.18 * s, 3.2 * s, 0x8a8170, 8, 0.12 * s);
    for (let k = 0; k < 7; k++) {
      const a = k * 2.3;
      b.blob(x + Math.sin(a) * 1.4 * s, (3.6 + (k % 3) * 0.7) * s, z + Math.cos(a) * 1.4 * s, (1.4 + hash(k + x) * 0.5) * s, k % 2 ? 0x4f7f34 : 0x5f9140, 0.8, 1, 'foliage');
    }
    b.blob(x, 5.0 * s, z, 1.8 * s, 0x588a3a, 0.75, 1, 'foliage');
    return;
  }
  // çınar bark: patchy olive-grey and cream (plaster noise), a slight lean
  b.pat = PAT.plaster;
  const lean = (hash(x * 3.1) - 0.5) * 0.12;
  const top = new THREE.Vector3(x + lean * 2.6 * s, 0.6 + 2.7 * s, z + lean * 1.3 * s);
  limb(b, new THREE.Vector3(x, 0.4, z), top, 0.22 * s, 0.15 * s, 0x7f7a66);
  const limbs = 5;
  for (let k = 0; k < limbs; k++) {
    const a = (k / limbs) * Math.PI * 2 + hash(x + k) * 0.8;
    const out = (1.5 + hash(k * 7 + x) * 0.8) * s;
    const end = new THREE.Vector3(top.x + Math.cos(a) * out, top.y + (1.3 + hash(k + z) * 0.9) * s, top.z + Math.sin(a) * out);
    limb(b, top, end, 0.1 * s, 0.05 * s, k % 2 ? 0x938b74 : 0x7a7462);
    // two twigs fork off each limb into its leaf clump
    for (const t of [-0.6, 0.7]) {
      const tip = new THREE.Vector3(end.x + Math.cos(a + t) * 0.9 * s, end.y + 0.7 * s, end.z + Math.sin(a + t) * 0.9 * s);
      limb(b, end, tip, 0.05 * s, 0.025 * s, 0x8a836e);
    }
    leaves.crown(end.x, end.y + 0.55 * s, end.z, 1.6 * s, 1.2 * s, 1.6 * s, 95, 1.1 * s);
  }
  leaves.crown(top.x, top.y + 2.6 * s, top.z, 2.2 * s, 1.5 * s, 2.2 * s, 140, 1.2 * s);
  b.pat = PAT.none;
}

const _up = new THREE.Vector3(0, 1, 0);
/** a tapered branch from a to b */
export function limb(b: Builder, a: THREE.Vector3, e: THREE.Vector3, r0: number, r1: number, color: number): void {
  const d = e.clone().sub(a);
  const len = d.length();
  const g = new THREE.CylinderGeometry(r1, r0, len, 7, 1);
  g.translate(0, len / 2, 0);
  const m = new THREE.Matrix4().compose(a, new THREE.Quaternion().setFromUnitVectors(_up, d.normalize()), new THREE.Vector3(1, 1, 1));
  b.addMatrix(g, color, m);
}

/** Wooden slat bench with cast-iron legs, back to +z unless facing says otherwise. */
export function parkBench(b: Builder, x: number, z: number, facing: 1 | -1): void {
  for (const dx of [-0.85, 0.85]) {
    b.box(x + dx, 0, z, 0.08, 0.45, 0.55, IRON);
    b.box(x + dx, 0.45, z - facing * 0.25, 0.08, 0.5, 0.08, IRON);
  }
  b.pat = PAT.wood;
  for (let k = 0; k < 4; k++) b.box(x, 0.42, z - 0.2 + k * 0.13, 1.95, 0.04, 0.1, 0x8a5a33);
  for (let k = 0; k < 3; k++) b.box(x, 0.6 + k * 0.14, z - facing * 0.28, 1.95, 0.09, 0.03, 0x8a5a33);
  b.pat = PAT.none;
}

/** Classic iron street lamp with a lantern head; the lantern glows. */
export function classicLamp(b: Builder, x: number, z: number, h = 4.4): void {
  b.cyl(x, 0, z, 0.16, 0.5, IRON, 8);
  b.cyl(x, 0.5, z, 0.07, h - 0.9, IRON, 8, 0.05);
  b.add(new THREE.ConeGeometry(0.26, 0.24, 6), IRON, x, h, z);
  b.cyl(x, h - 0.55, z, 0.15, 0.42, 0xffe2a8, 6, 0.2, 'glow');
  b.cyl(x, h - 0.6, z, 0.2, 0.05, IRON, 6);
}

/**
 * The simitçi's cart, like the red İstanbul carts: lacquered red cabinet with a white band,
 * a glass display case with two trays of simit, a canopy with gold trim, spoked wheels,
 * a stand leg and push handles. Glass panes go to `glass` (the scene's transparent mesh).
 */
export function simitCart(b: Builder, x: number, z: number, glass?: THREE.BufferGeometry[]): void {
  const RED = 0xb3261e;
  const GOLD = 0xd9b45a;
  const WHITE = 0xf3eee4;
  const STEEL = 0x8c9196;
  b.box(x, 0.6, z, 1.5, 0.05, 0.78, 0x2a2a2a);
  b.box(x, 0.65, z, 1.44, 0.42, 0.72, RED);
  for (const s of [-1, 1]) {
    b.box(x, 0.78, z + s * 0.362, 1.3, 0.13, 0.01, WHITE);
    b.box(x, 0.715, z + s * 0.363, 1.32, 0.012, 0.01, GOLD);
    b.box(x, 0.915, z + s * 0.363, 1.32, 0.012, 0.01, GOLD);
  }
  b.box(x, 1.07, z, 1.56, 0.04, 0.84, WHITE);
  // display case: red posts, top, two trays of simit
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(x + sx * 0.72, 1.11, z + sz * 0.36, 0.035, 0.52, 0.035, RED);
  b.box(x, 1.63, z, 1.5, 0.035, 0.77, RED);
  for (const [y, n] of [
    [1.12, 1],
    [1.36, 0],
  ] as const) {
    b.box(x, y, z, 1.38, 0.012, 0.66, 0xd9d4ca);
    for (let i = 0; i < 6; i++)
      for (let j = 0; j < 3; j++) {
        const k = i * 3 + j + n * 20;
        const px = x - 0.56 + i * 0.225 + (hash(k + x) - 0.5) * 0.03;
        const pz = z - 0.2 + j * 0.2 + (hash(k * 3) - 0.5) * 0.03;
        b.add(new THREE.TorusGeometry(0.075, 0.026, 6, 14), hash(k * 5) < 0.5 ? 0xa8642a : 0xbd7a35, px, y + 0.035, pz, Math.PI / 2, 0, hash(k) * 3);
        // a few stacked
        if (hash(k * 7) < 0.3) b.add(new THREE.TorusGeometry(0.075, 0.026, 6, 14), 0xb06d2e, px + 0.02, y + 0.085, pz, Math.PI / 2 + 0.15, 0, 0);
      }
  }
  if (glass) {
    const pane = (w: number, h: number, px: number, py: number, pz: number, ry: number) => {
      const g = new THREE.PlaneGeometry(w, h);
      g.rotateY(ry);
      g.translate(px, py, pz);
      glass.push(g);
    };
    for (const s of [-1, 1]) {
      pane(1.42, 0.52, x, 1.35, z + s * 0.36, 0);
      pane(0.7, 0.52, x + s * 0.72, 1.35, z, Math.PI / 2);
    }
  }
  // canopy with gold trim on thin posts
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.cyl(x + sx * 0.7, 1.65, z + sz * 0.34, 0.012, 0.3, STEEL, 6);
  b.box(x, 1.94, z, 1.84, 0.05, 1.06, RED);
  b.box(x, 1.915, z, 1.86, 0.03, 1.08, GOLD);
  // spoked wheels on an axle across the cart
  for (const s of [-1, 1]) {
    const wz = z + s * 0.47;
    const wx = x + 0.2;
    b.add(new THREE.TorusGeometry(0.31, 0.028, 6, 24), 0x1d1d1d, wx, 0.34, wz);
    b.add(new THREE.TorusGeometry(0.28, 0.014, 4, 24), RED, wx, 0.34, wz);
    for (let k = 0; k < 8; k++) b.add(new THREE.CylinderGeometry(0.007, 0.007, 0.56, 4), STEEL, wx, 0.34, wz, 0, 0, (k / 8) * Math.PI);
    b.add(new THREE.CylinderGeometry(0.045, 0.045, 0.06, 10), STEEL, wx, 0.34, wz, Math.PI / 2, 0, 0);
  }
  b.add(new THREE.CylinderGeometry(0.018, 0.018, 0.96, 6), STEEL, x + 0.2, 0.34, z, Math.PI / 2, 0, 0);
  // stand legs at the far end, push handles at the near end
  for (const s of [-1, 1]) {
    b.box(x - 0.62, 0, z + s * 0.3, 0.04, 0.6, 0.04, 0x2a2a2a);
    b.add(new THREE.CylinderGeometry(0.016, 0.016, 0.42, 6), STEEL, x + 0.92, 0.92, z + s * 0.3, 0, 0, Math.PI / 2 - 0.25);
  }
  b.add(new THREE.CylinderGeometry(0.022, 0.022, 0.66, 8), 0x2a2a2a, x + 1.12, 0.97, z, Math.PI / 2, 0, 0);
}

/**
 * Üsküdar iskele: a historic pier hall — stone plinth, plastered walls with pilasters and a
 * string course, arched openings with light stone surrounds and keystones, glazed windows
 * with mullions, an upper row of windows, a moulded cornice, eaves on brackets and a hipped
 * lead roof. The boarding gates face the sea (+z), the waiting-hall door the promenade (−x).
 */
export function iskele(b: Builder, x0: number, x1: number, z0: number, z1: number): void {
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  const w = x1 - x0;
  const d = z1 - z0;
  const H = 5.2;
  const WALL = 0xeadfc8;
  const TRIM = 0xf7f1e3;
  const GLASS = 0x34404c;
  b.pat = PAT.stone;
  b.box(cx, 0, cz, w + 0.3, 0.6, d + 0.3, 0xb7ab95);
  b.pat = PAT.plaster;
  b.box(cx, 0.6, cz, w, H - 0.6, d, WALL);
  b.pat = PAT.none;
  // an opening on a facade: `along` is the facade direction, `out` its outward normal
  type Face = { o: THREE.Vector3; along: THREE.Vector3; out: THREE.Vector3; ry: number };
  const faces: Record<'n' | 's' | 'w' | 'e', Face> = {
    n: { o: new THREE.Vector3(cx, 0, z0), along: new THREE.Vector3(1, 0, 0), out: new THREE.Vector3(0, 0, -1), ry: 0 },
    s: { o: new THREE.Vector3(cx, 0, z1), along: new THREE.Vector3(1, 0, 0), out: new THREE.Vector3(0, 0, 1), ry: 0 },
    w: { o: new THREE.Vector3(x0, 0, cz), along: new THREE.Vector3(0, 0, 1), out: new THREE.Vector3(-1, 0, 0), ry: Math.PI / 2 },
    e: { o: new THREE.Vector3(x1, 0, cz), along: new THREE.Vector3(0, 0, 1), out: new THREE.Vector3(1, 0, 0), ry: Math.PI / 2 },
  };
  const at = (f: Face, t: number, y: number, o: number) => f.o.clone().addScaledVector(f.along, t).addScaledVector(f.out, o).setY(y);
  const slab = (f: Face, t: number, y: number, o: number, wa: number, h: number, th: number, color: number) => {
    const p = at(f, t, y, o);
    b.box(p.x, p.y, p.z, f.ry ? th : wa, h, f.ry ? wa : th, color);
  };
  const arch = (f: Face, t: number, y: number, o: number, r: number, color: number) => {
    const p = at(f, t, y, o);
    if (f.ry) b.add(new THREE.CylinderGeometry(r, r, 0.08, 16, 1, false, 0, Math.PI), color, p.x, p.y, p.z, 0, 0, Math.PI / 2);
    else b.add(new THREE.CylinderGeometry(r, r, 0.08, 16, 1, false, 0, Math.PI), color, p.x, p.y, p.z, Math.PI / 2, Math.PI / 2, 0);
  };
  /** a tall arched opening: stone surround + keystone, dark glazing or a door, mullions */
  const opening = (f: Face, t: number, wd: number, sill: number, top: number, door: boolean) => {
    slab(f, t, sill - 0.12, 0.04, wd + 0.36, top - sill + 0.12, 0.06, TRIM);
    arch(f, t, top, 0.05, wd / 2 + 0.18, TRIM);
    slab(f, t, top + wd / 2 + 0.05, 0.08, 0.22, 0.3, 0.08, 0xd8ccb2);
    slab(f, t, sill, 0.07, wd, top - sill, 0.06, door ? 0x3a2a20 : GLASS);
    arch(f, t, top, 0.08, wd / 2, door ? 0x3a2a20 : GLASS);
    if (!door) {
      slab(f, t, sill, 0.11, 0.06, top - sill + wd / 2 - 0.05, 0.03, TRIM);
      slab(f, t, sill + (top - sill) * 0.55, 0.11, wd, 0.05, 0.03, TRIM);
    } else slab(f, t, sill + (top - sill) / 2, 0.11, 0.05, top - sill, 0.03, 0x241a14);
    slab(f, t, sill - 0.16, 0.12, wd + 0.5, 0.08, 0.14, 0xd8ccb2);
  };
  const upper = (f: Face, t: number) => {
    slab(f, t, 4.05, 0.04, 0.9, 0.85, 0.06, TRIM);
    slab(f, t, 4.12, 0.07, 0.7, 0.7, 0.06, GLASS);
    slab(f, t, 4.12, 0.11, 0.05, 0.7, 0.03, TRIM);
  };
  const pilaster = (f: Face, t: number) => slab(f, t, 0.6, 0.06, 0.42, H - 0.6, 0.12, TRIM);
  for (const key of ['n', 's', 'w', 'e'] as const) {
    const f = faces[key];
    const len = key === 'n' || key === 's' ? w : d;
    const n = 4;
    const step = (len - 2) / n;
    for (let k = 0; k <= n; k++) pilaster(f, -len / 2 + 1 + k * step);
    for (let k = 0; k < n; k++) {
      const t = -len / 2 + 1 + (k + 0.5) * step;
      // boarding gates to the sea are tall doors; the promenade side has the hall door
      const door = key === 's' || (key === 'w' && k === 1) || (key === 'n' && k === 3);
      opening(f, t, door ? 1.7 : 1.3, door ? 0.6 : 1.1, 3.0, door);
      // the name boards hang over the middle of the street and promenade sides
      if (!((key === 'w' || key === 'n') && (k === 1 || k === 2))) upper(f, t);
    }
    // string course and cornice
    slab(f, 0, 3.85, 0.05, len + 0.1, 0.12, 0.12, TRIM);
    slab(f, 0, H - 0.35, 0.06, len + 0.14, 0.18, 0.14, TRIM);
    slab(f, 0, H - 0.17, 0.12, len + 0.3, 0.17, 0.26, TRIM);
    // eave brackets
    for (let t = -len / 2 + 0.6; t <= len / 2 - 0.5; t += 1.1) slab(f, t, H - 0.02, 0.32, 0.12, 0.14, 0.42, 0xd8ccb2);
  }
  b.box(cx, H, cz, w + 1.2, 0.16, d + 1.2, 0x5f6e74);
  const roof = new THREE.CylinderGeometry(0.01, (d + 1.1) * 0.7071, 2.6, 4, 1);
  roof.rotateY(Math.PI / 4);
  roof.scale((w + 1.1) / (d + 1.1), 1, 1);
  b.pat = PAT.roof;
  b.add(roof, 0x6d7f86, cx, H + 1.46, cz);
  b.pat = PAT.none;
  // a small lantern on the ridge with the flag pole
  b.box(cx, H + 2.6, cz, 1.2, 0.9, 1.2, TRIM);
  b.add(new THREE.ConeGeometry(0.95, 0.7, 4), 0x5f6e74, cx, H + 3.85, cz, 0, Math.PI / 4, 0);
}

// ------------------------------------------------------------------ Kız Kulesi
/**
 * Kız Kulesi (Maiden's Tower) as restored in 2023: a rocky islet with a stone quay and
 * parapet, the two-storey stone building, and the tower — square lower body, octagonal
 * Baroque shaft with arched windows and cornices, an iron gallery around the glazed
 * lighthouse lantern, an ogee lead dome with a gilded alem; a small beacon on the quay
 * and the Turkish flag. Built around its own origin (sea level y = 0) in metres; the stone
 * uses the shared world-space pattern shader so blocks and mortar read up close.
 */
export function kizKulesi(): THREE.Group {
  const g = new THREE.Group();
  const b = new Builder();
  const STONE = 0xd9cfbf;
  const STONE_DARK = 0xb9ad99;
  const TRIM = 0xefe8da;
  const IRON = 0x2b2f33;
  const LEAD = 0x6f7a80;
  const add = (geo: THREE.BufferGeometry, color: number, x: number, y: number, z: number, ry = 0, rx = 0, rz = 0) => b.add(geo, color, x, y, z, rx, ry, rz);

  // ---- the islet: a big low rock mass and boulders breaking the surface
  b.pat = PAT.stone;
  const rock = (r: number, sx: number, sy: number, sz: number, seed: number) => {
    const geo = new THREE.IcosahedronGeometry(r, 2);
    const pos = geo.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      const n = 1 + 0.22 * Math.sin(x * 1.7 + seed) * Math.cos(z * 1.3 + seed * 2) + 0.12 * Math.sin(y * 3.1 + seed * 5);
      pos.setXYZ(i, x * n * sx, y * n * sy, z * n * sz);
    }
    const flat = geo.toNonIndexed();
    flat.computeVertexNormals();
    return flat;
  };
  add(rock(1, 24, 2.6, 14, 1), 0x6d665d, 0, -1.9, 0);
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2 + hash(k) * 0.3;
    const rr = 1.3 + hash(k + 9) * 2.2;
    add(rock(rr, 1, 0.7, 1, k * 3.1), k % 3 ? 0x5f5951 : 0x7a7268, Math.cos(a) * (19 + hash(k + 3) * 4), -0.6 + hash(k + 5) * 0.6, Math.sin(a) * (11 + hash(k + 7) * 3), a);
  }
  // ---- the quay: rounded stone platform with a parapet
  const quay = new THREE.Shape();
  const QW = 17;
  const QD = 10;
  const QR = 4;
  quay.moveTo(-QW + QR, -QD);
  quay.lineTo(QW - QR, -QD);
  quay.quadraticCurveTo(QW, -QD, QW, -QD + QR);
  quay.lineTo(QW, QD - QR);
  quay.quadraticCurveTo(QW, QD, QW - QR, QD);
  quay.lineTo(-QW + QR, QD);
  quay.quadraticCurveTo(-QW, QD, -QW, QD - QR);
  quay.lineTo(-QW, -QD + QR);
  quay.quadraticCurveTo(-QW, -QD, -QW + QR, -QD);
  const slab = new THREE.ExtrudeGeometry(quay, { depth: 2.2, bevelEnabled: false, curveSegments: 6 });
  slab.rotateX(-Math.PI / 2);
  add(slab, STONE_DARK, 0, -0.9, 0);
  const ring = new THREE.Shape(quay.getPoints(6));
  const inner = new THREE.Path();
  const iw = QW - 0.45;
  const id = QD - 0.45;
  inner.moveTo(-iw + QR, -id);
  inner.lineTo(iw - QR, -id);
  inner.quadraticCurveTo(iw, -id, iw, -id + QR);
  inner.lineTo(iw, id - QR);
  inner.quadraticCurveTo(iw, id, iw - QR, id);
  inner.lineTo(-iw + QR, id);
  inner.quadraticCurveTo(-iw, id, -iw, id - QR);
  inner.lineTo(-iw, -id + QR);
  inner.quadraticCurveTo(-iw, -id, -iw + QR, -id);
  ring.holes.push(inner);
  const parapet = new THREE.ExtrudeGeometry(ring, { depth: 0.75, bevelEnabled: false, curveSegments: 6 });
  parapet.rotateX(-Math.PI / 2);
  add(parapet, STONE, 0, 1.3, 0);
  b.pat = PAT.none;
  const cap = new THREE.ExtrudeGeometry(ring, { depth: 0.08, bevelEnabled: false, curveSegments: 6 });
  cap.rotateX(-Math.PI / 2);
  add(cap, TRIM, 0, 2.05, 0);
  // landing steps on the town side
  b.pat = PAT.stone;
  for (let k = 0; k < 4; k++) b.box(-QW - 0.6 - k * 0.6, -0.9, 3, 0.6, 2.2 - k * 0.5, 4, STONE_DARK);

  // ---- helpers: arched window / door with a light stone surround, facing angle ry
  const archShape = (w: number, h: number) => {
    const s = new THREE.Shape();
    const r = w / 2;
    s.moveTo(-r, 0);
    s.lineTo(r, 0);
    s.lineTo(r, h - r);
    s.absarc(0, h - r, r, 0, Math.PI, false);
    s.lineTo(-r, 0);
    return s;
  };
  const toWorld = (geo: THREE.BufferGeometry, x: number, y: number, z: number, ry: number) => {
    geo.rotateY(ry);
    geo.translate(x, y, z);
    return geo;
  };
  const arch = (x: number, y: number, z: number, ry: number, w: number, h: number, lit: boolean) => {
    const out = Math.sin(ry);
    const outZ = Math.cos(ry);
    b.pat = PAT.none;
    const frame = new THREE.ExtrudeGeometry(archShape(w + 0.36, h + 0.22), { depth: 0.08, bevelEnabled: false, curveSegments: 8 });
    b.addMatrix(toWorld(frame, x + out * 0.01, y - 0.12, z + outZ * 0.01, ry), TRIM, new THREE.Matrix4());
    const glass = new THREE.ShapeGeometry(archShape(w, h), 8);
    b.addMatrix(toWorld(glass, x + out * 0.1, y, z + outZ * 0.1, ry), lit ? 0xffd28a : 0x2c3238, new THREE.Matrix4(), lit ? 'glow' : 'main');
    // sill
    b.add(new THREE.BoxGeometry(w + 0.5, 0.1, 0.22), TRIM, x + out * 0.1, y - 0.14, z + outZ * 0.1, 0, ry, 0);
  };

  // ---- the two-storey building
  const BX = -6.5;
  const BW = 15;
  const BD = 10;
  b.pat = PAT.stone;
  b.box(BX, 1.3, 0, BW, 7.6, BD, STONE);
  b.pat = PAT.none;
  b.box(BX, 4.9, 0, BW + 0.3, 0.22, BD + 0.3, TRIM); // string course
  b.box(BX, 8.7, 0, BW + 0.5, 0.35, BD + 0.5, TRIM); // cornice
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(BX + sx * (BW / 2 - 0.25), 1.3, sz * (BD / 2 - 0.25), 0.62, 7.4, 0.62, TRIM); // quoins
  for (let k = 0; k < 5; k++) {
    const x = BX - BW / 2 + 1.8 + k * ((BW - 3.6) / 4);
    for (const side of [-1, 1]) {
      const ry = side > 0 ? 0 : Math.PI;
      arch(x, 2.0, side * (BD / 2), ry, 1.0, 2.2, (k + (side > 0 ? 0 : 1)) % 3 === 0);
      arch(x, 5.6, side * (BD / 2), ry, 1.0, 2.2, (k + 1) % 2 === 0);
    }
  }
  for (const z of [-2.6, 2.6]) {
    arch(BX - BW / 2, 5.6, z, -Math.PI / 2, 1.0, 2.2, z > 0);
  }
  arch(BX - BW / 2, 1.3, 0, -Math.PI / 2, 1.8, 3.2, true); // the door to the landing
  // low hipped lead roof
  b.bucket = 'cars';
  const roof = new THREE.ConeGeometry(1, 1, 4, 1);
  roof.rotateY(Math.PI / 4);
  roof.scale((BW + 0.6) / Math.SQRT2, 2.0, (BD + 0.6) / Math.SQRT2);
  add(roof, LEAD, BX, 10.05, 0);
  b.bucket = 'main';

  // ---- the tower
  const TX = 5.2;
  // square lower body
  b.pat = PAT.stone;
  b.box(TX, 1.3, 0, 7.4, 10.2, 7.4, STONE);
  b.pat = PAT.none;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(TX + sx * 3.45, 1.3, sz * 3.45, 0.7, 10.0, 0.7, TRIM);
  b.box(TX, 4.9, 0, 7.7, 0.22, 7.7, TRIM);
  b.box(TX, 11.3, 0, 8.1, 0.45, 8.1, TRIM);
  for (const [ry, dx, dz] of [
    [0, 0, 3.7],
    [Math.PI, 0, -3.7],
    [Math.PI / 2, 3.7, 0],
  ] as const) {
    arch(TX + dx, 2.0, dz, ry, 1.1, 2.3, ry === 0);
    arch(TX + dx, 6.1, dz, ry, 1.1, 2.6, ry !== Math.PI);
  }
  // octagonal Baroque shaft (two storeys)
  const oct = (r: number, h: number, y: number, color: number, pat: number) => {
    b.pat = pat as typeof b.pat;
    const c = new THREE.CylinderGeometry(r, r, h, 8, 1);
    c.rotateY(Math.PI / 8);
    add(c, color, TX, y + h / 2, 0);
  };
  oct(3.25, 7.2, 11.75, STONE, PAT.stone);
  oct(3.45, 0.24, 15.2, TRIM, PAT.none);
  oct(3.6, 0.42, 18.95, TRIM, PAT.none);
  const apo = 3.25 * Math.cos(Math.PI / 8);
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    const x = TX + Math.sin(a) * apo;
    const z = Math.cos(a) * apo;
    arch(x, 12.3, z, a, 0.8, 2.0, k % 2 === 0);
    if (k % 2 === 0) arch(x, 15.8, z, a, 0.8, 2.2, true);
    else {
      // round "oculus" between the upper windows
      b.pat = PAT.none;
      add(new THREE.TorusGeometry(0.42, 0.1, 6, 16), TRIM, x + Math.sin(a) * 0.05, 16.9, z + Math.cos(a) * 0.05, a);
    }
  }
  // gallery slab and iron railing
  oct(4.2, 0.28, 19.35, TRIM, PAT.none);
  for (let k = 0; k < 24; k++) {
    const a = (k / 24) * Math.PI * 2;
    b.box(TX + Math.sin(a) * 3.95, 19.63, Math.cos(a) * 3.95, 0.06, 1.0, 0.06, IRON);
  }
  const rail = new THREE.TorusGeometry(3.95, 0.045, 4, 8);
  rail.rotateX(Math.PI / 2);
  rail.rotateY(Math.PI / 8);
  add(rail, IRON, TX, 20.6, 0);
  // the lantern: slim stone piers with glazing between them
  oct(2.35, 0.3, 19.63, TRIM, PAT.none);
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
    b.box(TX + Math.sin(a) * 2.3, 19.93, Math.cos(a) * 2.3, 0.32, 2.7, 0.32, TRIM, 'main', a);
  }
  b.bucket = 'glow';
  const glazing = new THREE.CylinderGeometry(2.15, 2.15, 2.6, 8, 1, true);
  glazing.rotateY(Math.PI / 8);
  add(glazing, 0xffe2a8, TX, 21.25, 0);
  b.bucket = 'main';
  oct(2.6, 0.32, 22.6, TRIM, PAT.none);
  // ogee lead dome (eight facets) and the gilded alem
  b.bucket = 'cars';
  const prof = [
    [2.62, 0],
    [2.66, 0.22],
    [2.5, 0.9],
    [2.18, 1.7],
    [1.7, 2.45],
    [1.12, 3.15],
    [0.62, 3.75],
    [0.3, 4.25],
    [0.12, 4.65],
    [0, 4.8],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const dome = new THREE.LatheGeometry(prof, 8);
  dome.rotateY(Math.PI / 8);
  add(dome, LEAD, TX, 22.92, 0);
  b.bucket = 'foliage';
  const GOLD = 0xd6b25a;
  add(new THREE.CylinderGeometry(0.05, 0.07, 1.6, 6), GOLD, TX, 28.4, 0);
  for (const [y, r] of [
    [27.95, 0.2],
    [28.45, 0.15],
    [28.85, 0.11],
  ] as const)
    add(new THREE.SphereGeometry(r, 10, 8), GOLD, TX, y, 0);
  const crescent = new THREE.TorusGeometry(0.28, 0.05, 6, 16, Math.PI * 1.35);
  crescent.rotateZ(Math.PI * 0.32);
  add(crescent, GOLD, TX, 29.45, 0);
  b.bucket = 'main';

  // ---- small beacon at the far end of the quay
  const LX = 13.5;
  b.pat = PAT.plaster;
  b.cyl(LX, 1.3, 5.2, 0.85, 4.2, 0xf3eee4, 16, 0.75);
  b.pat = PAT.none;
  b.cyl(LX, 5.5, 5.2, 1.1, 0.18, TRIM, 16);
  b.bucket = 'glow';
  b.cyl(LX, 5.68, 5.2, 0.55, 0.9, 0x9fe0a0, 12);
  b.bucket = 'cars';
  add(new THREE.ConeGeometry(0.75, 0.8, 12), 0xb83a2f, LX, 7.0, 5.2);
  b.bucket = 'main';
  // lamp posts on the quay
  for (const [x, z] of [
    [-15.5, -8.5],
    [-15.5, 8.5],
    [15.5, -8.5],
    [2, 9],
  ] as const) {
    b.cyl(x, 2.05, z, 0.07, 2.8, IRON, 6);
    b.bucket = 'glow';
    b.add(new THREE.SphereGeometry(0.22, 10, 8), 0xffe0a0, x, 5.0, z);
    b.bucket = 'main';
  }

  // ---- meshes
  const mk = (geo: THREE.BufferGeometry | null, mat: THREE.Material, shadow = true) => {
    if (!geo) return;
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = m.receiveShadow = shadow;
    g.add(m);
  };
  mk(b.build('main'), patternize(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82 }), 0.18));
  mk(b.build('cars'), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.35 }));
  mk(b.build('foliage'), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.28, metalness: 0.9 }));
  const glow = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
  glow.color.setScalar(1.25);
  mk(b.build('glow'), glow, false);
  // the flag on a pole at the corner of the building
  b.pat = PAT.none;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 7, 6), new THREE.MeshStandardMaterial({ color: 0xe9e6df, roughness: 0.4 }));
  pole.position.set(BX - BW / 2 + 0.8, 8.9 + 3.5, BD / 2 - 0.8);
  g.add(pole);
  const flagTex = canvasTex(256, 168, (ctx) => {
    ctx.fillStyle = '#e30a17';
    ctx.fillRect(0, 0, 256, 168);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(96, 84, 42, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e30a17';
    ctx.beginPath();
    ctx.arc(107, 84, 34, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    for (let k = 0; k < 10; k++) {
      const a = -Math.PI / 2 + (k * Math.PI) / 5;
      const r = k % 2 ? 9 : 22;
      ctx.lineTo(150 + Math.cos(a) * r, 84 + Math.sin(a) * r);
    }
    ctx.fill();
  });
  const flagGeo = new THREE.PlaneGeometry(2.7, 1.8, 8, 1);
  flagGeo.translate(1.35, 0, 0);
  const flag = new THREE.Mesh(flagGeo, new THREE.MeshStandardMaterial({ map: flagTex, side: THREE.DoubleSide, roughness: 0.8 }));
  flag.position.set(pole.position.x, pole.position.y + 2.5, pole.position.z);
  flag.name = 'flag';
  g.add(flag);
  // a little jetty for the boats
  const jetty = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.35, 8), new THREE.MeshStandardMaterial({ color: 0x6f5238, roughness: 0.9 }));
  jetty.position.set(-QW - 2.8, 0.25, -4.5);
  g.add(jetty);
  return g;
}

// ------------------------------------------------------------------ vapur
/** deck plan of the ferry: a fine bow at +x, a rounded stern at −x */
function ferryPlan(len: number, beam: number): THREE.Shape {
  const r = beam / 2;
  const bow = len / 2;
  const sh = new THREE.Shape();
  sh.moveTo(-bow + 2.2, -r);
  sh.lineTo(bow - 7, -r);
  sh.quadraticCurveTo(bow - 0.6, -r * 0.75, bow, 0);
  sh.quadraticCurveTo(bow - 0.6, r * 0.75, bow - 7, r);
  sh.lineTo(-bow + 2.2, r);
  sh.quadraticCurveTo(-bow, r, -bow, 0);
  sh.quadraticCurveTo(-bow, -r, -bow + 2.2, -r);
  return sh;
}

/**
 * Şehir Hatları city ferry: white hull over a dark red bottom and black boot-top, an enclosed
 * main deck with a band of windows, an upper deck with railings and life rings, a cabin with
 * a wheelhouse at each end, the yellow funnel with its black top, masts and a name board.
 * Parts are merged per material (≈8 draw calls a ferry).
 */
export function vapur(): THREE.Group {
  const g = new THREE.Group();
  const white = new THREE.MeshStandardMaterial({ color: 0xf2efe6, roughness: 0.45 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1e2226, roughness: 0.6 });
  const bottom = new THREE.MeshStandardMaterial({ color: 0x7a2a22, roughness: 0.7 });
  const yellow = new THREE.MeshStandardMaterial({ color: 0xe9b33a, roughness: 0.45 });
  const deck = new THREE.MeshStandardMaterial({ color: 0x9a8f80, roughness: 0.85 });
  const glassM = new THREE.MeshStandardMaterial({ color: 0x24313b, roughness: 0.12, metalness: 0.6 });
  const lit = new THREE.MeshBasicMaterial({ color: 0xffd9a0 });
  const ring = new THREE.MeshStandardMaterial({ color: 0xe8642a, roughness: 0.6 });
  const parts = new Map<THREE.Material, THREE.BufferGeometry[]>();
  const add = (geo: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0, ry = 0) => {
    let gg = geo.index ? geo.toNonIndexed() : geo;
    if (ry) gg.rotateY(ry);
    gg = gg.translate(x, y, z);
    for (const k of Object.keys(gg.attributes)) if (k !== 'position' && k !== 'normal') gg.deleteAttribute(k);
    parts.set(m, [...(parts.get(m) ?? []), gg]);
  };
  const slab = (len: number, beam: number, y0: number, h: number) => {
    const e = new THREE.ExtrudeGeometry(ferryPlan(len, beam), { depth: h, bevelEnabled: false, curveSegments: 8 });
    e.rotateX(-Math.PI / 2);
    e.translate(0, y0, 0);
    return e;
  };
  const L = 36;
  const B = 8;
  // hull: antifouling red below the water, a black boot-top, white topsides, a rubbing strake
  add(slab(L - 1.2, B - 0.6, -1.2, 1.3), bottom);
  add(slab(L - 0.4, B - 0.15, 0.1, 0.45), dark);
  add(slab(L, B, 0.55, 1.65), white);
  add(slab(L + 0.15, B + 0.15, 2.2, 0.14), dark);
  // main deck cabin with a band of windows (every other one lit at dusk)
  const C1 = { len: L - 5, beam: B - 0.9, y: 2.34, h: 2.3 };
  add(slab(C1.len, C1.beam, C1.y, C1.h), white);
  const winX0 = -C1.len / 2 + 2.6;
  const winX1 = C1.len / 2 - 6.2;
  const n1 = Math.floor((winX1 - winX0) / 1.45);
  for (let k = 0; k <= n1; k++)
    for (const sd of [-1, 1]) add(new THREE.BoxGeometry(1.05, 1.0, 0.06), (k * 7 + (sd > 0 ? 3 : 0)) % 5 < 2 ? lit : glassM, winX0 + k * 1.45, C1.y + 1.35, sd * (C1.beam / 2 + 0.01));
  // upper deck: an overhanging plate, railings with life rings, the upper cabin
  const DY = C1.y + C1.h;
  add(slab(L - 2.4, B - 0.2, DY, 0.16), white);
  add(slab(L - 2.6, B - 0.4, DY + 0.16, 0.02), deck);
  const railY = DY + 0.18;
  const rx0 = -(L - 2.4) / 2 + 2.2;
  const rx1 = (L - 2.4) / 2 - 7;
  for (const sd of [-1, 1]) {
    const z = sd * ((B - 0.2) / 2 - 0.08);
    add(new THREE.BoxGeometry(rx1 - rx0, 0.06, 0.06), white, (rx0 + rx1) / 2, railY + 1.0, z);
    add(new THREE.BoxGeometry(rx1 - rx0, 0.03, 0.03), white, (rx0 + rx1) / 2, railY + 0.5, z);
    for (let x = rx0; x <= rx1 + 0.01; x += 1.5) add(new THREE.BoxGeometry(0.05, 1.0, 0.05), white, x, railY + 0.5, z);
    for (const x of [rx0 + 3, rx1 - 3]) {
      const t = new THREE.TorusGeometry(0.32, 0.08, 6, 14);
      add(t, ring, x, railY + 0.62, z + sd * 0.07);
    }
  }
  const C2 = { len: L - 15, beam: B - 2.2, y: DY + 0.18, h: 2.1 };
  add(slab(C2.len, C2.beam, C2.y, C2.h), white);
  const n2 = Math.floor((C2.len - 7) / 1.3);
  for (let k = 0; k <= n2; k++)
    for (const sd of [-1, 1]) add(new THREE.BoxGeometry(0.9, 0.85, 0.06), (k * 3 + (sd > 0 ? 1 : 0)) % 4 === 0 ? lit : glassM, -C2.len / 2 + 2.2 + k * 1.3, C2.y + 1.2, sd * (C2.beam / 2 + 0.01));
  add(slab(C2.len + 0.6, C2.beam + 0.6, C2.y + C2.h, 0.12), white);
  // wheelhouses fore and aft with a wrap of dark windows
  for (const sx of [-1, 1]) {
    const wx = sx * (C2.len / 2 - 2.6);
    add(new THREE.BoxGeometry(2.6, 1.5, C2.beam - 0.6), white, wx, C2.y + C2.h + 0.87, 0);
    add(new THREE.BoxGeometry(2.64, 0.6, C2.beam - 0.9), glassM, wx, C2.y + C2.h + 1.15, 0);
    add(new THREE.BoxGeometry(2.9, 0.1, C2.beam - 0.3), dark, wx, C2.y + C2.h + 1.67, 0);
  }
  // the funnel: yellow, black top, a little rake
  const funnel = new THREE.CylinderGeometry(0.95, 1.1, 3.4, 16);
  funnel.scale(1.5, 1, 1);
  const top = C2.y + C2.h + 0.12;
  add(funnel, yellow, -1, top + 1.7, 0);
  const cap = new THREE.CylinderGeometry(0.97, 0.95, 0.8, 16);
  cap.scale(1.5, 1, 1);
  add(cap, dark, -1, top + 3.8, 0);
  // masts with lights, a flag staff at the stern
  add(new THREE.CylinderGeometry(0.06, 0.08, 4.2, 6), white, C2.len / 2 - 2.6, top + 3.5, 0);
  add(new THREE.CylinderGeometry(0.05, 0.07, 3.2, 6), white, -C2.len / 2 + 2.6, top + 3.0, 0);
  add(new THREE.SphereGeometry(0.12, 8, 6), lit, C2.len / 2 - 2.6, top + 5.65, 0);
  add(new THREE.CylinderGeometry(0.04, 0.05, 3, 6), white, -L / 2 + 1.6, DY + 1.6, 0);
  // bow and stern open decks get a rail too
  for (const [x0, x1] of [
    [L / 2 - 7, L / 2 - 1.2],
    [-L / 2 + 0.6, -L / 2 + 2.2],
  ] as const)
    for (const sd of [-1, 1]) add(new THREE.BoxGeometry(x1 - x0, 0.05, 0.05), white, (x0 + x1) / 2, 2.36 + 1.0, sd * (B / 2 - 0.25 - (x0 > 0 ? (x1 - x0) * 0.25 : 0)));
  for (const [m, geos] of parts) {
    const o = new THREE.Mesh(mergeGeometries(geos), m);
    o.castShadow = m !== lit && m !== glassM;
    o.receiveShadow = true;
    g.add(o);
  }
  // name boards on the bow, both sides
  const name = canvasTex(512, 96, (ctx) => {
    ctx.clearRect(0, 0, 512, 96);
    ctx.fillStyle = '#1d3a63';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '800 72px "Baloo 2", sans-serif';
    ctx.fillText('ÜSKÜDAR', 256, 54);
  });
  for (const sd of [-1, 1]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 0.64), new THREE.MeshStandardMaterial({ map: name, transparent: true, roughness: 0.5 }));
    m.position.set(L / 2 - 8.5, 1.45, sd * (B / 2 + 0.02));
    m.rotation.y = sd > 0 ? 0 : Math.PI;
    g.add(m);
  }
  return g;
}

/**
 * A herring gull (martı), flying towards +x: white streamlined body with a grey mantle,
 * round head, yellow bill with the red spot, white tail; long swept grey wings with black
 * tips. children[1] / children[2] are the wing pivots (animate their rotation.x to flap).
 */
let gullParts: { body: THREE.BufferGeometry; mats: THREE.Material[]; wing: THREE.BufferGeometry; tip: THREE.BufferGeometry } | null = null;
export function gull(): THREE.Group {
  if (!gullParts) {
    const white = new THREE.MeshStandardMaterial({ color: 0xf7f7f3, roughness: 0.75, side: THREE.DoubleSide });
    const grey = new THREE.MeshStandardMaterial({ color: 0xaab3bb, roughness: 0.7, side: THREE.DoubleSide });
    const black = new THREE.MeshStandardMaterial({ color: 0x1e2226, roughness: 0.7, side: THREE.DoubleSide });
    const yellow = new THREE.MeshStandardMaterial({ color: 0xf2c12e, roughness: 0.5 });
    // body: a lathe from tail (−x) to breast (+x)
    const prof = [
      [0.0, -0.26],
      [0.025, -0.22],
      [0.06, -0.1],
      [0.072, 0.02],
      [0.065, 0.12],
      [0.04, 0.18],
      [0.0, 0.2],
    ].map(([r, y]) => new THREE.Vector2(r!, y!));
    const body = new THREE.LatheGeometry(prof, 10);
    body.rotateZ(-Math.PI / 2);
    body.scale(1, 0.9, 1);
    const mantle = new THREE.SphereGeometry(0.06, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2);
    mantle.scale(2.2, 0.55, 1.05);
    mantle.translate(-0.02, 0.025, 0);
    const head = new THREE.SphereGeometry(0.05, 10, 8);
    head.translate(0.22, 0.04, 0);
    const bill = new THREE.ConeGeometry(0.014, 0.075, 6);
    bill.rotateZ(-Math.PI / 2);
    bill.translate(0.3, 0.035, 0);
    const spot = new THREE.SphereGeometry(0.008, 5, 4);
    spot.translate(0.3, 0.026, 0);
    const tail = new THREE.ConeGeometry(0.05, 0.12, 4, 1);
    tail.rotateZ(Math.PI / 2);
    tail.scale(1, 0.25, 1);
    tail.translate(-0.3, 0.0, 0);
    const eyes = [-1, 1].map((sd) => new THREE.SphereGeometry(0.007, 5, 4).translate(0.245, 0.055, sd * 0.038));
    const strip = (geos: THREE.BufferGeometry[]) => mergeGeometries(geos.map((q) => { const n = q.index ? q.toNonIndexed() : q; for (const k of Object.keys(n.attributes)) if (k !== 'position' && k !== 'normal') n.deleteAttribute(k); return n; }));
    const parts: [THREE.BufferGeometry, THREE.Material][] = [
      [strip([body, head, tail]), white],
      [strip([mantle]), grey],
      [strip([bill]), yellow],
      [strip([spot]), new THREE.MeshStandardMaterial({ color: 0xc8302a })],
      [strip(eyes), black],
    ];
    const bodyGeo = mergeGeometries(parts.map(([geo]) => geo), true);
    // wing planform (x forward, y outward): broad inner wing, swept, pointed black tip
    const w = new THREE.Shape();
    w.moveTo(0.07, 0);
    w.quadraticCurveTo(0.1, 0.22, 0.04, 0.42);
    w.lineTo(-0.1, 0.42);
    w.quadraticCurveTo(-0.13, 0.2, -0.1, 0);
    w.closePath();
    const t = new THREE.Shape();
    t.moveTo(0.04, 0.42);
    t.quadraticCurveTo(0.0, 0.56, -0.1, 0.66);
    t.quadraticCurveTo(-0.1, 0.52, -0.1, 0.42);
    t.closePath();
    const wing = new THREE.ShapeGeometry(w, 6).rotateX(Math.PI / 2);
    const tip = new THREE.ShapeGeometry(t, 6).rotateX(Math.PI / 2);
    gullParts = { body: bodyGeo, mats: parts.map(([, m]) => m), wing, tip };
  }
  const { body, mats, wing, tip } = gullParts;
  const g = new THREE.Group();
  g.add(new THREE.Mesh(body, mats));
  for (const sd of [1, -1]) {
    const pivot = new THREE.Group();
    pivot.position.z = sd * 0.04;
    const wm = new THREE.Mesh(wing, mats[1]);
    const tm = new THREE.Mesh(tip, mats[4]);
    if (sd < 0) {
      wm.scale.z = -1;
      tm.scale.z = -1;
    }
    pivot.add(wm, tm);
    g.add(pivot);
  }
  g.scale.setScalar(1.25);
  g.name = 'gull';
  return g;
}

// ------------------------------------------------------------------ backdrops
/** Historic peninsula at sunset: domes, minarets, Galata on the right. */
export function skylineTexture(): THREE.CanvasTexture {
  const W = 4096;
  const H = 512;
  return canvasTex(W, H, (ctx) => {
    ctx.clearRect(0, 0, W, H);
    const base = 400;
    let seed = 7;
    const rnd = () => hash(seed++ * 0.731);
    // aerial perspective: each layer further back is lighter and bluer (sunset haze)
    const HAZE = ['rgba(176,146,164,0.55)', 'rgba(146,116,140,0.82)', 'rgba(112,86,114,0.95)'];
    const LAND = 'rgb(92,70,100)';
    // far hills across the Golden Horn
    ctx.fillStyle = HAZE[0]!;
    ctx.beginPath();
    ctx.moveTo(0, base);
    for (let x = 0; x <= W; x += 32) ctx.lineTo(x, base - 58 - Math.sin(x * 0.0019) * 40 - Math.sin(x * 0.0083) * 12);
    ctx.lineTo(W, H);
    ctx.lineTo(0, H);
    ctx.fill();
    /** a dense band of blocks (apartments, han roofs), with lit windows on the nearest band */
    const blocks = (color: string, y0: number, hMin: number, hMax: number, wMin: number, wMax: number, lights: number) => {
      ctx.fillStyle = color;
      const rects: [number, number, number, number][] = [];
      for (let x = 0; x < W; ) {
        const w = wMin + rnd() * (wMax - wMin);
        const hill = Math.sin(x * 0.0021) * 18 + Math.sin(x * 0.0007 + 1) * 14;
        const h = hMin + rnd() * (hMax - hMin) + hill;
        ctx.fillRect(x, y0 - h, w + 1, h + 40);
        if (rnd() < 0.3) ctx.fillRect(x + w * 0.2, y0 - h - 4, w * 0.6, 4);
        rects.push([x, y0 - h, w, h]);
        x += w;
      }
      for (let k = 0; k < lights; k++) {
        const r = rects[Math.floor(rnd() * rects.length)]!;
        const lx = r[0] + 2 + rnd() * Math.max(1, r[2] - 6);
        const ly = r[1] + 4 + rnd() * Math.max(1, r[3] - 8);
        ctx.fillStyle = rnd() < 0.7 ? 'rgba(255,206,130,0.9)' : 'rgba(255,236,196,0.7)';
        ctx.fillRect(lx, ly, 2.5, 2);
      }
    };
    blocks(HAZE[1]!, base - 8, 12, 40, 10, 26, 0);
    // tree-covered slopes and cypress groves
    const trees = (cx: number, n: number, spread: number, color: string) => {
      ctx.fillStyle = color;
      for (let k = 0; k < n; k++) {
        const x = cx + (rnd() - 0.5) * spread;
        ctx.beginPath();
        if (rnd() < 0.4) ctx.ellipse(x, base - 30 - rnd() * 10, 4, 22 + rnd() * 12, 0, 0, Math.PI * 2);
        else ctx.arc(x, base - 22 - rnd() * 14, 10 + rnd() * 8, 0, Math.PI * 2);
        ctx.fill();
      }
    };
    /** minaret: shaft, one to three şerefe balconies, a pencil cap and an alem */
    const minaret = (x: number, y: number, h: number, w: number, serefe: number) => {
      ctx.fillRect(x - w / 2, y - h, w, h);
      for (let k = 0; k < serefe; k++) ctx.fillRect(x - w * 0.95, y - h * (0.58 + k * 0.13), w * 1.9, Math.max(2, w * 0.35));
      ctx.beginPath();
      ctx.moveTo(x - w * 0.62, y - h);
      ctx.lineTo(x, y - h - w * 4.2);
      ctx.lineTo(x + w * 0.62, y - h);
      ctx.fill();
      ctx.fillRect(x - 0.6, y - h - w * 4.2 - 5, 1.2, 5);
    };
    const dome = (cx: number, y: number, r: number, flat = 0.82, drum = 0.22) => {
      ctx.fillRect(cx - r * 0.98, y - r * drum, r * 1.96, r * drum + 1);
      ctx.beginPath();
      ctx.ellipse(cx, y - r * drum, r, r * flat, 0, Math.PI, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(cx - 1, y - r * drum - r * flat - 8, 2, 8);
    };
    /** an imperial mosque: courtyard mass, cascading semi-domes and small domes, minarets */
    const mosque = (cx: number, y: number, r: number, minarets: number, spread: number, serefe: number) => {
      ctx.fillStyle = LAND;
      ctx.fillRect(cx - r * 2.3, y - r * 0.7, r * 4.6, r * 0.7 + 2);
      for (const sx of [-1, 1]) {
        dome(cx + sx * r * 0.95, y - r * 0.55, r * 0.55, 0.7, 0.15);
        dome(cx + sx * r * 1.75, y - r * 0.45, r * 0.32, 0.8, 0.2);
        for (let k = 0; k < 3; k++) dome(cx + sx * (r * 2.0 + k * r * 0.32), y - r * 0.3, r * 0.14, 0.9, 0.3);
      }
      dome(cx, y - r * 0.75, r, 0.78, 0.3);
      for (let k = 0; k < minarets; k++) {
        const t = minarets === 1 ? 0 : k / (minarets - 1) - 0.5;
        const mx = cx + t * spread * 2;
        const tall = Math.abs(t) > 0.3 ? 1 : 0.86;
        minaret(mx, y, r * 3.0 * tall, Math.max(4, r * 0.085), serefe - (tall < 1 ? 1 : 0));
      }
    };
    // Sarayburnu and the Topkapı ridge: cypresses, pavilion roofs, the Adalet tower
    trees(1620, 60, 420, 'rgb(84,72,96)');
    ctx.fillStyle = LAND;
    for (let k = 0; k < 9; k++) {
      const x = 1560 + k * 46;
      const hh = 26 + (k % 3) * 8;
      ctx.fillRect(x, base - hh, 40, hh);
      ctx.beginPath();
      ctx.moveTo(x - 4, base - hh);
      ctx.lineTo(x + 20, base - hh - 12);
      ctx.lineTo(x + 44, base - hh);
      ctx.fill();
    }
    ctx.fillRect(1700, base - 124, 20, 124);
    ctx.fillRect(1696, base - 128, 28, 8);
    ctx.beginPath();
    ctx.moveTo(1694, base - 128);
    ctx.lineTo(1710, base - 176);
    ctx.lineTo(1726, base - 128);
    ctx.fill();
    // the historic peninsula as seen from Salacak, exaggerated so it carries at this distance
    mosque(820, base, 70, 4, 105, 1); // Ayasofya: four minarets, a flatter dome
    mosque(1300, base - 4, 74, 6, 120, 3); // Sultanahmet: six minarets with three balconies
    trees(2050, 36, 300, 'rgb(84,72,96)');
    mosque(2150, base - 26, 66, 4, 110, 3); // Süleymaniye on its hill
    mosque(2650, base + 2, 48, 2, 70, 2); // Yeni Cami by the water
    // Galata across the Horn: cylinder, gallery, conical cap
    ctx.fillStyle = 'rgb(98,76,106)';
    ctx.fillRect(3302, base - 248, 46, 248);
    ctx.fillRect(3296, base - 262, 58, 14);
    for (let k = 0; k < 7; k++) ctx.fillRect(3298 + k * 8, base - 270, 4, 8);
    ctx.beginPath();
    ctx.moveTo(3292, base - 270);
    ctx.lineTo(3325, base - 352);
    ctx.lineTo(3358, base - 270);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,206,130,0.8)';
    for (let k = 0; k < 6; k++) ctx.fillRect(3306 + k * 7, base - 256, 3, 4);
    // the nearest band of the city with lit windows, then the shore lights
    blocks(HAZE[2]!, base + 6, 6, 26, 8, 22, 900);
    for (let x = 4; x < W; x += 9 + rnd() * 14) {
      ctx.fillStyle = rnd() < 0.8 ? 'rgba(255,214,150,0.95)' : 'rgba(255,255,235,0.8)';
      ctx.fillRect(x, base + 2 + rnd() * 3, 2, 2);
    }
    // fade both ends into the haze instead of a hard edge
    ctx.globalCompositeOperation = 'destination-out';
    for (const [x0, x1] of [
      [0, 260],
      [W, W - 260],
    ] as const) {
      const g = ctx.createLinearGradient(x0, 0, x1, 0);
      g.addColorStop(0, 'rgba(0,0,0,1)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(Math.min(x0, x1), 0, 260, H);
    }
    ctx.globalCompositeOperation = 'source-over';
  });
}

/** Animated water: deep blue-teal, sky fresnel, sun glitter path. */
export function waterMaterial(sunDir: THREE.Vector3): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uSun: { value: sunDir.clone().normalize() },
      uDeep: { value: new THREE.Color(0x173544) },
      uShallow: { value: new THREE.Color(0x27596a) },
      uSky: { value: new THREE.Color(0xb98a78) },
      uSunCol: { value: new THREE.Color(0xffd9a0) },
    },
    vertexShader: /* glsl */ `
      uniform float uTime;
      varying vec3 vW;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        w.y += sin(w.x * 0.08 + uTime * 0.9) * 0.08 + sin(w.z * 0.11 + uTime * 0.7) * 0.06;
        vW = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uSun;
      uniform vec3 uDeep;
      uniform vec3 uShallow;
      uniform vec3 uSky;
      uniform vec3 uSunCol;
      varying vec3 vW;
      float h21(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
      float vn(vec2 p){ vec2 i = floor(p); vec2 f = fract(p); f = f*f*(3.0-2.0*f);
        return mix(mix(h21(i), h21(i+vec2(1,0)), f.x), mix(h21(i+vec2(0,1)), h21(i+vec2(1,1)), f.x), f.y); }
      void main() {
        vec2 p = vW.xz;
        float t = uTime;
        float n1 = vn(p * 0.35 + vec2(t * 0.18, t * 0.05));
        float n2 = vn(p * 0.9 - vec2(t * 0.1, t * 0.22));
        vec3 nrm = normalize(vec3((n1 - 0.5) * 0.35 + (n2 - 0.5) * 0.25, 1.0, (n2 - 0.5) * 0.35 - (n1 - 0.5) * 0.2));
        vec3 view = normalize(cameraPosition - vW);
        float fres = pow(1.0 - max(dot(nrm, view), 0.0), 3.0);
        float dist = length(vW.xz - cameraPosition.xz);
        vec3 col = mix(uShallow, uDeep, smoothstep(0.0, 140.0, dist));
        col = mix(col, uSky, clamp(fres * 0.6 + smoothstep(150.0, 700.0, dist) * 0.45, 0.0, 0.7));
        vec3 r = reflect(-view, nrm);
        float spec = pow(max(dot(r, uSun), 0.0), 180.0) * 3.5 + pow(max(dot(r, uSun), 0.0), 18.0) * 0.25;
        col += uSunCol * spec;
        // foam line at the sea wall
        col = mix(col, vec3(0.92), smoothstep(1.2, 0.0, vW.z - 34.6) * 0.35 * (0.6 + 0.4 * n2));
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

/** A mosque on the hill behind (Mihrimah-style): dome, half domes, two minarets. */
export function hillMosque(b: Builder, x: number, y: number, z: number, s = 1): void {
  const c = 0xe6dfd2;
  const lead = 0x7d8c96;
  b.pat = PAT.stone;
  b.box(x, y, z, 22 * s, 9 * s, 18 * s, c);
  b.pat = PAT.none;
  b.add(new THREE.SphereGeometry(6.5 * s, 18, 9, 0, Math.PI * 2, 0, Math.PI / 2), lead, x, y + 11 * s, z);
  b.cyl(x, y + 9 * s, z, 6.8 * s, 2 * s, c, 18);
  for (const dx of [-8, 8]) b.add(new THREE.SphereGeometry(3 * s, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), lead, x + dx * s, y + 9 * s, z);
  for (const dx of [-12.5, 12.5]) {
    b.cyl(x + dx * s, y, z - 7 * s, 0.9 * s, 26 * s, c, 10, 0.75 * s);
    b.cyl(x + dx * s, y + 20 * s, z - 7 * s, 1.15 * s, 0.4 * s, c, 10);
    b.add(new THREE.ConeGeometry(0.9 * s, 4 * s, 10), lead, x + dx * s, y + 28 * s, z - 7 * s);
  }
}
