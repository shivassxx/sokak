import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { matchMaker } from '@colyseus/core';
import { ACHIEVEMENTS, ACH_MSG, DAILY_MISSIONS, KAHVE_ROOM, KMSG, MSG, SHOPS, SHOP_ITEMS, START_MONEY, TABLES, achievementById, type AchState, type AchUnlockMsg } from '@sokak/shared';
import { NetBot } from './netBot';
import { startServer, type StartedServer } from '../src/app';
import { WalletStore } from '../src/wallets';
import { until, sleep } from './helpers';
import type { KahvehaneRoom } from '../src/rooms/KahvehaneRoom';

let server: StartedServer;
let endpoint: string;

beforeAll(async () => {
  server = await startServer(0, { host: '127.0.0.1', kahve: { timing: { botMin: 5, botMax: 15, between: 200, result: 300, turn: 400 } } });
  endpoint = `ws://127.0.0.1:${server.port}`;
});
afterAll(async () => {
  await server.close();
});

const st = (b: NetBot) => b.room.state as any;
const me = (b: NetBot) => st(b).players.get(b.id);
const unlocks = (b: NetBot) => b.messages.filter((m) => m.type === ACH_MSG).map((m) => m.msg as AchUnlockMsg);
const achOf = async (device: string) => (await (await fetch(`http://127.0.0.1:${server.port}/api/achievements?device=${device}`)).json()) as AchState;
const walletOf = async (device: string) => (await (await fetch(`http://127.0.0.1:${server.port}/api/wallet?device=${device}`)).json()) as { money: number } | null;

describe('başarımlar (wallet store)', () => {
  it('unlocks and pays once per device, straight into the stored wallet', () => {
    const store = new WalletStore(null);
    const dev = 'ab'.repeat(16);
    expect(store.bumpAch(dev, 'okeyPlayed')).toEqual([]); // no wallet yet: nothing to keep it in
    store.set(dev, { money: 500, lastBonus: 0, seen: 0 });
    expect(store.bumpAch(dev, 'okeyPlayed').map((a) => a.id)).toEqual(['firstMatch']);
    expect(store.get(dev)!.money).toBe(500 + achievementById('firstMatch')!.reward);
    expect(store.bumpAch(dev, 'okeyPlayed')).toEqual([]);
    expect(store.get(dev)!.money).toBe(500 + achievementById('firstMatch')!.reward);
    expect(store.achievements(dev)).toEqual({ c: { okeyPlayed: 2 }, got: ['firstMatch'] });
    expect(store.achievements('nope')).toEqual({ c: {}, got: [] });
    expect(store.bumpAch('not-a-token', 'chat')).toEqual([]);
  });
});

describe('başarımlar (room)', () => {
  it('finishing a bot match unlocks "İlk maç" once and pays once; bots earn nothing', async () => {
    const device = 'a1'.repeat(16);
    const a = await new NetBot(endpoint).joinOrCreate(KAHVE_ROOM, { name: 'Basarimci', device });
    await until(() => !!st(a).players?.get(a.id));
    const room = matchMaker.getLocalRoomById(a.room.roomId) as KahvehaneRoom;
    room.debugPlace(a.id, TABLES[2]!.x, TABLES[2]!.z + 2);
    await sleep(80);
    a.room.send(KMSG.sit, { table: 2, seat: 0 });
    await until(() => me(a).table === 2);
    a.room.send(KMSG.tableConfig, { bet: 50, hands: 1 });
    for (let i = 0; i < 3; i++) a.room.send(KMSG.tableBot, {});
    await until(() => [...st(a).tables[2].seats].every((s: string) => s));
    a.room.send(KMSG.tableStart);
    await until(() => st(a).tables[2].status === 'playing');
    await until(() => st(a).tables[2].lastMatch !== '', 60000);
    await until(() => unlocks(a).some((u) => u.id === 'firstMatch'));
    expect(unlocks(a).filter((u) => u.id === 'firstMatch')).toEqual([{ id: 'firstMatch', reward: achievementById('firstMatch')!.reward }]);
    // the session's money includes the pot share and every reward exactly once
    const result = JSON.parse(st(a).tables[2].lastMatch) as { payout: number[] };
    // (+ the daily "finish a match" mission)
    const rewards = unlocks(a).reduce((s, u) => s + u.reward, 0) + DAILY_MISSIONS.find((d) => d.id === 'match')!.reward;
    await until(() => me(a).money === START_MONEY + result.payout[0]! + rewards);
    const ach = await achOf(device);
    expect(ach.got).toContain('firstMatch');
    expect(ach.c.okeyPlayed).toBe(1);
    // counting again (a second finished match) never pays it twice
    expect(server.wallets.bumpAch(device, 'okeyPlayed').map((d) => d.id)).not.toContain('firstMatch');
    // bots have no device: the only wallet touched is ours
    const bots = [...st(a).tables[2].seats].filter((s: string) => s !== a.id);
    expect(bots.every((id: string) => st(a).players.get(id)?.isBot)).toBe(true);
    a.room.send(KMSG.stand);
    await a.leave();
    await sleep(150);
    // the stored wallet has the same balance the session ended with
    expect((await walletOf(device))!.money).toBe(START_MONEY + result.payout[0]! + rewards);
  });

  it('two tabs of one device: the market achievement unlocks and pays only once', async () => {
    const device = 'b2'.repeat(16);
    const market = SHOPS.find((s) => s.id === 'market')!;
    const su = SHOP_ITEMS.find((i) => i.id === 'su')!;
    const a = await new NetBot(endpoint).joinOrCreate(KAHVE_ROOM, { name: 'SekmeBir', device });
    await until(() => !!st(a).players?.get(a.id));
    const b = await new NetBot(endpoint).joinOrCreate(KAHVE_ROOM, { name: 'SekmeIki', device });
    await until(() => !!st(b).players?.get(b.id));
    const room = matchMaker.getLocalRoomById(a.room.roomId) as KahvehaneRoom;
    room.debugPlace(a.id, market.x, market.z - 1);
    room.debugPlace(b.id, market.x + 0.5, market.z - 1);
    await sleep(80);
    a.room.send(KMSG.buy, { shop: 'market', item: 'su' });
    b.room.send(KMSG.buy, { shop: 'market', item: 'su' });
    await until(() => me(a).holding === 'su' && me(b).holding === 'su');
    await sleep(200);
    const all = [...unlocks(a), ...unlocks(b)].filter((u) => u.id === 'market');
    expect(all.length).toBe(1);
    expect((await achOf(device)).c.market).toBe(2);
    await a.leave();
    await sleep(100);
    await b.leave();
    await sleep(150);
    // both tabs paid for water, the reward arrived once
    expect((await walletOf(device))!.money).toBe(START_MONEY - 2 * su.price + achievementById('market')!.reward);
  });

  it('progress persists across a reconnect with the same device', async () => {
    const device = 'c3'.repeat(16);
    const a = await new NetBot(endpoint).joinOrCreate(KAHVE_ROOM, { name: 'Gevezeci', device });
    await until(() => !!st(a).players?.get(a.id));
    for (let i = 0; i < 3; i++) {
      a.room.send(MSG.chat, 0);
      await sleep(1250); // quick chat is rate limited
    }
    expect((await achOf(device)).c.chat).toBe(3);
    await a.leave();
    await sleep(150);
    const b = await new NetBot(endpoint).joinOrCreate(KAHVE_ROOM, { name: 'Gevezeci', device });
    await until(() => !!st(b).players?.get(b.id));
    b.room.send(MSG.chat, 1);
    await sleep(200);
    const ach = await achOf(device);
    expect(ach.c.chat).toBe(4);
    expect(ach.got).toEqual([]);
    // somebody else's device sees nothing of it; an invalid token gets an empty record
    expect(await achOf('d4'.repeat(16))).toEqual({ c: {}, got: [], total: ACHIEVEMENTS.length });
    expect(await achOf('../etc')).toEqual({ c: {}, got: [], total: ACHIEVEMENTS.length });
    await b.leave();
  });
});
