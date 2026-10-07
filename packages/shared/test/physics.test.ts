import { describe, expect, it } from 'vitest';
import { HALL, KAHVE_COLLIDERS, KAHVE_SPAWN, KAHVE_WORLD, SIT_SPOTS, STREET } from '../src/kahve';
import { createBody, groundHeight, stepBody, NO_INPUT, PLAYER_RADIUS, SIM_DT, WALK_SPEED, type MoveInput } from '../src/physics';

const step = (b: ReturnType<typeof createBody>, input: MoveInput) => stepBody(b, input, SIM_DT, KAHVE_WORLD);
const run = (b: ReturnType<typeof createBody>, input: MoveInput, steps: number) => {
  for (let i = 0; i < steps; i++) step(b, input);
};

function insideSolid(x: number, z: number, y = 0): boolean {
  return KAHVE_COLLIDERS.some(
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

/** an x in the hall with nothing solid between it and the back wall (2 m strip) */
function clearLaneToBackWall(): number {
  for (let x = HALL.x0 + 1; x < HALL.x1 - 1; x += 0.25) {
    const blocked = KAHVE_COLLIDERS.some((c) => c.solid && c.maxY > 0.5 && c.maxX > x - 0.5 && c.minX < x + 0.5 && c.maxZ > HALL.z0 + 0.01 && c.minZ < HALL.z0 + 2.2);
    if (!blocked) return x;
  }
  throw new Error('no clear lane');
}

const ROAD_Z = (STREET.z0 + STREET.z1) / 2;

describe('physics (kahvehane world)', () => {
  it('walks freely along the street at walk speed', () => {
    const b = createBody(0, ROAD_Z);
    run(b, { mx: 1, mz: 0, jump: false, crouch: false }, 20);
    expect(b.x).toBeCloseTo(WALK_SPEED * 1, 1);
    expect(b.y).toBe(0);
  });

  it('is stopped by the hall’s back wall', () => {
    const x = clearLaneToBackWall();
    const b = createBody(x, HALL.z0 + 2);
    run(b, { mx: 0, mz: -1, jump: false, crouch: false }, 40);
    expect(b.z).toBeCloseTo(HALL.z0 + PLAYER_RADIUS, 2);
  });

  it('a body stuck inside a wall is pushed out and can walk away (no sticking)', () => {
    const x = clearLaneToBackWall();
    const b = createBody(x, HALL.z0 - 0.1);
    run(b, { mx: 0, mz: 1, jump: false, crouch: false }, 1);
    expect(insideSolid(b.x, b.z)).toBe(false);
    const z0 = b.z;
    run(b, { mx: 0, mz: 1, jump: false, crouch: false }, 6);
    expect(b.z).toBeGreaterThan(z0 + 1);
  });

  it('is deterministic', () => {
    const a = createBody(0, ROAD_Z);
    const b = createBody(0, ROAD_Z);
    const inputs: MoveInput[] = Array.from({ length: 200 }, (_, i) => ({
      mx: Math.sin(i * 0.3),
      mz: Math.cos(i * 0.17),
      jump: i % 23 === 0,
      crouch: i % 50 > 40,
    }));
    for (const inp of inputs) step(a, inp);
    for (const inp of inputs) step(b, inp);
    expect(a).toEqual(b);
  });

  it('jumps and lands', () => {
    const b = createBody(0, ROAD_Z);
    step(b, { ...NO_INPUT, jump: true });
    expect(b.y).toBeGreaterThan(0);
    run(b, NO_INPUT, 40);
    expect(b.y).toBe(0);
    expect(b.onGround).toBe(true);
  });

  it('the spawn point and the places to stand up from seats are not inside solids', () => {
    expect(insideSolid(KAHVE_SPAWN.x, KAHVE_SPAWN.z)).toBe(false);
    for (const s of SIT_SPOTS) {
      const p = s.stand ?? { x: s.x - Math.sin(s.yaw) * 0.8, z: s.z - Math.cos(s.yaw) * 0.8 };
      expect(insideSolid(p.x, p.z, groundHeight(p.x, p.z, 0.5, KAHVE_WORLD)), `${s.label} ${p.x},${p.z}`).toBe(false);
    }
  });
});

describe('sprint & stamina', () => {
  it('sprinting is faster but drains stamina until exhausted', async () => {
    const { SPRINT_SPEED, STAMINA_RECOVER } = await import('../src/physics');
    const b = createBody(0, ROAD_Z);
    step(b, { mx: 1, mz: 0, jump: false, crouch: false, sprint: true });
    expect(b.x).toBeCloseTo(SPRINT_SPEED * 0.05, 3);
    // run up and down the street until tired
    for (let i = 0; i < 100; i++) step(b, { mx: i % 40 < 20 ? 1 : -1, mz: 0, jump: false, crouch: false, sprint: true });
    expect(b.tired).toBe(true);
    // tired: back to walking speed even when holding sprint
    const x0 = b.x;
    step(b, { mx: 1, mz: 0, jump: false, crouch: false, sprint: true });
    expect(b.x - x0).toBeCloseTo(WALK_SPEED * 0.05, 3);
    for (let i = 0; i < 60; i++) step(b, NO_INPUT);
    expect(b.stamina).toBeGreaterThanOrEqual(STAMINA_RECOVER);
    expect(b.tired).toBe(false);
  });

  it('crouching cannot sprint', () => {
    const b = createBody(0, ROAD_Z);
    step(b, { mx: 1, mz: 0, jump: false, crouch: true, sprint: true });
    expect(b.stamina).toBe(1);
  });
});
