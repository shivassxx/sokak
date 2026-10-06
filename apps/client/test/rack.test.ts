import { describe, expect, it } from 'vitest';
import { ROW, SLOTS, emptyRack, moveTile, rackGroups, syncRack } from '../src/ui/okey/rack';

const row = (r: (number | null)[], i: number) => r.slice(i * ROW, i * ROW + ROW);

describe('ıstaka arranging', () => {
  it('drops a tile into an empty slot', () => {
    const r = syncRack(emptyRack(), [1, 2, 3]);
    const to = 4;
    const next = moveTile(r, 1, to);
    expect(next[to]).toBe(1);
    expect(next.filter((t) => t !== null).sort()).toEqual([1, 2, 3]);
  });

  it('inserts between tiles by sliding neighbours towards a free slot', () => {
    const r = emptyRack();
    [10, 11, 12, 13].forEach((t, i) => (r[i] = t));
    // drop 13 onto slot 1 → 10 13 11 12
    const next = moveTile(r, 13, 1);
    expect(row(next, 0).slice(0, 4)).toEqual([10, 13, 11, 12]);
    // drop 10 onto slot 2 → 13 11 10 12 (shifts left into the freed slot)
    const again = moveTile(next, 10, 2);
    expect(row(again, 0).slice(0, 4)).toEqual([13, 11, 10, 12]);
  });

  it('moves a tile to the other row and keeps every tile exactly once', () => {
    const hand = Array.from({ length: 22 }, (_, i) => i * 3);
    let r = syncRack(emptyRack(), hand);
    r = moveTile(r, hand[0]!, ROW + 3);
    r = moveTile(r, hand[5]!, 0);
    r = moveTile(r, hand[9]!, SLOTS - 1);
    const placed = r.filter((t): t is number => t !== null).sort((a, b) => a - b);
    expect(placed).toEqual([...hand].sort((a, b) => a - b));
  });

  it('swaps when the target row is full', () => {
    const r = emptyRack();
    for (let i = 0; i < ROW; i++) r[i] = i;
    r[ROW] = 99;
    const next = moveTile(r, 99, 3);
    expect(next[3]).toBe(99);
    expect(next[ROW]).toBe(3);
  });

  it('groups are runs separated by gaps', () => {
    const r = emptyRack();
    r[0] = 1;
    r[1] = 2;
    r[3] = 5;
    r[ROW] = 7;
    expect(rackGroups(r)).toEqual([[1, 2], [5], [7]]);
  });
});
