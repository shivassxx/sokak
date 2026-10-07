import { describe, expect, it } from 'vitest';
import {
  OkeyGame,
  asPair,
  asRun,
  asSeries,
  asSet,
  bestArrangement,
  botAction,
  candidateMelds,
  okeyFaceFor,
  partnerOf,
  playFace,
  teamOf,
  teamTotals,
  rawFace,
  tileValue,
  type OkeyCtx,
} from '../src';

/** tile id from colour/number/copy */
const T = (color: number, num: number, copy = 0) => color * 26 + copy * 13 + (num - 1);
// gösterge = red 5 → okey = red 6
const ctx: OkeyCtx = { okey: { color: 0, num: 6 } };
const OKEY = T(0, 6);
const OKEY2 = T(0, 6, 1);
const FAKE = 104;

function seeded(seed: number) {
  return () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
}

describe('tiles', () => {
  it('faces and okey', () => {
    expect(rawFace(T(2, 13, 1))).toEqual({ color: 2, num: 13 });
    expect(okeyFaceFor(T(3, 13))).toEqual({ color: 3, num: 1 });
    expect(playFace(OKEY, ctx)).toBeNull();
    expect(playFace(FAKE, ctx)).toEqual({ color: 0, num: 6 });
    expect(tileValue(OKEY, ctx)).toBe(101);
    expect(tileValue(T(1, 9), ctx)).toBe(9);
  });

  it('runs', () => {
    expect(asRun([T(1, 3), T(1, 4), T(1, 5)], ctx)?.value).toBe(12);
    expect(asRun([T(1, 3), T(1, 5), OKEY], ctx)?.value).toBe(12);
    expect(asRun([T(1, 12), T(1, 13), T(1, 1)], ctx)?.value).toBe(26);
    expect(asRun([T(1, 13), T(1, 1), T(1, 2)], ctx)).toBeNull();
    expect(asRun([T(1, 3), T(2, 4), T(1, 5)], ctx)).toBeNull();
    expect(asRun([T(1, 3), T(1, 4)], ctx)).toBeNull();
    // sahte okey plays as red 6
    expect(asRun([T(0, 5), FAKE, T(0, 7)], ctx)?.value).toBe(18);
    // spare joker extends upwards
    const r = asRun([T(1, 3), T(1, 4), OKEY], ctx)!;
    expect(r.faces[2]).toEqual({ color: 1, num: 5 });
  });

  it('sets and pairs', () => {
    expect(asSet([T(0, 9), T(1, 9), T(3, 9)], ctx)?.value).toBe(27);
    expect(asSet([T(0, 9), T(0, 9, 1), T(3, 9)], ctx)).toBeNull();
    expect(asSet([T(0, 9), T(1, 9), OKEY, OKEY2], ctx)?.value).toBe(36);
    expect(asSet([T(0, 9), T(1, 9), T(2, 9), T(3, 9), OKEY], ctx)).toBeNull();
    expect(asPair([T(2, 7), T(2, 7, 1)], ctx)).not.toBeNull();
    expect(asPair([T(2, 7), OKEY], ctx)).not.toBeNull();
    expect(asPair([T(2, 7), T(2, 8)], ctx)).toBeNull();
    expect(asSeries([T(2, 7), T(2, 8), T(2, 9)], ctx)?.kind).toBe('run');
  });

  it('meld search finds the best disjoint combination', () => {
    const hand = [T(1, 10), T(1, 11), T(1, 12), T(1, 13), T(0, 13), T(2, 13), T(3, 2), OKEY];
    expect(candidateMelds(hand, ctx).length).toBeGreaterThan(3);
    const best = bestArrangement(hand, ctx);
    // 10-11-12 run (33) + 13 set with joker (52) = 85 beats 10..13 run + ...
    expect(best.points).toBeGreaterThanOrEqual(85);
    const used = best.melds.flat();
    expect(new Set(used).size).toBe(used.length);
  });
});

/** A game with hand-crafted hands. */
function rigged(hands: number[][], dealer = 0, deck: number[] = [], partners = false): OkeyGame {
  const g = new OkeyGame(dealer, seeded(1), { partners });
  (g as unknown as { ctx: OkeyCtx }).ctx.okey = ctx.okey;
  g.hands = hands.map((h) => [...h]);
  g.deck = [...deck];
  return g;
}

describe('dealing', () => {
  it('deals 22 to the dealer and 21 to others, 20 left in the deck', () => {
    const g = new OkeyGame(2, seeded(7));
    expect(g.hands.map((h) => h.length)).toEqual([21, 21, 22, 21]);
    expect(g.deck.length).toBe(20);
    const all = [...g.hands.flat(), ...g.deck, g.gosterge];
    expect(new Set(all).size).toBe(106);
    expect(g.turn).toBe(2);
    expect(g.phase).toBe('play');
    expect(g.gosterge).toBeLessThan(104);
  });
});

describe('turn flow', () => {
  it('discard → next draws from deck or takes from the left', () => {
    const g = rigged([[T(1, 1), T(1, 2)], [T(2, 1)], [T(3, 1)], [T(3, 2)]], 0, [T(2, 9), T(2, 10)]);
    expect(g.drawFromDeck(0).ok).toBe(false); // dealer starts in play
    expect(g.discard(0, T(1, 1)).ok).toBe(true);
    expect(g.turn).toBe(1);
    expect(g.discard(1, T(2, 1)).ok).toBe(false); // must draw first
    expect(g.takeFromLeft(1).ok).toBe(true);
    // taken tile must be used: cannot discard
    expect(g.discard(1, T(2, 1)).ok).toBe(false);
    expect(g.putBack(1).ok).toBe(true);
    expect(g.drawFromDeck(1).ok).toBe(true);
    expect(g.discard(1, T(2, 1)).ok).toBe(true);
    expect(g.turn).toBe(2);
  });
});

describe('opening', () => {
  const big = [T(1, 11), T(1, 12), T(1, 13), T(0, 13), T(2, 13), T(3, 13), T(0, 10), T(1, 10), T(2, 10), T(3, 9)];
  // runs/sets: 11+12+13=36, 13*3=39, 10*3=30 => 105

  it('needs 101 points with valid melds', () => {
    const g = rigged([[...big], [], [], []]);
    expect(g.open(0, [[T(1, 11), T(1, 12), T(1, 13)]]).ok).toBe(false);
    const r = g.open(0, [
      [T(1, 11), T(1, 12), T(1, 13)],
      [T(0, 13), T(2, 13), T(3, 13)],
      [T(0, 10), T(1, 10), T(2, 10)],
    ]);
    expect(r.ok).toBe(true);
    expect(g.opened[0]).toBe('series');
    expect(g.hands[0]).toEqual([T(3, 9)]);
    expect(g.melds.length).toBe(3);
  });

  it('rejects invalid melds and requires one tile left to discard', () => {
    const g = rigged([[...big.slice(0, 9)], [], [], []]);
    expect(g.open(0, [[T(1, 11), T(0, 13), T(1, 13)]]).ok).toBe(false);
    const r = g.open(0, [
      [T(1, 11), T(1, 12), T(1, 13)],
      [T(0, 13), T(2, 13), T(3, 13)],
      [T(0, 10), T(1, 10), T(2, 10)],
    ]);
    expect(r.ok).toBe(false);
  });

  it('opens with 5 pairs', () => {
    const pairs = [1, 2, 3, 4, 5].map((n) => [T(2, n), T(2, n, 1)]);
    const g = rigged([[...pairs.flat(), T(3, 12)], [], [], []]);
    expect(g.open(0, pairs.slice(0, 4)).ok).toBe(false);
    expect(g.open(0, pairs).ok).toBe(true);
    expect(g.opened[0]).toBe('pairs');
    // pair openers can only lay pairs
    expect(g.layMeld(0, [T(3, 12)]).ok).toBe(false);
  });

  it('işleme and okey swap after opening', () => {
    const g = rigged([[...big, T(1, 10, 1), T(3, 4)], [T(0, 1)], [], []]);
    g.open(0, [
      [T(1, 11), T(1, 12), T(1, 13)],
      [T(0, 13), T(2, 13), T(3, 13)],
      [T(0, 10), T(1, 10), T(2, 10)],
    ]);
    const run = g.melds[0]!;
    expect(g.addToMeld(0, T(3, 4), run.id).ok).toBe(false);
    expect(g.addToMeld(0, T(1, 10, 1), run.id).ok).toBe(true);
    expect(run.tiles.length).toBe(4);
    // a meld with an okey; swap it for the real tile
    g.melds.push({ id: 99, owner: 1, kind: 'run', tiles: [T(3, 7), OKEY, T(3, 9)] });
    g.hands[0]!.push(T(3, 8));
    expect(g.swapJoker(0, T(3, 8), 99).ok).toBe(true);
    expect(g.hands[0]).toContain(OKEY);
    expect(g.melds.find((m) => m.id === 99)!.tiles).toContain(T(3, 8));
  });
});

describe('finishing and scoring', () => {
  it('finisher gets -101; unopened +202; opened pay their remaining tiles', () => {
    const g = rigged(
      [
        [T(1, 1), T(1, 2), T(1, 3), T(2, 9)],
        [T(0, 5), T(3, 3)],
        [T(0, 2)],
        [T(2, 12)],
      ],
      0,
      [T(3, 11)],
    );
    g.opened[0] = 'series';
    g.opened[1] = 'series';
    expect(g.layMeld(0, [T(1, 1), T(1, 2), T(1, 3)]).ok).toBe(true);
    const r = g.discard(0, T(2, 9));
    expect(r.ok).toBe(true);
    expect(g.phase).toBe('ended');
    expect(g.result!.finisher).toBe(0);
    expect(g.result!.scores).toEqual([-101, 8, 202, 202]);
  });

  it('finishing by discarding the okey doubles everything', () => {
    const g = rigged([[T(1, 1), T(1, 2), T(1, 3), OKEY], [T(0, 5)], [T(0, 2)], [T(2, 12)]], 0);
    g.opened[0] = 'series';
    g.layMeld(0, [T(1, 1), T(1, 2), T(1, 3)]);
    g.discard(0, OKEY);
    expect(g.result!.multiplier).toBe(2);
    expect(g.result!.scores[0]).toBe(-202);
    expect(g.result!.scores[1]).toBe(404);
  });

  it('discarding an işlek tile costs 101', () => {
    const g = rigged([[T(1, 4), T(2, 2), T(2, 3)], [T(0, 5)], [], []], 0, [T(3, 3), T(3, 4)]);
    g.opened[0] = 'series';
    g.melds.push({ id: 50, owner: 2, kind: 'run', tiles: [T(1, 1), T(1, 2), T(1, 3)] });
    const r = g.discard(0, T(1, 4));
    expect(r.ok && r.events.some((e) => e.type === 'discarded' && e.islek)).toBe(true);
    expect(g.penalties[0]).toBe(101);
  });

  it('deck running out ends the hand without a finisher', () => {
    const g = rigged([[T(1, 4), T(2, 2)], [T(0, 5)], [T(0, 6)], [T(0, 7)]], 0, []);
    g.discard(0, T(1, 4));
    expect(g.turn).toBe(1);
    expect(g.declareDeckEmpty(1).ok).toBe(true);
    expect(g.result!.reason).toBe('deckEmpty');
    expect(g.result!.scores).toEqual([202, 202, 202, 202]);
  });
});

describe('taş çalma', () => {
  function setup() {
    const g = rigged([[T(1, 4), T(2, 2), T(2, 3)], [T(0, 5)], [T(0, 9)], [T(3, 3)]], 0, [T(3, 11), T(3, 12)]);
    g.discards[2] = [T(2, 4)];
    g.discards[3] = [T(0, 1)];
    return g;
  }

  it('swap with a non-left pile once per hand', () => {
    const g = setup();
    expect(g.steal(0, T(1, 4), 3, 1000).ok).toBe(false); // seat 3 is the left of seat 0
    expect(g.steal(0, T(1, 4), 2, 1000).ok).toBe(true);
    expect(g.hands[0]).toContain(T(2, 4));
    expect(g.topDiscard(2)).toBe(T(1, 4));
    expect(g.steal(0, T(2, 2), 1, 1100).ok).toBe(false);
  });

  it('"Hile var!" in time catches and reverts the theft', () => {
    const g = setup();
    g.steal(0, T(1, 4), 2, 1000);
    const r = g.accuse(2, 4000);
    expect(r.ok && r.events[0]!.type).toBe('caught');
    expect(g.topDiscard(2)).toBe(T(2, 4));
    expect(g.hands[0]).toContain(T(1, 4));
    expect(g.penalties[0]).toBe(101);
  });

  it('too late or no theft = false accusation', () => {
    const g = setup();
    expect((g.accuse(1, 0) as { events: { type: string }[] }).events[0]!.type).toBe('falseAccusation');
    g.steal(0, T(1, 4), 2, 1000);
    expect((g.accuse(2, 9000) as { events: { type: string }[] }).events[0]!.type).toBe('falseAccusation');
  });
});

describe('gösterge', () => {
  it('the twin of the gösterge can be shown once, on your first turn, for −101', () => {
    for (let seed = 1; seed < 400; seed++) {
      const g = new OkeyGame(0, seeded(seed));
      // find a deal where the dealer holds the twin
      const twin = g.gostergeTwin(0);
      if (twin === null) continue;
      expect(g.gostergeTwin(1)).toBeNull(); // not your turn
      const r = g.showGosterge(0);
      expect(r.ok).toBe(true);
      expect(g.penalties[0]).toBe(-101);
      expect(g.showGosterge(0).ok).toBe(false); // only once
      // after the first discard it is too late for the others' later turns too
      g.discard(0, g.hands[0]!.find((t) => t !== twin)!);
      expect(g.publicView().shown).toEqual([true, false, false, false]);
      return;
    }
    throw new Error('no deal with the twin in the dealer hand');
  });

  it('a seat that already discarded cannot show it any more', () => {
    for (let seed = 1; seed < 400; seed++) {
      const g = new OkeyGame(0, seeded(seed));
      g.discard(0, g.hands[0]![0]!);
      g.drawFromDeck(1);
      g.discard(1, g.hands[1]![0]!);
      g.drawFromDeck(2);
      g.discard(2, g.hands[2]![0]!);
      g.drawFromDeck(3);
      g.discard(3, g.hands[3]![0]!);
      // dealer's second turn: even with the twin it is too late
      g.drawFromDeck(0);
      expect(g.gostergeTwin(0)).toBeNull();
      if (g.hands[0]!.some((t) => t !== g.gosterge && t < 104 && t % 26 % 13 === g.gosterge % 26 % 13 && Math.floor(t / 26) === Math.floor(g.gosterge / 26))) return;
    }
  });
});

describe('eşli (partners)', () => {
  it('teams are opposite seats', () => {
    expect([0, 1, 2, 3].map(teamOf)).toEqual([0, 1, 0, 1]);
    expect([0, 1, 2, 3].map(partnerOf)).toEqual([2, 3, 0, 1]);
    expect(teamTotals([-101, 8, 0, 202])).toEqual([-101, 210]);
  });

  it("finisher's partner writes no tile points; team totals are the partners' sum", () => {
    const g = rigged(
      [
        [T(1, 1), T(1, 2), T(1, 3), T(2, 9)],
        [T(0, 5), T(3, 3)],
        [T(0, 2)],
        [T(2, 12)],
      ],
      0,
      [T(3, 11)],
      true,
    );
    g.opened[0] = 'series';
    g.opened[1] = 'series';
    g.penalties[2] = 101; // the partner's own fine still counts
    g.layMeld(0, [T(1, 1), T(1, 2), T(1, 3)]);
    g.discard(0, T(2, 9));
    expect(g.result!.scores).toEqual([-101, 8, 101, 202]);
    expect(g.result!.teams).toEqual([0, 210]);
    expect(g.publicView().partners).toBe(true);
  });

  it('okey finish doubles the opponents; the partner still writes nothing', () => {
    const g = rigged([[T(1, 1), T(1, 2), T(1, 3), OKEY], [T(0, 5)], [T(0, 2)], [T(2, 12)]], 0, [], true);
    g.opened[0] = 'series';
    g.layMeld(0, [T(1, 1), T(1, 2), T(1, 3)]);
    g.discard(0, OKEY);
    expect(g.result!.scores).toEqual([-202, 404, 0, 404]);
    expect(g.result!.teams).toEqual([-202, 808]);
  });

  it('deck running out: every seat pays and teams add up', () => {
    const g = rigged([[T(1, 4), T(2, 2)], [T(0, 5)], [T(0, 7)], [T(0, 8)]], 0, [], true);
    g.opened[2] = 'series';
    g.discard(0, T(1, 4));
    g.declareDeckEmpty(1);
    expect(g.result!.scores).toEqual([202, 202, 7, 202]);
    expect(g.result!.teams).toEqual([209, 404]);
  });

  it('tekli results carry no team totals', () => {
    const g = rigged([[T(1, 4), T(2, 2)], [T(0, 5)], [T(0, 7)], [T(0, 8)]], 0, []);
    g.discard(0, T(1, 4));
    g.declareDeckEmpty(1);
    expect(g.result!.teams).toBeUndefined();
  });

  it('a partner may işle onto the partner\'s meld', () => {
    const g = rigged([[T(1, 4), T(2, 2)], [T(0, 5)], [], []], 0, [T(3, 3)], true);
    g.opened[0] = 'series';
    g.melds.push({ id: 7, owner: 2, kind: 'run', tiles: [T(1, 1), T(1, 2), T(1, 3)] });
    expect(g.addToMeld(0, T(1, 4), 7).ok).toBe(true);
  });

  it('no stealing from or accusing your partner', () => {
    const g = rigged([[T(1, 4), T(2, 2), T(2, 3)], [T(0, 5)], [T(0, 9)], [T(3, 3)]], 0, [T(3, 11)], true);
    g.discards[1] = [T(0, 1)];
    g.discards[2] = [T(2, 4)];
    expect(g.steal(0, T(1, 4), 2, 1000).ok).toBe(false);
    expect(g.steal(0, T(1, 4), 1, 1000).ok).toBe(true);
    expect(g.accuse(2, 2000).ok).toBe(false); // the thief's partner
    const r = g.accuse(1, 2000);
    expect(r.ok && r.events[0]!.type).toBe('caught');
  });

  it('bots do not hand the next opponent an işlek tile', () => {
    const g = rigged([[T(3, 9), T(1, 4), T(1, 5)], [T(0, 5)], [T(0, 9)], [T(3, 3)]], 0, [T(3, 11)], true);
    g.opened[1] = 'series';
    g.melds.push({ id: 3, owner: 1, kind: 'run', tiles: [T(3, 6), T(3, 7), T(3, 8)] });
    const a = botAction(g, 0);
    expect(a.type).toBe('discard');
    expect(a.type === 'discard' && a.tile).not.toBe(T(3, 9));
    // in tekli the same hand throws the loose 9
    const t = rigged([[T(3, 9), T(1, 4), T(1, 5)], [T(0, 5)], [T(0, 9)], [T(3, 3)]], 0, [T(3, 11)]);
    t.opened[1] = 'series';
    t.melds.push({ id: 3, owner: 1, kind: 'run', tiles: [T(3, 6), T(3, 7), T(3, 8)] });
    expect(botAction(t, 0)).toEqual({ type: 'discard', tile: T(3, 9) });
  });
});

describe('bots', () => {
  it('four bots play complete hands without errors (tekli and eşli)', () => {
    for (let seed = 1; seed <= 16; seed++) {
      const g = new OkeyGame(seed % 4, seeded(seed * 97), { partners: seed > 12 });
      let guard = 0;
      while (g.phase !== 'ended' && guard++ < 5000) {
        const s = g.turn;
        const a = botAction(g, s);
        let r;
        switch (a.type) {
          case 'drawDeck': r = g.drawFromDeck(s); break;
          case 'takeLeft': r = g.takeFromLeft(s); break;
          case 'deckEmpty': r = g.declareDeckEmpty(s); break;
          case 'open': r = g.open(s, a.groups); break;
          case 'lay': r = g.layMeld(s, a.tiles); break;
          case 'add': r = g.addToMeld(s, a.tile, a.meldId); break;
          case 'discard': r = g.discard(s, a.tile); break;
          case 'show': r = g.showGosterge(s); break;
        }
        if (!r.ok) r = g.autoPlay(s);
        expect(r.ok, `${seed}: ${a.type} ${'error' in r ? r.error : ''}`).toBe(true);
      }
      expect(g.phase).toBe('ended');
      const tiles = [...g.hands.flat(), ...g.deck, ...g.discards.flat(), ...g.melds.flatMap((m) => m.tiles), g.gosterge];
      expect(new Set(tiles).size).toBe(106);
      expect(tiles.length).toBe(106);
    }
  });
});
