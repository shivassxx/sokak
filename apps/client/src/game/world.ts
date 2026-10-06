import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { BASE, BASE_RADIUS, MAP_HALF, MAP_OBJECTS, type MapObject } from '@sokak/shared';

/**
 * Procedural low-poly mahalle. Every prop is generated from primitives
 * that exactly fill its collider, then merged into a handful of meshes
 * (vertex colors) so the whole neighborhood costs only a few draw calls.
 */

export interface World {
  /** 0 = late afternoon, 1 = night: lamps and lit windows fade in */
  setDusk(d: number): void;
  update(dt: number): void;
}

type Bucket = 'main' | 'glow' | 'ground';

class Builder {
  private parts: Record<Bucket, THREE.BufferGeometry[]> = { main: [], glow: [], ground: [] };
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private e = new THREE.Euler();
  private color = new THREE.Color();

  add(geo: THREE.BufferGeometry, color: number, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, bucket: Bucket = 'main'): void {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    this.q.setFromEuler(this.e.set(rx, ry, rz));
    this.m.compose(new THREE.Vector3(x, y, z), this.q, new THREE.Vector3(1, 1, 1));
    g.applyMatrix4(this.m);
    this.color.setHex(color);
    const n = g.getAttribute('position').count;
    const cols = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      cols[i * 3] = this.color.r;
      cols[i * 3 + 1] = this.color.g;
      cols[i * 3 + 2] = this.color.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'color') g.deleteAttribute(k);
    this.parts[bucket].push(g);
  }

  /** axis-aligned box given by its bottom-center */
  box(x: number, y: number, z: number, w: number, h: number, d: number, color: number, bucket: Bucket = 'main', ry = 0): void {
    this.add(new THREE.BoxGeometry(w, h, d), color, x, y + h / 2, z, 0, ry, 0, bucket);
  }

  cyl(x: number, y: number, z: number, r: number, h: number, color: number, seg = 8, r2 = r): void {
    this.add(new THREE.CylinderGeometry(r2, r, h, seg), color, x, y + h / 2, z);
  }

  blob(x: number, y: number, z: number, r: number, color: number, sy = 1): void {
    const g = new THREE.IcosahedronGeometry(r, 0);
    g.scale(1, sy, 1);
    this.add(g, color, x, y, z);
  }

  build(bucket: Bucket): THREE.BufferGeometry | null {
    const list = this.parts[bucket];
    if (!list.length) return null;
    const merged = mergeGeometries(list, false);
    merged.computeVertexNormals();
    merged.computeBoundingSphere();
    return merged;
  }
}

/** deterministic pseudo random from a seed */
function hash(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

const BUILDING_COLORS = [0xf2d3a8, 0xe59f86, 0xf6ecd2, 0xbcd3d0, 0xe8c07a];
const CAR_COLORS = [0xd9473b, 0x3b78d9, 0xf4f1e8, 0x4caf6a];
const SHEET_COLORS = [0xf6f3ea, 0x8fc7f0, 0xf3a8bd, 0xfbe17a, 0xb6e3a6];

function building(b: Builder, o: MapObject, idx: number, tall: boolean): void {
  const base = BUILDING_COLORS[(o.tint ?? 0) % BUILDING_COLORS.length]!;
  const x0 = o.x - o.w / 2;
  const z0 = o.z - o.d / 2;
  b.box(o.x, 0, o.z, o.w, o.h, o.d, base);
  // plinth + cornice
  b.box(o.x, 0, o.z, o.w + 0.08, 0.7, o.d + 0.08, 0x9a8e80);
  b.box(o.x, o.h - 0.25, o.z, o.w + 0.3, 0.3, o.d + 0.3, 0xf7f1e6);
  // windows on all faces
  const floorH = 3;
  const floors = Math.floor((o.h - 1) / floorH);
  const faces: [number, number, number, number, number][] = [
    // axis(0 = along x), length, fixed coord, normal sign, origin
    [0, o.w, o.z + o.d / 2, 1, x0],
    [0, o.w, o.z - o.d / 2, -1, x0],
    [1, o.d, o.x + o.w / 2, 1, z0],
    [1, o.d, o.x - o.w / 2, -1, z0],
  ];
  let k = idx * 1000;
  for (const [axis, len, fixed, sign, origin] of faces) {
    const cols = Math.floor(len / 2.6);
    if (cols < 1) continue;
    const step = len / cols;
    for (let f = 0; f < floors; f++) {
      const y = 1.2 + f * floorH;
      for (let c = 0; c < cols; c++) {
        k++;
        const along = origin + step * (c + 0.5);
        const lit = hash(k) < 0.35;
        const ww = 1.1;
        const wh = 1.4;
        const off = sign * 0.06;
        const [wx, wz] = axis === 0 ? [along, fixed + off] : [fixed + off, along];
        const [fw, fd] = axis === 0 ? [ww + 0.25, 0.1] : [0.1, ww + 0.25];
        b.box(wx, y - 0.12, wz, fw, wh + 0.24, fd, 0xfdfaf2);
        const [gw, gd] = axis === 0 ? [ww, 0.14] : [0.14, ww];
        b.box(wx, y, wz, gw, wh, gd, lit ? 0xffd38a : 0x37475a, lit ? 'glow' : 'main');
        // little balconies and AC units for life
        if (tall && f > 0 && hash(k + 7) < 0.18) {
          const [bx, bz] = axis === 0 ? [along, fixed + sign * 0.55] : [fixed + sign * 0.55, along];
          const [bw, bd] = axis === 0 ? [ww + 0.9, 1.0] : [1.0, ww + 0.9];
          b.box(bx, y - 0.25, bz, bw, 0.12, bd, 0xd8d2c6);
          b.box(axis === 0 ? bx : bx + sign * 0.48, y - 0.13, axis === 0 ? bz + sign * 0.48 : bz, axis === 0 ? bw : 0.06, 0.8, axis === 0 ? 0.06 : bd, 0x5a5f66);
        } else if (hash(k + 13) < 0.08) {
          const [ax, az] = axis === 0 ? [along + 0.9, fixed + sign * 0.25] : [fixed + sign * 0.25, along + 0.9];
          b.box(ax, y - 0.4, az, 0.6, 0.45, 0.5, 0xe9ecef);
        }
      }
    }
  }
  // rooftop clutter
  if (o.h > 6) {
    b.cyl(o.x - o.w * 0.25, o.h, o.z, 0.6, 1.1, 0xc9ccd1, 8);
    b.box(o.x + o.w * 0.2, o.h, o.z - o.d * 0.2, 0.08, 2.2, 0.08, 0x444444);
    b.box(o.x + o.w * 0.2, o.h + 1.6, o.z - o.d * 0.2, 1.2, 0.06, 0.06, 0x444444);
  }
}

function car(b: Builder, o: MapObject, color: number, broken = false): void {
  const alongX = o.w >= o.d;
  const len = alongX ? o.w : o.d;
  const wid = alongX ? o.d : o.w;
  const ry = alongX ? 0 : Math.PI / 2;
  // build in local space (length along x) then rotate
  const parts: [number, number, number, number, number, number, number, Bucket?][] = [
    // lx, y, lz, w, h, d, color
    [0, 0.3, 0, len, 0.55, wid, color],
    [-len * 0.05, 0.85, 0, len * 0.55, 0.5, wid * 0.88, color],
    [-len * 0.05, 0.9, 0, len * 0.56, 0.38, wid * 0.9, 0x2c3a4a],
    [len / 2 - 0.02, 0.5, wid * 0.32, 0.06, 0.14, 0.3, 0xfff6c8, 'glow'],
    [len / 2 - 0.02, 0.5, -wid * 0.32, 0.06, 0.14, 0.3, 0xfff6c8, 'glow'],
    [-len / 2 + 0.02, 0.5, wid * 0.32, 0.06, 0.14, 0.3, 0xd02b2b],
    [-len / 2 + 0.02, 0.5, -wid * 0.32, 0.06, 0.14, 0.3, 0xd02b2b],
    [0, 0.28, 0, len + 0.06, 0.12, wid + 0.04, 0x3b3b3b],
  ];
  const c = Math.cos(ry);
  const s = Math.sin(ry);
  for (const [lx, y, lz, w, h, d, col, bucket] of parts) {
    const wx = o.x + lx * c + lz * s;
    const wz = o.z - lx * s + lz * c;
    b.add(new THREE.BoxGeometry(w, h, d), broken && col === color ? 0xb59b62 : col, wx, y + h / 2, wz, 0, ry, 0, bucket ?? 'main');
  }
  for (const [lx, lz] of [
    [len * 0.32, wid / 2],
    [len * 0.32, -wid / 2],
    [-len * 0.32, wid / 2],
    [-len * 0.32, -wid / 2],
  ] as const) {
    const wx = o.x + lx * c + lz * s;
    const wz = o.z - lx * s + lz * c;
    const flat = broken && lx > 0 && lz > 0;
    const g = new THREE.CylinderGeometry(0.33, 0.33, 0.24, 10);
    g.rotateX(Math.PI / 2);
    b.add(g, 0x1e1e1e, wx, flat ? 0.24 : 0.33, wz, 0, ry, 0);
  }
  if (broken) {
    // rust patches + missing bumper look
    b.add(new THREE.BoxGeometry(0.9, 0.3, 0.05), 0x8a4a22, o.x + 0.95 * (alongX ? 0 : 1), 0.5, o.z + (alongX ? wid / 2 : 0.6), 0, ry, 0);
  }
}

function tree(b: Builder, o: MapObject, idx: number): void {
  const greens = [0x4f9a3f, 0x5fae47, 0x3f8a3a];
  const g = greens[idx % greens.length]!;
  const r = o.w / 2;
  b.blob(o.x, o.y + o.h * 0.45, o.z, r * 0.95, g, 0.75);
  b.blob(o.x + r * 0.35, o.y + o.h * 0.7, o.z - r * 0.2, r * 0.65, greens[(idx + 1) % 3]!, 0.8);
  b.blob(o.x - r * 0.3, o.y + o.h * 0.65, o.z + r * 0.3, r * 0.6, greens[(idx + 2) % 3]!, 0.8);
}

function lampPost(b: Builder, o: MapObject): void {
  b.cyl(o.x, 0, o.z, 0.09, o.h, 0x3d4248, 6, 0.07);
  b.box(o.x + 0.45, o.h - 0.1, o.z, 0.9, 0.08, 0.08, 0x3d4248);
  b.add(new THREE.SphereGeometry(0.2, 8, 6), 0xffe6a8, o.x + 0.85, o.h - 0.25, o.z, 0, 0, 0, 'glow');
}

function sign(text: string, bg: string, fg: string, w = 512, h = 128): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = fg;
  ctx.font = `bold ${Math.floor(h * 0.62)}px 'Trebuchet MS', sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, w / 2, h / 2 + 4);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function signMesh(scene: THREE.Scene, tex: THREE.Texture, x: number, y: number, z: number, w: number, h: number, ry = 0): void {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshLambertMaterial({ map: tex }));
  m.position.set(x, y, z);
  m.rotation.y = ry;
  scene.add(m);
}

function ground(b: Builder): void {
  const H = MAP_HALF + 1;
  // asphalt
  b.add(new THREE.BoxGeometry(H * 2 + 120, 0.1, H * 2 + 120), 0x9a948c, 0, -0.05, 0, 0, 0, 0, 'ground');
  // sidewalks around building blocks (visual only)
  for (const o of MAP_OBJECTS) {
    if (o.kind !== 'building' && o.kind !== 'shop' && o.kind !== 'kiosk') continue;
    b.add(new THREE.BoxGeometry(o.w + 3, 0.06, o.d + 3), 0xd3c7b6, o.x, 0.01, o.z, 0, 0, 0, 'ground');
  }
  // plaza with tile ring
  b.add(new THREE.CylinderGeometry(12.5, 12.5, 0.06, 40), 0xd8c7a4, 0, 0.02, 2, 0, 0, 0, 'ground');
  b.add(new THREE.CylinderGeometry(9, 9, 0.065, 40), 0xe4d5b5, 0, 0.025, 2, 0, 0, 0, 'ground');
  // grass
  for (const [x0, z0, x1, z1] of [
    [-60, 12, -12, 54],
    [18, 16, 46, 38],
  ] as const) {
    b.add(new THREE.BoxGeometry(x1 - x0, 0.07, z1 - z0), 0x7fb35a, (x0 + x1) / 2, 0.03, (z0 + z1) / 2, 0, 0, 0, 'ground');
  }
  // dirt patch in the laundry yard + road markings
  b.add(new THREE.BoxGeometry(17, 0.065, 10), 0xb49a73, -18.5, 0.025, -22, 0, 0, 0, 'ground');
  for (let x = -54; x <= 54; x += 6) {
    if (Math.abs(x) < 14) continue;
    b.add(new THREE.BoxGeometry(2.6, 0.07, 0.18), 0xf2efe6, x, 0.03, 0, 0, 0, 0, 'ground');
  }
  for (let z = -54; z <= 54; z += 6) {
    if (Math.abs(z) < 14) continue;
    b.add(new THREE.BoxGeometry(0.18, 0.07, 2.6), 0xf2efe6, 0, 0.03, z, 0, 0, 0, 'ground');
  }
}

function skyline(b: Builder): void {
  // distant apartment blocks beyond the boundary so the horizon looks like a city
  let k = 0;
  for (let side = 0; side < 4; side++) {
    for (let t = -70; t <= 70; t += 11) {
      k++;
      const h = 10 + hash(k) * 16;
      const w = 8 + hash(k + 3) * 4;
      const dist = 68 + hash(k + 5) * 10;
      const [x, z] = side === 0 ? [t, -dist] : side === 1 ? [t, dist] : side === 2 ? [-dist, t] : [dist, t];
      const col = BUILDING_COLORS[k % BUILDING_COLORS.length]!;
      b.box(x, 0, z, w, h, w, col);
      for (let f = 0; f < Math.floor(h / 3) - 1; f++) {
        const lit = hash(k * 31 + f) < 0.4;
        const fz = side === 0 ? z + w / 2 + 0.05 : side === 1 ? z - w / 2 - 0.05 : z;
        const fx = side === 2 ? x + w / 2 + 0.05 : side === 3 ? x - w / 2 - 0.05 : x;
        b.box(fx, 2 + f * 3, fz, side < 2 ? w * 0.7 : 0.1, 1.2, side < 2 ? 0.1 : w * 0.7, lit ? 0xffcf86 : 0x4a5666, lit ? 'glow' : 'main');
      }
    }
  }
}

export function buildWorld(scene: THREE.Scene): World {
  const b = new Builder();
  ground(b);
  skyline(b);
  const lampPools: THREE.Vector3[] = [];
  const sheets: { x: number; z: number; w: number; h: number; y: number; c: number }[] = [];

  MAP_OBJECTS.forEach((o, i) => {
    switch (o.kind) {
      case 'boundary':
        b.box(o.x, 0, o.z, o.w, o.h, o.d, 0xd9b48f);
        b.box(o.x, o.h, o.z, o.w + 0.2, 0.3, o.d + 0.2, 0xf1e3c4);
        break;
      case 'building':
        building(b, o, i, o.h >= 9);
        break;
      case 'shop':
        b.box(o.x, 0, o.z, o.w, o.h, o.d, 0xf3ead5);
        b.box(o.x, 0, o.z + o.d / 2 + 0.05, o.w * 0.8, 2.2, 0.1, 0x9fd3e6, 'glow');
        b.box(o.x, 0, o.z + o.d / 2, o.w, 0.5, 0.25, 0x3f8f5a);
        b.box(o.x, o.h - 0.3, o.z, o.w + 0.2, 0.3, o.d + 0.2, 0x3f8f5a);
        break;
      case 'kiosk':
        b.box(o.x, 0, o.z, o.w, o.h, o.d, 0xf6efe2);
        b.box(o.x, 0, o.z, o.w + 0.05, 1.0, o.d + 0.05, 0xc0533b);
        b.box(o.x - o.w / 2 - 0.05, 1.0, o.z, 0.1, 1.2, o.d * 0.7, 0xffd9a0, 'glow');
        b.box(o.x, o.h, o.z, o.w + 0.8, 0.2, o.d + 0.8, 0xc0533b);
        break;
      case 'ebeWall':
        b.box(o.x, 0, o.z, o.w, o.h, o.d, 0xc4553a);
        b.box(o.x, o.h, o.z, o.w + 0.2, 0.15, o.d + 0.2, 0xece3d3);
        for (let r = 0; r < 6; r++) b.box(o.x, 0.2 + r * 0.38, o.z + o.d / 2 + 0.01, o.w, 0.04, 0.02, 0xa8452e);
        break;
      case 'wall':
        b.box(o.x, 0, o.z, o.w, o.h, o.d, 0xe2d6bf);
        b.box(o.x, o.h, o.z, o.w + 0.1, 0.12, o.d + 0.15, 0xb7a98f);
        break;
      case 'fence': {
        const alongX = o.w >= o.d;
        const len = alongX ? o.w : o.d;
        const n = Math.max(2, Math.round(len / 1.5));
        for (let k = 0; k <= n; k++) {
          const t = -len / 2 + (len * k) / n;
          b.box(alongX ? o.x + t : o.x, 0, alongX ? o.z : o.z + t, 0.1, o.h, 0.1, 0x2f6f4f);
        }
        b.box(o.x, o.h - 0.12, o.z, alongX ? o.w : 0.06, 0.08, alongX ? 0.06 : o.d, 0x2f6f4f);
        b.box(o.x, o.h * 0.4, o.z, alongX ? o.w : 0.06, 0.08, alongX ? 0.06 : o.d, 0x2f6f4f);
        break;
      }
      case 'car':
        car(b, o, CAR_COLORS[(o.tint ?? 0) % CAR_COLORS.length]!);
        break;
      case 'brokenCar':
        car(b, o, 0xcdb682, true);
        break;
      case 'minibus': {
        b.box(o.x, 0.35, o.z, o.w, o.h - 0.35, o.d, 0xf2cf3b);
        b.box(o.x, 1.4, o.z, o.w + 0.02, 0.75, o.d + 0.02, 0x2c3a4a);
        b.box(o.x, 0.35, o.z, o.w + 0.04, 0.2, o.d + 0.04, 0x333333);
        b.box(o.x + o.w / 2 + 0.01, 0.7, o.z, 0.04, 0.2, o.d * 0.7, 0xfff6c8, 'glow');
        for (const dx of [-o.w * 0.33, o.w * 0.33]) {
          for (const dz of [-o.d / 2, o.d / 2]) {
            const g = new THREE.CylinderGeometry(0.4, 0.4, 0.26, 10);
            g.rotateX(Math.PI / 2);
            b.add(g, 0x1e1e1e, o.x + dx, 0.4, o.z + dz);
          }
        }
        break;
      }
      case 'crate': {
        const col = [0xd8473b, 0x3d7fd1, 0xe9b23a][i % 3]!;
        b.box(o.x, o.y, o.z, o.w, o.h, o.d, col);
        b.box(o.x, o.y + o.h - 0.08, o.z, o.w + 0.02, 0.08, o.d + 0.02, 0x2b2b2b);
        b.blob(o.x - 0.15, o.y + o.h + 0.05, o.z, 0.16, [0xff8c2a, 0xd93a2b, 0x6fbf3f][i % 3]!);
        break;
      }
      case 'container':
        b.box(o.x, 0.15, o.z, o.w, o.h - 0.25, o.d, 0x2f6b4a);
        b.box(o.x, o.h - 0.12, o.z, o.w + 0.1, 0.12, o.d + 0.1, 0x24543a);
        for (const dx of [-o.w * 0.38, o.w * 0.38]) b.cyl(o.x + dx, 0, o.z + o.d * 0.35, 0.1, 0.15, 0x111111, 6);
        break;
      case 'trunk':
        b.cyl(o.x, 0, o.z, o.w / 2, o.h, 0x6b4a2f, 7, o.w * 0.35);
        break;
      case 'canopy':
        tree(b, o, i);
        break;
      case 'bush':
        b.blob(o.x - o.w * 0.2, o.h * 0.45, o.z, Math.min(o.w, o.d) * 0.48, 0x5a9e45, 0.8);
        b.blob(o.x + o.w * 0.22, o.h * 0.5, o.z + o.d * 0.1, Math.min(o.w, o.d) * 0.44, 0x4e9140, 0.85);
        b.blob(o.x, o.h * 0.62, o.z - o.d * 0.15, Math.min(o.w, o.d) * 0.4, 0x67b04f, 0.8);
        break;
      case 'step':
        b.box(o.x, o.y, o.z, o.w, o.h, o.d, 0xc9bfb0);
        break;
      case 'slab':
        if (o.tint === 9) {
          const stripes = Math.round(o.w / 0.8);
          for (let k = 0; k < stripes; k++) {
            b.box(o.x - o.w / 2 + (k + 0.5) * (o.w / stripes), o.y, o.z, o.w / stripes, o.h, o.d, k % 2 ? 0xf4efe6 : 0xd8473b);
          }
        } else b.box(o.x, o.y, o.z, o.w, o.h, o.d, 0xcfc6b8);
        // slide platform legs
        if (Math.abs(o.x + 28) < 0.1 && o.y > 1.5 && o.y < 2) {
          for (const dx of [-0.55, 0.55]) for (const dz of [-0.55, 0.55]) b.box(o.x + dx, 0, o.z + dz, 0.08, o.y, 0.08, 0xe9b23a);
        }
        break;
      case 'railing': {
        const alongX = o.w >= o.d;
        b.box(o.x, o.y + o.h - 0.06, o.z, o.w, 0.06, o.d, 0x4a4f56);
        const len = alongX ? o.w : o.d;
        for (let t = -len / 2; t <= len / 2 + 0.01; t += 0.5) {
          b.box(alongX ? o.x + t : o.x, o.y, alongX ? o.z : o.z + t, 0.04, o.h, 0.04, 0x4a4f56);
        }
        break;
      }
      case 'slide': {
        const len = Math.hypot(o.d, 0.9);
        const g = new THREE.BoxGeometry(o.w, 0.08, len + 0.6);
        b.add(g, 0xe0442f, o.x, 1.05, o.z, -Math.atan2(1.6, o.d), 0, 0);
        break;
      }
      case 'table':
        b.cyl(o.x, 0, o.z, 0.07, o.h - 0.05, 0x5b3d22, 6);
        b.cyl(o.x, o.h - 0.06, o.z, o.w / 2, 0.06, 0x9b6a3f, 12);
        b.cyl(o.x + 0.2, o.h, o.z + 0.1, 0.04, 0.1, 0xd2442b, 6);
        b.cyl(o.x - 0.15, o.h, o.z - 0.15, 0.04, 0.1, 0xd2442b, 6);
        break;
      case 'stool':
        b.cyl(o.x, 0, o.z, 0.05, o.h - 0.04, 0x3d3d3d, 5);
        b.cyl(o.x, o.h - 0.05, o.z, o.w / 2, 0.05, 0x2f6fb0, 10);
        break;
      case 'bench': {
        const alongX = o.w >= o.d;
        b.box(o.x, 0.4, o.z, o.w, 0.08, o.d, 0x9a6a3f);
        b.box(alongX ? o.x : o.x - o.w / 2, 0.45, alongX ? o.z - o.d / 2 : o.z, alongX ? o.w : 0.06, 0.45, alongX ? 0.06 : o.d, 0x9a6a3f);
        b.box(o.x, 0, o.z, alongX ? 0.08 : o.w, 0.4, alongX ? o.d : 0.08, 0x3d3d3d);
        break;
      }
      case 'pole':
        b.cyl(o.x, 0, o.z, 0.06, o.h, 0x707780, 6);
        break;
      case 'lamp':
        lampPost(b, o);
        lampPools.push(new THREE.Vector3(o.x + 0.85, 0.06, o.z));
        break;
      case 'sheet':
        sheets.push({ x: o.x, z: o.z, w: o.w, h: o.h, y: o.y, c: SHEET_COLORS[i % SHEET_COLORS.length]! });
        break;
      default:
        b.box(o.x, o.y, o.z, o.w, o.h, o.d, 0xaaaaaa);
    }
  });
  // laundry lines between pole pairs
  for (const z of [-21, -26]) b.box(-19, 2.3, z, 14, 0.03, 0.03, 0xeeeeee);

  const mainMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  const glowMat = new THREE.MeshBasicMaterial({ vertexColors: true });
  const groundMat = new THREE.MeshLambertMaterial({ vertexColors: true });

  const main = new THREE.Mesh(b.build('main')!, mainMat);
  main.castShadow = true;
  main.receiveShadow = true;
  scene.add(main);
  const glowGeo = b.build('glow');
  if (glowGeo) scene.add(new THREE.Mesh(glowGeo, glowMat));
  const groundMesh = new THREE.Mesh(b.build('ground')!, groundMat);
  groundMesh.receiveShadow = true;
  scene.add(groundMesh);

  // signs
  signMesh(scene, sign('EBE DUVARI', '#f1e3c4', '#a8452e'), 0, 1.75, -2.2 + 0.31, 2.6, 0.55);
  signMesh(scene, sign('BAKKAL', '#2f7d4a', '#fff7d6'), 18.5, 3.7, -15 + 0.02, 5, 1.1);
  signMesh(scene, sign('ÇAY OCAĞI', '#c0533b', '#fff7d6'), 40 - 0.02 - 0, 2.6, 32, 4.5, 0.9, -Math.PI / 2);
  signMesh(scene, sign('DOLMUŞ', '#222', '#f2cf3b', 256, 64), 40, 2.85, -11.4 + 1.16, 1.4, 0.35);

  // laundry sheets: separate mesh so they can sway
  const sheetGroup = new THREE.Group();
  const sheetMat = new THREE.MeshLambertMaterial({ side: THREE.DoubleSide, vertexColors: true });
  for (const sh of sheets) {
    const g = new THREE.PlaneGeometry(sh.w, sh.h, 4, 1);
    g.translate(0, -sh.h / 2, 0);
    const c = new THREE.Color(sh.c);
    const cols = new Float32Array(g.getAttribute('position').count * 3).map((_, k) => (k % 3 === 0 ? c.r : k % 3 === 1 ? c.g : c.b));
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    const m = new THREE.Mesh(g, sheetMat);
    m.position.set(sh.x, sh.y + sh.h, sh.z);
    m.castShadow = true;
    sheetGroup.add(m);
  }
  scene.add(sheetGroup);

  // base ring + chalk circle
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(BASE_RADIUS - 0.2, BASE_RADIUS, 48),
    new THREE.MeshBasicMaterial({ color: 0xfff6d8, transparent: true, opacity: 0.9 }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(BASE.x, 0.07, BASE.z);
  scene.add(ring);

  // fake light pools under streetlights (cheap "lights turning on")
  const poolTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const ctx = c.getContext('2d')!;
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,214,140,1)');
    g.addColorStop(1, 'rgba(255,214,140,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  })();
  const poolMat = new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  for (const p of lampPools) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), poolMat);
    m.rotation.x = -Math.PI / 2;
    m.position.copy(p);
    scene.add(m);
  }

  let t = 0;
  const glowOff = new THREE.Color(0x8a7a66);
  const glowOn = new THREE.Color(0xffffff);
  return {
    setDusk(d) {
      glowMat.color.copy(glowOff).lerp(glowOn, d);
      poolMat.opacity = Math.max(0, (d - 0.35) * 0.9);
    },
    update(dt) {
      t += dt;
      sheetGroup.children.forEach((m, i) => {
        m.rotation.x = Math.sin(t * 1.7 + i) * 0.12;
      });
    },
  };
}
