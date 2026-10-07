import { describe, expect, it } from 'vitest';
import {
  BOARD_SPOT,
  DECK_AREAS,
  KAHVE_COLLIDERS,
  KIZ_KULESI,
  PIER,
  SEA_Z,
  VAPUR_BEAM,
  VAPUR_CYCLE_MS,
  VAPUR_DOCK,
  VAPUR_DOCKED_S,
  VAPUR_LENGTH,
  VAPUR_SAIL_S,
  VAPUR_TOP_SPEED,
  deckSpot,
  deckToWorld,
  onDeck,
  stepDeck,
  vapurState,
  worldDirToDeck,
} from '../src';

const angleDiff = (a: number, b: number) => {
  let d = Math.abs(a - b) % (Math.PI * 2);
  return d > Math.PI ? Math.PI * 2 - d : d;
};
/** the hull outline in world space (the plan tapers to a point at the bow, rounded stern) */
const corners = (v: ReturnType<typeof vapurState>) =>
  [
    [VAPUR_LENGTH / 2 - 7, VAPUR_BEAM / 2],
    [VAPUR_LENGTH / 2 - 7, -VAPUR_BEAM / 2],
    [VAPUR_LENGTH / 2, 0],
    [-VAPUR_LENGTH / 2 + 2.2, VAPUR_BEAM / 2],
    [-VAPUR_LENGTH / 2 + 2.2, -VAPUR_BEAM / 2],
    [-VAPUR_LENGTH / 2, 0],
  ].map(([lx, lz]) => {
    const p = deckToWorld(v, lx!, lz!);
    return { x: p.x, z: p.z };
  });

describe('vapur timeline', () => {
  it('is the same for everybody: a pure function of absolute time, periodic', () => {
    const t = 1_790_000_123_456;
    expect(vapurState(t)).toEqual(vapurState(t));
    const a = vapurState(t);
    const b = vapurState(t + VAPUR_CYCLE_MS * 3);
    expect(b.x).toBeCloseTo(a.x, 6);
    expect(b.z).toBeCloseTo(a.z, 6);
    expect(b.phase).toBe(a.phase);
  });

  it('a docked window of ~30 s at the pier, then ~90–120 s at sea', () => {
    expect(VAPUR_DOCKED_S).toBeGreaterThanOrEqual(25);
    expect(VAPUR_SAIL_S).toBeGreaterThanOrEqual(90);
    expect(VAPUR_SAIL_S).toBeLessThanOrEqual(120);
    let docked = 0;
    for (let ms = 0; ms < VAPUR_CYCLE_MS; ms += 100) {
      const v = vapurState(ms);
      if (v.boardable) {
        docked += 100;
        expect(v.phase).toBe('docked');
        expect(v.x).toBe(VAPUR_DOCK.x);
        expect(v.z).toBe(VAPUR_DOCK.z);
        expect(v.yaw).toBe(0);
      } else expect(v.phase).not.toBe('docked');
    }
    expect(docked).toBe(VAPUR_DOCKED_S * 1000);
    expect(vapurState(0).boardable).toBe(true);
    expect(vapurState(VAPUR_DOCKED_S * 1000 + 5000).boardable).toBe(false);
  });

  it('moves continuously (no jumps in position or heading) at a ferry speed', () => {
    let prev = vapurState(-50);
    let top = 0;
    for (let ms = 0; ms <= VAPUR_CYCLE_MS * 2; ms += 50) {
      const v = vapurState(ms);
      const d = Math.hypot(v.x - prev.x, v.z - prev.z);
      top = Math.max(top, d / 0.05);
      expect(d).toBeLessThan(0.5);
      expect(angleDiff(v.yaw, prev.yaw)).toBeLessThan(0.03);
      prev = v;
    }
    expect(top).toBeGreaterThan(6);
    expect(top).toBeLessThan(8.5);
    expect(VAPUR_TOP_SPEED).toBeGreaterThan(6);
  });

  it('stays in the water: off the sea wall and the pier, round Kız Kulesi without touching its islet', () => {
    let nearest = Infinity;
    let farthestSouth = 0;
    for (let ms = 0; ms < VAPUR_CYCLE_MS; ms += 200) {
      const v = vapurState(ms);
      nearest = Math.min(nearest, Math.hypot(v.x - KIZ_KULESI.x, v.z - KIZ_KULESI.z));
      farthestSouth = Math.max(farthestSouth, v.z);
      for (const c of corners(v)) {
        // never over the promenade's sea wall line, and clear of the pier hall
        expect(c.z).toBeGreaterThan(SEA_Z + 2);
        if (c.x > PIER.x0 - 1 && c.x < PIER.x1 + 1) expect(c.z).toBeGreaterThan(PIER.z1);
        // the islet (rocks out to ~30 m)
        expect(Math.hypot(c.x - KIZ_KULESI.x, c.z - KIZ_KULESI.z)).toBeGreaterThan(32);
      }
    }
    // it does go out and round the tower
    expect(nearest).toBeLessThan(60);
    expect(farthestSouth).toBeGreaterThan(KIZ_KULESI.z + 40);
    // the loop passes the tower on all sides (west of it and south of it)
    const xs = Array.from({ length: 200 }, (_, i) => vapurState((VAPUR_DOCKED_S + (i / 200) * VAPUR_SAIL_S) * 1000));
    expect(xs.some((v) => v.x < KIZ_KULESI.x - 40)).toBe(true);
    expect(xs.some((v) => v.x > KIZ_KULESI.x + 40 && v.z > KIZ_KULESI.z)).toBe(true);
  });

  it('the boarding spot is on walkable ground by the pier', () => {
    const r = 0.4;
    const hit = KAHVE_COLLIDERS.filter((c) => c.solid && c.minY < 1.5 && c.maxX > BOARD_SPOT.x - r && c.minX < BOARD_SPOT.x + r && c.maxZ > BOARD_SPOT.z - r && c.minZ < BOARD_SPOT.z + r);
    expect(hit).toEqual([]);
    expect(BOARD_SPOT.z).toBeLessThan(SEA_Z);
    expect(Math.abs(BOARD_SPOT.x - PIER.x0)).toBeLessThan(1.5);
  });
});

describe('vapur deck', () => {
  it('deck spots are on the deck', () => {
    for (let k = 0; k < 40; k++) {
      const s = deckSpot(k);
      expect(onDeck(s.x, s.z)).toBe(true);
    }
  });

  it('walking keeps you on the deck and lets you go round', () => {
    const p = { x: -13, z: 0 };
    // walk into the stern rail for a while: stays on deck
    for (let i = 0; i < 100; i++) stepDeck(p, -1, 0, 1 / 60);
    expect(onDeck(p.x, p.z)).toBe(true);
    expect(p.x).toBeCloseTo(DECK_AREAS[0]!.x0, 3);
    // to the starboard corner, then forward along the walkway
    for (let i = 0; i < 200; i++) stepDeck(p, 0, 1, 1 / 60);
    for (let i = 0; i < 600; i++) stepDeck(p, 1, 0, 1 / 60);
    expect(onDeck(p.x, p.z)).toBe(true);
    expect(p.x).toBeGreaterThan(5);
    // pushing into the cabin wall does not get you through
    for (let i = 0; i < 100; i++) stepDeck(p, 0, -1, 1 / 60);
    expect(p.z).toBeGreaterThan(3);
  });

  it('deck frame ↔ world frame', () => {
    const v = { x: 10, y: -1, z: 50, yaw: 0.7 };
    const w = deckToWorld(v, 3, 1);
    // the bow direction (+x local) in world is (cos ψ, −sin ψ)
    const bow = deckToWorld(v, 1, 0);
    expect(bow.x - v.x).toBeCloseTo(Math.cos(0.7));
    expect(bow.z - v.z).toBeCloseTo(-Math.sin(0.7));
    // a world direction converted to deck and back
    const d = worldDirToDeck(0.7, w.x - v.x, w.z - v.z);
    expect(d.x).toBeCloseTo(3);
    expect(d.z).toBeCloseTo(1);
  });
});
