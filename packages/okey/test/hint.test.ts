import { describe, expect, it } from 'vitest';
import { suggestDiscard, type OkeyCtx } from '../src';

const T = (color: number, num: number, copy = 0) => color * 26 + copy * 13 + (num - 1);
const ctx: OkeyCtx = { okey: { color: 0, num: 6 } };

describe('suggestDiscard (beginner hint)', () => {
  it('keeps a run and a set, throws the lonely tile', () => {
    const hand = [T(1, 3), T(1, 4), T(1, 5), T(2, 9), T(3, 9), T(0, 9), T(3, 13)];
    expect(suggestDiscard(hand, ctx)).toBe(T(3, 13));
  });
  it('never suggests the okey and respects the avoid list', () => {
    const okey = T(0, 6);
    const lonely = T(2, 1);
    const other = T(3, 12);
    expect(suggestDiscard([okey, lonely, other], ctx)).not.toBe(okey);
    expect(suggestDiscard([okey, lonely, other], ctx, (t) => t === lonely)).toBe(other);
  });
  it('null for an empty hand', () => {
    expect(suggestDiscard([], ctx)).toBeNull();
  });
});
