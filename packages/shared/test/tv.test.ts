import { describe, expect, it } from 'vitest';
import { TV_BREAK_MS, TV_FULL_SHOW_MS, TV_HALF_MS, TV_TEAMS, TV_TOTAL_MS, tvBroadcastEnd, tvMatchAt, tvMinuteLabel, type TvBroadcast } from '../src/tv';

const T0 = 1_800_000_000_000;
const bc = (seed: number, id = `b${seed}`): TvBroadcast => ({ id, home: 'sarikirmizi', away: 'sarilacivert', startedAt: T0, seed, by: 'test' });

describe('tv derby simulation', () => {
  it('runs about 12 real minutes', () => {
    expect(TV_TOTAL_MS).toBe(2 * TV_HALF_MS + TV_BREAK_MS + TV_FULL_SHOW_MS);
    expect(TV_TOTAL_MS).toBeGreaterThanOrEqual(11 * 60_000);
    expect(TV_TOTAL_MS).toBeLessThanOrEqual(13 * 60_000);
    expect(tvBroadcastEnd(bc(1))).toBe(T0 + TV_TOTAL_MS);
  });

  it('is deterministic from the broadcast', () => {
    for (const at of [0, 1234, 90_000, TV_HALF_MS + 5000, TV_HALF_MS + TV_BREAK_MS + 100_000, TV_TOTAL_MS - 1]) {
      const a = tvMatchAt(bc(42), T0 + at);
      // interleave another broadcast so the cache is rebuilt in between
      tvMatchAt(bc(7), T0 + at);
      const b = tvMatchAt(bc(42), T0 + at);
      expect(b).toEqual(a);
    }
  });

  it('different seeds give different matches', () => {
    const a = tvMatchAt(bc(1), T0 + TV_TOTAL_MS - 1);
    const b = tvMatchAt(bc(2), T0 + TV_TOTAL_MS - 1);
    expect(JSON.stringify(a.events)).not.toBe(JSON.stringify(b.events));
  });

  it('has the phases at the right times', () => {
    const b = bc(3);
    expect(tvMatchAt(b, T0 - 1000).phase).toBe('pre');
    expect(tvMatchAt(b, T0 - 1000).clock).toBe("0'");
    expect(tvMatchAt(b, T0).phase).toBe('first');
    expect(tvMatchAt(b, T0).minute).toBe(1);
    expect(tvMatchAt(b, T0 + TV_HALF_MS / 2).minute).toBeGreaterThan(20);
    expect(tvMatchAt(b, T0 + TV_HALF_MS - 1).phase).toBe('first');
    expect(tvMatchAt(b, T0 + TV_HALF_MS).phase).toBe('half');
    expect(tvMatchAt(b, T0 + TV_HALF_MS).clock).toBe('İY');
    expect(tvMatchAt(b, T0 + TV_HALF_MS + TV_BREAK_MS).phase).toBe('second');
    expect(tvMatchAt(b, T0 + TV_HALF_MS + TV_BREAK_MS).minute).toBe(46);
    expect(tvMatchAt(b, T0 + 2 * TV_HALF_MS + TV_BREAK_MS).phase).toBe('full');
    expect(tvMatchAt(b, T0 + 2 * TV_HALF_MS + TV_BREAK_MS).clock).toBe('MS');
    expect(tvMatchAt(b, T0 + TV_TOTAL_MS - 1).done).toBe(false);
    expect(tvMatchAt(b, T0 + TV_TOTAL_MS).done).toBe(true);
    // home attacks right in the first half, left in the second
    expect(tvMatchAt(b, T0 + 1000).homeDir).toBe(1);
    expect(tvMatchAt(b, T0 + TV_HALF_MS + TV_BREAK_MS + 1000).homeDir).toBe(-1);
  });

  it('the minute never goes back and stoppage time is labelled', () => {
    const b = bc(4);
    let last = 0;
    for (let at = 0; at < TV_TOTAL_MS; at += 2000) {
      const m = tvMatchAt(b, T0 + at).minute;
      expect(m).toBeGreaterThanOrEqual(last);
      last = m;
    }
    expect(last).toBeGreaterThan(90);
    expect(tvMinuteLabel(47, 0)).toBe("45+2'");
    expect(tvMinuteLabel(34, 0)).toBe("34'");
    expect(tvMinuteLabel(93, 1)).toBe("90+3'");
  });

  it('the score always equals the goal events, and the match ends with the final whistle', () => {
    let goals = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const b = bc(seed);
      for (let at = 0; at <= TV_TOTAL_MS; at += 15_000) {
        const s = tvMatchAt(b, T0 + at);
        const g = [0, 1].map((team) => s.events.filter((e) => e.kind === 'goal' && e.team === team).length);
        expect(s.score).toEqual(g);
        expect(s.stats.possession[0] + s.stats.possession[1]).toBe(100);
        // a wide shot may end just past the goal line
        expect(s.ball.x).toBeGreaterThanOrEqual(-0.02);
        expect(s.ball.x).toBeLessThanOrEqual(1.02);
        expect(s.ball.y).toBeGreaterThanOrEqual(0);
        expect(s.ball.y).toBeLessThanOrEqual(1);
      }
      const end = tvMatchAt(b, T0 + TV_TOTAL_MS);
      expect(end.events.at(-1)!.kind).toBe('full');
      expect(end.events.filter((e) => e.kind === 'kickoff')).toHaveLength(2);
      expect(end.events.filter((e) => e.kind === 'half')).toHaveLength(1);
      // nothing happens after full time
      expect(tvMatchAt(b, T0 + TV_TOTAL_MS + 3_600_000).events).toEqual(end.events);
      for (const e of end.events.filter((x) => x.kind === 'goal')) {
        expect(end.lineups[e.team]).toContain(e.player);
        expect(e.text).toContain('GOOOL');
        expect(e.minute).toBeGreaterThanOrEqual(1);
      }
      goals += end.score[0] + end.score[1];
    }
    // plausible football scores: about 1.5–4.5 goals per match on average
    expect(goals / 40).toBeGreaterThan(1.5);
    expect(goals / 40).toBeLessThan(4.5);
  });

  it('shows the goal overlay for a few seconds after a goal', () => {
    let seed = 1;
    let goal: ReturnType<typeof tvMatchAt>['events'][number] | undefined;
    for (; seed < 50 && !goal; seed++) goal = tvMatchAt(bc(seed), T0 + TV_TOTAL_MS).events.find((e) => e.kind === 'goal');
    expect(goal).toBeDefined();
    const b = bc(seed - 1);
    expect(tvMatchAt(b, T0 + goal!.t - 1).goal?.t ?? -1).not.toBe(goal!.t);
    expect(tvMatchAt(b, T0 + goal!.t + 100).goal?.player).toBe(goal!.player);
    expect(tvMatchAt(b, T0 + goal!.t + 100).last?.kind).toBe('goal');
  });

  it('line-ups are 11 distinct surnames, different for each side', () => {
    const s = tvMatchAt(bc(9), T0 + 1000);
    const all = [...s.lineups[0], ...s.lineups[1]];
    expect(s.lineups[0]).toHaveLength(11);
    expect(new Set(all).size).toBe(22);
  });

  it('teams have no real club names', () => {
    for (const t of TV_TEAMS) expect(t.name).not.toMatch(/galatasaray|fenerbahçe|beşiktaş|trabzon|bursa/i);
  });
});
