import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { PAT, type Pattern } from './materials';

/**
 * Shared building blocks of the kahvehane world: a geometry Builder that merges everything
 * per material bucket (a handful of draw calls; surface detail comes from the world-space
 * pattern shader), a seeded hash, and canvas texture / decal helpers.
 */

export interface Mover {
  x: number;
  z: number;
  speed: number;
}

export interface World {
  /** animate ambient life; `movers` are characters that can scare the pigeons */
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
