import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { matchMaker } from '@colyseus/core';
import { NetBot } from './netBot';
import { KAHVE_ROOM, KMSG, START_MONEY, TABLES, TURN_SECONDS, type MatchResultView, type TableView } from '@sokak/shared';
import { startServer, type StartedServer } from '../src/app';
import { until, sleep } from './helpers';
import type { KahvehaneRoom } from '../src/rooms/KahvehaneRoom';

const TURN_MS = 400;
let server: StartedServer;
let endpoint: string;

beforeAll(async () => {
  server = await startServer(0, { host: '127.0.0.1', kahve: { timing: { botMin: 5, botMax: 15, between: 150, result: 3000, turn: TURN_MS, biteMin: 1000, biteMax: 1200, biteWindow: 900 } } });
  endpoint = `ws://127.0.0.1:${server.port}`;
});
afterAll(async () => {
  await server.close();
});

const st = (b: NetBot) => b.room.state as any;
const me = (b: NetBot) => st(b).players.get(b.id);
const table = (b: NetBot, i: number) => st(b).tables[i];

async function seated(name: string, ti: number, seat: number) {
  const a = await new NetBot(endpoint).joinOrCreate(KAHVE_ROOM, { name });
  await until(() => !!st(a).players?.get(a.id));
  const room = matchMaker.getLocalRoomById(a.room.roomId) as KahvehaneRoom;
  room.debugPlace(a.id, TABLES[ti]!.x, TABLES[ti]!.z + 2);
  await sleep(80);
  a.room.send(KMSG.sit, { table: ti, seat });
  await until(() => me(a).table === ti);
  return { a, room };
}

describe('masa ayarları (table settings)', () => {
  it('only the host changes settings; invalid values are ignored', async () => {
    const { a } = await seated('Ev sahibi', 4, 0);
    const { a: b } = await seated('Misafir', 4, 1);
    expect(table(a, 4).hostId).toBe(a.id);
    expect(table(a, 4).partners).toBe(false);
    expect(table(a, 4).turnSecs).toBe(TURN_SECONDS);
    a.room.send(KMSG.tableConfig, { mode: 'esli', hands: 7, turn: 15, bet: 10 });
    await until(() => table(a, 4).partners === true);
    expect(table(a, 4).hands).toBe(7);
    expect(table(a, 4).turnSecs).toBe(15);
    expect(table(a, 4).bet).toBe(10);
    // garbage is ignored field by field
    a.room.send(KMSG.tableConfig, { mode: 'ikili', hands: 4, turn: 999, bet: 33 });
    a.room.send(KMSG.tableConfig, { mode: { x: 1 }, hands: '9', turn: -1 });
    await sleep(150);
    expect(table(a, 4).partners).toBe(true);
    expect(table(a, 4).hands).toBe(9); // numeric strings coerce like the existing bet/hands handling
    expect(table(a, 4).turnSecs).toBe(15);
    expect(table(a, 4).bet).toBe(10);
    // a guest cannot change anything
    b.room.send(KMSG.tableConfig, { mode: 'tekli', hands: 1, turn: 45, bet: 250 });
    await sleep(150);
    expect(table(a, 4).partners).toBe(true);
    expect(table(a, 4).hands).toBe(9);
    expect(table(a, 4).turnSecs).toBe(15);
    expect(table(a, 4).bet).toBe(10);
    a.room.send(KMSG.tableConfig, { mode: 'tekli', turn: 45 });
    await until(() => table(a, 4).partners === false && table(a, 4).turnSecs === 45);
    await b.leave();
    await a.leave();
  });

  it('eşli bot match: team scores, the losing team pays, the winners split the pot', async () => {
    const { a, room } = await seated('Esli', 5, 0);
    a.room.send(KMSG.tableConfig, { bet: 50, hands: 1, mode: 'esli', turn: 15 });
    for (let i = 0; i < 3; i++) a.room.send(KMSG.tableBot, {});
    await until(() => [...table(a, 5).seats].every((s: string) => s) && table(a, 5).partners === true);
    a.room.send(KMSG.tableStart);
    await until(() => table(a, 5).status === 'playing');
    expect(room.debugGame(5)!.partners).toBe(true);
    const view = JSON.parse(table(a, 5).view) as TableView;
    expect(view.partners).toBe(true);
    // the "Hızlı" turn time is half of the room's base timer
    expect(table(a, 5).turnEndsAt - Date.now()).toBeLessThanOrEqual((TURN_MS * 15) / TURN_SECONDS + 50);
    await until(() => table(a, 5).status === 'result', 60000);
    const hand = JSON.parse(table(a, 5).lastHand) as { scores: number[]; teams: number[]; finisher: number | null };
    expect(hand.teams).toEqual([hand.scores[0]! + hand.scores[2]!, hand.scores[1]! + hand.scores[3]!]);
    const m = JSON.parse(table(a, 5).lastMatch) as MatchResultView;
    const totals = [...table(a, 5).totals] as number[];
    expect(m.teams).toEqual([totals[0]! + totals[2]!, totals[1]! + totals[3]!]);
    if (m.winnerTeams!.length === 1) {
      const w = m.winnerTeams![0]!;
      expect(m.teams![w]).toBeLessThan(m.teams![1 - w]!);
      expect(m.winners.sort()).toEqual([w, w + 2]);
      for (let s = 0; s < 4; s++) expect(m.payout[s]).toBe(s % 2 === w ? 50 : -50);
    } else {
      expect(m.winners.length).toBe(4);
      expect(m.payout).toEqual([0, 0, 0, 0]);
    }
    const seated4 = [...st(a).players.values()].filter((p: any) => p.table === 5);
    expect(seated4.reduce((s: number, p: any) => s + p.money, 0)).toBe(START_MONEY * 4); // money is conserved
    await until(() => me(a).money === START_MONEY + m.payout[0]!);
    await until(() => me(a).played === 1);
    expect(me(a).won).toBe(m.winners.includes(0) ? 1 : 0);
    await a.leave();
  }, 70000);
});
