/**
 * Mevsimlik olaylar: national holidays, Ramazan, the two bayrams and yılbaşı dress up the
 * kahvehane (flags, mahya, lights, fireworks). The calendar runs on Istanbul time (UTC+3, no
 * DST). The owner can also put one on by hand from the admin panel (an override).
 */
export type FestivalId = 'cumhuriyet' | 'cocuk' | 'genclik' | 'zafer' | 'yilbasi' | 'ramazan' | 'ramazanBayrami' | 'kurbanBayrami';

export interface FestivalDef {
  id: FestivalId;
  name: string;
  emoji: string;
  /** the welcome line shown once per visit */
  greeting: string;
  /** what the client puts up */
  decor: { flags?: boolean; balloons?: boolean; mahya?: string; lights?: boolean; tree?: boolean; fireworks?: boolean };
  /** bayram harçlığı: play money given once per device per festival and year (0 = none) */
  gift: number;
}

export const FESTIVALS: readonly FestivalDef[] = [
  { id: 'cumhuriyet', name: 'Cumhuriyet Bayramı', emoji: '🇹🇷', greeting: '🇹🇷 29 Ekim Cumhuriyet Bayramımız kutlu olsun!', decor: { flags: true, fireworks: true }, gift: 0 },
  { id: 'cocuk', name: '23 Nisan', emoji: '🎈', greeting: '🎈 23 Nisan Ulusal Egemenlik ve Çocuk Bayramı kutlu olsun!', decor: { flags: true, balloons: true }, gift: 0 },
  { id: 'genclik', name: '19 Mayıs', emoji: '🇹🇷', greeting: '🇹🇷 19 Mayıs Atatürk’ü Anma, Gençlik ve Spor Bayramı kutlu olsun!', decor: { flags: true }, gift: 0 },
  { id: 'zafer', name: 'Zafer Bayramı', emoji: '🇹🇷', greeting: '🇹🇷 30 Ağustos Zafer Bayramımız kutlu olsun!', decor: { flags: true, fireworks: true }, gift: 0 },
  { id: 'yilbasi', name: 'Yılbaşı', emoji: '🎄', greeting: '🎄 Mutlu yıllar! Kahvehane yeni yıla hazır.', decor: { lights: true, tree: true, fireworks: true }, gift: 0 },
  { id: 'ramazan', name: 'Ramazan', emoji: '🌙', greeting: '🌙 Hoş geldin ya şehr-i Ramazan! Mahyalar yandı.', decor: { mahya: 'HOŞ GELDİN YA ŞEHR-İ RAMAZAN', lights: true }, gift: 0 },
  { id: 'ramazanBayrami', name: 'Ramazan Bayramı', emoji: '🍬', greeting: '🍬 Ramazan Bayramınız mübarek olsun! Bayram harçlığın cebinde.', decor: { mahya: 'BAYRAMINIZ MÜBAREK OLSUN', flags: true, lights: true }, gift: 500 },
  { id: 'kurbanBayrami', name: 'Kurban Bayramı', emoji: '🕌', greeting: '🕌 Kurban Bayramınız mübarek olsun! Bayram harçlığın cebinde.', decor: { mahya: 'BAYRAMINIZ MÜBAREK OLSUN', flags: true, lights: true }, gift: 500 },
];

export const festivalById = (id: string): FestivalDef | undefined => FESTIVALS.find((f) => f.id === id);

/** [month, day] on the Istanbul calendar, inclusive ranges */
type Md = [number, number];
const FIXED: { id: FestivalId; from: Md; to: Md }[] = [
  { id: 'cumhuriyet', from: [10, 28], to: [10, 29] },
  { id: 'cocuk', from: [4, 22], to: [4, 23] },
  { id: 'genclik', from: [5, 19], to: [5, 19] },
  { id: 'zafer', from: [8, 30], to: [8, 30] },
  { id: 'yilbasi', from: [12, 24], to: [12, 31] },
  { id: 'yilbasi', from: [1, 1], to: [1, 1] },
];

/**
 * The lunar dates move ~11 days a year. Diyanet's calendar, as known in 2026: Ramazan's first
 * fast, the bayram's first day and its length. Later years are approximate; the owner can
 * override from the admin panel when the announced dates differ.
 */
const LUNAR: Record<number, { ramazan: string; bayram: string; kurban: string }> = {
  2026: { ramazan: '2026-02-19', bayram: '2026-03-20', kurban: '2026-05-27' },
  2027: { ramazan: '2027-02-08', bayram: '2027-03-09', kurban: '2027-05-16' },
  2028: { ramazan: '2028-01-28', bayram: '2028-02-26', kurban: '2028-05-05' },
  2029: { ramazan: '2029-01-16', bayram: '2029-02-14', kurban: '2029-04-24' },
  2030: { ramazan: '2030-01-05', bayram: '2030-02-04', kurban: '2030-04-13' },
};

const ISTANBUL_OFFSET_MS = 3 * 3600_000;
const DAY = 86_400_000;

/** the Istanbul calendar day of an instant, as a UTC midnight timestamp */
function istanbulDay(ms: number): number {
  return Math.floor((ms + ISTANBUL_OFFSET_MS) / DAY) * DAY;
}

/** The festival on at this instant (by the calendar), or null. Bayrams win over the rest. */
export function festivalAt(ms: number): FestivalId | null {
  const day = istanbulDay(ms);
  const d = new Date(day);
  const y = d.getUTCFullYear();
  const lunar = LUNAR[y];
  if (lunar) {
    const at = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
    const bayram = at(lunar.bayram);
    const kurban = at(lunar.kurban);
    if (day >= bayram && day < bayram + 3 * DAY) return 'ramazanBayrami';
    if (day >= kurban && day < kurban + 4 * DAY) return 'kurbanBayrami';
    if (day >= at(lunar.ramazan) && day < bayram) return 'ramazan';
  }
  const md = (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
  for (const f of FIXED) if (md >= f.from[0] * 100 + f.from[1] && md <= f.to[0] * 100 + f.to[1]) return f.id;
  return null;
}

/** Key of one festival occurrence (for the once-per-bayram gift): `kurbanBayrami:2027`. */
export function festivalKey(id: FestivalId, ms: number): string {
  // yılbaşı spans the new year: count 24–31 Dec with the coming year
  const d = new Date(istanbulDay(ms));
  const y = d.getUTCFullYear() + (id === 'yilbasi' && d.getUTCMonth() === 11 ? 1 : 0);
  return `${id}:${y}`;
}
