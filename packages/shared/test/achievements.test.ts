import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS, ACH_GROUPS, achProgress, achievementById, bumpAchievement, type AchState } from '../src/achievements';

describe('başarımlar', () => {
  it('the list is well formed: unique ids, known groups, positive goals and small rewards', () => {
    const ids = ACHIEVEMENTS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ACHIEVEMENTS.length).toBeGreaterThanOrEqual(18);
    for (const a of ACHIEVEMENTS) {
      expect(ACH_GROUPS.some((g) => g.id === a.group)).toBe(true);
      expect(a.goal).toBeGreaterThanOrEqual(1);
      expect(a.reward).toBeGreaterThan(0);
      expect(a.reward).toBeLessThanOrEqual(1000);
      expect(a.title.length).toBeGreaterThan(0);
    }
  });

  it('counts up and unlocks exactly when the goal is reached', () => {
    let s: AchState | undefined;
    for (let i = 1; i <= 9; i++) {
      const r = bumpAchievement(s, 'okeyWon');
      expect(r.unlocked).toEqual([]);
      s = r.state;
    }
    expect(achProgress(s, achievementById('win10')!)).toEqual({ n: 9, done: false });
    const r = bumpAchievement(s, 'okeyWon');
    expect(r.unlocked.map((a) => a.id)).toEqual(['win10']);
    expect(r.state.c.okeyWon).toBe(10);
    expect(achProgress(r.state, achievementById('win10')!)).toEqual({ n: 10, done: true });
    expect(achProgress(r.state, achievementById('win50')!)).toEqual({ n: 10, done: false });
  });

  it('never unlocks (or pays) the same achievement twice', () => {
    const first = bumpAchievement(undefined, 'okeyPlayed');
    expect(first.unlocked.map((a) => a.id)).toEqual(['firstMatch']);
    const again = bumpAchievement(first.state, 'okeyPlayed');
    expect(again.unlocked).toEqual([]);
    expect(again.state.got).toEqual(['firstMatch']);
    expect(again.state.c.okeyPlayed).toBe(2);
  });

  it('a big step can unlock several tiers at once; bad input is ignored', () => {
    const r = bumpAchievement({ c: {}, got: [] }, 'okeyWon', 60);
    expect(r.unlocked.map((a) => a.id).sort()).toEqual(['win10', 'win50']);
    const bad = bumpAchievement({ c: { chat: 3 }, got: ['x', 5 as unknown as string] }, 'chat', Number.NaN);
    expect(bad.state.c.chat).toBe(3);
    expect(bad.state.got).toEqual(['x']);
    expect(bumpAchievement(undefined, 'chat', -5).state.c.chat).toBe(0);
  });

  it('does not mutate the stored state it was given', () => {
    const s: AchState = { c: { fish: 4 }, got: [] };
    const r = bumpAchievement(s, 'fish');
    expect(r.unlocked.map((a) => a.id)).toEqual(['fish5']);
    expect(s).toEqual({ c: { fish: 4 }, got: [] });
  });
});
