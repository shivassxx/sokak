/**
 * The shared world clock (gece-gündüz döngüsü): one game day over Üsküdar, derived from absolute
 * time (epoch ms, server clock) like the vapur timeline, so every player sees the same hour.
 *
 * A day lasts DAY_MS of real time, but the hours do not pass evenly: the evening golden hour (the
 * signature look), the blue hour and the night get most of it, the bright midday rushes by.
 * Epoch 0 is DAY_START_HOUR (dawn); the timeline is fully deterministic.
 */

export type DayPhase = 'dawn' | 'day' | 'golden' | 'dusk' | 'night';

export interface DaySegment {
  phase: DayPhase;
  /** game hour at the start of the segment (0–24) */
  from: number;
  /** game hours the segment covers */
  hours: number;
  /** real minutes it takes */
  minutes: number;
}

/** In timeline order, starting at epoch 0. Real minutes add up to DAY_MINUTES, hours to 24. */
export const DAY_SEGMENTS: readonly DaySegment[] = [
  { phase: 'dawn', from: 5, hours: 2, minutes: 3 },
  { phase: 'day', from: 7, hours: 10, minutes: 9 },
  { phase: 'golden', from: 17, hours: 2.5, minutes: 10 },
  { phase: 'dusk', from: 19.5, hours: 1.5, minutes: 6 },
  { phase: 'night', from: 21, hours: 8, minutes: 12 },
];
export const DAY_MINUTES = DAY_SEGMENTS.reduce((s, g) => s + g.minutes, 0);
/** one game day in real milliseconds (40 minutes) */
export const DAY_MS = DAY_MINUTES * 60_000;
/** the game hour at epoch 0 */
export const DAY_START_HOUR = DAY_SEGMENTS[0]!.from;
/** the simitçi packs up his cart at night */
export const SIMIT_CLOSES_AT = 22;
export const SIMIT_OPENS_AT = 6;

const wrap24 = (h: number) => ((h % 24) + 24) % 24;

/** Game hour (0 ≤ h < 24, fractional) at absolute time `timeMs`. */
export function dayTime(timeMs: number): number {
  let ms = ((timeMs % DAY_MS) + DAY_MS) % DAY_MS;
  for (const s of DAY_SEGMENTS) {
    const len = s.minutes * 60_000;
    if (ms < len) return wrap24(s.from + (ms / len) * s.hours);
    ms -= len;
  }
  return DAY_START_HOUR;
}

/** Real ms into the day cycle at which game hour `hour` is reached (inverse of dayTime). */
export function dayMsForHour(hour: number): number {
  const h = wrap24(hour);
  let ms = 0;
  for (const s of DAY_SEGMENTS) {
    const into = wrap24(h - s.from);
    if (into < s.hours) return ms + (into / s.hours) * s.minutes * 60_000;
    ms += s.minutes * 60_000;
  }
  return 0;
}

export function dayPhase(hour: number): DayPhase {
  const h = wrap24(hour);
  for (const s of DAY_SEGMENTS) if (wrap24(h - s.from) < s.hours) return s.phase;
  return 'night';
}

/** Is the simitçi's cart open at this hour? */
export function simitOpen(hour: number): boolean {
  const h = wrap24(hour);
  return h >= SIMIT_OPENS_AT && h < SIMIT_CLOSES_AT;
}

/** "07:05" */
export function formatDayTime(hour: number): string {
  const m = Math.floor(wrap24(hour) * 60) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}
