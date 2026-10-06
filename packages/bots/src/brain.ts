import { HIDING_SPOTS, type MoveInput, type Vec2 } from '@sokak/shared';
import { findPath, nearestWalkable } from './navgrid';

export type Rng = () => number;

/** Follows a path of waypoints and reports stuck-ness. */
export class PathFollower {
  path: Vec2[] = [];
  private stuckT = 0;
  private lastPos: Vec2 = { x: 0, z: 0 };
  goal: Vec2 | null = null;

  setGoal(from: Vec2, goal: Vec2): boolean {
    const p = findPath(from, goal);
    this.goal = goal;
    this.path = p ?? [];
    this.stuckT = 0;
    return p !== null;
  }

  clear(): void {
    this.path = [];
    this.goal = null;
  }

  get done(): boolean {
    return this.path.length === 0;
  }

  /** returns a world direction (unit or zero) */
  steer(pos: Vec2, dt: number): Vec2 {
    while (this.path.length) {
      const w = this.path[0]!;
      const d = Math.hypot(w.x - pos.x, w.z - pos.z);
      if (d < 0.35 || (this.path.length > 1 && d < 0.6)) this.path.shift();
      else break;
    }
    if (!this.path.length) return { x: 0, z: 0 };
    const moved = Math.hypot(pos.x - this.lastPos.x, pos.z - this.lastPos.z);
    this.lastPos = { ...pos };
    this.stuckT = moved < 0.02 ? this.stuckT + dt : 0;
    if (this.stuckT > 1.2 && this.goal) {
      this.setGoal(pos, this.goal);
      if (this.stuckT > 3) this.clear();
    }
    const w = this.path[0];
    if (!w) return { x: 0, z: 0 };
    const dx = w.x - pos.x;
    const dz = w.z - pos.z;
    const l = Math.hypot(dx, dz) || 1;
    return { x: dx / l, z: dz / l };
  }
}

/** Random walkable point near-ish a hiding spot or anywhere on the map. */
export function randomDestination(rng: Rng): Vec2 {
  if (rng() < 0.6) {
    const s = HIDING_SPOTS[Math.floor(rng() * HIDING_SPOTS.length)]!;
    return nearestWalkable({ x: s.x + (rng() - 0.5) * 4, z: s.z + (rng() - 0.5) * 4 });
  }
  return nearestWalkable({ x: (rng() - 0.5) * 100, z: (rng() - 0.5) * 100 });
}

/** Lobby / idle behaviour: stroll between random destinations. */
export class WanderBrain {
  private follower = new PathFollower();
  private wait = 0;

  constructor(private rng: Rng) {}

  think(pos: Vec2, dt: number): MoveInput {
    if (this.wait > 0) {
      this.wait -= dt;
      return { mx: 0, mz: 0, jump: false, crouch: false };
    }
    if (this.follower.done) {
      this.wait = 0.5 + this.rng() * 2.5;
      this.follower.setGoal(pos, randomDestination(this.rng));
      return { mx: 0, mz: 0, jump: false, crouch: false };
    }
    const d = this.follower.steer(pos, dt);
    return { mx: d.x, mz: d.z, jump: false, crouch: false };
  }
}
