import { describe, expect, it } from 'vitest';
import { createBody, stepBody, HIDING_SPOTS, BASE } from '@sokak/shared';
import { findPath, isWalkable, nearestWalkable } from '../src/navgrid';
import { WanderBrain, PathFollower } from '../src/brain';

describe('navgrid', () => {
  it('base and open plaza are walkable, building interior is not', () => {
    expect(isWalkable(0, 3)).toBe(true);
    expect(isWalkable(-45, -50)).toBe(false);
  });

  it('finds a path from base to every hiding spot', () => {
    for (const s of HIDING_SPOTS) {
      const p = findPath({ x: 0, z: 3 }, s);
      expect(p, `${s.x},${s.z}`).not.toBeNull();
    }
  });

  it('a body following a path actually arrives', () => {
    const body = createBody(0, 3);
    const f = new PathFollower();
    const goal = nearestWalkable({ x: -36, z: 18 });
    expect(f.setGoal(body, goal)).toBe(true);
    for (let i = 0; i < 20 * 40 && !f.done; i++) {
      const d = f.steer(body, 0.05);
      stepBody(body, { mx: d.x, mz: d.z, jump: false, crouch: false });
    }
    expect(Math.hypot(body.x - goal.x, body.z - goal.z)).toBeLessThan(1);
  });

  it('wander brain moves the bot around', () => {
    let seed = 1;
    const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const brain = new WanderBrain(rng);
    const body = createBody(BASE.x, BASE.z + 4);
    for (let i = 0; i < 400; i++) stepBody(body, brain.think(body, 0.05));
    expect(Math.hypot(body.x, body.z - 4)).toBeGreaterThan(3);
  });
});
