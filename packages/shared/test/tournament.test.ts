import { describe, expect, it } from 'vitest';
import { tourPrizes, tourRanking } from '../src/tournament';

describe('turnuva helpers', () => {
  it('prizes add up to the pool, the first place takes the rounding', () => {
    expect(tourPrizes(1000)).toEqual([500, 300, 200]);
    const p = tourPrizes(333);
    expect(p.reduce((a, b) => a + b, 0)).toBe(333);
    expect(p[0]).toBeGreaterThanOrEqual(p[1]!);
    expect(tourPrizes(0)).toEqual([0, 0, 0]);
  });
  it('ranks by lowest total, ties by seat', () => {
    expect(tourRanking([50, -101, 50, 20])).toEqual([1, 3, 0, 2]);
  });
});
