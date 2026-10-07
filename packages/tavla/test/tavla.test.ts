import { describe, expect, it } from 'vitest';
import { BAR, OFF, TavlaGame, TavlaMatch, autoTurn, botStep, countAt, evaluate, legalMovesFor, legalSequences, pipCount, startPosition, type Position, type Side } from '../src';

function seeded(seed: number) {
  return () => (seed = (seed * 16807) % 2147483647) / 2147483647;
}
/** rng that rolls exactly these dice, then falls back to a seeded stream */
function scripted(...dice: number[]) {
  const rest = seeded(7);
  return () => {
    const d = dice.shift();
    return d === undefined ? rest() : (d - 1) / 6 + 0.01;
  };
}
/** position from { point: count } maps (white positive, black given as positive counts) */
function pos(white: Record<number, number>, black: Record<number, number>, o: { bar?: [number, number]; off?: [number, number] } = {}): Position {
  const board = new Array<number>(24).fill(0);
  for (const [i, n] of Object.entries(white)) board[Number(i)] = n;
  for (const [i, n] of Object.entries(black)) board[Number(i)] = -n;
  const bar = o.bar ?? [0, 0];
  const count = (s: Side) => board.reduce((a, v) => a + (s === 0 ? Math.max(0, v) : Math.max(0, -v)), 0) + bar[s];
  // whatever is not on the board or the bar is borne off
  const off: [number, number] = o.off ?? [15 - count(0), 15 - count(1)];
  return { board, bar, off };
}
const game = (p: Position, turn: Side, dice?: number[], rng = seeded(1)) => new TavlaGame(rng, { position: p, turn, dice });
const total = (g: TavlaGame, s: Side) => g.board.reduce((a, _, i) => a + countAt(g.position(), s, i), 0) + g.bar[s] + g.off[s];
const moves = (g: TavlaGame) => g.legalMoves().map((m) => `${m.from}>${m.to}`).sort();

describe('setup', () => {
  it('starts with 15 checkers each and 167 pips', () => {
    const p = startPosition();
    expect(pipCount(p, 0)).toBe(167);
    expect(pipCount(p, 1)).toBe(167);
    const g = new TavlaGame(seeded(3));
    expect(total(g, 0)).toBe(15);
    expect(total(g, 1)).toBe(15);
  });

  it('opening roll: ties are re-rolled, the higher die starts and plays both dice', () => {
    // 4-4 tie, then white 2, black 5 → black starts with 2 and 5
    const g = new TavlaGame(scripted(4, 4, 2, 5));
    expect(g.opening).toEqual([2, 5]);
    expect(g.turn).toBe(1);
    expect(g.phase).toBe('move');
    expect([...g.dice].sort()).toEqual([2, 5]);
    expect(g.openingEvents[0]).toMatchObject({ type: 'opening', first: 1 });
  });
});

describe('moves', () => {
  it('forced move: only one way to play', () => {
    // a lone white checker on 20 behind a black wall, 1 can't be played after the 6
    const g = game(pos({ 20: 1, 0: 2 }, { 13: 2, 12: 2, 19: 2 }), 0, [6, 5]);
    // 6: 20→14, then 5: 14→9 ; 5: 20→15, then 6: 15→9 ; both fine, but 19 blocks nothing here
    expect(moves(g)).toEqual(['20>14', '20>15']);
    const h = game(pos({ 20: 1, 0: 2 }, { 15: 2, 9: 2, 19: 2 }), 0, [6, 5]);
    // 5 is blocked (15), 6 then 5 lands on 9 (blocked) → only the 6 can be played
    expect(moves(h)).toEqual(['20>14']);
  });

  it('must use both dice when possible (a move that strands the other die is not allowed)', () => {
    // dice 6-3: the 3 cannot be played first (17 and 13 blocked);
    // A 20→14 leaves the 3 unplayable (11 blocked), B 16→10 lets B play the 3 too
    const g = game(pos({ 20: 1, 16: 1, 0: 13 }, { 17: 2, 13: 2, 11: 2 }), 0, [6, 3]);
    expect(moves(g)).toEqual(['16>10']);
    expect(g.move(0, 20, 14).ok).toBe(false);
    expect(g.move(0, 16, 10).ok).toBe(true);
    expect(moves(g)).toEqual(['10>7']);
  });

  it('if only one die can be played, it must be the larger one', () => {
    // 6 first → 14, then 13 blocked; 1 first → 19, then 13 blocked: only one die, play the 6
    const g = game(pos({ 20: 1, 0: 14 }, { 13: 2, 12: 2 }), 0, [1, 6]);
    expect(moves(g)).toEqual(['20>14']);
    expect(g.move(0, 20, 19).ok).toBe(false);
    expect(g.move(0, 20, 14).ok).toBe(true);
    expect(g.canEndTurn).toBe(true);
    // the larger one is blocked: then the smaller is fine
    const h = game(pos({ 20: 1, 0: 14 }, { 14: 2, 13: 2 }), 0, [1, 6]);
    expect(moves(h)).toEqual(['20>19']);
  });

  it('doubles are played four times', () => {
    const g = game(startPosition(), 0, [3, 3]);
    expect(g.dice).toEqual([3, 3, 3, 3]);
    for (const [f, t] of [
      [12, 9],
      [12, 9],
      [7, 4],
      [7, 4],
    ] as const)
      expect(g.move(0, f, t).ok).toBe(true);
    expect(g.dice).toEqual([]);
    expect(g.canEndTurn).toBe(true);
    expect(g.endTurn(0).ok).toBe(true);
    expect(g.turn).toBe(1);
    expect(g.phase).toBe('roll');
  });

  it('hitting a blot sends it to the bar (kırık)', () => {
    const g = game(pos({ 10: 2, 0: 13 }, { 7: 1, 23: 14 }), 0, [3, 1]);
    const r = g.move(0, 10, 7);
    expect(r.ok && r.events[0]).toMatchObject({ type: 'moved', hit: true });
    expect(g.bar[1]).toBe(1);
    expect(g.board[7]).toBe(1);
    expect(total(g, 1)).toBe(15);
  });

  it('a checker on the bar must enter first, on the right point', () => {
    const g = game(pos({ 10: 2, 0: 12 }, { 23: 15 - 2, 21: 2 }, { bar: [1, 0] }), 0, [3, 5]);
    // 24−3 = 21 is blocked, 24−5 = 19 is open
    expect(moves(g)).toEqual([`${BAR}>19`]);
    const r = g.move(0, 10, 7);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toMatch(/Kırık/);
    expect(g.move(0, BAR, 19).ok).toBe(true);
    // entered: now the 3 can be played anywhere
    expect(moves(g)).toContain('10>7');
    // black enters on die − 1
    const b = game(pos({ 0: 15 }, { 5: 14 }, { bar: [0, 1] }), 1, [2, 6]);
    expect(moves(b)).toEqual([`${BAR}>1`, `${BAR}>5`]);
  });

  it('blocked entry: nothing to play, the turn passes', () => {
    const g = game(pos({ 10: 2, 0: 12 }, { 18: 2, 19: 2, 20: 2, 21: 2, 22: 2, 23: 2 }, { bar: [1, 0] }), 0);
    expect(g.phase).toBe('roll');
    const r = g.roll(0);
    expect(r.ok && r.events.map((e) => e.type)).toEqual(['rolled', 'noMoves']);
    expect(g.canEndTurn).toBe(true);
    expect(g.move(0, 10, 9).ok).toBe(false);
    expect(g.endTurn(0).ok).toBe(true);
    expect(g.turn).toBe(1);
  });

  it('turn order and phases are enforced', () => {
    const g = game(startPosition(), 0);
    expect(g.move(0, 12, 9).ok).toBe(false); // roll first
    expect(g.roll(1).ok).toBe(false); // not black's turn
    expect(g.roll(0).ok).toBe(true);
    expect(g.roll(0).ok).toBe(false); // already rolled
    expect(g.endTurn(0).ok).toBe(false); // dice left to play
    expect(g.move(1, 0, 3).ok).toBe(false);
  });

  it('undo takes back moves within the turn', () => {
    const g = game(pos({ 10: 2, 0: 13 }, { 7: 1, 23: 14 }), 0, [3, 1]);
    g.move(0, 10, 7);
    g.move(0, 7, 6);
    expect(g.undo(0).ok).toBe(true);
    expect(g.undo(0).ok).toBe(true);
    expect(g.undo(0).ok).toBe(false);
    expect(g.board[10]).toBe(2);
    expect(g.board[7]).toBe(-1);
    expect(g.bar[1]).toBe(0);
    expect([...g.dice].sort()).toEqual([1, 3]);
  });
});

describe('bearing off', () => {
  it('only when all 15 are home', () => {
    const g = game(pos({ 6: 1, 2: 2 }, { 23: 15 }), 0, [3, 1]);
    // 2→OFF needs a 3, but a checker is still out on 6
    expect(moves(g)).not.toContain(`2>${OFF}`);
  });

  it('exact dice bear off; a bigger die only from the highest point', () => {
    const g = game(pos({ 3: 1, 1: 2 }, { 23: 15 }), 0, [6, 2]);
    const ms = moves(g);
    expect(ms).toContain(`3>${OFF}`); // 6 from the highest point (the "4")
    expect(ms).toContain(`1>${OFF}`); // exact 2
    expect(ms).toContain('3>1');
    expect(g.legalMoves().filter((m) => m.from === 1 && m.to === OFF).every((m) => m.die === 2)).toBe(true);
    expect(g.move(0, 3, OFF).ok).toBe(true);
    expect(g.off[0]).toBe(13);
    // the 6 is gone; with the 2 left the remaining checkers on 1 bear off exactly
    expect(moves(g)).toEqual([`1>${OFF}`]);
  });

  it('a bigger die does not bear off from a lower point while a higher one is occupied', () => {
    const g = game(pos({ 4: 1, 1: 1 }, { 23: 15 }), 0, [6, 6]);
    expect(moves(g)).toEqual([`4>${OFF}`]);
  });

  it('black bears off too', () => {
    const g = game(pos({ 0: 15 }, { 22: 1, 20: 1 }), 1, [2, 5]);
    expect(moves(g)).toContain(`22>${OFF}`); // exact 2
    expect(moves(g)).toContain(`20>${OFF}`); // 5 from the highest (20 needs 4)
  });

  it('winning: 1 point, mars (the loser bore nothing off) is 2', () => {
    const g = game(pos({ 0: 1 }, { 5: 15 }, { off: [14, 0] }), 0, [1, 2]);
    const r = g.move(0, 0, OFF);
    expect(r.ok && r.events.at(-1)).toMatchObject({ type: 'gameEnd', winner: 0, value: 2, mars: true });
    expect(g.phase).toBe('ended');
    expect(g.roll(1).ok).toBe(false);
    const h = game(pos({ 0: 1 }, { 20: 14 }, { off: [14, 1] }), 0, [1, 2]);
    const r2 = h.move(0, 0, OFF);
    expect(r2.ok && r2.events.at(-1)).toMatchObject({ type: 'gameEnd', winner: 0, value: 1, mars: false });
  });
});

describe('bot', () => {
  it('hits a blot when it is free to', () => {
    const p = pos({ 10: 2, 13: 2, 0: 11 }, { 7: 1, 23: 14 });
    const seqs = legalSequences(p, 0, [3, 6]);
    expect(seqs.length).toBeGreaterThan(1);
    const g = game(p, 0, [3, 6]);
    const before = g.bar[1];
    autoTurn(g, 0);
    expect(g.bar[1]).toBe(before + 1);
  });

  it('evaluates the starting position as even', () => {
    expect(evaluate(startPosition(), 0)).toBeCloseTo(evaluate(startPosition(), 1), 5);
  });

  it('legal sequences agree with the single-move rule', () => {
    const rng = seeded(11);
    for (let k = 0; k < 30; k++) {
      const g = new TavlaGame(rng);
      while (g.phase !== 'ended' && Math.abs(rng()) < 0.97) {
        const s = botStep(g, g.turn)!;
        if (s.type === 'roll') g.roll(g.turn);
        else if (s.type === 'move') g.move(g.turn, s.from, s.to);
        else g.endTurn(g.turn);
      }
      if (g.phase !== 'move') continue;
      const firsts = new Set(legalSequences(g.position(), g.turn, g.dice).map((q) => q.moves[0] && `${q.moves[0].from}>${q.moves[0].to}`).filter(Boolean));
      const singles = new Set(legalMovesFor(g.position(), g.turn, g.dice).map((m) => `${m.from}>${m.to}`));
      for (const f of firsts) expect(singles.has(f!)).toBe(true);
    }
  });

  it('a full bot-vs-bot game ends with a winner, checkers conserved throughout', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const g = new TavlaGame(seeded(seed));
      let steps = 0;
      while (g.phase !== 'ended') {
        const s = botStep(g, g.turn)!;
        const r = s.type === 'roll' ? g.roll(g.turn) : s.type === 'move' ? g.move(g.turn, s.from, s.to) : g.endTurn(g.turn);
        expect(r.ok).toBe(true);
        expect(total(g, 0)).toBe(15);
        expect(total(g, 1)).toBe(15);
        expect(++steps).toBeLessThan(3000);
      }
      expect(g.winner === 0 || g.winner === 1).toBe(true);
      expect(g.off[g.winner!]).toBe(15);
      expect([1, 2]).toContain(g.value);
    }
  });

  it('beats a player who moves at random most of the time', () => {
    const rng = seeded(5);
    let wins = 0;
    for (let k = 0; k < 20; k++) {
      const g = new TavlaGame(rng);
      while (g.phase !== 'ended') {
        if (g.turn === 0) autoTurn(g, 0);
        else if (g.phase === 'roll') g.roll(1);
        else {
          const l = g.legalMoves();
          if (!l.length) g.endTurn(1);
          else {
            const m = l[Math.floor(rng() * l.length)]!;
            g.move(1, m.from, m.to);
          }
        }
      }
      if (g.winner === 0) wins++;
    }
    expect(wins).toBeGreaterThanOrEqual(15);
  });

  it('a match to 3 points', () => {
    const m = new TavlaMatch(3, seeded(42));
    let games = 0;
    while (!m.over) {
      const g = m.game;
      while (g.phase !== 'ended') {
        const r = autoTurn(g, g.turn);
        expect(r.ok).toBe(true);
      }
      m.record();
      m.record(); // booking twice changes nothing
      games++;
      if (!m.over) m.nextGame();
    }
    expect(Math.max(...m.score)).toBeGreaterThanOrEqual(3);
    expect(m.winner).toBe(m.score[0] >= 3 ? 0 : 1);
    expect(m.games).toBe(games);
  });
});
