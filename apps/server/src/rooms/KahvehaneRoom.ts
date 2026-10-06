import { Room, type Client } from '@colyseus/core';
import {
  BET_OPTIONS,
  CREDIT_AMOUNT,
  CREDIT_COOLDOWN_MS,
  EMOTES,
  FALSE_ACCUSE_FINE,
  HAIRS,
  HAND_OPTIONS,
  HATS,
  KAHVE_SPAWN,
  KAHVE_WORLD,
  KMSG,
  MAX_KAHVE_PLAYERS,
  MENU,
  MSG,
  OUTFIT_COLORS,
  QUICK_CHAT_OKEY,
  RECONNECT_SECONDS,
  SIM_DT,
  SHOPS,
  SHOP_ITEMS,
  SHOP_REACH,
  SIT_REACH,
  SIT_SPOTS,
  SKINS,
  SPOT_REACH,
  START_MONEY,
  STEAL_FINE,
  TABLES,
  TABLE_COUNT,
  TICK_MS,
  TURN_SECONDS,
  cleanNickname,
  createBody,
  isOffensive,
  isValidNicknameLength,
  randomNickname,
  sanitizeColor,
  sanitizeLook,
  seatPosition,
  stepBody,
  type Body,
  type ChatMsg,
  type EmoteMsg,
  type InputMsg,
  type JoinOptions,
  type MoveInput,
  type OkeyAction,
  type OkeyEventMsg,
  type OrderMsg,
  type PlayerSnap,
  type ServedMsg,
  type SnapshotMsg,
  type SalonMeta,
  type SignalMsg,
  type TeleportMsg,
  type UsedMsg,
} from '@sokak/shared';
import { OkeyGame, botAction, type OkeyEvent, type Result } from '@sokak/okey';
import { KPlayer, KTable, KahveState } from './kahveSchema';
import { generateRoomId } from '../roomId';
import { WalletStore } from '../wallets';

/** daily play-money bonus for returning devices */
export const DAILY_BONUS = 250;
const DAY_MS = 20 * 3600 * 1000;

interface Avatar {
  id: string;
  body: Body;
  yaw: number;
  queue: MoveInput[];
  queueSeq: number[];
  lastSeq: number;
  client: Client | null;
  lastChatAt: number;
  lastEmoteAt: number;
  lastOrderAt: number;
  lastCreditAt: number;
  lastShopAt: number;
  lastUseAt: number;
  /** anonymous wallet token, '' = no persistence */
  device: string;
}

interface TableRuntime {
  game: OkeyGame | null;
  /** next time a bot may act */
  botAt: number;
  /** dealer of the next hand */
  dealer: number;
  /** wake-up time for between-hands / result phases */
  until: number;
  /** bots that noticed a theft: seat → time they shout "Hile var!" */
  botAccuse: Map<number, number>;
}

const MAX_QUEUED = 8;

function finite(n: unknown, lo: number, hi: number): number {
  return typeof n === 'number' && Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : 0;
}

/**
 * Public kahvehane: everybody walks around as their kid, sits at one of the
 * six okey tables and plays 101 with friends (or bots). Hands are private and
 * sent only to their owner; the table view in the schema hides them.
 * Money is play money that only exists for this session.
 */
export class KahvehaneRoom extends Room<KahveState> {
  override maxClients = MAX_KAHVE_PLAYERS;
  override state = new KahveState();
  private avatars = new Map<string, Avatar>();
  private runtime: TableRuntime[] = [];
  private botCounter = 0;
  static rng: () => number = Math.random;
  /** override for tests (ms) */
  static timing = { botMin: 700, botMax: 1600, between: 6000, result: 9000, turn: TURN_SECONDS * 1000 };
  static wallets: WalletStore | null = null;
  static analyticsSink: { tableStarted?(players: number, bet: number): void; handPlayed?(): void } | null = null;

  private get cls(): typeof KahvehaneRoom {
    return this.constructor as typeof KahvehaneRoom;
  }

  /** Üsküdar neighbourhoods as salon names */
  static salonNames = ['Salacak', 'Kuzguncuk', 'Çengelköy', 'Doğancılar', 'Ahmediye', 'Bağlarbaşı', 'Validebağ', 'Altunizade', 'Beylerbeyi', 'Kandilli'];
  static salonCounter = 0;
  private meta: SalonMeta = { name: '', private: false, playing: 0, waiting: 0, humans: 0 };

  override onCreate(options: JoinOptions = {}): void {
    this.roomId = generateRoomId();
    const n = KahvehaneRoom.salonCounter++;
    const names = KahvehaneRoom.salonNames;
    this.meta.name = `${names[n % names.length]}${n >= names.length ? ` ${Math.floor(n / names.length) + 1}` : ''}`;
    this.meta.private = !!options.private;
    this.state.name = this.meta.name;
    if (this.meta.private) void this.setPrivate(true);
    void this.setMetadata({ ...this.meta });
    this.clock.setInterval(() => this.updateMeta(), 2000);
    for (let i = 0; i < TABLE_COUNT; i++) {
      const t = new KTable();
      t.id = i;
      this.state.tables.push(t);
      this.runtime.push({ game: null, botAt: 0, dealer: 0, until: 0, botAccuse: new Map() });
    }
    this.onMessage(MSG.input, (c, m: InputMsg) => this.handleInput(c, m));
    this.onMessage(KMSG.sit, (c, m: { table?: unknown; seat?: unknown }) => this.sit(c.sessionId, m?.table, m?.seat));
    this.onMessage(KMSG.stand, (c) => this.stand(c.sessionId));
    this.onMessage(KMSG.tableConfig, (c, m: { bet?: unknown; hands?: unknown }) => this.configure(c.sessionId, m));
    this.onMessage(KMSG.tableStart, (c) => this.startMatch(c.sessionId));
    this.onMessage(KMSG.tableBot, (c, m: { seat?: unknown; remove?: boolean }) => this.tableBot(c.sessionId, m));
    this.onMessage(KMSG.okey, (c, a: OkeyAction) => this.okeyAction(c.sessionId, a));
    this.onMessage(KMSG.order, (c, m: OrderMsg) => this.order(c.sessionId, m));
    this.onMessage(KMSG.credit, (c) => this.credit(c.sessionId));
    this.onMessage(KMSG.buy, (c, m: { shop?: unknown; item?: unknown }) => this.buy(c.sessionId, m));
    this.onMessage(KMSG.use, (c) => this.useItem(c.sessionId));
    this.onMessage(KMSG.resync, (c) => {
      const p = this.state.players.get(c.sessionId);
      if (p) this.sendHand(p.table, p.seat);
    });
    this.onMessage(KMSG.drop, (c) => {
      const p = this.state.players.get(c.sessionId);
      if (p) (p.holding = ''), (p.uses = 0);
    });
    this.onMessage(KMSG.sitSpot, (c, m: { spot?: unknown }) => this.sitSpot(c.sessionId, m?.spot));
    this.onMessage(KMSG.quickSeat, (c, m: { table?: unknown }) => this.quickSeat(c.sessionId, m?.table));
    this.onMessage(KMSG.fillBots, (c) => this.fillBotsAndStart(c.sessionId));
    // voice chat: opt-in flag + relaying WebRTC signalling between two opted-in players
    this.onMessage(KMSG.voice, (c, on: unknown) => {
      const p = this.state.players.get(c.sessionId);
      if (p) p.voice = on === true;
    });
    this.onMessage(KMSG.signal, (c, m: SignalMsg) => {
      const from = this.state.players.get(c.sessionId);
      const to = typeof m?.peer === 'string' ? this.state.players.get(m.peer) : undefined;
      if (!from?.voice || !to?.voice || !m.data || JSON.stringify(m.data).length > 16000) return;
      this.avatars.get(to.id)?.client?.send(KMSG.signal, { peer: c.sessionId, data: m.data } satisfies SignalMsg);
    });
    this.onMessage(MSG.emote, (c, e: unknown) => {
      const a = this.avatars.get(c.sessionId);
      if (!a || typeof e !== 'string' || !(EMOTES as readonly string[]).includes(e)) return;
      const now = Date.now();
      if (now - a.lastEmoteAt < 700) return;
      a.lastEmoteAt = now;
      this.broadcast(MSG.emote, { id: c.sessionId, e } as EmoteMsg);
    });
    this.onMessage(MSG.chat, (c, q: unknown) => {
      const a = this.avatars.get(c.sessionId);
      if (!a || typeof q !== 'number' || !Number.isInteger(q) || q < 0 || q >= QUICK_CHAT_OKEY.length) return;
      const now = Date.now();
      if (now - a.lastChatAt < 1200) return;
      a.lastChatAt = now;
      this.broadcast(MSG.chat, { id: c.sessionId, q } as ChatMsg);
    });
    this.setPatchRate(TICK_MS);
    this.setSimulationInterval(() => this.tick(), TICK_MS);
  }

  // ------------------------------------------------------------ players
  override onJoin(client: Client, options: JoinOptions = {}): void {
    let name = cleanNickname(options.name);
    if (!isValidNicknameLength(name) || isOffensive(name)) name = randomNickname();
    const p = new KPlayer();
    p.id = client.sessionId;
    p.name = this.uniqueName(name);
    p.color = sanitizeColor(options.color);
    Object.assign(p, sanitizeLook(options));
    p.money = START_MONEY;
    // returning device: restore the wallet (+ daily bonus)
    const device = WalletStore.validToken(options.device) ? options.device : '';
    let bonus = 0;
    const store = this.cls.wallets;
    if (device && store) {
      const w = store.get(device);
      const now = Date.now();
      if (w) p.money = Math.max(0, w.money);
      if (!w || now - w.lastBonus > DAY_MS) {
        if (w) bonus = DAILY_BONUS;
        p.money += bonus;
        store.set(device, { money: p.money, lastBonus: now, seen: now });
      }
    }
    this.state.players.set(p.id, p);
    const n = this.avatars.size;
    this.avatars.set(p.id, {
      id: p.id,
      // spread new arrivals inside the hall, in line with the door
      body: createBody(KAHVE_SPAWN.x + ((n % 3) - 1) * 0.7, KAHVE_SPAWN.z - (Math.floor(n / 3) % 4) * 0.8),
      yaw: 0,
      queue: [],
      queueSeq: [],
      lastSeq: 0,
      client,
      lastChatAt: 0,
      lastEmoteAt: 0,
      lastOrderAt: 0,
      lastCreditAt: -1e12,
      lastShopAt: 0,
      lastUseAt: 0,
      device,
    });
    if (bonus) this.clock.setTimeout(() => this.avatars.get(p.id)?.client?.send(KMSG.notice, `🎁 Günlük bonus: +${bonus} ₺. Hoş geldin!`), 1500);
    if (options.quick) this.quickSeat(p.id, undefined);
  }

  override async onLeave(client: Client, consented: boolean): Promise<void> {
    const p = this.state.players.get(client.sessionId);
    if (!p) return;
    if (!consented) {
      p.connected = false;
      const a = this.avatars.get(p.id);
      if (a) a.client = null;
      try {
        const c = await this.allowReconnection(client, RECONNECT_SECONDS);
        p.connected = true;
        if (a) {
          a.client = c;
          a.queue = [];
          a.queueSeq = [];
        }
        this.sendHand(p.table, p.seat);
        return;
      } catch {
        // window expired
      }
    }
    this.removePlayer(p.id);
  }

  private saveWallet(id: string): void {
    const a = this.avatars.get(id);
    const p = this.state.players.get(id);
    const store = this.cls.wallets;
    if (!a?.device || !p || !store) return;
    const w = store.get(a.device);
    store.set(a.device, { money: p.money, lastBonus: w?.lastBonus ?? Date.now(), seen: Date.now() });
  }

  private removePlayer(id: string): void {
    const p = this.state.players.get(id);
    if (!p) return;
    this.saveWallet(id);
    if (p.table >= 0) this.stand(id, true);
    this.state.players.delete(id);
    this.avatars.delete(id);
  }

  private uniqueName(name: string): string {
    const names = new Set([...this.state.players.values()].map((p) => p.name));
    if (!names.has(name)) return name;
    for (let i = 2; ; i++) {
      const n = `${name.slice(0, 12)} ${i}`;
      if (!names.has(n)) return n;
    }
  }

  private handleInput(client: Client, msg: InputMsg): void {
    const a = this.avatars.get(client.sessionId);
    if (!a || !msg || typeof msg.s !== 'number') return;
    if (msg.s <= (a.queueSeq[a.queueSeq.length - 1] ?? a.lastSeq)) return;
    a.queue.push({ mx: finite(msg.mx, -1, 1), mz: finite(msg.mz, -1, 1), jump: msg.j === 1, crouch: msg.c === 1, sprint: msg.r === 1 });
    a.queueSeq.push(msg.s);
    a.yaw = finite(msg.y, -100, 100);
    if (a.queue.length > MAX_QUEUED) {
      a.queue.shift();
      a.queueSeq.shift();
    }
  }

  // ------------------------------------------------------------ seating
  private sit(id: string, tableRaw: unknown, seatRaw: unknown): void {
    const p = this.state.players.get(id);
    const a = this.avatars.get(id);
    const ti = Number(tableRaw);
    if (!p || !a || !Number.isInteger(ti) || ti < 0 || ti >= TABLE_COUNT || p.table >= 0) return;
    const t = this.state.tables[ti]!;
    if (t.status !== 'open') return this.error(id, 'Bu masada oyun sürüyor.');
    const tc = TABLES[ti]!;
    if (Math.hypot(a.body.x - tc.x, a.body.z - tc.z) > SIT_REACH + 0.6) return this.error(id, 'Masaya biraz daha yaklaş.');
    let seat = Number(seatRaw);
    if (!Number.isInteger(seat) || seat < 0 || seat > 3 || t.seats[seat] !== '') {
      // nearest free seat
      seat = -1;
      let best = Infinity;
      for (let s = 0; s < 4; s++) {
        if (t.seats[s] !== '') continue;
        const sp = seatPosition(ti, s);
        const d = Math.hypot(sp.x - a.body.x, sp.z - a.body.z);
        if (d < best) [seat, best] = [s, d];
      }
    }
    if (seat < 0) return this.error(id, 'Masa dolu.');
    t.seats[seat] = id;
    p.table = ti;
    p.seat = seat;
    if (!t.hostId || !this.isHuman(t.hostId)) t.hostId = id;
    const sp = seatPosition(ti, seat);
    a.body = createBody(sp.x, sp.z);
    a.yaw = sp.yaw;
    a.queue = [];
    a.queueSeq = [];
    a.client?.send(MSG.teleport, { x: sp.x, y: 0, z: sp.z, yaw: sp.yaw } satisfies TeleportMsg);
  }

  private isHuman(id: string): boolean {
    const p = this.state.players.get(id);
    return !!p && !p.isBot;
  }

  /** Leave the table; during a match a bot takes over the seat (the bet is lost). */
  private stand(id: string, leaving = false): void {
    const p = this.state.players.get(id);
    if (p && p.spot >= 0) return this.leaveSpot(id);
    if (!p || p.table < 0) return;
    const ti = p.table;
    const t = this.state.tables[ti]!;
    const seat = p.seat;
    const playing = t.status !== 'open';
    p.table = -1;
    p.seat = -1;
    if (playing) {
      const bot = this.createBot(ti, seat);
      t.seats[seat] = bot.id;
      this.tableEvent(ti, { type: 'botTookOver', seat, name: bot.name });
    } else t.seats[seat] = '';
    if (t.hostId === id) t.hostId = [...t.seats].find((s) => s && this.isHuman(s)) ?? '';
    if (!leaving) {
      const a = this.avatars.get(id);
      const sp = seatPosition(ti, seat);
      const tc = TABLES[ti]!;
      if (a) {
        const ox = (sp.x - tc.x) * 1.7;
        const oz = (sp.z - tc.z) * 1.7;
        a.body = createBody(tc.x + ox, tc.z + oz);
        a.client?.send(MSG.teleport, { x: tc.x + ox, y: 0, z: tc.z + oz, yaw: sp.yaw } satisfies TeleportMsg);
      }
    }
    // only bots left: close the table
    if (![...t.seats].some((s) => s && this.isHuman(s))) this.resetTable(ti, true);
  }

  private createBot(ti: number, seat: number): KPlayer {
    const p = new KPlayer();
    p.id = `kbot_${++this.botCounter}`;
    p.isBot = true;
    p.name = `🤖 ${randomNickname()}`;
    p.color = OUTFIT_COLORS[(this.botCounter * 3) % OUTFIT_COLORS.length]!;
    p.hat = this.botCounter % HATS.length;
    p.hair = (this.botCounter * 2) % HAIRS.length;
    p.skin = this.botCounter % SKINS.length;
    p.money = START_MONEY;
    p.table = ti;
    p.seat = seat;
    this.state.players.set(p.id, p);
    return p;
  }

  private tableBot(id: string, m: { seat?: unknown; remove?: boolean }): void {
    const p = this.state.players.get(id);
    if (!p || p.table < 0) return;
    const t = this.state.tables[p.table]!;
    if (t.hostId !== id || t.status !== 'open') return;
    if (m?.remove) {
      for (let s = 3; s >= 0; s--) {
        const sid = t.seats[s]!;
        if (sid && this.state.players.get(sid)?.isBot) {
          t.seats[s] = '';
          this.state.players.delete(sid);
          return;
        }
      }
      return;
    }
    const seat = [0, 1, 2, 3].find((s) => t.seats[s] === '');
    if (seat === undefined) return;
    t.seats[seat] = this.createBot(p.table, seat).id;
  }

  private configure(id: string, m: { bet?: unknown; hands?: unknown }): void {
    const p = this.state.players.get(id);
    if (!p || p.table < 0) return;
    const t = this.state.tables[p.table]!;
    if (t.hostId !== id || t.status !== 'open') return;
    if ((BET_OPTIONS as readonly number[]).includes(Number(m?.bet))) t.bet = Number(m.bet);
    if ((HAND_OPTIONS as readonly number[]).includes(Number(m?.hands))) t.hands = Number(m.hands);
  }

  // ------------------------------------------------------------ match flow
  private startMatch(id: string): void {
    const p = this.state.players.get(id);
    if (!p || p.table < 0) return;
    const ti = p.table;
    const t = this.state.tables[ti]!;
    if (t.hostId !== id || t.status !== 'open') return;
    if ([...t.seats].some((s) => !s)) return this.error(id, '4 kişi gerekli (boş yerlere bot ekleyebilirsin).');
    const players = [...t.seats].map((s) => this.state.players.get(s)!);
    const poor = players.find((x) => x.money < t.bet);
    if (poor) return this.error(id, `${poor.name} masaya yetecek kadar para yok.`);
    for (const x of players) x.money -= t.bet;
    t.pot = t.bet * 4;
    for (let s = 0; s < 4; s++) t.totals[s] = 0;
    t.handNo = 0;
    t.lastMatch = '';
    this.runtime[ti]!.dealer = Math.floor(this.cls.rng() * 4);
    this.cls.analyticsSink?.tableStarted?.(players.filter((x) => !x.isBot).length, t.bet);
    this.dealHand(ti);
  }

  private dealHand(ti: number): void {
    const t = this.state.tables[ti]!;
    const rt = this.runtime[ti]!;
    rt.game = new OkeyGame(rt.dealer, this.cls.rng);
    rt.dealer = (rt.dealer + 1) % 4;
    t.handNo++;
    t.status = 'playing';
    t.lastHand = '';
    this.syncTable(ti, true);
    this.tableEvent(ti, { type: 'deal', handNo: t.handNo, dealer: rt.game.dealer });
    for (let s = 0; s < 4; s++) this.sendHand(ti, s);
  }

  private onHandEnd(ti: number, result: { scores: number[]; finisher: number | null }): void {
    const t = this.state.tables[ti]!;
    const rt = this.runtime[ti]!;
    for (let s = 0; s < 4; s++) t.totals[s] = t.totals[s]! + result.scores[s]!;
    t.lastHand = JSON.stringify(result);
    this.cls.analyticsSink?.handPlayed?.();
    if (t.handNo >= t.hands) {
      // match over: lowest total wins the pot (split on ties)
      const totals = [...t.totals];
      const min = Math.min(...totals);
      const winners = [0, 1, 2, 3].filter((s) => totals[s] === min);
      const share = Math.floor(t.pot / winners.length);
      const payout = [0, 1, 2, 3].map((s) => (winners.includes(s) ? share : 0) - t.bet);
      for (const s of winners) {
        const pl = this.state.players.get(t.seats[s]!);
        if (pl) pl.money += share;
      }
      t.lastMatch = JSON.stringify({ totals, winners, pot: t.pot, payout });
      t.pot = 0;
      t.status = 'result';
      rt.until = Date.now() + this.cls.timing.result;
    } else {
      t.status = 'between';
      rt.until = Date.now() + this.cls.timing.between;
    }
    this.syncTable(ti, false);
  }

  private resetTable(ti: number, kickBots: boolean): void {
    const t = this.state.tables[ti]!;
    const rt = this.runtime[ti]!;
    rt.game = null;
    t.status = 'open';
    t.pot = 0;
    t.handNo = 0;
    t.view = '';
    t.turnEndsAt = 0;
    if (kickBots) {
      for (let s = 0; s < 4; s++) {
        const sid = t.seats[s]!;
        if (sid && this.state.players.get(sid)?.isBot) {
          this.state.players.delete(sid);
          t.seats[s] = '';
        }
      }
    }
  }

  // ------------------------------------------------------------ okey actions
  private okeyAction(id: string, a: OkeyAction): void {
    const p = this.state.players.get(id);
    if (!p || p.table < 0 || !a || typeof a.t !== 'string') return;
    const ti = p.table;
    const g = this.runtime[ti]!.game;
    if (!g || this.state.tables[ti]!.status !== 'playing') return;
    const s = p.seat;
    const now = Date.now();
    const int = (v: unknown) => (typeof v === 'number' && Number.isInteger(v) ? v : -1);
    const tiles = (v: unknown) => (Array.isArray(v) && v.length <= 22 && v.every((x) => Number.isInteger(x)) ? (v as number[]) : []);
    let r: Result;
    switch (a.t) {
      case 'draw':
        r = g.drawFromDeck(s);
        break;
      case 'take':
        r = g.takeFromLeft(s);
        break;
      case 'putBack':
        r = g.putBack(s);
        break;
      case 'open':
        r = Array.isArray(a.groups) && a.groups.length <= 11 ? g.open(s, a.groups.map(tiles)) : { ok: false, error: 'Geçersiz.' };
        break;
      case 'lay':
        r = g.layMeld(s, tiles(a.tiles));
        break;
      case 'add':
        r = g.addToMeld(s, int(a.tile), int(a.meld));
        break;
      case 'swap':
        r = g.swapJoker(s, int(a.tile), int(a.meld));
        break;
      case 'discard':
        r = g.discard(s, int(a.tile));
        break;
      case 'deckEmpty':
        r = g.declareDeckEmpty(s);
        break;
      case 'steal':
        r = g.steal(s, int(a.tile), int(a.pile), now);
        break;
      case 'accuse':
        r = g.accuse(s, now);
        break;
      default:
        return;
    }
    if (!r.ok) return this.error(id, r.error);
    this.applyEvents(ti, r.events);
  }

  private applyEvents(ti: number, events: OkeyEvent[]): void {
    const t = this.state.tables[ti]!;
    const g = this.runtime[ti]!.game!;
    let turnChanged = false;
    for (const e of events) {
      if (e.type === 'turn') turnChanged = true;
      if (e.type === 'caught') {
        this.transfer(t.seats[e.thief]!, t.seats[e.by]!, STEAL_FINE);
      } else if (e.type === 'falseAccusation') {
        const accused = e.accused ?? (g.turn !== e.by ? g.turn : null);
        if (accused !== null) this.transfer(t.seats[e.by]!, t.seats[accused]!, FALSE_ACCUSE_FINE);
      }
      if (e.type === 'stole') {
        // nobody is told directly: each opponent may notice "fishy hands" (55 %),
        // everyone can also spot the changed top tile of the pile
        for (let s = 0; s < 4; s++) {
          if (s === e.seat) continue;
          const pl = this.state.players.get(t.seats[s]!);
          if (!pl) continue;
          const noticed = this.cls.rng() < 0.55;
          if (pl.isBot) {
            if (noticed && this.cls.rng() < 0.6) this.runtime[ti]!.botAccuse.set(s, Date.now() + 1200 + this.cls.rng() * 3500);
          } else if (noticed) {
            this.avatars.get(pl.id)?.client?.send(KMSG.okeyEvent, { table: ti, e: { type: 'suspicious', seat: e.seat } } satisfies OkeyEventMsg);
          }
        }
        this.avatars.get(t.seats[e.seat]!)?.client?.send(KMSG.okeyEvent, { table: ti, e: { type: 'stoleOk', fromSeat: e.fromSeat } } satisfies OkeyEventMsg);
        continue;
      }
      if (e.type === 'caught' || e.type === 'falseAccusation') this.runtime[ti]!.botAccuse.clear();
      if (e.type === 'handEnd') {
        this.tableEvent(ti, { type: 'handEnd', result: e.result, hands: g.hands });
        this.onHandEnd(ti, e.result);
        continue;
      }
      this.tableEvent(ti, e as unknown as OkeyEventMsg['e']);
    }
    if (t.status === 'playing') this.syncTable(ti, turnChanged);
    for (let s = 0; s < 4; s++) this.sendHand(ti, s);
  }

  private transfer(fromId: string, toId: string, amount: number): void {
    const from = this.state.players.get(fromId);
    const to = this.state.players.get(toId);
    if (!from || !to) return;
    const a = Math.min(amount, Math.max(0, from.money));
    from.money -= a;
    to.money += a;
  }

  private syncTable(ti: number, newTurn: boolean): void {
    const t = this.state.tables[ti]!;
    const g = this.runtime[ti]!.game;
    t.view = g ? JSON.stringify(g.publicView()) : '';
    if (g && newTurn && g.phase !== 'ended') {
      t.turnEndsAt = Date.now() + this.cls.timing.turn;
      this.runtime[ti]!.botAt = Date.now() + this.botDelay();
    }
  }

  private botDelay(): number {
    const { botMin, botMax } = this.cls.timing;
    return botMin + this.cls.rng() * (botMax - botMin);
  }

  private sendHand(ti: number, seat: number): void {
    if (ti < 0 || seat < 0) return;
    const g = this.runtime[ti]!.game;
    const id = this.state.tables[ti]!.seats[seat];
    const c = id ? this.avatars.get(id)?.client : null;
    if (!g || !c) return;
    c.send(KMSG.hand, { table: ti, tiles: g.hands[seat], taken: g.turn === seat ? g.takenFromLeft : null });
  }

  private tableEvent(ti: number, e: OkeyEventMsg['e']): void {
    const msg: OkeyEventMsg = { table: ti, e };
    this.broadcast(KMSG.okeyEvent, msg);
  }

  private error(id: string, text: string): void {
    this.avatars.get(id)?.client?.send(KMSG.okeyError, text);
  }

  // ------------------------------------------------------------ orders & money
  private order(id: string, m: OrderMsg): void {
    const p = this.state.players.get(id);
    const a = this.avatars.get(id);
    const item = MENU.find((x) => x.id === m?.item);
    if (!p || !a || !item || typeof m.to !== 'string') return;
    const now = Date.now();
    if (now - a.lastOrderAt < 1500) return;
    let to: string[];
    if (m.to === 'table') {
      if (p.table < 0) return this.error(id, 'Masaya ısmarlamak için bir masaya otur.');
      to = [...this.state.tables[p.table]!.seats].filter(Boolean);
    } else {
      if (!this.state.players.has(m.to)) return;
      to = [m.to];
    }
    const cost = item.price * to.length;
    if (p.money < cost) return this.error(id, 'Paran yetmiyor. Veresiye isteyebilirsin.');
    a.lastOrderAt = now;
    p.money -= cost;
    const msg: ServedMsg = { from: id, to, item: item.id };
    this.broadcast(KMSG.served, msg);
  }

  // ------------------------------------------------------------ lobby helpers
  private updateMeta(): void {
    for (const a of this.avatars.values()) if (a.device) this.saveWallet(a.id);
    const humans = [...this.state.players.values()].filter((p) => !p.isBot).length;
    let playing = 0;
    let waiting = 0;
    for (const t of this.state.tables) {
      if (t.status !== 'open') playing++;
      else if ([...t.seats].some((s) => s && this.isHuman(s))) waiting++;
    }
    const top = [...this.state.players.values()]
      .filter((p) => !p.isBot)
      .sort((a, b) => b.money - a.money)
      .slice(0, 5)
      .map((p) => ({ name: p.name, money: p.money }));
    const same = JSON.stringify(top) === JSON.stringify(this.meta.top ?? []);
    if (same && playing === this.meta.playing && waiting === this.meta.waiting && humans === this.meta.humans) return;
    Object.assign(this.meta, { playing, waiting, humans, top });
    void this.setMetadata({ ...this.meta });
  }

  /**
   * "Hızlı otur": go to a table without walking. With a table index it is that
   * table, otherwise the best one: people already waiting first, else an empty one.
   */
  private quickSeat(id: string, raw: unknown): void {
    const p = this.state.players.get(id);
    const a = this.avatars.get(id);
    if (!p || !a || p.table >= 0) return;
    if (p.spot >= 0) this.leaveSpot(id);
    let ti = Number(raw);
    if (!Number.isInteger(ti) || ti < 0 || ti >= TABLE_COUNT) {
      const free = (i: number) => this.state.tables[i]!.status === 'open' && [...this.state.tables[i]!.seats].some((s) => !s);
      const waitingHumans = (i: number) => [...this.state.tables[i]!.seats].filter((s) => s && this.isHuman(s)).length;
      const order = [...Array(TABLE_COUNT).keys()].filter(free).sort((x, y) => waitingHumans(y) - waitingHumans(x));
      ti = order[0] ?? -1;
      if (ti < 0) return this.error(id, 'Şu an boş masa yok, biraz bekle.');
    }
    const t = this.state.tables[ti]!;
    if (t.status !== 'open' || ![...t.seats].some((s) => !s)) return this.error(id, 'Bu masada yer yok.');
    const tc = TABLES[ti]!;
    a.body = createBody(tc.x, tc.z + 1.8);
    this.sit(id, ti, undefined);
  }

  /** Host: fill the empty chairs with bots and deal right away. */
  private fillBotsAndStart(id: string): void {
    const p = this.state.players.get(id);
    if (!p || p.table < 0) return;
    const t = this.state.tables[p.table]!;
    if (t.hostId !== id || t.status !== 'open') return;
    for (let s = 0; s < 4; s++) if (t.seats[s] === '') t.seats[s] = this.createBot(p.table, s).id;
    this.startMatch(id);
  }

  // ------------------------------------------------------------ market, simitçi, benches
  private buy(id: string, m: { shop?: unknown; item?: unknown }): void {
    const p = this.state.players.get(id);
    const a = this.avatars.get(id);
    const shop = SHOPS.find((s) => s.id === m?.shop);
    const item = SHOP_ITEMS.find((i) => i.id === m?.item);
    if (!p || !a || !shop || !item || !shop.items.includes(item.id)) return;
    const now = Date.now();
    if (now - a.lastShopAt < 600) return;
    a.lastShopAt = now;
    if (Math.hypot(a.body.x - shop.x, a.body.z - shop.z) > SHOP_REACH + 0.6) return this.error(id, `${shop.name}'e biraz daha yaklaş.`);
    if (p.money < item.price) return this.error(id, 'Paran yetmiyor.');
    p.money -= item.price;
    p.holding = item.id;
    p.uses = item.uses;
  }

  private useItem(id: string): void {
    const p = this.state.players.get(id);
    const a = this.avatars.get(id);
    if (!p || !a || !p.holding || p.uses <= 0) return;
    const now = Date.now();
    if (now - a.lastUseAt < 1500) return;
    a.lastUseAt = now;
    const item = p.holding;
    p.uses--;
    if (p.uses <= 0) p.holding = '';
    this.broadcast(KMSG.used, { id, item } satisfies UsedMsg);
  }

  private sitSpot(id: string, raw: unknown): void {
    const p = this.state.players.get(id);
    const a = this.avatars.get(id);
    const i = Number(raw);
    const s = SIT_SPOTS[i];
    if (!p || !a || !s || p.table >= 0 || p.spot >= 0) return;
    if (Math.hypot(a.body.x - s.x, a.body.z - s.z) > SPOT_REACH + 0.6) return this.error(id, 'Biraz daha yaklaş.');
    if ([...this.state.players.values()].some((o) => o.spot === i)) return this.error(id, 'Orası dolu.');
    p.spot = i;
    a.body = createBody(s.x, s.z);
    a.yaw = s.yaw;
    a.queue = [];
    a.queueSeq = [];
    a.client?.send(MSG.teleport, { x: s.x, y: 0, z: s.z, yaw: s.yaw } satisfies TeleportMsg);
  }

  private leaveSpot(id: string): void {
    const p = this.state.players.get(id);
    const a = this.avatars.get(id);
    if (!p || p.spot < 0) return;
    const s = SIT_SPOTS[p.spot]!;
    p.spot = -1;
    if (!a) return;
    // step forward off the seat (seated people face away from the seat)
    const x = s.x - Math.sin(s.yaw) * 0.8;
    const z = s.z - Math.cos(s.yaw) * 0.8;
    a.body = createBody(x, z);
    a.queue = [];
    a.queueSeq = [];
    a.client?.send(MSG.teleport, { x, y: 0, z, yaw: s.yaw } satisfies TeleportMsg);
  }

  private credit(id: string): void {
    const p = this.state.players.get(id);
    const a = this.avatars.get(id);
    if (!p || !a) return;
    const now = Date.now();
    if (p.money >= 50) return this.error(id, 'Veresiye sadece parası bitene verilir.');
    if (now - a.lastCreditAt < CREDIT_COOLDOWN_MS) return this.error(id, 'Kahveci biraz bekle diyor…');
    a.lastCreditAt = now;
    p.money += CREDIT_AMOUNT;
  }

  // ------------------------------------------------------------ tick
  private tick(): void {
    const now = Date.now();
    for (const a of this.avatars.values()) {
      const p = this.state.players.get(a.id);
      for (let k = 0; k < 3 && a.queue.length; k++) {
        const input = a.queue.shift()!;
        a.lastSeq = a.queueSeq.shift()!;
        if (p && p.table < 0 && p.spot < 0) stepBody(a.body, input, SIM_DT, KAHVE_WORLD);
      }
    }
    for (let ti = 0; ti < TABLE_COUNT; ti++) this.tickTable(ti, now);
    this.sendSnapshots(now);
  }

  private tickTable(ti: number, now: number): void {
    const t = this.state.tables[ti]!;
    const rt = this.runtime[ti]!;
    if (t.status === 'between' && now >= rt.until) return this.dealHand(ti);
    if (t.status === 'result' && now >= rt.until) return this.resetTable(ti, false);
    const g = rt.game;
    if (t.status !== 'playing' || !g || g.phase === 'ended') return;
    for (const [seat, at] of rt.botAccuse) {
      if (now < at) continue;
      rt.botAccuse.delete(seat);
      const r = g.accuse(seat, now);
      if (r.ok) this.applyEvents(ti, r.events);
      if ((g.phase as string) === 'ended') return;
    }
    const sid = t.seats[g.turn]!;
    const pl = this.state.players.get(sid);
    if (pl?.isBot || !pl?.connected) {
      if (now < rt.botAt) return;
      rt.botAt = now + this.botDelay() * 0.6;
      const s = g.turn;
      const act = botAction(g, s);
      let r: Result;
      switch (act.type) {
        case 'drawDeck':
          r = g.drawFromDeck(s);
          break;
        case 'takeLeft':
          r = g.takeFromLeft(s);
          break;
        case 'deckEmpty':
          r = g.declareDeckEmpty(s);
          break;
        case 'open':
          r = g.open(s, act.groups);
          break;
        case 'lay':
          r = g.layMeld(s, act.tiles);
          break;
        case 'add':
          r = g.addToMeld(s, act.tile, act.meldId);
          break;
        case 'discard': {
          // now and then a bot tries its luck stealing from the player opposite
          const opp = (s + 2) % 4;
          if (pl?.isBot && !g.stealUsed[s] && g.topDiscard(opp) !== null && this.cls.rng() < 0.06) {
            r = g.steal(s, act.tile, opp, now);
            break;
          }
          r = g.discard(s, act.tile);
          break;
        }
      }
      if (!r.ok) r = g.autoPlay(s);
      if (r.ok) this.applyEvents(ti, r.events);
      return;
    }
    if (now >= t.turnEndsAt) {
      const seat = g.turn;
      const r = g.autoPlay(seat);
      if (r.ok) {
        this.tableEvent(ti, { type: 'timeout', seat });
        this.applyEvents(ti, r.events);
      }
    }
  }

  private sendSnapshots(t: number): void {
    const all: PlayerSnap[] = [];
    for (const a of this.avatars.values()) {
      const p = this.state.players.get(a.id);
      all.push([a.id, r2(a.body.x), r2(a.body.y), r2(a.body.z), r2(a.yaw), p && (p.table >= 0 || p.spot >= 0) ? 4 : 0]);
    }
    for (const a of this.avatars.values()) {
      if (!a.client) continue;
      const b = a.body;
      const msg: SnapshotMsg = { t, a: a.lastSeq, me: [b.x, b.y, b.z, b.vy, b.onGround ? 1 : 0, b.stamina, b.tired ? 1 : 0, -1], p: all.filter((x) => x[0] !== a.id) };
      a.client.send(MSG.snapshot, msg);
    }
  }

  // ------------------------------------------------------------ test helpers
  debugGame(ti: number): OkeyGame | null {
    return this.runtime[ti]?.game ?? null;
  }

  debugPlace(id: string, x: number, z: number): void {
    const a = this.avatars.get(id);
    if (a) a.body = createBody(x, z);
  }
}

function r2(n: number): number {
  return Math.round(n * 100) / 100;
}
