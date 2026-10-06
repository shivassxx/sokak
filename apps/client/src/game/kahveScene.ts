import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { CAYCI_SPOT, KAHVE_HALF_X, KAHVE_HALF_Z, KAHVE_OBJECTS, MENU, TABLES, seatPosition } from '@sokak/shared';
import { Builder, canvasTex, decal, hash, sign, type Mover, type World } from './world';
import { PAT, patternize } from './materials';
import { Character } from './character';

/**
 * The kahvehane interior (procedural): wooden floor and panelling, tiled
 * ocak wall with semavers, green-felt okey tables with racks, tavla corner,
 * TV, ceiling fans, hanging lamps. Includes the çaycı who walks orders to
 * their recipients and leaves the drink on the table.
 */
export interface KahveScene extends World {
  /** waiter brings `item` to a world position; drink stays on the table */
  serve(item: string, to: THREE.Vector3, onTable: { x: number; z: number } | null): void;
  /** tile backs on the racks: counts per seat (null = no game) */
  setRacks(table: number, counts: number[] | null, deck: number): void;
}

const WOOD = 0x8a5a35;
const DARK_WOOD = 0x5a3820;
const FELT = 0x1f6b45;

function chair(b: Builder, x: number, z: number, yaw: number): void {
  // seat + legs + backrest (backrest on the side away from the table)
  b.pat = PAT.wood;
  b.box(x, 0.44, z, 0.46, 0.05, 0.46, WOOD);
  for (const dx of [-0.19, 0.19]) for (const dz of [-0.19, 0.19]) b.box(x + dx, 0, z + dz, 0.04, 0.44, 0.04, DARK_WOOD);
  const bx = x + Math.sin(yaw) * 0.21;
  const bz = z + Math.cos(yaw) * 0.21;
  const along = Math.abs(Math.sin(yaw)) > 0.5;
  b.box(bx, 0.48, bz, along ? 0.04 : 0.46, 0.5, along ? 0.46 : 0.04, WOOD);
  b.box(bx, 0.85, bz, along ? 0.05 : 0.48, 0.08, along ? 0.48 : 0.05, DARK_WOOD);
  b.pat = PAT.none;
}

function okeyTable(b: Builder, x: number, z: number): void {
  b.pat = PAT.wood;
  b.box(x, 0.7, z, 1.36, 0.06, 1.36, DARK_WOOD);
  for (const dx of [-0.58, 0.58]) for (const dz of [-0.58, 0.58]) b.box(x + dx, 0, z + dz, 0.07, 0.7, 0.07, DARK_WOOD);
  b.pat = PAT.fabric;
  b.box(x, 0.76, z, 1.2, 0.012, 1.2, FELT);
  b.pat = PAT.wood;
  // four racks (ıstaka)
  for (let s = 0; s < 4; s++) {
    const a = (s * Math.PI) / 2;
    const ox = Math.sin(a) * 0.48;
    const oz = Math.cos(a) * 0.48;
    const along = Math.abs(Math.sin(a)) > 0.5;
    b.box(x + ox, 0.772, z + oz, along ? 0.12 : 0.9, 0.03, along ? 0.9 : 0.12, 0xc28a52);
    b.box(x + ox * 1.12, 0.772, z + oz * 1.12, along ? 0.03 : 0.9, 0.09, along ? 0.9 : 0.03, 0xc28a52);
  }
  b.pat = PAT.none;
}

function samovar(b: Builder, x: number, y: number, z: number, s = 1): void {
  b.cyl(x, y, z, 0.22 * s, 0.08, 0x9aa0a6, 14);
  b.cyl(x, y + 0.08, z, 0.2 * s, 0.45 * s, 0xd4d7db, 16, 0.24 * s);
  b.cyl(x, y + 0.08 + 0.45 * s, z, 0.24 * s, 0.06, 0xc0c4c8, 16);
  b.cyl(x, y + 0.6 * s, z, 0.13 * s, 0.22 * s, 0xd4d7db, 14, 0.1 * s);
  b.cyl(x, y + 0.82 * s, z, 0.03, 0.08, 0x2b2b2b, 6);
  const tap = new THREE.CylinderGeometry(0.02, 0.02, 0.18, 6);
  b.add(tap, 0xc0c4c8, x + 0.24 * s, y + 0.22, z, 0, 0, Math.PI / 2);
}

function teaGlass(): THREE.Group {
  const g = new THREE.Group();
  const glass = new THREE.MeshPhysicalMaterial({ color: 0xffffff, transmission: 0.6, roughness: 0.05, transparent: true, opacity: 0.45 });
  const tea = new THREE.MeshStandardMaterial({ color: 0x9b2a14, roughness: 0.2 });
  const saucer = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.06, 0.012, 18), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 }));
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.028, 0.09, 14, 1, true), glass);
  body.position.y = 0.055;
  const liquid = new THREE.Mesh(new THREE.CylinderGeometry(0.031, 0.026, 0.075, 12), tea);
  liquid.position.y = 0.048;
  g.add(saucer, liquid, body);
  return g;
}

function drinkModel(item: string): THREE.Group {
  const mat = (c: number, r = 0.4) => new THREE.MeshStandardMaterial({ color: c, roughness: r });
  if (item === 'cay') return teaGlass();
  const g = new THREE.Group();
  if (item === 'oralet') {
    const t = teaGlass();
    ((t.children[1] as THREE.Mesh).material as THREE.MeshStandardMaterial).color.setHex(0xf28c1c);
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
    const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.16, 12), new THREE.MeshPhysicalMaterial({ color: 0x8fd18a, transmission: 0.5, roughness: 0.1, transparent: true, opacity: 0.8 }));
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
    // tost
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

export function buildKahve(scene: THREE.Scene, renderer: THREE.WebGLRenderer): KahveScene {
  const mobile = matchMedia('(pointer: coarse)').matches;
  scene.background = new THREE.Color(0x2a1a10);
  scene.fog = new THREE.Fog(0x2a1a10, 30, 60);
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.5;
  pm.dispose();
  scene.add(new THREE.HemisphereLight(0xffe7c4, 0x5a3a28, 1.1));
  // evening sun through the south windows
  const sun = new THREE.DirectionalLight(0xffc68a, 1.7);
  sun.position.set(-8, 12, 14);
  sun.target.position.set(0, 0, 0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 14, bottom: -14, near: 1, far: 50 });
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);

  const b = new Builder();
  const W = KAHVE_HALF_X;
  const D = KAHVE_HALF_Z;

  // floor: wooden planks + a rug in the middle
  b.bucket = 'ground';
  b.pat = PAT.wood;
  b.box(0, -0.1, 0, W * 2, 0.1, D * 2, 0xa06a3c);
  b.pat = PAT.fabric;
  b.box(0, 0.003, 1.2, 6, 0.01, 2.2, 0x8f2f2a);
  b.box(0, 0.006, 1.2, 5.4, 0.01, 1.7, 0xc9a35a);
  b.bucket = 'main';

  // walls + ceiling go to a bucket that does not cast shadows (interior light)
  b.bucket = 'cars';
  // walls: wood panelling below, plaster above, ceiling beams
  const wall = (x: number, z: number, w: number, d: number) => {
    b.pat = PAT.wood;
    b.box(x, 0, z, w, 1.2, d, 0x6b4426);
    b.pat = PAT.plaster;
    b.box(x, 1.2, z, w, 2.8, d, 0xf1dfc0);
    b.pat = PAT.none;
    b.box(x, 1.2, z, w + 0.04, 0.08, d + 0.04, 0x4a2e19);
  };
  wall(0, -D - 0.25, W * 2 + 1, 0.5);
  wall(-W - 0.25, 0, 0.5, D * 2);
  wall(W + 0.25, 0, 0.5, D * 2);
  wall(-7.5, D + 0.25, 11.5, 0.5);
  wall(7.5, D + 0.25, 11.5, 0.5);
  // ceiling (no shadow casting: lights come from the side)
  b.pat = PAT.wood;
  b.box(0, 4, 0, W * 2 + 1, 0.15, D * 2 + 1, 0x7a5232);
  for (let x = -W + 2; x < W; x += 4) b.box(x, 3.75, 0, 0.25, 0.25, D * 2, 0x4a2e19);
  b.pat = PAT.none;

  // windows on the south wall + door frame
  for (const x of [-10, -6, -3, 3, 6, 10]) {
    if (Math.abs(x) < 2) continue;
    b.box(x, 1.4, D - 0.03, 1.8, 1.6, 0.04, 0xfff0c8, 'glow');
    b.box(x, 1.4, D - 0.07, 1.95, 0.08, 0.1, 0x4a2e19);
    b.box(x, 3.0, D - 0.07, 1.95, 0.08, 0.1, 0x4a2e19);
    b.box(x, 1.4, D - 0.07, 0.06, 1.6, 0.1, 0x4a2e19);
  }
  b.box(0, 2.6, D - 0.05, 3.6, 0.2, 0.3, 0x4a2e19);
  // closed double door with glass panes, wall above it
  b.pat = PAT.wood;
  b.box(-0.8, 0, D + 0.15, 1.55, 2.6, 0.12, 0x6b4426);
  b.box(0.8, 0, D + 0.15, 1.55, 2.6, 0.12, 0x6b4426);
  b.pat = PAT.plaster;
  b.box(0, 2.6, D + 0.25, 3.5, 1.4, 0.5, 0xf1dfc0);
  b.pat = PAT.none;
  for (const x of [-0.8, 0.8]) {
    b.box(x, 1.2, D + 0.08, 1.0, 1.1, 0.02, 0xffe9b8, 'glow');
    b.box(x + (x < 0 ? 0.6 : -0.6), 1.1, D + 0.07, 0.06, 0.25, 0.06, 0xd4af37);
  }
  b.bucket = 'main';

  // ocak: tiled wall, counter with marble top, semavers, glasses, shelves
  b.pat = PAT.tiles;
  b.box(1, 1.2, -D + 0.03, 10, 1.6, 0.04, 0x3f8bb8);
  b.pat = PAT.wood;
  b.box(1, 0, -7.6, 9, 1.0, 1.1, 0x6b4426);
  b.pat = PAT.stone;
  b.box(1, 1.0, -7.6, 9.2, 0.08, 1.25, 0xe8e2d8);
  b.pat = PAT.none;
  samovar(b, -1.5, 1.08, -7.8, 1.2);
  samovar(b, 0.2, 1.08, -7.8, 1);
  for (let i = 0; i < 10; i++) {
    const x = 2 + (i % 5) * 0.28;
    const z = -7.3 - Math.floor(i / 5) * 0.25;
    b.cyl(x, 1.08, z, 0.06, 0.01, 0xffffff, 12);
    b.cyl(x, 1.09, z, 0.026, 0.07, 0x9b2a14, 8, 0.034);
  }
  b.pat = PAT.wood;
  for (const y of [2.0, 2.6]) b.box(1, y, -9.55, 8, 0.05, 0.4, 0x6b4426);
  b.pat = PAT.none;
  for (let i = 0; i < 16; i++) {
    const x = -2.6 + i * 0.5;
    b.cyl(x, i % 2 ? 2.05 : 2.65, -9.5, 0.09, 0.25, [0xd8473b, 0xf2c94c, 0x3f8f5a, 0xe9e2d0][i % 4]!, 10);
  }

  // okey tables + chairs
  for (let t = 0; t < TABLES.length; t++) {
    const c = TABLES[t]!;
    okeyTable(b, c.x, c.z);
    for (let s = 0; s < 4; s++) {
      const p = seatPosition(t, s);
      // backrest faces away from the table centre
      chair(b, p.x + Math.sin(p.yaw) * 0.12, p.z + Math.cos(p.yaw) * 0.12, p.yaw);
    }
  }

  // other furniture from the level description
  KAHVE_OBJECTS.forEach((o, i) => {
    if (o.kind === 'tavla') {
      b.pat = PAT.wood;
      b.box(o.x, 0, o.z, o.w, o.h, o.d, DARK_WOOD);
      b.box(o.x, o.h, o.z, 0.7, 0.05, 0.5, 0xc28a52);
      b.pat = PAT.none;
      for (let k = 0; k < 12; k++) b.box(o.x - 0.3 + (k % 6) * 0.11, o.h + 0.051, o.z + (k < 6 ? -0.2 : 0.2), 0.06, 0.004, 0.18, k % 2 ? 0x2b1a10 : 0xf2e2c4);
      for (let k = 0; k < 6; k++) b.cyl(o.x - 0.2 + k * 0.07, o.h + 0.05, o.z + 0.08, 0.025, 0.012, k % 2 ? 0xffffff : 0x8a2a1a, 10);
      for (const [dx, dz] of [
        [0.9, 0],
        [-0.9, 0],
      ] as const) chair(b, o.x + dx, o.z + dz, dx > 0 ? Math.PI / 2 : -Math.PI / 2);
    } else if (o.kind === 'tv') {
      b.box(o.x, o.y, o.z, o.w, o.h, 0.08, 0x111111);
      b.box(o.x, o.y + 0.08, o.z - 0.05, o.w - 0.14, o.h - 0.16, 0.02, 0x3fa65a, 'glow');
    } else if (o.kind === 'pillar') {
      b.pat = PAT.plaster;
      b.box(o.x, 0, o.z, o.w, o.h, o.d, 0xe9d6b8);
      b.pat = PAT.wood;
      b.box(o.x, 0, o.z, o.w + 0.06, 1.2, o.d + 0.06, 0x6b4426);
      b.pat = PAT.none;
    } else if (o.kind === 'bench') {
      b.pat = PAT.wood;
      b.box(o.x, 0, o.z, o.w, o.h, o.d, 0x6b4426);
      b.pat = PAT.fabric;
      b.box(o.x, o.h, o.z, o.w, 0.08, o.d, 0x8f2f2a);
      b.pat = PAT.none;
    }
    void i;
  });

  // plants, coat rack, hanging lamps (glow), clock
  for (const [x, z] of [
    [-12.2, -9.2],
    [12.2, -9.2],
    [-12.2, 9.2],
  ] as const) {
    b.cyl(x, 0, z, 0.28, 0.5, 0xb8643c, 10, 0.22);
    b.blob(x, 0.9, z, 0.45, 0x4f9a3f, 1.2, 1, 'foliage');
  }
  b.cyl(11.8, 0, 8.6, 0.04, 1.9, DARK_WOOD, 8);
  for (const t of TABLES) {
    b.cyl(t.x, 3.0, t.z, 0.01, 0.75, 0x222222, 4);
    b.cyl(t.x, 2.75, t.z, 0.35, 0.25, 0x2f5d3a, 14, 0.12);
    b.add(new THREE.SphereGeometry(0.1, 10, 8), 0xffe0a0, t.x, 2.72, t.z, 0, 0, 0, 'glow');
  }
  b.cyl(-6, 2.7, -D + 0.05, 0.35, 0.05, 0xf4f1e8, 20);

  const mainMat = patternize(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 }));
  const groundMat = patternize(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }), 0);
  const foliageMat = patternize(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }), 0);
  const glowMat = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
  const add = (g: THREE.BufferGeometry | null, m: THREE.Material, cast: boolean, recv: boolean) => {
    if (!g) return;
    const mesh = new THREE.Mesh(g, m);
    mesh.castShadow = cast;
    mesh.receiveShadow = recv;
    mesh.matrixAutoUpdate = false;
    scene.add(mesh);
  };
  add(b.build('main'), mainMat, true, true);
  add(b.build('ground'), groundMat, false, true);
  add(b.build('foliage'), foliageMat, true, true);
  add(b.build('glow'), glowMat, false, false);
  add(b.build('cars'), mainMat, false, true);

  // signs and pictures
  decal(scene, sign('SOKAK KIRAATHANESİ', '#4a2e19', '#f2c94c', 1024, 128), 1, 3.15, -D + 0.08, 7, 0.9);
  decal(scene, sign('ÇAY 5 ₺ · ORALET 5 ₺ · KAHVE 12 ₺', '#1e1e1e', '#ffffff', 1024, 96), -8, 2.7, -D + 0.08, 4.5, 0.42);
  decal(scene, sign('OKEY · TAVLA · BRİÇ', '#8f2f2a', '#fff3cf', 512, 96), 8.5, 2.6, -D + 0.08, 3.6, 0.68);
  const picture = canvasTex(256, 180, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 0, 180);
    g.addColorStop(0, '#f6b26b');
    g.addColorStop(1, '#5b7db1');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 180);
    ctx.fillStyle = '#2b2b3a';
    ctx.fillRect(0, 120, 256, 60);
    // generic sea + a tower silhouette
    ctx.beginPath();
    ctx.moveTo(150, 120);
    ctx.lineTo(160, 50);
    ctx.lineTo(170, 120);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(160, 50, 9, Math.PI, 0);
    ctx.fill();
    ctx.strokeStyle = '#7a5232';
    ctx.lineWidth = 14;
    ctx.strokeRect(0, 0, 256, 180);
  });
  decal(scene, picture, -W + 0.06, 2.4, -4, 1.6, 1.12, Math.PI / 2);
  decal(scene, picture, W - 0.06, 2.4, -4, 1.6, 1.12, -Math.PI / 2);

  // ceiling fans
  const fans: THREE.Group[] = [];
  for (const x of [-6, 6]) {
    const f = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0x5a3820, roughness: 0.6 });
    f.add(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.12, 10), mat));
    for (let k = 0; k < 4; k++) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.02, 0.18), mat);
      blade.position.x = 0.6;
      const arm = new THREE.Group();
      arm.rotation.y = (k * Math.PI) / 2;
      arm.add(blade);
      f.add(arm);
    }
    f.position.set(x, 3.55, 1.2);
    fans.push(f);
    scene.add(f);
  }

  // tile backs on racks (instanced) + deck stacks
  const tileGeo = new THREE.BoxGeometry(0.045, 0.065, 0.02);
  const tileMat = new THREE.MeshStandardMaterial({ color: 0xf3ead6, roughness: 0.4 });
  const MAX = TABLES.length * 4 * 22;
  const tiles = new THREE.InstancedMesh(tileGeo, tileMat, MAX);
  tiles.count = 0;
  tiles.castShadow = true;
  scene.add(tiles);
  const deckGeo = new THREE.BoxGeometry(0.16, 1, 0.07);
  const decks = new THREE.InstancedMesh(deckGeo, tileMat, TABLES.length);
  decks.count = 0;
  scene.add(decks);
  const rackCounts: (number[] | null)[] = TABLES.map(() => null);
  const deckCounts = TABLES.map(() => 0);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const rebuildTiles = () => {
    let n = 0;
    let d = 0;
    rackCounts.forEach((counts, t) => {
      if (!counts) return;
      const c = TABLES[t]!;
      counts.forEach((cnt, s) => {
        const a = (s * Math.PI) / 2;
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), a);
        for (let k = 0; k < cnt && n < MAX; k++) {
          const row = k < 11 ? 0 : 1;
          const col = (k % 11) - 5;
          const lx = col * 0.05;
          const ly = 0.81 + row * 0.03;
          const lz = 0.47 + row * 0.03;
          const wx = c.x + lx * Math.cos(a) + lz * Math.sin(a);
          const wz = c.z - lx * Math.sin(a) + lz * Math.cos(a);
          m4.compose(new THREE.Vector3(wx, ly, wz), q, new THREE.Vector3(1, 1, 1));
          tiles.setMatrixAt(n++, m4);
        }
      });
      const h = Math.max(0.02, deckCounts[t]! * 0.006);
      m4.compose(new THREE.Vector3(c.x, 0.77 + h / 2, c.z), new THREE.Quaternion(), new THREE.Vector3(1, h, 1));
      decks.setMatrixAt(d++, m4);
    });
    tiles.count = n;
    decks.count = d;
    tiles.instanceMatrix.needsUpdate = true;
    decks.instanceMatrix.needsUpdate = true;
  };

  // the çaycı
  const cayci = new Character({ color: '#f4f1e8', hat: 0, hair: 0, skin: 1 });
  cayci.setLabel('Çaycı Rıza', '#ffe7a8');
  const tray = new THREE.Group();
  const trayMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.015, 20), new THREE.MeshStandardMaterial({ color: 0xc0c4c8, metalness: 0.7, roughness: 0.3 }));
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
    // go round the counter, along the north corridor, then down an aisle
    const aisleX = to.x + (to.x > 6 || (to.x > -2 && to.x < 2) ? 2.2 : -2.2);
    return [new THREE.Vector3(5.8, 0, -6.6), new THREE.Vector3(aisleX, 0, -6.4), new THREE.Vector3(aisleX, 0, to.z), new THREE.Vector3(to.x + (aisleX - to.x) * 0.35, 0, to.z)];
  };
  const startNext = () => {
    current = queue.shift() ?? null;
    if (!current) return;
    returning = false;
    route = [new THREE.Vector3(CAYCI_SPOT.x + 1, 0, -8.6), ...plan(current.to)];
    tray.clear();
    tray.add(trayMesh);
    const d = drinkModel(current.item);
    d.position.y = 0.01;
    tray.add(d);
    tray.visible = true;
  };

  let t = 0;
  return {
    setDusk() {},
    serve(item, to, onTable) {
      queue.push({ item, to, onTable });
      if (!current) startNext();
    },
    setRacks(table, counts, deck) {
      rackCounts[table] = counts;
      deckCounts[table] = deck;
      rebuildTiles();
    },
    update(dt: number, _movers: Mover[]) {
      t += dt;
      for (const f of fans) f.rotation.y += dt * 2.4;
      // waiter
      const ch = cayci;
      if (route.length) {
        const target = route[0]!;
        const p = ch.root.position;
        const dx = target.x - p.x;
        const dz = target.z - p.z;
        const dist = Math.hypot(dx, dz);
        const step = Math.min(dist, dt * 3.4);
        if (dist < 0.05) route.shift();
        else {
          p.x += (dx / dist) * step;
          p.z += (dz / dist) * step;
          const yaw = Math.atan2(-dx, -dz);
          ch.facing += Math.atan2(Math.sin(yaw - ch.facing), Math.cos(yaw - ch.facing)) * Math.min(1, dt * 10);
          ch.root.rotation.y = ch.facing;
        }
        ch.animate(dt, 3.4, false, false);
        if (!route.length && current && !returning) {
          // arrived: put the drink down
          const d = drinkModel(current.item);
          if (current.onTable) d.position.set(current.onTable.x, 0.77, current.onTable.z);
          else d.position.set(current.to.x + 0.3, 0.02, current.to.z + 0.3);
          scene.add(d);
          served.push({ obj: d, t: 0 });
          tray.visible = false;
          returning = true;
          route = [...plan(current.to)].reverse().slice(1).concat([new THREE.Vector3(CAYCI_SPOT.x + 1, 0, -8.6), home.clone()]);
        } else if (!route.length && returning) {
          returning = false;
          current = null;
          ch.facing = Math.PI;
          ch.root.rotation.y = 0;
          startNext();
        }
      } else {
        ch.root.rotation.y = 0;
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
      void hash;
      void MENU;
    },
  };
}
