/**
 * Saklambaç rules as a pure state machine: no I/O, no timers, no randomness
 * except through the injected rng. The server feeds it player changes,
 * "Gördüm!" calls (already visibility-checked), base touches and time.
 *
 *   lobby → ebeSelection → counting → seeking → roundEnd → ebeSelection …
 *                                                       ↘ lobby (too few players)
 */
import { COUNTING_SECONDS, MIN_PLAYERS, SEEKING_SECONDS, type HiderStatus, type Phase, type Role } from '@sokak/shared';

export type { HiderStatus, Phase, Role };

export interface RulesConfig {
  minPlayers: number;
  ebeSelectionMs: number;
  countingMs: number;
  seekingMs: number;
  roundEndMs: number;
}

export const DEFAULT_CONFIG: RulesConfig = {
  minPlayers: MIN_PLAYERS,
  ebeSelectionMs: 3000,
  countingMs: COUNTING_SECONDS * 1000,
  seekingMs: SEEKING_SECONDS * 1000,
  roundEndMs: 10000,
};

export const SCORE = {
  /** hider reaches the base (sneak or race) */
  reachBase: 3,
  /** hider still free when time runs out */
  survive: 2,
  /** last hider frees everyone */
  saveAll: 5,
  /** Ebe per sobe */
  catch: 2,
} as const;

export interface RulesPlayer {
  id: string;
  role: Role;
  status: HiderStatus;
  score: number;
  /** seeking-time (ms) at which the hider was spotted / caught / safe */
  spottedAt: number | null;
  doneAt: number | null;
  /** seeking-time of the sobe (kept even if later freed) */
  caughtAt: number | null;
}

export type EndReason = 'allDone' | 'timeout' | 'ebeLeft';

export interface RoundSummary {
  round: number;
  reason: EndReason;
  ebeId: string;
  firstCaughtId: string | null;
  /** hider that stayed unseen the longest */
  bestHiderId: string | null;
  bestHiderMs: number;
  /** hider that stayed in play (not caught) the longest */
  longestSurvivorId: string | null;
  longestSurvivorMs: number;
  caught: string[];
  safe: string[];
  herkesKurtuldu: boolean;
  nextEbeId: string | null;
}

export type GameEvent =
  | { type: 'phase'; phase: Phase }
  | { type: 'ebeChosen'; id: string; reason: 'random' | 'firstCaught' | 'sameEbe' }
  | { type: 'countingDone' }
  | { type: 'spotted'; id: string }
  | { type: 'caught'; id: string }
  | { type: 'safe'; id: string; how: 'base' | 'timeout' }
  | { type: 'herkesKurtuldu'; by: string; freed: string[] }
  | { type: 'roundEnd'; summary: RoundSummary };

export type Rng = () => number;

export class SaklambacRules {
  phase: Phase = 'lobby';
  /** ms left in the current timed phase */
  timeLeftMs = 0;
  /** ms elapsed since seeking started */
  seekingMs = 0;
  round = 0;
  ebeId: string | null = null;
  readonly players = new Map<string, RulesPlayer>();
  /** join order, used for deterministic iteration */
  private order: string[] = [];
  private firstCaughtId: string | null = null;
  private herkes = false;
  private nextEbe: { id: string; reason: 'firstCaught' | 'sameEbe' } | null = null;
  lastSummary: RoundSummary | null = null;
  readonly config: RulesConfig;

  constructor(
    config: Partial<RulesConfig> = {},
    private rng: Rng = Math.random,
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ------------------------------------------------------------------ queries
  get(id: string): RulesPlayer | undefined {
    return this.players.get(id);
  }

  list(): RulesPlayer[] {
    return this.order.map((id) => this.players.get(id)!);
  }

  hiders(): RulesPlayer[] {
    return this.list().filter((p) => p.role === 'hider');
  }

  /** hiders still in play (hiding or spotted) */
  activeHiders(): RulesPlayer[] {
    return this.hiders().filter((p) => p.status === 'hiding' || p.status === 'spotted');
  }

  isRoundActive(): boolean {
    return this.phase === 'ebeSelection' || this.phase === 'counting' || this.phase === 'seeking';
  }

  /** Ebe cannot move during selection and counting. */
  isFrozen(id: string): boolean {
    return id === this.ebeId && (this.phase === 'ebeSelection' || this.phase === 'counting');
  }

  canStart(): boolean {
    return this.phase === 'lobby' && this.players.size >= this.config.minPlayers;
  }

  // ------------------------------------------------------------------ players
  addPlayer(id: string): GameEvent[] {
    if (this.players.has(id)) return [];
    const midRound = this.phase !== 'lobby';
    this.players.set(id, {
      id,
      role: midRound ? 'spectator' : 'none',
      status: 'none',
      score: 0,
      spottedAt: null,
      doneAt: null,
      caughtAt: null,
    });
    this.order.push(id);
    return [];
  }

  removePlayer(id: string): GameEvent[] {
    const p = this.players.get(id);
    if (!p) return [];
    this.players.delete(id);
    this.order = this.order.filter((x) => x !== id);
    if (this.nextEbe?.id === id) this.nextEbe = null;
    const ev: GameEvent[] = [];
    if (this.isRoundActive()) {
      if (id === this.ebeId) {
        this.nextEbe = null;
        ev.push(...this.endRound('ebeLeft'));
      } else if (this.phase === 'seeking' && this.activeHiders().length === 0) {
        ev.push(...this.endRound('allDone'));
      } else if (this.hiders().length === 0) {
        // nobody left to hide
        ev.push(...this.endRound('allDone'));
      }
    }
    if (this.ebeId === id && !this.isRoundActive()) this.ebeId = null;
    return ev;
  }

  // ------------------------------------------------------------------ flow
  start(): GameEvent[] {
    if (!this.canStart()) return [];
    return this.enterEbeSelection();
  }

  /** Back to the lobby (e.g. host resets). */
  toLobby(): GameEvent[] {
    this.phase = 'lobby';
    this.timeLeftMs = 0;
    this.ebeId = null;
    this.nextEbe = null;
    for (const p of this.players.values()) {
      p.role = 'none';
      p.status = 'none';
    }
    return [{ type: 'phase', phase: 'lobby' }];
  }

  tick(dtMs: number): GameEvent[] {
    if (this.phase === 'lobby') return [];
    this.timeLeftMs = Math.max(0, this.timeLeftMs - dtMs);
    if (this.phase === 'seeking') this.seekingMs += dtMs;
    if (this.timeLeftMs > 0) return [];
    switch (this.phase) {
      case 'ebeSelection':
        this.phase = 'counting';
        this.timeLeftMs = this.config.countingMs;
        return [{ type: 'phase', phase: 'counting' }];
      case 'counting':
        this.phase = 'seeking';
        this.timeLeftMs = this.config.seekingMs;
        this.seekingMs = 0;
        return [{ type: 'countingDone' }, { type: 'phase', phase: 'seeking' }];
      case 'seeking':
        return this.endRound('timeout');
      case 'roundEnd':
        if (this.players.size >= this.config.minPlayers) return this.enterEbeSelection();
        return this.toLobby();
      default:
        return [];
    }
  }

  // ------------------------------------------------------------------ actions
  /** Ebe called "Gördüm!" on a hider (visibility already validated). */
  spot(hiderId: string): GameEvent[] {
    if (this.phase !== 'seeking') return [];
    const h = this.players.get(hiderId);
    if (!h || h.role !== 'hider' || h.status !== 'hiding') return [];
    h.status = 'spotted';
    h.spottedAt = this.seekingMs;
    return [{ type: 'spotted', id: hiderId }];
  }

  /** A player is touching the Ebe Duvarı. */
  touchBase(id: string): GameEvent[] {
    if (this.phase !== 'seeking') return [];
    const p = this.players.get(id);
    if (!p) return [];
    const ev: GameEvent[] = [];
    if (id === this.ebeId) {
      for (const h of this.hiders()) {
        if (h.status !== 'spotted') continue;
        h.status = 'caught';
        h.doneAt = this.seekingMs;
        h.caughtAt = this.seekingMs;
        p.score += SCORE.catch;
        if (!this.firstCaughtId) this.firstCaughtId = h.id;
        ev.push({ type: 'caught', id: h.id });
      }
    } else if (p.role === 'hider' && (p.status === 'hiding' || p.status === 'spotted')) {
      const othersActive = this.activeHiders().filter((h) => h.id !== id).length;
      const caught = this.hiders().filter((h) => h.status === 'caught');
      p.status = 'safe';
      p.doneAt = this.seekingMs;
      if (p.spottedAt === null) p.spottedAt = this.seekingMs;
      p.score += SCORE.reachBase;
      ev.push({ type: 'safe', id, how: 'base' });
      if (othersActive === 0 && caught.length > 0) {
        for (const c of caught) c.status = 'safe';
        p.score += SCORE.saveAll;
        this.herkes = true;
        ev.push({ type: 'herkesKurtuldu', by: id, freed: caught.map((c) => c.id) });
      }
    }
    if (ev.length && this.activeHiders().length === 0) ev.push(...this.endRound('allDone'));
    return ev;
  }

  // ------------------------------------------------------------------ internals
  private enterEbeSelection(): GameEvent[] {
    const ids = this.order.filter((id) => this.players.has(id));
    let ebe: string;
    let reason: 'random' | 'firstCaught' | 'sameEbe' = 'random';
    if (this.nextEbe && this.players.has(this.nextEbe.id)) {
      ebe = this.nextEbe.id;
      reason = this.nextEbe.reason;
    } else {
      ebe = ids[Math.floor(this.rng() * ids.length)]!;
    }
    this.nextEbe = null;
    this.round++;
    this.ebeId = ebe;
    this.firstCaughtId = null;
    this.herkes = false;
    this.seekingMs = 0;
    for (const p of this.players.values()) {
      p.role = p.id === ebe ? 'ebe' : 'hider';
      p.status = p.id === ebe ? 'none' : 'hiding';
      p.spottedAt = null;
      p.doneAt = null;
      p.caughtAt = null;
    }
    this.phase = 'ebeSelection';
    this.timeLeftMs = this.config.ebeSelectionMs;
    return [
      { type: 'phase', phase: 'ebeSelection' },
      { type: 'ebeChosen', id: ebe, reason },
    ];
  }

  private endRound(reason: EndReason): GameEvent[] {
    const ev: GameEvent[] = [];
    const end = this.seekingMs;
    if (reason === 'timeout') {
      for (const h of this.activeHiders()) {
        h.status = 'safe';
        h.doneAt = end;
        if (h.spottedAt === null) h.spottedAt = end;
        h.score += SCORE.survive;
        ev.push({ type: 'safe', id: h.id, how: 'timeout' });
      }
    }
    const playedSeeking = reason !== 'ebeLeft' || this.phase === 'seeking';
    const hiders = this.hiders();
    let bestHider: RulesPlayer | null = null;
    let longest: RulesPlayer | null = null;
    const unseen = (h: RulesPlayer) => h.spottedAt ?? end;
    const inPlay = (h: RulesPlayer) => h.caughtAt ?? end;
    if (playedSeeking) {
      for (const h of hiders) {
        if (!bestHider || unseen(h) > unseen(bestHider)) bestHider = h;
        if (!longest || inPlay(h) > inPlay(longest)) longest = h;
      }
    }

    // who counts next round?
    if (reason === 'ebeLeft' || !this.ebeId || !this.players.has(this.ebeId)) this.nextEbe = null;
    else if (this.herkes || !this.firstCaughtId || !this.players.has(this.firstCaughtId)) this.nextEbe = { id: this.ebeId, reason: 'sameEbe' };
    else this.nextEbe = { id: this.firstCaughtId, reason: 'firstCaught' };

    const summary: RoundSummary = {
      round: this.round,
      reason,
      ebeId: this.ebeId ?? '',
      firstCaughtId: this.firstCaughtId,
      bestHiderId: bestHider?.id ?? null,
      bestHiderMs: bestHider ? unseen(bestHider) : 0,
      longestSurvivorId: longest?.id ?? null,
      longestSurvivorMs: longest ? inPlay(longest) : 0,
      caught: hiders.filter((h) => h.status === 'caught').map((h) => h.id),
      safe: hiders.filter((h) => h.status === 'safe').map((h) => h.id),
      herkesKurtuldu: this.herkes,
      nextEbeId: this.nextEbe?.id ?? null,
    };
    this.lastSummary = summary;
    this.phase = 'roundEnd';
    this.timeLeftMs = this.config.roundEndMs;
    // spectators who joined mid-round take part from the next round
    ev.push({ type: 'roundEnd', summary }, { type: 'phase', phase: 'roundEnd' });
    return ev;
  }
}
