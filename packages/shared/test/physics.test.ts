import { describe, expect, it } from 'vitest';
import { COLLIDERS, spawnPoint, HIDING_SPOTS } from '../src/map';
import { createBody, groundHeight, stepBody, NO_INPUT, PLAYER_RADIUS, WALK_SPEED, type MoveInput } from '../src/physics';

const run = (b: ReturnType<typeof createBody>, input: MoveInput, steps: number) => {
  for (let i = 0; i < steps; i++) stepBody(b, input);
};

function insideSolid(x: number, z: number, y = 0): boolean {
  return COLLIDERS.some(
    (c) =>
      c.solid &&
      c.minY < y + 1.8 &&
      c.maxY > y + 0.5 &&
      x + PLAYER_RADIUS > c.minX &&
      x - PLAYER_RADIUS < c.maxX &&
      z + PLAYER_RADIUS > c.minZ &&
      z - PLAYER_RADIUS < c.maxZ,
  );
}

describe('physics', () => {
  it('walks freely on open ground at walk speed', () => {
    const b = createBody(0, 3);
    run(b, { mx: 1, mz: 0, jump: false, crouch: false }, 20);
    expect(b.x).toBeCloseTo(WALK_SPEED * 1, 1);
    expect(b.y).toBe(0);
  });

  it('is blocked by the Ebe wall', () => {
    const b = createBody(0, 0);
    run(b, { mx: 0, mz: -1, jump: false, crouch: false }, 40);
    expect(b.z).toBeGreaterThan(-1.9);
    expect(b.z).toBeCloseTo(-1.9 + PLAYER_RADIUS, 2);
  });

  it('is deterministic', () => {
    const a = createBody(5, 5);
    const b = createBody(5, 5);
    const inputs: MoveInput[] = Array.from({ length: 200 }, (_, i) => ({
      mx: Math.sin(i * 0.3),
      mz: Math.cos(i * 0.17),
      jump: i % 23 === 0,
      crouch: i % 50 > 40,
    }));
    for (const inp of inputs) stepBody(a, inp);
    for (const inp of inputs) stepBody(b, inp);
    expect(a).toEqual(b);
  });

  it('jumps and lands', () => {
    const b = createBody(0, 4);
    stepBody(b, { ...NO_INPUT, jump: true });
    expect(b.y).toBeGreaterThan(0);
    run(b, NO_INPUT, 40);
    expect(b.y).toBe(0);
    expect(b.onGround).toBe(true);
  });

  it('climbs the NW stairs up to the balcony', () => {
    const b = createBody(-29.25, -34);
    run(b, { mx: 0, mz: -1, jump: false, crouch: false }, 60);
    expect(b.y).toBeCloseTo(3.1, 2);
    expect(b.z).toBeLessThan(-43);
  });

  it('can walk under the high steps', () => {
    const b = createBody(-26, -41.5);
    run(b, { mx: -1, mz: 0, jump: false, crouch: false }, 20);
    expect(b.x).toBeLessThan(-29);
    expect(b.y).toBe(0);
  });

  it('spawn points and hiding spots are not inside solids', () => {
    for (let i = 0; i < 10; i++) {
      const s = spawnPoint(i);
      expect(insideSolid(s.x, s.z), `spawn ${i}`).toBe(false);
    }
    for (const h of HIDING_SPOTS) {
      expect(insideSolid(h.x, h.z, groundHeight(h.x, h.z, 0.5)), `spot ${h.x},${h.z}`).toBe(false);
    }
  });
});

describe('spawn ring', () => {
  it('spawn points are outside the base zone', async () => {
    const { BASE, BASE_RADIUS } = await import('../src/map');
    for (let i = 0; i < 10; i++) {
      const s = spawnPoint(i);
      expect(Math.hypot(s.x - BASE.x, s.z - BASE.z)).toBeGreaterThan(BASE_RADIUS + 0.3);
    }
  });
});

describe('sprint & stamina', () => {
  it('sprinting is faster but drains stamina until exhausted', async () => {
    const { SPRINT_SPEED, STAMINA_RECOVER } = await import('../src/physics');
    const b = createBody(0, 4);
    stepBody(b, { mx: 1, mz: 0, jump: false, crouch: false, sprint: true });
    expect(b.x).toBeCloseTo(SPRINT_SPEED * 0.05, 3);
    for (let i = 0; i < 100; i++) stepBody(b, { mx: 0, mz: 1, jump: false, crouch: false, sprint: true });
    expect(b.tired).toBe(true);
    // tired: back to walking speed even when holding sprint
    const z0 = b.z;
    stepBody(b, { mx: 0, mz: -1, jump: false, crouch: false, sprint: true });
    expect(z0 - b.z).toBeCloseTo(WALK_SPEED * 0.05, 3);
    for (let i = 0; i < 60; i++) stepBody(b, NO_INPUT);
    expect(b.stamina).toBeGreaterThanOrEqual(STAMINA_RECOVER);
    expect(b.tired).toBe(false);
  });

  it('crouching cannot sprint', () => {
    const b = createBody(0, 4);
    stepBody(b, { mx: 1, mz: 0, jump: false, crouch: true, sprint: true });
    expect(b.stamina).toBe(1);
  });
});
