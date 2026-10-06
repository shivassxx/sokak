import { Room, type Client } from '@colyseus/core';
import {
  EMOTES,
  MAX_PLAYERS,
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
  type InputMsg,
  type JoinOptions,
  type MoveInput,
  type PlayerSnap,
  type SnapshotMsg,
} from '@sokak/shared';
import { WanderBrain } from '@sokak/bots';
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
  bot: WanderBrain | null;
  client: Client | null;
  lastChatAt: number;
}

function finite(n: unknown, lo: number, hi: number): number {
  return typeof n === 'number' && Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : 0;
}

export class SaklambacRoom extends Room<SaklambacState> {
  override maxClients = MAX_PLAYERS;
  override state = new SaklambacState();
  protected sims = new Map<string, Sim>();
  private botCounter = 0;

  override onCreate(): void {
    this.roomId = generateRoomId();
    void this.setPrivate(true);
    this.autoDispose = true;

    this.onMessage(MSG.input, (client, msg: InputMsg) => this.handleInput(client, msg));
    this.onMessage(MSG.addBot, (client) => {
      if (client.sessionId === this.state.hostId) this.addBot();
    });
    this.onMessage(MSG.removeBot, (client) => {
      if (client.sessionId !== this.state.hostId) return;
      const bot = [...this.sims.values()].reverse().find((s) => s.bot);
      if (bot) this.removePlayer(bot.id);
    });
    this.onMessage(MSG.emote, (client, e: unknown) => {
      if (typeof e !== 'string' || !(EMOTES as readonly string[]).includes(e)) return;
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
    this.state.players.delete(id);
    this.sims.delete(id);
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
      bot: client ? null : new WanderBrain(Math.random),
      client,
      lastChatAt: 0,
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

  /** May the player move right now? (overridden by game rules later) */
  protected canMove(_id: string): boolean {
    return true;
  }

  protected tick(_dtMs: number): void {
    for (const sim of this.sims.values()) {
      if (sim.bot) {
        const input = this.canMove(sim.id) ? sim.bot.think(sim.body, SIM_DT) : { mx: 0, mz: 0, jump: false, crouch: false };
        if (input.mx || input.mz) sim.yaw = Math.atan2(-input.mx, -input.mz);
        sim.crouch = input.crouch;
        stepBody(sim.body, input, SIM_DT);
        continue;
      }
      for (let k = 0; k < MAX_INPUTS_PER_TICK && sim.queue.length; k++) {
        const input = sim.queue.shift()!;
        sim.lastSeq = sim.queueSeq.shift()!;
        sim.crouch = input.crouch;
        stepBody(sim.body, this.canMove(sim.id) ? input : { ...input, mx: 0, mz: 0, jump: false }, SIM_DT);
      }
    }
    this.sendSnapshots();
  }

  /** Which players may `viewerId` see right now? (filtered by later milestones) */
  protected isVisibleTo(_viewerId: string, _targetId: string): boolean {
    return true;
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
