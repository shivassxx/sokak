/**
 * Aksesuarlar: cosmetic avatar accessories. Bought with play money (never with
 * real money) or earned through an achievement; owned items live in the device
 * wallet. A set of accessories travels as a bitmask over ACCESSORIES (bit i =
 * ACCESSORIES[i]), so the list is append-only. At most one item per slot.
 */

export type AccSlot = 'head' | 'eyes' | 'hand' | 'neck' | 'face';

export const ACC_SLOTS: readonly { id: AccSlot; name: string }[] = [
  { id: 'head', name: 'Baş' },
  { id: 'eyes', name: 'Göz' },
  { id: 'face', name: 'Yüz' },
  { id: 'neck', name: 'Boyun / yelek' },
  { id: 'hand', name: 'El' },
];

export interface AccessoryDef {
  id: string;
  slot: AccSlot;
  emoji: string;
  name: string;
  /** play-money price; 0 = not for sale (earned through `ach`) */
  price: number;
  /** achievement id that gives this item for free */
  ach?: string;
}

/** Append-only: an item's index is its bit in every mask. */
export const ACCESSORIES: readonly AccessoryDef[] = [
  { id: 'kasket', slot: 'head', emoji: '🧢', name: 'Kasket', price: 400 },
  { id: 'fotr', slot: 'head', emoji: '🎩', name: 'Fötr şapka', price: 1500 },
  { id: 'gunes', slot: 'eyes', emoji: '🕶️', name: 'Güneş gözlüğü', price: 600 },
  { id: 'gozluk', slot: 'eyes', emoji: '👓', name: 'Numaralı gözlük', price: 300 },
  { id: 'tespih', slot: 'hand', emoji: '📿', name: 'Kehribar tespih', price: 0, ach: 'win10' },
  { id: 'kostek', slot: 'neck', emoji: '⌚', name: 'Köstekli saat', price: 0, ach: 'longMatch' },
  { id: 'atki', slot: 'neck', emoji: '🧣', name: 'Yün atkı', price: 500 },
  { id: 'biyik', slot: 'face', emoji: '🥸', name: 'Pala bıyık', price: 200 },
];

export const ACC_ALL = (1 << ACCESSORIES.length) - 1;

export const accIndex = (id: string): number => ACCESSORIES.findIndex((a) => a.id === id);
export const accessoryById = (id: string): AccessoryDef | undefined => ACCESSORIES.find((a) => a.id === id);

/** ids → mask (unknown ids are ignored) */
export function accMask(ids: readonly string[]): number {
  let m = 0;
  for (const id of ids) {
    const i = accIndex(id);
    if (i >= 0) m |= 1 << i;
  }
  return m;
}

/** mask → ids, in list order */
export function accIds(mask: number): string[] {
  return ACCESSORIES.filter((_, i) => mask & (1 << i)).map((a) => a.id);
}

/**
 * A wearable set: only owned, known items and at most one per slot (the first
 * in list order wins). Anything that is not a non-negative integer is "nothing".
 */
export function sanitizeWear(mask: unknown, owned: number): number {
  if (typeof mask !== 'number' || !Number.isInteger(mask) || mask < 0) return 0;
  let out = 0;
  const used = new Set<AccSlot>();
  ACCESSORIES.forEach((a, i) => {
    if (!(mask & owned & (1 << i)) || used.has(a.slot)) return;
    used.add(a.slot);
    out |= 1 << i;
  });
  return out;
}

/** Put on (`on`) or take off one item: putting on replaces whatever is in its slot. */
export function wearToggle(mask: number, id: string, on: boolean): number {
  const i = accIndex(id);
  if (i < 0) return mask;
  const slot = ACCESSORIES[i]!.slot;
  let m = mask;
  ACCESSORIES.forEach((a, j) => {
    if (a.slot === slot) m &= ~(1 << j);
  });
  return on ? m | (1 << i) : m;
}

/** Everything a device owns: what it bought plus the rewards of its unlocked achievements. */
export function ownedMask(bought: readonly string[] | undefined, achGot: readonly string[] | undefined): number {
  let m = accMask(bought ?? []);
  ACCESSORIES.forEach((a, i) => {
    if (a.ach && achGot?.includes(a.ach)) m |= 1 << i;
  });
  return m;
}

/** The accessory an achievement gives (shown on its card), if any. */
export const accessoryForAch = (achId: string): AccessoryDef | undefined => ACCESSORIES.find((a) => a.ach === achId);

/** client → server: buy one accessory { id } / put on or take off { id, on } */
export interface AccBuyMsg {
  id: string;
}
export interface AccWearMsg {
  id: string;
  on: boolean;
}
