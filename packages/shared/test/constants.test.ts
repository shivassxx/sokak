import { describe, expect, it } from 'vitest';
import { MAX_PLAYERS, MIN_PLAYERS, TICK_MS } from '../src';

describe('constants', () => {
  it('are sane', () => {
    expect(MIN_PLAYERS).toBeLessThanOrEqual(MAX_PLAYERS);
    expect(TICK_MS).toBe(50);
  });
});
