import * as THREE from 'three';
import { MENU } from '@sokak/shared';
import { Builder, canvasTex } from './world';
import { PAT } from './materials';

/**
 * Furniture and textures of the kıraathane: bentwood (Thonet-style) chairs,
 * okey tables with felt insets and two-tier ıstakas, the çay ocağı props and
 * painted canvases (cement-tile floor, çini panel, lace curtains, the street
 * outside the windows, menu board, photos, calendar).
 */

export const WALNUT = 0x4a2a16;
export const OAK = 0x8a5a33;
export const CANE = 0xc9a066;
export const RACK_WOOD = 0xc78d55;

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _v = new THREE.Vector3();
const _one = new THREE.Vector3(1, 1, 1);

/** Transform helper: parent frame (position + yaw) ∘ local offset/rotation. */
export class Frame {
  private base = new THREE.Matrix4();
  constructor(x: number, y: number, z: number, yaw: number) {
    this.base.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0)), _one);
  }
  m(x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, s: THREE.Vector3 = _one): THREE.Matrix4 {
    _q.setFromEuler(_e.set(rx, ry, rz));
    _m.compose(_v.set(x, y, z), _q, s);
    return _m.premultiply(this.base);
  }
}

// ------------------------------------------------------------------ chair
/** Bentwood café chair; sitter faces -z (towards the table), back at +z. */
export function bentwoodChair(b: Builder, x: number, z: number, yaw: number): void {
  const f = new Frame(x, 0, z, yaw);
  const pat = b.pat;
  const bucket = b.bucket;
  b.bucket = 'varnish';
  b.pat = PAT.grainX;
  // legs, splayed
  const leg = () => new THREE.CylinderGeometry(0.014, 0.017, 0.47, 7);
  for (let k = 0; k < 4; k++) {
    const a = Math.PI / 4 + (k * Math.PI) / 2;
    const sx = Math.sin(a);
    const sz = Math.cos(a);
    b.addMatrix(leg(), WALNUT, f.m(sx * 0.165, 0.235, sz * 0.165, sz * 0.09, 0, -sx * 0.09));
  }
  // leg ring and seat ring
  b.addMatrix(new THREE.TorusGeometry(0.165, 0.009, 5, 22), WALNUT, f.m(0, 0.17, 0, Math.PI / 2));
  b.addMatrix(new THREE.TorusGeometry(0.2, 0.016, 6, 24), WALNUT, f.m(0, 0.445, 0, Math.PI / 2));
  // cane seat
  b.pat = PAT.fabric;
  b.addMatrix(new THREE.CylinderGeometry(0.2, 0.2, 0.02, 24), CANE, f.m(0, 0.462, 0), 'main');
  b.pat = PAT.grainX;
  // back posts rising from the rear legs and the hoop
  const post = () => new THREE.CylinderGeometry(0.014, 0.016, 0.46, 7);
  for (const s of [-1, 1]) b.addMatrix(post(), WALNUT, f.m(s * 0.13, 0.69, 0.2, -0.16, 0, 0));
  b.addMatrix(new THREE.TorusGeometry(0.13, 0.016, 6, 18, Math.PI), WALNUT, f.m(0, 0.9, 0.235, -0.16));
  b.addMatrix(new THREE.TorusGeometry(0.085, 0.011, 5, 14, Math.PI), WALNUT, f.m(0, 0.74, 0.21, -0.16));
  for (const s of [-1, 1]) b.addMatrix(new THREE.CylinderGeometry(0.01, 0.01, 0.18, 5), WALNUT, f.m(s * 0.085, 0.65, 0.195, -0.16));
  b.bucket = bucket;
  b.pat = pat;
}

// ------------------------------------------------------------------ okey table
function turnedLeg(): THREE.BufferGeometry {
  const pts = [
    [0.03, 0],
    [0.034, 0.03],
    [0.026, 0.06],
    [0.022, 0.26],
    [0.034, 0.3],
    [0.026, 0.33],
    [0.03, 0.5],
    [0.036, 0.52],
    [0.036, 0.64],
  ].map(([r, y]) => new THREE.Vector2(r!, y!));
  return new THREE.LatheGeometry(pts, 10);
}

// shared geometries: Builder.addMatrix clones what it merges, so one instance serves every prop
const slabCache = new Map<string, THREE.BufferGeometry>();
function roundedSlab(w: number, d: number, h: number, r: number, detail = 6): THREE.BufferGeometry {
  const key = `${w}|${d}|${h}|${r}|${detail}`;
  const hit = slabCache.get(key);
  if (hit) return hit;
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -d / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + d - r);
  s.quadraticCurveTo(x + w, y + d, x + w - r, y + d);
  s.lineTo(x + r, y + d);
  s.quadraticCurveTo(x, y + d, x, y + d - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  const g = new THREE.ExtrudeGeometry(s, { depth: h - 0.012, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.008, bevelSegments: detail > 3 ? 2 : 1, curveSegments: detail });
  g.rotateX(-Math.PI / 2);
  g.translate(0, 0.006, 0);
  slabCache.set(key, g);
  return g;
}

/** Two-tier ıstaka: x along its length, +z towards its player, y up from the felt. */
export const RACK_LEN = 0.66;
let rackGeo: THREE.BufferGeometry | null = null;
function rackGeometry(): THREE.BufferGeometry {
  if (rackGeo) return rackGeo;
  const s = new THREE.Shape();
  const P: [number, number][] = [
    [-0.062, 0],
    [0.062, 0],
    [0.062, 0.014],
    [0.05, 0.016],
    [-0.012, 0.014],
    [-0.012, 0.038],
    [-0.048, 0.04],
    [-0.05, 0.078],
    [-0.062, 0.078],
  ];
  s.moveTo(P[0]![0], P[0]![1]);
  for (const [px, py] of P.slice(1)) s.lineTo(px, py);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: RACK_LEN, bevelEnabled: false });
  g.rotateY(-Math.PI / 2);
  g.translate(RACK_LEN / 2, 0, 0);
  rackGeo = g;
  return g;
}

export const TABLE_TOP = 0.76;
export const TABLE_HALF = 0.56;
/** distance of each rack's centre from the table centre */
export const RACK_DIST = 0.47;

/** Square okey table with turned legs and four ıstakas (felt is added separately). */
export function okeyTable(b: Builder, x: number, z: number): void {
  const f = new Frame(x, 0, z, 0);
  const pat = b.pat;
  b.pat = PAT.wood;
  b.addMatrix(roundedSlab(TABLE_HALF * 2, TABLE_HALF * 2, 0.045, 0.06), 0x6a3d1f, f.m(0, TABLE_TOP - 0.045, 0));
  for (const s of [-1, 1]) {
    b.addMatrix(new THREE.BoxGeometry(0.96, 0.08, 0.03), WALNUT, f.m(0, TABLE_TOP - 0.085, s * 0.47));
    b.addMatrix(new THREE.BoxGeometry(0.03, 0.08, 0.96), WALNUT, f.m(s * 0.47, TABLE_TOP - 0.085, 0));
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.addMatrix(turnedLeg(), WALNUT, f.m(sx * 0.47, 0, sz * 0.47));
  b.addMatrix(new THREE.BoxGeometry(0.94, 0.03, 0.04), WALNUT, f.m(0, 0.16, 0));
  b.addMatrix(new THREE.BoxGeometry(0.04, 0.03, 0.94), WALNUT, f.m(0, 0.16, 0));
  // racks
  for (let s = 0; s < 4; s++) {
    const yaw = (s * Math.PI) / 2;
    const rf = new Frame(x + Math.sin(yaw) * RACK_DIST, TABLE_TOP + 0.002, z + Math.cos(yaw) * RACK_DIST, yaw);
    b.addMatrix(rackGeometry(), RACK_WOOD, rf.m(0, 0, 0));
    for (const e of [-1, 1]) b.addMatrix(new THREE.BoxGeometry(0.012, 0.08, 0.126), 0x9a6436, rf.m((e * RACK_LEN) / 2, 0.04, 0));
  }
  b.pat = pat;
}

export const STEEL = 0x232528;
export const LIGHT_OAK = 0xb98a5e;

let chairBack: THREE.BufferGeometry | null = null;
/** Modern café chair: black steel frame, oak seat and curved back; sitter faces -z. */
export function modernChair(b: Builder, x: number, z: number, yaw: number): void {
  const f = new Frame(x, 0, z, yaw);
  const pat = b.pat;
  b.pat = PAT.none;
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) b.addMatrix(new THREE.CylinderGeometry(0.012, 0.012, 0.45, 6), STEEL, f.m(sx * 0.18, 0.225, sz * 0.18, sz * 0.05, 0, -sx * 0.05));
  b.addMatrix(new THREE.BoxGeometry(0.4, 0.02, 0.02), STEEL, f.m(0, 0.2, 0.18));
  b.addMatrix(new THREE.BoxGeometry(0.4, 0.02, 0.02), STEEL, f.m(0, 0.2, -0.18));
  for (const sx of [-1, 1]) b.addMatrix(new THREE.CylinderGeometry(0.011, 0.011, 0.42, 6), STEEL, f.m(sx * 0.17, 0.68, 0.2, -0.14, 0, 0));
  // varnished oak seat and bent back plank, grain running side to side
  const bucket = b.bucket;
  b.bucket = 'varnish';
  b.pat = Math.abs(Math.sin(yaw)) < 0.5 ? PAT.grainX : PAT.grainZ;
  b.addMatrix(roundedSlab(0.42, 0.42, 0.035, 0.06, 3), LIGHT_OAK, f.m(0, 0.45, 0));
  chairBack ??= new THREE.CylinderGeometry(0.42, 0.42, 0.16, 10, 1, true, -0.5, 1.0);
  b.addMatrix(chairBack, LIGHT_OAK, f.m(0, 0.84, -0.18, -0.14, 0, 0));
  b.bucket = bucket;
  b.pat = pat;
}

/** Modern okey table: oak top with felt inset, black steel legs, four ıstakas. */
export function modernOkeyTable(b: Builder, x: number, z: number): void {
  const f = new Frame(x, 0, z, 0);
  const pat = b.pat;
  const bucket = b.bucket;
  b.bucket = 'varnish';
  b.pat = PAT.grainX;
  b.addMatrix(roundedSlab(TABLE_HALF * 2, TABLE_HALF * 2, 0.04, 0.03), LIGHT_OAK, f.m(0, TABLE_TOP - 0.04, 0));
  b.bucket = bucket;
  b.pat = PAT.none;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.addMatrix(new THREE.BoxGeometry(0.045, TABLE_TOP - 0.04, 0.045), STEEL, f.m(sx * 0.47, (TABLE_TOP - 0.04) / 2, sz * 0.47));
  for (const s of [-1, 1]) {
    b.addMatrix(new THREE.BoxGeometry(0.94, 0.05, 0.025), STEEL, f.m(0, TABLE_TOP - 0.07, s * 0.47));
    b.addMatrix(new THREE.BoxGeometry(0.025, 0.05, 0.94), STEEL, f.m(s * 0.47, TABLE_TOP - 0.07, 0));
  }
  // the ıstakas: varnished wood, grain along each rack
  b.bucket = 'varnish';
  for (let s = 0; s < 4; s++) {
    const yaw = (s * Math.PI) / 2;
    b.pat = s % 2 === 0 ? PAT.grainX : PAT.grainZ;
    const rf = new Frame(x + Math.sin(yaw) * RACK_DIST, TABLE_TOP + 0.002, z + Math.cos(yaw) * RACK_DIST, yaw);
    b.addMatrix(rackGeometry(), RACK_WOOD, rf.m(0, 0, 0));
    for (const e of [-1, 1]) b.addMatrix(new THREE.BoxGeometry(0.012, 0.08, 0.126), 0x8a5428, rf.m((e * RACK_LEN) / 2, 0.04, 0));
  }
  b.bucket = bucket;
  b.pat = pat;
}

/** Square café parasol (cream canvas) on a dark pole. */
export function parasol(b: Builder, x: number, z: number, color = 0xefe6d2): void {
  const pat = b.pat;
  b.pat = PAT.none;
  b.cyl(x, 0, z, 0.03, 2.5, STEEL, 6);
  b.cyl(x, 0, z, 0.3, 0.06, STEEL, 12);
  b.pat = PAT.fabric;
  const roof = new THREE.ConeGeometry(1.7, 0.55, 4, 1, true);
  roof.rotateY(Math.PI / 4);
  b.add(roof, color, x, 2.55, z);
  b.add(new THREE.BoxGeometry(2.4, 0.12, 0.02), color, x, 2.24, z + 1.2);
  b.add(new THREE.BoxGeometry(2.4, 0.12, 0.02), color, x, 2.24, z - 1.2);
  b.add(new THREE.BoxGeometry(0.02, 0.12, 2.4), color, x + 1.2, 2.24, z);
  b.add(new THREE.BoxGeometry(0.02, 0.12, 2.4), color, x - 1.2, 2.24, z);
  b.pat = pat;
}

/** Patio heater: pole with a reflector hat (the burner glows). */
export function patioHeater(b: Builder, x: number, z: number): void {
  b.cyl(x, 0, z, 0.22, 0.08, 0x5a5d61, 14);
  b.cyl(x, 0.08, z, 0.04, 1.9, 0x8d9196, 8);
  b.add(new THREE.ConeGeometry(0.42, 0.18, 16, 1, true), 0x8d9196, x, 2.1, z);
  b.cyl(x, 1.86, z, 0.07, 0.14, 0xff8a3d, 10, 0.07, 'glow');
}

/** Felt texture: green baize, darker border, a faint house emblem. */
export function feltTexture(): THREE.CanvasTexture {
  const tex = canvasTex(512, 512, (ctx) => paintFelt(ctx, null));
  // real woven detail (ambientCG Fabric030, CC0) multiplied in once it has loaded
  const img = new Image();
  img.onload = () => {
    paintFelt((tex.image as HTMLCanvasElement).getContext('2d')!, img);
    tex.needsUpdate = true;
  };
  img.src = `${import.meta.env.BASE_URL}textures/felt_detail.jpg`;
  return tex;
}

function paintFelt(ctx: CanvasRenderingContext2D, detail: HTMLImageElement | null): void {
  {
    ctx.fillStyle = '#1d6a43';
    ctx.fillRect(0, 0, 512, 512);
    if (detail) {
      // fine weave, tiled 5× across the table, as a soft multiply
      ctx.globalCompositeOperation = 'multiply';
      ctx.globalAlpha = 0.55;
      for (let y = 0; y < 512; y += 102.4) for (let x = 0; x < 512; x += 102.4) ctx.drawImage(detail, x, y, 102.4, 102.4);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = 'rgba(29,106,67,0.35)';
      ctx.fillRect(0, 0, 512, 512);
    }
    const img = ctx.getImageData(0, 0, 512, 512);
    for (let i = 0; i < img.data.length; i += 4) {
      const n = (Math.random() - 0.5) * 18;
      img.data[i] = Math.max(0, img.data[i]! + n);
      img.data[i + 1] = Math.max(0, img.data[i + 1]! + n);
      img.data[i + 2] = Math.max(0, img.data[i + 2]! + n);
    }
    ctx.putImageData(img, 0, 0);
    const g = ctx.createRadialGradient(256, 256, 120, 256, 256, 360);
    g.addColorStop(0, 'rgba(255,255,220,0.06)');
    g.addColorStop(1, 'rgba(0,0,0,0.28)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 512, 512);
    ctx.strokeStyle = 'rgba(240,215,140,0.55)';
    ctx.lineWidth = 4;
    ctx.strokeRect(22, 22, 468, 468);
    ctx.lineWidth = 1.5;
    ctx.strokeRect(32, 32, 448, 448);
    ctx.fillStyle = 'rgba(240,215,140,0.16)';
    ctx.font = '800 30px "Baloo 2", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.beginPath();
    ctx.arc(256, 256, 62, 0, Math.PI * 2);
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(240,215,140,0.16)';
    ctx.stroke();
    ctx.fillText('SOKAK', 256, 244);
    ctx.font = '700 17px "Baloo 2", serif';
    ctx.fillText('KIRAATHANESİ', 256, 272);
  }
}

// ------------------------------------------------------------------ counter props
export function samovar(b: Builder, x: number, y: number, z: number, s = 1): void {
  const brass = 0xc9a24a;
  b.cyl(x, y, z, 0.2 * s, 0.05, 0x7a6a50, 14);
  b.add(new THREE.LatheGeometry([
    [0.1, 0],
    [0.2, 0.06],
    [0.23, 0.2],
    [0.22, 0.42],
    [0.17, 0.5],
    [0.18, 0.54],
    [0.12, 0.56],
  ].map(([r, h]) => new THREE.Vector2(r! * s, h! * s)), 18), 0xd8c08a, x, y + 0.05, z);
  b.add(new THREE.LatheGeometry([
    [0.0, 0],
    [0.12, 0.0],
    [0.1, 0.1],
    [0.06, 0.16],
    [0.03, 0.2],
    [0.0, 0.22],
  ].map(([r, h]) => new THREE.Vector2(r! * s, h! * s)), 14), 0xe9e2d3, x, y + 0.05 + 0.56 * s, z);
  for (const a of [0, Math.PI]) b.add(new THREE.TorusGeometry(0.06 * s, 0.01, 5, 10, Math.PI), brass, x + Math.sin(a) * 0.24 * s, y + 0.42 * s, z, 0, a + Math.PI / 2, 0);
  b.add(new THREE.CylinderGeometry(0.015, 0.015, 0.16, 6), brass, x + 0.21 * s, y + 0.16, z, 0, 0, Math.PI / 2);
}

/** Double teapot on a small burner. */
export function caydanlik(b: Builder, x: number, y: number, z: number): void {
  b.cyl(x, y, z, 0.16, 0.06, 0x2b2b2b, 14);
  b.add(new THREE.TorusGeometry(0.09, 0.012, 5, 14), 0x555555, x, y + 0.065, z, Math.PI / 2);
  b.add(new THREE.LatheGeometry([
    [0.0, 0],
    [0.14, 0],
    [0.15, 0.08],
    [0.13, 0.17],
    [0.08, 0.2],
    [0.0, 0.2],
  ].map(([r, h]) => new THREE.Vector2(r!, h!)), 16), 0xd6d9dd, x, y + 0.07, z);
  b.add(new THREE.LatheGeometry([
    [0.0, 0],
    [0.08, 0],
    [0.095, 0.06],
    [0.08, 0.12],
    [0.04, 0.14],
    [0.0, 0.15],
  ].map(([r, h]) => new THREE.Vector2(r!, h!)), 14), 0xe8e8e8, x, y + 0.27, z);
  b.add(new THREE.CylinderGeometry(0.012, 0.02, 0.12, 6), 0xd6d9dd, x + 0.16, y + 0.17, z, 0, 0, -0.9);
  b.add(new THREE.TorusGeometry(0.09, 0.008, 4, 12, Math.PI), 0x222222, x, y + 0.27, z, 0, 0, 0);
}

// ------------------------------------------------------------------ textures
/** Cement tiles (karo): 2×2 tiles per texture repeat. */
export function karoTextures(): { map: THREE.CanvasTexture; bump: THREE.CanvasTexture } {
  const S = 512;
  const half = S / 2;
  const draw = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = '#e4d6b8';
    ctx.fillRect(0, 0, half, half);
    // quarter circles at the corners (they join into circles across tiles)
    ctx.fillStyle = '#9c5a43';
    for (const [cx, cy] of [
      [0, 0],
      [half, 0],
      [0, half],
      [half, half],
    ] as const) {
      ctx.beginPath();
      ctx.arc(cx, cy, half * 0.3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#e4d6b8';
    for (const [cx, cy] of [
      [0, 0],
      [half, 0],
      [0, half],
      [half, half],
    ] as const) {
      ctx.beginPath();
      ctx.arc(cx, cy, half * 0.25, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#b89a5a';
    for (const [cx, cy] of [
      [0, 0],
      [half, 0],
      [0, half],
      [half, half],
    ] as const) {
      ctx.beginPath();
      ctx.arc(cx, cy, half * 0.1, 0, Math.PI * 2);
      ctx.fill();
    }
    // centre: four-petal flower
    ctx.translate(half / 2, half / 2);
    ctx.fillStyle = '#4f6a62';
    for (let k = 0; k < 4; k++) {
      ctx.rotate(Math.PI / 2);
      ctx.beginPath();
      ctx.ellipse(0, -half * 0.1, half * 0.05, half * 0.1, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#b89a5a';
    ctx.beginPath();
    ctx.arc(0, 0, half * 0.04, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };
  const map = canvasTex(S, S, (ctx) => {
    for (const x of [0, half]) for (const y of [0, half]) draw(ctx, x, y);
    // wear and grime
    const img = ctx.getImageData(0, 0, S, S);
    for (let i = 0; i < img.data.length; i += 4) {
      const n = (Math.random() - 0.5) * 14;
      img.data[i] += n;
      img.data[i + 1] += n;
      img.data[i + 2] += n;
    }
    ctx.putImageData(img, 0, 0);
    ctx.strokeStyle = '#a89676';
    ctx.lineWidth = 4;
    for (const p of [0, half, S]) {
      ctx.beginPath();
      ctx.moveTo(p, 0);
      ctx.lineTo(p, S);
      ctx.moveTo(0, p);
      ctx.lineTo(S, p);
      ctx.stroke();
    }
  });
  const bump = canvasTex(256, 256, (ctx) => {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;
    for (const p of [0, 128, 256]) {
      ctx.beginPath();
      ctx.moveTo(p, 0);
      ctx.lineTo(p, 256);
      ctx.moveTo(0, p);
      ctx.lineTo(256, p);
      ctx.stroke();
    }
  });
  bump.colorSpace = THREE.NoColorSpace;
  for (const t of [map, bump]) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return { map, bump };
}

/** Blue-white çini panel behind the ocak. */
export function ciniTexture(cols: number, rows: number): THREE.CanvasTexture {
  const T = 96;
  return canvasTex(cols * T, rows * T, (ctx) => {
    for (let i = 0; i < cols; i++)
      for (let j = 0; j < rows; j++) {
        ctx.save();
        ctx.translate(i * T, j * T);
        ctx.fillStyle = '#f5f1e6';
        ctx.fillRect(0, 0, T, T);
        ctx.strokeStyle = '#1d4f91';
        ctx.fillStyle = '#1d4f91';
        ctx.lineWidth = 3;
        // corner arcs build a lattice of circles
        for (const [cx, cy] of [
          [0, 0],
          [T, 0],
          [0, T],
          [T, T],
        ] as const) {
          ctx.beginPath();
          ctx.arc(cx, cy, T * 0.32, 0, Math.PI * 2);
          ctx.stroke();
        }
        // centre tulip-like motif
        ctx.translate(T / 2, T / 2);
        ctx.fillStyle = '#2f7fc1';
        for (let k = 0; k < 4; k++) {
          ctx.rotate(Math.PI / 2);
          ctx.beginPath();
          ctx.moveTo(0, -4);
          ctx.quadraticCurveTo(10, -16, 0, -30);
          ctx.quadraticCurveTo(-10, -16, 0, -4);
          ctx.fill();
        }
        ctx.fillStyle = '#c0392b';
        ctx.beginPath();
        ctx.arc(0, 0, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        ctx.strokeStyle = 'rgba(120,120,110,0.5)';
        ctx.lineWidth = 2;
        ctx.strokeRect(i * T, j * T, T, T);
      }
  });
}

/** White lace café curtain (alpha-tested). */
export function laceTexture(): THREE.CanvasTexture {
  return canvasTex(256, 256, (ctx) => {
    ctx.clearRect(0, 0, 256, 256);
    ctx.fillStyle = 'rgba(255,252,244,0.92)';
    ctx.fillRect(0, 0, 256, 230);
    ctx.globalCompositeOperation = 'destination-out';
    for (let y = 20; y < 220; y += 32)
      for (let x = (y / 32) % 2 ? 16 : 0; x < 256; x += 32) {
        ctx.beginPath();
        ctx.arc(x, y, 7, 0, Math.PI * 2);
        ctx.fill();
      }
    // scalloped hem
    for (let x = 0; x < 256; x += 32) {
      ctx.beginPath();
      ctx.arc(x + 16, 240, 16, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(255,252,244,0.95)';
    for (let x = 0; x < 256; x += 32) {
      ctx.beginPath();
      ctx.arc(x + 16, 228, 12, 0, Math.PI);
      ctx.fill();
    }
  });
}

/** The street outside at dusk, seen through the windows. */
export function streetTexture(): THREE.CanvasTexture {
  return canvasTex(2048, 512, (ctx) => {
    const sky = ctx.createLinearGradient(0, 0, 0, 512);
    sky.addColorStop(0, '#3d4f8f');
    sky.addColorStop(0.45, '#d9785e');
    sky.addColorStop(0.7, '#ffc48a');
    sky.addColorStop(1, '#ffd9a8');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, 2048, 512);
    // houses across the street
    let x = -40;
    let i = 0;
    const cols = ['#c98f6e', '#d9b48a', '#a9837a', '#e0c9a0', '#9c8a7e', '#c7a07e'];
    while (x < 2100) {
      const w = 170 + ((i * 53) % 90);
      const h = 230 + ((i * 97) % 160);
      ctx.fillStyle = cols[i % cols.length]!;
      ctx.fillRect(x, 512 - h, w, h);
      ctx.fillStyle = 'rgba(60,30,30,0.35)';
      ctx.fillRect(x, 512 - h, w, 10);
      for (let wy = 512 - h + 30; wy < 420; wy += 58)
        for (let wx = x + 22; wx < x + w - 36; wx += 46) {
          const lit = (wx * 7 + wy * 3 + i) % 5 < 2;
          ctx.fillStyle = lit ? '#ffd27a' : '#4a4a5c';
          ctx.fillRect(wx, wy, 24, 34);
        }
      x += w + 6;
      i++;
    }
    // pavement, street lamps, a tree
    ctx.fillStyle = '#6b6058';
    ctx.fillRect(0, 440, 2048, 72);
    ctx.fillStyle = '#857a70';
    ctx.fillRect(0, 432, 2048, 10);
    for (const lx of [260, 1020, 1780]) {
      ctx.fillStyle = '#2b2b2b';
      ctx.fillRect(lx, 250, 8, 190);
      ctx.fillRect(lx - 20, 250, 30, 6);
      const glow = ctx.createRadialGradient(lx - 18, 262, 2, lx - 18, 262, 46);
      glow.addColorStop(0, 'rgba(255,230,160,1)');
      glow.addColorStop(1, 'rgba(255,200,120,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(lx - 70, 210, 110, 110);
    }
    ctx.fillStyle = '#3f5a3a';
    for (const [cx, cy, r] of [
      [620, 330, 70],
      [670, 300, 60],
      [1450, 340, 75],
      [1500, 310, 55],
    ] as const) {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#4a3020';
    ctx.fillRect(640, 360, 12, 80);
    ctx.fillRect(1470, 370, 12, 70);
    // a parked car silhouette
    ctx.fillStyle = '#8a3a2e';
    ctx.beginPath();
    ctx.roundRect(1180, 400, 190, 42, 12);
    ctx.fill();
    ctx.beginPath();
    ctx.roundRect(1220, 372, 110, 36, 12);
    ctx.fill();
    ctx.fillStyle = '#1e1e1e';
    for (const wx of [1215, 1335]) {
      ctx.beginPath();
      ctx.arc(wx, 444, 16, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

/** Chalk menu board with the real prices. */
export function menuTexture(): THREE.CanvasTexture {
  return canvasTex(512, 640, (ctx) => {
    ctx.fillStyle = '#5a3a20';
    ctx.fillRect(0, 0, 512, 640);
    ctx.fillStyle = '#23302b';
    ctx.fillRect(18, 18, 476, 604);
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    for (let i = 0; i < 40; i++) ctx.fillRect(Math.random() * 476 + 18, Math.random() * 604 + 18, 60, 2);
    ctx.fillStyle = '#f5e9c8';
    ctx.textAlign = 'center';
    ctx.font = '800 54px "Baloo 2", sans-serif';
    ctx.fillText('MENÜ', 256, 90);
    ctx.font = '600 36px "Baloo 2", sans-serif';
    MENU.forEach((m, i) => {
      const y = 160 + i * 64;
      ctx.textAlign = 'left';
      ctx.fillStyle = '#f5e9c8';
      ctx.fillText(m.name, 52, y);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#ffd27a';
      ctx.fillText(`${m.price} ₺`, 460, y);
    });
  });
}

/** Sepia photo of the old city: a ferry and a generic tower on the hill. */
export function photoTexture(kind: 0 | 1): THREE.CanvasTexture {
  return canvasTex(320, 240, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 0, 240);
    g.addColorStop(0, '#e9d7b0');
    g.addColorStop(1, '#a9875a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 320, 240);
    ctx.fillStyle = '#5a4430';
    if (kind === 0) {
      ctx.fillRect(0, 150, 320, 90);
      ctx.beginPath();
      ctx.moveTo(0, 150);
      ctx.quadraticCurveTo(160, 90, 320, 140);
      ctx.lineTo(320, 150);
      ctx.fill();
      ctx.fillRect(210, 60, 18, 70);
      ctx.beginPath();
      ctx.moveTo(204, 62);
      ctx.lineTo(219, 32);
      ctx.lineTo(234, 62);
      ctx.fill();
      ctx.fillStyle = '#3a2a1c';
      ctx.fillRect(60, 160, 120, 22);
      ctx.fillRect(90, 140, 60, 22);
      ctx.fillRect(112, 118, 10, 24);
    } else {
      ctx.fillRect(0, 190, 320, 50);
      ctx.fillStyle = '#3a2a1c';
      ctx.beginPath();
      ctx.roundRect(70, 110, 180, 80, 10);
      ctx.fill();
      ctx.fillStyle = '#d9c39a';
      for (let k = 0; k < 4; k++) ctx.fillRect(84 + k * 42, 124, 30, 28);
      ctx.fillStyle = '#3a2a1c';
      ctx.fillRect(158, 70, 4, 40);
      ctx.fillRect(130, 68, 60, 4);
    }
    const v = ctx.createRadialGradient(160, 120, 60, 160, 120, 200);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(60,40,20,0.55)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, 320, 240);
    ctx.strokeStyle = '#2b1a0e';
    ctx.lineWidth = 16;
    ctx.strokeRect(0, 0, 320, 240);
    ctx.strokeStyle = '#c9a24a';
    ctx.lineWidth = 4;
    ctx.strokeRect(10, 10, 300, 220);
  });
}

export function calendarTexture(): THREE.CanvasTexture {
  return canvasTex(256, 360, (ctx) => {
    ctx.fillStyle = '#fbf7ee';
    ctx.fillRect(0, 0, 256, 360);
    ctx.fillStyle = '#c0392b';
    ctx.fillRect(0, 0, 256, 120);
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    const now = new Date();
    const months = ['OCAK', 'ŞUBAT', 'MART', 'NİSAN', 'MAYIS', 'HAZİRAN', 'TEMMUZ', 'AĞUSTOS', 'EYLÜL', 'EKİM', 'KASIM', 'ARALIK'];
    ctx.font = '800 34px "Baloo 2", sans-serif';
    ctx.fillText(months[now.getMonth()]!, 128, 48);
    ctx.font = '800 54px "Baloo 2", sans-serif';
    ctx.fillText(String(now.getDate()), 128, 104);
    ctx.fillStyle = '#333';
    ctx.font = '600 18px "Baloo 2", sans-serif';
    for (let d = 0; d < 30; d++) ctx.fillText(String(d + 1), 30 + (d % 7) * 33, 160 + Math.floor(d / 7) * 40);
  });
}
