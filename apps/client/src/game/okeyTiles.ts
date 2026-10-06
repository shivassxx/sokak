import * as THREE from 'three';
import { isFake, isJoker, rawFace, type Face, type OkeyCtx } from '@sokak/okey';

/**
 * 3D okey tiles: one instanced box mesh for every tile in the hall, with
 * the faces drawn into a canvas atlas (4 colours × 13 numbers, sahte okey,
 * and a dynamic "current okey" cell with a star). Tile tops carry the face;
 * all other sides (and therefore face-down tiles) show plain ivory.
 */
export const TILE_W = 0.036;
export const TILE_H = 0.05;
export const TILE_T = 0.013;

const COLS = 9;
const CELL_W = 112;
const CELL_H = 160;
const ATLAS = 1024;
const FAKE_CELL = 52;
const JOKER_CELL = 53;
const BLANK_CELL = 54;
export const INK = ['#d22f27', '#e39a00', '#1c63c9', '#1f1f1f'];

let atlas: { tex: THREE.CanvasTexture; ctx: CanvasRenderingContext2D; okey: Face | null } | null = null;

function cellXY(i: number): [number, number] {
  return [(i % COLS) * CELL_W, Math.floor(i / COLS) * CELL_H];
}

function drawCell(ctx: CanvasRenderingContext2D, i: number, face: Face | null | 'blank', star: boolean): void {
  const [x, y] = cellXY(i);
  ctx.save();
  ctx.translate(x, y);
  ctx.clearRect(0, 0, CELL_W, CELL_H);
  // ivory face with a soft bevel
  const g = ctx.createLinearGradient(0, 0, 0, CELL_H);
  g.addColorStop(0, '#fffdf5');
  g.addColorStop(0.85, '#f4ecd8');
  g.addColorStop(1, '#e6d9bb');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, CELL_W, CELL_H);
  ctx.strokeStyle = 'rgba(150,120,70,0.45)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(4, 4, CELL_W - 8, CELL_H - 8, 12);
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (face === 'blank') {
    // hidden tile: plain ivory
  } else if (face === null) {
    // sahte okey: green clover
    ctx.fillStyle = '#2f8f4f';
    ctx.font = '800 92px "Baloo 2", "Trebuchet MS", sans-serif';
    ctx.fillText('♣', CELL_W / 2, CELL_H * 0.46);
  } else {
    ctx.fillStyle = INK[face.color]!;
    ctx.font = `800 ${face.num >= 10 ? 76 : 88}px "Baloo 2", "Trebuchet MS", sans-serif`;
    ctx.fillText(String(face.num), CELL_W / 2, CELL_H * 0.42);
    ctx.beginPath();
    ctx.arc(CELL_W / 2, CELL_H * 0.78, 10, 0, Math.PI * 2);
    ctx.fill();
  }
  if (star) {
    ctx.fillStyle = '#e0a400';
    ctx.font = '800 40px "Baloo 2", sans-serif';
    ctx.fillText('★', CELL_W - 24, 24);
    ctx.strokeStyle = '#f2c230';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.roundRect(3, 3, CELL_W - 6, CELL_H - 6, 12);
    ctx.stroke();
  }
  ctx.restore();
}

function drawAll(ctx: CanvasRenderingContext2D, okey: Face | null): void {
  for (let c = 0; c < 4; c++) for (let n = 1; n <= 13; n++) drawCell(ctx, c * 13 + n - 1, { color: c as Face['color'], num: n }, false);
  drawCell(ctx, FAKE_CELL, null, false);
  drawCell(ctx, JOKER_CELL, okey, true);
  drawCell(ctx, BLANK_CELL, 'blank', false);
}

function getAtlas() {
  if (atlas) return atlas;
  const c = document.createElement('canvas');
  c.width = c.height = ATLAS;
  const ctx = c.getContext('2d')!;
  drawAll(ctx, { color: 0, num: 1 });
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.flipY = false;
  tex.anisotropy = 8;
  atlas = { tex, ctx, okey: null };
  // redraw once the rounded font is ready
  void document.fonts?.load('800 80px "Baloo 2"').then(() => {
    drawAll(ctx, atlas!.okey ?? { color: 0, num: 1 });
    tex.needsUpdate = true;
  });
  return atlas;
}

/** The okey changes every hand: redraw the starred cell. */
export function setAtlasOkey(okey: Face): void {
  const a = getAtlas();
  if (a.okey && a.okey.color === okey.color && a.okey.num === okey.num) return;
  a.okey = okey;
  drawCell(a.ctx, JOKER_CELL, okey, true);
  a.tex.needsUpdate = true;
}

export function cellOf(id: number, ctx: OkeyCtx | null): number {
  if (isFake(id)) return FAKE_CELL;
  if (ctx && isJoker(id, ctx)) return JOKER_CELL;
  const f = rawFace(id);
  return f.color * 13 + f.num - 1;
}

function tileGeometry(): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(TILE_W, TILE_T, TILE_H).toNonIndexed();
  const pos = g.getAttribute('position');
  const nrm = g.getAttribute('normal');
  const uv = g.getAttribute('uv');
  for (let i = 0; i < pos.count; i++) {
    if (nrm.getY(i) > 0.9) uv.setXY(i, pos.getX(i) / TILE_W + 0.5, pos.getZ(i) / TILE_H + 0.5);
    else uv.setXY(i, 0.5, 0.93);
  }
  return g;
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3(1, 1, 1);
const _c = new THREE.Color();
const WHITE = new THREE.Color(1, 1, 1);

/** A pool of tile instances that is refilled whenever the table changes. */
export class TileField {
  readonly mesh: THREE.InstancedMesh;
  private n = 0;

  constructor(readonly capacity: number) {
    const mat = new THREE.MeshStandardMaterial({ map: getAtlas().tex, roughness: 0.35, metalness: 0 });
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uCell = { value: new THREE.Vector2(CELL_W / ATLAS, CELL_H / ATLAS) };
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float aCell;\nuniform vec2 uCell;')
        .replace('#include <uv_vertex>', `#include <uv_vertex>\n vMapUv = (vec2(mod(aCell, ${COLS}.0), floor(aCell / ${COLS}.0)) + vMapUv) * uCell;`);
    };
    mat.customProgramCacheKey = () => 'okey-tile';
    const geo = tileGeometry();
    geo.setAttribute('aCell', new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1));
    this.mesh = new THREE.InstancedMesh(geo, mat, capacity);
    this.mesh.count = 0;
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = false;
    this.mesh.setColorAt(0, WHITE);
  }

  begin(): void {
    this.n = 0;
  }

  /**
   * Add a tile. `cell` < 0 = hidden (blank). yaw turns it on the table, `tilt`
   * stands it up (radians from lying flat, face towards +z after yaw).
   */
  push(cell: number, x: number, y: number, z: number, yaw: number, tilt = 0, tint: THREE.ColorRepresentation | null = null, scale = 1): number {
    if (this.n >= this.capacity) return -1;
    const i = this.n++;
    _q.setFromEuler(_e.set(0, yaw, 0));
    if (tilt) _q.multiply(_q2.setFromEuler(_e.set(tilt, 0, 0)));
    _m.compose(_p.set(x, y, z), _q, _s.setScalar(scale));
    this.mesh.setMatrixAt(i, _m);
    (this.mesh.geometry.getAttribute('aCell') as THREE.InstancedBufferAttribute).setX(i, cell < 0 ? BLANK_CELL : cell);
    this.mesh.setColorAt(i, tint === null ? WHITE : _c.set(tint));
    return i;
  }

  end(): void {
    this.mesh.count = this.n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    (this.mesh.geometry.getAttribute('aCell') as THREE.InstancedBufferAttribute).needsUpdate = true;
  }
}
