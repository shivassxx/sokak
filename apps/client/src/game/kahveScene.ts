import * as THREE from 'three';
import { CAYCI_SPOT, KAHVE_COLLIDERS, KAHVE_HALF, REGULAR_SEATS, SEA_Z, SHOPS, TABLES, TAVLA_TABLES, tavlaSeatPosition, VAPUR_DECK_Y, type TableView, type TvBroadcast } from '@sokak/shared';
import type { TavlaView } from '@sokak/tavla';
import { BOARD_Y, TavlaPieces } from './tavlaBoard';
import type { OkeyCtx } from '@sokak/okey';
import { canvasTex, type Mover, type World } from './world';
import { Character, realAvatarOr, type RealAvatar } from './character';
import { fishingRod, itemModel } from './items';
import { RACK_DIST, TABLE_TOP } from './kahveProps';
import { buildKahveWorld } from './kahveWorld';
import { NavGrid } from './navGrid';
import { TILE_H, TILE_T, TILE_W, TileField, cellOf, setAtlasOkey } from './okeyTiles';
import { initialQuality } from './postfx';

/**
 * The okey world's live parts on top of `kahveWorld`: real tiles on every
 * table (with anchors for the seated UI and the seat camera), the regulars
 * (tavla players, fishermen, shop keepers) and Çaycı Rıza walking the orders.
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
  /** keep the sun's shadow box on the player */
  follow(x: number, z: number): void;
  /** throw a piece of simit to the gulls from (x, z); y = feet height (the vapur's deck) */
  feedGulls(x: number, z: number, y?: number): void;
  /** server clock for the shared vapur timeline and the TV */
  setClock(clock: () => number): void;
  /** the derby on the kıraathane TVs (null = normal programme) */
  setTv(b: TvBroadcast | null): void;
  /** false while the real stream is watched in the 2D overlay */
  setTvAudio(on: boolean): void;
  /** a goal on the TV: the regulars jump up and the çaycı waves */
  tvGoal(): void;
  /** waiter brings `item` to a world position; drink stays on the table */
  serve(item: string, to: THREE.Vector3, onTable: { x: number; z: number } | null): void;
  /**
   * public table state (null = no game); viewerSeat hides that rack and orients the tiles,
   * refSeat only orients them (a spectator's side)
   */
  setTable(table: number, view: TableView | null, viewerSeat: number | null, refSeat?: number): void;
  /** spectator camera: above and behind `side`, looking down on the whole table */
  watchView(table: number, side: number): { pos: THREE.Vector3; target: THREE.Vector3; fov: number };
  anchors(table: number): TableAnchors | null;
  /** live tavla table state (null = no game: the board shows the starting position) */
  setTavla(table: number, view: TavlaView | null): void;
  /** camera pose for playing tavla at a seat: behind and above the chair, looking down at the board */
  tavlaView(table: number, seat: number): { pos: THREE.Vector3; target: THREE.Vector3; fov: number };
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

/** walking lanes on the sahil: between the planters and the benches, and between the benches and the railing */
const PROMENADE_LANE_A = 24.8;
const PROMENADE_LANE_B = 29.8;

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
  const world = buildKahveWorld(scene, renderer, quality);
  const tavla = new TavlaPieces(scene);

  // -------------------------------------------------------------- tiles on every table
  const field = new TileField(1800);
  scene.add(field.mesh);
  const tableState: { view: TableView | null; viewer: number | null; ref: number }[] = TABLES.map(() => ({ view: null, viewer: null, ref: 0 }));
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

  const layoutTable = (t: number, view: TableView, viewer: number | null, refSeat = 0): TableAnchors => {
    const ctx: OkeyCtx = { okey: view.okey as OkeyCtx['okey'] };
    const ref = viewer ?? refSeat;
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
      anchors[t] = st.view ? layoutTable(t, st.view, st.viewer, st.ref) : null;
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
    pose: 'sit' | 'sitThink' | 'drink' | 'read' | 'doze' | 'fish' | 'stand';
  }
  const regulars: Regular[] = [];
  // the regulars: older men from the avatar set, in turn
  const AMCAS: RealAvatar[] = ['m14', 'm03', 'm05', 'm02', 'm08'];
  let amca = 0;
  const addRegular = (x: number, y: number, z: number, yaw: number, pose: Regular['pose'], look: { color: string; skin: number; hat: number }, extra: Record<string, unknown>) => {
    const ch = new Character({ color: look.color, hat: look.hat, hair: 0, skin: look.skin }, { adult: true, extra: { moustache: true, ...extra }, real: realAvatarOr((extra.real as RealAvatar | undefined) ?? AMCAS[amca++ % AMCAS.length]!) });
    ch.root.position.set(x, y, z);
    ch.root.rotation.y = ch.facing = yaw;
    ch.pose = pose === 'stand' ? 'none' : pose;
    scene.add(ch.root);
    regulars.push({ ch, pose });
    return ch;
  };
  // the regulars on their chairs along the side walls: prayer beads, a bald one, the paper reader, the dozer
  const [r0, r1, r2, r3] = REGULAR_SEATS as [(typeof REGULAR_SEATS)[number], (typeof REGULAR_SEATS)[number], (typeof REGULAR_SEATS)[number], (typeof REGULAR_SEATS)[number]];
  const amca0 = addRegular(r0.x, 0, r0.z, r0.yaw, 'sitThink', { color: '#7b6a58', skin: 1, hat: 1 }, { grey: true, shirtStyle: 3, tespih: true });
  const amca1 = addRegular(r1.x, 0, r1.z, r1.yaw, 'sit', { color: '#3f5f7a', skin: 2, hat: 0 }, { bald: true, shirtStyle: 2 });
  const reader = addRegular(r2.x, 0, r2.z, r2.yaw, 'read', { color: '#d9d2c0', skin: 0, hat: 0 }, { glasses: true, grey: true, shirtStyle: 3, vest: '#4a4a4a' });
  const amca3 = addRegular(r3.x, 0, r3.z, r3.yaw, 'doze', { color: '#8a5a3a', skin: 3, hat: 1 }, { shirtStyle: 3 });
  /** goal reactions: the hall's regulars jump up for a few seconds, then sit back in their old pose */
  const cheers: { ch: Character; pose: Character['pose']; at: number; until: number }[] = [];
  const hallRegulars = [amca0, amca1, reader, amca3];
  // fishermen at the sea railing
  for (const [x, c] of [
    [-24, '#4a5a3a'],
    [-15.5, '#8a6a4a'],
    [24.5, '#3f5f7a'],
  ] as const) {
    const f = addRegular(x, 0, SEA_Z - 0.55, Math.PI, 'fish', { color: c, skin: 1, hat: 1 }, { grey: x > 0, shirtStyle: 3 });
    f.hold(fishingRod());
  }
  // shop keepers
  for (const sh of SHOPS) {
    if (sh.deck) continue;
    addRegular(sh.seller.x, 0, sh.seller.z, sh.seller.yaw, 'stand', { color: sh.id === 'market' ? '#2e8b57' : '#f4f1e8', skin: 2, hat: sh.id === 'simitci' ? 1 : 0 }, { shirtStyle: 3, apron: true, real: sh.id === 'market' ? 'm01' : 'm08' }).setLabel(sh.id === 'market' ? 'Bakkal Hasan' : 'Simitçi Cemal', '#ffe7a8');
  }
  // the vapur's çaycı rides along on the stern deck (a child of the boat)
  const boat = scene.getObjectByName('vapur-caller');
  for (const sh of SHOPS) {
    if (!sh.deck || !boat) continue;
    const ch = addRegular(sh.seller.x, VAPUR_DECK_Y, sh.seller.z, sh.seller.yaw, 'stand', { color: '#f4f1e8', skin: 1, hat: 0 }, { shirtStyle: 3, vest: '#2b2b2b', real: 'm14' });
    ch.setLabel('Vapur çaycısı', '#ffe7a8');
    ch.hold(itemModel('cay'));
    boat.add(ch.root);
  }
  const paper = new THREE.Mesh(
    new THREE.PlaneGeometry(0.42, 0.3),
    new THREE.MeshStandardMaterial({
      side: THREE.DoubleSide,
      map: canvasTex(256, 180, (ctx) => {
        ctx.fillStyle = '#f0ebe0';
        ctx.fillRect(0, 0, 256, 180);
        ctx.fillStyle = '#222';
        ctx.font = '800 26px serif';
        ctx.fillText('ÜSKÜDAR GAZETESİ', 10, 32);
        for (let y = 50; y < 175; y += 10) ctx.fillRect(10 + ((y * 7) % 3) * 4, y, 110 - ((y * 13) % 20), 4), ctx.fillRect(136, y, 108 - ((y * 11) % 18), 4);
      }),
    }),
  );
  // strollers on the sahil: up and down two lanes, a few with a simit or a çay in hand
  const walkers: { ch: Character; x0: number; x1: number; dir: number; speed: number; pause: number }[] = [];
  const STROLL: { z: number; x0: number; x1: number; look: { color: string; hat: number; hair: number; skin: number }; extra: Record<string, unknown>; item?: string }[] = [
    { z: PROMENADE_LANE_A, x0: -44, x1: 28, look: { color: '#c0392b', hat: 0, hair: 2, skin: 1 }, extra: { moustache: false, shirtStyle: 1 }, item: 'simit' },
    { z: PROMENADE_LANE_B, x0: -28, x1: 26, look: { color: '#2f6fb0', hat: 0, hair: 1, skin: 0 }, extra: { moustache: true, shirtStyle: 2, glasses: true }, item: 'cay' },
    { z: PROMENADE_LANE_A, x0: -30, x1: 20, look: { color: '#e9c46a', hat: 0, hair: 3, skin: 2 }, extra: { moustache: false, shirtStyle: 0 } },
    { z: PROMENADE_LANE_B, x0: -24, x1: 24, look: { color: '#6a4c93', hat: 1, hair: 0, skin: 3 }, extra: { moustache: true, grey: true, shirtStyle: 3, vest: '#3a3a3a' } },
    { z: PROMENADE_LANE_A, x0: -40, x1: 10, look: { color: '#2e8b57', hat: 0, hair: 4, skin: 1 }, extra: { moustache: false, shirtStyle: 1 }, item: 'dondurma' },
  ];
  STROLL.slice(0, quality === 'low' ? 2 : STROLL.length).forEach((s, i) => {
    const ch = new Character(s.look, { adult: true, extra: s.extra, real: realAvatarOr((['f04', 'm08', 'f09', 'm02', 'f01'] as const)[i % 5]!) });
    const x = s.x0 + ((i * 17.3) % (s.x1 - s.x0));
    ch.root.position.set(x, 0, s.z);
    if (s.item) {
      const it = itemModel(s.item);
      if (it) ch.hold(it);
    }
    scene.add(ch.root);
    walkers.push({ ch, x0: s.x0, x1: s.x1, dir: i % 2 ? -1 : 1, speed: 1.1 + (i % 3) * 0.15, pause: 0 });
  });
  // held in front of the reader (who faces −sin(yaw), −cos(yaw))
  paper.position.set(r2.x - Math.sin(r2.yaw) * 0.3, 1.18, r2.z - Math.cos(r2.yaw) * 0.3);
  paper.rotation.set(-0.25, r2.yaw, 0, 'YXZ');
  scene.add(paper);
  void reader;
  // -------------------------------------------------------------- the çaycı
  const cayci = new Character({ color: '#f4f1e8', hat: 0, hair: 0, skin: 1 }, { adult: true, extra: { vest: '#2b2b2b', moustache: true, shirtStyle: 3 }, real: realAvatarOr('m05') });
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

  // the çaycı leaves the counter at its east end and walks a planned path to the customer
  const EXIT = new THREE.Vector3(4.2, 0, -22.6);
  const nav = new NavGrid(KAHVE_COLLIDERS, KAHVE_HALF);
  const plan = (to: THREE.Vector3): THREE.Vector3[] => {
    const pts = nav.path(EXIT, to).map((p) => new THREE.Vector3(p.x, 0, p.z));
    if (!pts.length) return [EXIT.clone()];
    // stop just short of the customer instead of walking into them
    const last = pts[pts.length - 1]!;
    const before = pts[pts.length - 2] ?? EXIT;
    const leg = last.distanceTo(to) < 0.3 ? last.distanceTo(before) : 0;
    if (leg > 0.8) last.lerp(before, 0.7 / leg);
    else if (leg > 0 && pts.length > 1) pts.pop();
    return pts;
  };
  const startNext = () => {
    current = queue.shift() ?? null;
    if (!current) return;
    returning = false;
    route = [EXIT.clone(), ...plan(current.to)];
    tray.clear();
    tray.add(trayMesh);
    const d = drinkModel(current.item);
    d.position.y = 0.01;
    tray.add(d);
    tray.visible = true;
  };

  let t = 0;
  return {
    follow(x, z) {
      world.follow(x, z);
    },
    feedGulls(x, z, y) {
      world.feedGulls(x, z, y);
    },
    setClock(clock) {
      world.setClock(clock);
    },
    setTv(b) {
      world.setTv(b);
    },
    setTvAudio(on) {
      world.setTvAudio(on);
    },
    tvGoal() {
      for (const ch of hallRegulars) {
        if (cheers.some((c) => c.ch === ch)) continue;
        const at = Math.random() * 0.6;
        cheers.push({ ch, pose: ch.pose, at, until: at + 3 + Math.random() * 1.5 });
      }
      // the çaycı waves along when he is behind the counter
      if (!route.length) cayci.playEmote('wave');
    },
    serve(item, to, onTable) {
      queue.push({ item, to, onTable });
      if (!current) startNext();
    },
    setTable(table, view, viewerSeat, refSeat = 0) {
      const st = tableState[table];
      if (!st) return;
      if (view) setAtlasOkey(view.okey as OkeyCtx['okey']);
      st.view = view;
      st.viewer = viewerSeat;
      st.ref = refSeat;
      dirty = true;
    },
    setTavla(table, view) {
      tavla.set(table, view);
    },
    tavlaView(table, seat) {
      const sp = tavlaSeatPosition(table, seat);
      const c = TAVLA_TABLES[table]!;
      const dx = sp.x - c.x;
      const dz = sp.z - c.z;
      return { pos: new THREE.Vector3(c.x + dx * 1.15, BOARD_Y + 0.85, c.z + dz * 1.15), target: new THREE.Vector3(c.x, BOARD_Y, c.z - dz * 0.05), fov: 50 };
    },
    watchView(table, side) {
      // from the empty corner to the right of `side`, so no player's head is in the way
      const yaw = seatYaw(side) + Math.PI / 4;
      return { pos: tablePoint(table, yaw, 0, TABLE_TOP + 2.0, 1.1), target: tablePoint(table, yaw, 0, TABLE_TOP - 0.1, -0.12), fov: 54 };
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
    update(dt: number, movers: Mover[]) {
      t += dt;
      if (dirty) rebuildTiles();
      drawTiles(dt);
      // the sahil strollers scare the pigeons too
      for (const w of walkers) movers.push({ x: w.ch.root.position.x, z: w.ch.root.position.z, speed: 1.2 });
      world.update(dt, movers);
      // regulars (and the hall's cheering on a goal)
      for (let i = cheers.length - 1; i >= 0; i--) {
        const c = cheers[i]!;
        c.at -= dt;
        c.until -= dt;
        if (c.until <= 0) {
          c.ch.pose = c.pose;
          cheers.splice(i, 1);
        } else if (c.at <= 0) c.ch.pose = 'celebrate';
      }
      for (const r of regulars) {
        r.ch.animate(dt, 0, false, false);
      }
      for (const w of walkers) {
        const p = w.ch.root.position;
        let speed = w.speed;
        if (w.pause > 0) {
          // a stop to look at the view, then back the other way
          w.pause -= dt;
          speed = 0;
          const look = Math.PI; // towards the sea
          w.ch.facing += Math.atan2(Math.sin(look - w.ch.facing), Math.cos(look - w.ch.facing)) * Math.min(1, dt * 3);
        } else {
          p.x += w.dir * w.speed * dt;
          if ((w.dir > 0 && p.x > w.x1) || (w.dir < 0 && p.x < w.x0)) {
            w.dir = -w.dir;
            w.pause = 2 + Math.random() * 5;
          }
          const want = w.dir > 0 ? -Math.PI / 2 : Math.PI / 2;
          w.ch.facing += Math.atan2(Math.sin(want - w.ch.facing), Math.cos(want - w.ch.facing)) * Math.min(1, dt * 5);
        }
        w.ch.root.rotation.y = w.ch.facing;
        w.ch.animate(dt, speed, false, false);
      }
      tavla.update(dt);
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
          route = [...plan(current.to)].reverse().slice(1).concat([EXIT.clone(), home.clone()]);
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
