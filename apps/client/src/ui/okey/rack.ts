import { asPair, asSeries, bestArrangement, bestPairs, sortTiles, type OkeyCtx } from '@sokak/okey';

/** The ıstaka: 2 rows of slots; null = empty slot. */
export const ROW = 15;
export const SLOTS = ROW * 2;
export type Rack = (number | null)[];

export function emptyRack(): Rack {
  return Array.from({ length: SLOTS }, () => null);
}

/** Keep tiles where they are, drop vanished ones, put new ones in free slots. */
export function syncRack(rack: Rack, hand: number[]): Rack {
  const set = new Set(hand);
  const next = rack.map((t) => (t !== null && set.has(t) ? t : null));
  const placed = new Set(next.filter((t): t is number => t !== null));
  for (const t of hand) {
    if (placed.has(t)) continue;
    // fill from the end of the second row backwards, then anywhere
    let i = -1;
    for (let k = SLOTS - 1; k >= 0; k--) if (next[k] === null) {
      i = k;
      break;
    }
    if (i < 0) i = next.indexOf(null);
    if (i >= 0) next[i] = t;
  }
  return next;
}

/**
 * Drop `tile` on slot `to`. An empty slot just takes it; an occupied one makes
 * room by sliding its neighbours towards the nearest free slot of that row
 * (like pushing tiles along a real ıstaka). A full row falls back to a swap.
 */
export function moveTile(rack: Rack, tile: number, to: number): Rack {
  const from = rack.indexOf(tile);
  if (from < 0 || from === to || to < 0 || to >= SLOTS) return rack;
  const next = [...rack];
  next[from] = null;
  if (next[to] === null) {
    next[to] = tile;
    return next;
  }
  const start = Math.floor(to / ROW) * ROW;
  let best = -1;
  for (let i = start; i < start + ROW; i++) if (next[i] === null && (best < 0 || Math.abs(i - to) < Math.abs(best - to))) best = i;
  if (best < 0) {
    next[from] = next[to]!;
    next[to] = tile;
    return next;
  }
  if (best > to) for (let i = best; i > to; i--) next[i] = next[i - 1]!;
  else for (let i = best; i < to; i++) next[i] = next[i + 1]!;
  next[to] = tile;
  return next;
}

/** Contiguous runs of tiles in each row = groups (the player's intended melds). */
export function rackGroups(rack: Rack): number[][] {
  const out: number[][] = [];
  for (let r = 0; r < 2; r++) {
    let cur: number[] = [];
    for (let c = 0; c < ROW; c++) {
      const t = rack[r * ROW + c];
      if (t === null || t === undefined) {
        if (cur.length) out.push(cur);
        cur = [];
      } else cur.push(t);
    }
    if (cur.length) out.push(cur);
  }
  return out;
}

export interface OpenPlan {
  mode: 'series' | 'pairs' | null;
  groups: number[][];
  points: number;
  pairs: number;
}

/** What "Elini aç" would send: valid series groups (and their points) or valid pairs. */
export function openPlan(rack: Rack, ctx: OkeyCtx): OpenPlan {
  const groups = rackGroups(rack);
  const series = groups.filter((g) => g.length >= 3 && asSeries(g, ctx));
  const points = series.reduce((s, g) => s + asSeries(g, ctx)!.value, 0);
  const pairs = groups.filter((g) => g.length === 2 && asPair(g, ctx));
  if (series.length) return { mode: 'series', groups: series, points, pairs: pairs.length };
  if (pairs.length) return { mode: 'pairs', groups: pairs, points: 0, pairs: pairs.length };
  return { mode: null, groups: [], points: 0, pairs: 0 };
}

function layout(groups: number[][], rest: number[]): Rack {
  const rack = emptyRack();
  let i = 0;
  const put = (g: number[]) => {
    // keep a group on one row
    const row = Math.floor(i / ROW);
    if (row < 1 && i % ROW + g.length > ROW) i = ROW;
    for (const t of g) if (i < SLOTS) rack[i++] = t;
    if (i % ROW !== 0) i++;
  };
  for (const g of groups) put(g);
  for (const t of rest) {
    if (i >= SLOTS) break;
    rack[i++] = t;
  }
  // anything that did not fit goes into free slots
  const placed = new Set(rack.filter((t) => t !== null));
  for (const t of [...groups.flat(), ...rest]) if (!placed.has(t)) rack[rack.indexOf(null)] = t;
  return rack;
}

/** "Seri diz": best melds first, the rest sorted by colour/number. */
export function arrangeSeries(hand: number[], ctx: OkeyCtx): Rack {
  const best = bestArrangement(hand, ctx, 25000);
  return layout(best.melds, sortTiles(best.rest, ctx));
}

/** "Çift diz": pairs first. */
export function arrangePairs(hand: number[], ctx: OkeyCtx): Rack {
  const pairs = bestPairs(hand, ctx);
  const used = new Set(pairs.flat());
  return layout(pairs, sortTiles(hand.filter((t) => !used.has(t)), ctx));
}
