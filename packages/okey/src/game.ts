import {
  FAKE_OKEYS,
  TILE_COUNT,
  asPair,
  asSeries,
  isFake,
  isJoker,
  okeyFaceFor,
  playFace,
  rawFace,
  sameFace,
  shuffled,
  tileValue,
  type Face,
  type MeldKind,
  type OkeyCtx,
} from './tiles';

/**
 * One hand of 101 Okey for 4 seats (pure, deterministic with an injected rng).
 * Turn order goes seat → seat+1. A player may take the top discard of the
 * previous seat ("soldan almak") only if that tile is laid on the table in
 * the same turn.
 */
export const OPEN_POINTS = 101;
export const OPEN_PAIRS = 5;
export const SEATS = 4;
/** seconds during which "Hile var!" can catch a tile theft */
export const STEAL_WINDOW_MS = 6000;

export interface Meld {
  id: number;
  owner: number;
  kind: MeldKind;
  tiles: number[];
}

export type OpenMode = 'series' | 'pairs';
export type Phase = 'draw' | 'play' | 'ended';

export type OkeyEvent =
  | { type: 'drew'; seat: number; from: 'deck' | 'left' }
  | { type: 'putBack'; seat: number }
  | { type: 'opened'; seat: number; mode: OpenMode; points: number }
  | { type: 'laid'; seat: number; meldId: number }
  | { type: 'added'; seat: number; meldId: number; tile: number }
  | { type: 'jokerSwapped'; seat: number; meldId: number }
  | { type: 'discarded'; seat: number; tile: number; islek: boolean }
  | { type: 'turn'; seat: number }
  | { type: 'stole'; seat: number; fromSeat: number }
  | { type: 'caught'; thief: number; by: number }
  | { type: 'falseAccusation'; by: number; accused: number | null }
  | { type: 'shownGosterge'; seat: number; tile: number }
  | { type: 'handEnd'; result: HandResult };

export interface HandResult {
  /** seat that finished, or null when the deck ran out */
  finisher: number | null;
  /** penalty points per seat for this hand (lower is better; finisher negative) */
  scores: number[];
  multiplier: number;
  reason: 'finished' | 'deckEmpty';
  okeyFinish: boolean;
}

export interface StealRecord {
  thief: number;
  pileSeat: number;
  /** tile the thief took from the pile */
  took: number;
  /** tile the thief left on the pile */
  left: number;
  at: number;
  resolved: boolean;
}

export type Result<T = OkeyEvent[]> = { ok: true; events: T } | { ok: false; error: string };

const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });

export class OkeyGame {
  readonly ctx: OkeyCtx;
  readonly gosterge: number;
  hands: number[][] = [[], [], [], []];
  deck: number[] = [];
  /** per seat discard pile, last element = top */
  discards: number[][] = [[], [], [], []];
  melds: Meld[] = [];
  opened: (OpenMode | null)[] = [null, null, null, null];
  penalties = [0, 0, 0, 0];
  turn: number;
  phase: Phase = 'play';
  /** tile taken from the left that must be laid before discarding */
  takenFromLeft: number | null = null;
  /** opened during the current turn (for "elden bitme") */
  openedThisTurn = false;
  /** laid / added anything this turn (taking-from-left can no longer be undone) */
  private acted = false;
  stealUsed = [false, false, false, false];
  /** showed the gösterge's twin on the first turn (−101) */
  shown = [false, false, false, false];
  /** discards made by each seat this hand (the gösterge can only be shown before the first) */
  turnsDone = [0, 0, 0, 0];
  lastSteal: StealRecord | null = null;
  result: HandResult | null = null;
  private nextMeldId = 1;

  constructor(
    readonly dealer: number,
    rng: () => number,
  ) {
    const order = shuffled(TILE_COUNT, rng);
    // gösterge: first non-fake tile from the shuffled pile
    const gi = order.findIndex((t) => !isFake(t));
    this.gosterge = order.splice(gi, 1)[0]!;
    this.ctx = { okey: okeyFaceFor(this.gosterge) };
    for (let s = 0; s < SEATS; s++) {
      const n = s === dealer ? 22 : 21;
      this.hands[s] = order.splice(0, n);
    }
    this.deck = order;
    this.turn = dealer;
  }

  // ---------------------------------------------------------------- queries
  leftOf(seat: number): number {
    return (seat + SEATS - 1) % SEATS;
  }

  topDiscard(seat: number): number | null {
    const p = this.discards[seat]!;
    return p.length ? p[p.length - 1]! : null;
  }

  isOkey(tile: number): boolean {
    return isJoker(tile, this.ctx);
  }

  /** Can this tile be added to any meld on the table? */
  isIslek(tile: number): boolean {
    return this.melds.some((m) => this.canAdd(m, tile));
  }

  canAdd(m: Meld, tile: number): boolean {
    if (m.kind === 'pair') return false;
    const next = [...m.tiles, tile];
    const info = asSeries(next, this.ctx);
    return !!info && info.kind === m.kind;
  }

  // ---------------------------------------------------------------- turn
  private check(seat: number, phase: Phase): string | null {
    if (this.phase === 'ended') return 'El bitti.';
    if (seat !== this.turn) return 'Sıra sende değil.';
    if (this.phase !== phase) return phase === 'draw' ? 'Önce taş çek.' : 'Önce taş çekmelisin.';
    return null;
  }

  drawFromDeck(seat: number): Result {
    const e = this.check(seat, 'draw');
    if (e) return fail(e);
    const t = this.deck.shift();
    if (t === undefined) return fail('Deste bitti.');
    this.hands[seat]!.push(t);
    this.phase = 'play';
    return { ok: true, events: [{ type: 'drew', seat, from: 'deck' }] };
  }

  takeFromLeft(seat: number): Result {
    const e = this.check(seat, 'draw');
    if (e) return fail(e);
    const pile = this.discards[this.leftOf(seat)]!;
    const t = pile.pop();
    if (t === undefined) return fail('Solunda taş yok.');
    this.hands[seat]!.push(t);
    this.takenFromLeft = t;
    this.phase = 'play';
    return { ok: true, events: [{ type: 'drew', seat, from: 'left' }] };
  }

  /** Undo taking from the left (before using it). */
  putBack(seat: number): Result {
    if (this.turn !== seat || this.takenFromLeft === null) return fail('Geri koyacak taş yok.');
    if (this.acted) return fail('Bu tur per indirdin, artık geri koyamazsın.');
    const t = this.takenFromLeft;
    const h = this.hands[seat]!;
    const i = h.indexOf(t);
    if (i < 0) return fail('Taş artık elinde değil.');
    h.splice(i, 1);
    this.discards[this.leftOf(seat)]!.push(t);
    this.takenFromLeft = null;
    this.phase = 'draw';
    return { ok: true, events: [{ type: 'putBack', seat }] };
  }

  private hasTiles(seat: number, tiles: number[]): boolean {
    const h = this.hands[seat]!;
    const uniq = new Set(tiles);
    return uniq.size === tiles.length && tiles.every((t) => h.includes(t));
  }

  private removeFromHand(seat: number, tiles: number[]): void {
    this.acted = true;
    const h = this.hands[seat]!;
    for (const t of tiles) h.splice(h.indexOf(t), 1);
    if (this.takenFromLeft !== null && tiles.includes(this.takenFromLeft)) this.takenFromLeft = null;
  }

  /**
   * Open the hand: series melds worth ≥ 101 points, or ≥ 5 pairs.
   * Groups must all be series melds or all pairs.
   */
  open(seat: number, groups: number[][]): Result {
    const e = this.check(seat, 'play');
    if (e) return fail(e);
    if (this.opened[seat]) return fail('Elin zaten açık.');
    if (!groups.length) return fail('Per seçmedin.');
    const all = groups.flat();
    if (!this.hasTiles(seat, all)) return fail('Bu taşlar elinde değil.');
    if (all.length >= this.hands[seat]!.length) return fail('Atacak bir taş bırakmalısın.');
    const pairs = groups.every((g) => g.length === 2);
    let points = 0;
    for (const g of groups) {
      const info = pairs ? asPair(g, this.ctx) : asSeries(g, this.ctx);
      if (!info) return fail(pairs ? 'Geçersiz çift var.' : 'Geçersiz per var (seri ya da aynı sayı farklı renk olmalı).');
      points += info.value;
    }
    if (pairs && groups.length < OPEN_PAIRS) return fail(`Çiftle açmak için en az ${OPEN_PAIRS} çift gerekir.`);
    if (!pairs && points < OPEN_POINTS) return fail(`Açmak için en az ${OPEN_POINTS} puan gerekir (şu an ${points}).`);
    const ev: OkeyEvent[] = [];
    for (const g of groups) ev.push(...this.place(seat, g, pairs ? 'pair' : asSeries(g, this.ctx)!.kind));
    this.removeFromHand(seat, all);
    this.opened[seat] = pairs ? 'pairs' : 'series';
    this.openedThisTurn = true;
    ev.unshift({ type: 'opened', seat, mode: pairs ? 'pairs' : 'series', points });
    return { ok: true, events: ev };
  }

  private place(seat: number, tiles: number[], kind: MeldKind): OkeyEvent[] {
    const m: Meld = { id: this.nextMeldId++, owner: seat, kind, tiles: [...tiles] };
    this.melds.push(m);
    return [{ type: 'laid', seat, meldId: m.id }];
  }

  /** After opening: lay another meld (pairs for pair-openers). */
  layMeld(seat: number, tiles: number[]): Result {
    const e = this.check(seat, 'play');
    if (e) return fail(e);
    const mode = this.opened[seat];
    if (!mode) return fail('Önce elini açmalısın.');
    if (!this.hasTiles(seat, tiles)) return fail('Bu taşlar elinde değil.');
    if (tiles.length >= this.hands[seat]!.length) return fail('Atacak bir taş bırakmalısın.');
    const info = mode === 'pairs' ? asPair(tiles, this.ctx) : asSeries(tiles, this.ctx);
    if (!info) return fail(mode === 'pairs' ? 'Çiftle açtın, sadece çift indirebilirsin.' : 'Geçersiz per.');
    const ev = this.place(seat, tiles, info.kind);
    this.removeFromHand(seat, tiles);
    return { ok: true, events: ev };
  }

  /** İşleme: add one tile to any run/set on the table. */
  addToMeld(seat: number, tile: number, meldId: number): Result {
    const e = this.check(seat, 'play');
    if (e) return fail(e);
    if (!this.opened[seat]) return fail('İşlemek için önce elini açmalısın.');
    if (!this.hasTiles(seat, [tile])) return fail('Bu taş elinde değil.');
    if (this.hands[seat]!.length <= 1) return fail('Atacak bir taş bırakmalısın.');
    const m = this.melds.find((x) => x.id === meldId);
    if (!m) return fail('Per bulunamadı.');
    if (!this.canAdd(m, tile)) return fail('Bu taş bu pere işlenmez.');
    m.tiles.push(tile);
    this.removeFromHand(seat, [tile]);
    return { ok: true, events: [{ type: 'added', seat, meldId, tile }] };
  }

  /** Replace an okey on the table with the real tile it stands for, take the okey. */
  swapJoker(seat: number, tile: number, meldId: number): Result {
    const e = this.check(seat, 'play');
    if (e) return fail(e);
    if (!this.opened[seat]) return fail('Önce elini açmalısın.');
    if (!this.hasTiles(seat, [tile])) return fail('Bu taş elinde değil.');
    const m = this.melds.find((x) => x.id === meldId);
    if (!m || m.kind === 'pair') return fail('Bu perde okey alınamaz.');
    const info = asSeries(m.tiles, this.ctx);
    const face = playFace(tile, this.ctx);
    if (!info || !face) return fail('Okey değiştirilemez.');
    const idx = m.tiles.findIndex((t, i) => this.isOkey(t) && sameFace(info.faces[i]!, face));
    if (idx < 0) return fail('Bu perdeki okey bu taşın yerine geçmiyor.');
    const joker = m.tiles[idx]!;
    const next = [...m.tiles];
    next[idx] = tile;
    if (!asSeries(next, this.ctx)) return fail('Okey değiştirilemez.');
    m.tiles = next;
    const h = this.hands[seat]!;
    h.splice(h.indexOf(tile), 1, joker);
    return { ok: true, events: [{ type: 'jokerSwapped', seat, meldId }] };
  }

  /** Discard ends the turn; an empty hand afterwards finishes the hand. */
  discard(seat: number, tile: number, force = false): Result {
    const e = this.check(seat, 'play');
    if (e) return fail(e);
    if (!this.hasTiles(seat, [tile])) return fail('Bu taş elinde değil.');
    if (this.takenFromLeft !== null) {
      if (!force) return fail('Soldan aldığın taşı işlemeden taş atamazsın (ya da geri koy).');
      // timeout with an unused left tile: classic 101 penalty
      this.penalties[seat]! += OPEN_POINTS;
      this.takenFromLeft = null;
    }
    const islek = !!this.opened[seat] && this.isIslek(tile) && !this.isOkey(tile);
    const ev: OkeyEvent[] = [];
    this.removeFromHand(seat, [tile]);
    this.acted = false;
    this.discards[seat]!.push(tile);
    this.turnsDone[seat]!++;
    if (islek) this.penalties[seat]! += OPEN_POINTS;
    ev.push({ type: 'discarded', seat, tile, islek });
    if (this.hands[seat]!.length === 0) {
      ev.push(...this.finish(seat, this.isOkey(tile)));
      return { ok: true, events: ev };
    }
    this.openedThisTurn = false;
    this.turn = (seat + 1) % SEATS;
    if (this.deck.length === 0 && this.topDiscard(this.leftOf(this.turn)) === null) {
      ev.push(...this.endDeckEmpty());
      return { ok: true, events: ev };
    }
    if (this.deck.length === 0) {
      // last chance: the next player may only take from the left; otherwise the hand ends
      this.phase = 'draw';
      ev.push({ type: 'turn', seat: this.turn });
      return { ok: true, events: ev };
    }
    this.phase = 'draw';
    ev.push({ type: 'turn', seat: this.turn });
    return { ok: true, events: ev };
  }

  /** The gösterge's twin in this hand, if the seat may still show it (own first turn, once). */
  gostergeTwin(seat: number): number | null {
    if (this.phase === 'ended' || seat !== this.turn || this.turnsDone[seat] !== 0 || this.shown[seat]) return null;
    const g = rawFace(this.gosterge);
    const t = this.hands[seat]!.find((x) => !isFake(x) && x !== this.gosterge && rawFace(x).color === g.color && rawFace(x).num === g.num);
    return t ?? null;
  }

  /** "Göstergeyi göster": on your first turn, show the twin of the gösterge for −101. */
  showGosterge(seat: number): Result {
    const tile = this.gostergeTwin(seat);
    if (tile === null) return fail(this.shown[seat] ? 'Göstergeyi zaten gösterdin.' : 'Göstergeyi sadece ilk sıranda, elinde eşi varsa gösterebilirsin.');
    this.shown[seat] = true;
    this.penalties[seat]! -= OPEN_POINTS;
    return { ok: true, events: [{ type: 'shownGosterge', seat, tile }] };
  }

  /** Turn timer ran out: draw if needed, put back unusable left tile, discard the newest tile. */
  autoPlay(seat: number): Result {
    if (seat !== this.turn || this.phase === 'ended') return fail('Sıra sende değil.');
    const ev: OkeyEvent[] = [];
    if (this.phase === 'draw') {
      if (this.deck.length === 0) return { ok: true, events: this.endDeckEmpty() };
      const r = this.drawFromDeck(seat);
      if (r.ok) ev.push(...r.events);
    }
    if (this.takenFromLeft !== null) {
      const r = this.putBack(seat);
      if (r.ok) {
        ev.push(...r.events);
        if (this.deck.length === 0) return { ok: true, events: [...ev, ...this.endDeckEmpty()] };
        const d = this.drawFromDeck(seat);
        if (d.ok) ev.push(...d.events);
      }
    }
    const h = this.hands[seat]!;
    // prefer a non-okey, non-işlek tile; the most recently drawn otherwise
    const pick = [...h].reverse().find((t) => !this.isOkey(t) && !(this.opened[seat] && this.isIslek(t))) ?? h[h.length - 1]!;
    const r = this.discard(seat, pick, true);
    if (!r.ok) return r;
    ev.push(...r.events);
    return { ok: true, events: ev };
  }

  /** The next player cannot draw any more: called when deck is empty and they won't take left. */
  declareDeckEmpty(seat: number): Result {
    if (seat !== this.turn || this.phase !== 'draw' || this.deck.length > 0) return fail('Deste bitmedi.');
    return { ok: true, events: this.endDeckEmpty() };
  }

  // ---------------------------------------------------------------- tile theft
  /**
   * "Taş çalma": once per hand, during your own turn after drawing, swap a
   * tile from your hand with the top discard of a player who is not your left.
   */
  steal(seat: number, myTile: number, pileSeat: number, now: number): Result {
    const e = this.check(seat, 'play');
    if (e) return fail(e);
    if (this.stealUsed[seat]) return fail('Bu elde zaten taş çaldın.');
    if (pileSeat === seat || pileSeat === this.leftOf(seat)) return fail('Solundakini zaten alabilirsin, başka birinden çal.');
    const pile = this.discards[pileSeat];
    if (!pile || pile.length === 0) return fail('Orada taş yok.');
    if (!this.hasTiles(seat, [myTile])) return fail('Bu taş elinde değil.');
    const took = pile.pop()!;
    pile.push(myTile);
    const h = this.hands[seat]!;
    h.splice(h.indexOf(myTile), 1, took);
    this.stealUsed[seat] = true;
    this.lastSteal = { thief: seat, pileSeat, took, left: myTile, at: now, resolved: false };
    return { ok: true, events: [{ type: 'stole', seat, fromSeat: pileSeat }] };
  }

  /** "Hile var!": catches the latest theft if it happened within the window. */
  accuse(by: number, now: number): Result {
    if (this.phase === 'ended') return fail('El bitti.');
    const s = this.lastSteal;
    if (s && !s.resolved && s.thief !== by && now - s.at <= STEAL_WINDOW_MS) {
      s.resolved = true;
      // undo the swap when both tiles are still where they were left
      const pile = this.discards[s.pileSeat]!;
      const h = this.hands[s.thief]!;
      if (pile[pile.length - 1] === s.left && h.includes(s.took)) {
        pile[pile.length - 1] = s.took;
        h.splice(h.indexOf(s.took), 1, s.left);
      }
      this.penalties[s.thief]! += OPEN_POINTS;
      return { ok: true, events: [{ type: 'caught', thief: s.thief, by }] };
    }
    return { ok: true, events: [{ type: 'falseAccusation', by, accused: s && !s.resolved ? s.thief : null }] };
  }

  // ---------------------------------------------------------------- end of hand
  private finish(seat: number, okeyFinish: boolean): OkeyEvent[] {
    const elden = this.openedThisTurn;
    const multiplier = okeyFinish || elden ? 2 : 1;
    const scores = [0, 1, 2, 3].map((s) => {
      if (s === seat) return -OPEN_POINTS * multiplier + this.penalties[s]!;
      return this.handPenalty(s) * multiplier + this.penalties[s]!;
    });
    return this.end({ finisher: seat, scores, multiplier, reason: 'finished', okeyFinish });
  }

  private endDeckEmpty(): OkeyEvent[] {
    const scores = [0, 1, 2, 3].map((s) => this.handPenalty(s) + this.penalties[s]!);
    return this.end({ finisher: null, scores, multiplier: 1, reason: 'deckEmpty', okeyFinish: false });
  }

  /** Points left in a hand: unopened 202, opened = tile values (okey 101), pair-openers double. */
  handPenalty(seat: number): number {
    const mode = this.opened[seat];
    if (!mode) return OPEN_POINTS * 2;
    const sum = this.hands[seat]!.reduce((a, t) => a + tileValue(t, this.ctx), 0);
    return mode === 'pairs' ? sum * 2 : sum;
  }

  private end(result: HandResult): OkeyEvent[] {
    this.phase = 'ended';
    this.result = result;
    return [{ type: 'handEnd', result }];
  }

  // ---------------------------------------------------------------- views
  /** Public state (no hands). */
  publicView(): PublicView {
    return {
      gosterge: this.gosterge,
      okey: this.ctx.okey,
      deck: this.deck.length,
      handCounts: this.hands.map((h) => h.length),
      discards: this.discards.map((p) => p.slice(-6)),
      melds: this.melds.map((m) => ({ ...m, tiles: [...m.tiles] })),
      opened: [...this.opened],
      penalties: [...this.penalties],
      turn: this.turn,
      phase: this.phase,
      takenFromLeft: this.takenFromLeft !== null,
      stealUsed: [...this.stealUsed],
      dealer: this.dealer,
      shown: [...this.shown],
      turnsDone: [...this.turnsDone],
    };
  }
}

export interface PublicView {
  gosterge: number;
  okey: Face;
  deck: number;
  handCounts: number[];
  /** last few tiles of every discard pile (top = last) */
  discards: number[][];
  melds: Meld[];
  opened: (OpenMode | null)[];
  penalties: number[];
  turn: number;
  phase: Phase;
  takenFromLeft: boolean;
  stealUsed: boolean[];
  dealer: number;
  /** who showed the gösterge this hand */
  shown: boolean[];
  /** discards made by each seat this hand */
  turnsDone: number[];
}

export { FAKE_OKEYS };
