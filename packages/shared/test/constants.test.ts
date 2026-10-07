import { describe, expect, it } from 'vitest';
import { MAX_KAHVE_PLAYERS, TABLE_COUNT, TICK_MS } from '../src';

describe('constants', () => {
  it('are sane', () => {
    expect(TICK_MS).toBe(50);
    // every table can fill up with people
    expect(MAX_KAHVE_PLAYERS).toBeGreaterThanOrEqual(4);
    expect(TABLE_COUNT).toBeGreaterThan(0);
  });
});
