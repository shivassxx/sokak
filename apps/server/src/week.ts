/**
 * ISO weeks as seen in Turkey (Europe/Istanbul, UTC+3 all year since 2016):
 * the weekly leaderboard resets on Monday 00:00 Istanbul time.
 */
export interface IsoWeek {
  /** e.g. "2026-W41" */
  id: string;
  /** Monday and Sunday as YYYY-MM-DD (Istanbul calendar dates) */
  start: string;
  end: string;
}

const DAY = 86400000;
let fmt: Intl.DateTimeFormat | null | undefined;

/** Istanbul calendar date of a timestamp as UTC midnight of that date. */
function istanbulDay(ms: number): number {
  if (fmt === undefined) {
    try {
      fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit' });
    } catch {
      fmt = null; // no time zone data: Istanbul has been a fixed UTC+3 since 2016
    }
  }
  if (fmt) {
    const parts = fmt.formatToParts(new Date(ms));
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
    return Date.UTC(get('year'), get('month') - 1, get('day'));
  }
  const d = new Date(ms + 3 * 3600000);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

const ymd = (dayMs: number) => new Date(dayMs).toISOString().slice(0, 10);

export function istanbulWeek(ms: number): IsoWeek {
  const day = istanbulDay(ms);
  const dow = (new Date(day).getUTCDay() + 6) % 7; // Monday = 0
  const monday = day - dow * DAY;
  const thursday = monday + 3 * DAY; // the ISO year is the year of the week's Thursday
  const year = new Date(thursday).getUTCFullYear();
  const week = Math.floor((thursday - Date.UTC(year, 0, 1)) / DAY / 7) + 1;
  return { id: `${year}-W${String(week).padStart(2, '0')}`, start: ymd(monday), end: ymd(monday + 6 * DAY) };
}

/** The week before the one containing `ms`. */
export function previousWeek(ms: number): IsoWeek {
  return istanbulWeek(ms - 7 * DAY);
}
