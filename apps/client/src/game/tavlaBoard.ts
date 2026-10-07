import * as THREE from 'three';
import { TAVLA_TABLES, tavlaSeatPosition } from '@sokak/shared';
import { startPosition, type TavlaView } from '@sokak/tavla';
import { canvasTex, type Builder } from './world';
import { PAT } from './materials';
import { LIGHT_OAK, STEEL, WALNUT, bentwoodChair } from './kahveProps';

/**
 * The tavla tables of the lounge: static table + board (frame, inlaid points, bar) merged
 * into the world, and the live parts — every table's 30 checkers in one instanced mesh and
 * two dice per table — driven by the table state, so passers-by see the games going on.
 *
 * Board frame: long side along x, white (seat 0) sits at +z. White's point 0 is the near
 * right corner, points 0–11 run right→left along the near side, 12–23 left→right on the far side.
 */
export const TAVLA_TOP = 0.76;
const BOARD_H = 0.03;
/** playing surface height */
export const BOARD_Y = TAVLA_TOP + BOARD_H + 0.003;
const BW = 0.72;
const BD = 0.54;
const FRAME = 0.026;
const BAR_W = 0.05;
const PW = (BW - 2 * FRAME - BAR_W) / 12;
const R = PW * 0.46;
const T = 0.009;
const Z_EDGE = BD / 2 - FRAME;
const POINT_LEN = Z_EDGE - 0.03;

/** board-frame position of the k-th checker (from the edge) on point i */
function checkerLocal(i: number, k: number, out: THREE.Vector3): THREE.Vector3 {
  const near = i < 12;
  const c = near ? i : i - 12;
  const layer = Math.floor(k / 5);
  const slot = k % 5;
  const x = near ? BW / 2 - FRAME - (c + 0.5) * PW - (c >= 6 ? BAR_W : 0) : -BW / 2 + FRAME + (c + 0.5) * PW + (c >= 6 ? BAR_W : 0);
  const dz = R + slot * 2 * R + layer * R;
  return out.set(x, BOARD_Y + T / 2 + layer * T, near ? Z_EDGE - dz : -Z_EDGE + dz);
}

/** Static parts of one tavla table: pedestal table, board, inlaid points, two chairs. */
export function tavlaTable(b: Builder, i: number): void {
  const t = TAVLA_TABLES[i]!;
  b.pat = PAT.wood;
  b.cyl(t.x, 0.72, t.z, 0.48, 0.04, LIGHT_OAK, 28);
  b.pat = PAT.none;
  b.cyl(t.x, 0, t.z, 0.05, 0.72, STEEL, 8);
  b.cyl(t.x, 0, t.z, 0.28, 0.03, STEEL, 16);
  // walnut box with a raised rim and a bar down the middle
  const bucket = b.bucket;
  b.bucket = 'varnish';
  b.pat = PAT.grainX;
  b.box(t.x, TAVLA_TOP, t.z, BW, BOARD_H, BD, WALNUT);
  const rim = 0.012;
  b.box(t.x, TAVLA_TOP + BOARD_H, t.z - BD / 2 + FRAME / 2, BW, rim, FRAME, WALNUT);
  b.box(t.x, TAVLA_TOP + BOARD_H, t.z + BD / 2 - FRAME / 2, BW, rim, FRAME, WALNUT);
  b.box(t.x - BW / 2 + FRAME / 2, TAVLA_TOP + BOARD_H, t.z, FRAME, rim, BD - 2 * FRAME, WALNUT);
  b.box(t.x + BW / 2 - FRAME / 2, TAVLA_TOP + BOARD_H, t.z, FRAME, rim, BD - 2 * FRAME, WALNUT);
  b.box(t.x, TAVLA_TOP + BOARD_H, t.z, BAR_W, rim, BD - 2 * FRAME, WALNUT);
  // the two playing fields (light maple inlay)
  b.pat = PAT.none;
  const half = 6 * PW;
  for (const s of [-1, 1]) b.box(t.x + s * (BAR_W / 2 + half / 2), TAVLA_TOP + BOARD_H, t.z, half, 0.002, BD - 2 * FRAME, 0xe8d3a6);
  // inlaid triangles, alternating dark and red
  for (let p = 0; p < 24; p++) {
    const v = checkerLocal(p, 0, new THREE.Vector3());
    const near = p < 12;
    const base = near ? Z_EDGE : -Z_EDGE;
    const tip = near ? Z_EDGE - POINT_LEN : -Z_EDGE + POINT_LEN;
    const w = PW * 0.46;
    const g = new THREE.BufferGeometry();
    // counter-clockwise seen from above
    const verts = near ? [-w, 0, base, w, 0, base, 0, 0, tip] : [w, 0, base, -w, 0, base, 0, 0, tip];
    g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
    b.add(g, p % 2 ? 0x8e2c1f : 0x2e1d12, t.x + v.x, TAVLA_TOP + BOARD_H + 0.0025, t.z);
  }
  b.bucket = bucket;
  for (let s = 0; s < 2; s++) {
    const p = tavlaSeatPosition(i, s);
    bentwoodChair(b, p.x + Math.sin(p.yaw) * 0.06, p.z + Math.cos(p.yaw) * 0.06, p.yaw);
  }
}

// ------------------------------------------------------------------ dice
/** pip faces in BoxGeometry order (+x, −x, +y, −y, +z, −z); opposite faces add up to 7 */
const FACES = [1, 6, 2, 5, 3, 4];
const PIPS: Record<number, [number, number][]> = {
  1: [[0.5, 0.5]],
  2: [[0.27, 0.27], [0.73, 0.73]],
  3: [[0.25, 0.25], [0.5, 0.5], [0.75, 0.75]],
  4: [[0.27, 0.27], [0.73, 0.27], [0.27, 0.73], [0.73, 0.73]],
  5: [[0.25, 0.25], [0.75, 0.25], [0.5, 0.5], [0.25, 0.75], [0.75, 0.75]],
  6: [[0.27, 0.22], [0.73, 0.22], [0.27, 0.5], [0.73, 0.5], [0.27, 0.78], [0.73, 0.78]],
};
/** rotation that brings face `v` to the top */
const TOP: Record<number, THREE.Euler> = {
  1: new THREE.Euler(0, 0, Math.PI / 2),
  6: new THREE.Euler(0, 0, -Math.PI / 2),
  2: new THREE.Euler(0, 0, 0),
  5: new THREE.Euler(Math.PI, 0, 0),
  3: new THREE.Euler(-Math.PI / 2, 0, 0),
  4: new THREE.Euler(Math.PI / 2, 0, 0),
};
const DIE = 0.022;

function diceMaterials(): THREE.MeshStandardMaterial[] {
  return FACES.map((n) => {
    const map = canvasTex(64, 64, (ctx) => {
      ctx.fillStyle = '#f7f2e6';
      ctx.fillRect(0, 0, 64, 64);
      ctx.fillStyle = n === 1 ? '#b3261e' : '#1b1b1b';
      for (const [x, y] of PIPS[n]!) {
        ctx.beginPath();
        ctx.arc(x * 64, y * 64, n === 1 ? 9 : 6.5, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    return new THREE.MeshStandardMaterial({ map, roughness: 0.35 });
  });
}

interface TableLive {
  view: TavlaView | null;
  rollKey: string;
  /** dice animation time left (s) */
  rollT: number;
  yaw: [number, number];
}

/** Live checkers and dice on every tavla table. */
export class TavlaPieces {
  private mesh: THREE.InstancedMesh;
  private dice: THREE.Mesh[] = [];
  private tables: TableLive[];
  private dirty = true;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private v = new THREE.Vector3();
  private s = new THREE.Vector3(1, 1, 1);

  constructor(scene: THREE.Scene) {
    const n = TAVLA_TABLES.length;
    const geo = new THREE.CylinderGeometry(R, R * 0.97, T, 22);
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.32, metalness: 0.02 });
    this.mesh = new THREE.InstancedMesh(geo, mat, n * 30);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = false;
    const white = new THREE.Color(0xf1e9da);
    const black = new THREE.Color(0x2a1a12);
    for (let k = 0; k < n * 30; k++) this.mesh.setColorAt(k, k % 30 < 15 ? white : black);
    scene.add(this.mesh);
    const dgeo = new THREE.BoxGeometry(DIE, DIE, DIE);
    const dmat = diceMaterials();
    for (let k = 0; k < n * 2; k++) {
      const d = new THREE.Mesh(dgeo, dmat);
      d.castShadow = true;
      scene.add(d);
      this.dice.push(d);
    }
    this.tables = TAVLA_TABLES.map((_, i) => ({ view: null, rollKey: '', rollT: 0, yaw: [0.2 + i, -0.3 + i * 2] }));
  }

  set(table: number, view: TavlaView | null): void {
    const t = this.tables[table];
    if (!t) return;
    t.view = view;
    const key = view && view.rolled.length === 2 ? `${view.turn}:${view.rolled.join(',')}` : '';
    if (key && key !== t.rollKey) {
      t.rollT = 0.7;
      t.yaw = [Math.random() * 6, Math.random() * 6];
    }
    t.rollKey = key;
    this.dirty = true;
  }

  update(dt: number): void {
    let anim = false;
    for (const t of this.tables) {
      if (t.rollT > 0) {
        t.rollT = Math.max(0, t.rollT - dt);
        anim = true;
      }
    }
    if (this.dirty) this.writeCheckers();
    if (this.dirty || anim) this.writeDice();
    this.dirty = false;
  }

  private writeCheckers(): void {
    this.tables.forEach((t, ti) => {
      const c = TAVLA_TABLES[ti]!;
      const p = t.view ?? { ...startPosition() };
      const next = [0, 15];
      const put = (side: number, lx: number, y: number, lz: number) => {
        const k = ti * 30 + next[side]!++;
        if (next[side]! > (side ? 30 : 15)) return;
        this.m.compose(this.v.set(c.x + lx, y, c.z + lz), this.q.identity(), this.s);
        this.mesh.setMatrixAt(k, this.m);
      };
      for (let i = 0; i < 24; i++) {
        const n = Math.abs(p.board[i]!);
        const side = p.board[i]! > 0 ? 0 : 1;
        for (let k = 0; k < n; k++) {
          checkerLocal(i, k, this.v);
          put(side, this.v.x, this.v.y, this.v.z);
        }
      }
      // on the bar: white in the far half (it re-enters there), black in the near half
      for (const side of [0, 1]) {
        for (let k = 0; k < p.bar[side]!; k++) put(side, 0, BOARD_Y + T / 2 + 0.012, (side ? 1 : -1) * (0.04 + (k % 4) * 2 * R + Math.floor(k / 4) * R));
        // borne off: stacked in piles of five beside the board, next to the owner's home
        for (let k = 0; k < p.off[side]!; k++) put(side, BW / 2 + 0.04, TAVLA_TOP + T / 2 + (k % 5) * T, (side ? -1 : 1) * (0.2 - Math.floor(k / 5) * 2.2 * R));
      }
      // anything unaccounted for (never in a sane state) is hidden under the table
      for (const side of [0, 1]) while (next[side]! < (side ? 30 : 15)) put(side, 0, -1, 0);
    });
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  private writeDice(): void {
    const e = new THREE.Euler();
    const qy = new THREE.Quaternion();
    this.tables.forEach((t, ti) => {
      const c = TAVLA_TABLES[ti]!;
      const v = t.view;
      const rolled = v && v.rolled.length === 2 && v.phase !== 'ended' ? v.rolled : null;
      for (let k = 0; k < 2; k++) {
        const d = this.dice[ti * 2 + k]!;
        if (!rolled) {
          // resting beside the board
          d.position.set(c.x - BW / 2 - 0.05, TAVLA_TOP + DIE / 2, c.z + (k ? 0.03 : -0.03));
          d.quaternion.setFromEuler(TOP[k ? 5 : 3]!);
          continue;
        }
        // in the right-hand half of whoever rolled
        const dir = v!.turn === 0 ? 1 : -1;
        const fx = dir * (BAR_W / 2 + 3 * PW) + (k ? 0.03 : -0.03) * dir;
        const fz = (k ? -0.02 : 0.03) * dir;
        const a = t.rollT / 0.7;
        d.position.set(c.x + fx + dir * a * 0.12, BOARD_Y + DIE / 2 + Math.sin(a * Math.PI) * 0.08, c.z + fz + dir * a * 0.18);
        qy.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, t.yaw[k]! + a * 6);
        this.q.setFromEuler(TOP[rolled[k]!]!);
        if (a > 0) this.q.multiply(new THREE.Quaternion().setFromEuler(e.set(a * 9 + k, a * 7, a * 5)));
        d.quaternion.copy(qy).multiply(this.q);
        // a played die shrinks a little (doubles: the first die stands for the first two moves)
        const r = v!.dice.length;
        const used = rolled[0] === rolled[1] ? (k === 0 ? r <= 2 : r === 0) : !v!.dice.includes(rolled[k]!);
        d.scale.setScalar(used ? 0.85 : 1);
      }
    });
  }
}
