import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { matchMaker } from '@colyseus/core';
import { NetBot } from '@sokak/bots/client';
import { DAILY_MISSIONS, FISH, KAHVE_ROOM, KMSG, MENU, MSG, QUICK_CHAT_OKEY, SEA_Z, SHOPS, SHOP_ITEMS, SIT_SPOTS, START_MONEY, TABLES, TABLE_COUNT, type TableView } from '@sokak/shared';
import { startServer, type StartedServer } from '../src/app';
import { until, sleep } from './helpers';
import type { KahvehaneRoom } from '../src/rooms/KahvehaneRoom';

let server: StartedServer;
let endpoint: string;

beforeAll(async () => {
  server = await startServer(0, { host: '127.0.0.1', kahve: { timing: { botMin: 5, botMax: 15, between: 200, result: 300, turn: 400, biteMin: 1000, biteMax: 1200, biteWindow: 900 } } });
  endpoint = `ws://127.0.0.1:${server.port}`;
});
afterAll(async () => {
  await server.close();
});

const st = (b: NetBot) => b.room.state as any;
const me = (b: NetBot) => st(b).players.get(b.id);
const table = (b: NetBot, i: number) => st(b).tables[i];

async function seated(name: string, ti = 0) {
  const a = await new NetBot(endpoint).joinOrCreate(KAHVE_ROOM, { name });
  await until(() => !!st(a).players?.get(a.id));
  const room = matchMaker.getLocalRoomById(a.room.roomId) as KahvehaneRoom;
  room.debugPlace(a.id, TABLES[ti]!.x, TABLES[ti]!.z + 2);
  await sleep(80);
  a.room.send(KMSG.sit, { table: ti, seat: 0 });
  await until(() => me(a).table === ti);
  return { a, room };
}

describe('kahvehane', () => {
  it('everyone lands in the same public kahvehane with play money', async () => {
    const a = await new NetBot(endpoint).joinOrCreate(KAHVE_ROOM, { name: 'Ali' });
    const b = await new NetBot(endpoint).joinOrCreate(KAHVE_ROOM, { name: 'Veli' });
    expect(b.room.roomId).toBe(a.room.roomId);
    await until(() => st(a).players?.size === 2);
    expect(me(a).money).toBe(START_MONEY);
    expect(st(a).tables.length).toBe(TABLE_COUNT);
    expect(TABLE_COUNT).toBeGreaterThanOrEqual(20);
    await a.leave();
    await b.leave();
  });

  it('cannot sit from across the room', async () => {
    const a = await new NetBot(endpoint).joinOrCreate(KAHVE_ROOM, { name: 'Uzak' });
    await until(() => !!st(a).players?.get(a.id));
    const room = matchMaker.getLocalRoomById(a.room.roomId) as KahvehaneRoom;
    room.debugPlace(a.id, 11, -8);
    await sleep(80);
    a.room.send(KMSG.sit, { table: 3, seat: 0 });
    await until(() => a.messages.some((m) => m.type === KMSG.okeyError));
    expect(me(a).table).toBe(-1);
    await a.leave();
  });

  it('a full match with bots: private hands, bets, pot paid to the winner', async () => {
    const { a, room } = await seated('Oyuncu', 1);
    a.room.send(KMSG.tableConfig, { bet: 50, hands: 1 });
    for (let i = 0; i < 3; i++) a.room.send(KMSG.tableBot, {});
    await until(() => [...table(a, 1).seats].every((s: string) => s));
    a.room.send(KMSG.tableStart);
    await until(() => table(a, 1).status === 'playing');
    expect(me(a).money).toBe(START_MONEY - 50);
    expect(table(a, 1).pot).toBe(200);
    // my hand arrives privately; the public view hides hands
    await until(() => a.messages.some((m) => m.type === KMSG.hand));
    const hand = a.messages.filter((m) => m.type === KMSG.hand).pop()!.msg as { tiles: number[] };
    expect([21, 22]).toContain(hand.tiles.length);
    const view = JSON.parse(table(a, 1).view) as TableView & { hands?: unknown };
    expect(view.hands).toBeUndefined();
    expect(view.handCounts.reduce((x, y) => x + y, 0)).toBe(85);
    // the human never acts: timeouts autoplay; bots play; the match must end
    try {
      await until(() => table(a, 1).status === 'result' || table(a, 1).status === 'open', 60000);
    } catch (e) {
      const g = room.debugGame(1)!;
      console.log('STUCK', table(a, 1).status, 'turn', g.turn, 'phase', g.phase, 'deck', g.deck.length, 'hands', g.hands.map((h) => h.length), 'taken', g.takenFromLeft);
      throw e;
    }
    const result = JSON.parse(table(a, 1).lastMatch);
    expect(result.winners.length).toBeGreaterThan(0);
    const total = [...st(a).players.values()].filter((p: any) => p.table === 1).reduce((s: number, p: any) => s + p.money, 0);
    expect(total).toBe(START_MONEY * 4); // money is conserved
    // the finished match counts towards the human's level (bots keep no record)
    await until(() => me(a).played === 1);
    expect(me(a).won).toBe(result.winners.includes(0) ? 1 : 0);
    const bot = [...st(a).players.values()].find((p: any) => p.table === 1 && p.isBot) as any;
    expect(bot.played).toBe(0);
    void room;
    await a.leave();
  }, 70000);

  it('orders: tea for the table costs money for every seat', async () => {
    const { a } = await seated('Ismarlayan', 2);
    a.room.send(KMSG.tableBot, {});
    await until(() => [...table(a, 2).seats].filter(Boolean).length === 2);
    const before = me(a).money;
    a.room.send(KMSG.order, { item: 'cay', to: 'table' });
    await until(() => a.messages.some((m) => m.type === KMSG.served));
    const served = a.messages.find((m) => m.type === KMSG.served)!.msg as { to: string[] };
    expect(served.to.length).toBe(2);
    await until(() => me(a).money === before - MENU.find((m) => m.id === 'cay')!.price * 2);
    // the bot at the table says thanks
    const bot = [...table(a, 2).seats].find((id: string) => id && id !== a.id);
    await until(() => a.messages.some((m) => m.type === MSG.chat && (m.msg as { id: string; q: number }).id === bot && QUICK_CHAT_OKEY[(m.msg as { q: number }).q] === 'Eyvallah!'), 4000);
    // veresiye only when broke
    a.room.send(KMSG.credit);
    await until(() => a.messages.filter((m) => m.type === KMSG.okeyError).length > 0);
    await a.leave();
  });

  it('taş çalma: a caught thief pays the catcher; standing up mid-match hands the seat to a bot', async () => {
    const { a, room } = await seated('Hirsiz', 3);
    const b = await new NetBot(endpoint).joinOrCreate(KAHVE_ROOM, { name: 'Bekci' });
    await until(() => !!st(b).players?.get(b.id));
    room.debugPlace(b.id, TABLES[3]!.x + 2, TABLES[3]!.z);
    await sleep(80);
    b.room.send(KMSG.sit, { table: 3, seat: 1 });
    await until(() => me(b).table === 3);
    a.room.send(KMSG.tableBot, {});
    a.room.send(KMSG.tableBot, {});
    await until(() => [...table(a, 3).seats].every((s: string) => s));
    a.room.send(KMSG.tableStart);
    await until(() => table(a, 3).status === 'playing');
    const g = room.debugGame(3)!;
    // rig: it's seat 0's turn in play phase, seat 2 has a discard
    g.turn = 0;
    g.phase = 'play';
    g.discards[2]!.push(g.hands[2]!.pop()!);
    const myTile = g.hands[0]![0]!;
    a.room.send(KMSG.okey, { t: 'steal', tile: myTile, pile: 2 });
    await until(() => g.lastSteal !== null);
    const moneyA = me(a).money;
    const moneyB = me(b).money;
    b.room.send(KMSG.okey, { t: 'accuse' });
    await until(() => me(a).money === moneyA - 50);
    expect(me(b).money).toBe(moneyB + 50);
    // stand up: a bot takes the seat, the table keeps going
    b.room.send(KMSG.stand);
    await until(() => me(b).table === -1);
    const seat1 = table(a, 3).seats[1];
    expect(st(a).players.get(seat1).isBot).toBe(true);
    await a.leave();
    await b.leave();
  });

  it('market: buy a pack at the counter, use it up; benches: sit and stand', async () => {
    const a = await new NetBot(endpoint).joinOrCreate(KAHVE_ROOM, { name: 'Alici' });
    await until(() => !!st(a).players?.get(a.id));
    const room = matchMaker.getLocalRoomById(a.room.roomId) as KahvehaneRoom;
    const market = SHOPS.find((s) => s.id === 'market')!;
    // too far away
    a.room.send(KMSG.buy, { shop: 'market', item: 'sigara' });
    await until(() => a.messages.some((m) => m.type === KMSG.okeyError));
    expect(me(a).holding).toBe('');
    room.debugPlace(a.id, market.x, market.z);
    await sleep(700);
    a.room.send(KMSG.buy, { shop: 'market', item: 'sigara' });
    const pack = SHOP_ITEMS.find((i) => i.id === 'sigara')!;
    await until(() => me(a).holding === 'sigara');
    expect(me(a).money).toBe(START_MONEY - pack.price);
    expect(me(a).uses).toBe(pack.uses);
    // the simitçi does not sell cigarettes
    a.room.send(KMSG.buy, { shop: 'simitci', item: 'sigara' });
    a.room.send(KMSG.use);
    await until(() => a.messages.some((m) => m.type === KMSG.used));
    // the state patch follows the broadcast on the next tick
    await until(() => me(a).uses === pack.uses - 1);
    // bench
    const spot = SIT_SPOTS[0]!;
    room.debugPlace(a.id, spot.x, spot.z + 1);
    await sleep(80);
    a.room.send(KMSG.sitSpot, { spot: 0 });
    await until(() => me(a).spot === 0);
    a.room.send(KMSG.stand);
    await until(() => me(a).spot === -1);
    await a.leave();
  });

  it('sahil ledge: sit facing the sea, stand up back on the promenade', async () => {
    const a = await new NetBot(endpoint).joinOrCreate(KAHVE_ROOM, { name: 'Salacak' });
    await until(() => !!st(a).players?.get(a.id));
    const room = matchMaker.getLocalRoomById(a.room.roomId) as KahvehaneRoom;
    const i = SIT_SPOTS.findIndex((s) => s.label === 'Sahil duvarı');
    const spot = SIT_SPOTS[i]!;
    expect(i).toBeGreaterThanOrEqual(0);
    room.debugPlace(a.id, spot.stand!.x, spot.stand!.z);
    await sleep(80);
    a.room.send(KMSG.sitSpot, { spot: i });
    await until(() => me(a).spot === i);
    a.room.send(KMSG.stand);
    await until(() => me(a).spot === -1);
    await sleep(120);
    const body = (room as any).avatars.get(a.id).body;
    expect(body.z).toBeCloseTo(spot.stand!.z, 1);
    expect(room.state.players.get(a.id)!.spot).toBe(-1);
    await a.leave();
  });

  it('fishing: cast at the sea, pulling early loses it, pulling on a bite lands a fish', async () => {
    const a = await new NetBot(endpoint).joinOrCreate(KAHVE_ROOM, { name: 'Balikci' });
    await until(() => !!st(a).players?.get(a.id));
    const room = matchMaker.getLocalRoomById(a.room.roomId) as KahvehaneRoom;
    const market = SHOPS.find((s) => s.id === 'market')!;
    room.debugPlace(a.id, market.x, market.z);
    await sleep(80);
    a.room.send(KMSG.buy, { shop: 'market', item: 'olta' });
    await until(() => me(a).holding === 'olta');
    const uses = me(a).uses;
    // not at the sea: nothing happens
    a.room.send(KMSG.use);
    await sleep(450);
    expect(me(a).fish).toBe(0);
    room.debugPlace(a.id, 0, SEA_Z - 1);
    await sleep(80);
    a.room.send(KMSG.use);
    await until(() => me(a).fish === 1);
    await sleep(450);
    a.room.send(KMSG.use); // too early
    await until(() => me(a).fish === 0);
    expect(me(a).uses).toBe(uses - 1);
    const caught: string[] = [];
    a.room.onMessage(KMSG.used, (u: { id: string; fish?: string }) => u.id === a.id && u.fish && caught.push(u.fish));
    await sleep(450);
    a.room.send(KMSG.use);
    await until(() => me(a).fish === 1);
    await until(() => me(a).fish === 2, 3000);
    a.room.send(KMSG.use);
    await until(() => caught.length === 1);
    expect(FISH.map((f) => f.id)).toContain(caught[0]);
    await until(() => me(a).uses === uses - 2); // the state patch can trail the broadcast
    // walking away reels the line in
    await sleep(450);
    a.room.send(KMSG.use);
    await until(() => me(a).fish === 1);
    room.debugPlace(a.id, 0, SEA_Z - 6);
    await until(() => me(a).fish === 0);
    await a.leave();
  });

  it('wallet: the same device keeps its play money between visits', async () => {
    const device = 'ab'.repeat(16);
    const a = await new NetBot(endpoint).joinOrCreate(KAHVE_ROOM, { name: 'Cuzdan', device });
    await until(() => !!st(a).players?.get(a.id));
    expect(me(a).money).toBe(START_MONEY);
    const room = matchMaker.getLocalRoomById(a.room.roomId) as KahvehaneRoom;
    const market = SHOPS.find((s) => s.id === 'market')!;
    room.debugPlace(a.id, market.x, market.z);
    await sleep(80);
    a.room.send(KMSG.buy, { shop: 'market', item: 'su' });
    const su = SHOP_ITEMS.find((i) => i.id === 'su')!;
    await until(() => me(a).money === START_MONEY - su.price);
    await a.leave();
    await sleep(150);
    const b = await new NetBot(endpoint).joinOrCreate(KAHVE_ROOM, { name: 'Cuzdan', device });
    await until(() => !!st(b).players?.get(b.id));
    expect(me(b).money).toBe(START_MONEY - su.price);
    // the lobby can read this device's wallet, nobody else's
    const w = await (await fetch(`http://127.0.0.1:${server.port}/api/wallet?device=${device}`)).json();
    expect(w).toEqual({ money: START_MONEY - su.price, played: 0, won: 0 });
    expect(await (await fetch(`http://127.0.0.1:${server.port}/api/wallet?device=${'cd'.repeat(16)}`)).json()).toBeNull();
    await b.leave();
  });

  it('resync: a rejoined player gets their private hand again', async () => {
    const a = await new NetBot(endpoint).joinOrCreate(KAHVE_ROOM, { name: 'Yenile', quick: true });
    await until(() => (st(a).players?.get(a.id)?.table ?? -1) >= 0);
    const ti = me(a).table;
    a.room.send(KMSG.fillBots);
    await until(() => table(a, ti).status === 'playing');
    let hand: number[] | null = null;
    a.room.onMessage(KMSG.hand, (h: { tiles: number[] }) => (hand = h.tiles));
    await sleep(100);
    hand = null;
    a.room.send(KMSG.resync);
    await until(() => hand !== null);
    expect(hand!.length).toBeGreaterThanOrEqual(21);
    a.room.send(KMSG.stand);
    await a.leave();
  });

  it('wallet: two tabs on one device cannot undo each other\'s losses', async () => {
    const device = 'ef'.repeat(16);
    const a = await new NetBot(endpoint).joinOrCreate(KAHVE_ROOM, { name: 'SekmeA', device });
    await until(() => !!st(a).players?.get(a.id));
    const b = await new NetBot(endpoint).joinOrCreate(KAHVE_ROOM, { name: 'SekmeB', device });
    await until(() => !!st(b).players?.get(b.id));
    const room = matchMaker.getLocalRoomById(a.room.roomId) as KahvehaneRoom;
    // tab A loses 300 at the table, tab B just sits there
    room.state.players.get(a.id)!.money -= 300;
    await sleep(2300); // a meta tick saves both sessions
    await a.leave();
    await sleep(100);
    await b.leave(); // B leaves last: it must not write back the old balance
    await sleep(150);
    const c = await new NetBot(endpoint).joinOrCreate(KAHVE_ROOM, { name: 'SekmeC', device });
    await until(() => !!st(c).players?.get(c.id));
    expect(me(c).money).toBe(START_MONEY - 300);
    await c.leave();
  });

  it('daily missions: tea for the table and a match count, rewards are paid once', async () => {
    const device = '12'.repeat(16);
    const a = await new NetBot(endpoint).joinOrCreate(KAHVE_ROOM, { name: 'Gorevci', device, quick: true });
    await until(() => (st(a).players?.get(a.id)?.table ?? -1) >= 0);
    const ti = me(a).table;
    a.room.send(KMSG.tableBot, {});
    await until(() => [...table(a, ti).seats].filter(Boolean).length === 2);
    const before = me(a).money;
    a.room.send(KMSG.order, { item: 'cay', to: 'table' });
    const tea = DAILY_MISSIONS.find((d) => d.id === 'tea')!;
    const cost = MENU.find((m) => m.id === 'cay')!.price * 2;
    await until(() => me(a).money === before - cost + tea.reward);
    expect(JSON.parse(me(a).missions).progress.tea).toBe(1);
    // a second round of tea pays no second reward
    await sleep(1600);
    a.room.send(KMSG.order, { item: 'cay', to: 'table' });
    await until(() => me(a).money === before - cost * 2 + tea.reward);
    // the same device in another tab sees today's progress
    const b = await new NetBot(endpoint).joinOrCreate(KAHVE_ROOM, { name: 'Gorevci2', device });
    await until(() => !!st(b).players?.get(b.id));
    expect(JSON.parse(me(b).missions).progress.tea).toBe(1);
    a.room.send(KMSG.stand);
    await a.leave();
    await b.leave();
  });

  it('lobby leaderboard: the richest online players of public salons', async () => {
    const a = await new NetBot(endpoint).joinOrCreate(KAHVE_ROOM, { name: 'Zengin' });
    await until(() => !!st(a).players?.get(a.id));
    const room = matchMaker.getLocalRoomById(a.room.roomId) as KahvehaneRoom;
    room.state.players.get(a.id)!.money = 98765;
    const url = `http://127.0.0.1:${server.port}/api/leaders`;
    let top: { name: string; money: number; salon: string }[] = [];
    for (let t = 0; t < 40 && top[0]?.money !== 98765; t++) {
      await sleep(150);
      top = (await (await fetch(url)).json()) as typeof top;
    }
    expect(top[0]!.name).toBe('Zengin');
    expect(top[0]!.salon).toBe(room.state.name);
    await a.leave();
  });

  it('lobby: quick join seats you at a table; fill with bots and deal', async () => {
    const a = await new NetBot(endpoint).joinOrCreate(KAHVE_ROOM, { name: 'Hizli', quick: true });
    await until(() => (st(a).players?.get(a.id)?.table ?? -1) >= 0);
    const ti = me(a).table;
    expect(table(a, ti).hostId).toBe(a.id);
    a.room.send(KMSG.fillBots);
    await until(() => table(a, ti).status === 'playing');
    a.room.send(KMSG.stand);
    await a.leave();
  });
});
