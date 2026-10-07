import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { WalletStore } from '../src/wallets';
import { istanbulWeek, previousWeek } from '../src/week';

const DAY = 86400000;
const tok = (i: number) => i.toString(16).padStart(2, '0').repeat(16);
/** Wednesday 7 Oct 2026, 12:00 Istanbul */
const WED = Date.UTC(2026, 9, 7, 9);

function store(start = WED, file: string | null = null) {
  const clock = { t: start };
  const s = new WalletStore(file, { now: () => clock.t });
  const join = (i: number) => s.set(tok(i), { money: 1000, lastBonus: clock.t, seen: clock.t });
  return { s, clock, join };
}

describe('istanbul weeks', () => {
  it('ISO week ids with Monday–Sunday in Istanbul time', () => {
    expect(istanbulWeek(WED)).toEqual({ id: '2026-W41', start: '2026-10-05', end: '2026-10-11' });
    // Sunday 23:59 Istanbul is still W41, Monday 00:00 Istanbul (Sunday 21:00 UTC) is W42
    expect(istanbulWeek(Date.UTC(2026, 9, 11, 20, 59)).id).toBe('2026-W41');
    expect(istanbulWeek(Date.UTC(2026, 9, 11, 21, 0)).id).toBe('2026-W42');
    // year boundaries: 1 Jan 2026 is a Thursday (W01), 1 Jan 2027 a Friday (still 2026-W53)
    expect(istanbulWeek(Date.UTC(2026, 0, 1, 12)).id).toBe('2026-W01');
    expect(istanbulWeek(Date.UTC(2027, 0, 1, 12)).id).toBe('2026-W53');
    expect(istanbulWeek(Date.UTC(2027, 0, 4, 12))).toEqual({ id: '2027-W01', start: '2027-01-04', end: '2027-01-10' });
    expect(previousWeek(Date.UTC(2027, 0, 4, 12)).id).toBe('2026-W53');
  });
});

describe('weekly leaderboard (wallet store)', () => {
  it('adds up net winnings, wins and matches; ranks by net, then wins', () => {
    const { s, join } = store();
    for (const i of [1, 2, 3]) join(i);
    s.recordMatch(tok(1), 'Ayşe', { won: true, net: 150 });
    s.recordMatch(tok(1), 'Ayşe', { won: false, net: -50 });
    s.recordMatch(tok(1), 'Ayşe', { won: false, net: -50 });
    s.recordMatch(tok(2), 'Mehmet', { won: false, net: -50 });
    s.recordMatch(tok(2), 'Mehmet', { won: true, net: 100 }); // net and wins equal to Ayşe: fewer matches first
    s.recordMatch(tok(3), 'Zeynep', { won: false, net: -100 });
    const b = s.weekly('current', tok(3));
    expect(b.week).toBe('2026-W41');
    expect(b.top).toEqual([
      { name: 'Mehmet', wins: 1, played: 2, net: 50 },
      { name: 'Ayşe', wins: 1, played: 3, net: 50 },
      { name: 'Zeynep', wins: 0, played: 1, net: -100 },
    ]);
    expect(b.me).toEqual({ rank: 3, name: 'Zeynep', wins: 0, played: 1, net: -100 });
    expect(b.champion).toBeNull();
    // the money balance is not touched by the leaderboard
    expect(s.get(tok(1))!.money).toBe(1000);
    // ties on net: more wins first
    join(4);
    s.recordMatch(tok(4), 'Can', { won: true, net: 50 });
    s.recordMatch(tok(4), 'Can', { won: true, net: 0 });
    expect(s.weekly().top[0]!.name).toBe('Can');
  });

  it('top 10 only; your own rank when you are further down; tokens never appear', () => {
    const { s, join } = store();
    for (let i = 1; i <= 14; i++) {
      join(i);
      s.recordMatch(tok(i), `Oyuncu ${i}`, { won: i % 2 === 0, net: 1000 - i * 100 });
    }
    const b = s.weekly('current', tok(13));
    expect(b.top.length).toBe(10);
    expect(b.top[0]!.name).toBe('Oyuncu 1');
    expect(b.me).toMatchObject({ rank: 13, name: 'Oyuncu 13', net: -300 });
    const json = JSON.stringify([b, s.weekly('last', tok(1))]);
    for (let i = 1; i <= 14; i++) expect(json).not.toContain(tok(i));
    // someone without a match this week has no rank; unknown devices get nothing
    join(20);
    expect(s.weekly('current', tok(20)).me).toBeNull();
    expect(s.weeklyRank(tok(2))).toBe(2);
    expect(s.recordMatch(tok(99), 'Hayalet', { won: true, net: 500 })).toBe(false);
    expect(s.recordMatch('not-a-token', 'X', { won: true, net: 500 })).toBe(false);
  });

  it('keeps the latest nickname', () => {
    const { s, join } = store();
    join(1);
    s.recordMatch(tok(1), 'Eski Ad', { won: true, net: 150 });
    s.recordMatch(tok(1), 'Yeni Ad', { won: false, net: -50 });
    expect(s.weekly().top).toEqual([{ name: 'Yeni Ad', wins: 1, played: 2, net: 100 }]);
  });

  it('rolls over on Monday 00:00 Istanbul: a fresh week, last week kept final, champion shown', () => {
    const { s, clock, join } = store();
    join(1);
    join(2);
    s.recordMatch(tok(1), 'Ayşe', { won: true, net: 300 });
    s.recordMatch(tok(2), 'Mehmet', { won: true, net: 100 });
    clock.t = Date.UTC(2026, 9, 11, 21, 0, 1); // Monday 00:00:01 Istanbul
    let b = s.weekly('current', tok(1));
    expect(b.week).toBe('2026-W42');
    expect(b.top).toEqual([]);
    expect(b.me).toBeNull();
    expect(b.champion).toEqual({ name: 'Ayşe', wins: 1, played: 1, net: 300 });
    // playing in the new week starts from zero and does not change last week's standings
    s.recordMatch(tok(1), 'Ayşe', { won: false, net: -50 });
    b = s.weekly('current', tok(1));
    expect(b.top).toEqual([{ name: 'Ayşe', wins: 0, played: 1, net: -50 }]);
    const last = s.weekly('last', tok(1));
    expect(last.week).toBe('2026-W41');
    expect(last.top.map((r) => [r.name, r.net])).toEqual([['Ayşe', 300], ['Mehmet', 100]]);
    expect(last.me).toMatchObject({ rank: 1, net: 300 });
    expect(last.champion).toBeUndefined();
    // a week later W41 is two weeks old: gone from both boards
    clock.t += 7 * DAY;
    expect(s.weekly('last').top).toEqual([{ name: 'Ayşe', wins: 0, played: 1, net: -50 }]);
    expect(s.weekly('current').top).toEqual([]);
    expect(s.weekly('current').champion?.name).toBe('Ayşe');
    s.recordMatch(tok(2), 'Mehmet', { won: true, net: 10 });
    expect(s.get(tok(2))!.week).toMatchObject({ id: '2026-W43', played: 1, net: 10 });
    expect(s.get(tok(2))!.prevWeek).toBeUndefined();
  });

  it('pruning on save/load keeps the boards consistent and drops old names', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'sokak-weekly-'));
    const file = path.join(dir, 'wallets.json');
    const { s, clock, join } = store(WED, file);
    join(1);
    join(2);
    s.recordMatch(tok(1), 'Ayşe', { won: true, net: 300 });
    s.recordMatch(tok(2), 'Mehmet', { won: true, net: 100 });
    clock.t += 2 * DAY;
    s.flush();
    // reloaded the same week: identical board
    const same = new WalletStore(file, { now: () => clock.t });
    expect(same.weekly()).toEqual(s.weekly());
    // reloaded next week: last week's board survives the restart
    const next = new WalletStore(file, { now: () => clock.t + 7 * DAY });
    expect(next.weekly('last').top.map((r) => r.name)).toEqual(['Ayşe', 'Mehmet']);
    expect(next.weekly().champion?.name).toBe('Ayşe');
    // two weeks later the stats (and the nicknames in them) are dropped from the file
    const later = new WalletStore(file, { now: () => clock.t + 14 * DAY });
    expect(later.weekly('last').top).toEqual([]);
    later.flush();
    const disk = JSON.parse(readFileSync(file, 'utf8')) as Record<string, object>;
    expect(Object.keys(disk).length).toBe(2);
    expect(JSON.stringify(disk)).not.toContain('Ayşe');
    expect(later.get(tok(1))!.money).toBe(1000);
    // wallets unseen for 60 days disappear with their stats
    const gone = new WalletStore(file, { now: () => clock.t + 61 * DAY });
    expect(gone.get(tok(1))).toBeNull();
  });
});
