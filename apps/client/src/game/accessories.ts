import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Aksesuarlar: procedural, low-poly accessories (self-made, no third-party art)
 * that sit on the realistic avatars. Every piece is modelled in metres in the
 * character frame (+Y up, −Z forward) around an anchor point measured once per
 * avatar from its rest-pose mesh and bones (eyes, upper lip, crown, neck, chest),
 * so the same item fits every avatar. Geometries and materials are shared by all
 * characters; only the small per-avatar scale differs.
 */

/** Rest-pose measurements of one avatar, in the character frame (metres). */
export interface AccMetrics {
  /** top of the cranium (hair included) and its centre in x/z */
  crown: THREE.Vector3;
  /** cranium width / depth just above the eyes */
  headW: number;
  headD: number;
  /** midpoint between the eyes, on the face surface */
  eyes: THREE.Vector3;
  /** face width at eye height */
  faceW: number;
  /** under the nose, on the skin */
  lip: THREE.Vector3;
  /** base of the neck (ring centre) and the ring's half sizes */
  neck: THREE.Vector3;
  neckRx: number;
  neckRz: number;
  /** chest front below the neck: the most forward z (relative to the neck) per 2 cm band going down */
  chestFront: number[];
  /** belly front (waistcoat button) */
  belly: THREE.Vector3;
}

const _v = new THREE.Vector3();

/**
 * Measure an avatar in its rest pose (call before any animation is applied): vertices
 * are classed as head / upper body by their strongest bone.
 */
export function measureAvatar(model: THREE.Object3D, bones: Map<string, THREE.Bone>, real: boolean): AccMetrics {
  model.updateMatrixWorld(true);
  const headRoot = bones.get(real ? 'Bip01_Head' : 'Head')!;
  const headSet = new Set<THREE.Bone>();
  headRoot.traverse((o) => {
    if ((o as THREE.Bone).isBone) headSet.add(o as THREE.Bone);
  });
  const torsoNames = real ? ['Bip01_Spine', 'Bip01_Spine1', 'Bip01_Spine2', 'Bip01_Neck', 'Bip01_Pelvis', 'Bip01_L_Clavicle', 'Bip01_R_Clavicle'] : ['Spine', 'Chest', 'UpperChest', 'Neck', 'Hips'];
  const torsoSet = new Set(torsoNames.map((n) => bones.get(n)).filter((b): b is THREE.Bone => !!b));
  const neckBone = bones.get(real ? 'Bip01_Neck' : 'Neck')!;
  const head: number[] = [];
  const torso: number[] = [];
  model.traverse((o) => {
    const m = o as THREE.SkinnedMesh;
    if (!m.isSkinnedMesh) return;
    const si = m.geometry.getAttribute('skinIndex');
    const sw = m.geometry.getAttribute('skinWeight');
    const n = m.geometry.getAttribute('position').count;
    for (let i = 0; i < n; i++) {
      let best = 0;
      let bw = -1;
      for (let k = 0; k < 4; k++) {
        const w = sw.getComponent(i, k);
        if (w > bw) (bw = w), (best = si.getComponent(i, k));
      }
      const b = m.skeleton.bones[best];
      const isHead = b ? headSet.has(b) : false;
      const isTorso = b ? torsoSet.has(b) : false;
      if (!isHead && !isTorso) continue;
      m.getVertexPosition(i, _v).applyMatrix4(m.matrixWorld);
      (isHead ? head : torso).push(_v.x, _v.y, _v.z);
    }
  });
  /** bounds of the points within a box (min/max per axis) */
  const box = (pts: number[], f: (x: number, y: number, z: number) => boolean) => {
    const b = new THREE.Box3();
    for (let i = 0; i < pts.length; i += 3) if (f(pts[i]!, pts[i + 1]!, pts[i + 2]!)) b.expandByPoint(_v.set(pts[i]!, pts[i + 1]!, pts[i + 2]!));
    return b;
  };
  const all = box(head, () => true);
  const eyeL = bones.get('Bip01_LEye');
  const eyeR = bones.get('Bip01_REye');
  const eyes = new THREE.Vector3();
  if (eyeL && eyeR) eyes.addVectors(eyeL.getWorldPosition(new THREE.Vector3()), eyeR.getWorldPosition(new THREE.Vector3())).multiplyScalar(0.5);
  else eyes.set((all.min.x + all.max.x) / 2, all.min.y + (all.max.y - all.min.y) * 0.55, all.min.z);
  // the face surface in front of the eyes (brow/nose bridge), and its width at that height
  const atEyes = box(head, (x, y) => Math.abs(y - eyes.y) < 0.012 && Math.abs(x - eyes.x) < 0.02);
  if (!atEyes.isEmpty()) eyes.z = atEyes.min.z;
  const faceBand = box(head, (_x, y, z) => Math.abs(y - eyes.y) < 0.015 && z < eyes.z + 0.07);
  const faceW = faceBand.isEmpty() ? 0.15 : faceBand.max.x - faceBand.min.x;
  const cranium = box(head, (_x, y) => y > eyes.y + 0.02);
  const crown = new THREE.Vector3((cranium.min.x + cranium.max.x) / 2, all.max.y, (cranium.min.z + cranium.max.z) / 2);
  const lipBone = bones.get('Bip01_MUpperLip') ?? bones.get('Bip01_MNose');
  const lip = lipBone ? lipBone.getWorldPosition(new THREE.Vector3()) : new THREE.Vector3(eyes.x, eyes.y - 0.06, eyes.z);
  if (!lipBone) lip.y = eyes.y - 0.06;
  else if (lipBone.name === 'Bip01_MNose') lip.y -= 0.02;
  const lipFront = box(head, (x, y) => Math.abs(y - lip.y) < 0.006 && Math.abs(x - lip.x) < 0.01);
  if (!lipFront.isEmpty()) lip.z = lipFront.min.z;
  const neck = neckBone.getWorldPosition(new THREE.Vector3());
  const ring = box(torso, (_x, y) => Math.abs(y - (neck.y - 0.01)) < 0.02);
  const neckRx = ring.isEmpty() ? 0.07 : Math.min(0.11, (ring.max.x - ring.min.x) / 2);
  const neckRz = ring.isEmpty() ? 0.065 : Math.min(0.1, (ring.max.z - ring.min.z) / 2);
  if (!ring.isEmpty()) neck.set((ring.min.x + ring.max.x) / 2, neck.y, (ring.min.z + ring.max.z) / 2);
  const chestFront: number[] = new Array(20).fill(0);
  for (let i = 0; i < torso.length; i += 3) {
    const band = Math.floor((neck.y - torso[i + 1]!) / 0.02);
    if (band >= 0 && band < 20 && Math.abs(torso[i]! - neck.x) < 0.08) chestFront[band] = Math.min(chestFront[band]!, torso[i + 2]! - neck.z);
  }
  const pelvis = bones.get(real ? 'Bip01_Pelvis' : 'Hips')!.getWorldPosition(new THREE.Vector3());
  const belly = new THREE.Vector3(pelvis.x, pelvis.y + 0.2, 0);
  const front = box(torso, (x, y) => Math.abs(y - belly.y) < 0.02 && Math.abs(x - belly.x) < 0.03);
  belly.z = front.isEmpty() ? pelvis.z - 0.12 : front.min.z;
  return { crown, headW: cranium.max.x - cranium.min.x, headD: cranium.max.z - cranium.min.z, eyes, faceW, lip, neck, neckRx, neckRz, chestFront, belly };
}

// ------------------------------------------------------------------ shared materials
function canvasTex(w: number, h: number, draw: (c: CanvasRenderingContext2D) => void, repeat = 1): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** deterministic speckle so every page load paints the same cloth */
function rng(seed: number): () => number {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

let mats: ReturnType<typeof makeMats> | null = null;
function makeMats() {
  const tweed = canvasTex(64, 64, (c) => {
    const r = rng(7);
    c.fillStyle = '#6a5d4d';
    c.fillRect(0, 0, 64, 64);
    // herringbone-ish flecks
    for (let i = 0; i < 900; i++) {
      const v = r();
      c.fillStyle = v < 0.33 ? '#4a4034' : v < 0.66 ? '#8a7a64' : '#a39276';
      const x = Math.floor(r() * 64);
      const y = Math.floor(r() * 64);
      c.fillRect(x, y, 2, 1);
    }
  }, 3);
  const knit = canvasTex(32, 64, (c) => {
    c.fillStyle = '#8f8273';
    c.fillRect(0, 0, 32, 64);
    for (let x = 0; x < 32; x += 4) {
      c.fillStyle = 'rgba(0,0,0,0.18)';
      c.fillRect(x, 0, 1, 64);
      c.fillStyle = 'rgba(255,255,255,0.08)';
      c.fillRect(x + 2, 0, 1, 64);
    }
    // two cream stripes near the ends
    c.fillStyle = '#d9cfbd';
    c.fillRect(0, 50, 32, 4);
    c.fillRect(0, 57, 32, 2);
  });
  const ribs = knit.clone();
  ribs.repeat.set(6, 1);
  return {
    knitRing: new THREE.MeshStandardMaterial({ map: ribs, roughness: 1 }),
    tweed: new THREE.MeshStandardMaterial({ map: tweed, roughness: 0.95 }),
    felt: new THREE.MeshStandardMaterial({ color: 0x3b342d, roughness: 0.88 }),
    ribbon: new THREE.MeshStandardMaterial({ color: 0x15120f, roughness: 0.55 }),
    acetate: new THREE.MeshStandardMaterial({ color: 0x0d0c0c, roughness: 0.18, metalness: 0.1 }),
    shade: new THREE.MeshStandardMaterial({ color: 0x0c1110, roughness: 0.04, metalness: 0.7, transparent: true, opacity: 0.9, side: THREE.DoubleSide }),
    wire: new THREE.MeshStandardMaterial({ color: 0xb08d57, roughness: 0.3, metalness: 1 }),
    clear: new THREE.MeshStandardMaterial({ color: 0xe8f2f4, roughness: 0.02, metalness: 0.3, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide }),
    amber: new THREE.MeshStandardMaterial({ color: 0xe08a26, roughness: 0.16, metalness: 0.05, emissive: 0x5a2400, emissiveIntensity: 0.55 }),
    tassel: new THREE.MeshStandardMaterial({ color: 0x5b1f17, roughness: 0.9 }),
    gold: new THREE.MeshStandardMaterial({ color: 0xd9ad55, roughness: 0.25, metalness: 1 }),
    knit: new THREE.MeshStandardMaterial({ map: knit, roughness: 1 }),
    moustache: new THREE.MeshStandardMaterial({ color: 0x3a2d24, roughness: 0.9 }),
  };
}
function M() {
  return (mats ??= makeMats());
}

// ------------------------------------------------------------------ shared geometry (built once, lazily)
const geoCache = new Map<string, THREE.BufferGeometry>();
function geo(key: string, make: () => THREE.BufferGeometry): THREE.BufferGeometry {
  let g = geoCache.get(key);
  if (!g) geoCache.set(key, (g = make()));
  return g;
}

/** plain position+normal(+uv) for merging pieces that came from different generators */
const plain = (g: THREE.BufferGeometry) => {
  const n = g.index ? g.toNonIndexed() : g;
  for (const k of Object.keys(n.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') n.deleteAttribute(k);
  if (!n.attributes.uv) n.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array((n.attributes.position!.count) * 2), 2));
  return n;
};

/** rounded rectangle path (centre cx, cy), slightly narrower at the bottom (wayfarer lens) */
function lensShape(cx: number, cy: number, w: number, h: number, r: number, taper: number): THREE.Shape | THREE.Path {
  const s = new THREE.Shape();
  const x0 = cx - w / 2;
  const x1 = cx + w / 2;
  const y0 = cy - h / 2;
  const y1 = cy + h / 2;
  const t = taper;
  s.moveTo(x0 + r, y1);
  s.lineTo(x1 - r, y1);
  s.quadraticCurveTo(x1, y1, x1, y1 - r);
  s.lineTo(x1 - t, y0 + r);
  s.quadraticCurveTo(x1 - t, y0, x1 - t - r, y0);
  s.lineTo(x0 + t + r, y0);
  s.quadraticCurveTo(x0 + t, y0, x0 + t, y0 + r);
  s.lineTo(x0, y1 - r);
  s.quadraticCurveTo(x0, y1, x0 + r, y1);
  return s;
}

const G = {
  // flat cap: a squashed dome whose front reaches over the peak
  capCrown: () =>
    geo('capCrown', () => {
      const g = new THREE.SphereGeometry(1, 28, 10, 0, Math.PI * 2, 0, Math.PI / 2);
      const p = g.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < p.count; i++) {
        const z = p.getZ(i);
        // pull the front out and down (the cap's typical slope)
        if (z < 0) p.setXYZ(i, p.getX(i), p.getY(i) * (1 + z * 0.35), z * 1.18);
      }
      g.computeVertexNormals();
      return g;
    }),
  capPeak: () =>
    geo('capPeak', () => {
      const s = new THREE.Shape();
      s.moveTo(-1, 0);
      s.quadraticCurveTo(-0.95, -0.85, 0, -1);
      s.quadraticCurveTo(0.95, -0.85, 1, 0);
      s.lineTo(-1, 0);
      const g = new THREE.ExtrudeGeometry(s, { depth: 0.08, bevelEnabled: false, curveSegments: 10 });
      g.rotateX(-Math.PI / 2);
      return g;
    }),
  button: () => geo('button', () => new THREE.SphereGeometry(0.008, 8, 6)),
  // fötr: pinched crown with a centre dent, ribbon, and a brim that curls up at the sides
  fedoraCrown: () =>
    geo('fedoraCrown', () => {
      const pts = [
        [0.0, 0.07],
        [0.025, 0.074],
        [0.048, 0.086],
        [0.064, 0.09],
        [0.075, 0.084],
        [0.082, 0.055],
        [0.089, 0.02],
        [0.092, 0.0],
      ].map(([x, y]) => new THREE.Vector2(x, y));
      const g = new THREE.LatheGeometry(pts, 28);
      const p = g.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < p.count; i++) {
        // front pinch: narrower towards the front above the band
        const z = p.getZ(i);
        const y = p.getY(i);
        if (z < 0 && y > 0.04) p.setX(i, p.getX(i) * (1 + (z / 0.09) * 0.25 * ((y - 0.04) / 0.05)));
      }
      g.computeVertexNormals();
      return g;
    }),
  fedoraBand: () => geo('fedoraBand', () => new THREE.CylinderGeometry(0.0925, 0.093, 0.022, 28, 1, true)),
  fedoraBrim: () =>
    geo('fedoraBrim', () => {
      const pts = [
        [0.09, 0.004],
        [0.12, 0.002],
        [0.142, 0.006],
        [0.152, 0.014],
        [0.149, 0.006],
        [0.12, -0.004],
        [0.09, -0.004],
      ].map(([x, y]) => new THREE.Vector2(x, y));
      const g = new THREE.LatheGeometry(pts, 32);
      const p = g.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < p.count; i++) {
        // snap brim: down at the front and back, up at the sides
        const x = p.getX(i);
        const z = p.getZ(i);
        const r = Math.hypot(x, z);
        if (r > 0.095) {
          const side = (x * x) / (r * r);
          p.setY(i, p.getY(i) + (r - 0.095) * (side * 0.35 - (1 - side) * 0.28));
        }
      }
      g.computeVertexNormals();
      return g;
    }),
  // wayfarer sunglasses: frame front with two holes, dark lenses, temples
  shadesFrame: () =>
    geo('shadesFrame', () => {
      const outer = new THREE.Shape();
      // outline: both lenses + bridge
      outer.moveTo(-0.068, 0.025);
      outer.lineTo(0.068, 0.025);
      outer.quadraticCurveTo(0.072, 0.024, 0.071, 0.012);
      outer.lineTo(0.064, -0.017);
      outer.quadraticCurveTo(0.06, -0.026, 0.05, -0.026);
      outer.lineTo(0.016, -0.026);
      outer.quadraticCurveTo(0.008, -0.026, 0.006, -0.012);
      outer.quadraticCurveTo(0, -0.004, -0.006, -0.012);
      outer.quadraticCurveTo(-0.008, -0.026, -0.016, -0.026);
      outer.lineTo(-0.05, -0.026);
      outer.quadraticCurveTo(-0.06, -0.026, -0.064, -0.017);
      outer.lineTo(-0.071, 0.012);
      outer.quadraticCurveTo(-0.072, 0.024, -0.068, 0.025);
      const holeL = lensShape(-0.034, -0.001, 0.046, 0.033, 0.007, 0.004);
      const holeR = lensShape(0.034, -0.001, 0.046, 0.033, 0.007, 0.004);
      outer.holes.push(holeL as THREE.Path, holeR as THREE.Path);
      const g = new THREE.ExtrudeGeometry(outer, { depth: 0.005, bevelEnabled: true, bevelThickness: 0.001, bevelSize: 0.0008, bevelSegments: 1, curveSegments: 6 });
      g.translate(0, 0, -0.0025);
      return g;
    }),
  shadesLens: () =>
    geo('shadesLens', () => {
      const a = new THREE.ShapeGeometry(lensShape(-0.034, -0.001, 0.047, 0.034, 0.007, 0.004) as THREE.Shape, 6);
      const b = new THREE.ShapeGeometry(lensShape(0.034, -0.001, 0.047, 0.034, 0.007, 0.004) as THREE.Shape, 6);
      return mergeGeometries([plain(a), plain(b)])!;
    }),
  temple: () => geo('temple', () => new THREE.BoxGeometry(0.004, 0.006, 1).translate(0, 0, 0.5)),
  // round wire reading glasses
  wireRim: () => geo('wireRim', () => new THREE.TorusGeometry(0.021, 0.0011, 5, 28)),
  wireBridge: () => geo('wireBridge', () => new THREE.TorusGeometry(0.008, 0.001, 4, 10, Math.PI)),
  wireLens: () => geo('wireLens', () => new THREE.CircleGeometry(0.021, 24)),
  wireTemple: () => geo('wireTemple', () => new THREE.CylinderGeometry(0.0009, 0.0009, 1, 4).rotateX(Math.PI / 2).translate(0, 0, 0.5)),
  // pala bıyık: tapered ellipsoid blobs along a drooping curve
  moustache: () =>
    geo('moustache', () => {
      const parts: THREE.BufferGeometry[] = [];
      for (const side of [-1, 1])
        for (let i = 0; i < 9; i++) {
          const t = i / 8;
          const s = new THREE.SphereGeometry(1, 10, 7);
          const w = 0.0048 * (1 - t * 0.55);
          s.scale(0.0075, w, 0.0045 * (1 - t * 0.4));
          s.rotateZ(side * (0.2 + t * 0.7));
          s.translate(side * (0.004 + t * 0.026), -t * t * 0.012, t * 0.011);
          parts.push(plain(s));
        }
      return mergeGeometries(parts)!;
    }),
  // 33 amber beads on a hanging loop, with the imame and a tassel
  beads: () =>
    geo('beads', () => {
      const parts: THREE.BufferGeometry[] = [];
      const n = 33;
      for (let i = 0; i < n; i++) {
        const a = ((i + 0.5) / n) * Math.PI * 2;
        const b = new THREE.SphereGeometry(0.0048, 8, 6);
        b.scale(1, 0.9, 1);
        b.translate(Math.sin(a) * 0.026, -0.072 + Math.cos(a) * 0.072, Math.sin(a * 2) * 0.004);
        parts.push(plain(b));
      }
      // the imame (long head bead) under the loop
      const im = new THREE.CylinderGeometry(0.0035, 0.006, 0.024, 8);
      im.translate(0, -0.155, 0);
      parts.push(plain(im));
      return mergeGeometries(parts)!;
    }),
  tassel: () =>
    geo('tassel', () => {
      const parts: THREE.BufferGeometry[] = [];
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        const c = new THREE.CylinderGeometry(0.0012, 0.0016, 0.04, 4);
        c.rotateZ(Math.sin(a) * 0.12);
        c.rotateX(Math.cos(a) * 0.12);
        c.translate(Math.sin(a) * 0.002, -0.187, Math.cos(a) * 0.002);
        parts.push(plain(c));
      }
      return mergeGeometries(parts)!;
    }),
  // köstek: gold chain sagging from the waistcoat button to the watch pocket
  chain: () =>
    geo('chain', () => {
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 16; i++) {
        const t = i / 16;
        const x = t * 0.1;
        pts.push(new THREE.Vector3(x, -0.006 - Math.sin(Math.PI * t) * 0.045 - t * 0.02, (x / 0.1) ** 2 * 0.03 - 0.004));
      }
      return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.0013, 5);
    }),
  fob: () => geo('fob', () => new THREE.CylinderGeometry(0.0018, 0.0018, 0.018, 6).rotateZ(Math.PI / 2)),
  bow: () => geo('bow', () => new THREE.TorusGeometry(0.006, 0.0016, 5, 12)),
  watch: () => geo('watch', () => new THREE.CylinderGeometry(0.019, 0.019, 0.008, 18).rotateX(Math.PI / 2)),
  // atkı: a knitted ring round the neck and two ends hanging on the chest
  scarfRing: () => geo('scarfRing', () => new THREE.TorusGeometry(1, 0.24, 10, 32).rotateX(Math.PI / 2)),
  scarfEnd: () =>
    geo('scarfEnd', () => {
      const g = new THREE.BoxGeometry(0.06, 0.26, 0.01, 2, 8, 1);
      const p = g.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < p.count; i++) {
        const y = p.getY(i);
        // hanging down from the top edge, a little wider at the bottom
        const t = (0.13 - y) / 0.26;
        p.setXYZ(i, p.getX(i) * (1 + t * 0.15), y - 0.13, p.getZ(i));
      }
      g.computeVertexNormals();
      return g;
    }),
};

function m(g: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0, shadow = true): THREE.Mesh {
  const o = new THREE.Mesh(g, mat);
  o.position.set(x, y, z);
  o.castShadow = shadow;
  return o;
}

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/** Which anchor an accessory hangs on (see Character.accFrame). */
export type AccAnchor = 'crown' | 'eyes' | 'lip' | 'neck' | 'belly' | 'hand';
export const ANCHOR_OF: Record<string, AccAnchor> = {
  kasket: 'crown',
  fotr: 'crown',
  gunes: 'eyes',
  gozluk: 'eyes',
  biyik: 'lip',
  atki: 'neck',
  kostek: 'belly',
  tespih: 'hand',
};

/**
 * Build one accessory for an avatar, positioned relative to its anchor (see ANCHOR_OF):
 * crown = top of the head, eyes = the face between the eyes, lip = under the nose,
 * neck = base of the neck, belly = the front of the stomach, hand = the right palm.
 */
export function buildAccessory(id: string, mt: AccMetrics): THREE.Object3D | null {
  const mat = M();
  const g = new THREE.Group();
  g.name = `acc_${id}`;
  // head fit: the measured cranium (hair included) against a reference 16 × 20 cm head
  const fx = clamp(mt.headW / 0.16, 0.85, 1.3);
  const fz = clamp(mt.headD / 0.2, 0.85, 1.3);
  switch (id) {
    case 'kasket': {
      const crown = m(G.capCrown(), mat.tweed, 0, -0.07, 0.006);
      g.add(crown);
      crown.scale.set(0.096 * fx, 0.068, 0.108 * fz);
      crown.rotation.x = -0.1;
      const peak = m(G.capPeak(), mat.tweed, 0, -0.072, -0.098 * fz);
      peak.scale.set(0.085 * fx, 0.07, 0.055);
      peak.rotation.x = 0.16;
      g.add(peak, m(G.button(), mat.tweed, 0, -0.003, -0.014));
      break;
    }
    case 'fotr': {
      const s = new THREE.Group();
      s.scale.set(fx * 1.02, 1, fz * 0.95);
      s.position.y = -0.082;
      s.rotation.x = 0.06;
      s.add(m(G.fedoraCrown(), mat.felt), m(G.fedoraBand(), mat.ribbon, 0, 0.012, 0), m(G.fedoraBrim(), mat.felt));
      g.add(s);
      break;
    }
    case 'gunes': {
      const s = clamp(mt.faceW / 0.15, 0.85, 1.08);
      g.scale.setScalar(s);
      g.add(m(G.shadesFrame(), mat.acetate, 0, 0, 0, false), m(G.shadesLens(), mat.shade, 0, 0, 0.0015, false));
      for (const x of [-1, 1]) {
        const t = m(G.temple(), mat.acetate, x * 0.069, 0.016, 0.002, false);
        t.scale.z = 0.1;
        t.rotation.y = x * 0.09;
        g.add(t);
      }
      break;
    }
    case 'gozluk': {
      const s = clamp(mt.faceW / 0.15, 0.85, 1.08);
      g.scale.setScalar(s);
      for (const x of [-1, 1]) {
        g.add(m(G.wireRim(), mat.wire, x * 0.031, 0, 0, false), m(G.wireLens(), mat.clear, x * 0.031, 0, 0, false));
        const t = m(G.wireTemple(), mat.wire, x * 0.052, 0.006, 0, false);
        t.scale.z = 0.1;
        t.rotation.y = x * 0.12;
        g.add(t);
      }
      g.add(m(G.wireBridge(), mat.wire, 0, 0.004, 0, false));
      break;
    }
    case 'biyik':
      g.add(m(G.moustache(), mat.moustache, 0, 0, -0.002, false));
      break;
    case 'atki': {
      const rx = clamp(mt.neckRx, 0.055, 0.075) + 0.012;
      const rz = clamp(mt.neckRz, 0.05, 0.07) + 0.012;
      const ring = m(G.scarfRing(), mat.knitRing, 0, -0.035, 0);
      ring.scale.set(rx, 0.07, rz);
      ring.rotation.x = 0.12;
      g.add(ring);
      // the ends hang from the front of the ring, tilted to clear the chest
      const tilt = (z0: number, len: number) => {
        let t = 0;
        mt.chestFront.forEach((z, i) => {
          const d = (i + 0.5) * 0.02 - 0.04;
          if (d > 0.02 && d < len) t = Math.max(t, Math.atan2(z0 - (z - 0.02), d));
        });
        return t;
      };
      const a = m(G.scarfEnd(), mat.knit, -0.032, -0.04, -rz - 0.004);
      a.rotation.set(tilt(-rz - 0.004, 0.26), 0, 0.06, 'ZXY');
      const b = m(G.scarfEnd(), mat.knit, 0.028, -0.045, -rz - 0.012);
      b.rotation.set(tilt(-rz - 0.012, 0.22) + 0.03, 0, -0.04, 'ZXY');
      b.scale.y = 0.82;
      g.add(a, b);
      break;
    }
    case 'kostek': {
      g.add(m(G.chain(), mat.gold, 0, 0, 0, false), m(G.fob(), mat.gold, 0, -0.004, -0.002, false));
      const bow = m(G.bow(), mat.gold, 0.1, -0.03, 0.026, false);
      bow.rotation.y = -0.6;
      g.add(bow);
      break;
    }
    case 'tespih': {
      const s = new THREE.Group();
      s.rotation.set(0.1, 0, 0.12);
      s.position.set(0, 0.012, 0.004);
      s.add(m(G.beads(), mat.amber, 0, 0, 0, false), m(G.tassel(), mat.tassel, 0, 0, 0, false));
      g.add(s);
      break;
    }
    default:
      return null;
  }
  return g;
}
