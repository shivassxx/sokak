import { describe, expect, it } from 'vitest';
import { FESTIVALS, festivalAt, festivalById, festivalKey } from '../src/festival';

/** an instant on the Istanbul calendar (UTC+3) */
const ist = (iso: string) => Date.parse(`${iso}+03:00`);

describe('mevsimlik olaylar', () => {
  it('fixed national days and yılbaşı', () => {
    expect(festivalAt(ist('2026-10-29T12:00:00'))).toBe('cumhuriyet');
    expect(festivalAt(ist('2026-10-28T00:30:00'))).toBe('cumhuriyet');
    expect(festivalAt(ist('2026-10-30T00:30:00'))).toBeNull();
    expect(festivalAt(ist('2027-04-23T10:00:00'))).toBe('cocuk');
    expect(festivalAt(ist('2026-05-19T10:00:00'))).toBe('genclik');
    expect(festivalAt(ist('2027-08-30T10:00:00'))).toBe('zafer');
    expect(festivalAt(ist('2026-12-31T23:59:00'))).toBe('yilbasi');
    expect(festivalAt(ist('2027-01-01T12:00:00'))).toBe('yilbasi');
    expect(festivalAt(ist('2027-01-02T12:00:00'))).toBeNull();
  });

  it('uses the Istanbul calendar day, not UTC', () => {
    // 22:30 UTC on 27 Oct is already 01:30 on the 28th in Istanbul
    expect(festivalAt(Date.parse('2026-10-27T22:30:00Z'))).toBe('cumhuriyet');
    expect(festivalAt(Date.parse('2026-10-27T20:30:00Z'))).toBeNull();
  });

  it('Ramazan runs up to the bayram; the bayrams last 3 and 4 days', () => {
    expect(festivalAt(ist('2027-02-07T12:00:00'))).toBeNull();
    expect(festivalAt(ist('2027-02-08T12:00:00'))).toBe('ramazan');
    expect(festivalAt(ist('2027-03-08T23:00:00'))).toBe('ramazan');
    expect(festivalAt(ist('2027-03-09T08:00:00'))).toBe('ramazanBayrami');
    expect(festivalAt(ist('2027-03-11T20:00:00'))).toBe('ramazanBayrami');
    expect(festivalAt(ist('2027-03-12T08:00:00'))).toBeNull();
    expect(festivalAt(ist('2027-05-16T08:00:00'))).toBe('kurbanBayrami');
    expect(festivalAt(ist('2027-05-19T20:00:00'))).toBe('kurbanBayrami');
    expect(festivalAt(ist('2027-05-20T08:00:00'))).toBeNull();
  });

  it('a bayram on a national day wins', () => {
    // 19 May 2027 falls in Kurban Bayramı (16–19 May)
    expect(festivalAt(ist('2027-05-19T12:00:00'))).toBe('kurbanBayrami');
  });

  it('one key per festival and year; yılbaşı counts with the coming year', () => {
    expect(festivalKey('kurbanBayrami', ist('2027-05-17T12:00:00'))).toBe('kurbanBayrami:2027');
    expect(festivalKey('yilbasi', ist('2026-12-28T12:00:00'))).toBe('yilbasi:2027');
    expect(festivalKey('yilbasi', ist('2027-01-01T12:00:00'))).toBe('yilbasi:2027');
  });

  it('definitions are complete', () => {
    for (const f of FESTIVALS) {
      expect(festivalById(f.id)).toBe(f);
      expect(f.greeting.length).toBeGreaterThan(10);
      expect(Object.values(f.decor).some(Boolean)).toBe(true);
    }
    // only the religious bayrams carry harçlık
    expect(FESTIVALS.filter((f) => f.gift > 0).map((f) => f.id).sort()).toEqual(['kurbanBayrami', 'ramazanBayrami']);
  });
});
