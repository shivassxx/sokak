import { COLLIDERS, MAP_HALF, type Aabb } from './map';

/**
 * Simple deterministic kinematic movement shared by client (prediction)
 * and server (authority). Player = vertical box (square footprint).
 */
export const PLAYER_RADIUS = 0.35;
export const PLAYER_HEIGHT = 1.8;
export const STEP_HEIGHT = 0.5;
export const WALK_SPEED = 5.0;
export const SPRINT_SPEED = 7.4;
export const CROUCH_SPEED = 2.4;
/** stamina drained per second while sprinting (full bar ≈ 3.6 s) */
export const STAMINA_DRAIN = 0.28;
/** stamina regained per second when not sprinting */
export const STAMINA_REGEN = 0.2;
/** once exhausted, sprint is locked until stamina is back to this */
export const STAMINA_RECOVER = 0.35;
export const GRAVITY = 22;
export const JUMP_SPEED = 7;
/** Fixed simulation step (seconds); one input = one step. */
export const SIM_DT = 0.05;

export interface Body {
  x: number;
  y: number;
  z: number;
  vy: number;
  onGround: boolean;
  /** 0..1 sprint stamina */
  stamina: number;
  /** exhausted: cannot sprint until stamina ≥ STAMINA_RECOVER */
  tired: boolean;
}

export interface MoveInput {
  /** world-space desired direction, length ≤ 1 */
  mx: number;
  mz: number;
  jump: boolean;
  crouch: boolean;
  /** hold to sprint (costs stamina) */
  sprint?: boolean;
}

export const NO_INPUT: MoveInput = { mx: 0, mz: 0, jump: false, crouch: false };

export function createBody(x: number, z: number, y = 0): Body {
  return { x, y, z, vy: 0, onGround: true, stamina: 1, tired: false };
}

/** Is this body currently sprinting with this input? (pure) */
export function isSprinting(body: Body, input: MoveInput): boolean {
  return !!input.sprint && !input.crouch && !body.tired && body.stamina > 0 && Math.hypot(input.mx, input.mz) > 0.3;
}

/** Uniform grid over solid colliders to keep queries cheap. */
const CELL = 8;
const GRID_N = Math.ceil((MAP_HALF * 2 + 4) / CELL);
const grid: Aabb[][] = Array.from({ length: GRID_N * GRID_N }, () => []);
const cellOf = (v: number) => Math.min(GRID_N - 1, Math.max(0, Math.floor((v + MAP_HALF + 2) / CELL)));

for (const c of COLLIDERS) {
  if (!c.solid) continue;
  for (let gx = cellOf(c.minX); gx <= cellOf(c.maxX); gx++) {
    for (let gz = cellOf(c.minZ); gz <= cellOf(c.maxZ); gz++) grid[gz * GRID_N + gx]!.push(c);
  }
}

const scratch = new Set<Aabb>();

/** Solid colliders whose footprint may overlap the given rect. */
export function solidsNear(minX: number, maxX: number, minZ: number, maxZ: number): Set<Aabb> {
  scratch.clear();
  for (let gx = cellOf(minX); gx <= cellOf(maxX); gx++) {
    for (let gz = cellOf(minZ); gz <= cellOf(maxZ); gz++) {
      for (const c of grid[gz * GRID_N + gx]!) scratch.add(c);
    }
  }
  return scratch;
}

function overlapsXZ(c: Aabb, x: number, z: number, r: number): boolean {
  return x + r > c.minX && x - r < c.maxX && z + r > c.minZ && z - r < c.maxZ;
}

function blocksAt(c: Aabb, y: number, stepAllowance: number): boolean {
  return c.minY < y + PLAYER_HEIGHT && c.maxY > y + stepAllowance;
}

/** Highest walkable surface under the footprint that is at most `maxTop`. */
export function groundHeight(x: number, z: number, maxTop: number): number {
  let g = 0;
  const r = PLAYER_RADIUS;
  for (const c of solidsNear(x - r, x + r, z - r, z + r)) {
    if (c.maxY <= maxTop + 1e-6 && c.maxY > g && overlapsXZ(c, x, z, r)) g = c.maxY;
  }
  return g;
}

const EPS = 1e-4;

/** Advance a body by one fixed step. Mutates `body`. */
export function stepBody(body: Body, input: MoveInput, dt: number = SIM_DT): void {
  let mx = input.mx;
  let mz = input.mz;
  const len = Math.hypot(mx, mz);
  if (len > 1) {
    mx /= len;
    mz /= len;
  }
  const sprinting = isSprinting(body, input);
  if (sprinting) {
    body.stamina = Math.max(0, body.stamina - STAMINA_DRAIN * dt);
    if (body.stamina === 0) body.tired = true;
  } else {
    body.stamina = Math.min(1, body.stamina + STAMINA_REGEN * dt);
    if (body.tired && body.stamina >= STAMINA_RECOVER) body.tired = false;
  }
  const speed = input.crouch ? CROUCH_SPEED : sprinting ? SPRINT_SPEED : WALK_SPEED;
  const r = PLAYER_RADIUS;
  const allowance = body.onGround ? STEP_HEIGHT : 0.05;

  // --- horizontal, axis separated
  const dx = mx * speed * dt;
  const dz = mz * speed * dt;
  const near = [...solidsNear(body.x - r - 1, body.x + r + 1, body.z - r - 1, body.z + r + 1)];

  if (dx !== 0) {
    body.x += dx;
    for (const c of near) {
      if (!blocksAt(c, body.y, allowance) || !overlapsXZ(c, body.x, body.z, r)) continue;
      body.x = dx > 0 ? c.minX - r - EPS : c.maxX + r + EPS;
    }
  }
  if (dz !== 0) {
    body.z += dz;
    for (const c of near) {
      if (!blocksAt(c, body.y, allowance) || !overlapsXZ(c, body.x, body.z, r)) continue;
      body.z = dz > 0 ? c.minZ - r - EPS : c.maxZ + r + EPS;
    }
  }
  const lim = MAP_HALF - r;
  body.x = Math.max(-lim, Math.min(lim, body.x));
  body.z = Math.max(-lim, Math.min(lim, body.z));

  // --- vertical
  if (input.jump && body.onGround && !input.crouch) {
    body.vy = JUMP_SPEED;
    body.onGround = false;
  }
  body.vy -= GRAVITY * dt;
  let ny = body.y + body.vy * dt;

  if (body.vy > 0) {
    for (const c of near) {
      if (c.minY >= body.y + PLAYER_HEIGHT - EPS && ny + PLAYER_HEIGHT > c.minY && overlapsXZ(c, body.x, body.z, r)) {
        ny = c.minY - PLAYER_HEIGHT;
        body.vy = 0;
      }
    }
  }

  const ground = groundHeight(body.x, body.z, body.y + allowance);
  if (ny <= ground) {
    ny = ground;
    body.vy = 0;
    body.onGround = true;
  } else if (body.onGround && body.vy <= 0 && ground >= body.y - STEP_HEIGHT) {
    // walking down steps: stick to the ground
    ny = ground;
    body.vy = 0;
  } else {
    body.onGround = false;
  }
  body.y = ny;
}

export function cloneBody(b: Body): Body {
  return { x: b.x, y: b.y, z: b.z, vy: b.vy, onGround: b.onGround, stamina: b.stamina, tired: b.tired };
}
