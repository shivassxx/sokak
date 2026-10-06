import { asPair, asSeries, playFace, sameFace, type OkeyCtx } from './tiles';
import { OPEN_PAIRS, OPEN_POINTS, type OkeyGame } from './game';

/**
 * Meld search + a simple, decent bot. Pure functions over tile ids.
 */
export interface Arrangement {
  melds: number[][];
  points: number;
  rest: number[];
}

/** All candidate series melds (runs/sets) that can be built from `tiles`. */
export function candidateMelds(tiles: number[], ctx: OkeyCtx): number[][] {
  const jokers = tiles.filter((t) => playFace(t, ctx) === null);
  const real = tiles.filter((t) => playFace(t, ctx) !== null);
  const out: number[][] = [];
  const seen = new Set<string>();
  const push = (m: number[]) => {
    const k = [...m].sort((a, b) => a - b).join(',');
    if (seen.has(k)) return;
    seen.add(k);
    if (asSeries(m, ctx)) out.push(m);
  };
  // sets: group by number
  const byNum = new Map<number, number[]>();
  for (const t of real) {
    const f = playFace(t, ctx)!;
    byNum.set(f.num, [...(byNum.get(f.num) ?? []), t]);
  }
  for (const group of byNum.values()) {
    // one tile per colour (take first of each)
    const perColor = new Map<number, number>();
    for (const t of group) {
      const c = playFace(t, ctx)!.color;
      if (!perColor.has(c)) perColor.set(c, t);
    }
    const uniq = [...perColor.values()];
    const subsets = (arr: number[], k: number): number[][] =>
      k === 0 ? [[]] : arr.flatMap((x, i) => subsets(arr.slice(i + 1), k - 1).map((r) => [x, ...r]));
    for (let k = 1; k <= Math.min(4, uniq.length); k++) {
      for (const sub of subsets(uniq, k)) {
        for (let j = 0; j <= jokers.length && sub.length + j <= 4; j++) {
          if (sub.length + j >= 3) push([...sub, ...jokers.slice(0, j)]);
        }
      }
    }
  }
  // runs: per colour, sliding windows over values 1..14 (ace high)
  for (let c = 0; c < 4; c++) {
    const byVal = new Map<number, number>();
    for (const t of real) {
      const f = playFace(t, ctx)!;
      if (f.color !== c) continue;
      if (!byVal.has(f.num)) byVal.set(f.num, t);
      if (f.num === 1 && !byVal.has(14)) byVal.set(14, t);
    }
    for (let lo = 1; lo <= 12; lo++) {
      for (let hi = lo + 2; hi <= 14; hi++) {
        if (lo === 1 && hi === 14) continue;
        const run: number[] = [];
        let need = 0;
        let ok = true;
        for (let v = lo; v <= hi; v++) {
          const t = byVal.get(v);
          if (t !== undefined && !run.includes(t)) run.push(t);
          else need++;
          if (need > jokers.length) {
            ok = false;
            break;
          }
        }
        if (!ok) break;
        if (run.length === 0) continue;
        push([...run, ...jokers.slice(0, need)]);
      }
    }
  }
  return out;
}

/** Disjoint melds with the highest total points (depth-first with pruning). */
export function bestArrangement(tiles: number[], ctx: OkeyCtx, budgetNodes = 40000): Arrangement {
  const cands = candidateMelds(tiles, ctx).map((m) => ({ m, v: asSeries(m, ctx)!.value }));
  cands.sort((a, b) => b.v - a.v);
  let best: Arrangement = { melds: [], points: 0, rest: [...tiles] };
  let nodes = 0;
  const used = new Set<number>();
  const chosen: number[][] = [];
  const dfs = (start: number, points: number) => {
    if (++nodes > budgetNodes) return;
    if (points > best.points) {
      best = { melds: chosen.map((m) => [...m]), points, rest: tiles.filter((t) => !used.has(t)) };
    }
    for (let i = start; i < cands.length; i++) {
      const c = cands[i]!;
      if (c.m.some((t) => used.has(t))) continue;
      for (const t of c.m) used.add(t);
      chosen.push(c.m);
      dfs(i + 1, points + c.v);
      chosen.pop();
      for (const t of c.m) used.delete(t);
    }
  };
  dfs(0, 0);
  return best;
}

/** Pairs available in a hand (jokers complete leftover singles). */
export function bestPairs(tiles: number[], ctx: OkeyCtx): number[][] {
  const jokers = tiles.filter((t) => playFace(t, ctx) === null);
  const real = tiles.filter((t) => playFace(t, ctx) !== null);
  const pairs: number[][] = [];
  const used = new Set<number>();
  for (const a of real) {
    if (used.has(a)) continue;
    const fa = playFace(a, ctx)!;
    const b = real.find((x) => x !== a && !used.has(x) && sameFace(playFace(x, ctx)!, fa));
    if (b !== undefined) {
      used.add(a);
      used.add(b);
      pairs.push([a, b]);
    }
  }
  const singles = real.filter((t) => !used.has(t)).sort((x, y) => playFace(y, ctx)!.num - playFace(x, ctx)!.num);
  for (const j of jokers) {
    const s = singles.shift();
    if (s !== undefined) pairs.push([s, j]);
  }
  return pairs.filter((p) => asPair(p, ctx));
}

/** How useful a tile is to keep: neighbours in colour, same numbers… */
function keepScore(t: number, hand: number[], ctx: OkeyCtx): number {
  const f = playFace(t, ctx);
  if (!f) return 1000;
  let s = 0;
  for (const o of hand) {
    if (o === t) continue;
    const g = playFace(o, ctx);
    if (!g) continue;
    if (g.color === f.color && Math.abs(g.num - f.num) <= 2) s += 3 - Math.abs(g.num - f.num);
    if (g.num === f.num && g.color !== f.color) s += 2;
    if (sameFace(g, f)) s += 1.5;
  }
  return s - f.num * 0.08;
}

export type BotAction =
  | { type: 'drawDeck' }
  | { type: 'takeLeft' }
  | { type: 'open'; groups: number[][] }
  | { type: 'lay'; tiles: number[] }
  | { type: 'add'; tile: number; meldId: number }
  | { type: 'discard'; tile: number }
  | { type: 'deckEmpty' };

/** Next single action for the bot sitting at `seat`. Call repeatedly until it discards. */
export function botAction(g: OkeyGame, seat: number): BotAction {
  const hand = g.hands[seat]!;
  const ctx = g.ctx;
  if (g.phase === 'draw') {
    const left = g.topDiscard(g.leftOf(seat));
    if (left !== null) {
      // take from the left only when it is immediately usable
      const withIt = [...hand, left];
      if (g.opened[seat] === 'series') {
        if (g.isIslek(left) || bestArrangement(withIt, ctx, 8000).melds.some((m) => m.includes(left))) return { type: 'takeLeft' };
      } else if (!g.opened[seat]) {
        const arr = bestArrangement(withIt, ctx, 12000);
        if (arr.points >= OPEN_POINTS && arr.melds.some((m) => m.includes(left)) && arr.rest.length > 0) return { type: 'takeLeft' };
      }
    }
    if (g.deck.length === 0) return { type: 'deckEmpty' };
    return { type: 'drawDeck' };
  }
  // play phase: use a tile taken from the left first
  const taken = g.takenFromLeft;
  if (taken !== null && g.opened[seat]) {
    const meld = g.melds.find((m) => g.canAdd(m, taken));
    if (meld && hand.length > 1) return { type: 'add', tile: taken, meldId: meld.id };
    if (g.opened[seat] === 'series') {
      const m = bestArrangement(hand, ctx, 8000).melds.find((x) => x.includes(taken));
      if (m && hand.length - m.length >= 1) return { type: 'lay', tiles: m };
    }
  }
  if (!g.opened[seat]) {
    const arr = bestArrangement(hand, ctx, 15000);
    if (arr.points >= OPEN_POINTS && arr.rest.length > 0) return { type: 'open', groups: arr.melds };
    const pairs = bestPairs(hand, ctx);
    if (pairs.length >= OPEN_PAIRS + 1 && hand.length - pairs.length * 2 >= 1) return { type: 'open', groups: pairs };
  } else {
    if (g.opened[seat] === 'series') {
      const arr = bestArrangement(hand, ctx, 8000);
      const m = arr.melds.find((x) => x.length < hand.length);
      if (m && hand.length - m.length >= 1) return { type: 'lay', tiles: m };
    } else {
      const p = bestPairs(hand, ctx)[0];
      if (p && hand.length > 2) return { type: 'lay', tiles: p };
    }
    if (hand.length > 1) {
      for (const t of hand) {
        if (g.isOkey(t)) continue;
        const meld = g.melds.find((m) => g.canAdd(m, t));
        if (meld) return { type: 'add', tile: t, meldId: meld.id };
      }
    }
  }
  if (g.takenFromLeft !== null) {
    // could not use it after all — should not happen often; discard is blocked, so lay attempt failed
  }
  // discard: least useful, never the okey, avoid işlek tiles
  const options = hand.filter((t) => !g.isOkey(t));
  const pool = options.length ? options : hand;
  const safe = pool.filter((t) => !(g.opened[seat] && g.isIslek(t)) && t !== g.takenFromLeft);
  const list = safe.length ? safe : pool;
  let pick = list[0]!;
  let bestScore = Infinity;
  for (const t of list) {
    const sc = keepScore(t, hand, ctx);
    if (sc < bestScore) [pick, bestScore] = [t, sc];
  }
  return { type: 'discard', tile: pick };
}
