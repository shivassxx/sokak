import { POINTS,TavlaGame, countAt, isHomePoint, legalSequences, pipCount, type Move, type Position, type Result, type Side, type TavlaEvent } from './game';

/**
 * A simple kahvehane opponent: tries every legal way to play the roll and keeps the
 * final position that scores best on pip count, hits, made points (home board and
 * primes), exposed blots and bearing off. Plays a sane game, not a strong one.
 */

/** Is there still contact (can a checker of one side still meet the other)? */
function contact(p: Position): boolean {
  if (p.bar[0] || p.bar[1]) return true;
  let maxWhite = -1;
  let minBlack = POINTS;
  for (let i = 0; i < POINTS; i++) {
    if (countAt(p, 0, i)) maxWhite = Math.max(maxWhite, i);
    if (countAt(p, 1, i)) minBlack = Math.min(minBlack, i);
  }
  // white moves down, black moves up: they still meet while a black checker is below a white one
  return minBlack < maxWhite;
}

/** Rough chance (0..1) that a blot of `side` on point i gets hit next roll. */
function shotRisk(p: Position, side: Side, i: number): number {
  const opp: Side = side === 0 ? 1 : 0;
  let direct = 0;
  let indirect = 0;
  for (let d = 1; d <= 12; d++) {
    // where an opponent checker would have to be to reach i with d pips
    const j = opp === 0 ? i + d : i - d;
    let n = 0;
    if (j >= 0 && j < POINTS) n = countAt(p, opp, j);
    else if ((opp === 0 && j === POINTS) || (opp === 1 && j === -1)) n = p.bar[opp];
    if (!n) continue;
    if (d <= 6) direct++;
    else indirect++;
  }
  return Math.min(1, (direct * 11 + indirect * 2) / 36);
}

/** Score of a position for `side` (higher is better). */
export function evaluate(p: Position, side: Side): number {
  const opp: Side = side === 0 ? 1 : 0;
  const my = pipCount(p, side);
  const their = pipCount(p, opp);
  let s = (their - my) + p.off[side] * 1.5 - p.off[opp] * 1.5;
  if (!contact(p)) return s * 2;
  s += p.bar[opp] * 7 - p.bar[side] * 7;
  let run = 0;
  let bestRun = 0;
  for (let k = 0; k < POINTS; k++) {
    // walk in this side's direction of travel (far end first)
    const i = side === 0 ? POINTS - 1 - k : k;
    const n = countAt(p, side, i);
    if (n >= 2) {
      s += 1.5;
      if (isHomePoint(side, i)) s += 2.5;
      else if (isHomePoint(opp, i)) s += 1; // an anchor in their home
      run++;
      bestRun = Math.max(bestRun, run);
      if (n > 5) s -= (n - 5) * 0.6;
    } else {
      run = 0;
      if (n === 1) {
        const travelled = side === 0 ? POINTS - 1 - i : i;
        s -= shotRisk(p, side, i) * (travelled + 6);
      }
    }
  }
  s += bestRun >= 3 ? bestRun * bestRun * 0.6 : 0;
  return s;
}

/** The best way to play the dice from here (empty if nothing can be played). */
export function bestSequence(p: Position, side: Side, dice: readonly number[]): Move[] {
  let best: Move[] = [];
  let bestScore = -Infinity;
  for (const seq of legalSequences(p, side, dice)) {
    const sc = evaluate(seq.pos, side);
    if (sc > bestScore) {
      bestScore = sc;
      best = seq.moves;
    }
  }
  return best;
}

export type TavlaBotStep = { type: 'roll' } | { type: 'move'; from: number; to: number } | { type: 'end' };

const plans = new WeakMap<TavlaGame, Move[]>();

/** The bot's next single action for `side` (null if it is not its turn / the game is over). */
export function botStep(g: TavlaGame, side: Side): TavlaBotStep | null {
  if (g.phase === 'ended' || g.turn !== side) return null;
  if (g.phase === 'roll') return { type: 'roll' };
  const legal = g.legalMoves();
  if (!legal.length) return { type: 'end' };
  let plan = plans.get(g);
  const next = plan?.[0];
  if (!plan || !next || !legal.some((m) => m.from === next.from && m.to === next.to)) {
    plan = bestSequence(g.position(), side, g.dice);
    plans.set(g, plan);
  }
  const m = plan.shift() ?? legal[0]!;
  return { type: 'move', from: m.from, to: m.to };
}

/** Play the whole turn for `side` at once (time-outs): roll if needed, move, pass the turn. */
export function autoTurn(g: TavlaGame, side: Side): Result {
  const events: TavlaEvent[] = [];
  for (let guard = 0; guard < 12; guard++) {
    const step = botStep(g, side);
    if (!step) break;
    const r = step.type === 'roll' ? g.roll(side) : step.type === 'move' ? g.move(side, step.from, step.to) : g.endTurn(side);
    if (!r.ok) return r;
    events.push(...r.events);
    if (step.type === 'end') break;
  }
  return events.length ? { ok: true, events } : { ok: false, error: 'Sıra sende değil.' };
}
