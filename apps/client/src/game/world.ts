import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { BASE, BASE_RADIUS, MAP_HALF, MAP_OBJECTS, type MapObject } from '@sokak/shared';
import { PAT, patternize, type Pattern } from './materials';
import { Foliage } from './foliage';
import { parkedCar } from './cars';

/**
 * The mahalle, built procedurally so every visual exactly matches its
 * collider. Geometry is merged per material bucket (a handful of draw
 * calls); surface detail (plaster, brick, paving, asphalt, grass, wood…)
 * comes from a world-space pattern shader, so no textures are needed.
 * Parked cars are Kenney CC0 models loaded in the background.
 */

export interface Mover {
  x: number;
  z: number;
  speed: number;
}

export interface World {
  /** level-specific extras are optional */
  /** 0 = late afternoon, 1 = night: lamps and lit windows fade in */
  setDusk(d: number): void;
  /** animate ambient life; `movers` are characters that can scare pigeons */
  update(dt: number, movers: Mover[]): void;
  /** keep shadows near the camera focus (optional) */
  follow?(x: number, z: number): void;
}

/** detail = small static clutter (shop stock, window trim): drawn like main but casts no shadow */
export type Bucket = 'main' | 'glow' | 'ground' | 'foliage' | 'cars' | 'varnish' | 'detail';

export class Builder {
  private parts: Record<Bucket, THREE.BufferGeometry[]> = { main: [], glow: [], ground: [], foliage: [], cars: [], varnish: [], detail: [] };
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private e = new THREE.Euler();
  private s = new THREE.Vector3(1, 1, 1);
  private p = new THREE.Vector3();
  private color = new THREE.Color();
  /** pattern applied to subsequent adds */
  pat: Pattern = PAT.none;
  bucket: Bucket = 'main';

  add(geo: THREE.BufferGeometry, color: number, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, bucket: Bucket = this.bucket): void {
    this.q.setFromEuler(this.e.set(rx, ry, rz));
    this.m.compose(this.p.set(x, y, z), this.q, this.s);
    this.addMatrix(geo, color, this.m, bucket);
  }

  /** add with a full transform (nested rotations, scale) */
  addMatrix(geo: THREE.BufferGeometry, color: number, matrix: THREE.Matrix4, bucket: Bucket = this.bucket): void {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    g.applyMatrix4(matrix);
    this.color.setHex(color);
    const n = g.getAttribute('position').count;
    const cols = new Float32Array(n * 3);
    const pats = new Float32Array(n).fill(this.pat);
    for (let i = 0; i < n; i++) {
      cols[i * 3] = this.color.r;
      cols[i * 3 + 1] = this.color.g;
      cols[i * 3 + 2] = this.color.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    g.setAttribute('pat', new THREE.BufferAttribute(pats, 1));
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'color', 'pat'].includes(k)) g.deleteAttribute(k);
    this.parts[bucket].push(g);
    geo.dispose();
  }

  /** axis-aligned box given by its bottom-center */
  box(x: number, y: number, z: number, w: number, h: number, d: number, color: number, bucket: Bucket = this.bucket, ry = 0): void {
    this.add(new THREE.BoxGeometry(w, h, d), color, x, y + h / 2, z, 0, ry, 0, bucket);
  }

  cyl(x: number, y: number, z: number, r: number, h: number, color: number, seg = 10, r2 = r, bucket: Bucket = this.bucket): void {
    this.add(new THREE.CylinderGeometry(r2, r, h, seg), color, x, y + h / 2, z, 0, 0, 0, bucket);
  }

  blob(x: number, y: number, z: number, r: number, color: number, sy = 1, detail = 1, bucket: Bucket = this.bucket): void {
    const g = new THREE.IcosahedronGeometry(r, detail);
    g.scale(1, sy, 1);
    this.add(g, color, x, y, z, 0, 0, 0, bucket);
  }

  build(bucket: Bucket): THREE.BufferGeometry | null {
    const list = this.parts[bucket];
    if (!list.length) return null;
    const merged = mergeGeometries(list, false);
    merged.computeBoundingSphere();
    for (const g of list) g.dispose();
    return merged;
  }
}

/** deterministic pseudo random from a seed */
export function hash(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

const BUILDING_COLORS = [0xf2d3a8, 0xe9a88c, 0xf6ecd2, 0xbcd7d3, 0xeec27d];
const SHUTTER_COLORS = [0x3f7d5a, 0x2f6fa8, 0x8a4b2f, 0x5b6f7d];
const CAR_COLORS = [0xd9473b, 0x3b78d9, 0xf4f1e8, 0x4caf6a];
const SHEET_COLORS = [0xf6f3ea, 0x8fc7f0, 0xf3a8bd, 0xfbe17a, 0xb6e3a6];
const FLOWER_COLORS = [0xe8414f, 0xff9f1c, 0xf15bb5, 0xffffff, 0xc77dff];

// ------------------------------------------------------------------ buildings
function windowUnit(b: Builder, wx: number, y: number, wz: number, axis: number, sign: number, k: number, tall: boolean): void {
  const lit = hash(k) < 0.33;
  const ww = 1.05;
  const wh = 1.45;
  const along = (w: number, d: number): [number, number] => (axis === 0 ? [w, d] : [d, w]);
  const out = (o: number): [number, number] => (axis === 0 ? [wx, wz + sign * o] : [wx + sign * o, wz]);
  // frame, sill, glass (dark or warmly lit), mullion
  b.pat = PAT.none;
  let [fx, fz] = out(0.05);
  b.box(fx, y - 0.1, fz, ...whd(along(ww + 0.22, 0.1), wh + 0.2), 0xfbf6ea);
  [fx, fz] = out(0.14);
  b.box(fx, y - 0.16, fz, ...whd(along(ww + 0.36, 0.22), 0.08), 0xe6dccb);
  [fx, fz] = out(0.11);
  b.box(fx, y, fz, ...whd(along(ww, 0.04), wh), lit ? (hash(k + 1) < 0.5 ? 0xffd38a : 0xffbe7a) : 0x3a4d62, lit ? 'glow' : 'main');
  [fx, fz] = out(0.13);
  b.box(fx, y, fz, ...whd(along(0.06, 0.03), wh), 0xfbf6ea);
  const r = hash(k + 7);
  if (r < 0.28) {
    // wooden shutters
    b.pat = PAT.wood;
    const sc = SHUTTER_COLORS[Math.floor(hash(k + 3) * SHUTTER_COLORS.length)]!;
    for (const s of [-1, 1]) {
      const off = s * (ww / 2 + 0.32);
      const [sx, sz] = axis === 0 ? [wx + off, wz + sign * 0.1] : [wx + sign * 0.1, wz + off];
      b.box(sx, y - 0.05, sz, ...whd(along(0.5, 0.06), wh + 0.1), sc);
    }
    b.pat = PAT.none;
  } else if (r < 0.45) {
    // flower box
    [fx, fz] = out(0.3);
    b.box(fx, y - 0.32, fz, ...whd(along(ww + 0.1, 0.3), 0.24), 0x9b5a33);
    for (let i = 0; i < 4; i++) {
      const t = -ww / 2 + 0.15 + (i * (ww - 0.3)) / 3;
      const [px, pz] = axis === 0 ? [wx + t, wz + sign * 0.3] : [wx + sign * 0.3, wz + t];
      b.blob(px, y - 0.02, pz, 0.12, 0x4f9a3f, 0.8, 0, 'foliage');
      b.blob(px, y + 0.06, pz, 0.06, FLOWER_COLORS[(k + i) % FLOWER_COLORS.length]!, 1, 0, 'main');
    }
  } else if (tall && r < 0.6) {
    // small balcony with railing (and maybe a plant)
    [fx, fz] = out(0.55);
    b.box(fx, y - 0.32, fz, ...whd(along(ww + 0.9, 1.0), 0.12), 0xd8d2c6);
    [fx, fz] = out(1.02);
    b.box(fx, y - 0.2, fz, ...whd(along(ww + 0.9, 0.05), 0.85), 0x4a4f56);
    if (hash(k + 11) < 0.5) {
      [fx, fz] = out(0.7);
      b.cyl(fx + 0.4, y - 0.2, fz, 0.13, 0.28, 0xb8643c, 8, 0.1);
      b.blob(fx + 0.4, y + 0.2, fz, 0.22, 0x5aa04a, 1.1, 1, 'foliage');
    }
  } else if (r > 0.92) {
    // AC unit
    const [ax, az] = axis === 0 ? [wx + 0.9, wz + sign * 0.3] : [wx + sign * 0.3, wz + 0.9];
    b.box(ax, y - 0.55, az, ...whd(along(0.7, 0.45), 0.5), 0xeceff1);
  }
}

/** [w, h, d] helper from an [x, z] pair and a height */
function whd([w, d]: [number, number], h: number): [number, number, number] {
  return [w, h, d];
}

function building(b: Builder, o: MapObject, idx: number): void {
  const base = BUILDING_COLORS[(o.tint ?? 0) % BUILDING_COLORS.length]!;
  const tall = o.h >= 9;
  const x0 = o.x - o.w / 2;
  const z0 = o.z - o.d / 2;
  b.pat = PAT.plaster;
  b.box(o.x, 0, o.z, o.w, o.h, o.d, base);
  b.pat = PAT.stone;
  b.box(o.x, 0, o.z, o.w + 0.1, 0.8, o.d + 0.1, 0x9d9286);
  b.pat = PAT.none;
  // floor ledges + cornice
  for (let y = 3.6; y < o.h - 1; y += 3) b.box(o.x, y, o.z, o.w + 0.12, 0.12, o.d + 0.12, 0xf3ece0);
  b.box(o.x, o.h - 0.3, o.z, o.w + 0.35, 0.3, o.d + 0.35, 0xf7f1e6);
  // roof: gravel + parapet
  b.pat = PAT.roof;
  b.box(o.x, o.h - 0.01, o.z, o.w - 0.2, 0.05, o.d - 0.2, 0x8f8a84);
  b.pat = PAT.plaster;
  b.box(o.x, o.h, o.z - o.d / 2 + 0.1, o.w, 0.45, 0.2, base);
  b.box(o.x, o.h, o.z + o.d / 2 - 0.1, o.w, 0.45, 0.2, base);
  b.box(o.x - o.w / 2 + 0.1, o.h, o.z, 0.2, 0.45, o.d, base);
  b.box(o.x + o.w / 2 - 0.1, o.h, o.z, 0.2, 0.45, o.d, base);
  b.pat = PAT.none;

  const floors = Math.floor((o.h - 1) / 3);
  const faces: [number, number, number, number, number][] = [
    [0, o.w, o.z + o.d / 2, 1, x0],
    [0, o.w, o.z - o.d / 2, -1, x0],
    [1, o.d, o.x + o.w / 2, 1, z0],
    [1, o.d, o.x - o.w / 2, -1, z0],
  ];
  let k = idx * 1000;
  for (const [axis, len, fixed, sign, origin] of faces) {
    // faces glued to the map boundary are never seen
    if (Math.abs(fixed) > MAP_HALF - 0.5) continue;
    const cols = Math.floor(len / 2.7);
    if (cols < 1) continue;
    const step = len / cols;
    for (let f = 0; f < floors; f++) {
      const y = 1.35 + f * 3;
      for (let c = 0; c < cols; c++) {
        k++;
        const along = origin + step * (c + 0.5);
        const [wx, wz] = axis === 0 ? [along, fixed] : [fixed, along];
        windowUnit(b, wx, y, wz, axis, sign, k, tall && f > 0);
      }
    }
  }
  // rooftop clutter
  if (o.h > 6) {
    b.cyl(o.x - o.w * 0.25, o.h, o.z, 0.65, 1.2, 0xc9ccd1, 12);
    b.cyl(o.x - o.w * 0.25, o.h + 1.2, o.z, 0.68, 0.08, 0x9aa0a6, 12);
    b.box(o.x + o.w * 0.2, o.h, o.z - o.d * 0.2, 0.06, 2.4, 0.06, 0x555555);
    b.box(o.x + o.w * 0.2, o.h + 1.8, o.z - o.d * 0.2, 1.3, 0.05, 0.05, 0x555555);
    b.box(o.x + o.w * 0.3, o.h, o.z + o.d * 0.25, 0.7, 1.4, 0.7, 0xb06a4a);
    const dish = new THREE.SphereGeometry(0.45, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2);
    b.add(dish, 0xeef0f2, o.x - o.w * 0.1, o.h + 0.9, o.z + o.d * 0.3, -2.2, 0, 0);
    b.box(o.x - o.w * 0.1, o.h, o.z + o.d * 0.3, 0.06, 0.9, 0.06, 0x777777);
  }
}

/** Front door + number plate + lamp under an apartment entrance canopy. */
function entrance(b: Builder, slab: MapObject, n: number): void {
  const zBack = slab.z - slab.d / 2 + 0.02;
  b.pat = PAT.wood;
  b.box(slab.x, 0, zBack + 0.06, 1.4, 2.3, 0.12, 0x7a4a2a);
  b.pat = PAT.none;
  b.box(slab.x, 2.3, zBack + 0.06, 1.6, 0.12, 0.16, 0xf3ece0);
  b.box(slab.x + 0.45, 1.0, zBack + 0.14, 0.08, 0.18, 0.06, 0xd4af37);
  b.box(slab.x + 1.0, 1.8, zBack + 0.08, 0.3, 0.22, 0.04, 0x2f5aa8);
  b.box(slab.x + 1.0, 1.82, zBack + 0.11, 0.22, 0.12, 0.02, 0xffffff);
  b.cyl(slab.x - 1.0, 2.0, zBack + 0.15, 0.1, 0.22, 0xffe6a8, 8, 0.1, 'glow');
  b.pat = PAT.stone;
  b.box(slab.x, 0, zBack + 0.6, 2.2, 0.12, 1.0, 0xbdb4a6);
  b.pat = PAT.none;
  void n;
}

// ------------------------------------------------------------------ vehicles
function dolmus(b: Builder, o: MapObject): void {
  b.pat = PAT.none;
  b.box(o.x, 0.35, o.z, o.w, o.h - 0.35, o.d, 0xf2cf3b);
  b.box(o.x, 1.45, o.z, o.w + 0.02, 0.8, o.d + 0.02, 0x2c3a4a);
  b.box(o.x, o.h - 0.06, o.z, o.w - 0.3, 0.12, o.d - 0.3, 0xe8c22e);
  b.box(o.x, 0.35, o.z, o.w + 0.04, 0.22, o.d + 0.04, 0x333333);
  // black & white checker band
  const n = Math.floor(o.w / 0.3);
  for (let i = 0; i < n; i++) {
    for (const row of [0, 1]) {
      const col = (i + row) % 2 ? 0x111111 : 0xffffff;
      const x = o.x - o.w / 2 + (i + 0.5) * (o.w / n);
      for (const side of [-1, 1]) b.box(x, 1.12 + row * 0.13, o.z + side * (o.d / 2 + 0.02), o.w / n, 0.13, 0.02, col);
    }
  }
  b.box(o.x + o.w / 2 + 0.02, 0.75, o.z, 0.04, 0.2, o.d * 0.7, 0xfff6c8, 'glow');
  b.box(o.x + o.w / 2 + 0.01, 1.45, o.z, 0.04, 0.7, o.d * 0.85, 0x3d5468);
  for (const dx of [-o.w * 0.33, o.w * 0.33]) {
    for (const dz of [-o.d / 2, o.d / 2]) {
      const g = new THREE.CylinderGeometry(0.42, 0.42, 0.28, 14);
      g.rotateX(Math.PI / 2);
      b.add(g, 0x1e1e1e, o.x + dx, 0.42, o.z + dz);
      const h = new THREE.CylinderGeometry(0.2, 0.2, 0.3, 10);
      h.rotateX(Math.PI / 2);
      b.add(h, 0xc8ccd0, o.x + dx, 0.42, o.z + dz);
    }
  }
}

// ------------------------------------------------------------------ nature
function tree(b: Builder, trunk: MapObject | null, canopy: MapObject, idx: number, leaves: Foliage): void {
  const r = canopy.w / 2;
  const cy = canopy.y + canopy.h * 0.5;
  if (trunk) {
    // trunk with a slight lean, three limbs into the crown
    b.pat = PAT.wood;
    const top = new THREE.Vector3(trunk.x + (hash(idx) - 0.5) * 0.3, canopy.y + 0.3, trunk.z + (hash(idx + 3) - 0.5) * 0.3);
    branch(b, new THREE.Vector3(trunk.x, 0, trunk.z), top, trunk.w / 2, trunk.w * 0.3, 0x6b4a2f);
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2 + idx;
      branch(b, top, new THREE.Vector3(top.x + Math.cos(a) * r * 0.55, cy + 0.2, top.z + Math.sin(a) * r * 0.55), trunk.w * 0.22, trunk.w * 0.1, 0x6b4a2f);
    }
    b.pat = PAT.none;
  }
  // dense leaf-card crowns: a core and clumps around it (trees are hiding spots, keep them full)
  leaves.crown(canopy.x, cy, canopy.z, r * 0.85, canopy.h * 0.48, r * 0.85, Math.round(75 * r), 1.05);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + idx;
    leaves.crown(canopy.x + Math.cos(a) * r * 0.5, cy + (hash(idx * 7 + i) - 0.3) * canopy.h * 0.35, canopy.z + Math.sin(a) * r * 0.5, r * 0.55, canopy.h * 0.36, r * 0.55, Math.round(28 * r), 0.95);
  }
}

const _yUp = new THREE.Vector3(0, 1, 0);
function branch(b: Builder, a: THREE.Vector3, e: THREE.Vector3, r0: number, r1: number, color: number): void {
  const d = e.clone().sub(a);
  const len = d.length();
  const g = new THREE.CylinderGeometry(r1, r0, len, 7, 1);
  g.translate(0, len / 2, 0);
  b.addMatrix(g, color, new THREE.Matrix4().compose(a, new THREE.Quaternion().setFromUnitVectors(_yUp, d.normalize()), new THREE.Vector3(1, 1, 1)));
}

function bush(b: Builder, o: MapObject, i: number): void {
  b.pat = PAT.leaves;
  const m = Math.min(o.w, o.d);
  const greens = [0x5a9e45, 0x4e9140, 0x67b04f];
  b.blob(o.x - o.w * 0.22, o.h * 0.45, o.z, m * 0.5, greens[0]!, 0.8, 1, 'foliage');
  b.blob(o.x + o.w * 0.22, o.h * 0.5, o.z + o.d * 0.1, m * 0.46, greens[1]!, 0.85, 1, 'foliage');
  b.blob(o.x, o.h * 0.62, o.z - o.d * 0.15, m * 0.42, greens[2]!, 0.8, 1, 'foliage');
  b.pat = PAT.none;
  if (i % 2 === 0) {
    for (let k = 0; k < 5; k++) {
      const a = k * 1.3 + i;
      b.blob(o.x + Math.cos(a) * o.w * 0.4, o.h * 0.7, o.z + Math.sin(a) * o.d * 0.35, 0.07, FLOWER_COLORS[(i + k) % 5]!, 1, 0);
    }
  }
}

// ------------------------------------------------------------------ ground
function ground(b: Builder): void {
  b.bucket = 'ground';
  const H = MAP_HALF + 1;
  b.pat = PAT.asphalt;
  b.add(new THREE.BoxGeometry(H * 2 + 160, 0.1, H * 2 + 160), 0x8e8984, 0, -0.05, 0);
  // sidewalks with curbs around blocks
  for (const o of MAP_OBJECTS) {
    if (o.kind !== 'building' && o.kind !== 'shop' && o.kind !== 'kiosk') continue;
    b.pat = PAT.stone;
    b.box(o.x, 0, o.z, o.w + 3.3, 0.05, o.d + 3.3, 0x9f978c);
    b.pat = PAT.tiles;
    b.box(o.x, 0.002, o.z, o.w + 3, 0.055, o.d + 3, 0xd6cbbb);
  }
  // plaza: cobblestone ring + tiled center
  b.pat = PAT.stone;
  b.add(new THREE.CylinderGeometry(12.5, 12.5, 0.06, 48), 0xcbb998, 0, 0.0, 2);
  b.pat = PAT.tiles;
  b.add(new THREE.CylinderGeometry(9, 9, 0.065, 48), 0xe2d3b3, 0, 0.003, 2);
  // grass
  b.pat = PAT.grass;
  for (const [x0, z0, x1, z1] of [
    [-60, 12, -12, 54],
    [18, 16, 46, 38],
  ] as const) {
    b.add(new THREE.BoxGeometry(x1 - x0, 0.07, z1 - z0), 0x7db35a, (x0 + x1) / 2, 0.006, (z0 + z1) / 2);
  }
  b.pat = PAT.grass;
  b.add(new THREE.BoxGeometry(17, 0.068, 10), 0xb49a73, -18.5, 0.006, -22);
  b.pat = PAT.none;
  // road markings + zebra crossings
  for (let x = -54; x <= 54; x += 6) {
    if (Math.abs(x) < 14) continue;
    b.add(new THREE.BoxGeometry(2.6, 0.075, 0.16), 0xf2efe6, x, 0.01, 0);
  }
  for (let z = -54; z <= 54; z += 6) {
    if (Math.abs(z) < 14) continue;
    b.add(new THREE.BoxGeometry(0.16, 0.075, 2.6), 0xf2efe6, 0, 0.01, z);
  }
  for (const [cx, cz, alongX] of [
    [0, -14.5, true],
    [0, 15.5, true],
    [-14.5, 0, false],
    [14.5, 0, false],
  ] as const) {
    for (let i = -3; i <= 3; i++) {
      if (alongX) b.add(new THREE.BoxGeometry(0.5, 0.075, 2.4), 0xf4f1ea, cx + i * 0.9, 0.012, cz);
      else b.add(new THREE.BoxGeometry(2.4, 0.075, 0.5), 0xf4f1ea, cx, 0.012, cz + i * 0.9);
    }
  }
  // manholes + drains
  for (const [x, z] of [
    [-30, 2],
    [26, -2],
    [3, 32],
    [-4, -34],
  ] as const) {
    b.cyl(x, 0.0, z, 0.45, 0.07, 0x55524e, 16);
    b.cyl(x, 0.01, z, 0.36, 0.07, 0x6a6661, 16);
  }
  b.bucket = 'main';
}

function skyline(b: Builder): void {
  let k = 0;
  for (let side = 0; side < 4; side++) {
    for (let t = -75; t <= 75; t += 10) {
      k++;
      const h = 9 + hash(k) * 18;
      const w = 7 + hash(k + 3) * 4;
      const dist = 70 + hash(k + 5) * 12;
      const [x, z] = side === 0 ? [t, -dist] : side === 1 ? [t, dist] : side === 2 ? [-dist, t] : [dist, t];
      const col = BUILDING_COLORS[k % BUILDING_COLORS.length]!;
      b.pat = PAT.plaster;
      b.box(x, 0, z, w, h, w, col);
      b.pat = PAT.none;
      b.box(x, h, z, w + 0.3, 0.3, w + 0.3, 0xf3ece0);
      for (let f = 0; f < Math.floor(h / 3) - 1; f++) {
        for (const off of [-w * 0.25, w * 0.25]) {
          const lit = hash(k * 31 + f + off) < 0.4;
          const fz = side === 0 ? z + w / 2 + 0.05 : side === 1 ? z - w / 2 - 0.05 : z + off;
          const fx = side === 2 ? x + w / 2 + 0.05 : side === 3 ? x - w / 2 - 0.05 : x + off;
          b.box(fx, 2 + f * 3, fz, side < 2 ? 1.2 : 0.1, 1.3, side < 2 ? 0.1 : 1.2, lit ? 0xffcf86 : 0x4a5666, lit ? 'glow' : 'main');
        }
      }
    }
  }
}

export function canvasTex(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export function sign(text: string, bg: string, fg: string, w = 512, h = 128): THREE.CanvasTexture {
  return canvasTex(w, h, (ctx) => {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 6;
    ctx.strokeRect(6, 6, w - 12, h - 12);
    ctx.fillStyle = fg;
    ctx.font = `900 ${Math.floor(h * 0.58)}px 'Trebuchet MS', sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, w / 2, h / 2 + 4);
  });
}

export function decal(scene: THREE.Scene, tex: THREE.Texture, x: number, y: number, z: number, w: number, h: number, ry = 0, flat = false, opacity = 1): THREE.Mesh {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshStandardMaterial({ map: tex, transparent: opacity < 1 || flat, opacity, roughness: 0.8, depthWrite: !flat, polygonOffset: flat, polygonOffsetFactor: -2 }),
  );
  m.position.set(x, y, z);
  if (flat) m.rotation.x = -Math.PI / 2;
  m.rotation.y = flat ? 0 : ry;
  if (flat) m.rotation.z = ry;
  m.receiveShadow = true;
  scene.add(m);
  return m;
}

/** Chalk hopscotch (seksek) drawn on the plaza. */
function hopscotchTex(): THREE.CanvasTexture {
  return canvasTex(256, 512, (ctx) => {
    ctx.clearRect(0, 0, 256, 512);
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 7;
    ctx.font = 'bold 44px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const cells: [number, number, number][] = [
      [88, 430, 1], [88, 350, 2], [40, 270, 3], [136, 270, 4], [88, 190, 5], [40, 110, 6], [136, 110, 7],
    ];
    for (const [x, y, n] of cells) {
      ctx.strokeRect(x - 0, y - 40, 80, 80);
      ctx.fillText(String(n), x + 40, y);
    }
    ctx.beginPath();
    ctx.arc(128, 40, 36, Math.PI, 0);
    ctx.stroke();
  });
}

// ------------------------------------------------------------------ ambient life
interface Pigeon {
  g: THREE.Group;
  home: THREE.Vector3;
  t: number;
  fly: number;
  dir: THREE.Vector3;
}

function makePigeon(): THREE.Group {
  const g = new THREE.Group();
  const grey = new THREE.MeshStandardMaterial({ color: 0x8e96a3, roughness: 0.9 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x5c6470, roughness: 0.9 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), grey);
  body.scale.set(0.8, 0.8, 1.3);
  body.position.y = 0.14;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.065, 8, 6), dark);
  head.position.set(0, 0.26, -0.13);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.06, 5), new THREE.MeshStandardMaterial({ color: 0xe0a040 }));
  beak.rotation.x = -Math.PI / 2;
  beak.position.set(0, 0.25, -0.2);
  const wing = new THREE.Group();
  wing.position.y = 0.19;
  wing.name = 'wing';
  for (const s of [-1, 1]) {
    const w = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), dark);
    w.scale.set(0.35, 0.25, 1.1);
    w.position.set(s * 0.08, 0, 0.02);
    wing.add(w);
  }
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.02, 0.14), dark);
  tail.position.set(0, 0.16, 0.17);
  tail.rotation.x = -0.3;
  g.add(body, head, beak, wing, tail);
  return g;
}

function clouds(scene: THREE.Scene): THREE.Group {
  const group = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: 0xfff3e6, emissive: 0xffd8b0, emissiveIntensity: 0.35, flatShading: true, fog: false });
  const parts: THREE.BufferGeometry[] = [];
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    const cx = Math.cos(a) * 170;
    const cz = Math.sin(a) * 170;
    const cy = 70 + hash(i) * 30;
    for (let k = 0; k < 5; k++) {
      const g = new THREE.IcosahedronGeometry(6 + hash(i * 9 + k) * 5, 1);
      g.scale(1, 0.55, 1);
      // spread puffs sideways (tangent to the circle)
      const t = k * 7 - 14;
      g.applyMatrix4(m4.makeTranslation(cx - Math.sin(a) * t, cy + hash(i + k) * 3, cz + Math.cos(a) * t));
      parts.push(g);
    }
  }
  group.add(new THREE.Mesh(mergeGeometries(parts, false), mat));
  for (const g of parts) g.dispose();
  scene.add(group);
  return group;
}

// ------------------------------------------------------------------ main
export function buildWorld(scene: THREE.Scene): World {
  const b = new Builder();
  ground(b);
  skyline(b);
  const lampPools: THREE.Vector3[] = [];
  const sheets: { x: number; z: number; w: number; h: number; y: number; c: number }[] = [];
  const trunks = MAP_OBJECTS.filter((o) => o.kind === 'trunk');
  const leaves = new Foliage();
  let entranceN = 0;

  MAP_OBJECTS.forEach((o, i) => {
    b.pat = PAT.none;
    switch (o.kind) {
      case 'boundary':
        b.pat = PAT.brick;
        b.box(o.x, 0, o.z, o.w, o.h, o.d, 0xc98b6a);
        b.pat = PAT.none;
        b.box(o.x, o.h, o.z, o.w + 0.2, 0.3, o.d + 0.2, 0xf1e3c4);
        break;
      case 'building':
        building(b, o, i);
        break;
      case 'shop': {
        b.pat = PAT.plaster;
        b.box(o.x, 0, o.z, o.w, o.h, o.d, 0xf3ead5);
        b.pat = PAT.none;
        const front = o.z + o.d / 2;
        b.box(o.x, 0.4, front + 0.05, o.w * 0.78, 2.2, 0.08, 0x9fd3e6, 'glow');
        for (let k = 0; k <= 4; k++) b.box(o.x - o.w * 0.39 + (k * o.w * 0.78) / 4, 0.4, front + 0.1, 0.08, 2.2, 0.06, 0x2f6a45);
        b.pat = PAT.stone;
        b.box(o.x, 0, front, o.w, 0.45, 0.3, 0x3f8f5a);
        b.pat = PAT.none;
        b.box(o.x, o.h - 0.3, o.z, o.w + 0.2, 0.3, o.d + 0.2, 0x3f8f5a);
        // fruit stand + bread rack in front
        b.pat = PAT.wood;
        b.box(o.x - 3.5, 0, front + 0.9, 2.4, 0.8, 0.8, 0x9b6a3f);
        b.pat = PAT.none;
        for (let k = 0; k < 10; k++) b.blob(o.x - 4.5 + (k % 5) * 0.48, 0.88, front + 0.75 + Math.floor(k / 5) * 0.32, 0.13, [0xff8c2a, 0xd93a2b, 0x6fbf3f, 0xf2d24b][k % 4]!, 1, 0);
        break;
      }
      case 'kiosk':
        b.pat = PAT.wood;
        b.box(o.x, 0, o.z, o.w, o.h, o.d, 0xd9a066);
        b.pat = PAT.none;
        b.box(o.x, 0, o.z, o.w + 0.05, 1.0, o.d + 0.05, 0xc0533b);
        b.box(o.x - o.w / 2 - 0.05, 1.0, o.z, 0.1, 1.2, o.d * 0.7, 0xffd9a0, 'glow');
        b.box(o.x, o.h, o.z, o.w + 0.9, 0.2, o.d + 0.9, 0xc0533b);
        // samovar
        b.cyl(o.x - o.w / 2 - 0.35, 1.0, o.z - 1, 0.22, 0.6, 0xc9ccd1, 12);
        b.cyl(o.x - o.w / 2 - 0.35, 1.6, o.z - 1, 0.12, 0.2, 0xb0b4b8, 10);
        break;
      case 'ebeWall':
        b.pat = PAT.brick;
        b.box(o.x, 0, o.z, o.w, o.h, o.d, 0xc4553a);
        b.pat = PAT.plaster;
        b.box(o.x, o.h, o.z, o.w + 0.24, 0.18, o.d + 0.24, 0xece3d3);
        b.pat = PAT.none;
        // chalk tally marks
        for (let k = 0; k < 7; k++) b.box(o.x - 1.9 + k * 0.12, 0.6, o.z + o.d / 2 + 0.01, 0.03, 0.4, 0.01, 0xf8f8f8);
        b.box(o.x - 1.55, 0.8, o.z + o.d / 2 + 0.012, 0.9, 0.03, 0.01, 0xf8f8f8);
        break;
      case 'wall':
        b.pat = PAT.plaster;
        b.box(o.x, 0, o.z, o.w, o.h, o.d, 0xe2d6bf);
        b.pat = PAT.stone;
        b.box(o.x, o.h, o.z, o.w + 0.1, 0.14, o.d + 0.16, 0xb7a98f);
        b.pat = PAT.none;
        break;
      case 'fence': {
        const alongX = o.w >= o.d;
        const len = alongX ? o.w : o.d;
        const n = Math.max(2, Math.round(len / 0.25));
        for (let k = 0; k <= n; k++) {
          const t = -len / 2 + (len * k) / n;
          const big = k % 6 === 0;
          b.box(alongX ? o.x + t : o.x, 0, alongX ? o.z : o.z + t, big ? 0.08 : 0.03, o.h + (big ? 0.05 : 0), big ? 0.08 : 0.03, 0x2f6f4f);
        }
        b.box(o.x, o.h - 0.08, o.z, alongX ? o.w : 0.06, 0.06, alongX ? 0.06 : o.d, 0x2f6f4f);
        b.box(o.x, 0.12, o.z, alongX ? o.w : 0.06, 0.06, alongX ? 0.06 : o.d, 0x2f6f4f);
        break;
      }
      case 'car':
        parkedCar(b, o.x, o.z, o.w >= o.d ? (i % 2 ? Math.PI : 0) : (i % 2 ? Math.PI / 2 : -Math.PI / 2), 0, { paint: CAR_COLORS[(o.tint ?? 0) % CAR_COLORS.length]! });
        break;
      case 'brokenCar':
        parkedCar(b, o.x, o.z, o.w >= o.d ? 0 : Math.PI / 2, 0, { broken: true });
        break;
      case 'minibus':
        dolmus(b, o);
        break;
      case 'crate': {
        const col = [0xd8473b, 0x3d7fd1, 0xe9b23a][i % 3]!;
        b.box(o.x, o.y, o.z, o.w, o.h, o.d, col);
        for (let k = 0; k < 3; k++) b.box(o.x, o.y + 0.15 + k * 0.22, o.z, o.w + 0.02, 0.05, o.d + 0.02, 0x00000 + (col & 0xdddddd));
        b.box(o.x, o.y + o.h - 0.06, o.z, o.w + 0.03, 0.06, o.d + 0.03, 0x2b2b2b);
        if (o.y === 0 || i % 2) for (let k = 0; k < 3; k++) b.blob(o.x - 0.2 + k * 0.2, o.y + o.h + 0.06, o.z + (k % 2) * 0.12 - 0.06, 0.13, [0xff8c2a, 0xd93a2b, 0x6fbf3f][(i + k) % 3]!, 1, 0);
        break;
      }
      case 'container':
        b.box(o.x, 0.18, o.z, o.w, o.h - 0.28, o.d, 0x2f6b4a);
        b.box(o.x, o.h - 0.12, o.z, o.w + 0.12, 0.12, o.d + 0.12, 0x24543a);
        b.box(o.x, 0.6, o.z + o.d / 2 + 0.01, o.w * 0.5, 0.25, 0.02, 0xf2f2f2);
        for (const dx of [-o.w * 0.38, o.w * 0.38]) for (const dz of [-o.d * 0.35, o.d * 0.35]) b.cyl(o.x + dx, 0, o.z + dz, 0.1, 0.18, 0x111111, 8);
        break;
      case 'trunk':
        break;
      case 'canopy': {
        const t = trunks.find((tr) => Math.abs(tr.x - o.x) < 0.01 && Math.abs(tr.z - o.z) < 0.01) ?? null;
        tree(b, t, o, i, leaves);
        break;
      }
      case 'bush':
        bush(b, o, i);
        break;
      case 'step':
        b.pat = PAT.stone;
        b.box(o.x, o.y, o.z, o.w, o.h, o.d, 0xcdc3b4);
        b.pat = PAT.none;
        break;
      case 'slab':
        if (o.tint === 9) {
          const stripes = Math.round(o.w / 0.8);
          b.pat = PAT.fabric;
          for (let k = 0; k < stripes; k++) {
            b.box(o.x - o.w / 2 + (k + 0.5) * (o.w / stripes), o.y, o.z, o.w / stripes, o.h, o.d, k % 2 ? 0xf4efe6 : 0xd8473b);
          }
          b.pat = PAT.none;
        } else {
          b.pat = PAT.stone;
          b.box(o.x, o.y, o.z, o.w, o.h, o.d, 0xcfc6b8);
          b.pat = PAT.none;
          if (Math.abs(o.y - 2.6) < 0.01) entrance(b, o, entranceN++);
        }
        if (Math.abs(o.x + 28) < 0.1 && o.y > 1.5 && o.y < 2) {
          for (const dx of [-0.55, 0.55]) for (const dz of [-0.55, 0.55]) b.box(o.x + dx, 0, o.z + dz, 0.08, o.y, 0.08, 0xe9b23a);
        }
        break;
      case 'railing': {
        const alongX = o.w >= o.d;
        b.box(o.x, o.y + o.h - 0.06, o.z, o.w, 0.06, o.d, 0x4a4f56);
        const len = alongX ? o.w : o.d;
        for (let t = -len / 2; t <= len / 2 + 0.01; t += 0.25) {
          b.box(alongX ? o.x + t : o.x, o.y, alongX ? o.z : o.z + t, 0.03, o.h, 0.03, 0x4a4f56);
        }
        break;
      }
      case 'slide': {
        const len = Math.hypot(o.d, 0.9);
        const g = new THREE.BoxGeometry(o.w, 0.08, len + 0.6);
        b.add(g, 0xe0442f, o.x, 1.05, o.z, -Math.atan2(1.6, o.d), 0, 0);
        for (const s of [-1, 1]) {
          const r = new THREE.BoxGeometry(0.05, 0.18, len + 0.6);
          b.add(r, 0xf2c94c, o.x + (s * o.w) / 2, 1.15, o.z, -Math.atan2(1.6, o.d), 0, 0);
        }
        break;
      }
      case 'table':
        b.cyl(o.x, 0, o.z, 0.06, o.h - 0.05, 0x5b3d22, 8);
        b.cyl(o.x, 0, o.z, 0.3, 0.04, 0x5b3d22, 10);
        b.pat = PAT.fabric;
        b.cyl(o.x, o.h - 0.07, o.z, o.w / 2 + 0.06, 0.07, 0xc23b32, 16);
        b.pat = PAT.none;
        for (const [dx, dz] of [
          [0.2, 0.1],
          [-0.15, -0.15],
          [0.05, -0.25],
        ] as const) {
          b.cyl(o.x + dx, o.h, o.z + dz, 0.06, 0.015, 0xffffff, 10);
          b.cyl(o.x + dx, o.h + 0.015, o.z + dz, 0.032, 0.09, 0x9b2a14, 8, 0.042);
        }
        break;
      case 'stool':
        for (const [dx, dz] of [
          [0.12, 0.12],
          [-0.12, 0.12],
          [0.12, -0.12],
          [-0.12, -0.12],
        ] as const) b.box(o.x + dx, 0, o.z + dz, 0.035, o.h - 0.04, 0.035, 0x3d3d3d);
        b.pat = PAT.wood;
        b.cyl(o.x, o.h - 0.05, o.z, o.w / 2, 0.05, 0x8a5a35, 12);
        b.pat = PAT.none;
        break;
      case 'bench': {
        const alongX = o.w >= o.d;
        b.pat = PAT.wood;
        b.box(o.x, 0.4, o.z, o.w, 0.07, o.d, 0x9a6a3f);
        b.box(alongX ? o.x : o.x - o.w / 2, 0.55, alongX ? o.z - o.d / 2 : o.z, alongX ? o.w : 0.05, 0.35, alongX ? 0.05 : o.d, 0x9a6a3f);
        b.pat = PAT.none;
        for (const s of [-0.4, 0.4]) {
          b.box(alongX ? o.x + s * o.w : o.x, 0, alongX ? o.z : o.z + s * o.d, alongX ? 0.07 : o.w, 0.42, alongX ? o.d : 0.07, 0x2f3236);
        }
        break;
      }
      case 'pole':
        b.cyl(o.x, 0, o.z, 0.06, o.h, 0x707780, 8);
        break;
      case 'lamp': {
        b.cyl(o.x, 0, o.z, 0.11, o.h, 0x2f3438, 10, 0.07);
        b.cyl(o.x, 0, o.z, 0.2, 0.5, 0x2f3438, 10, 0.14);
        const arm = new THREE.TorusGeometry(0.45, 0.04, 6, 12, Math.PI / 2);
        b.add(arm, 0x2f3438, o.x + 0.45, o.h - 0.45, o.z, 0, 0, 0);
        b.cyl(o.x + 0.9, o.h - 0.75, o.z, 0.2, 0.3, 0x2f3438, 8, 0.07);
        b.add(new THREE.SphereGeometry(0.16, 10, 8), 0xffe6a8, o.x + 0.9, o.h - 0.8, o.z, 0, 0, 0, 'glow');
        lampPools.push(new THREE.Vector3(o.x + 0.9, 0.08, o.z));
        break;
      }
      case 'sheet':
        sheets.push({ x: o.x, z: o.z, w: o.w, h: o.h, y: o.y, c: SHEET_COLORS[i % SHEET_COLORS.length]! });
        break;
      default:
        b.box(o.x, o.y, o.z, o.w, o.h, o.d, 0xaaaaaa);
    }
  });
  for (const z of [-21, -26]) b.box(-19, 2.3, z, 14, 0.025, 0.025, 0xeeeeee);
  // a bicycle leaning on the laundry-yard wall + a forgotten ball
  b.cyl(-24, 0, -15.3, 0.33, 0.05, 0x222222, 14);
  b.box(-23.4, 0.3, -15.35, 1.2, 0.05, 0.05, 0xd8473b);
  b.cyl(-22.8, 0, -15.3, 0.33, 0.05, 0x222222, 14);
  b.blob(6.5, 0.22, 7.5, 0.22, 0xf2f2f2, 1, 2);

  // ---- meshes
  const mainMat = patternize(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88, metalness: 0 }));
  const groundMat = patternize(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }), 0);
  const foliageMat = patternize(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide }), 0, 3.2);
  const glowMat = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
  const add = (geo: THREE.BufferGeometry | null, m: THREE.Material, cast: boolean, recv: boolean) => {
    if (!geo) return null;
    const mesh = new THREE.Mesh(geo, m);
    mesh.castShadow = cast;
    mesh.receiveShadow = recv;
    mesh.matrixAutoUpdate = false;
    scene.add(mesh);
    return mesh;
  };
  add(b.build('main'), mainMat, true, true);
  add(b.build('ground'), groundMat, false, true);
  add(b.build('foliage'), foliageMat, true, true);
  add(b.build('glow'), glowMat, false, false);
  // car paint: glossy clearcoat (windows are dark paint here too)
  add(b.build('cars'), new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.32, metalness: 0.25, clearcoat: 1, clearcoatRoughness: 0.08 }), true, true);
  add(b.build('detail'), mainMat, false, true);
  if (!leaves.empty) scene.add(leaves.build('plane'));

  // ---- grass tufts and wild flowers (instanced)
  const tuftGeo = new THREE.ConeGeometry(0.045, 0.22, 3);
  tuftGeo.translate(0, 0.11, 0);
  const tuftMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 });
  const tufts = new THREE.InstancedMesh(tuftGeo, tuftMat, 1400);
  const flowerMat = new THREE.MeshStandardMaterial({ roughness: 0.8 });
  const flowers = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.05, 0), flowerMat, 220);
  const mtx = new THREE.Matrix4();
  const tmpC = new THREE.Color();
  const grassAreas = [
    [-59, 13, -13, 53],
    [19, 17, 45, 37],
  ] as const;
  for (let i = 0; i < 1400; i++) {
    const a = grassAreas[i % 2]!;
    const x = a[0] + hash(i * 3.1) * (a[2] - a[0]);
    const z = a[1] + hash(i * 7.7) * (a[3] - a[1]);
    const s = 0.6 + hash(i) * 0.9;
    mtx.makeRotationY(hash(i * 2) * 6);
    mtx.scale(new THREE.Vector3(s, s, s));
    mtx.setPosition(x, 0, z);
    tufts.setMatrixAt(i, mtx);
    tufts.setColorAt(i, tmpC.setHSL(0.26 + hash(i * 1.3) * 0.06, 0.45, 0.32 + hash(i * 2.9) * 0.12));
  }
  for (let i = 0; i < 220; i++) {
    const a = grassAreas[i % 2]!;
    const x = a[0] + hash(i * 5.3 + 1) * (a[2] - a[0]);
    const z = a[1] + hash(i * 1.9 + 4) * (a[3] - a[1]);
    mtx.makeTranslation(x, 0.18, z);
    flowers.setMatrixAt(i, mtx);
    flowers.setColorAt(i, tmpC.setHex(FLOWER_COLORS[i % FLOWER_COLORS.length]!));
  }
  tufts.receiveShadow = true;
  scene.add(tufts, flowers);

  // ---- signs and decals
  decal(scene, sign('EBE DUVARI', '#f1e3c4', '#a8452e'), 0, 1.75, -2.2 + 0.31, 2.6, 0.55);
  decal(scene, sign('BAKKAL', '#2f7d4a', '#fff7d6'), 18.5, 3.7, -15 + 0.02, 5, 1.1);
  decal(scene, sign('ÇAY OCAĞI', '#c0533b', '#fff7d6'), 40 - 0.02, 2.6, 32, 4.5, 0.9, -Math.PI / 2);
  decal(scene, sign('DOLMUŞ', '#222', '#f2cf3b', 256, 64), 40, 2.85, -11.4 + 1.16, 1.4, 0.35);
  decal(scene, sign('MAHALLE PARKI', '#2f6f4f', '#fff7d6'), -32, 1.4, 12.35, 3.2, 0.6);
  decal(scene, hopscotchTex(), 5.5, 0.075, 4, 1.6, 3.2, Math.PI / 2, true, 0.95);

  // ---- laundry sheets (sway)
  const sheetGroup = new THREE.Group();
  for (const sh of sheets) {
    const g = new THREE.PlaneGeometry(sh.w, sh.h, 6, 2);
    g.translate(0, -sh.h / 2, 0);
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: sh.c, side: THREE.DoubleSide, roughness: 0.9 }));
    m.position.set(sh.x, sh.y + sh.h, sh.z);
    m.castShadow = true;
    sheetGroup.add(m);
  }
  scene.add(sheetGroup);

  // ---- base circle: painted ring + chalk "EBE"
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(BASE_RADIUS - 0.18, BASE_RADIUS, 64),
    new THREE.MeshBasicMaterial({ color: 0xfff6d8, transparent: true, opacity: 0.9, polygonOffset: true, polygonOffsetFactor: -3 }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(BASE.x, 0.08, BASE.z);
  scene.add(ring);

  // ---- streetlight pools
  const poolTex = canvasTex(64, 64, (ctx) => {
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,214,140,1)');
    g.addColorStop(1, 'rgba(255,214,140,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
  });
  const poolMat = new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const pools = lampPools.map((p) => {
    const g = new THREE.PlaneGeometry(10, 10);
    g.rotateX(-Math.PI / 2);
    g.translate(p.x, p.y, p.z);
    return g;
  });
  if (pools.length) scene.add(new THREE.Mesh(mergeGeometries(pools, false), poolMat));

  // ---- ambient life: pigeons on the plaza, clouds
  const pigeons: Pigeon[] = [];
  for (let i = 0; i < 9; i++) {
    const g = makePigeon();
    const home = new THREE.Vector3(-4 + hash(i * 3) * 9, 0.06, 6 + hash(i * 5) * 5);
    g.position.copy(home);
    g.rotation.y = hash(i) * 6;
    scene.add(g);
    pigeons.push({ g, home, t: hash(i) * 10, fly: 0, dir: new THREE.Vector3() });
  }
  const cloudGroup = clouds(scene);

  let t = 0;
  const glowOff = new THREE.Color(0x9a8a76);
  const glowOn = new THREE.Color(0xffffff);
  return {
    setDusk(d) {
      glowMat.color.copy(glowOff).lerp(glowOn, Math.min(1, d * 1.3));
      poolMat.opacity = Math.max(0, (d - 0.3) * 0.85);
    },
    update(dt, movers) {
      t += dt;
      sheetGroup.children.forEach((m, i) => {
        m.rotation.x = Math.sin(t * 1.7 + i) * 0.14 + Math.sin(t * 3.1 + i * 2) * 0.04;
      });
      cloudGroup.rotation.y += dt * 0.004;
      for (const p of pigeons) {
        p.t += dt;
        const wing = p.g.getObjectByName('wing')!;
        if (p.fly > 0) {
          p.fly -= dt;
          p.g.position.addScaledVector(p.dir, dt);
          wing.scale.set(2.6, 1, 1);
          wing.rotation.z = Math.sin(p.t * 30) * 0.5;
          if (p.fly <= 0) {
            p.g.position.copy(p.home);
            wing.scale.set(1, 1, 1);
            wing.rotation.z = 0;
          }
          continue;
        }
        // peck and wander a little
        const head = p.g.children[1]!;
        head.position.y = 0.26 - Math.max(0, Math.sin(p.t * 3)) * 0.08;
        if (Math.sin(p.t * 0.7) > 0.98) p.g.rotation.y += dt * 4;
        for (const m of movers) {
          const dx = p.g.position.x - m.x;
          const dz = p.g.position.z - m.z;
          if (dx * dx + dz * dz < (m.speed > 3 ? 16 : 4)) {
            const l = Math.hypot(dx, dz) || 1;
            p.dir.set((dx / l) * 6, 3.5, (dz / l) * 6);
            p.g.rotation.y = Math.atan2(-p.dir.x, -p.dir.z);
            p.fly = 6;
            break;
          }
        }
      }
    },
  };
}
