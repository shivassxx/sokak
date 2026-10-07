import { describe, expect, it } from 'vitest';
import { DAY_MINUTES, DAY_MS, DAY_SEGMENTS, DAY_START_HOUR, dayMsForHour, dayPhase, dayTime, formatDayTime, simitOpen } from '../src/dayclock';

const MIN = 60_000;

describe('world clock (gece-gündüz)', () => {
  it('one day is 40 real minutes and covers 24 game hours', () => {
    expect(DAY_MINUTES).toBe(40);
    expect(DAY_MS).toBe(40 * MIN);
    expect(DAY_SEGMENTS.reduce((s, g) => s + g.minutes, 0)).toBe(DAY_MINUTES);
    expect(DAY_SEGMENTS[0]!.from).toBe(DAY_START_HOUR);
    expect(DAY_SEGMENTS.reduce((s, g) => s + g.hours, 0)).toBe(24);
    // segments are contiguous
    for (let i = 1; i < DAY_SEGMENTS.length; i++) {
      const a = DAY_SEGMENTS[i - 1]!;
      expect((a.from + a.hours) % 24).toBe(DAY_SEGMENTS[i]!.from);
    }
  });

  it('starts deterministically at dawn on the epoch and repeats every day', () => {
    expect(dayTime(0)).toBe(DAY_START_HOUR);
    expect(dayTime(DAY_MS * 12345)).toBeCloseTo(DAY_START_HOUR, 9);
    const t = 1_791_000_000_000;
    expect(dayTime(t)).toBeCloseTo(dayTime(t + DAY_MS), 9);
    expect(dayTime(-DAY_MS / 2)).toBeCloseTo(dayTime(DAY_MS / 2), 9);
  });

  it('runs forward continuously through midnight', () => {
    let prev = dayTime(0);
    let wraps = 0;
    for (let ms = 1000; ms <= DAY_MS; ms += 1000) {
      const h = dayTime(ms);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThan(24);
      let d = h - prev;
      if (d < 0) {
        wraps++;
        d += 24;
      }
      expect(d).toBeGreaterThan(0);
      expect(d).toBeLessThan(0.05); // no jumps: at most ~2.4 game minutes per real second
      prev = h;
    }
    expect(wraps).toBe(1);
  });

  it('gives golden hour, dusk and night more than half the day', () => {
    const evening = DAY_SEGMENTS.filter((s) => s.phase === 'golden' || s.phase === 'dusk' || s.phase === 'night').reduce((s, g) => s + g.minutes, 0);
    expect(evening / DAY_MINUTES).toBeGreaterThan(0.6);
    // the golden hour runs slower than midday
    const rate = (p: string) => {
      const s = DAY_SEGMENTS.find((g) => g.phase === p)!;
      return s.hours / s.minutes;
    };
    expect(rate('golden')).toBeLessThan(rate('day') / 3);
  });

  it('dayMsForHour inverts dayTime', () => {
    for (const h of [0, 3.25, 5, 6.5, 12, 17, 18.5, 19.75, 21, 23.9]) {
      expect(dayTime(dayMsForHour(h))).toBeCloseTo(h, 6);
    }
    expect(dayMsForHour(DAY_START_HOUR)).toBe(0);
  });

  it('names the phases and formats the clock', () => {
    expect(dayPhase(6)).toBe('dawn');
    expect(dayPhase(13)).toBe('day');
    expect(dayPhase(18.5)).toBe('golden');
    expect(dayPhase(20)).toBe('dusk');
    expect(dayPhase(23.5)).toBe('night');
    expect(dayPhase(2)).toBe('night');
    expect(formatDayTime(23 + 40 / 60)).toBe('23:40');
    expect(formatDayTime(7.0833)).toBe('07:04');
    expect(formatDayTime(24)).toBe('00:00');
  });

  it('the simitçi is closed late at night', () => {
    expect(simitOpen(12)).toBe(true);
    expect(simitOpen(21.9)).toBe(true);
    expect(simitOpen(23)).toBe(false);
    expect(simitOpen(3)).toBe(false);
    expect(simitOpen(6)).toBe(true);
  });
});
