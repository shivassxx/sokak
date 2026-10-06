import { BASE, BASE_RADIUS, HIDING_SPOTS, type HiderStatus, type MoveInput, type Phase, type Role, type Vec2 } from '@sokak/shared';
import { PathFollower, WanderBrain, type Rng } from './brain';
import { nearestWalkable } from './navgrid';

/** What the server tells a bot each tick (only information a player could know). */
export interface BotContext {
  phase: Phase;
  role: Role;
  status: HiderStatus;
  self: Vec2;
  /** Ebe position (hiders know roughly where the Ebe is when it is in view; we pass it when visible) */
  ebe: Vec2 | null;
  /** for the Ebe: hiders it can currently see (status hiding) */
  visibleHiders: { id: string; x: number; z: number; dist: number }[];
  /** for the Ebe: someone is spotted and the race is on */
  anySpotted: boolean;
  /** max "Gördüm!" distance */
  spotRange: number;
  /** hiding spots already claimed by other bots */
  claimed: Set<string>;
}

export interface BotDecision {
  input: MoveInput;
  spot: boolean;
  /** hiding spot key claimed by this bot */
  claim: string | null;
}

const IDLE: MoveInput = { mx: 0, mz: 0, jump: false, crouch: false };
const spotKey = (s: Vec2) => `${s.x},${s.z}`;
const dist = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.z - b.z);
const BASE_TARGET: Vec2 = { x: BASE.x, z: BASE.z + 1.2 };

/**
 * One brain for both roles. Hider: run to a hiding spot during counting,
 * crouch, sneak to base when the Ebe is far, race when spotted.
 * Ebe: patrol hiding spots, call "Gördüm!" on visible hiders, race back.
 */
export class SaklambacBot {
  private follower = new PathFollower();
  private wander: WanderBrain;
  private spot: Vec2 | null = null;
  private mode: 'idle' | 'toSpot' | 'hidden' | 'toBase' | 'patrol' | 'return' = 'idle';
  private lastPhase: Phase = 'lobby';
  private reaction = 0;
  private sneakCheck = 0;
  private patrolQueue: Vec2[] = [];
  /** Bots are a little lazy so humans can win. */
  readonly skill: number;

  constructor(private rng: Rng) {
    this.wander = new WanderBrain(rng);
    this.skill = 0.6 + rng() * 0.4;
  }

  think(ctx: BotContext, dt: number): BotDecision {
    if (ctx.phase !== this.lastPhase) this.onPhase(ctx);
    this.lastPhase = ctx.phase;

    if (ctx.phase === 'lobby' || ctx.phase === 'roundEnd' || ctx.role === 'spectator') {
      return { input: this.wander.think(ctx.self, dt), spot: false, claim: null };
    }
    if (ctx.role === 'ebe') return this.thinkEbe(ctx, dt);
    return this.thinkHider(ctx, dt);
  }

  private onPhase(ctx: BotContext): void {
    this.follower.clear();
    this.mode = 'idle';
    this.reaction = 0;
    if (ctx.phase === 'ebeSelection') this.spot = null;
  }

  // ------------------------------------------------------------------ hider
  private thinkHider(ctx: BotContext, dt: number): BotDecision {
    const claim = this.spot ? spotKey(this.spot) : null;
    if (ctx.status === 'caught' || ctx.status === 'safe') {
      return { input: this.wander.think(ctx.self, dt), spot: false, claim: null };
    }
    if (ctx.phase === 'ebeSelection') return { input: IDLE, spot: false, claim };

    if (ctx.status === 'spotted' && this.mode !== 'toBase') {
      this.mode = 'toBase';
      this.follower.setGoal(ctx.self, BASE_TARGET);
    }

    if (this.mode === 'idle') {
      this.spot = this.pickSpot(ctx);
      this.follower.setGoal(ctx.self, nearestWalkable(this.spot));
      this.mode = 'toSpot';
    }

    if (this.mode === 'toSpot' && this.follower.done) this.mode = 'hidden';

    if (this.mode === 'hidden' && ctx.phase === 'seeking') {
      this.sneakCheck -= dt;
      if (this.sneakCheck <= 0) {
        this.sneakCheck = 1.5 + this.rng() * 2;
        const myDist = dist(ctx.self, BASE);
        const ebeDist = ctx.ebe ? dist(ctx.ebe, BASE) : 30;
        // sneak if the Ebe is clearly further from the base than we are
        if (ebeDist > 14 && myDist < ebeDist * 0.75 && this.rng() < 0.35 * this.skill) {
          this.mode = 'toBase';
          this.follower.setGoal(ctx.self, BASE_TARGET);
        }
      }
    }

    if (this.mode === 'toBase' && this.follower.done && dist(ctx.self, BASE) > BASE_RADIUS) {
      this.follower.setGoal(ctx.self, BASE_TARGET);
    }

    if (this.mode === 'hidden') return { input: { ...IDLE, crouch: true }, spot: false, claim };
    const d = this.follower.steer(ctx.self, dt);
    const crouch = this.mode === 'toSpot' && ctx.phase === 'seeking' && this.follower.path.length < 3;
    return { input: { mx: d.x, mz: d.z, jump: false, crouch }, spot: false, claim };
  }

  private pickSpot(ctx: BotContext): Vec2 {
    const free = HIDING_SPOTS.filter((s) => !ctx.claimed.has(spotKey(s)));
    const pool = free.length ? free : HIDING_SPOTS;
    // prefer spots within reach before counting ends (~ 30 s * 5 m/s), not too close to base
    const good = pool.filter((s) => {
      const d = dist(s, BASE);
      return d > 12 && d < 55;
    });
    const list = good.length ? good : pool;
    return list[Math.floor(this.rng() * list.length)]!;
  }

  // ------------------------------------------------------------------ ebe
  private thinkEbe(ctx: BotContext, dt: number): BotDecision {
    if (ctx.phase !== 'seeking') return { input: IDLE, spot: false, claim: null };
    const atBase = dist(ctx.self, BASE) <= BASE_RADIUS;

    // race back after spotting someone
    if (ctx.anySpotted) {
      if (this.mode !== 'return') {
        this.mode = 'return';
        this.follower.setGoal(ctx.self, BASE_TARGET);
      }
      if (this.follower.done) this.follower.setGoal(ctx.self, BASE_TARGET);
      const d = this.follower.steer(ctx.self, dt);
      return { input: { mx: d.x, mz: d.z, jump: false, crouch: false }, spot: false, claim: null };
    }
    if (this.mode === 'return') this.mode = 'idle';

    // spot visible hiders (with a human-like reaction time)
    const target = ctx.visibleHiders.filter((h) => h.dist <= ctx.spotRange).sort((a, b) => a.dist - b.dist)[0];
    if (target && !atBase) {
      this.reaction += dt;
      if (this.reaction > 0.9 - this.skill * 0.4) {
        this.reaction = 0;
        return { input: IDLE, spot: true, claim: null };
      }
    } else this.reaction = 0;

    // chase a visible hider that is out of spot range
    const seen = ctx.visibleHiders.sort((a, b) => a.dist - b.dist)[0];
    if (seen && (seen.dist > ctx.spotRange || atBase)) {
      if (!this.follower.goal || dist(this.follower.goal, seen) > 3) this.follower.setGoal(ctx.self, seen);
      this.mode = 'patrol';
    } else if (this.mode !== 'patrol' || this.follower.done) {
      if (!this.patrolQueue.length) {
        this.patrolQueue = [...HIDING_SPOTS].sort(() => this.rng() - 0.5).slice(0, 8);
      }
      const next = this.patrolQueue.shift()!;
      // look at the spot from a couple of metres away
      this.follower.setGoal(ctx.self, nearestWalkable({ x: next.x + (BASE.x - next.x) * 0.12, z: next.z + (BASE.z - next.z) * 0.12 }));
      this.mode = 'patrol';
    }
    const d = this.follower.steer(ctx.self, dt);
    const slow = this.skill < 0.8 ? 0.8 : 1;
    return { input: { mx: d.x * slow, mz: d.z * slow, jump: false, crouch: false }, spot: false, claim: null };
  }
}
