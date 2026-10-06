/**
 * 101 Okey tiles and melds (pure).
 *
 * 106 tiles: 4 colours × 1..13 × 2 copies (ids 0..103) + 2 sahte okey (104, 105).
 * The gösterge decides the okey: same colour, next number (13 → 1).
 * Real okey tiles are jokers; sahte okey tiles stand for the okey's face.
 */
export type Color = 0 | 1 | 2 | 3;
export const COLOR_NAMES = ['kırmızı', 'sarı', 'mavi', 'siyah'] as const;
export const TILE_COUNT = 106;
export const FAKE_OKEYS = [104, 105] as const;

export interface Face {
  color: Color;
  num: number;
}

export function isFake(id: number): boolean {
  return id >= 104;
}

/** Printed face of a non-fake tile. */
export function rawFace(id: number): Face {
  const color = Math.floor(id / 26) as Color;
  const num = (id % 13) + 1;
  return { color, num };
}

export function okeyFaceFor(gosterge: number): Face {
  const g = rawFace(gosterge);
  return { color: g.color, num: (g.num % 13) + 1 };
}

/** Rules context of a hand: which face is the okey. */
export interface OkeyCtx {
  okey: Face;
}

export function isJoker(id: number, ctx: OkeyCtx): boolean {
  if (isFake(id)) return false;
  const f = rawFace(id);
  return f.color === ctx.okey.color && f.num === ctx.okey.num;
}

/** Face a tile plays as (null = joker / wild). */
export function playFace(id: number, ctx: OkeyCtx): Face | null {
  if (isFake(id)) return ctx.okey;
  if (isJoker(id, ctx)) return null;
  return rawFace(id);
}

export const sameFace = (a: Face, b: Face) => a.color === b.color && a.num === b.num;

export type MeldKind = 'run' | 'set' | 'pair';

export interface MeldInfo {
  kind: MeldKind;
  /** points of the meld (jokers count as the tile they replace) */
  value: number;
  /** for each tile (same order as input): the face it represents */
  faces: Face[];
}

/** Same number, different colours, 3–4 tiles. */
export function asSet(tiles: number[], ctx: OkeyCtx): MeldInfo | null {
  if (tiles.length < 3 || tiles.length > 4) return null;
  const faces = tiles.map((t) => playFace(t, ctx));
  const real = faces.filter((f): f is Face => f !== null);
  if (real.length === 0) return null;
  const num = real[0]!.num;
  const colors = new Set<number>();
  for (const f of real) {
    if (f.num !== num || colors.has(f.color)) return null;
    colors.add(f.color);
  }
  const free = ([0, 1, 2, 3] as Color[]).filter((c) => !colors.has(c));
  let k = 0;
  const out = faces.map((f) => f ?? { color: free[k++]!, num });
  return { kind: 'set', value: num * tiles.length, faces: out };
}

/**
 * Same colour, consecutive numbers, ≥ 3 tiles. 1 may come after 13
 * (11-12-13-1) but a run never wraps (13-1-2 is invalid). Ace counts 1 point.
 */
export function asRun(tiles: number[], ctx: OkeyCtx): MeldInfo | null {
  if (tiles.length < 3 || tiles.length > 13) return null;
  const faces = tiles.map((t) => playFace(t, ctx));
  const real = faces.filter((f): f is Face => f !== null);
  const jokers = faces.length - real.length;
  if (real.length === 0) return null;
  const color = real[0]!.color;
  if (real.some((f) => f.color !== color)) return null;
  for (const aceHigh of [false, true]) {
    const vals = real.map((f) => (aceHigh && f.num === 1 ? 14 : f.num));
    if (new Set(vals).size !== vals.length) continue;
    if (!aceHigh && vals.includes(14)) continue;
    const lo = Math.min(...vals);
    const hi = Math.max(...vals);
    const span = hi - lo + 1;
    const gaps = span - real.length;
    if (gaps > jokers) continue;
    // spare jokers extend the run upwards first, then downwards
    let extra = jokers - gaps;
    let top = hi;
    let bottom = lo;
    const maxTop = aceHigh ? 14 : 13;
    while (extra > 0 && top < maxTop) {
      top++;
      extra--;
    }
    while (extra > 0 && bottom > 1) {
      bottom--;
      extra--;
    }
    if (extra > 0) continue;
    if (aceHigh && bottom <= 1) continue;
    // assign represented faces
    const missing: number[] = [];
    for (let v = bottom; v <= top; v++) if (!vals.includes(v)) missing.push(v);
    let k = 0;
    const toNum = (v: number) => (v === 14 ? 1 : v);
    const out = faces.map((f) => (f ? f : { color, num: toNum(missing[k++]!) }));
    let value = 0;
    for (let v = bottom; v <= top; v++) value += toNum(v);
    return { kind: 'run', value, faces: out };
  }
  return null;
}

/** Two identical tiles (a joker pairs with anything). */
export function asPair(tiles: number[], ctx: OkeyCtx): MeldInfo | null {
  if (tiles.length !== 2) return null;
  const [a, b] = tiles.map((t) => playFace(t, ctx));
  if (a && b && !sameFace(a, b)) return null;
  const f = a ?? b ?? ctx.okey;
  return { kind: 'pair', value: f.num * 2, faces: [f, f] };
}

/** Any valid series meld (run or set). */
export function asSeries(tiles: number[], ctx: OkeyCtx): MeldInfo | null {
  return asRun(tiles, ctx) ?? asSet(tiles, ctx);
}

/** Penalty value of a tile left in hand (okey = 101). */
export function tileValue(id: number, ctx: OkeyCtx): number {
  const f = playFace(id, ctx);
  return f ? f.num : 101;
}

/** Sort helper: colour then number (jokers last). */
export function sortTiles(tiles: number[], ctx: OkeyCtx): number[] {
  const key = (t: number) => {
    const f = playFace(t, ctx);
    return f ? f.color * 20 + f.num : 999;
  };
  return [...tiles].sort((a, b) => key(a) - key(b) || a - b);
}

/** Deterministic shuffle with a seeded RNG (rng in [0,1)). */
export function shuffled(n: number, rng: () => number): number[] {
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}
