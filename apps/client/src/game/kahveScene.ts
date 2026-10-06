import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { CAYCI_SPOT, KAHVE_HALF_X, KAHVE_HALF_Z, KAHVE_OBJECTS, TABLES, seatPosition, type TableView } from '@sokak/shared';
import type { OkeyCtx } from '@sokak/okey';
import { Builder, canvasTex, decal, sign, type Mover, type World } from './world';
import { PAT, patternize } from './materials';
import { Character } from './character';
import {
  Frame,
  OAK,
  RACK_DIST,
  TABLE_TOP,
  WALNUT,
  bentwoodChair,
  calendarTexture,
  caydanlik,
  ciniTexture,
  feltTexture,
  karoTextures,
  laceTexture,
  menuTexture,
  okeyTable,
  photoTexture,
  samovar,
  streetTexture,
} from './kahveProps';
import { TILE_H, TILE_T, TILE_W, TileField, cellOf, setAtlasOkey } from './okeyTiles';
import { initialQuality } from './postfx';

/**
 * The kıraathane interior: cement-tile floor, walnut wainscot under sage
 * plaster, south windows with lace café curtains and the street outside,
 * evening sun falling through them, the çay ocağı with çini, semaver and
 * çaydanlık, bentwood chairs around felt okey tables with real tiles, regulars
 * playing tavla and reading the paper, and Çaycı Rıza walking the orders.
 */
export interface MeldAnchor {
  id: number;
  corners: THREE.Vector3[];
}

export interface TableAnchors {
  deck: THREE.Vector3;
  gosterge: THREE.Vector3;
  /** top of every seat's discard pile */
  piles: THREE.Vector3[];
  melds: MeldAnchor[];
}

export interface KahveScene extends World {
  /** waiter brings `item` to a world position; drink stays on the table */
  serve(item: string, to: THREE.Vector3, onTable: { x: number; z: number } | null): void;
  /** public table state (null = no game); viewerSeat hides that rack and orients the tiles */
  setTable(table: number, view: TableView | null, viewerSeat: number | null): void;
  anchors(table: number): TableAnchors | null;
  /** camera pose for playing at a seat */
  seatView(table: number, seat: number, aspect: number, bottomNdc: number): { pos: THREE.Vector3; target: THREE.Vector3; fov: number };
}

// ------------------------------------------------------------------ drinks
function teaGlass(): THREE.Group {
  const g = new THREE.Group();
  const glass = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.05, transparent: true, opacity: 0.35 });
  const tea = new THREE.MeshStandardMaterial({ color: 0x9b2a14, roughness: 0.15 });
  const saucer = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.01, 18), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.25 }));
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.004, 4, 18), new THREE.MeshStandardMaterial({ color: 0xc9a24a, metalness: 0.6, roughness: 0.3 }));
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.006;
  // tulip glass
  const body = new THREE.Mesh(
    new THREE.LatheGeometry([new THREE.Vector2(0.018, 0), new THREE.Vector2(0.026, 0.02), new THREE.Vector2(0.02, 0.05), new THREE.Vector2(0.028, 0.085), new THREE.Vector2(0.03, 0.09)], 14),
    glass,
  );
  body.position.y = 0.006;
  const liquid = new THREE.Mesh(new THREE.LatheGeometry([new THREE.Vector2(0.0, 0.002), new THREE.Vector2(0.017, 0.002), new THREE.Vector2(0.024, 0.02), new THREE.Vector2(0.018, 0.05), new THREE.Vector2(0.024, 0.075), new THREE.Vector2(0, 0.075)], 12), tea);
  liquid.position.y = 0.006;
  g.add(saucer, rim, liquid, body);
  return g;
}

function drinkModel(item: string): THREE.Group {
  const mat = (c: number, r = 0.4) => new THREE.MeshStandardMaterial({ color: c, roughness: r });
  if (item === 'cay') return teaGlass();
  const g = new THREE.Group();
  if (item === 'oralet') {
    const t = teaGlass();
    ((t.children[2] as THREE.Mesh).material as THREE.MeshStandardMaterial).color.setHex(0xf28c1c);
    return t;
  }
  if (item === 'kahve') {
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.06, 0.012, 18), mat(0xffffff, 0.3)));
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.03, 0.06, 16), mat(0xffffff, 0.25));
    cup.position.y = 0.036;
    const coffee = new THREE.Mesh(new THREE.CircleGeometry(0.032, 16), mat(0x3b2412, 0.6));
    coffee.rotation.x = -Math.PI / 2;
    coffee.position.y = 0.066;
    const loukoum = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.02, 0.025), mat(0xf7c6d9, 0.8));
    loukoum.position.set(0.05, 0.016, 0.03);
    g.add(cup, coffee, loukoum);
  } else if (item === 'gazoz') {
    const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.16, 12), new THREE.MeshPhysicalMaterial({ color: 0x8fd18a, roughness: 0.1, transparent: true, opacity: 0.8 }));
    bottle.position.y = 0.08;
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.03, 0.06, 10), bottle.material);
    neck.position.y = 0.19;
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.012, 10), mat(0xd8473b, 0.3));
    cap.position.y = 0.225;
    g.add(bottle, neck, cap);
  } else if (item === 'ayran') {
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.034, 0.11, 14), mat(0xfafafa, 0.5));
    cup.position.y = 0.055;
    const foam = new THREE.Mesh(new THREE.CircleGeometry(0.038, 14), mat(0xffffff, 0.9));
    foam.rotation.x = -Math.PI / 2;
    foam.position.y = 0.111;
    g.add(cup, foam);
  } else if (item === 'simit') {
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.012, 20), mat(0xffffff, 0.3)));
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.025, 8, 20), mat(0xb8752f, 0.7));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.03;
    g.add(ring);
  } else {
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.012, 20), mat(0xffffff, 0.3)));
    for (const s of [-1, 1]) {
      const half = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.03, 0.09), mat(0xd9a058, 0.8));
      half.position.set(s * 0.05, 0.025, 0);
      half.rotation.y = s * 0.4;
      g.add(half);
    }
  }
  return g;
}

interface Delivery {
  item: string;
  to: THREE.Vector3;
  onTable: { x: number; z: number } | null;
}

// ------------------------------------------------------------------ table tile layout
/** seat-frame (table centre, seat yaw) → world */
function tablePoint(table: number, yaw: number, lx: number, ly: number, lz: number, out = new THREE.Vector3()): THREE.Vector3 {
  const c = TABLES[table]!;
  const cs = Math.cos(yaw);
  const sn = Math.sin(yaw);
  return out.set(c.x + lx * cs + lz * sn, ly, c.z - lx * sn + lz * cs);
}
const seatYaw = (s: number) => (s * Math.PI) / 2;
const FELT_Y = TABLE_TOP + 0.003;
const LEAN = 0.26;

export function buildKahve(scene: THREE.Scene, renderer: THREE.WebGLRenderer): KahveScene {
  const quality = initialQuality();
  const low = quality === 'low';
  scene.background = new THREE.Color(0x24170e);
  scene.fog = new THREE.Fog(0x24170e, 34, 70);
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.32;
  pm.dispose();
  scene.add(new THREE.HemisphereLight(0xffe2b8, 0x4a2e1c, low ? 1.05 : 0.62));

  // low evening sun through the south windows (the wall casts, the panes let it in)
  const sun = new THREE.DirectionalLight(0xffb36b, low ? 1.6 : 2.6);
  sun.position.set(-9, 8.5, 22);
  sun.target.position.set(-1, 0, 2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(low ? 1024 : 2048, low ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -17, right: 17, top: 15, bottom: -15, near: 2, far: 60 });
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.025;
  scene.add(sun, sun.target);

  // warm pools over the tables (no shadows)
  if (!low) {
    for (const [x, z, i] of [
      [-8, 1.2, 7],
      [0, 1.2, 7],
      [8, 1.2, 7],
      [1, -5.6, 3.5],
    ] as const) {
      const l = new THREE.PointLight(0xffc27a, i, 10, 1.6);
      l.position.set(x, 3.0, z);
      scene.add(l);
    }
  }

  const b = new Builder();
  const W = KAHVE_HALF_X;
  const D = KAHVE_HALF_Z;
  const H = 4;

  // -------------------------------------------------------------- floor
  const karo = karoTextures();
  karo.map.repeat.set((W * 2) / 1.2, (D * 2) / 1.2);
  karo.bump.repeat.copy(karo.map.repeat);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(W * 2, D * 2),
    new THREE.MeshStandardMaterial({ map: karo.map, bumpMap: karo.bump, bumpScale: 1.2, roughness: 0.42, metalness: 0, color: 0xd6cbbb }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  // kilim rugs in the tavla corners and by the benches
  const kilim = canvasTex(256, 384, (ctx) => {
    ctx.fillStyle = '#8f2f2a';
    ctx.fillRect(0, 0, 256, 384);
    ctx.fillStyle = '#e9c46a';
    ctx.fillRect(14, 14, 228, 356);
    ctx.fillStyle = '#7a2420';
    ctx.fillRect(24, 24, 208, 336);
    for (let i = 0; i < 4; i++) {
      const y = 70 + i * 82;
      ctx.fillStyle = i % 2 ? '#2f5d73' : '#e9c46a';
      ctx.beginPath();
      ctx.moveTo(128, y - 34);
      ctx.lineTo(190, y);
      ctx.lineTo(128, y + 34);
      ctx.lineTo(66, y);
      ctx.fill();
      ctx.fillStyle = '#f4ead2';
      ctx.beginPath();
      ctx.moveTo(128, y - 12);
      ctx.lineTo(150, y);
      ctx.lineTo(128, y + 12);
      ctx.lineTo(106, y);
      ctx.fill();
    }
  });
  for (const [x, z, r] of [
    [-10.5, -7.5, 0],
    [10.5, -7.5, 0],
    [0, 1.2, Math.PI / 2],
  ] as const)
    decal(scene, kilim, x, 0.006, z, r ? 4.2 : 2.4, r ? 2.6 : 3.4, r, true);

  // -------------------------------------------------------------- walls
  // walnut wainscot with raised panels, sage plaster, picture rail, crown
  const wainscot = (x0: number, x1: number, z: number, nz: number, ry: number) => {
    // a wall running along x (ry=0) or z (ry=π/2) at constant z (or x)
    const len = x1 - x0;
    const along = (t: number) => x0 + t;
    const put = (t: number, y: number, w: number, h: number, d: number, color: number, off: number) => {
      const p = along(t);
      if (ry === 0) b.box(p, y, z + nz * off, w, h, d, color);
      else b.box(z + nz * off, y, p, d, h, w, color);
    };
    b.pat = PAT.wood;
    put(len / 2, 0, len, 1.15, 0.04, 0x5a3418, 0.02);
    for (let t = 0.6; t < len - 0.3; t += 1.1) {
      put(t, 0.2, 0.86, 0.78, 0.03, 0x6e4124, 0.05);
      put(t, 0.26, 0.7, 0.66, 0.02, 0x5e371c, 0.07);
    }
    b.pat = PAT.none;
    put(len / 2, 1.12, len, 0.07, 0.07, 0x3e2412, 0.05);
    put(len / 2, 0, len, 0.12, 0.06, 0x3e2412, 0.05);
    put(len / 2, 2.95, len, 0.05, 0.05, 0x5a3418, 0.04);
    put(len / 2, H - 0.16, len, 0.16, 0.1, 0xe9dcc0, 0.05);
  };
  b.bucket = 'cars'; // interior walls: receive, do not cast
  const plaster = (x: number, z: number, w: number, d: number) => {
    b.pat = PAT.plaster;
    b.box(x, 0, z, w, H, d, 0x93ae98);
    b.pat = PAT.none;
  };
  plaster(0, -D - 0.25, W * 2 + 1, 0.5);
  plaster(-W - 0.25, 0, 0.5, D * 2);
  plaster(W + 0.25, 0, 0.5, D * 2);
  wainscot(-W, W, -D, 1, 0);
  wainscot(-D, D, -W, 1, Math.PI / 2);
  wainscot(-D, D, W, -1, Math.PI / 2);
  // ceiling boards + beams
  b.pat = PAT.wood;
  b.box(0, H, 0, W * 2 + 1, 0.12, D * 2 + 1, 0x6a4426);
  for (let x = -W + 2; x < W; x += 4) b.box(x, H - 0.24, 0, 0.24, 0.24, D * 2, 0x3e2412);
  b.pat = PAT.none;

  // south wall with real window openings (casts shadows so the sun comes in through the panes)
  b.bucket = 'main';
  const WIN = [-10, -6.5, -3, 3, 6.5, 10];
  const WIN_W = 1.9;
  const SILL = 0.85;
  const HEAD = 3.05;
  const DOOR_W = 2.4;
  const southZ = D + 0.25;
  const openings = [...WIN.map((x) => ({ x, w: WIN_W, bottom: SILL, top: HEAD })), { x: 0, w: DOOR_W, bottom: 0, top: 2.75 }].sort((a, b2) => a.x - b2.x);
  let cursor = -W - 0.5;
  b.pat = PAT.plaster;
  for (const o of openings) {
    const x0 = o.x - o.w / 2;
    if (x0 > cursor) b.box((cursor + x0) / 2, 0, southZ, x0 - cursor, H, 0.5, 0x93ae98);
    if (o.bottom > 0) b.box(o.x, 0, southZ, o.w, o.bottom, 0.5, 0x93ae98);
    b.box(o.x, o.top, southZ, o.w, H - o.top, 0.5, 0x93ae98);
    cursor = o.x + o.w / 2;
  }
  b.box((cursor + W + 0.5) / 2, 0, southZ, W + 0.5 - cursor, H, 0.5, 0x93ae98);
  b.pat = PAT.none;
  wainscotSouth();
  function wainscotSouth() {
    // wainscot pieces between the openings
    b.pat = PAT.wood;
    let c = -W;
    for (const o of openings) {
      const x0 = o.x - o.w / 2;
      if (x0 > c + 0.05) b.box((c + x0) / 2, 0, D - 0.02, x0 - c, 1.15, 0.04, 0x5a3418);
      if (o.bottom > 0) b.box(o.x, 0, D - 0.02, o.w, o.bottom, 0.04, 0x5a3418);
      c = o.x + o.w / 2;
    }
    b.box((c + W) / 2, 0, D - 0.02, W - c, 1.15, 0.04, 0x5a3418);
    b.pat = PAT.none;
  }
  // window frames, muntins and sills
  for (const x of WIN) {
    const z = D;
    b.pat = PAT.wood;
    b.box(x, SILL - 0.05, z - 0.08, WIN_W + 0.2, 0.06, 0.24, 0x5a3418);
    b.pat = PAT.none;
    for (const dx of [-WIN_W / 2, 0, WIN_W / 2]) b.box(x + dx, SILL, z + 0.05, dx === 0 ? 0.05 : 0.08, HEAD - SILL, 0.08, 0xe9e2d0);
    for (const y of [SILL, 1.95, HEAD - 0.06]) b.box(x, y, z + 0.05, WIN_W, y === SILL ? 0.06 : 0.05, 0.08, 0xe9e2d0);
    for (const dx of [-WIN_W / 4, WIN_W / 4]) b.box(x + dx, 1.95, z + 0.05, 0.03, HEAD - 1.95, 0.05, 0xe9e2d0);
    b.box(x, 2.45, z + 0.05, WIN_W, 0.03, 0.05, 0xe9e2d0);
    // curtain rod
    b.add(new THREE.CylinderGeometry(0.012, 0.012, WIN_W + 0.1, 6), 0xc9a24a, x, 1.92, z - 0.06, 0, 0, Math.PI / 2);
  }
  // double door with glazed upper panels
  b.pat = PAT.wood;
  for (const s of [-1, 1]) {
    const x = s * 0.6;
    b.box(x, 0, D + 0.08, 1.15, 1.2, 0.07, 0x5e371c);
    b.box(x + s * 0.53, 1.2, D + 0.08, 0.09, 1.5, 0.07, 0x5e371c);
    b.box(x - s * 0.53, 1.2, D + 0.08, 0.09, 1.5, 0.07, 0x5e371c);
    b.box(x, 2.62, D + 0.08, 1.15, 0.12, 0.07, 0x5e371c);
    b.box(x, 1.9, D + 0.08, 1.0, 0.04, 0.05, 0x5e371c);
    b.add(new THREE.CylinderGeometry(0.014, 0.014, 0.3, 6), 0xc9a24a, x - s * 0.42, 1.1, D + 0.02, 0, 0, 0);
  }
  b.pat = PAT.none;
  b.box(0, 2.72, D + 0.02, DOOR_W + 0.2, 0.1, 0.12, 0x3e2412);

  // the street outside (seen through windows and the door)
  const street = new THREE.Mesh(new THREE.PlaneGeometry(40, 10), new THREE.MeshBasicMaterial({ map: streetTexture(), fog: false }));
  street.position.set(0, 3.0, D + 6);
  street.rotation.y = Math.PI;
  scene.add(street);
  const pave = new THREE.Mesh(new THREE.PlaneGeometry(40, 6), new THREE.MeshStandardMaterial({ color: 0x8a7e72, roughness: 0.9 }));
  pave.rotation.x = -Math.PI / 2;
  pave.position.set(0, -0.02, D + 3);
  pave.receiveShadow = true;
  scene.add(pave);
  // lace café curtains on the lower half of each window
  const lace = laceTexture();
  lace.wrapS = THREE.RepeatWrapping;
  lace.repeat.set(4, 1);
  const laceMat = new THREE.MeshStandardMaterial({ map: lace, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.9 });
  for (const x of WIN) {
    const c = new THREE.Mesh(new THREE.PlaneGeometry(WIN_W, 1.05), laceMat);
    c.position.set(x, 1.38, D - 0.07);
    scene.add(c);
  }
  // window glass gets the house name, written to be read from the street
  const glassSign = canvasTex(512, 128, (ctx) => {
    ctx.clearRect(0, 0, 512, 128);
    ctx.translate(512, 0);
    ctx.scale(-1, 1);
    ctx.fillStyle = 'rgba(240,200,90,0.85)';
    ctx.font = '800 64px "Baloo 2", serif';
    ctx.textAlign = 'center';
    ctx.fillText('KIRAATHANE', 256, 84);
  });
  for (const x of [-3, 3]) decal(scene, glassSign, x, 2.65, D + 0.02, 1.6, 0.4, Math.PI, false, 0.99);

  // -------------------------------------------------------------- çay ocağı
  b.pat = PAT.wood;
  b.box(1, 0, -7.6, 9, 1.0, 1.1, 0x5e371c);
  for (let x = -3.1; x <= 5.1; x += 1.0) b.box(x, 0.15, -7.03, 0.8, 0.7, 0.03, 0x6e4124);
  b.pat = PAT.stone;
  b.box(1, 1.0, -7.6, 9.2, 0.07, 1.25, 0xece6db);
  b.pat = PAT.none;
  b.add(new THREE.CylinderGeometry(0.02, 0.02, 9, 8), 0xc9a24a, 1, 0.18, -6.92, 0, 0, Math.PI / 2);
  samovar(b, -2.6, 1.07, -7.8, 1.25);
  caydanlik(b, -0.9, 1.07, -7.85);
  caydanlik(b, 0.0, 1.07, -7.85);
  // trays of tea glasses
  for (let i = 0; i < 12; i++) {
    const x = 1.2 + (i % 6) * 0.17;
    const z = -7.35 - Math.floor(i / 6) * 0.17;
    b.cyl(x, 1.07, z, 0.05, 0.008, 0xffffff, 10);
    b.add(new THREE.LatheGeometry([new THREE.Vector2(0.018, 0), new THREE.Vector2(0.026, 0.02), new THREE.Vector2(0.02, 0.05), new THREE.Vector2(0.028, 0.085)], 8), 0x9b2a14, x, 1.08, z);
  }
  // sugar bowl, cash box, radio
  b.cyl(3.2, 1.07, -7.5, 0.08, 0.1, 0xf4f1e8, 12);
  b.box(4.4, 1.07, -7.6, 0.45, 0.22, 0.35, 0x3b3f46);
  b.box(4.4, 1.29, -7.6, 0.3, 0.06, 0.25, 0x2b2b2b);
  b.box(-3.7, 1.07, -7.7, 0.42, 0.26, 0.2, 0x7a4a2a);
  b.cyl(-3.8, 1.2, -7.59, 0.05, 0.01, 0xc9a24a, 10);
  // shelves with glasses and jars behind the counter
  b.pat = PAT.wood;
  for (const y of [1.95, 2.5]) b.box(1, y, -9.78, 8.4, 0.05, 0.36, 0x5e371c);
  b.pat = PAT.none;
  for (let i = 0; i < 26; i++) {
    const x = -2.9 + i * 0.31;
    const y = i % 2 ? 2.0 : 2.55;
    if (i % 5 === 2) b.cyl(x, y, -9.75, 0.08, 0.24, [0xd8473b, 0xf2c94c, 0x3f8f5a][i % 3]!, 10);
    else b.add(new THREE.LatheGeometry([new THREE.Vector2(0.018, 0), new THREE.Vector2(0.026, 0.02), new THREE.Vector2(0.02, 0.05), new THREE.Vector2(0.028, 0.085)], 8), 0xe8f0f0, x, y, -9.75);
  }
  // tray rack: hanging brass tea trays
  for (let i = 0; i < 4; i++) b.add(new THREE.CylinderGeometry(0.16, 0.16, 0.012, 16), 0xc9a24a, 5.0 + i * 0.05, 1.7, -9.85 + i * 0.03, Math.PI / 2, 0, 0);

  // -------------------------------------------------------------- tables & chairs
  for (let t = 0; t < TABLES.length; t++) {
    const c = TABLES[t]!;
    okeyTable(b, c.x, c.z);
    for (let s = 0; s < 4; s++) {
      const p = seatPosition(t, s);
      // backrest away from the table: chair faces the table (−z after its yaw)
      bentwoodChair(b, p.x + Math.sin(p.yaw) * 0.06, p.z + Math.cos(p.yaw) * 0.06, p.yaw);
    }
  }
  const feltGeo = new THREE.PlaneGeometry(0.98, 0.98);
  feltGeo.rotateX(-Math.PI / 2);
  const felts = new THREE.InstancedMesh(feltGeo, new THREE.MeshStandardMaterial({ map: feltTexture(), roughness: 0.95 }), TABLES.length);
  TABLES.forEach((c, i) => felts.setMatrixAt(i, new THREE.Matrix4().makeTranslation(c.x, TABLE_TOP + 0.001, c.z)));
  felts.receiveShadow = true;
  scene.add(felts);

  // other furniture from the level description
  const tavlaBoards: THREE.Vector3[] = [];
  for (const o of KAHVE_OBJECTS) {
    if (o.kind === 'tavla') {
      const f = new Frame(o.x, 0, o.z, 0);
      b.pat = PAT.wood;
      b.addMatrix(new THREE.CylinderGeometry(0.5, 0.5, 0.04, 24), 0x6a3d1f, f.m(0, 0.73, 0));
      b.addMatrix(new THREE.CylinderGeometry(0.05, 0.08, 0.72, 10), WALNUT, f.m(0, 0.36, 0));
      b.addMatrix(new THREE.CylinderGeometry(0.28, 0.3, 0.04, 16), WALNUT, f.m(0, 0.02, 0));
      // open tavla board
      b.addMatrix(new THREE.BoxGeometry(0.62, 0.03, 0.46), 0x7a4a2a, f.m(0, 0.765, 0));
      b.pat = PAT.none;
      b.addMatrix(new THREE.BoxGeometry(0.56, 0.005, 0.4), 0xe9d8b0, f.m(0, 0.78, 0));
      b.addMatrix(new THREE.BoxGeometry(0.02, 0.01, 0.4), 0x5a3418, f.m(0, 0.785, 0));
      for (let k = 0; k < 24; k++) {
        const side = k < 12 ? -1 : 1;
        const xx = -0.255 + (k % 12) * 0.0465 + (k % 12 >= 6 ? 0.02 : 0);
        b.addMatrix(new THREE.ConeGeometry(0.019, 0.17, 3), k % 2 ? 0x8f2f2a : 0x2b1a10, f.m(xx, 0.783, side * 0.11, (side * Math.PI) / 2, 0, 0, new THREE.Vector3(1, 1, 0.05)));
      }
      for (let k = 0; k < 10; k++) b.addMatrix(new THREE.CylinderGeometry(0.019, 0.019, 0.008, 12), k % 2 ? 0xf4f1e8 : 0x6d2a1e, f.m(-0.2 + (k % 5) * 0.04, 0.79, k < 5 ? -0.15 : 0.15));
      tavlaBoards.push(new THREE.Vector3(o.x, 0.8, o.z));
      for (const s of [-1, 1]) bentwoodChair(b, o.x + s * 0.85, o.z, s > 0 ? Math.PI / 2 : -Math.PI / 2);
    } else if (o.kind === 'tv') {
      b.box(o.x, o.y + 0.5, o.z - 0.02, 0.1, 0.1, 0.25, 0x222222);
      b.box(o.x, o.y, o.z - 0.12, o.w, o.h, 0.1, 0x151515);
    } else if (o.kind === 'pillar') {
      b.pat = PAT.plaster;
      b.box(o.x, 0, o.z, o.w, o.h, o.d, 0xe2d2b4);
      b.pat = PAT.wood;
      b.box(o.x, 0, o.z, o.w + 0.08, 1.15, o.d + 0.08, 0x5a3418);
      b.box(o.x, 3.7, o.z, o.w + 0.14, 0.12, o.d + 0.14, 0x5a3418);
      b.pat = PAT.none;
    } else if (o.kind === 'bench') {
      b.pat = PAT.wood;
      b.box(o.x, 0, o.z, o.w, o.h, o.d, 0x5e371c);
      b.box(o.x + Math.sign(o.x) * 0.36, o.h, o.z, 0.08, 0.6, o.d, 0x5e371c);
      b.pat = PAT.fabric;
      b.box(o.x, o.h, o.z, o.w - 0.06, 0.08, o.d - 0.06, 0x8f2f2a);
      for (let k = 0; k < 4; k++) b.box(o.x + Math.sign(o.x) * 0.25, o.h + 0.08, o.z - 1.8 + k * 1.2, 0.18, 0.4, 0.5, k % 2 ? 0xe9c46a : 0x2f5d73);
      b.pat = PAT.none;
    }
  }

  // coat rack with hats by the door, potted ficus in the corners, side tables
  b.cyl(2.2, 0, 9.2, 0.04, 1.9, WALNUT, 8);
  b.cyl(2.2, 0, 9.2, 0.22, 0.04, WALNUT, 12);
  for (let k = 0; k < 4; k++) b.add(new THREE.CylinderGeometry(0.012, 0.012, 0.22, 5), WALNUT, 2.2 + Math.sin(k * 1.57) * 0.09, 1.82, 9.2 + Math.cos(k * 1.57) * 0.09, Math.cos(k * 1.57) * 0.8, 0, -Math.sin(k * 1.57) * 0.8);
  b.add(new THREE.SphereGeometry(0.15, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), 0x5b5348, 2.3, 1.82, 9.2);
  for (const [x, z] of [
    [-12.3, -9.3],
    [12.3, -9.3],
    [-12.3, 9.3],
    [12.3, 5.5],
  ] as const) {
    b.add(new THREE.LatheGeometry([new THREE.Vector2(0.18, 0), new THREE.Vector2(0.24, 0.05), new THREE.Vector2(0.27, 0.45), new THREE.Vector2(0.3, 0.5)], 14), 0xb8643c, x, 0, z);
    b.cyl(x, 0.5, z, 0.03, 0.9, 0x4a3020, 6);
    for (let k = 0; k < 6; k++) b.blob(x + Math.sin(k * 2.1) * 0.22, 1.2 + (k % 3) * 0.28, z + Math.cos(k * 2.1) * 0.22, 0.3, k % 2 ? 0x3f7f3a : 0x4f9a3f, 1, 1, 'foliage');
  }

  // pendant lamps over the tables + wall sconces
  const bulbs: [number, number, number][] = [];
  for (const t of TABLES) {
    b.cyl(t.x, 2.8, t.z, 0.008, H - 2.8, 0x222222, 4);
    b.add(new THREE.LatheGeometry([new THREE.Vector2(0.03, 0.22), new THREE.Vector2(0.08, 0.2), new THREE.Vector2(0.3, 0.02), new THREE.Vector2(0.32, 0)], 18), 0x2f5d3a, t.x, 2.58, t.z);
    bulbs.push([t.x, 2.62, t.z]);
  }
  for (const x of [-8.25, -4.75, 4.75, 8.25]) {
    b.box(x, 2.2, D - 0.05, 0.08, 0.2, 0.1, 0xc9a24a);
    bulbs.push([x, 2.42, D - 0.16]);
  }
  for (const z of [-5, 5]) for (const x of [-W + 0.08, W - 0.08]) {
    b.box(x, 2.2, z, 0.1, 0.2, 0.08, 0xc9a24a);
    bulbs.push([x + Math.sign(-x) * 0.12, 2.42, z]);
  }
  for (const [x, y, z] of bulbs) b.add(new THREE.SphereGeometry(0.075, 10, 8), 0xffd9a0, x, y, z, 0, 0, 0, 'glow');

  // -------------------------------------------------------------- merge
  const mainMat = patternize(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62 }), 0.25);
  const wallMat = patternize(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }), 0.3);
  const foliageMat = patternize(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }), 0);
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
  addMesh(b.build('foliage'), foliageMat, true, true);
  addMesh(b.build('glow'), glowMat, false, false);
  addMesh(b.build('cars'), wallMat, false, true);

  // -------------------------------------------------------------- wall pictures & signs
  decal(scene, sign('SOKAK KIRAATHANESİ', '#3e2412', '#f2c94c', 1024, 128), 1, 3.35, -D + 0.08, 6.4, 0.8);
  decal(scene, sign('ÇAY OCAĞI', '#1d4f91', '#ffffff', 512, 112), -2.4, 2.92, -D + 0.08, 1.9, 0.42);
  const cini = ciniTexture(16, 3);
  decal(scene, cini, 1.3, 1.65, -D + 0.04, 8.6, 1.3);
  decal(scene, menuTexture(), -6.2, 2.0, -D + 0.08, 1.2, 1.5);
  decal(scene, sign('OKEY · TAVLA · BATAK', '#8f2f2a', '#fff3cf', 512, 96), 8.6, 2.5, -D + 0.08, 3.4, 0.64);
  decal(scene, photoTexture(0), -W + 0.06, 2.1, -3.5, 1.3, 0.98, Math.PI / 2);
  decal(scene, photoTexture(1), -W + 0.06, 2.1, 3.5, 1.3, 0.98, Math.PI / 2);
  decal(scene, photoTexture(1), W - 0.06, 2.1, -3.2, 1.3, 0.98, -Math.PI / 2);
  decal(scene, calendarTexture(), W - 0.06, 1.9, 2.6, 0.5, 0.7, -Math.PI / 2);
  // mirror with a frame
  const mirror = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.5), new THREE.MeshStandardMaterial({ color: 0x9aa7ae, metalness: 1, roughness: 0.08 }));
  mirror.position.set(W - 0.06, 2.1, -6.8);
  mirror.rotation.y = -Math.PI / 2;
  scene.add(mirror);

  // wall clock with real time
  const clock = new THREE.Group();
  const face = new THREE.Mesh(
    new THREE.CircleGeometry(0.42, 32),
    new THREE.MeshStandardMaterial({
      map: canvasTex(256, 256, (ctx) => {
        ctx.fillStyle = '#fbf6e8';
        ctx.beginPath();
        ctx.arc(128, 128, 126, 0, Math.PI * 2);
        ctx.fill();
        ctx.lineWidth = 12;
        ctx.strokeStyle = '#3e2412';
        ctx.stroke();
        ctx.fillStyle = '#2b1a0e';
        ctx.font = '700 28px "Baloo 2", serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        for (let h = 1; h <= 12; h++) {
          const a = (h / 12) * Math.PI * 2;
          ctx.fillText(String(h), 128 + Math.sin(a) * 94, 128 - Math.cos(a) * 94);
        }
      }),
      roughness: 0.4,
    }),
  );
  const hand = (len: number, w: number) => {
    const g = new THREE.PlaneGeometry(w, len);
    g.translate(0, len / 2 - 0.03, 0);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0x1a1008 }));
    m.position.z = 0.005;
    return m;
  };
  const hourHand = hand(0.22, 0.03);
  const minHand = hand(0.33, 0.02);
  clock.add(face, hourHand, minHand);
  clock.position.set(-6.2, 3.25, -D + 0.07);
  scene.add(clock);

  // TV playing the match
  const tvCanvas = document.createElement('canvas');
  tvCanvas.width = 256;
  tvCanvas.height = 144;
  const tvCtx = tvCanvas.getContext('2d')!;
  const tvTex = new THREE.CanvasTexture(tvCanvas);
  tvTex.colorSpace = THREE.SRGBColorSpace;
  const tvObj = KAHVE_OBJECTS.find((o) => o.kind === 'tv');
  if (tvObj) {
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(tvObj.w - 0.12, tvObj.h - 0.12), new THREE.MeshBasicMaterial({ map: tvTex, toneMapped: false }));
    screen.position.set(tvObj.x, tvObj.y + tvObj.h / 2, tvObj.z - 0.175);
    screen.rotation.y = Math.PI;
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
    tvCtx.fillRect(6, 4, 110, 18);
    tvCtx.fillStyle = '#ffffff';
    tvCtx.font = '700 12px sans-serif';
    tvCtx.fillText(`SOKAK 2 - 1 MAHALLE  ${String(60 + Math.floor(t / 4) % 30)}'`, 10, 17);
    tvTex.needsUpdate = true;
  };

  // ceiling fans
  const fans: THREE.Group[] = [];
  for (const x of [-4, 4]) {
    const f = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0x5a3820, roughness: 0.6 });
    const brass = new THREE.MeshStandardMaterial({ color: 0xc9a24a, roughness: 0.3, metalness: 0.7 });
    f.add(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 0.16, 12), brass));
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.4, 6), brass);
    rod.position.y = 0.25;
    f.add(rod);
    for (let k = 0; k < 4; k++) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.015, 0.16), mat);
      blade.position.x = 0.55;
      blade.rotation.x = 0.12;
      const arm = new THREE.Group();
      arm.rotation.y = (k * Math.PI) / 2;
      arm.add(blade);
      f.add(arm);
    }
    f.position.set(x, 3.35, 1.2);
    fans.push(f);
    scene.add(f);
  }

  // dust motes in the evening light
  const motes = (() => {
    const N = low ? 0 : 160;
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 22;
      pos[i * 3 + 1] = 0.4 + Math.random() * 3.2;
      pos[i * 3 + 2] = D - 1 - Math.random() * 9;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const sprite = canvasTex(32, 32, (ctx) => {
      const gr = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
      gr.addColorStop(0, 'rgba(255,230,190,1)');
      gr.addColorStop(1, 'rgba(255,230,190,0)');
      ctx.fillStyle = gr;
      ctx.fillRect(0, 0, 32, 32);
    });
    const p = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.035, map: sprite, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
    scene.add(p);
    return p;
  })();

  // -------------------------------------------------------------- tiles on every table
  const field = new TileField(1800);
  scene.add(field.mesh);
  const tableState: { view: TableView | null; viewer: number | null }[] = TABLES.map(() => ({ view: null, viewer: null }));
  const anchors: (TableAnchors | null)[] = TABLES.map(() => null);
  const v = new THREE.Vector3();
  let dirty = true;
  /** where every tile should be; face-up tiles glide there (keyed by table + tile id) */
  interface Placement {
    key: string | null;
    cell: number;
    x: number;
    y: number;
    z: number;
    yaw: number;
    tilt: number;
    scale: number;
    /** where a newly appearing tile flies in from (the owner's ıstaka) */
    from: THREE.Vector3 | null;
  }
  let placements: Placement[] = [];
  const animPos = new Map<string, { x: number; y: number; z: number; yaw: number }>();
  let animating = false;
  const put = (key: string | null, cell: number, p: THREE.Vector3, yaw: number, tilt = 0, scale = 1, from: THREE.Vector3 | null = null) =>
    placements.push({ key, cell, x: p.x, y: p.y, z: p.z, yaw, tilt, scale, from });

  const layoutTable = (t: number, view: TableView, viewer: number | null): TableAnchors => {
    const ctx: OkeyCtx = { okey: view.okey as OkeyCtx['okey'] };
    const ref = viewer ?? 0;
    const ry = seatYaw(ref);
    const rackOf = (s: number) => tablePoint(t, seatYaw(s), 0, FELT_Y + 0.07, RACK_DIST);
    // racks: hidden tiles standing on the ıstaka (the viewer's own rack is on screen instead)
    for (let s = 0; s < 4; s++) {
      if (s === viewer) continue;
      const yaw = seatYaw(s);
      const n = view.handCounts[s] ?? 0;
      for (let k = 0; k < n; k++) {
        const upper = k >= 15;
        const col = upper ? k - 15 : k;
        const lx = -0.3 + col * (TILE_W + 0.004) + (upper ? 0.02 : 0);
        const ly = FELT_Y + (upper ? 0.062 : 0.04);
        const lz = RACK_DIST + (upper ? -0.03 : 0.018);
        put(null, -1, tablePoint(t, yaw, lx, ly, lz, v), yaw, Math.PI / 2 - LEAN);
      }
    }
    // deck: face-down stacks in the middle
    const deckPos = tablePoint(t, ry, 0, FELT_Y, -0.05);
    const piles6 = Math.ceil(view.deck / 6);
    for (let k = 0; k < view.deck; k++) {
      const pile = Math.floor(k / 6);
      put(null, -1, tablePoint(t, ry, (pile - (piles6 - 1) / 2) * (TILE_W + 0.006), FELT_Y + TILE_T / 2 + (k % 6) * TILE_T, -0.05, v), ry);
    }
    const gPos = tablePoint(t, ry, 0, FELT_Y + TILE_T / 2, 0.05);
    put(`${t}:g${view.gosterge}`, cellOf(view.gosterge, null), gPos, ry + 0.12, 0, 1, deckPos);
    // discard piles at each player's right-hand corner
    const piles: THREE.Vector3[] = [];
    for (let s = 0; s < 4; s++) {
      const yaw = seatYaw(s);
      const list = view.discards[s] ?? [];
      const shown = list.slice(-5);
      const base = tablePoint(t, yaw, 0.41, FELT_Y, 0.4);
      shown.forEach((id, k) => {
        const off = shown.length - 1 - k;
        tablePoint(t, yaw, 0.41 - off * 0.012, FELT_Y + TILE_T / 2 + k * TILE_T * 0.6, 0.4 - off * 0.016, v);
        put(`${t}:${id}`, cellOf(id, ctx), v, ry + Math.sin(id * 1.7) * 0.12, 0, 1, rackOf(s));
      });
      piles.push(base.setY(FELT_Y + 0.02));
    }
    // melds: each player's zone, laid out in the reference frame so they read upright
    const melds: MeldAnchor[] = [];
    const zones = [
      { x0: -0.36, x1: 0.36, z0: 0.14, scale: 1 },
      { x0: 0.13, x1: 0.385, z0: -0.17, scale: 0.82 },
      { x0: -0.36, x1: 0.36, z0: -0.38, scale: 1 },
      { x0: -0.385, x1: -0.13, z0: -0.17, scale: 0.82 },
    ];
    const cursor = zones.map((z) => ({ x: z.x0, row: 0 }));
    for (const m of view.melds) {
      const rel = (m.owner - ref + 4) % 4;
      const zn = zones[rel]!;
      const cur = cursor[rel]!;
      const tw = TILE_W * zn.scale + 0.002;
      const width = m.tiles.length * tw;
      if (cur.x + width > zn.x1 + 0.001 && cur.x > zn.x0) {
        cur.x = zn.x0;
        cur.row++;
      }
      const z = zn.z0 + cur.row * (TILE_H * zn.scale + 0.008);
      const x0 = cur.x;
      m.tiles.forEach((id, k) => {
        tablePoint(t, ry, x0 + tw * (k + 0.5), FELT_Y + (TILE_T * zn.scale) / 2, z + (TILE_H * zn.scale) / 2, v);
        put(`${t}:${id}`, cellOf(id, ctx), v, ry, 0, zn.scale, rackOf(m.owner));
      });
      const z1 = z + TILE_H * zn.scale;
      melds.push({
        id: m.id,
        corners: [
          tablePoint(t, ry, x0, FELT_Y, z),
          tablePoint(t, ry, x0 + width, FELT_Y, z),
          tablePoint(t, ry, x0 + width, FELT_Y, z1),
          tablePoint(t, ry, x0, FELT_Y, z1),
        ],
      });
      cur.x += width + 0.014;
    }
    return { deck: deckPos.setY(FELT_Y + 0.04), gosterge: gPos, piles, melds };
  };

  // glowing bar on the ıstaka of whoever's turn it is
  const turnBars = TABLES.map(() => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.008, 0.012), new THREE.MeshBasicMaterial({ color: 0xffd166, toneMapped: false }));
    (m.material as THREE.MeshBasicMaterial).color.multiplyScalar(2.5);
    m.visible = false;
    scene.add(m);
    return m;
  });

  const rebuildTiles = () => {
    dirty = false;
    placements = [];
    tableState.forEach((st, t) => {
      const bar = turnBars[t]!;
      bar.visible = !!st.view && st.view.phase !== 'ended';
      if (!st.view) return;
      const yaw = seatYaw(st.view.turn);
      tablePoint(t, yaw, 0, FELT_Y + 0.004, RACK_DIST + 0.075, bar.position);
      bar.rotation.y = yaw;
    });
    tableState.forEach((st, t) => {
      anchors[t] = st.view ? layoutTable(t, st.view, st.viewer) : null;
    });
    // new face-up tiles start at their owner's rack; vanished ones are forgotten
    const live = new Set<string>();
    for (const p of placements) {
      if (!p.key) continue;
      live.add(p.key);
      if (!animPos.has(p.key)) {
        const f = p.from ?? new THREE.Vector3(p.x, p.y, p.z);
        animPos.set(p.key, { x: f.x, y: f.y, z: f.z, yaw: p.yaw + 0.6 });
      }
    }
    for (const k of [...animPos.keys()]) if (!live.has(k)) animPos.delete(k);
    animating = true;
  };

  /** write instance matrices; face-up tiles ease towards their places with a small hop */
  const drawTiles = (dt: number) => {
    if (!animating) return;
    let moving = false;
    const k = Math.min(1, dt * 9);
    field.begin();
    for (const p of placements) {
      let x = p.x;
      let y = p.y;
      let z = p.z;
      let yaw = p.yaw;
      if (p.key) {
        const a = animPos.get(p.key)!;
        const d = Math.hypot(p.x - a.x, p.z - a.z);
        if (d > 0.0005 || Math.abs(p.y - a.y) > 0.0005 || Math.abs(p.yaw - a.yaw) > 0.002) {
          moving = true;
          a.x += (p.x - a.x) * k;
          a.y += (p.y - a.y) * k;
          a.z += (p.z - a.z) * k;
          a.yaw += (p.yaw - a.yaw) * k;
        } else {
          a.x = p.x;
          a.y = p.y;
          a.z = p.z;
          a.yaw = p.yaw;
        }
        x = a.x;
        y = a.y + Math.min(0.12, d * 0.5);
        z = a.z;
        yaw = a.yaw;
      }
      field.push(p.cell, x, y, z, yaw, p.tilt, null, p.scale);
    }
    field.end();
    animating = moving;
  };

  // -------------------------------------------------------------- regulars (NPC amcas)
  interface Regular {
    ch: Character;
    pose: 'sit' | 'sitThink' | 'drink' | 'read' | 'doze';
  }
  const regulars: Regular[] = [];
  const addRegular = (x: number, y: number, z: number, yaw: number, pose: Regular['pose'], look: { color: string; skin: number; hat: number }, extra: Record<string, unknown>) => {
    const ch = new Character({ color: look.color, hat: look.hat, hair: 0, skin: look.skin }, { adult: true, extra: { moustache: true, ...extra } });
    ch.root.position.set(x, y, z);
    ch.root.rotation.y = ch.facing = yaw;
    ch.pose = pose;
    scene.add(ch.root);
    regulars.push({ ch, pose });
    return ch;
  };
  // tavla players in the west corner
  addRegular(-11.35, 0, -7.5, -Math.PI / 2, 'sitThink', { color: '#7b6a58', skin: 1, hat: 1 }, { grey: true, shirtStyle: 3, tespih: true });
  addRegular(-9.65, 0, -7.5, Math.PI / 2, 'sit', { color: '#3f5f7a', skin: 2, hat: 0 }, { bald: true, shirtStyle: 2 });
  // the paper reader and the dozer in the east corner
  const reader = addRegular(9.65, 0, -7.5, -Math.PI / 2, 'read', { color: '#d9d2c0', skin: 0, hat: 0 }, { glasses: true, grey: true, shirtStyle: 3, vest: '#4a4a4a' });
  addRegular(11.35, 0, -7.5, Math.PI / 2, 'doze', { color: '#8a5a3a', skin: 3, hat: 1 }, { shirtStyle: 3 });
  // on the west bench with his tea
  addRegular(-12.2, 0.1, 3.0, -Math.PI / 2, 'drink', { color: '#5c6f8a', skin: 1, hat: 0 }, { grey: true, shirtStyle: 2 }).hold(teaGlass());
  const paper = new THREE.Mesh(
    new THREE.PlaneGeometry(0.42, 0.3),
    new THREE.MeshStandardMaterial({
      side: THREE.DoubleSide,
      map: canvasTex(256, 180, (ctx) => {
        ctx.fillStyle = '#f0ebe0';
        ctx.fillRect(0, 0, 256, 180);
        ctx.fillStyle = '#222';
        ctx.font = '800 26px serif';
        ctx.fillText('MAHALLE GAZETESİ', 10, 32);
        for (let y = 50; y < 175; y += 10) ctx.fillRect(10 + ((y * 7) % 3) * 4, y, 110 - ((y * 13) % 20), 4), ctx.fillRect(136, y, 108 - ((y * 11) % 18), 4);
      }),
    }),
  );
  paper.position.set(9.95, 1.18, -7.5);
  paper.rotation.set(-0.25, -Math.PI / 2, 0);
  scene.add(paper);
  void reader;
  // dice on the tavla board
  const diceMat = new THREE.MeshStandardMaterial({ color: 0xfaf7f0, roughness: 0.3 });
  const dice = [0, 1].map(() => {
    const d = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.022, 0.022), diceMat);
    scene.add(d);
    return d;
  });
  let diceT = 0;

  // -------------------------------------------------------------- the çaycı
  const cayci = new Character({ color: '#f4f1e8', hat: 0, hair: 0, skin: 1 }, { adult: true, extra: { vest: '#2b2b2b', moustache: true, shirtStyle: 3 } });
  cayci.setLabel('Çaycı Rıza', '#ffe7a8');
  const tray = new THREE.Group();
  const trayMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.015, 20), new THREE.MeshStandardMaterial({ color: 0xc9a24a, metalness: 0.7, roughness: 0.3 }));
  tray.add(trayMesh);
  tray.position.set(0.32, 1.15, -0.25);
  tray.visible = false;
  cayci.root.add(tray);
  cayci.root.position.set(CAYCI_SPOT.x, 0, CAYCI_SPOT.z);
  scene.add(cayci.root);
  const home = new THREE.Vector3(CAYCI_SPOT.x, 0, CAYCI_SPOT.z);
  const queue: Delivery[] = [];
  let route: THREE.Vector3[] = [];
  let current: Delivery | null = null;
  let returning = false;
  const served: { obj: THREE.Object3D; t: number }[] = [];

  const plan = (to: THREE.Vector3): THREE.Vector3[] => {
    // round the counter, along the north corridor, then down an aisle
    const aisleX = to.x + (to.x > 6 || (to.x > -2 && to.x < 2) ? 2.2 : -2.2);
    return [new THREE.Vector3(6.2, 0, -6.4), new THREE.Vector3(aisleX, 0, -6.2), new THREE.Vector3(aisleX, 0, to.z), new THREE.Vector3(to.x + (aisleX - to.x) * 0.35, 0, to.z)];
  };
  const startNext = () => {
    current = queue.shift() ?? null;
    if (!current) return;
    returning = false;
    route = [new THREE.Vector3(6.0, 0, -8.6), ...plan(current.to)];
    tray.clear();
    tray.add(trayMesh);
    const d = drinkModel(current.item);
    d.position.y = 0.01;
    tray.add(d);
    tray.visible = true;
  };

  let t = 0;
  let tvT = 0;
  return {
    setDusk() {},
    serve(item, to, onTable) {
      queue.push({ item, to, onTable });
      if (!current) startNext();
    },
    setTable(table, view, viewerSeat) {
      const st = tableState[table];
      if (!st) return;
      if (view) setAtlasOkey(view.okey as OkeyCtx['okey']);
      st.view = view;
      st.viewer = viewerSeat;
      dirty = true;
    },
    anchors(table) {
      if (dirty) {
        rebuildTiles();
        drawTiles(0);
      }
      return anchors[table] ?? null;
    },
    seatView(table, seat, aspect, bottomNdc) {
      // frame the table above the on-screen rack: far rack near the top of the
      // screen (NDC +0.9), near felt edge just above the rack (NDC −0.42)
      const yaw = seatYaw(seat);
      const cy = TABLE_TOP + 1.0;
      const cz = 0.84;
      const aFar = Math.atan2(cy - (TABLE_TOP + 0.14), cz + 0.62);
      const aNear = Math.atan2(cy - TABLE_TOP, cz - 0.5);
      const top = 0.9;
      const bot = Math.min(0.8, Math.max(0.1, -bottomNdc));
      let lo = aFar + 1e-3;
      let hi = aNear - 1e-3;
      for (let i = 0; i < 40; i++) {
        const mid = (lo + hi) / 2;
        if (Math.tan(mid - aFar) / top > Math.tan(aNear - mid) / bot) hi = mid;
        else lo = mid;
      }
      const pitch = (lo + hi) / 2;
      let f = Math.tan(pitch - aFar) / top;
      // make sure the table width fits horizontally
      const d = Math.cos(aNear - pitch) * Math.hypot(cy - TABLE_TOP, cz - 0.5);
      f = Math.max(f, (0.64 / d) / Math.max(0.5, aspect));
      const pos = tablePoint(table, yaw, 0, cy, cz);
      const target = tablePoint(table, yaw, 0, cy - Math.sin(pitch), cz - Math.cos(pitch));
      return { pos, target, fov: THREE.MathUtils.radToDeg(2 * Math.atan(f)) };
    },
    update(dt: number, _movers: Mover[]) {
      t += dt;
      if (dirty) rebuildTiles();
      drawTiles(dt);
      for (const f of fans) f.rotation.y += dt * 2.2;
      // clock
      const now = new Date();
      const mins = now.getMinutes() + now.getSeconds() / 60;
      minHand.rotation.z = -(mins / 60) * Math.PI * 2;
      hourHand.rotation.z = -(((now.getHours() % 12) + mins / 60) / 12) * Math.PI * 2;
      // tv at ~12 fps
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
      // dust drifting in the light
      if (motes.geometry.attributes.position) {
        const p = motes.geometry.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i < p.count; i++) {
          p.setY(i, p.getY(i) + Math.sin(t * 0.3 + i) * 0.0015);
          p.setX(i, p.getX(i) + Math.cos(t * 0.2 + i * 1.3) * 0.0012);
        }
        p.needsUpdate = true;
      }
      // regulars
      for (const r of regulars) {
        r.ch.animate(dt, 0, false, false);
      }
      // tavla dice: roll every few seconds
      diceT -= dt;
      const board = tavlaBoards[0];
      if (board) {
        if (diceT < 0) diceT = 4 + Math.random() * 3;
        const air = Math.max(0, diceT - 3.4) / 0.6;
        dice.forEach((d, i) => {
          d.position.set(board.x - 0.05 + i * 0.06 + air * 0.1, board.y + 0.012 + Math.sin(air * Math.PI) * 0.12, board.z + 0.02 * i);
          d.rotation.set(air * 9 + i, air * 7, air * 5);
        });
      }
      // waiter
      const ch = cayci;
      if (route.length) {
        const target = route[0]!;
        const p = ch.root.position;
        const dx = target.x - p.x;
        const dz = target.z - p.z;
        const dist = Math.hypot(dx, dz);
        const step = Math.min(dist, dt * 3.2);
        if (dist < 0.05) route.shift();
        else {
          p.x += (dx / dist) * step;
          p.z += (dz / dist) * step;
          const yaw = Math.atan2(-dx, -dz);
          ch.facing += Math.atan2(Math.sin(yaw - ch.facing), Math.cos(yaw - ch.facing)) * Math.min(1, dt * 10);
          ch.root.rotation.y = ch.facing;
        }
        ch.animate(dt, 3.2, false, false);
        if (!route.length && current && !returning) {
          const d = drinkModel(current.item);
          if (current.onTable) d.position.set(current.onTable.x, TABLE_TOP + 0.004, current.onTable.z);
          else d.position.set(current.to.x + 0.3, 0.02, current.to.z + 0.3);
          scene.add(d);
          served.push({ obj: d, t: 0 });
          tray.visible = false;
          returning = true;
          route = [...plan(current.to)].reverse().slice(1).concat([new THREE.Vector3(6.0, 0, -8.6), home.clone()]);
        } else if (!route.length && returning) {
          returning = false;
          current = null;
          ch.facing = Math.PI;
          ch.root.rotation.y = Math.PI;
          startNext();
        }
      } else {
        // waiting behind the counter, facing the room
        ch.root.rotation.y = ch.facing = Math.PI;
        ch.animate(dt, 0, false, false);
      }
      for (let i = served.length - 1; i >= 0; i--) {
        const s = served[i]!;
        s.t += dt;
        if (s.t > 90) {
          scene.remove(s.obj);
          served.splice(i, 1);
        }
      }
    },
  };
}
