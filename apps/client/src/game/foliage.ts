import * as THREE from 'three';
import { hash } from './world';

/**
 * Realistic tree crowns: hundreds of alpha-cut "leaf cards" (quads showing a painted twig of
 * leaves) scattered through an ellipsoid crown, all merged into one mesh per scene. Normals
 * point away from the crown centre, so a crown is lit like a soft volume instead of flat
 * cards; cards deep inside or under the crown are darkened (cheap self-shadowing).
 */
export type LeafKind = 'plane' | 'small';

const atlases = new Map<LeafKind, THREE.CanvasTexture>();

/** A 2×2 atlas of twigs with leaves (çınar: big palmate leaves; small: ficus/olive). */
export function leafAtlas(kind: LeafKind): THREE.CanvasTexture {
  let t = atlases.get(kind);
  if (t) return t;
  const S = 512;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d')!;
  let seed = kind === 'plane' ? 11 : 37;
  const rnd = () => hash(seed++);
  for (let q = 0; q < 4; q++) {
    const ox = (q % 2) * 256;
    const oy = Math.floor(q / 2) * 256;
    ctx.save();
    ctx.beginPath();
    ctx.rect(ox + 2, oy + 2, 252, 252);
    ctx.clip();
    // twigs fanning out from the bottom centre
    const twigs: [number, number, number, number][] = [];
    const n = kind === 'plane' ? 4 : 6;
    for (let k = 0; k < n; k++) {
      const a = -Math.PI / 2 + (k / (n - 1) - 0.5) * 1.9 + (rnd() - 0.5) * 0.3;
      const len = 150 + rnd() * 70;
      twigs.push([ox + 128, oy + 250, ox + 128 + Math.cos(a) * len, oy + 250 + Math.sin(a) * len]);
    }
    ctx.strokeStyle = '#5b4a36';
    ctx.lineCap = 'round';
    for (const [x0, y0, x1, y1] of twigs) {
      ctx.lineWidth = kind === 'plane' ? 3 : 2;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.quadraticCurveTo((x0 + x1) / 2 + (rnd() - 0.5) * 30, (y0 + y1) / 2, x1, y1);
      ctx.stroke();
    }
    // leaves along the twigs, darker (further back) first
    const leaves: { x: number; y: number; a: number; s: number; l: number }[] = [];
    for (const [x0, y0, x1, y1] of twigs) {
      const m = kind === 'plane' ? 8 : 16;
      for (let k = 0; k < m; k++) {
        const f = 0.25 + (k / m) * 0.8;
        const along = Math.atan2(y1 - y0, x1 - x0);
        const side = k % 2 ? 1 : -1;
        leaves.push({
          x: x0 + (x1 - x0) * f + (rnd() - 0.5) * 18,
          y: y0 + (y1 - y0) * f + (rnd() - 0.5) * 18,
          a: along + side * (0.5 + rnd() * 0.7) + Math.PI / 2,
          s: kind === 'plane' ? 28 + rnd() * 18 : 12 + rnd() * 7,
          l: rnd(),
        });
      }
    }
    leaves.sort((p, r) => p.l - r.l);
    for (const lf of leaves) (kind === 'plane' ? planeLeaf : smallLeaf)(ctx, lf.x, lf.y, lf.a, lf.s, lf.l, rnd());
    ctx.restore();
  }
  t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  atlases.set(kind, t);
  return t;
}

/** çınar leaf: five pointed lobes, lighter middle, pale veins */
function planeLeaf(ctx: CanvasRenderingContext2D, x: number, y: number, a: number, s: number, light: number, r: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(a);
  ctx.beginPath();
  const N = 60;
  for (let i = 0; i <= N; i++) {
    const th = (i / N) * Math.PI * 2;
    // lobes point up (−y) and sideways; the base (th ≈ π) is a shallow notch
    const lobe = Math.pow(Math.abs(Math.cos(th * 2.5)), 1.1);
    const base = 1 - 0.5 * Math.pow(Math.max(0, -Math.cos(th)), 3);
    const rr = s * (0.66 + 0.34 * lobe) * base;
    ctx.lineTo(Math.sin(th) * rr, -Math.cos(th) * rr * 0.92);
  }
  ctx.closePath();
  const h = 88 + r * 22;
  const l = 24 + light * 18;
  const g = ctx.createRadialGradient(0, s * 0.25, s * 0.1, 0, 0, s);
  g.addColorStop(0, `hsl(${h} 42% ${l + 9}%)`);
  g.addColorStop(1, `hsl(${h + 6} 48% ${l - 3}%)`);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = `hsla(${h} 40% ${l - 10}% / 0.6)`;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.strokeStyle = `hsla(${h - 20} 45% ${l + 22}% / 0.55)`;
  ctx.lineWidth = 1.2;
  for (const v of [0, 1.26, -1.26, 2.3, -2.3]) {
    ctx.beginPath();
    ctx.moveTo(0, s * 0.3);
    ctx.lineTo(Math.sin(v) * s * 0.85, -Math.cos(v) * s * 0.8);
    ctx.stroke();
  }
  ctx.restore();
}

/** a small pointed oval leaf (ficus / olive / bay) */
function smallLeaf(ctx: CanvasRenderingContext2D, x: number, y: number, a: number, s: number, light: number, r: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(a);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(s * 0.55, -s * 0.9, 0, -s * 2);
  ctx.quadraticCurveTo(-s * 0.55, -s * 0.9, 0, 0);
  const h = 100 + r * 25;
  const l = 20 + light * 20;
  ctx.fillStyle = `hsl(${h} 45% ${l}%)`;
  ctx.fill();
  ctx.strokeStyle = `hsla(${h} 40% ${l + 18}% / 0.5)`;
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(0, -s * 0.1);
  ctx.lineTo(0, -s * 1.85);
  ctx.stroke();
  ctx.restore();
}

/** Collects leaf cards for many crowns; `build()` returns one mesh. */
export class Foliage {
  private pos: number[] = [];
  private nrm: number[] = [];
  private uv: number[] = [];
  private col: number[] = [];
  private idx: number[] = [];
  private seed = 1;

  /**
   * `density` < 1 thins every crown (phones: alpha-tested cards are costly overdraw);
   * the cards grow a little so the crowns still read as full.
   */
  constructor(private readonly density = 1) {}

  /**
   * An ellipsoid crown of `n` cards of `size` metres centred at (cx, cy, cz).
   * `tint` multiplies the leaf colour (autumn-ish < 1 in red/green etc.).
   */
  crown(cx: number, cy: number, cz: number, rx: number, ry: number, rz: number, n: number, size: number, tint: [number, number, number] = [1, 1, 1]): void {
    const rnd = () => hash(this.seed++ * 1.37 + cx * 0.11 + cz * 0.07);
    const d = new THREE.Vector3();
    const nn = new THREE.Vector3();
    const t1 = new THREE.Vector3();
    const t2 = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    n = Math.max(4, Math.round(n * this.density));
    size *= 1 + (1 - this.density) * 0.45;
    for (let i = 0; i < n; i++) {
      // a direction on the sphere, a radius biased to the outer shell
      const u = rnd() * 2 - 1;
      const ph = rnd() * Math.PI * 2;
      const sq = Math.sqrt(1 - u * u);
      d.set(sq * Math.cos(ph), u, sq * Math.sin(ph));
      const shell = 0.45 + 0.55 * Math.cbrt(rnd());
      const px = cx + d.x * rx * shell;
      const py = cy + d.y * ry * shell;
      const pz = cz + d.z * rz * shell;
      // card faces roughly outward, with a random tilt and roll
      nn.set(d.x + (rnd() - 0.5) * 1.4, d.y + (rnd() - 0.5) * 1.4 + 0.3, d.z + (rnd() - 0.5) * 1.4).normalize();
      t1.crossVectors(Math.abs(nn.y) > 0.95 ? new THREE.Vector3(1, 0, 0) : up, nn).normalize();
      t2.crossVectors(nn, t1);
      const roll = rnd() * Math.PI * 2;
      const cs = Math.cos(roll);
      const sn = Math.sin(roll);
      const ax = t1.clone().multiplyScalar(cs).addScaledVector(t2, sn);
      const ay = t2.clone().multiplyScalar(cs).addScaledVector(t1, -sn);
      const h = (size * (0.75 + rnd() * 0.5)) / 2;
      // lighting normal: away from the crown centre, tipped up a little
      const ln = new THREE.Vector3(d.x, d.y * 0.8 + 0.35, d.z).normalize();
      const shade = (0.5 + 0.5 * shell) * (0.72 + 0.28 * (d.y * 0.5 + 0.5));
      const v = 0.92 + rnd() * 0.16;
      const q = Math.floor(rnd() * 4);
      const u0 = (q % 2) * 0.5;
      const v0 = Math.floor(q / 2) * 0.5;
      const flip = rnd() < 0.5;
      const corners: [number, number][] = [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ];
      const base = this.pos.length / 3;
      for (const [a, b] of corners) {
        this.pos.push(px + (ax.x * a + ay.x * b) * h, py + (ax.y * a + ay.y * b) * h, pz + (ax.z * a + ay.z * b) * h);
        this.nrm.push(ln.x, ln.y, ln.z);
        const uu = flip ? -a : a;
        // atlas cells are drawn top-down (canvas), textures are flipped: v grows upwards
        this.uv.push(u0 + (uu * 0.5 + 0.5) * 0.5, 1 - (v0 + (1 - (b * 0.5 + 0.5)) * 0.5));
        this.col.push(shade * v * tint[0], shade * v * tint[1], shade * v * tint[2]);
      }
      this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  }

  get empty(): boolean {
    return this.idx.length === 0;
  }

  build(kind: LeafKind): THREE.Mesh {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nrm, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setIndex(this.idx);
    g.computeBoundingSphere();
    const mesh = new THREE.Mesh(g, leafMaterial(kind));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.matrixAutoUpdate = false;
    return mesh;
  }
}

const leafMats = new Map<LeafKind, THREE.MeshStandardMaterial>();
/** Alpha-cut, double-sided leaves that keep their outward normals on the back side too. */
export function leafMaterial(kind: LeafKind): THREE.MeshStandardMaterial {
  let m = leafMats.get(kind);
  if (m) return m;
  m = new THREE.MeshStandardMaterial({ map: leafAtlas(kind), vertexColors: true, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.78 });
  m.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <normal_fragment_begin>',
      // no back-face flip: a card seen from behind is lit like its front (a crown is a volume)
      '#include <normal_fragment_begin>\nnormal = normalize( vNormal );\nnonPerturbedNormal = normal;',
    );
  };
  m.customProgramCacheKey = () => 'leaf-cards';
  leafMats.set(kind, m);
  return m;
}
