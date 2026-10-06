import { COLLIDERS, type Aabb } from './map';

/** Max distance at which the Ebe receives hider positions at all. */
export const VIEW_RANGE = 34;
/** Max distance for a valid "Gördüm!". */
export const SPOT_RANGE = 20;
/** Within this distance a hider is always seen. */
export const TOUCH_RANGE = 1.8;
export const EYE_HEIGHT = 1.6;
export const CROUCH_EYE_HEIGHT = 0.95;

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

const OPAQUE: readonly Aabb[] = COLLIDERS.filter((c) => c.opaque);

/** Does the segment a→b intersect the box (slab method)? */
export function segmentHitsBox(a: Vec3, b: Vec3, c: Aabb): boolean {
  return segmentEntryT(a, b, c) >= 0;
}

export function lineOfSight(a: Vec3, b: Vec3, blockers: readonly Aabb[] = OPAQUE): boolean {
  const minX = Math.min(a.x, b.x);
  const maxX = Math.max(a.x, b.x);
  const minZ = Math.min(a.z, b.z);
  const maxZ = Math.max(a.z, b.z);
  for (const c of blockers) {
    if (c.maxX < minX || c.minX > maxX || c.maxZ < minZ || c.minZ > maxZ) continue;
    if (segmentHitsBox(a, b, c)) return false;
  }
  return true;
}

export interface Viewer {
  x: number;
  y: number;
  z: number;
}

export interface Target {
  x: number;
  y: number;
  z: number;
  crouch: boolean;
}

/** Sample points on a target's body (feet-relative heights). */
function samples(t: Target): number[] {
  return t.crouch ? [0.85, 0.45] : [1.55, 1.0, 0.4];
}

/**
 * Server-side visibility check: within range and at least one sample point
 * of the target's body has a clear ray from the viewer's eye.
 */
export function canSee(viewer: Viewer, target: Target, range: number = VIEW_RANGE): boolean {
  const dx = target.x - viewer.x;
  const dz = target.z - viewer.z;
  const d2 = dx * dx + dz * dz;
  if (d2 > range * range) return false;
  // standing right next to someone always reveals them (even inside a bush)
  if (d2 < TOUCH_RANGE * TOUCH_RANGE && Math.abs(target.y - viewer.y) < 2) return true;
  const eye = { x: viewer.x, y: viewer.y + EYE_HEIGHT, z: viewer.z };
  for (const h of samples(target)) {
    if (lineOfSight(eye, { x: target.x, y: target.y + h, z: target.z })) return true;
  }
  return false;
}

/** Entry parameter t∈[0,1] of segment a→b into the box, or -1 if no hit. */
export function segmentEntryT(a: Vec3, b: Vec3, c: Aabb): number {
  let t0 = 0;
  let t1 = 1;
  const d = [b.x - a.x, b.y - a.y, b.z - a.z];
  const o = [a.x, a.y, a.z];
  const mn = [c.minX, c.minY, c.minZ];
  const mx = [c.maxX, c.maxY, c.maxZ];
  for (let i = 0; i < 3; i++) {
    const di = d[i]!;
    const oi = o[i]!;
    if (Math.abs(di) < 1e-9) {
      if (oi < mn[i]! || oi > mx[i]!) return -1;
      continue;
    }
    let ta = (mn[i]! - oi) / di;
    let tb = (mx[i]! - oi) / di;
    if (ta > tb) [ta, tb] = [tb, ta];
    if (ta > t0) t0 = ta;
    if (tb < t1) t1 = tb;
    if (t0 > t1) return -1;
  }
  return t0;
}
