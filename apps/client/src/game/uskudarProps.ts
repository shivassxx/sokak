import * as THREE from 'three';
import { Builder, canvasTex, hash } from './world';
import { PAT } from './materials';

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
/** Kız Kulesi on its rock (a group, built around its own origin). */
export function kizKulesi(): THREE.Group {
  const g = new THREE.Group();
  const stone = new THREE.MeshStandardMaterial({ color: 0xf1ebe0, roughness: 0.75 });
  const lead = new THREE.MeshStandardMaterial({ color: 0x7d8c96, roughness: 0.45, metalness: 0.4 });
  const rock = new THREE.MeshStandardMaterial({ color: 0x6f6a62, roughness: 0.95, flatShading: true });
  const dark = new THREE.MeshStandardMaterial({ color: 0x30353d, roughness: 0.6 });
  const glow = new THREE.MeshBasicMaterial({ color: 0xffd9a0 });
  glow.color.multiplyScalar(1.6);
  const add = (geo: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number, ry = 0) => {
    const o = new THREE.Mesh(geo, m);
    o.position.set(x, y, z);
    o.rotation.y = ry;
    o.castShadow = o.receiveShadow = m !== glow;
    g.add(o);
    return o;
  };
  const isle = new THREE.DodecahedronGeometry(14, 1);
  isle.scale(1.6, 0.25, 1.0);
  add(isle, rock, 0, -1.2, 0);
  add(new THREE.BoxGeometry(30, 2.2, 18), stone, 0, 0.6, 0);
  // the low building with arched windows
  add(new THREE.BoxGeometry(17, 6, 10), stone, -4, 4.7, 0);
  const roofGeo = new THREE.ConeGeometry(10.5, 2.4, 4);
  roofGeo.rotateY(Math.PI / 4);
  roofGeo.scale(1.15, 1, 0.68);
  add(roofGeo, lead, -4, 8.9, 0);
  for (let k = 0; k < 6; k++) {
    add(new THREE.BoxGeometry(1.0, 1.9, 0.1), k % 2 ? dark : glow, -11 + k * 2.6, 4.6, 5.05);
    add(new THREE.CylinderGeometry(0.5, 0.5, 0.1, 10, 1, false, 0, Math.PI), k % 2 ? dark : glow, -11 + k * 2.6, 5.55, 5.05).rotation.set(Math.PI / 2, 0, Math.PI / 2);
  }
  // the tower: square base, octagonal shaft, gallery, lantern, lead cone, finial
  add(new THREE.BoxGeometry(6.5, 11, 6.5), stone, 7.5, 7, 0);
  add(new THREE.CylinderGeometry(2.9, 3.2, 6, 8), stone, 7.5, 15.5, 0, Math.PI / 8);
  add(new THREE.CylinderGeometry(3.8, 3.8, 0.4, 8), stone, 7.5, 18.6, 0, Math.PI / 8);
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2;
    add(new THREE.BoxGeometry(0.12, 0.9, 0.12), dark, 7.5 + Math.sin(a) * 3.6, 19.2, Math.cos(a) * 3.6);
  }
  add(new THREE.CylinderGeometry(2.3, 2.5, 3.2, 8), stone, 7.5, 20.4, 0, Math.PI / 8);
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
    add(new THREE.BoxGeometry(0.6, 1.4, 0.1), glow, 7.5 + Math.sin(a) * 2.42, 20.6, Math.cos(a) * 2.42, a);
  }
  add(new THREE.ConeGeometry(2.8, 5.2, 8), lead, 7.5, 24.6, 0, Math.PI / 8);
  add(new THREE.CylinderGeometry(0.12, 0.12, 2.4, 6), dark, 7.5, 28.2, 0);
  add(new THREE.SphereGeometry(0.35, 8, 6), new THREE.MeshStandardMaterial({ color: 0xd9b45a, metalness: 0.8, roughness: 0.3 }), 7.5, 27.4, 0);
  const flag = add(new THREE.PlaneGeometry(1.6, 1.05), new THREE.MeshStandardMaterial({ color: 0xd32f2f, side: THREE.DoubleSide, roughness: 0.8 }), 8.35, 28.8, 0);
  flag.name = 'flag';
  // a small jetty
  add(new THREE.BoxGeometry(2.5, 0.5, 9), new THREE.MeshStandardMaterial({ color: 0x7a5a3a, roughness: 0.9 }), -14, 0.3, 12);
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
  const add = (geo: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number) => {
    const o = new THREE.Mesh(geo, m);
    o.position.set(x, y, z);
    o.castShadow = true;
    g.add(o);
    return o;
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
