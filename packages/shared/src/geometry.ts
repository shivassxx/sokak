/**
 * Shared geometry for the kahvehane world: axis-aligned boxes, laid out on the ground plane.
 * Coordinates: x = east, z = south, y = up.
 */
export interface Vec2 {
  x: number;
  z: number;
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** A box-shaped object of the world. `solid` blocks movement, `opaque` blocks the camera. */
export interface MapObject<K extends string = string> {
  kind: K;
  /** center x/z */
  x: number;
  z: number;
  /** size along x / z */
  w: number;
  d: number;
  /** bottom y and height */
  y: number;
  h: number;
  solid: boolean;
  opaque: boolean;
  /** optional palette / variant index */
  tint?: number;
}

export interface Aabb {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
  solid: boolean;
  opaque: boolean;
}

/** Where the segment a→b enters the box, as t in [0, 1]; −1 when it misses (slab method). */
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
