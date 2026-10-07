import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
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
  REGULAR_SEATS,
  TAVLA_TABLES,
  TERRACE,
  seatPosition,
  vapurState,
  type TvBroadcast,
  type VapurPhase,
} from '@sokak/shared';
import { Builder, canvasTex, decal, hash, type Mover } from './world';
import { PAT, patternize } from './materials';
import { STEEL, LIGHT_OAK, TABLE_TOP, feltTexture, modernChair, modernOkeyTable, parasol, patioHeater, samovar, caydanlik, bentwoodChair } from './kahveProps';
import { vapurHorn } from './audio';
import { classicLamp, facadeWindow, gull, hillMosque, houseRow, iskele, kizKulesi, limb, parkBench, planeTree, simitCart, skylineTexture, vapur, waterMaterial } from './uskudarProps';
import type { Quality } from './postfx';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Foliage } from './foliage';
import { parkedCar } from './cars';
import { Pigeons } from './pigeons';
import { TvScreen } from './tvScreen';
import { tavlaTable } from './tavlaBoard';
import { marketFitout } from './marketProps';

/**
 * Static world of the okey mode: the modern kıraathane (hall + terrace), the
 * market next door, the street and the Üsküdar sahil with Kız Kulesi, plus the
 * animated bits (sea, vapur, gulls, flag, TVs). The sun follows the player so
 * shadows stay sharp near the camera.
 */
export interface KahveWorld {
  update(dt: number, movers?: readonly Mover[]): void;
  follow(x: number, z: number): void;
  /**
   * a piece of simit thrown from (x, z) towards the sea; the nearest gull dives for it.
   * `y` is the thrower's feet height (on the vapur's deck the piece goes over the side)
   */
  feedGulls(x: number, z: number, y?: number): void;
  /** the server clock (epoch ms) that drives the shared vapur timeline and the TV */
  setClock(clock: () => number): void;
  /** the derby on the shared TV (null = normal programme) */
  setTv(b: TvBroadcast | null): void;
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
      [23, 3.5, -7, 7],
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
  // a moulded cornice under the roof and a band between the floors
  b.box(cx, H + 7.05, 0.0, HALL.x1 - HALL.x0 + 2 * T + 0.3, 0.12, 0.6, 0xd8ccb8);
  b.box(cx, H + 7.17, 0.05, HALL.x1 - HALL.x0 + 2 * T + 0.5, 0.18, 0.7, 0xe6dccb);
  b.box(cx, H + 3.6, 0.0, HALL.x1 - HALL.x0 + 2 * T, 0.14, 0.5, 0xd8ccb8);
  for (let fl = 0; fl < 2; fl++)
    for (let x = HALL.x0 + 1.5; x < HALL.x1; x += 3) {
      const y = H + 1.3 + fl * 3.2;
      facadeWindow(b, x, y, 0.2, 1, 1.15, 1.5, hash(x * 3 + fl) > 0.62, fl === 1 && hash(x * 5) > 0.5 ? 0x3d6f8a : undefined);
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
  // polished stainless çay kazanları with brass taps (glossy 'cars' bucket = clearcoat)
  for (const x of [-7.6, -6.6]) {
    b.cyl(x, 1.06, -21.2, 0.24, 0.62, 0xc9ccd1, 20, 0.24, 'cars');
    b.cyl(x, 1.68, -21.2, 0.2, 0.08, 0x9a9da2, 20, 0.22, 'cars');
    b.add(new THREE.SphereGeometry(0.04, 8, 6), 0x2b2b2b, x, 1.79, -21.2);
    b.add(new THREE.CylinderGeometry(0.015, 0.015, 0.14, 6), 0xc9a24a, x, 1.25, -20.94, Math.PI / 2, 0, 0, 'cars');
    b.add(new THREE.CylinderGeometry(0.012, 0.012, 0.07, 6), 0xc9a24a, x, 1.2, -20.88, 0, 0, 0, 'cars');
    b.add(new THREE.BoxGeometry(0.1, 0.02, 0.03), 0x2b2b2b, x, 1.3, -20.88);
  }
  // hanging çay trays (askılı tepsi) on hooks behind the ocak
  for (const [k, x] of [-8.4, -8.0, 1.4, 1.8].entries()) {
    const y = 2.1;
    const z = HALL.z0 + 0.12;
    b.add(new THREE.CylinderGeometry(0.17, 0.17, 0.012, 18), k % 2 ? 0xd9dcdf : 0xc9a24a, x, y - 0.36, z + 0.17, Math.PI / 2 - 0.12, 0, 0, 'cars');
    for (const a of [-0.9, 0, 0.9]) b.add(new THREE.CylinderGeometry(0.004, 0.004, 0.36, 4), 0x9a9da2, x + Math.sin(a) * 0.08, y - 0.18, z + 0.08, 0.35, 0, a * 0.45, 'cars');
    b.add(new THREE.TorusGeometry(0.03, 0.006, 4, 10), 0x9a9da2, x, y, z + 0.03, 0, 0, 0, 'cars');
  }
  samovar(b, -5.2, 1.06, -21.3, 1.0);
  for (const x of [-3.8, -3.0, -2.2]) caydanlik(b, x, 1.06, -21.3);
  // rows of filled glasses on glossy saucers, waiting for the tray; sugar bowls
  for (let i = 0; i < 18; i++) {
    const x = -0.8 + (i % 6) * 0.17;
    const z = -20.8 - Math.floor(i / 6) * 0.17;
    b.cyl(x, 1.06, z, 0.05, 0.008, 0xffffff, 12, 0.05, 'varnish');
    b.add(new THREE.LatheGeometry([new THREE.Vector2(0.001, 0), new THREE.Vector2(0.018, 0), new THREE.Vector2(0.026, 0.02), new THREE.Vector2(0.02, 0.05), new THREE.Vector2(0.028, 0.085)], 10), 0x8e1f0b, x, 1.07, z, 0, 0, 0, 'cars');
  }
  for (const x of [0.4, -4.6]) {
    b.add(new THREE.LatheGeometry([new THREE.Vector2(0.001, 0), new THREE.Vector2(0.04, 0), new THREE.Vector2(0.06, 0.05), new THREE.Vector2(0.055, 0.08)], 12), 0xd9dcdf, x, 1.06, -20.7, 0, 0, 0, 'cars');
    b.cyl(x, 1.13, -20.7, 0.05, 0.012, 0xffffff, 10);
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
  // playable tavla tables in the lounge; the regulars' chairs along the side walls
  for (let i = 0; i < TAVLA_TABLES.length; i++) tavlaTable(b, i);
  for (const r of REGULAR_SEATS) bentwoodChair(b, r.x + Math.sin(r.yaw) * 0.06, r.z + Math.cos(r.yaw) * 0.06, r.yaw);
  // big plants
  const plants = new Foliage(low ? 0.6 : 1);
  for (const o of KAHVE_OBJECTS) {
    if (o.kind !== 'planter') continue;
    const outdoor = o.z > 18;
    if (outdoor) continue;
    // fibre-clay pot with a rim and soil; a ficus with two stems and leafy clumps
    b.pat = PAT.plaster;
    b.add(new THREE.CylinderGeometry(o.w / 2, o.w / 2.5, o.h, 20), 0x3a3c40, o.x, o.h / 2, o.z);
    b.add(new THREE.TorusGeometry(o.w / 2 - 0.02, 0.03, 6, 20), 0x34363a, o.x, o.h, o.z, Math.PI / 2, 0, 0);
    b.pat = PAT.grass;
    b.cyl(o.x, o.h - 0.06, o.z, o.w / 2 - 0.04, 0.03, 0x3b2c20, 16);
    b.pat = PAT.none;
    const top = o.h + 1.6;
    for (const [dx, dz, h] of [
      [0.08, 0.02, 1],
      [-0.07, -0.05, 0.82],
    ] as const) {
      const a = new THREE.Vector3(o.x + dx * 0.5, o.h - 0.05, o.z + dz * 0.5);
      const e = new THREE.Vector3(o.x + dx * 3, o.h + (top - o.h) * h, o.z + dz * 3);
      limb(b, a, e, 0.035, 0.018, 0x6b5a45);
    }
    for (let k = 0; k < 4; k++) {
      const a = k * 2.2 + o.x;
      const y = o.h + 0.75 + k * 0.32;
      const r = 0.32 + (k === 3 ? 0.08 : 0.12);
      plants.crown(o.x + Math.sin(a) * 0.14, y, o.z + Math.cos(a) * 0.14, r, r * 0.8, r, 42, 0.5);
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
  // the shop's fit-out: gondolas with stock, coolers, counter, cigarette cabinet, freezer, crates
  marketFitout(b, M, KAHVE_OBJECTS, glassPanes);

  // -------------------------------------------------------------- neighbours, hill, mosque
  houseRow(b, -KAHVE_HALF, HALL.x0 - T, TERRACE.z1 + 0.1, 1, 3, 1);
  houseRow(b, M.x1, KAHVE_HALF, TERRACE.z1 + 0.1, 1, 5, 1);
  houseRow(b, -80, 70, -32, 1, 7, 2, true);
  b.pat = PAT.grass;
  b.add(new THREE.SphereGeometry(80, 24, 8, 0, Math.PI * 2, 0, Math.PI / 2), 0x6f7d4a, 0, -52, -120);
  b.pat = PAT.none;
  hillMosque(b, -20, 18, -75, 1.0);
  houseRow(b, -110, 90, -55, 1, 9, 2, true);

  // -------------------------------------------------------------- street & sahil furniture
  const trees = new Foliage(low ? 0.6 : 1);
  for (const o of KAHVE_OBJECTS) {
    if (o.kind === 'lamp') classicLamp(b, o.x, o.z);
    else if (o.kind === 'planter' && o.z > 18) planeTree(b, o.x, o.z, 1, trees);
    else if (o.kind === 'bench') parkBench(b, o.x, o.z, 1);
    else if (o.kind === 'cart') simitCart(b, o.x, o.z, glassPanes);
    else if (o.kind === 'car') parkedCar(b, o.x, o.z, o.tint! % 2 ? Math.PI : 0, o.tint ?? 0);
    else if (o.kind === 'pier') iskele(b, o.x - o.w / 2, o.x + o.w / 2, o.z - o.d / 2, o.z + o.d / 2);
    else if (o.kind === 'lowTable') {
      // low wooden çay bahçesi table: top, apron, four legs; two glasses and a sugar bowl
      b.pat = PAT.grainX;
      b.box(o.x, 0.4, o.z, o.w, 0.04, o.d, 0x8a5a33, 'varnish');
      b.box(o.x, 0.34, o.z, o.w - 0.1, 0.06, o.d - 0.1, 0x6e4628, 'varnish');
      b.pat = PAT.none;
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(o.x + sx * (o.w / 2 - 0.07), 0, o.z + sz * (o.d / 2 - 0.07), 0.05, 0.4, 0.05, 0x5a3a28);
      for (const dx of [-0.16, 0.16]) {
        b.cyl(o.x + dx, 0.44, o.z + 0.08, 0.05, 0.008, 0xffffff, 12, 0.05, 'varnish');
        b.add(new THREE.LatheGeometry([new THREE.Vector2(0.001, 0), new THREE.Vector2(0.018, 0), new THREE.Vector2(0.026, 0.02), new THREE.Vector2(0.02, 0.05), new THREE.Vector2(0.028, 0.085)], 10), 0x8e1f0b, o.x + dx, 0.45, o.z + 0.08, 0, 0, 0, 'cars');
      }
      b.add(new THREE.LatheGeometry([new THREE.Vector2(0.001, 0), new THREE.Vector2(0.04, 0), new THREE.Vector2(0.06, 0.05), new THREE.Vector2(0.055, 0.08)], 12), 0xd9dcdf, o.x, 0.44, o.z - 0.12, 0, 0, 0, 'cars');
    } else if (o.kind === 'stool') {
      // hasır tabure: four turned legs, stretchers and a woven straw seat
      const W = 0.34;
      for (const sx of [-1, 1])
        for (const sz of [-1, 1]) b.add(new THREE.CylinderGeometry(0.017, 0.02, 0.32, 6), 0x6e4628, o.x + sx * (W / 2 - 0.03), 0.16, o.z + sz * (W / 2 - 0.03), sz * 0.06, 0, -sx * 0.06, 'varnish');
      for (const s of [-1, 1]) {
        b.box(o.x, 0.1, o.z + s * (W / 2 - 0.03), W - 0.06, 0.02, 0.02, 0x6e4628, 'varnish');
        b.box(o.x + s * (W / 2 - 0.03), 0.1, o.z, 0.02, 0.02, W - 0.06, 0x6e4628, 'varnish');
      }
      b.box(o.x, 0.29, o.z, W, 0.03, W, 0x6e4628, 'varnish');
      b.pat = PAT.fabric;
      b.box(o.x, 0.3, o.z, W - 0.05, 0.03, W - 0.05, [0xc9a35a, 0xb8914a, 0xd2b06a][Math.abs(Math.round(o.x * 7)) % 3]!);
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
  addMesh(b.build('detail'), mainMat, false, true);
  addMesh(b.build('ground'), groundMat, false, true);
  addMesh(b.build('foliage'), foliageMat, true, true);
  if (!trees.empty) scene.add(trees.build('plane'));
  if (!plants.empty) scene.add(plants.build('small'));
  addMesh(b.build('glow'), glowMat, false, false);
  // car paint: glossy clearcoat over the vertex colour (windows are dark paint here too)
  addMesh(b.build('cars'), new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.32, metalness: 0.25, clearcoat: 1, clearcoatRoughness: 0.08 }), true, true);
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
  // the shop sign: a lit box sign, white letters on green; small signs inside
  const shopSign = canvasTex(1024, 160, (ctx) => {
    ctx.fillStyle = '#1e7a46';
    ctx.fillRect(0, 0, 1024, 160);
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '800 112px "Baloo 2", sans-serif';
    ctx.fillText('HASAN MARKET', 512, 88);
  });
  glowDecal(shopSign, (M.x0 + M.x1) / 2, 3.6, 0.2, 5.6, 0.82).material.color.setScalar(0.62);
  const smallSign = (text: string, bg: string, fg: string, w = 512, h = 128) =>
    canvasTex(w, h, (ctx) => {
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = fg;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `800 ${Math.floor(h * 0.5)}px "Baloo 2", sans-serif`;
      ctx.fillText(text, w / 2, h * 0.55);
    });
  const fz = KAHVE_OBJECTS.find((o) => o.kind === 'freezer');
  if (fz) decal(scene, smallSign('DONDURMA', '#2f6fb0', '#ffffff'), fz.x + fz.w / 2 - 0.075, fz.h + 0.66, fz.z, 0.58, 0.3, Math.PI / 2);
  const mc = KAHVE_OBJECTS.find((o) => o.kind === 'marketCounter');
  if (mc) decal(scene, smallSign('18 YAŞ ALTINA TÜTÜN SATILMAZ', '#ffffff', '#c0262d', 1024, 96), mc.x, 2.62, mc.z - 1.55 - 0.31, 1.6, 0.15);
  // "SİMİT" on both long sides of the simitçi's cart
  const cart = KAHVE_OBJECTS.find((o) => o.kind === 'cart');
  if (cart) {
    const simitSign = canvasTex(1024, 128, (ctx) => {
      ctx.fillStyle = '#f3eee4';
      ctx.fillRect(0, 0, 1024, 128);
      ctx.fillStyle = '#b3261e';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '800 100px "Baloo 2", sans-serif';
      ctx.fillText('SİMİT · POĞAÇA', 512, 70);
    });
    for (const s of [-1, 1]) decal(scene, simitSign, cart.x, 0.845, cart.z + s * 0.369, 1.04, 0.13, s > 0 ? 0 : Math.PI);
  }
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
    decal(scene, board('ÜSKÜDAR', 'VAPUR İSKELESİ'), px0 - 0.17, 4.35, pier.z, 5.2, 0.97, -Math.PI / 2);
    decal(scene, board('ÜSKÜDAR', 'KARAKÖY · EMİNÖNÜ · BEŞİKTAŞ'), pier.x, 4.3, pz0 - 0.17, 5.4, 1.0, Math.PI);
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
    // the clock sits on the roof lantern, facing the promenade
    decal(scene, clock, pier.x - 0.62, 8.25, pier.z, 0.72, 0.72, -Math.PI / 2);
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

  // -------------------------------------------------------------- TVs (one shared canvas)
  const tvScreen = new TvScreen();
  const bezelMat = new THREE.MeshStandardMaterial({ color: 0x0b0b0d, roughness: 0.32, metalness: 0.5 });
  const screenMat = new THREE.MeshBasicMaterial({ map: tvScreen.texture, toneMapped: false });
  for (const o of KAHVE_OBJECTS) {
    if (o.kind !== 'tv') continue;
    const side = o.w < o.d;
    const width = side ? o.d : o.w;
    // face into the hall: side-wall sets face the middle, the back-wall one faces the door
    const yaw = side ? (o.x < (HALL.x0 + HALL.x1) / 2 ? Math.PI / 2 : -Math.PI / 2) : o.z < (HALL.z0 + HALL.z1) / 2 ? 0 : Math.PI;
    const g = new THREE.Group();
    g.position.set(o.x, o.y + o.h / 2, o.z);
    g.rotation.y = yaw;
    // slim bezel (a thin dark frame round a 6 cm deep panel); the screen sits just in front
    const bezel = new THREE.Mesh(new THREE.BoxGeometry(width, o.h, 0.05), bezelMat);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(width - 0.05, o.h - 0.05), screenMat);
    screen.position.z = 0.027;
    screen.userData.noAO = true;
    g.add(bezel, screen);
    if (width > 2.6) {
      // the big one gets a soundbar under it
      const bar = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.08, 0.1), bezelMat);
      bar.position.set(0, -o.h / 2 - 0.12, 0.04);
      g.add(bar);
    }
    scene.add(g);
  }
  const tvVisible = { v: true };

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
  // the vapur that calls at the Üsküdar pier and takes riders round Kız Kulesi: its pose comes
  // from the shared timeline at server time, so it is where the server (and everybody) has it
  const caller = vapur();
  caller.name = 'vapur-caller';
  scene.add(caller);
  let clock = () => Date.now();
  let callerPhase: VapurPhase | null = null;
  const listener = new THREE.Vector2();
  const horn = () => vapurHorn(Math.max(0.12, 1 - Math.hypot(listener.x - caller.position.x, listener.y - caller.position.z) / 220));
  const placeCaller = () => {
    const v = vapurState(clock());
    caller.position.set(v.x, v.y, v.z);
    caller.rotation.y = v.yaw;
    // the horn when it casts off and when it comes alongside again
    if (callerPhase !== null && v.phase !== callerPhase && (v.phase === 'leaving' || v.phase === 'docked')) horn();
    callerPhase = v.phase;
  };
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
      /** every other gull follows the vapur (circling a point astern of where it was a moment ago) */
      follow: i % 2 === 0 ? { back: 12 + (i % 3) * 7, side: (i % 4 === 0 ? 1 : -1) * (3 + i * 0.6), lag: 1500 + i * 300 } : null,
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

  // pigeons pecking behind the benches, between the strollers' lanes (z 24.8 / 29.8)
  const pigeonHomes: THREE.Vector3[] = [];
  for (const [cx, n] of [
    [8, low ? 4 : 7],
    [-16, low ? 3 : 5],
    [-28, low ? 2 : 4],
  ] as const)
    for (let i = 0; i < n; i++) pigeonHomes.push(new THREE.Vector3(cx + (hash(i * 3 + cx) - 0.5) * 5, 0.02, PROMENADE.z0 + 8.7 + (hash(i * 5 + cx) - 0.5) * 0.6));
  const pigeons = new Pigeons(scene, pigeonHomes);

  let t = 0;
  return {
    follow(x, z) {
      listener.set(x, z);
      // the TVs are only seen from inside the hall or through the storefront
      tvVisible.v = x > HALL.x0 - 6 && x < HALL.x1 + 6 && z < TERRACE.z1 + 4;
      sky.position.set(x, 0, z);
      const sx = Math.round(x / 2) * 2;
      const sz = Math.round(z / 2) * 2;
      sun.target.position.set(sx, 0, sz);
      sun.position.set(sx + sunDir.x * 60, sunDir.y * 60, sz + sunDir.z * 60);
    },
    setClock(c) {
      clock = c;
    },
    setTv(b) {
      tvScreen.setBroadcast(b);
    },
    feedGulls(x, z, y = 0) {
      const hand = new THREE.Vector3(x, y + 1.5, z);
      let best: (typeof gulls)[number] | null = null;
      let bestD = Infinity;
      for (const q of gulls) {
        const dd = q.dive ? Infinity : circlePos(q, t, tmpG).distanceTo(hand);
        if (dd < bestD) (best = q), (bestD = dd);
      }
      if (!best) return; // every gull is already busy with a piece
      let land = new THREE.Vector3(x + (Math.random() - 0.5) * 3, -1.1, Math.max(z, SEA_Z) + 6 + Math.random() * 3);
      if (y > 1) {
        // from the deck: over the side the thrower stands on (astern from the middle of the stern deck)
        const yaw = caller.rotation.y;
        const lz = (x - caller.position.x) * Math.sin(yaw) + (z - caller.position.z) * Math.cos(yaw);
        const out = Math.abs(lz) > 1.5 ? { x: Math.sin(yaw) * Math.sign(lz), z: Math.cos(yaw) * Math.sign(lz) } : { x: -Math.cos(yaw), z: Math.sin(yaw) };
        const d = 6 + Math.random() * 3;
        land = new THREE.Vector3(x + out.x * d, -1.1, z + out.z * d);
      }
      const piece = new THREE.Mesh(crumbGeo, crumbMat);
      piece.position.copy(hand);
      scene.add(piece);
      const d = { t: 0, from: circlePos(best, t, new THREE.Vector3()), catchAt: new THREE.Vector3(), piece, hand, land };
      piecePos(d, 0.55, d.catchAt);
      best.dive = d;
    },
    update(dt, movers = []) {
      pigeons.update(dt, movers);
      t += dt;
      water.uniforms.uTime!.value = t;
      ferry.position.x += dt * 7;
      if (ferry.position.x > 700) ferry.position.x = -700;
      ferry.position.y = -1.1 + Math.sin(t * 0.8) * 0.08;
      placeCaller();
      if (flag) flag.rotation.y = Math.sin(t * 2.3) * 0.25;
      const now = clock();
      for (const q of gulls) {
        if (q.follow) {
          // circle over the water a little astern of where the vapur was `lag` ms ago
          const v = vapurState(now - q.follow.lag);
          const c = Math.cos(v.yaw);
          const s = Math.sin(v.yaw);
          q.cx = v.x - q.follow.back * c + q.follow.side * s;
          q.cz = v.z + q.follow.back * s + q.follow.side * c;
        }
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
      tvScreen.update(dt, now, tvVisible.v);
    },
  };
}

const IRONISH = 0x2a3036;
