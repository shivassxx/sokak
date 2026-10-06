import { describe, expect, it } from 'vitest';
import { canSee, lineOfSight, segmentHitsBox } from '../src/visibility';

describe('visibility', () => {
  it('segment vs box', () => {
    const box = { minX: -1, maxX: 1, minY: 0, maxY: 2, minZ: -1, maxZ: 1, solid: true, opaque: true };
    expect(segmentHitsBox({ x: -5, y: 1, z: 0 }, { x: 5, y: 1, z: 0 }, box)).toBe(true);
    expect(segmentHitsBox({ x: -5, y: 3, z: 0 }, { x: 5, y: 3, z: 0 }, box)).toBe(false);
    expect(segmentHitsBox({ x: -5, y: 1, z: 0 }, { x: -2, y: 1, z: 0 }, box)).toBe(false);
  });

  it('open plaza has line of sight', () => {
    expect(lineOfSight({ x: -3, y: 1.6, z: 4 }, { x: 3, y: 1, z: 4 })).toBe(true);
  });

  it('Ebe wall blocks view across it', () => {
    expect(canSee({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: -5, crouch: true })).toBe(false);
  });

  it('range limits sight', () => {
    expect(canSee({ x: 0, y: 0, z: 4 }, { x: 0, y: 0, z: 4.1, crouch: false }, 5)).toBe(true);
    expect(canSee({ x: -9, y: 0, z: 4 }, { x: 9, y: 0, z: 4, crouch: false }, 5)).toBe(false);
  });

  it('bush hides a crouching hider unless very close', () => {
    // bush at (-36, 18), 3 x 2
    expect(canSee({ x: -36, y: 0, z: 26 }, { x: -36, y: 0, z: 18, crouch: true })).toBe(false);
    expect(canSee({ x: -36, y: 0, z: 19.2 }, { x: -36, y: 0, z: 18, crouch: true })).toBe(true);
  });

  it('a building fully blocks sight', () => {
    expect(canSee({ x: 40, y: 0, z: -30 }, { x: 40, y: 0, z: -58, crouch: false })).toBe(false);
  });
});
