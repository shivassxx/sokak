import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Builder, canvasTex, hash } from './world';
import { PAT, patternize } from './materials';

/**
 * The Üsküdar waterfront in code: wooden houses with cumbas, plane trees,
 * benches, classic lamp posts, the simitçi cart, the iskele, Kız Kulesi on
 * its rock, a passing vapur, gulls, the sea and the historic peninsula on
 * the horizon at sunset.
 */

const IRON = 0x1f2326;
const HOUSE_COLORS = [0xc98f5e, 0x9c3f32, 0xe3c58e, 0x8fb0b8, 0xd8a3a0, 0xb7c49a, 0xe9dcc0];

/** A row of old wooden houses along a street-facing line (facade at z, facing +z or -z). */
export function houseRow(b: Builder, x0: number, x1: number, z: number, facing: 1 | -1, seed = 1, tall = 0): void {
  let x = x0;
  let i = 0;
  while (x < x1 - 2) {
    const w = Math.min(x1 - x, 6 + hash(seed * 31 + i) * 4);
    const floors = 2 + Math.floor(hash(seed * 17 + i) * 2) + tall;
    house(b, x + w / 2, z, w - 0.2, floors, HOUSE_COLORS[(seed * 3 + i) % HOUSE_COLORS.length]!, facing, seed * 100 + i);
    x += w;
    i++;
  }
}

function house(b: Builder, cx: number, zFace: number, w: number, floors: number, color: number, facing: 1 | -1, seed: number): void {
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
  // windows: white frames + dark panes, shutters on some
  const zw = zFace + facing * 0.02;
  for (let f = 0; f < floors; f++) {
    const y = f * fh + 1.0;
    const n = Math.max(1, Math.floor(w / 1.8));
    for (let k = 0; k < n; k++) {
      const x = cx - w / 2 + (k + 0.5) * (w / n);
      const onCumba = f >= 1 && Math.abs(x - cx) < cumbaW / 2 - 0.3;
      const zz = onCumba ? zFace + facing * 0.92 : zw;
      if (f === 0 && k === Math.floor(n / 2)) {
        // the door
        b.box(x, 0, zz, 1.1, 2.2, 0.06, 0x5a3420);
        continue;
      }
      b.box(x, y, zz, 0.9, 1.35, 0.06, 0xf2ece0);
      const lit = hash(seed * 7 + f * 13 + k) > 0.55;
      b.box(x, y + 0.08, zz + facing * 0.02, 0.72, 1.18, 0.04, lit ? 0x9a7444 : 0x3b4250, lit ? 'glow' : b.bucket);
      if (hash(seed + k * 3 + f) > 0.6) for (const s of [-1, 1]) b.box(x + s * 0.62, y, zz, 0.32, 1.35, 0.05, 0x2f5d3a);
    }
  }
  b.pat = pat;
}

/** A plane tree in a round stone planter. */
export function planeTree(b: Builder, x: number, z: number, s = 1): void {
  b.pat = PAT.stone;
  b.cyl(x, 0, z, 0.72, 0.6, 0xb8ad9a, 16);
  b.pat = PAT.grass;
  b.cyl(x, 0.6, z, 0.64, 0.02, 0x5d7a3a, 16);
  b.pat = PAT.none;
  b.cyl(x, 0.6, z, 0.18 * s, 3.2 * s, 0x8a8170, 8, 0.12 * s);
  for (let k = 0; k < 7; k++) {
    const a = k * 2.3;
    b.blob(x + Math.sin(a) * 1.4 * s, (3.6 + (k % 3) * 0.7) * s, z + Math.cos(a) * 1.4 * s, (1.4 + hash(k + x) * 0.5) * s, k % 2 ? 0x4f7f34 : 0x5f9140, 0.8, 1, 'foliage');
  }
  b.blob(x, 5.0 * s, z, 1.8 * s, 0x588a3a, 0.75, 1, 'foliage');
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

/** The simitçi's red glass cart. */
export function simitCart(b: Builder, x: number, z: number): void {
  b.box(x, 0.5, z, 1.7, 0.5, 0.9, 0xc0392b);
  b.box(x, 1.0, z, 1.6, 0.6, 0.8, 0xeef4f6);
  b.box(x, 1.6, z, 1.75, 0.08, 0.95, 0xc0392b);
  for (const dx of [-0.6, 0.6]) b.add(new THREE.TorusGeometry(0.28, 0.05, 6, 14), 0x222222, x + dx, 0.32, z + 0.48);
  b.box(x - 0.95, 0.7, z, 0.5, 0.04, 0.04, 0x555555);
  for (let k = 0; k < 9; k++) b.add(new THREE.TorusGeometry(0.11, 0.035, 6, 12), 0xb8752f, x - 0.5 + (k % 3) * 0.32, 1.12 + Math.floor(k / 3) * 0.13, z, Math.PI / 2, 0, 0);
}

/** Üsküdar iskele: a pitched-roof pier hall with arches, clock and sign. */
export function iskele(b: Builder, x0: number, x1: number, z0: number, z1: number): void {
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  const w = x1 - x0;
  const d = z1 - z0;
  b.pat = PAT.plaster;
  b.box(cx, 0, cz, w, 5.2, d, 0xe8dcc4);
  b.pat = PAT.none;
  for (let k = 0; k < 5; k++) {
    const x = x0 + 1.6 + k * ((w - 3.2) / 4);
    b.box(x, 0, z0 - 0.02, 1.6, 3.4, 0.08, 0x3b4250);
    b.add(new THREE.CylinderGeometry(0.8, 0.8, 0.08, 14, 1, false, 0, Math.PI), 0x3b4250, x, 3.4, z0 - 0.02, Math.PI / 2, 0, Math.PI / 2);
  }
  // the promenade side: tall arched windows and a door under the name board
  for (let k = 0; k < 4; k++) {
    const z = z0 + 2.4 + k * ((d - 4.8) / 3);
    if (k === 1) {
      b.box(x0 - 0.03, 0, z, 0.08, 2.9, 1.8, 0x2a3036);
      b.box(x0 - 0.05, 2.9, z, 0.1, 0.12, 2.0, 0xd9cdb4);
    } else {
      b.box(x0 - 0.03, 0.9, z, 0.08, 2.1, 1.3, 0x3b4250);
      b.add(new THREE.CylinderGeometry(0.65, 0.65, 0.08, 14, 1, false, 0, Math.PI), 0x3b4250, x0 - 0.03, 3.0, z, 0, 0, Math.PI / 2);
    }
  }
  b.box(cx, 5.2, cz, w + 0.8, 0.3, d + 0.8, 0x5a6b70);
  const roof = new THREE.CylinderGeometry(0.01, d * 0.62, 2.6, 4, 1);
  roof.rotateY(Math.PI / 4);
  roof.scale(w / d, 1, 1);
  b.pat = PAT.roof;
  b.add(roof, 0x6d7f86, cx, 6.8, cz);
  b.pat = PAT.none;
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
/** City ferry: white hull, dark band, cabins with windows, black-yellow funnel. */
export function vapur(): THREE.Group {
  const g = new THREE.Group();
  const white = new THREE.MeshStandardMaterial({ color: 0xf4f1ea, roughness: 0.6 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x2a2f35, roughness: 0.6 });
  const yellow = new THREE.MeshStandardMaterial({ color: 0xe8b23a, roughness: 0.5 });
  const win = new THREE.MeshBasicMaterial({ color: 0xffd9a0 });
  // parts are collected per material and merged: a whole ferry is 4 draw calls
  const parts = new Map<THREE.Material, THREE.BufferGeometry[]>();
  const add = (geo: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number) => {
    const gg = (geo.index ? geo.toNonIndexed() : geo).translate(x, y, z);
    for (const k of Object.keys(gg.attributes)) if (k !== 'position' && k !== 'normal') gg.deleteAttribute(k);
    parts.set(m, [...(parts.get(m) ?? []), gg]);
  };
  const hull = new THREE.CylinderGeometry(4, 4, 34, 12, 1);
  hull.rotateZ(Math.PI / 2);
  hull.scale(1, 0.55, 1);
  add(hull, white, 0, 1.2, 0);
  add(new THREE.BoxGeometry(34.2, 0.5, 8.2), dark, 0, 0.6, 0);
  add(new THREE.BoxGeometry(26, 2.6, 6.6), white, 0, 3.6, 0);
  add(new THREE.BoxGeometry(18, 2.2, 5.6), white, -1, 6.0, 0);
  for (let k = 0; k < 12; k++) for (const s of [-1, 1]) add(new THREE.BoxGeometry(1.2, 0.8, 0.05), win, -12 + k * 2.2, 3.8, s * 3.32);
  add(new THREE.CylinderGeometry(0.9, 1.0, 3.2, 12), yellow, 2, 8.6, 0);
  add(new THREE.CylinderGeometry(0.92, 0.92, 0.8, 12), dark, 2, 10.2, 0);
  for (const [m, geos] of parts) {
    const o = new THREE.Mesh(mergeGeometries(geos), m);
    o.castShadow = m !== win;
    g.add(o);
  }
  return g;
}

/** A gull: body + two flapping wings (animate wings[0/1].rotation.z). */
export function gull(): THREE.Group {
  const g = new THREE.Group();
  const m = new THREE.MeshStandardMaterial({ color: 0xf6f6f2, roughness: 0.8, side: THREE.DoubleSide });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.3, 3, 6), m);
  body.rotation.z = Math.PI / 2;
  g.add(body);
  for (const s of [-1, 1]) {
    const wg = new THREE.Group();
    const wing = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.18), new THREE.MeshStandardMaterial({ color: 0xd9dde0, side: THREE.DoubleSide }));
    wing.rotation.x = Math.PI / 2;
    wing.position.z = s * 0.28;
    wing.rotation.z = 0;
    wg.add(wing);
    g.add(wg);
  }
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
    // far hills
    ctx.fillStyle = 'rgba(92,72,108,0.85)';
    ctx.beginPath();
    ctx.moveTo(0, base);
    for (let x = 0; x <= W; x += 64) ctx.lineTo(x, base - 60 - Math.sin(x * 0.0021) * 45 - Math.sin(x * 0.009) * 14);
    ctx.lineTo(W, H);
    ctx.lineTo(0, H);
    ctx.fill();
    // city mass
    ctx.fillStyle = 'rgba(70,52,86,0.95)';
    ctx.beginPath();
    ctx.moveTo(0, base + 10);
    for (let x = 0; x <= W; x += 16) ctx.lineTo(x, base - 16 - ((x * 7919) % 30) - Math.sin(x * 0.004) * 24);
    ctx.lineTo(W, H);
    ctx.lineTo(0, H);
    ctx.fill();
    const mosque = (cx: number, r: number, minarets: number, spread: number) => {
      ctx.fillStyle = 'rgba(60,44,76,1)';
      ctx.fillRect(cx - r * 1.6, base - r * 1.1, r * 3.2, r * 1.2);
      ctx.beginPath();
      ctx.arc(cx, base - r * 1.05, r, Math.PI, 0);
      ctx.fill();
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(cx + s * r * 1.1, base - r * 0.9, r * 0.5, Math.PI, 0);
        ctx.fill();
      }
      ctx.fillRect(cx - 2, base - r * 2.2, 4, r * 0.2);
      const mw = Math.max(4, r * 0.09);
      for (let k = 0; k < minarets; k++) {
        const mx = cx + (k - (minarets - 1) / 2) * spread;
        const mh = r * 3.0;
        ctx.fillRect(mx - mw, base - mh, mw * 2, mh);
        ctx.beginPath();
        ctx.moveTo(mx - mw * 1.2, base - mh);
        ctx.lineTo(mx, base - mh - r * 0.8);
        ctx.lineTo(mx + mw * 1.2, base - mh);
        ctx.fill();
        ctx.fillRect(mx - mw * 1.8, base - mh * 0.72, mw * 3.6, 5);
      }
    };
    // the historic peninsula reads from Salacak: bigger than life so it carries at this distance
    mosque(820, 72, 4, 110); // Ayasofya-like
    mosque(1300, 78, 6, 80); // Sultanahmet-like
    // Topkapı on Sarayburnu: long low roofs, the Adalet tower and the point's trees
    ctx.fillStyle = 'rgba(62,46,78,1)';
    for (let k = 0; k < 9; k++) ctx.fillRect(1560 + k * 46, base - 34 - (k % 3) * 8, 40, 40 + (k % 3) * 8);
    ctx.fillRect(1700, base - 120, 22, 120);
    ctx.beginPath();
    ctx.moveTo(1694, base - 120);
    ctx.lineTo(1711, base - 165);
    ctx.lineTo(1728, base - 120);
    ctx.fill();
    for (let k = 0; k < 14; k++) {
      ctx.beginPath();
      ctx.arc(1600 + k * 30, base - 28 - (k % 4) * 6, 18, 0, Math.PI * 2);
      ctx.fill();
    }
    mosque(2150, 66, 4, 120); // Süleymaniye-like
    mosque(2650, 46, 2, 90); // Yeni Cami-like
    // Galata tower
    ctx.fillStyle = 'rgba(66,48,82,1)';
    ctx.fillRect(3300, base - 250, 50, 250);
    ctx.fillRect(3294, base - 262, 62, 14);
    ctx.beginPath();
    ctx.moveTo(3288, base - 262);
    ctx.lineTo(3325, base - 345);
    ctx.lineTo(3362, base - 262);
    ctx.fill();
    // twinkling windows
    for (let k = 0; k < 700; k++) {
      const x = (k * 2654435761) % W;
      const y = base - 5 + ((k * 40503) % 60);
      ctx.fillStyle = k % 3 ? 'rgba(255,214,140,0.85)' : 'rgba(255,240,200,0.6)';
      ctx.fillRect(x, y, 3, 2);
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
