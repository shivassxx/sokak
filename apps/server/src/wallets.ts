import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { accessoryById, bumpAchievement, ownedMask, sanitizeWear, type AchCounter, type AchievementDef, type AchState, type WeeklyBoard, type WeeklyLeader } from '@sokak/shared';
import { istanbulWeek, previousWeek } from './week';

/** One device's results in one ISO week (Istanbul time). */
export interface WeekStats {
  /** ISO week id, e.g. "2026-W41" */
  id: string;
  played: number;
  won: number;
  /** pot received minus bets paid */
  net: number;
  /** last nickname used in a finished match (already filtered by the room) */
  name: string;
}

/**
 * Play-money wallets keyed by an anonymous random device token (no account,
 * no personal data): the balance and when the daily bonus was last given.
 * For the weekly leaderboard a wallet also keeps this week's and last week's
 * match results together with the nickname last used; both are dropped as
 * soon as they are older than last week. Kept in memory and written to a
 * JSON file (debounced) when a file path is configured.
 */
export interface Wallet {
  money: number;
  lastBonus: number;
  seen: number;
  /** finished okey matches and wins (for the level) */
  played?: number;
  won?: number;
  /** last "veresiye" (so leaving and coming back doesn't skip the wait) */
  lastCredit?: number;
  /** today's mission progress (shared by every tab of the device) */
  missions?: { day: string; progress: Record<string, number> };
  /** weekly leaderboard: the most recent week with a finished match, and the one before it */
  week?: WeekStats;
  prevWeek?: WeekStats;
  /** başarımlar: counters and unlocked ids (see packages/shared/src/achievements.ts) */
  ach?: AchState;
  /** aksesuarlar: ids bought with play money, and the worn set (bitmask over ACCESSORIES) */
  acc?: string[];
  wear?: number;
  /** one-off gifts already given (bayram harçlığı), e.g. 'kurbanBayrami:2027' */
  gifts?: string[];
}

const KEEP_MS = 60 * 24 * 3600 * 1000;
const TOP = 10;
const MAX_NET = 10_000_000;

interface Ranked {
  token: string;
  s: WeekStats;
}

export class WalletStore {
  private data = new Map<string, Wallet>();
  private timer: NodeJS.Timeout | null = null;
  private version = 0;
  private cache = new Map<string, { version: number; list: Ranked[]; rank: Map<string, number> }>();
  private readonly now: () => number;

  /** `now` is injectable so tests can move through weeks. */
  constructor(private file: string | null, opts: { now?: () => number } = {}) {
    this.now = opts.now ?? Date.now;
    if (file && existsSync(file)) {
      try {
        const raw = JSON.parse(readFileSync(file, 'utf8')) as Record<string, Wallet>;
        for (const [k, w] of Object.entries(raw)) if (w && typeof w === 'object') this.data.set(k, w);
      } catch {
        /* corrupt file: start fresh */
      }
    }
    this.prune();
  }

  static validToken(t: unknown): t is string {
    return typeof t === 'string' && /^[a-f0-9]{24,64}$/i.test(t);
  }

  get(token: string): Wallet | null {
    return this.data.get(token) ?? null;
  }

  set(token: string, w: Wallet): void {
    this.data.set(token, { ...w, seen: this.now() });
    this.version++;
    this.scheduleSave();
  }

  /**
   * Count one finished match of a device for the weekly leaderboard (any game
   * mode can call this). `net` = pot received minus bets paid; `name` must
   * already be filtered. Needs an existing wallet (made when the device joins);
   * returns false when there is none.
   */
  recordMatch(token: string, name: string, r: { won: boolean; net: number }): boolean {
    const w = WalletStore.validToken(token) ? this.data.get(token) : undefined;
    if (!w) return false;
    const now = this.now();
    const { week, prevWeek } = this.currentWeeks(w, now);
    const cur: WeekStats = week ?? { id: istanbulWeek(now).id, played: 0, won: 0, net: 0, name: '' };
    const net = Number.isFinite(r.net) ? Math.round(r.net) : 0;
    this.set(token, {
      ...w,
      week: {
        id: cur.id,
        played: cur.played + 1,
        won: cur.won + (r.won ? 1 : 0),
        net: Math.max(-MAX_NET, Math.min(MAX_NET, cur.net + net)),
        name: String(name).slice(0, 24) || cur.name,
      },
      prevWeek,
    });
    return true;
  }

  /**
   * Count towards the device's achievements. Unlocks happen here, against the
   * stored record, so several tabs (or salons) of one device can never unlock or
   * pay the same achievement twice: the reward goes straight into the stored
   * wallet and the unlocked ones are returned (the caller mirrors the money into
   * its session). Needs an existing wallet; returns [] when there is none.
   */
  bumpAch(token: string, counter: AchCounter, n = 1): AchievementDef[] {
    const w = WalletStore.validToken(token) ? this.data.get(token) : undefined;
    if (!w) return [];
    const { state, unlocked } = bumpAchievement(w.ach, counter, n);
    const reward = unlocked.reduce((s, a) => s + a.reward, 0);
    this.set(token, { ...w, ach: state, money: Math.max(0, w.money) + reward });
    return unlocked;
  }

  /**
   * A one-off gift (bayram harçlığı), paid into the stored wallet at most once per key, so
   * several tabs or salons of one device get it once. Returns true when it was paid now.
   */
  giveGift(token: string, key: string, amount: number): boolean {
    const w = WalletStore.validToken(token) ? this.data.get(token) : undefined;
    if (!w || w.gifts?.includes(key) || !(amount > 0)) return false;
    // keep the last few keys only: one per festival and year is plenty
    this.set(token, { ...w, money: Math.max(0, w.money) + amount, gifts: [...(w.gifts ?? []), key].slice(-12) });
    return true;
  }

  /** Accessories a device owns (bought + earned), as a bitmask over ACCESSORIES. */
  accOwned(token: string): number {
    const w = WalletStore.validToken(token) ? this.data.get(token) : undefined;
    return w ? ownedMask(w.acc, w.ach?.got) : 0;
  }

  /**
   * Buy an accessory against the stored wallet, so two tabs of one device can
   * never pay twice: an item already owned (bought or earned) is refused, as is
   * one the stored balance cannot cover. Callers save their session's money
   * first and mirror the price on 'ok'.
   */
  buyAccessory(token: string, id: string): 'ok' | 'owned' | 'poor' | 'unknown' {
    const w = WalletStore.validToken(token) ? this.data.get(token) : undefined;
    const def = accessoryById(id);
    if (!w || !def || def.price <= 0) return 'unknown';
    if (ownedMask(w.acc, w.ach?.got) & ownedMask([id], [])) return 'owned';
    if (w.money < def.price) return 'poor';
    this.set(token, { ...w, money: w.money - def.price, acc: [...(w.acc ?? []), id] });
    return 'ok';
  }

  /** Remember what a device wears (only owned items, one per slot); returns the stored set. */
  setWear(token: string, mask: number): number {
    const w = WalletStore.validToken(token) ? this.data.get(token) : undefined;
    if (!w) return 0;
    const wear = sanitizeWear(mask, ownedMask(w.acc, w.ach?.got));
    if (wear !== (w.wear ?? 0)) this.set(token, { ...w, wear });
    return wear;
  }

  /** A device's achievement record (empty for an unknown device). */
  achievements(token: string): AchState {
    const a = WalletStore.validToken(token) ? this.data.get(token)?.ach : undefined;
    return { c: { ...(a?.c ?? {}) }, got: [...(a?.got ?? [])] };
  }

  /**
   * The weekly leaderboard: top 10 by net winnings (more wins first on ties),
   * the asking device's own rank, and for the current week last week's champion.
   * Device tokens never leave this method.
   */
  weekly(which: 'current' | 'last' = 'current', device?: string): WeeklyBoard {
    const now = this.now();
    const wk = which === 'last' ? previousWeek(now) : istanbulWeek(now);
    const board = this.board(wk.id);
    const row = (s: WeekStats): WeeklyLeader => ({ name: s.name, wins: s.won, played: s.played, net: s.net });
    const rank = device ? board.rank.get(device) : undefined;
    const out: WeeklyBoard = {
      week: wk.id,
      start: wk.start,
      end: wk.end,
      top: board.list.slice(0, TOP).map((r) => row(r.s)),
      me: rank ? { rank, ...row(board.list[rank - 1]!.s) } : null,
    };
    if (which === 'current') {
      const first = this.board(previousWeek(now).id).list[0];
      out.champion = first ? row(first.s) : null;
    }
    return out;
  }

  /** This device's place on the current week's leaderboard (0 = not on it). */
  weeklyRank(token: string): number {
    return this.board(istanbulWeek(this.now()).id).rank.get(token) ?? 0;
  }

  /** A wallet's week stats that still matter at `now`: this week's and last week's. */
  private currentWeeks(w: Wallet, now: number): { week?: WeekStats; prevWeek?: WeekStats } {
    const cur = istanbulWeek(now).id;
    const prev = previousWeek(now).id;
    const all = [w.week, w.prevWeek].filter((s): s is WeekStats => !!s && typeof s.id === 'string');
    return { week: all.find((s) => s.id === cur), prevWeek: all.find((s) => s.id === prev) };
  }

  private board(weekId: string): { list: Ranked[]; rank: Map<string, number> } {
    const hit = this.cache.get(weekId);
    if (hit && hit.version === this.version) return hit;
    const list: Ranked[] = [];
    for (const [token, w] of this.data) {
      const s = w.week?.id === weekId ? w.week : w.prevWeek?.id === weekId ? w.prevWeek : undefined;
      if (s && s.played > 0) list.push({ token, s });
    }
    list.sort((a, b) => b.s.net - a.s.net || b.s.won - a.s.won || a.s.played - b.s.played || a.s.name.localeCompare(b.s.name, 'tr'));
    const rank = new Map(list.map((r, i) => [r.token, i + 1]));
    const entry = { version: this.version, list, rank };
    // only the current and the previous week are ever asked for
    if (this.cache.size > 4) this.cache.clear();
    this.cache.set(weekId, entry);
    return entry;
  }

  /** Forget wallets unseen for 60 days and week stats older than last week (data minimisation). */
  private prune(): void {
    const now = this.now();
    let changed = false;
    for (const [k, w] of this.data) {
      if (now - (w.seen ?? 0) >= KEEP_MS) {
        this.data.delete(k);
        changed = true;
        continue;
      }
      if (!w.week && !w.prevWeek) continue;
      // stats are looked up by week id, so which field holds them does not matter
      const { week, prevWeek } = this.currentWeeks(w, now);
      if (week !== w.week || prevWeek !== w.prevWeek) {
        const keep: Wallet = { ...w };
        delete keep.week;
        delete keep.prevWeek;
        if (week) keep.week = week;
        if (prevWeek) keep.prevWeek = prevWeek;
        this.data.set(k, keep);
        changed = true;
      }
    }
    if (changed) this.version++;
  }

  private scheduleSave(): void {
    if (!this.file || this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.flush();
    }, 4000);
  }

  flush(): void {
    if (!this.file) return;
    this.prune();
    try {
      mkdirSync(path.dirname(this.file), { recursive: true });
      // write a temp file and rename it over the old one: a crash mid-write never leaves broken JSON
      const tmp = `${this.file}.tmp`;
      writeFileSync(tmp, JSON.stringify(Object.fromEntries(this.data)));
      renameSync(tmp, this.file);
    } catch {
      /* disk full / read-only: keep going in memory */
    }
  }
}
