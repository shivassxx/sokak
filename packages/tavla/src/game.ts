/**
 * Tavla (Turkish backgammon) for two seats — pure and deterministic with an injected rng.
 *
 * Board: 24 points, index 0..23. `board[i] > 0` = that many white checkers (side 0),
 * `board[i] < 0` = black checkers (side 1).
 *  - White moves 23 → 0, its home board is 0..5, it enters from the bar on 24 − die.
 *  - Black moves 0 → 23, its home board is 18..23, it enters from the bar on die − 1.
 * Seen from white's side, index 0 is the near right corner (white's "1" point).
 *
 * Rules as played in Turkish kahvehanes: two dice, doubles play four times, both dice
 * must be used when possible (else the larger one), a blot that is hit goes to the bar
 * ("kırık") and must be entered before anything else, bearing off once all 15 are home
 * (a bigger die bears off from the highest point), a win is 1 point and "mars" (the loser
 * bore nothing off) is 2. No doubling cube.
 */
export type Side = 0 | 1;
/** `from` for a checker on the bar */
export const BAR = 24;
/** `to` for bearing off */
export const OFF = 25;
export const CHECKERS = 15;
export const POINTS = 24;

export interface Position {
  board: number[];
  bar: [number, number];
  off: [number, number];
}

export interface Move {
  from: number;
  to: number;
  die: number;
  hit: boolean;
}

export type Phase = 'roll' | 'move' | 'ended';

export type TavlaEvent =
  | { type: 'opening'; dice: [number, number]; first: Side }
  | { type: 'rolled'; side: Side; dice: number[] }
  | { type: 'noMoves'; side: Side }
  | { type: 'moved'; side: Side; from: number; to: number; die: number; hit: boolean }
  | { type: 'undone'; side: Side }
  | { type: 'turn'; side: Side }
  | { type: 'gameEnd'; winner: Side; value: number; mars: boolean };

export type Result<T = TavlaEvent[]> = { ok: true; events: T } | { ok: false; error: string };
const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });

/** Everything about a game is public in tavla: this goes to every client as JSON. */
export interface TavlaView {
  board: number[];
  bar: [number, number];
  off: [number, number];
  turn: Side;
  phase: Phase;
  /** dice still to be played this turn */
  dice: number[];
  /** what was rolled this turn (two values, also for doubles) */
  rolled: number[];
  /** moves made so far this turn (for highlighting) */
  moved: Move[];
  winner: Side | null;
  /** 1, or 2 for mars (only when ended) */
  value: number;
  /** the opening roll of this game: [white's die, black's die] */
  opening: [number, number] | null;
}

// ------------------------------------------------------------------ position helpers
export function startPosition(): Position {
  const board = new Array<number>(POINTS).fill(0);
  // white: 2 on its 24, 5 on 13, 3 on 8, 5 on 6 (1-based, white's view)
  board[23] = 2;
  board[12] = 5;
  board[7] = 3;
  board[5] = 5;
  // black mirrors it
  board[0] = -2;
  board[11] = -5;
  board[16] = -3;
  board[18] = -5;
  return { board, bar: [0, 0], off: [0, 0] };
}

export function clonePosition(p: Position): Position {
  return { board: p.board.slice(), bar: [p.bar[0], p.bar[1]], off: [p.off[0], p.off[1]] };
}

export function positionKey(p: Position): string {
  return `${p.board.join(',')}|${p.bar[0]},${p.bar[1]}|${p.off[0]},${p.off[1]}`;
}

/** How many checkers of `side` stand on point i. */
export function countAt(p: Position, side: Side, i: number): number {
  const v = p.board[i]!;
  return side === 0 ? (v > 0 ? v : 0) : v < 0 ? -v : 0;
}

export function isHomePoint(side: Side, i: number): boolean {
  return side === 0 ? i <= 5 : i >= 18;
}

/** All 15 (minus the ones already off) in the home board, none on the bar. */
export function allHome(p: Position, side: Side): boolean {
  if (p.bar[side] > 0) return false;
  for (let i = 0; i < POINTS; i++) if (!isHomePoint(side, i) && countAt(p, side, i) > 0) return false;
  return true;
}

/** Pips still to travel (bar = 25). */
export function pipCount(p: Position, side: Side): number {
  let n = p.bar[side] * 25;
  for (let i = 0; i < POINTS; i++) {
    const c = countAt(p, side, i);
    if (c) n += c * (side === 0 ? i + 1 : POINTS - i);
  }
  return n;
}

/** Point a checker of `side` enters on from the bar with `die`. */
export function entryPoint(side: Side, die: number): number {
  return side === 0 ? POINTS - die : die - 1;
}

/** Every single-checker move of `side` with one die (ignores the both-dice rule). */
export function singleMoves(p: Position, side: Side, die: number): Move[] {
  const opp: Side = side === 0 ? 1 : 0;
  const res: Move[] = [];
  const target = (to: number, from: number) => {
    const o = countAt(p, opp, to);
    if (o < 2) res.push({ from, to, die, hit: o === 1 });
  };
  if (p.bar[side] > 0) {
    target(entryPoint(side, die), BAR);
    return res;
  }
  const home = allHome(p, side);
  for (let i = 0; i < POINTS; i++) {
    if (countAt(p, side, i) === 0) continue;
    const t = side === 0 ? i - die : i + die;
    if (t >= 0 && t < POINTS) {
      target(t, i);
      continue;
    }
    if (!home) continue;
    const need = side === 0 ? i + 1 : POINTS - i;
    if (die === need) {
      res.push({ from: i, to: OFF, die, hit: false });
      continue;
    }
    // a bigger die bears off only from the highest occupied point
    let higher = false;
    if (side === 0) for (let j = i + 1; j <= 5 && !higher; j++) higher = countAt(p, side, j) > 0;
    else for (let j = 18; j < i && !higher; j++) higher = countAt(p, side, j) > 0;
    if (!higher) res.push({ from: i, to: OFF, die, hit: false });
  }
  return res;
}

export function applyMove(p: Position, side: Side, m: Move): Position {
  const q = clonePosition(p);
  const sign = side === 0 ? 1 : -1;
  if (m.from === BAR) q.bar[side]--;
  else q.board[m.from]! -= sign;
  if (m.to === OFF) q.off[side]++;
  else {
    if (m.hit) {
      q.board[m.to] = 0;
      q.bar[side === 0 ? 1 : 0]++;
    }
    q.board[m.to]! += sign;
  }
  return q;
}

function without(dice: readonly number[], d: number): number[] {
  const i = dice.indexOf(d);
  return i < 0 ? dice.slice() : [...dice.slice(0, i), ...dice.slice(i + 1)];
}
const distinct = (dice: readonly number[]) => [...new Set(dice)];

/** Most dice that can be played from here (memoised search). */
export function maxDiceUse(p: Position, side: Side, dice: readonly number[], memo = new Map<string, number>()): number {
  if (!dice.length) return 0;
  const key = `${positionKey(p)}#${[...dice].sort().join('')}`;
  const hit = memo.get(key);
  if (hit !== undefined) return hit;
  let best = 0;
  outer: for (const d of distinct(dice)) {
    for (const m of singleMoves(p, side, d)) {
      const n = 1 + maxDiceUse(applyMove(p, side, m), side, without(dice, d), memo);
      if (n > best) best = n;
      if (best === dice.length) break outer;
    }
  }
  memo.set(key, best);
  return best;
}

/**
 * The moves allowed now: each must be the start of a sequence that plays as many dice as
 * possible; if only one of two different dice can be played, it must be the larger one.
 */
export function legalMovesFor(p: Position, side: Side, dice: readonly number[]): Move[] {
  const memo = new Map<string, number>();
  const total = maxDiceUse(p, side, dice, memo);
  if (total === 0) return [];
  let moves: Move[] = [];
  for (const d of distinct(dice))
    for (const m of singleMoves(p, side, d)) if (1 + maxDiceUse(applyMove(p, side, m), side, without(dice, d), memo) === total) moves.push(m);
  if (total === 1 && dice.length === 2 && dice[0] !== dice[1]) {
    const big = Math.max(dice[0]!, dice[1]!);
    if (moves.some((m) => m.die === big)) moves = moves.filter((m) => m.die === big);
  }
  return moves;
}

/** Every distinct final position reachable with a legal full play of the dice. */
export function legalSequences(p: Position, side: Side, dice: readonly number[]): { moves: Move[]; pos: Position }[] {
  const memo = new Map<string, number>();
  const total = maxDiceUse(p, side, dice, memo);
  const out = new Map<string, { moves: Move[]; pos: Position }>();
  if (total === 0) return [{ moves: [], pos: clonePosition(p) }];
  const seen = new Set<string>();
  const rec = (q: Position, rest: number[], path: Move[]) => {
    if (path.length === total) {
      const k = positionKey(q);
      if (!out.has(k)) out.set(k, { moves: path, pos: q });
      return;
    }
    const sk = `${positionKey(q)}#${[...rest].sort().join('')}`;
    if (seen.has(sk)) return;
    seen.add(sk);
    for (const d of distinct(rest)) for (const m of singleMoves(q, side, d)) rec(applyMove(q, side, m), without(rest, d), [...path, m]);
  };
  rec(p, [...dice], []);
  let list = [...out.values()];
  if (total === 1 && dice.length === 2 && dice[0] !== dice[1]) {
    const big = Math.max(dice[0]!, dice[1]!);
    if (list.some((s) => s.moves[0]!.die === big)) list = list.filter((s) => s.moves[0]!.die === big);
  }
  return list;
}

// ------------------------------------------------------------------ the game
interface Snapshot {
  pos: Position;
  dice: number[];
  moved: Move[];
}

export class TavlaGame {
  board: number[];
  bar: [number, number];
  off: [number, number];
  turn: Side = 0;
  phase: Phase = 'move';
  dice: number[] = [];
  rolled: number[] = [];
  moved: Move[] = [];
  winner: Side | null = null;
  value = 0;
  opening: [number, number] | null = null;
  /** positions before each move of this turn (undo) */
  private history: Snapshot[] = [];
  private cachedLegal: Move[] | null = null;

  /**
   * A new game: the opening roll (one die each, ties re-rolled) decides who starts,
   * and the starter plays those two dice. `openingEvents` holds the opening event.
   */
  readonly openingEvents: TavlaEvent[] = [];

  constructor(
    private rng: () => number = Math.random,
    start?: { position?: Position; turn?: Side; dice?: number[] },
  ) {
    const p = start?.position ? clonePosition(start.position) : startPosition();
    this.board = p.board;
    this.bar = p.bar;
    this.off = p.off;
    if (start) {
      this.turn = start.turn ?? 0;
      if (start.dice) this.setDice(start.dice);
      else this.phase = 'roll';
      return;
    }
    let a = 0;
    let b = 0;
    do {
      a = this.die();
      b = this.die();
    } while (a === b);
    this.opening = [a, b];
    this.turn = a > b ? 0 : 1;
    this.setDice([a, b]);
    this.openingEvents.push({ type: 'opening', dice: [a, b], first: this.turn });
  }

  private die(): number {
    return Math.min(6, 1 + Math.floor(this.rng() * 6));
  }

  /** Start the turn's move phase with these dice (tests and the roll). */
  setDice(d: number[]): void {
    this.rolled = d.slice(0, 2);
    this.dice = d.length === 2 && d[0] === d[1] ? [d[0]!, d[0]!, d[0]!, d[0]!] : d.slice();
    this.phase = 'move';
    this.moved = [];
    this.history = [];
    this.cachedLegal = null;
  }

  position(): Position {
    return { board: this.board.slice(), bar: [this.bar[0], this.bar[1]], off: [this.off[0], this.off[1]] };
  }

  private setPosition(p: Position): void {
    this.board = p.board.slice();
    this.bar = [p.bar[0], p.bar[1]];
    this.off = [p.off[0], p.off[1]];
    this.cachedLegal = null;
  }

  legalMoves(): Move[] {
    if (this.phase !== 'move') return [];
    if (!this.cachedLegal) this.cachedLegal = legalMovesFor(this.position(), this.turn, this.dice);
    return this.cachedLegal;
  }

  /** The turn's dice are played (or nothing more can be played): the turn may be passed on. */
  get canEndTurn(): boolean {
    return this.phase === 'move' && this.legalMoves().length === 0;
  }

  roll(side: Side): Result {
    if (this.phase === 'ended') return fail('Oyun bitti.');
    if (side !== this.turn) return fail('Sıra sende değil.');
    if (this.phase !== 'roll') return fail('Zar zaten atıldı.');
    const a = this.die();
    const b = this.die();
    this.setDice([a, b]);
    const events: TavlaEvent[] = [{ type: 'rolled', side, dice: [a, b] }];
    if (this.legalMoves().length === 0) events.push({ type: 'noMoves', side });
    return { ok: true, events };
  }

  move(side: Side, from: number, to: number): Result {
    if (this.phase === 'ended') return fail('Oyun bitti.');
    if (side !== this.turn) return fail('Sıra sende değil.');
    if (this.phase !== 'move') return fail('Önce zar at.');
    const options = this.legalMoves().filter((m) => m.from === from && m.to === to);
    if (!options.length) {
      if (this.bar[side] > 0 && from !== BAR) return fail('Kırık taşın var, önce onu gir.');
      return fail('Bu hamle olmaz.');
    }
    // two dice reaching the same place (bearing off): spend the smaller one
    const m = options.reduce((a, b) => (b.die < a.die ? b : a));
    this.history.push({ pos: this.position(), dice: this.dice.slice(), moved: this.moved.slice() });
    this.setPosition(applyMove(this.position(), side, m));
    this.dice = without(this.dice, m.die);
    this.moved.push(m);
    this.cachedLegal = null;
    const events: TavlaEvent[] = [{ type: 'moved', side, ...m }];
    if (this.off[side] === CHECKERS) {
      const loser: Side = side === 0 ? 1 : 0;
      const mars = this.off[loser] === 0;
      this.phase = 'ended';
      this.winner = side;
      this.value = mars ? 2 : 1;
      this.dice = [];
      this.history = [];
      events.push({ type: 'gameEnd', winner: side, value: this.value, mars });
    }
    return { ok: true, events };
  }

  /** Take back the last move of this turn. */
  undo(side: Side): Result {
    if (side !== this.turn || this.phase !== 'move') return fail('Sıra sende değil.');
    const s = this.history.pop();
    if (!s) return fail('Geri alınacak hamle yok.');
    this.setPosition(s.pos);
    this.dice = s.dice;
    this.moved = s.moved;
    return { ok: true, events: [{ type: 'undone', side }] };
  }

  endTurn(side: Side): Result {
    if (side !== this.turn) return fail('Sıra sende değil.');
    if (this.phase === 'roll') return fail('Önce zar at.');
    if (this.phase !== 'move') return fail('Oyun bitti.');
    if (!this.canEndTurn) return fail('Oynayabileceğin zar var.');
    this.turn = side === 0 ? 1 : 0;
    this.phase = 'roll';
    this.dice = [];
    this.rolled = [];
    this.moved = [];
    this.history = [];
    this.cachedLegal = null;
    return { ok: true, events: [{ type: 'turn', side: this.turn }] };
  }

  publicView(): TavlaView {
    return {
      board: this.board.slice(),
      bar: [this.bar[0], this.bar[1]],
      off: [this.off[0], this.off[1]],
      turn: this.turn,
      phase: this.phase,
      dice: this.dice.slice(),
      rolled: this.rolled.slice(),
      moved: this.moved.slice(),
      winner: this.winner,
      value: this.value,
      opening: this.opening,
    };
  }
}

/** Match options: first to this many points wins the match. */
export const MATCH_LENGTHS = [1, 3, 5] as const;

/** A match to `length` points: one game after another, winner of each game adds 1 (or 2 for mars). */
export class TavlaMatch {
  score: [number, number] = [0, 0];
  games = 1;
  game: TavlaGame;

  constructor(
    readonly length: number,
    private rng: () => number = Math.random,
  ) {
    this.game = new TavlaGame(rng);
  }

  /** Book the finished game; true when the match is over. */
  record(): boolean {
    const g = this.game;
    if (g.phase !== 'ended' || g.winner === null || this.booked) return this.over;
    this.booked = true;
    this.score[g.winner] += g.value;
    return this.over;
  }
  private booked = false;

  get over(): boolean {
    return this.score[0] >= this.length || this.score[1] >= this.length;
  }

  get winner(): Side | null {
    return this.score[0] >= this.length ? 0 : this.score[1] >= this.length ? 1 : null;
  }

  nextGame(): TavlaGame {
    this.games++;
    this.booked = false;
    this.game = new TavlaGame(this.rng);
    return this.game;
  }
}
