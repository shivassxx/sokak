import { describe, expect, it } from 'vitest';
import { ACCESSORIES, ACC_ALL, ACHIEVEMENTS, accIds, accMask, accessoryForAch, ownedMask, sanitizeWear, wearToggle } from '../src';

describe('aksesuarlar: catalogue', () => {
  it('fits a uint16 mask, prices are 200–2000 ₺ or achievement rewards', () => {
    expect(ACCESSORIES.length).toBeLessThanOrEqual(16);
    expect(new Set(ACCESSORIES.map((a) => a.id)).size).toBe(ACCESSORIES.length);
    for (const a of ACCESSORIES) {
      if (a.ach) {
        expect(a.price).toBe(0);
        expect(ACHIEVEMENTS.some((x) => x.id === a.ach)).toBe(true);
      } else {
        expect(a.price).toBeGreaterThanOrEqual(200);
        expect(a.price).toBeLessThanOrEqual(2000);
      }
    }
    expect(accessoryForAch('win10')?.id).toBe('tespih');
  });

  it('masks round-trip and ignore unknown ids', () => {
    expect(accIds(accMask(['gozluk', 'kasket', 'nope']))).toEqual(['kasket', 'gozluk']);
    expect(accMask([])).toBe(0);
  });
});

describe('aksesuarlar: slot rules', () => {
  it('keeps at most one item per slot and only owned ones', () => {
    const both = accMask(['kasket', 'fotr', 'gunes', 'gozluk', 'biyik']);
    expect(accIds(sanitizeWear(both, ACC_ALL))).toEqual(['kasket', 'gunes', 'biyik']);
    expect(accIds(sanitizeWear(both, accMask(['fotr', 'gozluk'])))).toEqual(['fotr', 'gozluk']);
    expect(sanitizeWear(both, 0)).toBe(0);
  });

  it('rejects junk', () => {
    for (const bad of [-1, 1.5, '3', null, undefined, Number.NaN]) expect(sanitizeWear(bad, ACC_ALL)).toBe(0);
    expect(sanitizeWear(1 << 20, ACC_ALL)).toBe(0);
  });

  it('putting on replaces the slot, taking off empties it', () => {
    let m = wearToggle(0, 'kasket', true);
    m = wearToggle(m, 'gunes', true);
    m = wearToggle(m, 'fotr', true);
    expect(accIds(m)).toEqual(['fotr', 'gunes']);
    m = wearToggle(m, 'gunes', false);
    expect(accIds(m)).toEqual(['fotr']);
    expect(wearToggle(m, 'nope', true)).toBe(m);
  });

  it('owned = bought + achievement rewards', () => {
    expect(accIds(ownedMask(['biyik'], ['win10', 'firstMatch']))).toEqual(['tespih', 'biyik']);
    expect(ownedMask(undefined, undefined)).toBe(0);
  });
});
