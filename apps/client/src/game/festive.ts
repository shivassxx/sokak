import * as THREE from 'three';
import { HALL, TERRACE, type FestivalDef } from '@sokak/shared';

/**
 * Mevsimlik süsler: what a festival puts up on the kahvehane and over the water.
 *
 * - flags: red-white bunting from the facade to the terrace edge and a big Turkish flag
 *   between the first-floor windows;
 * - balloons (23 Nisan) tied along the terrace railing;
 * - lights: bulbs along the same strands (multicolour for yılbaşı, warm for Ramazan);
 * - tree: a decorated pine by the door;
 * - mahya: the lit message hung between Sultanahmet's minarets on the skyline (night only);
 * - fireworks over the sea at night.
 *
 * Everything is a handful of draw calls (instanced flags, bulbs and balloons, one points cloud
 * for the fireworks), built once when the festival changes and dropped when it ends.
 */
export interface Festive {
  update(dt: number, night: number): void;
  dispose(): void;
}

const RED = 0xe30a17;
const WHITE = 0xf4f1ea;

/** bunting strands: from the facade above the fascia out to the terrace's front edge */
function strands(): [THREE.Vector3, THREE.Vector3][] {
  const out: [THREE.Vector3, THREE.Vector3][] = [];
  const xs = [-17, -11, -5.5, 0.5, 6.5, 12];
  for (let i = 0; i < xs.length - 1; i++) {
    const x0 = xs[i]!;
    const x1 = xs[i + 1]!;
    // a zigzag: facade → terrace edge → facade
    out.push([new THREE.Vector3(x0, 4.7, 0.35), new THREE.Vector3((x0 + x1) / 2, 3.25, TERRACE.z1 - 0.35)]);
    out.push([new THREE.Vector3((x0 + x1) / 2, 3.25, TERRACE.z1 - 0.35), new THREE.Vector3(x1, 4.7, 0.35)]);
  }
  return out;
}

/** points along a sagging strand, every `step` metres */
function along(a: THREE.Vector3, b: THREE.Vector3, step: number, sag: number): { p: THREE.Vector3; dir: THREE.Vector3 }[] {
  const len = a.distanceTo(b);
  const n = Math.max(2, Math.round(len / step));
  const out: { p: THREE.Vector3; dir: THREE.Vector3 }[] = [];
  const at = (t: number) => new THREE.Vector3().lerpVectors(a, b, t).setY(a.y + (b.y - a.y) * t - Math.sin(Math.PI * t) * sag);
  for (let k = 1; k < n; k++) {
    const t = k / n;
    const p = at(t);
    const dir = at(Math.min(1, t + 0.01)).sub(at(Math.max(0, t - 0.01))).normalize();
    out.push({ p, dir });
  }
  return out;
}

/** the Turkish flag (ay yıldız), drawn to its official proportions on a 3:2 canvas */
function flagTexture(): THREE.CanvasTexture {
  const W = 300;
  const H = 200;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  g.fillStyle = '#e30a17';
  g.fillRect(0, 0, W, H);
  const G = H; // flag height
  const cx = 0.5 * G; // crescent centre from the hoist
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.arc(cx, H / 2, 0.25 * G, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#e30a17';
  g.beginPath();
  g.arc(cx + 0.0625 * G, H / 2, 0.2 * G, 0, Math.PI * 2);
  g.fill();
  // the star: its circumscribed circle (diameter G/4) sits 1/3 G from the crescent's centre
  const sx = cx + 0.0625 * G + 0.2 * G + 0.0333 * G + 0.125 * G;
  const r = 0.125 * G;
  g.fillStyle = '#ffffff';
  g.beginPath();
  for (let k = 0; k < 10; k++) {
    const ang = Math.PI + (k * Math.PI) / 5;
    const rr = k % 2 === 0 ? r : r * 0.382;
    g.lineTo(sx + Math.cos(ang) * rr, H / 2 + Math.sin(ang) * rr);
  }
  g.closePath();
  g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** lit mahya letters (dots), on a strip canvas */
function mahyaTexture(text: string): THREE.CanvasTexture {
  const W = 1024;
  const H = 96;
  const mask = document.createElement('canvas');
  mask.width = W;
  mask.height = H;
  const m = mask.getContext('2d')!;
  m.fillStyle = '#fff';
  m.textAlign = 'center';
  m.textBaseline = 'middle';
  let size = 70;
  m.font = `900 ${size}px sans-serif`;
  while (m.measureText(text).width > W - 20 && size > 20) m.font = `900 ${(size -= 2)}px sans-serif`;
  m.fillText(text, W / 2, H / 2 + 4);
  const px = m.getImageData(0, 0, W, H).data;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  g.fillStyle = '#ffe9b0';
  const STEP = 5;
  for (let y = STEP / 2; y < H; y += STEP)
    for (let x = STEP / 2; x < W; x += STEP) {
      if (px[(Math.floor(y) * W + Math.floor(x)) * 4 + 3]! < 110) continue;
      g.beginPath();
      g.arc(x, y, 1.8, 0, Math.PI * 2);
      g.fill();
    }
  // the rope it hangs from, with a bulb every so often
  g.fillStyle = 'rgba(255,233,176,0.5)';
  for (let x = 4; x < W; x += 14) g.fillRect(x, 3, 2, 2);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function buildFestive(scene: THREE.Scene, def: FestivalDef): Festive {
  const group = new THREE.Group();
  group.name = `festive-${def.id}`;
  scene.add(group);
  const disposables: { dispose(): void }[] = [];
  const keep = <T extends { dispose(): void }>(x: T) => (disposables.push(x), x);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s1 = new THREE.Vector3(1, 1, 1);
  const updates: ((dt: number, night: number) => void)[] = [];
  const lines = strands();

  // ------------------------------------------------------------ bunting + the big flag
  if (def.decor.flags) {
    const pts = lines.flatMap(([a, b]) => along(a, b, 0.55, 0.45));
    const tri = keep(new THREE.BufferGeometry());
    tri.setAttribute('position', new THREE.Float32BufferAttribute([-0.16, 0, 0, 0.16, 0, 0, 0, -0.38, 0], 3));
    tri.computeVertexNormals();
    const mat = keep(new THREE.MeshStandardMaterial({ roughness: 0.8, side: THREE.DoubleSide }));
    const flags = new THREE.InstancedMesh(tri, mat, pts.length);
    const col = new THREE.Color();
    pts.forEach(({ p, dir }, i) => {
      // hang below the string, in the vertical plane through it
      const x = new THREE.Vector3(dir.x, 0, dir.z).normalize();
      const z = new THREE.Vector3().crossVectors(x, new THREE.Vector3(0, 1, 0));
      m4.makeBasis(x, new THREE.Vector3(0, 1, 0), z).setPosition(p);
      flags.setMatrixAt(i, m4);
      flags.setColorAt(i, col.setHex(i % 2 ? WHITE : RED));
    });
    flags.castShadow = false;
    group.add(flags);
    const rope = keep(new THREE.BufferGeometry().setFromPoints(lines.flatMap(([a, b]) => [a, ...along(a, b, 0.55, 0.45).map((o) => o.p), b]).flatMap((p, i, arr) => (i ? [arr[i - 1]!, p] : []))));
    group.add(new THREE.LineSegments(rope, keep(new THREE.LineBasicMaterial({ color: 0x333333 }))));
    // the big flag between the first-floor windows, waving a little
    const tex = keep(flagTexture());
    const geo = keep(new THREE.PlaneGeometry(2.6, 1.73, 12, 1));
    const big = new THREE.Mesh(geo, keep(new THREE.MeshStandardMaterial({ map: tex, roughness: 0.75, side: THREE.DoubleSide })));
    big.rotation.z = -Math.PI / 2; // hung vertically, the hoist at the top
    big.position.set(-2, HALL.h + 3.6 + 1.6, 0.32);
    group.add(big);
    const base = Float32Array.from(geo.attributes.position!.array);
    let t = 0;
    updates.push((dt) => {
      t += dt;
      const pos = geo.attributes.position!;
      for (let i = 0; i < pos.count; i++) {
        const x = base[i * 3]!;
        const k = (x + 1.3) / 2.6; // 0 at the hoist … 1 at the fly
        pos.setZ(i, Math.sin(t * 2.2 + x * 2.4) * 0.06 * k);
      }
      pos.needsUpdate = true;
    });
  }

  // ------------------------------------------------------------ balloons on the railing
  if (def.decor.balloons) {
    const spots: THREE.Vector3[] = [];
    for (let x = HALL.x0 + 0.5; x < HALL.x1; x += 2.6) if (Math.abs(x + 3) > 2) spots.push(new THREE.Vector3(x, 1.1, TERRACE.z1));
    const n = spots.length * 3;
    const ball = keep(new THREE.SphereGeometry(0.22, 12, 10).scale(1, 1.18, 1));
    const bmat = keep(new THREE.MeshStandardMaterial({ roughness: 0.25, metalness: 0.05 }));
    const balloons = new THREE.InstancedMesh(ball, bmat, n);
    const colors = [0xe30a17, 0xffffff, 0xf7c600, 0x2f80ed, 0x27ae60, 0xff7ab8];
    const col = new THREE.Color();
    const home: THREE.Vector3[] = [];
    spots.forEach((s, i) => {
      for (let k = 0; k < 3; k++) {
        home.push(new THREE.Vector3(s.x + (k - 1) * 0.28, 2.1 + k * 0.18 + (i % 2) * 0.12, s.z + (k === 1 ? 0.15 : 0)));
        balloons.setColorAt(i * 3 + k, col.setHex(colors[(i * 3 + k) % colors.length]!));
      }
    });
    const strings = keep(new THREE.BufferGeometry().setFromPoints(home.flatMap((h, i) => [spots[Math.floor(i / 3)]!, h])));
    group.add(new THREE.LineSegments(strings, keep(new THREE.LineBasicMaterial({ color: 0xdddddd }))));
    group.add(balloons);
    let t = 0;
    const p = new THREE.Vector3();
    updates.push((dt) => {
      t += dt;
      home.forEach((h, i) => {
        p.set(h.x + Math.sin(t * 0.9 + i) * 0.05, h.y + Math.sin(t * 1.3 + i * 1.7) * 0.04, h.z);
        balloons.setMatrixAt(i, m4.compose(p, q.identity(), s1));
      });
      balloons.instanceMatrix.needsUpdate = true;
    });
  }

  // ------------------------------------------------------------ string lights on the strands
  if (def.decor.lights) {
    const pts = lines.flatMap(([a, b]) => along(a, b, 0.4, 0.5).map((o) => o.p.clone().setY(o.p.y + 0.02)));
    const bulb = keep(new THREE.SphereGeometry(0.06, 6, 5));
    const bmat = keep(new THREE.MeshBasicMaterial({ toneMapped: false }));
    const bulbs = new THREE.InstancedMesh(bulb, bmat, pts.length);
    const multi = def.id === 'yilbasi';
    const palette = multi ? [0xff3b3b, 0x3bff6a, 0x3b8bff, 0xffd23b, 0xff6af0] : [0xffd890];
    const col = new THREE.Color();
    pts.forEach((p, i) => bulbs.setMatrixAt(i, m4.compose(p, q.identity(), s1)));
    group.add(bulbs);
    let t = 0;
    let tick = 0;
    updates.push((dt, night) => {
      t += dt;
      tick -= dt;
      if (tick > 0) return;
      tick = 0.4;
      // dim by day, bright at night; yılbaşı lights chase
      const on = 0.35 + 0.65 * night;
      for (let i = 0; i < pts.length; i++) {
        const blink = multi ? (Math.floor(t * 2.5) + i) % 3 === 0 ? 0.35 : 1 : 1;
        bulbs.setColorAt(i, col.setHex(palette[i % palette.length]!).multiplyScalar(on * blink * 1.6));
      }
      bulbs.instanceColor!.needsUpdate = true;
    });
  }

  // ------------------------------------------------------------ the yılbaşı tree by the door
  if (def.decor.tree) {
    const tree = new THREE.Group();
    const green = keep(new THREE.MeshStandardMaterial({ color: 0x1f5a33, roughness: 0.9 }));
    for (let k = 0; k < 4; k++) {
      const cone = new THREE.Mesh(keep(new THREE.ConeGeometry(0.95 - k * 0.2, 1.0, 12)), green);
      cone.position.y = 0.75 + k * 0.55;
      cone.castShadow = true;
      tree.add(cone);
    }
    const trunk = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.1, 0.12, 0.4, 8)), keep(new THREE.MeshStandardMaterial({ color: 0x5a3a22 })));
    trunk.position.y = 0.2;
    tree.add(trunk);
    const pot = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.35, 0.28, 0.4, 12)), keep(new THREE.MeshStandardMaterial({ color: 0x8a2a1c, roughness: 0.6 })));
    pot.position.y = 0.2;
    tree.add(pot);
    const orn = keep(new THREE.SphereGeometry(0.07, 8, 6));
    const ornMat = keep(new THREE.MeshStandardMaterial({ roughness: 0.2, metalness: 0.6 }));
    const balls = new THREE.InstancedMesh(orn, ornMat, 22);
    const col = new THREE.Color();
    for (let i = 0; i < 22; i++) {
      const h = 0.5 + (i / 22) * 2.0;
      const r = 0.9 * (1 - (h - 0.4) / 2.6) + 0.05;
      const a = i * 2.4;
      balls.setMatrixAt(i, m4.compose(new THREE.Vector3(Math.cos(a) * r, h, Math.sin(a) * r), q.identity(), s1));
      balls.setColorAt(i, col.setHex([0xd4202a, 0xe8c547, 0x2a6fd4, 0xf2f2f2][i % 4]!));
    }
    tree.add(balls);
    const star = new THREE.Mesh(keep(new THREE.OctahedronGeometry(0.16)), keep(new THREE.MeshBasicMaterial({ color: 0xffe27a, toneMapped: false })));
    star.position.y = 2.95;
    tree.add(star);
    tree.position.set(-6.4, 0, 0.9);
    group.add(tree);
    let t = 0;
    updates.push((dt) => {
      t += dt;
      star.rotation.y = t * 0.8;
    });
  }

  // ------------------------------------------------------------ mahya between Sultanahmet's minarets
  // the skyline is a 4096 px wide strip on a cylinder (r 820, height 112, centre y 40,
  // θ −1.55 … +0.65); Sultanahmet's outer minarets stand at x 1180 and 1420, their top şerefe
  // at y ≈ 215 px. The mahya hangs just below, on its own strip a little in front.
  if (def.decor.mahya) {
    const th = (x: number) => -1.55 + (x / 4096) * 2.2;
    const a0 = th(1186);
    const a1 = th(1414);
    const tex = keep(mahyaTexture(def.decor.mahya));
    // the strip is seen from inside the cylinder: mirror it so the text reads left to right
    tex.wrapS = THREE.RepeatWrapping;
    tex.repeat.x = -1;
    const mat = keep(new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, side: THREE.BackSide, depthWrite: false, fog: false, toneMapped: false }));
    const strip = new THREE.Mesh(keep(new THREE.CylinderGeometry(812, 812, 8.5, 12, 1, true, a0, a1 - a0)), mat);
    strip.position.y = 44.5;
    strip.renderOrder = 2;
    strip.userData.noAO = true;
    group.add(strip);
    updates.push((_dt, night) => {
      mat.opacity = Math.min(1, Math.max(0, (night - 0.2) / 0.5));
      strip.visible = mat.opacity > 0.01;
    });
  }

  // ------------------------------------------------------------ fireworks over the sea (night)
  if (def.decor.fireworks) {
    const BURSTS = 6;
    const PER = 70;
    const N = BURSTS * PER;
    const pos = new Float32Array(N * 3);
    const colAttr = new Float32Array(N * 3);
    const vel = new Float32Array(N * 3);
    const life = new Float32Array(BURSTS);
    const colInit = new Float32Array(N * 3);
    const geo = keep(new THREE.BufferGeometry());
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colAttr, 3));
    const mat = keep(new THREE.PointsMaterial({ size: 1.6, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, toneMapped: false }));
    const cloud = new THREE.Points(geo, mat);
    cloud.frustumCulled = false;
    group.add(cloud);
    const national = def.id !== 'yilbasi';
    const pal = national ? [[1, 0.1, 0.12], [1, 1, 1]] : [[1, 0.3, 0.3], [0.4, 1, 0.5], [0.4, 0.6, 1], [1, 0.85, 0.3], [1, 0.45, 1]];
    let next = 1;
    let rng = 12345;
    const rnd = () => ((rng = (rng * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    const spawn = (b: number) => {
      life[b] = 2.4;
      const x = -90 + rnd() * 130;
      const y = 38 + rnd() * 22;
      const z = 110 + rnd() * 80;
      const c = pal[Math.floor(rnd() * pal.length)]!;
      const sp = 9 + rnd() * 6;
      for (let k = 0; k < PER; k++) {
        const i = (b * PER + k) * 3;
        const u = rnd() * 2 - 1;
        const a = rnd() * Math.PI * 2;
        const r = Math.sqrt(1 - u * u);
        pos[i] = x;
        pos[i + 1] = y;
        pos[i + 2] = z;
        vel[i] = Math.cos(a) * r * sp;
        vel[i + 1] = u * sp;
        vel[i + 2] = Math.sin(a) * r * sp;
        // the national palette mixes red and white within a burst
        const cc = national && k % 3 === 0 ? pal[1]! : c;
        colInit[i] = cc[0]!;
        colInit[i + 1] = cc[1]!;
        colInit[i + 2] = cc[2]!;
      }
    };
    updates.push((dt, night) => {
      cloud.visible = night > 0.5;
      if (!cloud.visible) return;
      next -= dt;
      if (next <= 0) {
        next = 0.7 + rnd() * 1.8;
        let b = 0;
        for (let k = 1; k < BURSTS; k++) if (life[k]! < life[b]!) b = k;
        spawn(b);
      }
      for (let b = 0; b < BURSTS; b++) {
        if (life[b]! <= 0) continue;
        life[b]! -= dt;
        // full brightness, then a fade over the last 0.8 s (additive: black is invisible)
        const f = Math.min(1, Math.max(0, life[b]! / 0.8));
        const drag = Math.pow(0.35, dt);
        for (let k = 0; k < PER; k++) {
          const i = (b * PER + k) * 3;
          vel[i] *= drag;
          vel[i + 1] = vel[i + 1]! * drag - 5 * dt;
          vel[i + 2] *= drag;
          pos[i] += vel[i]! * dt;
          pos[i + 1] += vel[i + 1]! * dt;
          pos[i + 2] += vel[i + 2]! * dt;
          colAttr[i] = colInit[i]! * f;
          colAttr[i + 1] = colInit[i + 1]! * f;
          colAttr[i + 2] = colInit[i + 2]! * f;
        }
      }
      geo.attributes.position!.needsUpdate = true;
      geo.attributes.color!.needsUpdate = true;
    });
  }

  return {
    update(dt, night) {
      for (const u of updates) u(dt, night);
    },
    dispose() {
      scene.remove(group);
      group.traverse((o) => {
        if ((o as THREE.InstancedMesh).isInstancedMesh) (o as THREE.InstancedMesh).dispose();
      });
      for (const d of disposables) d.dispose();
    },
  };
}
