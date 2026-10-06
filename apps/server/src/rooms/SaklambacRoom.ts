import { Room, type Client } from '@colyseus/core';
import {
  BASE,
  BASE_RADIUS,
  EBE_COUNT_SPOT,
  EMOTES,
  MAX_PLAYERS,
  SPOT_RANGE,
  VIEW_RANGE,
  canSee,
  MSG,
  OUTFIT_COLORS,
  QUICK_CHAT,
  RECONNECT_SECONDS,
  SIM_DT,
  TICK_MS,
  cleanNickname,
  createBody,
  isValidNicknameLength,
  randomNickname,
  sanitizeColor,
  spawnPoint,
  stepBody,
  type Body,
  type ChatMsg,
  type EmoteMsg,
  type EventMsg,
  type InputMsg,
  type JoinOptions,
  type MoveInput,
  type PlayerSnap,
  type SnapshotMsg,
  type SummaryMsg,
  type TeleportMsg,
  zoneAt,
} from '@sokak/shared';
import { SaklambacBot, type BotContext } from '@sokak/bots';
import { SaklambacRules, type GameEvent, type RulesConfig } from '@sokak/rules';
import { PlayerState, SaklambacState } from './schema';
import { generateRoomId } from '../roomId';

const MAX_QUEUED_INPUTS = 8;
/** inputs processed per tick at most (lets a lagging client catch up a bit) */
const MAX_INPUTS_PER_TICK = 3;

interface Sim {
  id: string;
  body: Body;
  yaw: number;
  crouch: boolean;
  queue: MoveInput[];
  queueSeq: number[];
  lastSeq: number;
  bot: SaklambacBot | null;
  botClaim: string | null;
  client: Client | null;
  lastChatAt: number;
  lastEmoteAt: number;
}

function finite(n: unknown, lo: number, hi: number): number {
  return typeof n === 'number' && Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : 0;
}

export class SaklambacRoom extends Room<SaklambacState> {
  override maxClients = MAX_PLAYERS;
  override state = new SaklambacState();
  protected sims = new Map<string, Sim>();
  private botCounter = 0;
  /** overridable per server (tests use short timers) */
  static rulesConfig: Partial<RulesConfig> = {};
  protected rules = new SaklambacRules();
  /** per hider: ms spent in each named zone during seeking (best hiding spot) */
  private zoneTime = new Map<string, Map<string, number>>();
  private zoneAcc = 0;
  /** hider id → time (ms) until which the Ebe may see it (small hysteresis) */
  private ebeSees = new Map<string, number>();
  private lastSpotAt = 0;

  override onCreate(): void {
    this.roomId = generateRoomId();
    this.rules = new SaklambacRules((this.constructor as typeof SaklambacRoom).rulesConfig);
    void this.setPrivate(true);
    this.autoDispose = true;

    this.onMessage(MSG.input, (client, msg: InputMsg) => this.handleInput(client, msg));
    this.onMessage(MSG.start, (client) => {
      if (client.sessionId !== this.state.hostId) return;
      this.handleEvents(this.rules.start());
    });
    this.onMessage(MSG.spot, (client) => this.handleSpot(client.sessionId));
    this.onMessage(MSG.addBot, (client) => {
      if (client.sessionId === this.state.hostId) this.addBot();
    });
    this.onMessage(MSG.removeBot, (client) => {
      if (client.sessionId !== this.state.hostId) return;
      const bot = [...this.sims.values()].reverse().find((s) => s.bot);
      if (bot) this.removePlayer(bot.id);
    });
    this.onMessage(MSG.emote, (client, e: unknown) => {
      const sim = this.sims.get(client.sessionId);
      if (!sim || typeof e !== 'string' || !(EMOTES as readonly string[]).includes(e)) return;
      const now = Date.now();
      if (now - sim.lastEmoteAt < 700) return;
      sim.lastEmoteAt = now;
      const msg: EmoteMsg = { id: client.sessionId, e: e as EmoteMsg['e'] };
      this.broadcast(MSG.emote, msg);
    });
    this.onMessage(MSG.chat, (client, q: unknown) => {
      const sim = this.sims.get(client.sessionId);
      if (!sim || typeof q !== 'number' || !Number.isInteger(q) || q < 0 || q >= QUICK_CHAT.length) return;
      const now = Date.now();
      if (now - sim.lastChatAt < 1200) return;
      sim.lastChatAt = now;
      const msg: ChatMsg = { id: client.sessionId, q };
      this.broadcast(MSG.chat, msg);
    });

    this.setPatchRate(TICK_MS);
    this.setSimulationInterval((dt) => this.tick(dt), TICK_MS);
  }

  override onJoin(client: Client, options: JoinOptions = {}): void {
    let name = cleanNickname(options.name);
    if (!isValidNicknameLength(name)) name = randomNickname();
    const p = new PlayerState();
    p.id = client.sessionId;
    p.name = this.uniqueName(name);
    p.color = sanitizeColor(options.color);
    this.state.players.set(client.sessionId, p);
    this.createSim(client.sessionId, client);
    if (!this.state.hostId) this.state.hostId = client.sessionId;
    this.handleEvents(this.rules.addPlayer(client.sessionId));
  }

  override async onLeave(client: Client, consented: boolean): Promise<void> {
    const p = this.state.players.get(client.sessionId);
    if (!p) return;
    if (!consented) {
      p.connected = false;
      const old = this.sims.get(client.sessionId);
      if (old) old.client = null;
      try {
        const c = await this.allowReconnection(client, RECONNECT_SECONDS);
        p.connected = true;
        const sim = this.sims.get(client.sessionId);
        if (sim) {
          sim.client = c;
          sim.queue = [];
          sim.queueSeq = [];
        }
        this.onReconnected(client.sessionId);
        return;
      } catch {
        // window expired
      }
    }
    this.removePlayer(client.sessionId);
  }

  /** hook for subclasses / later milestones */
  protected onReconnected(_id: string): void {}

  protected removePlayer(id: string): void {
    if (!this.state.players.has(id)) return;
    this.state.players.delete(id);
    this.sims.delete(id);
    this.handleEvents(this.rules.removePlayer(id));
    if (this.state.hostId === id) {
      const next = [...this.state.players.values()].find((p) => !p.isBot && p.connected);
      this.state.hostId = next?.id ?? '';
    }
    // a room with only bots left is closed
    if (![...this.state.players.values()].some((p) => !p.isBot)) {
      for (const s of [...this.sims.values()]) if (s.bot) this.removePlayer(s.id);
    }
  }

  protected addBot(): boolean {
    if (this.state.players.size >= MAX_PLAYERS) return false;
    const id = `bot_${++this.botCounter}`;
    const p = new PlayerState();
    p.id = id;
    p.isBot = true;
    p.name = this.uniqueName(`🤖 ${randomNickname()}`.slice(0, 16));
    const used = new Set([...this.state.players.values()].map((x) => x.color));
    p.color = OUTFIT_COLORS.find((c) => !used.has(c)) ?? OUTFIT_COLORS[this.botCounter % OUTFIT_COLORS.length]!;
    this.state.players.set(id, p);
    this.createSim(id, null);
    this.handleEvents(this.rules.addPlayer(id));
    return true;
  }

  private uniqueName(name: string): string {
    const names = new Set([...this.state.players.values()].map((p) => p.name));
    if (!names.has(name)) return name;
    for (let i = 2; ; i++) {
      const n = `${name.slice(0, 12)} ${i}`;
      if (!names.has(n)) return n;
    }
  }

  private createSim(id: string, client: Client | null): void {
    const sp = spawnPoint(this.sims.size);
    this.sims.set(id, {
      id,
      body: createBody(sp.x, sp.z),
      yaw: 0,
      crouch: false,
      queue: [],
      queueSeq: [],
      lastSeq: 0,
      bot: client ? null : new SaklambacBot(Math.random),
      botClaim: null,
      client,
      lastChatAt: 0,
      lastEmoteAt: 0,
    });
  }

  private handleInput(client: Client, msg: InputMsg): void {
    const sim = this.sims.get(client.sessionId);
    if (!sim || !msg || typeof msg.s !== 'number') return;
    if (msg.s <= (sim.queueSeq[sim.queueSeq.length - 1] ?? sim.lastSeq)) return;
    sim.queue.push({
      mx: finite(msg.mx, -1, 1),
      mz: finite(msg.mz, -1, 1),
      jump: msg.j === 1,
      crouch: msg.c === 1,
    });
    sim.queueSeq.push(msg.s);
    sim.yaw = finite(msg.y, -100, 100);
    if (sim.queue.length > MAX_QUEUED_INPUTS) {
      sim.queue.shift();
      sim.queueSeq.shift();
    }
  }

  protected canMove(id: string): boolean {
    return !this.rules.isFrozen(id);
  }

  protected tick(dtMs: number): void {
    for (const sim of this.sims.values()) {
      if (sim.bot) {
        const decision = sim.bot.think(this.botContext(sim), SIM_DT);
        sim.botClaim = decision.claim;
        const input = this.canMove(sim.id) ? decision.input : { mx: 0, mz: 0, jump: false, crouch: false };
        if (input.mx || input.mz) sim.yaw = Math.atan2(-input.mx, -input.mz);
        sim.crouch = input.crouch;
        stepBody(sim.body, input, SIM_DT);
        if (decision.spot) this.handleSpot(sim.id);
        continue;
      }
      for (let k = 0; k < MAX_INPUTS_PER_TICK && sim.queue.length; k++) {
        const input = sim.queue.shift()!;
        sim.lastSeq = sim.queueSeq.shift()!;
        sim.crouch = input.crouch;
        stepBody(sim.body, this.canMove(sim.id) ? input : { ...input, mx: 0, mz: 0, jump: false }, SIM_DT);
      }
    }
    this.checkBaseTouches();
    this.updateEbeVision();
    this.trackZones(dtMs);
    this.handleEvents(this.rules.tick(dtMs));
    this.syncState();
    this.sendSnapshots();
  }

  protected atBase(sim: Sim): boolean {
    return Math.hypot(sim.body.x - BASE.x, sim.body.z - BASE.z) <= BASE_RADIUS && sim.body.y < 1.5;
  }

  /** Hiders are processed before the Ebe, so a tie goes to the hider. */
  private checkBaseTouches(): void {
    if (this.rules.phase !== 'seeking') return;
    let ebe: Sim | null = null;
    for (const sim of this.sims.values()) {
      if (sim.id === this.rules.ebeId) ebe = sim;
      else if (this.atBase(sim)) this.handleEvents(this.rules.touchBase(sim.id));
    }
    if (ebe && this.atBase(ebe)) this.handleEvents(this.rules.touchBase(ebe.id));
  }

  private trackZones(dtMs: number): void {
    if (this.rules.phase !== 'seeking') return;
    this.zoneAcc += dtMs;
    if (this.zoneAcc < 500) return;
    for (const h of this.rules.activeHiders()) {
      const sim = this.sims.get(h.id);
      if (!sim || h.status !== 'hiding') continue;
      const zone = zoneAt(sim.body.x, sim.body.z);
      if (zone === 'Ebe Duvarı') continue;
      let m = this.zoneTime.get(h.id);
      if (!m) this.zoneTime.set(h.id, (m = new Map()));
      m.set(zone, (m.get(zone) ?? 0) + this.zoneAcc);
    }
    this.zoneAcc = 0;
  }

  private favouriteZone(id: string): string | null {
    const m = this.zoneTime.get(id);
    if (!m) return null;
    let best: string | null = null;
    let t = -1;
    for (const [z, ms] of m) if (ms > t) [best, t] = [z, ms];
    return best;
  }

  protected handleEvents(events: GameEvent[]): void {
    for (const e of events) {
      if (e.type === 'roundEnd') {
        const s = e.summary;
        const msg: SummaryMsg = { ...s, bestHiderSpot: s.bestHiderId ? this.favouriteZone(s.bestHiderId) : null };
        this.broadcast(MSG.summary, msg);
        this.analytics?.roundPlayed(this.rules.players.size, s.reason);
        continue;
      }
      if (e.type === 'phase' && e.phase === 'ebeSelection') this.placeForRound();
      if (e.type === 'phase' && e.phase === 'seeking') this.zoneTime.clear();
      this.onRuleEvent(e);
      this.broadcast(MSG.event, e);
    }
    this.syncState();
  }

  /** hook for M4 (bots react to events) */
  protected onRuleEvent(_e: GameEvent): void {}

  /** optional analytics sink (M6) */
  analytics: { roundPlayed(size: number, reason: string): void } | null = null;

  /** Ebe to the wall facing it, hiders to the spawn ring. */
  private placeForRound(): void {
    let i = 0;
    for (const sim of this.sims.values()) {
      const p = this.rules.get(sim.id);
      if (!p) continue;
      if (p.role === 'ebe') this.teleport(sim, EBE_COUNT_SPOT.x, EBE_COUNT_SPOT.z, 0);
      else {
        const sp = spawnPoint(i++);
        this.teleport(sim, sp.x, sp.z, Math.PI);
      }
    }
  }

  private teleport(sim: Sim, x: number, z: number, yaw: number): void {
    sim.body = createBody(x, z);
    sim.yaw = yaw;
    sim.queue = [];
    sim.queueSeq = [];
    const msg: TeleportMsg = { x, y: 0, z, yaw };
    sim.client?.send(MSG.teleport, msg);
  }

  private syncState(): void {
    const r = this.rules;
    const st = this.state;
    st.phase = r.phase;
    st.timeLeft = Math.ceil(r.timeLeftMs / 1000);
    st.round = r.round;
    st.ebeId = r.ebeId ?? '';
    for (const rp of r.players.values()) {
      const p = st.players.get(rp.id);
      if (!p) continue;
      if (p.role !== rp.role) p.role = rp.role;
      if (p.status !== rp.status) p.status = rp.status;
      if (p.score !== rp.score) p.score = rp.score;
    }
  }

  /**
   * Anti-cheat information filter: may `viewerId` receive `targetId`'s position?
   * Spectators are invisible; the Ebe gets no hiders while counting and only
   * hiders that pass the server visibility check while seeking.
   */
  protected isVisibleTo(viewerId: string, targetId: string): boolean {
    const target = this.rules.get(targetId);
    if (target?.role === 'spectator') return false;
    if (viewerId !== this.rules.ebeId || !target || target.role !== 'hider') return true;
    const phase = this.rules.phase;
    if (phase === 'ebeSelection' || phase === 'counting') return false;
    if (phase !== 'seeking') return true;
    if (target.status === 'caught' || target.status === 'safe') return true;
    return (this.ebeSees.get(targetId) ?? 0) > Date.now();
  }

  private simOf(id: string | null): Sim | undefined {
    return id ? this.sims.get(id) : undefined;
  }

  private updateEbeVision(): void {
    if (this.rules.phase !== 'seeking') {
      this.ebeSees.clear();
      return;
    }
    const ebe = this.simOf(this.rules.ebeId);
    if (!ebe) return;
    const now = Date.now();
    for (const h of this.rules.activeHiders()) {
      const sim = this.sims.get(h.id);
      if (!sim) continue;
      if (canSee(ebe.body, { ...sim.body, crouch: sim.crouch }, VIEW_RANGE)) this.ebeSees.set(h.id, now + 250);
    }
  }

  /** "Gördüm!": nearest hiding hider within range and in clear line of sight. */
  protected handleSpot(id: string): void {
    if (this.rules.phase !== 'seeking' || id !== this.rules.ebeId) return;
    const now = Date.now();
    if (now - this.lastSpotAt < 300) return;
    this.lastSpotAt = now;
    const ebe = this.sims.get(id);
    if (!ebe) return;
    const reply = (reason: 'base' | 'none') => ebe.client?.send(MSG.event, { type: 'spotMiss', reason } satisfies EventMsg);
    if (this.atBase(ebe)) return reply('base');
    let best: Sim | null = null;
    let bestD = Infinity;
    for (const h of this.rules.hiders()) {
      if (h.status !== 'hiding') continue;
      const sim = this.sims.get(h.id);
      if (!sim) continue;
      const d = Math.hypot(sim.body.x - ebe.body.x, sim.body.z - ebe.body.z);
      if (d < bestD && canSee(ebe.body, { ...sim.body, crouch: sim.crouch }, SPOT_RANGE)) {
        best = sim;
        bestD = d;
      }
    }
    if (!best) return reply('none');
    this.handleEvents(this.rules.spot(best.id));
  }

  private botContext(sim: Sim): BotContext {
    const r = this.rules;
    const me = r.get(sim.id);
    const ebe = this.simOf(r.ebeId);
    const isEbe = sim.id === r.ebeId;
    const visibleHiders: BotContext['visibleHiders'] = [];
    let anySpotted = false;
    if (isEbe && r.phase === 'seeking') {
      for (const h of r.activeHiders()) {
        if (h.status === 'spotted') anySpotted = true;
        const hs = this.sims.get(h.id);
        if (!hs || h.status !== 'hiding' || !this.isVisibleTo(sim.id, h.id)) continue;
        visibleHiders.push({ id: h.id, x: hs.body.x, z: hs.body.z, dist: Math.hypot(hs.body.x - sim.body.x, hs.body.z - sim.body.z) });
      }
    }
    const ebeVisible = !!ebe && !isEbe && canSee(sim.body, { ...ebe.body, crouch: false }, VIEW_RANGE);
    const claimed = new Set<string>();
    for (const s of this.sims.values()) if (s !== sim && s.botClaim) claimed.add(s.botClaim);
    return {
      phase: r.phase,
      role: me?.role ?? 'none',
      status: me?.status ?? 'none',
      self: { x: sim.body.x, z: sim.body.z },
      ebe: ebeVisible && ebe ? { x: ebe.body.x, z: ebe.body.z } : null,
      visibleHiders,
      anySpotted,
      spotRange: SPOT_RANGE,
      claimed,
    };
  }

  /** test helper: move a player instantly */
  debugPlace(id: string, x: number, z: number, crouch = false): void {
    const sim = this.sims.get(id);
    if (!sim) return;
    sim.body = createBody(x, z);
    sim.crouch = crouch;
    sim.queue = [];
    sim.queueSeq = [];
  }

  private sendSnapshots(): void {
    const t = Date.now();
    const all: PlayerSnap[] = [];
    for (const s of this.sims.values()) {
      all.push([s.id, round2(s.body.x), round2(s.body.y), round2(s.body.z), round2(s.yaw), s.crouch ? 1 : 0]);
    }
    for (const sim of this.sims.values()) {
      if (!sim.client) continue;
      const b = sim.body;
      const msg: SnapshotMsg = {
        t,
        a: sim.lastSeq,
        me: [b.x, b.y, b.z, b.vy, b.onGround ? 1 : 0],
        p: all.filter((p) => p[0] !== sim.id && this.isVisibleTo(sim.id, p[0])),
      };
      sim.client.send(MSG.snapshot, msg);
    }
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
