import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import {
  HALL,
  HALL_DOOR,
  KAHVE_HALF,
  LEDGE,
  KAHVE_OBJECTS,
  MARKET,
  PROMENADE,
  SEA_Z,
  STREET,
  TABLES,
  TAVLA_TABLES,
  TERRACE,
  seatPosition,
} from '@sokak/shared';
import { Builder, canvasTex, decal, hash } from './world';
import { PAT, patternize } from './materials';
import { STEEL, LIGHT_OAK, TABLE_TOP, feltTexture, modernChair, modernOkeyTable, parasol, patioHeater, samovar, caydanlik, bentwoodChair } from './kahveProps';
import { vapurHorn } from './audio';
import { classicLamp, gull, hillMosque, houseRow, iskele, kizKulesi, parkBench, planeTree, simitCart, skylineTexture, vapur, waterMaterial } from './uskudarProps';
import type { Quality } from './postfx';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Static world of the okey mode: the modern kıraathane (hall + terrace), the
 * market next door, the street and the Üsküdar sahil with Kız Kulesi, plus the
 * animated bits (sea, vapur, gulls, flag, TVs). The sun follows the player so
 * shadows stay sharp near the camera.
 */
export interface KahveWorld {
  update(dt: number): void;
  follow(x: number, z: number): void;
  /** a piece of simit thrown from (x, z) towards the sea; the nearest gull dives for it */
  feedGulls(x: number, z: number): void;
  /** world positions used by the scene for NPCs */
  tavlaBoards: THREE.Vector3[];
}

const BRICK = 0x9c4a32;
const GREIGE = 0xe3dacd;
const CHARCOAL = 0x2c2d31;

export function buildKahveWorld(scene: THREE.Scene, renderer: THREE.WebGLRenderer, quality: Quality): KahveWorld {
  const low = quality === 'low';
  // -------------------------------------------------------------- sky, light
  const sunDir = new THREE.Vector3(-0.66, 0.24, 0.71).normalize();
  const skyUniforms = {
    top: { value: new THREE.Color(0x4a5d9a) },
    mid: { value: new THREE.Color(0xe98a6a) },
    horizon: { value: new THREE.Color(0xffc690) },
    sunDir: { value: sunDir },
  };
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(1000, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: skyUniforms,
      vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `uniform vec3 top; uniform vec3 mid; uniform vec3 horizon; uniform vec3 sunDir; varying vec3 vD;
        void main(){
          float h = clamp(vD.y, -0.1, 1.0);
          vec3 c = mix(horizon, mid, smoothstep(0.0, 0.18, h));
          c = mix(c, top, smoothstep(0.15, 0.7, h));
          float s = max(dot(normalize(vD), sunDir), 0.0);
          c += vec3(1.0, 0.75, 0.45) * (pow(s, 600.0) * 4.0 + pow(s, 12.0) * 0.35);
          gl_FragColor = vec4(c, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    }),
  );
  sky.renderOrder = -1;
  scene.add(sky);
  scene.background = new THREE.Color(0xe9a07a);
  scene.fog = new THREE.Fog(0xe7a888, 90, 520);
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.32;
  pm.dispose();
  scene.add(new THREE.HemisphereLight(0xffdcb8, 0x5a4a42, low ? 1.1 : 0.72));
  const sun = new THREE.DirectionalLight(0xffb27a, low ? 1.8 : 2.3);
  sun.castShadow = true;
  const S = low ? 22 : 30;
  sun.shadow.mapSize.set(low ? 1024 : 2048, low ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -S, right: S, top: S, bottom: -S, near: 1, far: 140 });
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);
  if (!low) {
    for (const [x, y, z, i] of [
      [-13, 3.9, -12, 9],
      [-3, 3.9, -12, 9],
      [7, 3.9, -12, 9],
      [-3, 3.9, -21, 5],
      [23, 3.5, -7, 6],
    ] as const) {
      const l = new THREE.PointLight(0xffc98f, i, 15, 1.5);
      l.position.set(x, y, z);
      scene.add(l);
    }
  }

  const b = new Builder();

  // -------------------------------------------------------------- ground surfaces
  b.bucket = 'ground';
  b.pat = PAT.none;
  b.box(0, -0.2, (SEA_Z + 0.6 - 120) / 2, 300, 0.19, SEA_Z + 0.6 + 120, 0x6b6560);
  b.pat = PAT.tiles;
  b.box(0, -0.02, (TERRACE.z1 + STREET.z0) / 2, KAHVE_HALF * 2, 0.02, STREET.z0 - TERRACE.z1, 0xc9bca6); // pavement
  b.box((MARKET.x0 + KAHVE_HALF) / 2, -0.02, TERRACE.z1 / 2, KAHVE_HALF - MARKET.x0, 0.02, TERRACE.z1, 0xc9bca6);
  b.box(0, -0.02, (STREET.z1 + PROMENADE.z0) / 2, KAHVE_HALF * 2, 0.02, PROMENADE.z0 - STREET.z1, 0xc9bca6);
  b.pat = PAT.stone;
  b.box(0, -0.03, (STREET.z0 + STREET.z1) / 2, KAHVE_HALF * 2, 0.02, STREET.z1 - STREET.z0, 0x6e6a66); // cobbles
  b.pat = PAT.tiles;
  b.box(0, -0.02, (PROMENADE.z0 + SEA_Z) / 2, KAHVE_HALF * 2, 0.02, SEA_Z - PROMENADE.z0, 0xd8cdb8);
  b.pat = PAT.stone;
  b.box(0, -0.01, SEA_Z - 0.6, KAHVE_HALF * 2, 0.02, 1.0, 0xb7ab98);
  b.pat = PAT.none;
  // curbs (visual)
  for (const z of [STREET.z0, STREET.z1]) b.box(0, -0.02, z, KAHVE_HALF * 2, 0.1, 0.25, 0xa69a88);
  b.pat = PAT.wood;
  b.box((HALL.x0 + HALL.x1) / 2, -0.02, TERRACE.z1 / 2, HALL.x1 - HALL.x0 + 0.8, 0.04, TERRACE.z1, 0x8a6142); // terrace deck
  b.pat = PAT.tiles;
  b.box((MARKET.x0 + MARKET.x1) / 2, -0.015, (MARKET.z0 + MARKET.z1) / 2, MARKET.x1 - MARKET.x0, 0.02, MARKET.z1 - MARKET.z0, 0xe8e6e0);
  b.pat = PAT.none;
  // hall floor: polished concrete (texture)
  const concrete = canvasTex(512, 512, (ctx) => {
    ctx.fillStyle = '#b9b2a8';
    ctx.fillRect(0, 0, 512, 512);
    const img = ctx.getImageData(0, 0, 512, 512);
    for (let i = 0; i < img.data.length; i += 4) {
      const n = (Math.random() - 0.5) * 10 + Math.sin(i * 0.00003) * 6;
      img.data[i] = img.data[i]! + n;
      img.data[i + 1] = img.data[i + 1]! + n;
      img.data[i + 2] = img.data[i + 2]! + n;
    }
    ctx.putImageData(img, 0, 0);
    ctx.strokeStyle = 'rgba(90,85,80,0.35)';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, 512, 512);
  });
  concrete.wrapS = concrete.wrapT = THREE.RepeatWrapping;
  concrete.repeat.set((HALL.x1 - HALL.x0) / 3, (HALL.z1 - HALL.z0) / 3);
  const hallFloor = new THREE.Mesh(new THREE.PlaneGeometry(HALL.x1 - HALL.x0, HALL.z1 - HALL.z0), new THREE.MeshStandardMaterial({ map: concrete, roughness: 0.46, metalness: 0.02 }));
  hallFloor.rotation.x = -Math.PI / 2;
  hallFloor.position.set((HALL.x0 + HALL.x1) / 2, 0.005, (HALL.z0 + HALL.z1) / 2);
  hallFloor.receiveShadow = true;
  scene.add(hallFloor);

  // -------------------------------------------------------------- the hall shell
  b.bucket = 'main';
  const H = HALL.h;
  const cx = (HALL.x0 + HALL.x1) / 2;
  const cz = (HALL.z0 + HALL.z1) / 2;
  const T = 0.4;
  // north wall: exposed brick inside
  b.pat = PAT.brick;
  b.box(cx, 0, HALL.z0 - T / 2, HALL.x1 - HALL.x0 + 2 * T, H, T, BRICK);
  // side walls: warm plaster with oak slats
  b.pat = PAT.plaster;
  b.box(HALL.x0 - T / 2, 0, cz, T, H, HALL.z1 - HALL.z0, GREIGE);
  b.box(HALL.x1 + T / 2, 0, cz, T, H, HALL.z1 - HALL.z0, GREIGE);
  b.pat = PAT.wood;
  for (const [x, nx] of [
    [HALL.x0, 1],
    [HALL.x1, -1],
  ] as const) {
    for (let z = HALL.z0 + 0.5; z < HALL.z1 - 0.3; z += 0.16) b.box(x + nx * 0.03, 0, z, 0.04, 2.6, 0.08, LIGHT_OAK);
    b.box(x + nx * 0.05, 2.6, cz, 0.08, 0.06, HALL.z1 - HALL.z0, CHARCOAL);
  }
  b.pat = PAT.none;
  // ceiling (casts: keeps the hall in the shade), ducts and a slatted band
  b.box(cx, H, cz, HALL.x1 - HALL.x0 + 2 * T, 0.3, HALL.z1 - HALL.z0 + 2 * T, CHARCOAL);
  for (const z of [-19, -9]) b.add(new THREE.CylinderGeometry(0.28, 0.28, HALL.x1 - HALL.x0, 12), 0x3a3c40, cx, H - 0.45, z, 0, 0, Math.PI / 2);
  b.pat = PAT.wood;
  for (let x = HALL.x0 + 0.5; x < HALL.x1; x += 0.5) b.box(x, H - 0.12, -4, 0.08, 0.1, 6, LIGHT_OAK);
  b.pat = PAT.none;
  // building above (two apartment floors)
  b.pat = PAT.plaster;
  b.box(cx, H + 0.3, cz - 0.6, HALL.x1 - HALL.x0 + 2 * T, 7, HALL.z1 - HALL.z0 + 0.8, 0xc4ab8c);
  b.pat = PAT.none;
  for (let fl = 0; fl < 2; fl++)
    for (let x = HALL.x0 + 1.5; x < HALL.x1; x += 3) {
      const y = H + 1.3 + fl * 3.2;
      b.box(x, y, 0.22, 1.3, 1.6, 0.06, 0xf2ece0);
      const lit = hash(x * 3 + fl) > 0.5;
      b.box(x, y + 0.1, 0.26, 1.1, 1.4, 0.04, lit ? 0x8a6a40 : 0x3b4250, lit ? 'glow' : 'main');
      if (fl === 0 && hash(x) > 0.4) {
        b.box(x, y - 0.25, 0.9, 1.9, 0.12, 1.2, 0xbfb6a6);
        for (let k = 0; k < 5; k++) b.box(x - 0.9 + k * 0.45, y - 0.13, 1.45, 0.04, 0.9, 0.04, IRONISH);
        b.box(x, y + 0.75, 1.45, 1.9, 0.05, 0.05, IRONISH);
      }
    }
  // storefront: black steel frames; glass panes are a separate transparent mesh
  const glassPanes: THREE.BufferGeometry[] = [];
  const pane = (x0: number, x1: number, y0: number, y1: number, z: number) => {
    const g = new THREE.PlaneGeometry(x1 - x0, y1 - y0);
    g.translate((x0 + x1) / 2, (y0 + y1) / 2, z);
    glassPanes.push(g);
  };
  const doorL = HALL_DOOR.x - HALL_DOOR.w / 2;
  const doorR = HALL_DOOR.x + HALL_DOOR.w / 2;
  for (const [x0, x1] of [
    [HALL.x0 - T, doorL],
    [doorR, HALL.x1 + T],
  ] as const) {
    const n = Math.max(1, Math.round((x1 - x0) / 2.1));
    for (let k = 0; k <= n; k++) b.box(x0 + (k * (x1 - x0)) / n, 0, 0, 0.09, 3.6, 0.12, STEEL);
    b.box((x0 + x1) / 2, 0, 0, x1 - x0, 0.25, 0.14, STEEL);
    b.box((x0 + x1) / 2, 2.6, 0, x1 - x0, 0.07, 0.12, STEEL);
    b.box((x0 + x1) / 2, 3.55, 0, x1 - x0, 0.1, 0.14, STEEL);
    pane(x0, x1, 0.25, 3.55, 0);
  }
  b.box(HALL_DOOR.x, 3.0, 0, HALL_DOOR.w, 0.6, 0.14, STEEL);
  pane(doorL, doorR, 3.0, 3.55, 0);
  for (const x of [doorL, doorR]) b.box(x, 0, 0, 0.1, 3.6, 0.14, STEEL);
  // fascia with the sign
  b.box(cx, 3.6, 0.05, HALL.x1 - HALL.x0 + 2 * T, 0.8, 0.3, CHARCOAL);
  // terrace: glass railing with steel posts and an oak handrail
  const railRun = (x0: number, z0: number, x1: number, z1: number) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const n = Math.max(1, Math.round(len / 1.6));
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      b.box(x0 + (x1 - x0) * t, 0, z0 + (z1 - z0) * t, 0.06, 1.05, 0.06, STEEL);
    }
    const along = Math.abs(x1 - x0) > Math.abs(z1 - z0);
    b.pat = PAT.wood;
    b.box((x0 + x1) / 2, 1.05, (z0 + z1) / 2, along ? len : 0.1, 0.06, along ? 0.1 : len, LIGHT_OAK);
    b.pat = PAT.none;
    const g = new THREE.PlaneGeometry(len, 0.85);
    if (!along) g.rotateY(Math.PI / 2);
    g.translate((x0 + x1) / 2, 0.55, (z0 + z1) / 2);
    glassPanes.push(g);
  };
  railRun(HALL.x0 - T, TERRACE.z1, doorL, TERRACE.z1);
  railRun(doorR, TERRACE.z1, HALL.x1 + T, TERRACE.z1);
  railRun(HALL.x0 - T / 2, 0.2, HALL.x0 - T / 2, TERRACE.z1);
  railRun(HALL.x1 + T / 2, 0.2, HALL.x1 + T / 2, TERRACE.z1);
  // terrace furniture: parasols, heaters, olive trees, string lights
  for (let t = 18; t < TABLES.length; t++) parasol(b, TABLES[t]!.x, TABLES[t]!.z);
  for (const o of KAHVE_OBJECTS) if (o.kind === 'heater') patioHeater(b, o.x, o.z);
  const bulbs: [number, number, number][] = [];
  for (let x = HALL.x0; x <= HALL.x1; x += 1.2) {
    const t = (x - HALL.x0) / (HALL.x1 - HALL.x0);
    bulbs.push([x, 3.2 - Math.sin(t * Math.PI * 6) ** 2 * 0.35, TERRACE.z1 - 0.3]);
  }
  for (const [x, y, z] of bulbs) b.add(new THREE.SphereGeometry(0.05, 6, 5), 0xffe0a0, x, y, z, 0, 0, 0, 'glow');
  b.box(cx, 3.22, TERRACE.z1 - 0.3, HALL.x1 - HALL.x0, 0.01, 0.01, 0x222222);
  for (const x of [HALL.x0 - 0.2, HALL.x1 + 0.2]) b.box(x, 0, TERRACE.z1 - 0.3, 0.06, 3.3, 0.06, STEEL);

  // -------------------------------------------------------------- hall interior
  // çay ocağı: oak counter, marble top, LED strip, back bar
  b.pat = PAT.wood;
  b.box(-3, 0, -21, 12, 1.0, 1.2, 0x7a5232);
  b.pat = PAT.stone;
  b.box(-3, 1.0, -21, 12.2, 0.06, 1.35, 0xf0ede6);
  b.pat = PAT.none;
  b.box(-3, 0.06, -20.38, 11.8, 0.03, 0.02, 0xffc27a, 'glow');
  b.pat = PAT.wood;
  for (const y of [1.6, 2.2, 2.8]) b.box(-3, y, HALL.z0 + 0.2, 12, 0.05, 0.36, LIGHT_OAK);
  b.pat = PAT.none;
  for (const y of [1.6, 2.2, 2.8]) b.box(-3, y - 0.03, HALL.z0 + 0.36, 11.8, 0.02, 0.02, 0xffd9a0, 'glow');
  for (let i = 0; i < 48; i++) {
    const x = -8.6 + (i % 24) * 0.48;
    const y = i < 24 ? 1.65 : 2.25;
    b.add(new THREE.LatheGeometry([new THREE.Vector2(0.018, 0), new THREE.Vector2(0.026, 0.02), new THREE.Vector2(0.02, 0.05), new THREE.Vector2(0.028, 0.085)], 8), 0xe8f0f0, x, y, HALL.z0 + 0.25);
  }
  for (let i = 0; i < 8; i++) b.cyl(-8 + i * 1.6, 2.85, HALL.z0 + 0.25, 0.1, 0.3, [0xd8473b, 0xf2c94c, 0x3f8f5a, 0xe9e2d0][i % 4]!, 10);
  // tea urns + çaydanlıklar on the counter
  for (const x of [-7.6, -6.6]) {
    b.cyl(x, 1.06, -21.2, 0.24, 0.62, 0xc9ccd1, 18);
    b.cyl(x, 1.68, -21.2, 0.2, 0.08, 0x9a9da2, 18);
    b.add(new THREE.CylinderGeometry(0.015, 0.015, 0.14, 6), 0x222222, x, 1.25, -20.94, Math.PI / 2, 0, 0);
  }
  samovar(b, -5.2, 1.06, -21.3, 1.0);
  for (const x of [-3.8, -3.0, -2.2]) caydanlik(b, x, 1.06, -21.3);
  for (let i = 0; i < 18; i++) {
    const x = -0.8 + (i % 6) * 0.17;
    const z = -20.8 - Math.floor(i / 6) * 0.17;
    b.cyl(x, 1.06, z, 0.05, 0.008, 0xffffff, 10);
    b.add(new THREE.LatheGeometry([new THREE.Vector2(0.018, 0), new THREE.Vector2(0.026, 0.02), new THREE.Vector2(0.02, 0.05), new THREE.Vector2(0.028, 0.085)], 8), 0x9b2a14, x, 1.07, z);
  }
  b.box(1.8, 1.06, -21.1, 0.42, 0.22, 0.34, 0x2b2b2b);
  // tables + chairs
  for (let t = 0; t < TABLES.length; t++) {
    const c = TABLES[t]!;
    modernOkeyTable(b, c.x, c.z);
    for (let s = 0; s < 4; s++) {
      const p = seatPosition(t, s);
      modernChair(b, p.x + Math.sin(p.yaw) * 0.06, p.z + Math.cos(p.yaw) * 0.06, p.yaw);
    }
    if (t < 18) {
      // pendant lamp
      b.cyl(c.x, 2.75, c.z, 0.006, H - 2.75, 0x111111, 4);
      b.add(new THREE.LatheGeometry([new THREE.Vector2(0.02, 0.32), new THREE.Vector2(0.06, 0.3), new THREE.Vector2(0.26, 0.02), new THREE.Vector2(0.27, 0)], 18), 0x1d1e20, c.x, 2.45, c.z);
      b.add(new THREE.SphereGeometry(0.07, 10, 8), 0xffe0a0, c.x, 2.48, c.z, 0, 0, 0, 'glow');
    }
  }
  const feltGeo = new THREE.PlaneGeometry(0.98, 0.98);
  feltGeo.rotateX(-Math.PI / 2);
  const felts = new THREE.InstancedMesh(feltGeo, new THREE.MeshStandardMaterial({ map: feltTexture(), roughness: 0.95 }), TABLES.length);
  TABLES.forEach((c, i) => felts.setMatrixAt(i, new THREE.Matrix4().makeTranslation(c.x, TABLE_TOP + 0.001, c.z)));
  felts.receiveShadow = true;
  scene.add(felts);
  // tavla tables in the lounge
  const tavlaBoards: THREE.Vector3[] = [];
  for (const t of TAVLA_TABLES) {
    b.pat = PAT.wood;
    b.cyl(t.x, 0.72, t.z, 0.48, 0.04, LIGHT_OAK, 24);
    b.pat = PAT.none;
    b.cyl(t.x, 0, t.z, 0.05, 0.72, STEEL, 8);
    b.cyl(t.x, 0, t.z, 0.28, 0.03, STEEL, 16);
    b.pat = PAT.wood;
    b.box(t.x, 0.76, t.z, 0.62, 0.03, 0.46, 0x7a4a2a);
    b.pat = PAT.none;
    b.box(t.x, 0.79, t.z, 0.56, 0.005, 0.4, 0xe9d8b0);
    for (let k = 0; k < 24; k++) {
      const side = k < 12 ? -1 : 1;
      const xx = t.x - 0.255 + (k % 12) * 0.0465 + (k % 12 >= 6 ? 0.02 : 0);
      b.add(new THREE.ConeGeometry(0.019, 0.17, 3), k % 2 ? 0x8f2f2a : 0x2b1a10, xx, 0.795, t.z + side * 0.11, (side * Math.PI) / 2, 0, 0);
    }
    for (let k = 0; k < 10; k++) b.cyl(t.x - 0.2 + (k % 5) * 0.04, 0.79, t.z + (k < 5 ? -0.15 : 0.15), 0.019, 0.008, k % 2 ? 0xf4f1e8 : 0x6d2a1e, 12);
    tavlaBoards.push(new THREE.Vector3(t.x, 0.81, t.z));
    for (const s of [-1, 1]) bentwoodChair(b, t.x + s * 0.85, t.z, s > 0 ? Math.PI / 2 : -Math.PI / 2);
  }
  // big plants
  for (const o of KAHVE_OBJECTS) {
    if (o.kind !== 'planter') continue;
    const outdoor = o.z > 18;
    if (outdoor) continue;
    b.add(new THREE.CylinderGeometry(o.w / 2, o.w / 2.4, o.h, 14), 0x3a3c40, o.x, o.h / 2, o.z);
    for (let k = 0; k < 9; k++) {
      const a = k * 2.4;
      b.blob(o.x + Math.sin(a) * 0.32, o.h + 0.5 + (k % 3) * 0.35, o.z + Math.cos(a) * 0.32, 0.28, k % 2 ? 0x3f7f3a : 0x2f6a34, 0.5, 1, 'foliage');
    }
  }

  // -------------------------------------------------------------- the market
  const M = MARKET;
  b.pat = PAT.plaster;
  b.box((M.x0 + M.x1) / 2, 0, M.z0 - 0.15, M.x1 - M.x0, M.h, 0.3, 0xf2efe8);
  b.box(M.x0 + 0.15, 0, (M.z0 + M.z1) / 2, 0.3, M.h, M.z1 - M.z0, 0xf2efe8);
  b.box(M.x1 - 0.15, 0, (M.z0 + M.z1) / 2, 0.3, M.h, M.z1 - M.z0, 0xf2efe8);
  b.box((M.x0 + M.x1) / 2, M.h, (M.z0 + M.z1) / 2 - 0.3, M.x1 - M.x0, 6.5, M.z1 - M.z0 + 0.6, 0xe6c79a);
  b.pat = PAT.none;
  b.box((M.x0 + M.x1) / 2, M.h - 0.02, (M.z0 + M.z1) / 2, M.x1 - M.x0, 0.05, M.z1 - M.z0, 0xf7f7f4);
  for (const [x0, x1] of [
    [M.x0, M.doorX - M.doorW / 2],
    [M.doorX + M.doorW / 2, M.x1],
  ] as const) {
    for (let k = 0; k <= 2; k++) b.box(x0 + (k * (x1 - x0)) / 2, 0, 0, 0.08, 3.2, 0.12, 0x1e7a46);
    b.box((x0 + x1) / 2, 0, 0, x1 - x0, 0.3, 0.14, 0x1e7a46);
    pane(x0, x1, 0.3, 3.2, 0);
  }
  b.box(M.doorX, 3.0, 0, M.doorW, 0.2, 0.14, 0x1e7a46);
  b.box((M.x0 + M.x1) / 2, 3.2, 0.06, M.x1 - M.x0, 0.8, 0.25, 0x1e7a46);
  // striped awning
  for (let k = 0; k < 14; k++) b.add(new THREE.BoxGeometry(1.0, 0.04, 1.6), k % 2 ? 0xffffff : 0x1e7a46, M.x0 + 0.5 + k, 3.0, 0.75, -0.35, 0, 0);
  // counter, shelves with goods, fridges with glowing insides
  for (const o of KAHVE_OBJECTS) {
    if (o.kind === 'marketCounter') {
      b.box(o.x, 0, o.z, o.w, o.h, o.d, 0x8a6142);
      b.box(o.x, o.h, o.z, o.w + 0.05, 0.04, o.d + 0.05, 0xece6db);
      b.box(o.x - 0.8, o.h + 0.04, o.z, 0.4, 0.25, 0.32, 0x2b2b2b);
      // cigarette wall behind the counter
      for (let k = 0; k < 40; k++) b.box(o.x - 1.4 + (k % 10) * 0.3, 1.3 + Math.floor(k / 10) * 0.28, o.z - 1.55, 0.24, 0.2, 0.08, [0xf5f5f5, 0xd8473b, 0x1d4f91, 0xf2c94c, 0x2e8b57][(k * 7) % 5]!);
      b.box(o.x, 1.2, o.z - 1.62, 3.2, 1.2, 0.06, 0x3a3c40);
    } else if (o.kind === 'marketShelf') {
      b.box(o.x, 0, o.z, o.w, o.h, o.d, 0xd9dcdf);
      for (let lvl = 0; lvl < 4; lvl++)
        for (let k = 0; k < Math.floor(o.w / 0.22); k++)
          for (const s of [-1, 1]) {
            const c = [0xd8473b, 0xf2c94c, 0x3f8f5a, 0x2f6fb0, 0xe67e22, 0x9b59b6, 0xf4f1e8][(k * 3 + lvl * 5 + (s > 0 ? 1 : 0)) % 7]!;
            b.box(o.x - o.w / 2 + 0.14 + k * 0.22, 0.25 + lvl * 0.42, o.z + s * (o.d / 2 + 0.06), 0.16, 0.26, 0.12, c);
          }
    } else if (o.kind === 'fridge') {
      b.box(o.x, 0, o.z, o.w, o.h, o.d, 0xeef0f2);
      const along = o.d > o.w;
      const fx = along ? o.x + (o.x > 23 ? -o.w / 2 - 0.01 : o.w / 2 + 0.01) : o.x;
      b.box(fx, 0.25, o.z, along ? 0.02 : o.w - 0.1, o.h - 0.4, along ? o.d - 0.1 : 0.02, 0xdff3ff, 'glow');
    }
  }

  // -------------------------------------------------------------- neighbours, hill, mosque
  houseRow(b, -KAHVE_HALF, HALL.x0 - T, TERRACE.z1 + 0.1, 1, 3, 1);
  houseRow(b, M.x1, KAHVE_HALF, TERRACE.z1 + 0.1, 1, 5, 1);
  houseRow(b, -80, 70, -32, 1, 7, 2);
  b.pat = PAT.grass;
  b.add(new THREE.SphereGeometry(80, 24, 8, 0, Math.PI * 2, 0, Math.PI / 2), 0x6f7d4a, 0, -52, -120);
  b.pat = PAT.none;
  hillMosque(b, -20, 18, -75, 1.0);
  houseRow(b, -110, 90, -55, 1, 9, 2);

  // -------------------------------------------------------------- street & sahil furniture
  for (const o of KAHVE_OBJECTS) {
    if (o.kind === 'lamp') classicLamp(b, o.x, o.z);
    else if (o.kind === 'planter' && o.z > 18) planeTree(b, o.x, o.z);
    else if (o.kind === 'bench') parkBench(b, o.x, o.z, 1);
    else if (o.kind === 'cart') simitCart(b, o.x, o.z);
    else if (o.kind === 'pier') iskele(b, o.x - o.w / 2, o.x + o.w / 2, o.z - o.d / 2, o.z + o.d / 2);
    else if (o.kind === 'lowTable') {
      b.pat = PAT.wood;
      b.box(o.x, 0.4, o.z, o.w, 0.05, o.d, 0x8a5a33);
      b.pat = PAT.none;
      b.box(o.x, 0, o.z, 0.08, 0.4, 0.08, 0x5a3a28);
    } else if (o.kind === 'stool') {
      b.pat = PAT.fabric;
      b.cyl(o.x, 0, o.z, 0.2, 0.32, [0xc0392b, 0xe9c46a, 0x2f5d73][Math.abs(Math.round(o.x * 7)) % 3]!, 12);
      b.pat = PAT.none;
    }
  }
  for (let x = -40; x <= 28; x += 10) classicLamp(b, x, SEA_Z - 0.9, 3.8);
  // sea railing: posts and two iron rails
  for (const [x0, x1] of [
    [-KAHVE_HALF, LEDGE.x0],
    [LEDGE.x1, 32],
  ] as const) {
    for (let x = x0; x <= x1 + 0.01; x += (x1 - x0) / Math.round((x1 - x0) / 1.6)) b.box(x, 0, SEA_Z, 0.06, 1.1, 0.06, 0x2a3036);
    for (const y of [0.55, 1.05]) b.box((x0 + x1) / 2, y, SEA_Z, x1 - x0, 0.05, 0.05, 0x2a3036);
  }
  // the sitting ledge: rough stone with a smooth cap
  b.pat = PAT.stone;
  b.box((LEDGE.x0 + LEDGE.x1) / 2, 0, SEA_Z - 0.175, LEDGE.x1 - LEDGE.x0, 0.44, 0.55, 0xb9ad98);
  b.pat = PAT.none;
  b.box((LEDGE.x0 + LEDGE.x1) / 2, 0.44, SEA_Z - 0.175, LEDGE.x1 - LEDGE.x0 + 0.06, 0.06, 0.62, 0xd9d0c0);
  // quay wall down to the water
  b.pat = PAT.stone;
  b.box(0, -1.4, SEA_Z + 0.35, 400, 1.4, 0.5, 0xb0a490);
  b.pat = PAT.none;
  // çay bahçesi awning + a small kiosk
  b.pat = PAT.fabric;
  for (let k = 0; k < 18; k++) b.add(new THREE.BoxGeometry(1.0, 0.04, 4.2), k % 2 ? 0xfff6e0 : 0xc0392b, -46.5 + k, 2.7, SEA_Z - 2.6, 0.08, 0, 0);
  b.pat = PAT.none;
  for (const x of [-46.8, -29.4]) for (const z of [SEA_Z - 0.6, SEA_Z - 4.6]) b.box(x, 0, z, 0.08, 2.7, 0.08, 0x2a3036);

  // -------------------------------------------------------------- merge static geometry
  const mainMat = patternize(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62 }), 0.22);
  const groundMat = patternize(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }), 0);
  const foliageMat = patternize(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }), 0, 1.6);
  const glowMat = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
  glowMat.color.setScalar(2.2);
  const addMesh = (g: THREE.BufferGeometry | null, m: THREE.Material, cast: boolean, recv: boolean) => {
    if (!g) return;
    const mesh = new THREE.Mesh(g, m);
    mesh.castShadow = cast;
    mesh.receiveShadow = recv;
    mesh.matrixAutoUpdate = false;
    scene.add(mesh);
  };
  addMesh(b.build('main'), mainMat, true, true);
  addMesh(b.build('ground'), groundMat, false, true);
  addMesh(b.build('foliage'), foliageMat, true, true);
  addMesh(b.build('glow'), glowMat, false, false);
  addMesh(b.build('cars'), mainMat, false, true);
  // varnished furniture wood: same patterns, plus a clear lacquer coat
  const varnishMat = patternize(new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.48, clearcoat: 0.6, clearcoatRoughness: 0.22 }), 0.18);
  addMesh(b.build('varnish'), varnishMat, true, true);
  const glass = new THREE.Mesh(
    mergeGeometries(glassPanes, false)!,
    new THREE.MeshStandardMaterial({ color: 0xcfe3ea, transparent: true, opacity: 0.16, roughness: 0.05, metalness: 0.1, side: THREE.DoubleSide, depthWrite: false }),
  );
  glass.userData.noAO = true;
  scene.add(glass);

  // -------------------------------------------------------------- signs and pictures
  const neon = (text: string, color: string, w = 512, h = 160) =>
    canvasTex(w, h, (ctx) => {
      ctx.clearRect(0, 0, w, h);
      ctx.font = `800 ${Math.floor(h * 0.62)}px "Baloo 2", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = color;
      ctx.shadowBlur = 24;
      ctx.fillStyle = color;
      ctx.fillText(text, w / 2, h / 2 + 4);
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = 0.7;
      ctx.fillText(text, w / 2, h / 2 + 4);
    });
  const glowDecal = (tex: THREE.Texture, x: number, y: number, z: number, w: number, h: number, ry = 0) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false }));
    (m.material as THREE.MeshBasicMaterial).color.setScalar(1.6);
    m.position.set(x, y, z);
    m.rotation.y = ry;
    m.userData.noAO = true;
    scene.add(m);
    return m;
  };
  glowDecal(neon('SOKAK KIRAATHANESİ', '#ffd27a', 1024, 128), cx, 4.0, 0.22, 9, 1.1);
  glowDecal(neon('ÇAY', '#ff6fb5'), -1, 3.3, HALL.z0 + 0.05, 2.2, 0.7);
  glowDecal(neon('OKEY · TAVLA', '#7fe3ff', 1024, 160), HALL.x0 + 0.08, 3.4, -12, 4.4, 0.7, Math.PI / 2);
  glowDecal(neon('MARKET', '#ffffff', 512, 128), (M.x0 + M.x1) / 2, 3.6, 0.2, 5, 1.1);
  // the ferry pier's name boards and clock
  const pier = KAHVE_OBJECTS.find((o) => o.kind === 'pier');
  if (pier) {
    const board = (big: string, small: string) =>
      canvasTex(1024, 192, (ctx) => {
        ctx.fillStyle = '#1d3a63';
        ctx.fillRect(0, 0, 1024, 192);
        ctx.strokeStyle = '#e9e1cf';
        ctx.lineWidth = 8;
        ctx.strokeRect(10, 10, 1004, 172);
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '800 104px "Baloo 2", sans-serif';
        ctx.fillText(big, 512, 84);
        ctx.font = '700 38px "Baloo 2", sans-serif';
        ctx.fillText(small, 512, 158);
      });
    const px0 = pier.x - pier.w / 2;
    const pz0 = pier.z - pier.d / 2;
    decal(scene, board('ÜSKÜDAR', 'VAPUR İSKELESİ'), px0 - 0.07, 3.95, pier.z, 6.4, 1.2, -Math.PI / 2);
    decal(scene, board('ÜSKÜDAR', 'KARAKÖY · EMİNÖNÜ · BEŞİKTAŞ'), pier.x, 4.35, pz0 - 0.07, 6.4, 1.2, Math.PI);
    const clock = canvasTex(256, 256, (ctx) => {
      ctx.fillStyle = '#f6f1e4';
      ctx.beginPath();
      ctx.arc(128, 128, 120, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 10;
      ctx.strokeStyle = '#1d3a63';
      ctx.stroke();
      ctx.fillStyle = '#1d3a63';
      for (let h = 0; h < 12; h++) {
        const a = (h / 12) * Math.PI * 2;
        ctx.fillRect(128 + Math.sin(a) * 96 - 4, 128 - Math.cos(a) * 96 - 4, 8, 8);
      }
      ctx.lineCap = 'round';
      ctx.lineWidth = 9;
      ctx.beginPath();
      ctx.moveTo(128, 128);
      ctx.lineTo(128 + Math.sin(-0.9) * 54, 128 - Math.cos(-0.9) * 54);
      ctx.stroke();
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(128, 128);
      ctx.lineTo(128 + Math.sin(1.9) * 86, 128 - Math.cos(1.9) * 86);
      ctx.stroke();
    });
    decal(scene, clock, px0 - 0.07, 4.85, pier.z, 0.7, 0.7, -Math.PI / 2);
  }
  const poster = (kind: 0 | 1) =>
    canvasTex(360, 480, (ctx) => {
      const g = ctx.createLinearGradient(0, 0, 0, 480);
      g.addColorStop(0, kind ? '#f6b26b' : '#ffcf8a');
      g.addColorStop(0.55, kind ? '#e06c57' : '#e98a6a');
      g.addColorStop(1, '#2f5d73');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 360, 480);
      ctx.fillStyle = '#ffd27a';
      ctx.beginPath();
      ctx.arc(250, 200, 40, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1e3440';
      ctx.fillRect(0, 330, 360, 150);
      ctx.fillStyle = '#f1ebe0';
      if (kind === 0) {
        // Kız Kulesi
        ctx.fillRect(130, 250, 60, 90);
        ctx.fillRect(110, 300, 120, 40);
        ctx.beginPath();
        ctx.moveTo(122, 250);
        ctx.lineTo(160, 180);
        ctx.lineTo(198, 250);
        ctx.fill();
      } else {
        // vapur
        ctx.fillRect(60, 300, 240, 34);
        ctx.fillRect(90, 270, 180, 30);
        ctx.fillStyle = '#e8b23a';
        ctx.fillRect(190, 240, 22, 30);
      }
      ctx.fillStyle = '#fff6e0';
      ctx.font = '800 40px "Baloo 2", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(kind ? 'VAPUR' : 'ÜSKÜDAR', 180, 420);
      ctx.strokeStyle = '#1d1e20';
      ctx.lineWidth = 18;
      ctx.strokeRect(0, 0, 360, 480);
    });
  for (const [z, k] of [
    [-18, 0],
    [-6, 1],
  ] as const) {
    decal(scene, poster(k), HALL.x1 - 0.08, 1.9, z, 1.2, 1.6, -Math.PI / 2);
    decal(scene, poster((1 - k) as 0 | 1), HALL.x0 + 0.08, 1.9, z + 2, 1.2, 1.6, Math.PI / 2);
  }
  // street name plate (blue enamel, Istanbul style)
  decal(
    scene,
    canvasTex(512, 160, (ctx) => {
      ctx.fillStyle = '#1d4f91';
      ctx.fillRect(0, 0, 512, 160);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 8;
      ctx.strokeRect(10, 10, 492, 140);
      ctx.fillStyle = '#ffffff';
      ctx.font = '800 54px "Baloo 2", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('SALACAK SAHİL YOLU', 256, 78);
      ctx.font = '600 30px "Baloo 2", sans-serif';
      ctx.fillText('ÜSKÜDAR', 256, 124);
    }),
    HALL.x0 - 0.5,
    3.0,
    TERRACE.z1 + 0.16,
    1.6,
    0.5,
  );

  // -------------------------------------------------------------- TVs (shared canvas)
  const tvCanvas = document.createElement('canvas');
  tvCanvas.width = 256;
  tvCanvas.height = 144;
  const tvCtx = tvCanvas.getContext('2d')!;
  const tvTex = new THREE.CanvasTexture(tvCanvas);
  tvTex.colorSpace = THREE.SRGBColorSpace;
  for (const o of KAHVE_OBJECTS) {
    if (o.kind !== 'tv') continue;
    const side = o.w < o.d;
    const frame = new THREE.Mesh(new THREE.BoxGeometry(side ? 0.08 : o.w, o.h, side ? o.d : 0.08), new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.4 }));
    frame.position.set(o.x, o.y + o.h / 2, o.z);
    scene.add(frame);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry((side ? o.d : o.w) - 0.12, o.h - 0.12), new THREE.MeshBasicMaterial({ map: tvTex, toneMapped: false }));
    screen.position.set(o.x + (side ? (o.x < 0 ? 0.05 : -0.05) : 0), o.y + o.h / 2, o.z + (side ? 0 : -0.05));
    screen.rotation.y = side ? (o.x < 0 ? Math.PI / 2 : -Math.PI / 2) : Math.PI;
    screen.userData.noAO = true;
    scene.add(screen);
  }
  const players = Array.from({ length: 10 }, (_, i) => ({ x: 40 + (i % 5) * 40, y: 30 + Math.floor(i / 5) * 60 + (i % 3) * 12, team: i < 5 ? 0 : 1 }));
  const ball = { x: 128, y: 72, vx: 30, vy: 12 };
  const drawTv = (t: number) => {
    tvCtx.fillStyle = '#2e8b3e';
    tvCtx.fillRect(0, 0, 256, 144);
    for (let i = 0; i < 8; i++) {
      tvCtx.fillStyle = i % 2 ? '#2a8039' : '#33944a';
      tvCtx.fillRect(i * 32, 0, 32, 144);
    }
    tvCtx.strokeStyle = 'rgba(255,255,255,0.8)';
    tvCtx.lineWidth = 2;
    tvCtx.strokeRect(8, 8, 240, 128);
    tvCtx.beginPath();
    tvCtx.moveTo(128, 8);
    tvCtx.lineTo(128, 136);
    tvCtx.stroke();
    tvCtx.beginPath();
    tvCtx.arc(128, 72, 18, 0, Math.PI * 2);
    tvCtx.stroke();
    for (const p of players) {
      p.x += (ball.x - p.x) * 0.02 + Math.sin(t * 2 + p.y) * 0.6;
      p.y += (ball.y - p.y) * 0.01 + Math.cos(t * 1.7 + p.x) * 0.5;
      tvCtx.fillStyle = p.team ? '#ffffff' : '#d8473b';
      tvCtx.fillRect(p.x - 2, p.y - 4, 4, 8);
    }
    tvCtx.fillStyle = '#ffffff';
    tvCtx.beginPath();
    tvCtx.arc(ball.x, ball.y, 2.5, 0, Math.PI * 2);
    tvCtx.fill();
    tvCtx.fillStyle = 'rgba(0,0,0,0.6)';
    tvCtx.fillRect(6, 4, 128, 18);
    tvCtx.fillStyle = '#ffffff';
    tvCtx.font = '700 12px sans-serif';
    tvCtx.fillText(`ÜSKÜDAR 2 - 1 KADIKÖY  ${String(60 + (Math.floor(t / 4) % 30))}'`, 10, 17);
    tvTex.needsUpdate = true;
  };

  // -------------------------------------------------------------- the sea, Kız Kulesi, vapur, skyline, gulls
  const water = waterMaterial(sunDir);
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(3000, 2000, 120, 60), water);
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, -1.15, SEA_Z + 0.6 + 1000);
  sea.userData.noAO = true;
  scene.add(sea);
  const tower = kizKulesi();
  tower.position.set(-30, -1.1, 128);
  tower.rotation.y = 0.5;
  tower.scale.setScalar(1.2);
  scene.add(tower);
  const flag = tower.getObjectByName('flag');
  const ferry = vapur();
  ferry.position.set(-500, -1.1, 300);
  scene.add(ferry);
  // a second vapur calls at the Üsküdar pier every few minutes: comes in, waits, sounds the horn, leaves
  const pierObj = KAHVE_OBJECTS.find((o) => o.kind === 'pier');
  const DOCK = new THREE.Vector3(pierObj ? pierObj.x : 40, -1.1, (pierObj ? pierObj.z + pierObj.d / 2 : 38) + 4.6);
  const IN_FROM = new THREE.Vector3(-420, -1.1, 210);
  const IN_CTRL = new THREE.Vector3(DOCK.x - 140, -1.1, DOCK.z);
  const OUT_CTRL = new THREE.Vector3(DOCK.x + 140, -1.1, DOCK.z);
  const OUT_TO = new THREE.Vector3(540, -1.1, 230);
  const CYCLE = 170;
  const caller = vapur();
  scene.add(caller);
  let callerPhase = -1;
  const listener = new THREE.Vector2();
  const bez = (a: THREE.Vector3, c: THREE.Vector3, b: THREE.Vector3, s: number, out: THREE.Vector3) => {
    const u = 1 - s;
    return out.set(u * u * a.x + 2 * u * s * c.x + s * s * b.x, a.y, u * u * a.z + 2 * u * s * c.z + s * s * b.z);
  };
  const tmpA = new THREE.Vector3();
  const tmpB = new THREE.Vector3();
  const moveCaller = (a: THREE.Vector3, c: THREE.Vector3, b: THREE.Vector3, s: number) => {
    bez(a, c, b, s, caller.position);
    bez(a, c, b, Math.min(1, s + 0.01), tmpA);
    bez(a, c, b, Math.max(0, s - 0.01), tmpB);
    caller.rotation.y = Math.atan2(-(tmpA.z - tmpB.z), tmpA.x - tmpB.x);
  };
  const horn = () => vapurHorn(Math.max(0.12, 1 - Math.hypot(listener.x - DOCK.x, listener.y - DOCK.z) / 220));
  const skyline = new THREE.Mesh(
    new THREE.CylinderGeometry(820, 820, 112, 64, 1, true, -1.55, 2.2),
    new THREE.MeshBasicMaterial({ map: skylineTexture(), transparent: true, side: THREE.BackSide, fog: false, depthWrite: false }),
  );
  skyline.position.set(0, 40, 0);
  skyline.userData.noAO = true;
  scene.add(skyline);
  const gulls = Array.from({ length: low ? 4 : 10 }, (_, i) => {
    const g = gull();
    scene.add(g);
    return {
      g,
      cx: -30 + i * 9,
      cz: 40 + (i % 3) * 25,
      r: 8 + (i % 4) * 4,
      y: 7 + (i % 5) * 2.5,
      sp: 0.25 + (i % 3) * 0.08,
      ph: i * 1.7,
      dive: null as null | { t: number; from: THREE.Vector3; catchAt: THREE.Vector3; piece: THREE.Mesh; hand: THREE.Vector3; land: THREE.Vector3 },
    };
  });
  const crumbGeo = new THREE.TorusGeometry(0.05, 0.018, 5, 8, Math.PI);
  const crumbMat = new THREE.MeshStandardMaterial({ color: 0xb8752f, roughness: 0.7 });
  const DIVE = 1.8; // seconds: the piece flies for DIVE, the gull grabs it at 55 %
  const circlePos = (q: (typeof gulls)[number], at: number, out: THREE.Vector3) => {
    const a = at * q.sp + q.ph;
    return out.set(q.cx + Math.cos(a) * q.r, q.y + Math.sin(at * 0.7 + q.ph) * 0.6, q.cz + Math.sin(a) * q.r);
  };
  const piecePos = (d: NonNullable<(typeof gulls)[number]['dive']>, s: number, out: THREE.Vector3) =>
    out.lerpVectors(d.hand, d.land, s).setY(d.hand.y + (d.land.y - d.hand.y) * s + Math.sin(Math.PI * s) * 3);
  const tmpG = new THREE.Vector3();

  // parked cars from the Kenney kit
  const cars = KAHVE_OBJECTS.filter((o) => o.kind === 'car');
  void new GLTFLoader()
    .loadAsync(`${import.meta.env.BASE_URL}models/vehicle-truck-red.glb`)
    .then((g) => {
      cars.forEach((o, i) => {
        const m = g.scene.clone(true);
        const box = new THREE.Box3().setFromObject(m);
        const size = box.getSize(new THREE.Vector3());
        const s = o.w / Math.max(size.x, size.z);
        m.scale.setScalar(s);
        m.rotation.y = size.x >= size.z ? 0 : Math.PI / 2;
        m.position.set(o.x, 0, o.z);
        if (i % 2) m.rotation.y += Math.PI;
        m.traverse((c) => ((c as THREE.Mesh).castShadow = true));
        scene.add(m);
      });
    })
    .catch(() => {});

  let t = 0;
  let tvT = 0;
  return {
    tavlaBoards,
    follow(x, z) {
      listener.set(x, z);
      sky.position.set(x, 0, z);
      const sx = Math.round(x / 2) * 2;
      const sz = Math.round(z / 2) * 2;
      sun.target.position.set(sx, 0, sz);
      sun.position.set(sx + sunDir.x * 60, sunDir.y * 60, sz + sunDir.z * 60);
    },
    feedGulls(x, z) {
      const hand = new THREE.Vector3(x, 1.5, z);
      let best: (typeof gulls)[number] | null = null;
      let bestD = Infinity;
      for (const q of gulls) {
        const dd = q.dive ? Infinity : circlePos(q, t, tmpG).distanceTo(hand);
        if (dd < bestD) (best = q), (bestD = dd);
      }
      if (!best) return; // every gull is already busy with a piece
      const land = new THREE.Vector3(x + (Math.random() - 0.5) * 3, -1.1, Math.max(z, SEA_Z) + 6 + Math.random() * 3);
      const piece = new THREE.Mesh(crumbGeo, crumbMat);
      piece.position.copy(hand);
      scene.add(piece);
      const d = { t: 0, from: circlePos(best, t, new THREE.Vector3()), catchAt: new THREE.Vector3(), piece, hand, land };
      piecePos(d, 0.55, d.catchAt);
      best.dive = d;
    },
    update(dt) {
      t += dt;
      water.uniforms.uTime!.value = t;
      ferry.position.x += dt * 7;
      if (ferry.position.x > 700) ferry.position.x = -700;
      ferry.position.y = -1.1 + Math.sin(t * 0.8) * 0.08;
      {
        // start half-way through the approach so a fresh visitor sees it soon
        const ct = (t + 25) % CYCLE;
        const ease = (x: number) => 1 - (1 - x) * (1 - x);
        const phase = ct < 60 ? 0 : ct < 88 ? 1 : ct < 148 ? 2 : 3;
        caller.visible = phase !== 3;
        if (phase === 0) moveCaller(IN_FROM, IN_CTRL, DOCK, ease(ct / 60));
        else if (phase === 1) {
          caller.position.copy(DOCK);
          caller.rotation.y = 0;
        } else if (phase === 2) {
          const s = (ct - 88) / 60;
          moveCaller(DOCK, OUT_CTRL, OUT_TO, s * s);
        }
        caller.position.y = -1.1 + Math.sin(t * 0.9) * 0.06;
        if (callerPhase !== -1 && phase !== callerPhase && (phase === 1 || phase === 2)) horn();
        callerPhase = phase;
      }
      if (flag) flag.rotation.y = Math.sin(t * 2.3) * 0.25;
      for (const q of gulls) {
        const a = t * q.sp + q.ph;
        circlePos(q, t, q.g.position);
        q.g.rotation.y = -a;
        let flapSpeed = 7;
        const d = q.dive;
        if (d) {
          d.t += dt;
          const s = d.t / DIVE;
          if (s < 0.55) {
            // swoop down to where the piece will be
            const k = s / 0.55;
            const e = k * k * (3 - 2 * k);
            q.g.position.lerpVectors(d.from, d.catchAt, e);
            q.g.position.y += Math.sin(Math.PI * k) * 1.5;
            q.g.rotation.y = Math.atan2(-(d.catchAt.z - d.from.z), d.catchAt.x - d.from.x);
            piecePos(d, s, d.piece.position);
            d.piece.rotation.x += dt * 9;
            flapSpeed = 3;
          } else {
            // got it: carry it back up to the circle
            if (d.piece.parent) scene.remove(d.piece);
            const k = Math.min(1, (s - 0.55) / 0.45);
            q.g.position.lerpVectors(d.catchAt, q.g.position, k * k);
            flapSpeed = 11;
            if (k >= 1) q.dive = null;
          }
        }
        const flap = Math.sin(t * flapSpeed + q.ph) * 0.6;
        q.g.children[1]!.rotation.x = flap;
        q.g.children[2]!.rotation.x = -flap;
      }
      tvT += dt;
      if (tvT > 0.08) {
        ball.x += ball.vx * tvT;
        ball.y += ball.vy * tvT;
        if (ball.x < 14 || ball.x > 242) ball.vx *= -1;
        if (ball.y < 14 || ball.y > 130) ball.vy *= -1;
        if (Math.random() < 0.02) (ball.vx = (Math.random() - 0.5) * 80), (ball.vy = (Math.random() - 0.5) * 50);
        drawTv(t);
        tvT = 0;
      }
    },
  };
}

const IRONISH = 0x2a3036;
