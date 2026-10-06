import { describe, expect, it } from 'vitest';
import { KAHVE_COLLIDERS, KAHVE_HALF, TABLES, seatPosition } from '@sokak/shared';
import { NavGrid } from '../src/game/navGrid';

describe('NavGrid (çaycı routes)', () => {
  const nav = new NavGrid(KAHVE_COLLIDERS, KAHVE_HALF);
  const EXIT = { x: 4.2, z: -22.6 };
  const targets = {
    hallSeat: seatPosition(3, 1),
    terraceSeat: seatPosition(TABLES.length - 1, 2),
    market: { x: 20, z: -1.6 },
    marketBack: { x: 25, z: -12 },
    bench: { x: 1.5, z: 25.6 },
    cayBahcesiStool: { x: -40.75, z: 31.6 },
  };
  for (const [name, to] of Object.entries(targets)) {
    it(`finds a wall-free path to the ${name}`, () => {
      const path = nav.path(EXIT, to);
      expect(path.length).toBeGreaterThan(0);
      const end = path[path.length - 1]!;
      expect(Math.hypot(end.x - to.x, end.z - to.z)).toBeLessThan(1.2);
      let a = EXIT;
      for (const b of path.slice(0, -1)) {
        expect(nav.clear(a, b)).toBe(true);
        a = b;
      }
    });
  }
  it('never walks through the building between the hall and the market', () => {
    const path = nav.path(EXIT, targets.market);
    let a = EXIT;
    for (const b of path) {
      // the block between hall and market spans x 14.4..16 up to z 3.5
      for (let t = 0; t <= 1; t += 0.02) {
        const x = a.x + (b.x - a.x) * t;
        const z = a.z + (b.z - a.z) * t;
        expect(x > 14.4 && x < 16 && z < 3.5).toBe(false);
      }
      a = b;
    }
  });
});
