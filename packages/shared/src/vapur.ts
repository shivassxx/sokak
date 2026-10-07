import type { Vec2 } from './geometry';
import { PIER } from './kahve';

/**
 * The Şehir Hatları vapur that calls at the Üsküdar iskele: one shared timeline
 * for the server and every client, derived from absolute time (epoch ms), so
 * everybody sees the boat in the same place and the server can validate boarding.
 *
 * Cycle: docked at the pier (boarding / alighting) → sails out east, swings
 * south and west, loops round Kız Kulesi and comes back to dock.
 *
 * Boat frame ("deck-local"): bow at +x, starboard at +z, origin at the hull's
 * centre on the waterline group (the client model's group). World pose:
 * rotation.y = yaw, i.e. local (x, z) → world (x cosψ + z sinψ, −x sinψ + z cosψ).
 */

/** docked at the pier, in seconds */
export const VAPUR_DOCKED_S = 30;
/** at sea (leave → loop round the tower → back), in seconds */
export const VAPUR_SAIL_S = 95;
export const VAPUR_CYCLE_MS = (VAPUR_DOCKED_S + VAPUR_SAIL_S) * 1000;
/** the hull group's y (waterline) */
export const VAPUR_Y = -1.1;
/** upper (open) deck surface height above the group origin */
export const VAPUR_DECK_Y = 4.82;
export const VAPUR_LENGTH = 36;
export const VAPUR_BEAM = 8;
/** where the vapur lies when docked: alongside the pier's sea face */
export const VAPUR_DOCK: Vec2 = { x: (PIER.x0 + PIER.x1) / 2, z: PIER.z1 + 5 };
/** Kız Kulesi (centre of the islet) */
export const KIZ_KULESI: Vec2 = { x: -30, z: 128 };
/** where you board / get off: on the promenade at the pier's sea end, by the gate */
export const BOARD_SPOT: Vec2 & { yaw: number } = { x: PIER.x0 - 0.9, z: 32.6, yaw: Math.PI / 2 };
export const BOARD_REACH = 3.2;
/** deck walking speed (m/s) */
export const DECK_SPEED = 2.6;

export type VapurPhase = 'docked' | 'leaving' | 'cruise' | 'arriving';

export interface VapurState {
  phase: VapurPhase;
  x: number;
  /** the group's y (waterline + a gentle bob) */
  y: number;
  z: number;
  yaw: number;
  /** boarding / getting off allowed */
  boardable: boolean;
  /** seconds into the cycle (0 = just docked) */
  t: number;
  /** docked: seconds until it leaves; at sea: seconds until it docks again */
  eta: number;
}

// ---------------------------------------------------------------- the route
/**
 * Closed Catmull-Rom loop starting (and ending) at the dock. The neighbours of the dock
 * have the same z, so the tangent there is exactly +x (yaw 0): the boat lies straight
 * alongside the pier and leaves / arrives without a jump.
 */
const ROUTE: readonly Vec2[] = [
  VAPUR_DOCK,
  { x: 80, z: 43.6 },
  { x: 110, z: 57 },
  { x: 124, z: 86 },
  { x: 128, z: 128 },
  { x: 92, z: 178 },
  { x: 25, z: 196 },
  { x: -30, z: 178 },
  { x: -76, z: 158 },
  { x: -84, z: 112 },
  { x: -62, z: 80 },
  { x: -28, z: 60 },
  { x: 0, z: 43.6 },
];
const SAMPLES_PER_SEG = 48;
const PTS: { x: number; z: number; s: number }[] = [];
{
  const n = ROUTE.length;
  let s = 0;
  for (let i = 0; i < n; i++) {
    const p0 = ROUTE[(i - 1 + n) % n]!;
    const p1 = ROUTE[i]!;
    const p2 = ROUTE[(i + 1) % n]!;
    const p3 = ROUTE[(i + 2) % n]!;
    for (let k = 0; k < SAMPLES_PER_SEG; k++) {
      const u = k / SAMPLES_PER_SEG;
      const u2 = u * u;
      const u3 = u2 * u;
      const cr = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * u + (2 * a - 5 * b + 4 * c - d) * u2 + (-a + 3 * b - 3 * c + d) * u3);
      const x = cr(p0.x, p1.x, p2.x, p3.x);
      const z = cr(p0.z, p1.z, p2.z, p3.z);
      const prev = PTS[PTS.length - 1];
      if (prev) s += Math.hypot(x - prev.x, z - prev.z);
      PTS.push({ x, z, s });
    }
  }
  const last = PTS[PTS.length - 1]!;
  PTS.push({ x: VAPUR_DOCK.x, z: VAPUR_DOCK.z, s: s + Math.hypot(VAPUR_DOCK.x - last.x, VAPUR_DOCK.z - last.z) });
}
/** length of the loop in metres */
export const VAPUR_ROUTE_LENGTH = PTS[PTS.length - 1]!.s;

function pointAt(s: number, out: { x: number; z: number }): void {
  s = Math.max(0, Math.min(VAPUR_ROUTE_LENGTH, s));
  let lo = 0;
  let hi = PTS.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (PTS[mid]!.s <= s) lo = mid;
    else hi = mid;
  }
  const a = PTS[lo]!;
  const b = PTS[hi]!;
  const k = b.s > a.s ? (s - a.s) / (b.s - a.s) : 0;
  out.x = a.x + (b.x - a.x) * k;
  out.z = a.z + (b.z - a.z) * k;
}

/** share of the sailing time spent speeding up (and again slowing down) */
const RAMP = 0.16;
/** distance along the loop (0…1) for sailing progress u (0…1): trapezoidal speed profile */
function progress(u: number): number {
  const v = 1 / (1 - RAMP);
  if (u <= 0) return 0;
  if (u >= 1) return 1;
  if (u < RAMP) return (v * u * u) / (2 * RAMP);
  if (u > 1 - RAMP) return 1 - (v * (1 - u) * (1 - u)) / (2 * RAMP);
  return v * (RAMP / 2 + u - RAMP);
}
/** top speed in m/s */
export const VAPUR_TOP_SPEED = VAPUR_ROUTE_LENGTH / (VAPUR_SAIL_S * (1 - RAMP));

const _a = { x: 0, z: 0 };
const _b = { x: 0, z: 0 };

/** Where the vapur is at absolute time `timeMs` (epoch ms, server clock). */
export function vapurState(timeMs: number): VapurState {
  const cyc = ((timeMs % VAPUR_CYCLE_MS) + VAPUR_CYCLE_MS) % VAPUR_CYCLE_MS;
  const t = cyc / 1000;
  const y = VAPUR_Y + Math.sin((timeMs / 1000) * 0.9) * 0.06;
  if (t < VAPUR_DOCKED_S) return { phase: 'docked', x: VAPUR_DOCK.x, y, z: VAPUR_DOCK.z, yaw: 0, boardable: true, t, eta: VAPUR_DOCKED_S - t };
  const u = (t - VAPUR_DOCKED_S) / VAPUR_SAIL_S;
  const s = progress(u) * VAPUR_ROUTE_LENGTH;
  pointAt(s, _a);
  // heading from a short chord around the point (ends: one-sided, the tangent there is +x)
  pointAt(s + 1.5, _b);
  const bx = _b.x;
  const bz = _b.z;
  pointAt(s - 1.5, _b);
  let dx = bx - _b.x;
  let dz = bz - _b.z;
  if (Math.hypot(dx, dz) < 1e-6) (dx = 1), (dz = 0);
  const phase: VapurPhase = u < RAMP ? 'leaving' : u > 1 - RAMP ? 'arriving' : 'cruise';
  return { phase, x: _a.x, y, z: _a.z, yaw: Math.atan2(-dz, dx), boardable: false, t, eta: VAPUR_DOCKED_S + VAPUR_SAIL_S - t };
}

/** Deck-local point → world (x, y, z) for the vapur pose `v`. */
export function deckToWorld(v: Pick<VapurState, 'x' | 'y' | 'z' | 'yaw'>, lx: number, lz: number, out: { x: number; y: number; z: number } = { x: 0, y: 0, z: 0 }): { x: number; y: number; z: number } {
  const c = Math.cos(v.yaw);
  const s = Math.sin(v.yaw);
  out.x = v.x + lx * c + lz * s;
  out.y = v.y + VAPUR_DECK_Y;
  out.z = v.z - lx * s + lz * c;
  return out;
}

/** A world-frame direction (e.g. a move input) into the deck frame of a boat with heading `yaw`. */
export function worldDirToDeck(yaw: number, wx: number, wz: number): { x: number; z: number } {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  return { x: wx * c - wz * s, z: wx * s + wz * c };
}

// ---------------------------------------------------------------- the open upper deck
interface Rect {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}
/**
 * Walkable parts of the upper deck (deck-local): the open stern deck behind the
 * upper cabin and the narrow walkways along both rails.
 */
export const DECK_AREAS: readonly Rect[] = [
  { x0: -14.3, x1: -10.9, z0: -3.45, z1: 3.45 },
  { x0: -11.2, x1: 9.4, z0: 3.15, z1: 3.45 },
  { x0: -11.2, x1: 9.4, z0: -3.45, z1: -3.15 },
];

export function onDeck(x: number, z: number): boolean {
  return DECK_AREAS.some((r) => x >= r.x0 - 1e-6 && x <= r.x1 + 1e-6 && z >= r.z0 - 1e-6 && z <= r.z1 + 1e-6);
}

/** Nearest walkable deck point. */
export function clampToDeck(x: number, z: number): { x: number; z: number } {
  let best = { x, z };
  let bd = Infinity;
  for (const r of DECK_AREAS) {
    const cx = Math.max(r.x0, Math.min(r.x1, x));
    const cz = Math.max(r.z0, Math.min(r.z1, z));
    const d = (cx - x) ** 2 + (cz - z) ** 2;
    if (d < bd) (bd = d), (best = { x: cx, z: cz });
  }
  return best;
}

export interface DeckPos {
  x: number;
  z: number;
}

/**
 * One fixed step of walking on the deck. `mx`, `mz` is the move input already in the
 * deck frame (the client converts its camera-relative input with the boat's heading),
 * so server and client step identically.
 */
export function stepDeck(p: DeckPos, mx: number, mz: number, dt: number): void {
  const len = Math.hypot(mx, mz);
  if (len < 0.05) return;
  const k = (DECK_SPEED * Math.min(1, len)) / len;
  // slide along the walkway edges: try the full step, then each axis on its own
  const nx = p.x + mx * k * dt;
  const nz = p.z + mz * k * dt;
  if (onDeck(nx, nz)) {
    p.x = nx;
    p.z = nz;
    return;
  }
  const c = clampToDeck(nx, nz);
  // only accept the clamped point if it is a move along the deck (no jumps between walkways)
  if (Math.hypot(c.x - p.x, c.z - p.z) <= DECK_SPEED * dt + 1e-6) {
    p.x = c.x;
    p.z = c.z;
  }
}

/** Where the k-th rider appears when boarding: along the stern rail and the pier-side walkway. */
export function deckSpot(k: number): DeckPos & { yaw: number } {
  const stern = [
    { x: -13.6, z: -2.4 },
    { x: -13.6, z: -0.8 },
    { x: -13.6, z: 0.8 },
    { x: -13.6, z: 2.4 },
    { x: -12.2, z: -1.6 },
    { x: -12.2, z: 1.6 },
  ];
  if (k < stern.length) return { ...stern[k]!, yaw: Math.PI / 2 }; // facing aft (−x)
  const j = k - stern.length;
  // walkways, alternating sides, 1.4 m apart
  const x = -9.8 + (Math.floor(j / 2) % 14) * 1.4;
  return { x, z: j % 2 ? 3.3 : -3.3, yaw: j % 2 ? Math.PI : 0 };
}

/** Sea-ward points the gulls and the HUD use: is the vapur near the tower right now? */
export function vapurNearTower(v: Pick<VapurState, 'x' | 'z'>, within = 90): boolean {
  return Math.hypot(v.x - KIZ_KULESI.x, v.z - KIZ_KULESI.z) < within;
}
