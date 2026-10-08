import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { KAHVE_ROOM, KMSG, START_MONEY, accMask, accessoryById } from '@sokak/shared';
import { NetBot } from './netBot';
import { startServer, type StartedServer } from '../src/app';
import { WalletStore } from '../src/wallets';
import { until, sleep } from './helpers';

let server: StartedServer;
let endpoint: string;

beforeAll(async () => {
  server = await startServer(0, { host: '127.0.0.1' });
  endpoint = `ws://127.0.0.1:${server.port}`;
});
afterAll(async () => {
  await server.close();
});

const st = (b: NetBot) => b.room.state as any;
const me = (b: NetBot) => st(b).players?.get(b.id);
const errors = (b: NetBot) => b.messages.filter((m) => m.type === KMSG.okeyError).map((m) => m.msg as string);
const bit = (id: string) => accMask([id]);
const accOf = async (device: string) =>
  (await (await fetch(`http://127.0.0.1:${server.port}/api/accessories?device=${device}`)).json()) as { owned: number; wear: number; money: number };

describe('aksesuarlar (wallet store)', () => {
  it('buys once, never twice, never on credit; earned items cannot be bought', () => {
    const store = new WalletStore(null);
    const dev = 'ac'.repeat(16);
    expect(store.buyAccessory(dev, 'kasket')).toBe('unknown');
    store.set(dev, { money: 500, lastBonus: 0, seen: 0 });
    expect(store.buyAccessory(dev, 'kasket')).toBe('ok');
    expect(store.get(dev)!.money).toBe(100);
    expect(store.buyAccessory(dev, 'kasket')).toBe('owned');
    expect(store.buyAccessory(dev, 'fotr')).toBe('poor');
    expect(store.buyAccessory(dev, 'tespih')).toBe('unknown');
    expect(store.get(dev)!.money).toBe(100);
    expect(store.accOwned(dev)).toBe(bit('kasket'));
    // wearing keeps owned items only
    expect(store.setWear(dev, accMask(['kasket', 'gunes']))).toBe(bit('kasket'));
    expect(store.get(dev)!.wear).toBe(bit('kasket'));
  });
});

describe('aksesuarlar (room)', () => {
  it('two tabs buying the same item pay once; other clients see what is worn', async () => {
    const device = 'ad'.repeat(16);
    const kasket = accessoryById('kasket')!;
    const a = await new NetBot(endpoint).create(KAHVE_ROOM, { name: 'Sekme', device });
    await until(() => !!me(a));
    const b = await new NetBot(endpoint).join(a.room.roomId, { name: 'SekmeIki', device });
    const watcher = await new NetBot(endpoint).join(a.room.roomId, { name: 'Bakan' });
    await until(() => !!me(b) && !!me(watcher));
    a.room.send(KMSG.accBuy, { id: 'kasket' });
    b.room.send(KMSG.accBuy, { id: 'kasket' });
    await until(() => (me(a).accOwned & bit('kasket')) !== 0 && (me(b).accOwned & bit('kasket')) !== 0);
    await sleep(200);
    const spent = START_MONEY - me(a).money + (START_MONEY - me(b).money);
    expect(spent).toBe(kasket.price);
    expect([...errors(a), ...errors(b)]).toContain('Bu sende zaten var.');
    // the buyer wears it right away and the third client's state shows it
    const buyer = me(a).acc & bit('kasket') ? a : b;
    await until(() => (st(watcher).players.get(buyer.id).acc & bit('kasket')) !== 0);
    // take it off / put it back on
    buyer.room.send(KMSG.accWear, { id: 'kasket', on: false });
    await until(() => st(watcher).players.get(buyer.id).acc === 0);
    await sleep(200);
    buyer.room.send(KMSG.accWear, { id: 'kasket', on: true });
    await until(() => st(watcher).players.get(buyer.id).acc === bit('kasket'));
    await a.leave();
    await b.leave();
    await sleep(150);
    const w = await accOf(device);
    expect(w.owned).toBe(bit('kasket'));
    expect(w.wear).toBe(bit('kasket'));
    expect(w.money).toBe(START_MONEY - kasket.price);
    await watcher.leave();
  });

  it('putting on an unowned item is rejected, also through the join look', async () => {
    const device = 'ae'.repeat(16);
    const a = await new NetBot(endpoint).create(KAHVE_ROOM, { name: 'Hevesli', device, acc: accMask(['fotr', 'gunes']) });
    await until(() => !!me(a));
    expect(me(a).acc).toBe(0);
    a.room.send(KMSG.accWear, { id: 'gunes', on: true });
    await until(() => errors(a).length > 0);
    expect(errors(a)[0]).toMatch(/sende yok/);
    expect(me(a).acc).toBe(0);
    // an earned-only item cannot be bought
    await sleep(450);
    a.room.send(KMSG.accBuy, { id: 'tespih' });
    await until(() => errors(a).length > 1);
    expect(me(a).accOwned).toBe(0);
    expect(me(a).money).toBe(START_MONEY);
    await a.leave();
  });

  it('an earned item (achievement) is owned and worn on the next visit', async () => {
    const device = 'af'.repeat(16);
    const a = await new NetBot(endpoint).create(KAHVE_ROOM, { name: 'Usta', device });
    await until(() => !!me(a));
    await a.leave();
    await sleep(100);
    for (let i = 0; i < 10; i++) server.wallets.bumpAch(device, 'okeyWon');
    const b = await new NetBot(endpoint).create(KAHVE_ROOM, { name: 'Usta', device, acc: accMask(['tespih']) });
    await until(() => !!me(b));
    expect(me(b).accOwned & bit('tespih')).toBeTruthy();
    expect(me(b).acc).toBe(bit('tespih'));
    await b.leave();
  });
});
