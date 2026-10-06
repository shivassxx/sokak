import { describe, expect, it } from 'vitest';
import { SaklambacRules, SCORE, DEFAULT_CONFIG, type GameEvent } from '../src';

const cfg = DEFAULT_CONFIG;
const types = (ev: GameEvent[]) => ev.map((e) => e.type);

/** rng returning a fixed sequence (index 0 → first player) */
const fixedRng = (v = 0) => () => v;

function game(n = 4, rng = fixedRng(0)) {
  const g = new SaklambacRules({}, rng);
  for (let i = 0; i < n; i++) g.addPlayer(`p${i}`);
  return g;
}

/** start and fast-forward into seeking */
function seeking(n = 4) {
  const g = game(n);
  g.start();
  g.tick(cfg.ebeSelectionMs);
  g.tick(cfg.countingMs);
  expect(g.phase).toBe('seeking');
  return g;
}

describe('lobby & start', () => {
  it('starts in lobby and needs min players', () => {
    const g = game(2);
    expect(g.phase).toBe('lobby');
    expect(g.canStart()).toBe(false);
    expect(g.start()).toEqual([]);
    g.addPlayer('p2');
    expect(g.canStart()).toBe(true);
  });

  it('start → ebeSelection with random Ebe and hiders', () => {
    const g = game(4, fixedRng(0.6));
    const ev = g.start();
    expect(types(ev)).toEqual(['phase', 'ebeChosen']);
    expect(g.phase).toBe('ebeSelection');
    expect(g.ebeId).toBe('p2');
    expect(g.round).toBe(1);
    expect(g.hiders().map((h) => h.id)).toEqual(['p0', 'p1', 'p3']);
    expect(g.hiders().every((h) => h.status === 'hiding')).toBe(true);
    expect(ev[1]).toMatchObject({ type: 'ebeChosen', id: 'p2', reason: 'random' });
  });

  it('Ebe is frozen during selection and counting only', () => {
    const g = game();
    g.start();
    expect(g.isFrozen('p0')).toBe(true);
    expect(g.isFrozen('p1')).toBe(false);
    g.tick(cfg.ebeSelectionMs);
    expect(g.phase).toBe('counting');
    expect(g.isFrozen('p0')).toBe(true);
    const ev = g.tick(cfg.countingMs);
    expect(types(ev)).toEqual(['countingDone', 'phase']);
    expect(g.isFrozen('p0')).toBe(false);
  });

  it('timers count down across ticks', () => {
    const g = game();
    g.start();
    g.tick(1000);
    expect(g.timeLeftMs).toBe(cfg.ebeSelectionMs - 1000);
    g.tick(cfg.ebeSelectionMs);
    expect(g.timeLeftMs).toBe(cfg.countingMs);
  });

  it('cannot spot or touch base outside seeking', () => {
    const g = game();
    g.start();
    g.tick(cfg.ebeSelectionMs);
    expect(g.spot('p1')).toEqual([]);
    expect(g.touchBase('p1')).toEqual([]);
  });
});

describe('seeking', () => {
  it('spot → race → Ebe touches base first → sobelendi', () => {
    const g = seeking();
    expect(types(g.spot('p1'))).toEqual(['spotted']);
    expect(g.get('p1')!.status).toBe('spotted');
    expect(types(g.touchBase('p0'))).toEqual(['caught']);
    expect(g.get('p1')!.status).toBe('caught');
    expect(g.get('p0')!.score).toBe(SCORE.catch);
  });

  it('spotted hider reaching base first → kurtuldu', () => {
    const g = seeking();
    g.spot('p1');
    expect(g.touchBase('p1')).toEqual([{ type: 'safe', id: 'p1', how: 'base' }]);
    expect(g.get('p1')!.score).toBe(SCORE.reachBase);
    // Ebe touching afterwards catches nobody
    expect(g.touchBase('p0')).toEqual([]);
  });

  it('unspotted hider can sneak to base', () => {
    const g = seeking();
    expect(types(g.touchBase('p2'))).toEqual(['safe']);
  });

  it('cannot spot a hider twice, the Ebe, or a caught/safe player', () => {
    const g = seeking();
    g.spot('p1');
    expect(g.spot('p1')).toEqual([]);
    expect(g.spot('p0')).toEqual([]);
    g.touchBase('p2');
    expect(g.spot('p2')).toEqual([]);
    expect(g.spot('nobody')).toEqual([]);
  });

  it('Ebe touching base catches every spotted hider; first caught is remembered', () => {
    const g = seeking(5);
    g.spot('p3');
    g.spot('p1');
    const ev = g.touchBase('p0');
    expect(ev.filter((e) => e.type === 'caught').map((e) => (e as { id: string }).id)).toEqual(['p1', 'p3']);
  });

  it('round ends when all hiders are caught or safe', () => {
    const g = seeking(4);
    g.spot('p1');
    g.touchBase('p0');
    g.touchBase('p2');
    g.spot('p3');
    const ev = g.touchBase('p0');
    expect(types(ev)).toEqual(['caught', 'roundEnd', 'phase']);
    expect(g.phase).toBe('roundEnd');
    const s = g.lastSummary!;
    expect(s.reason).toBe('allDone');
    expect(s.firstCaughtId).toBe('p1');
    expect(s.caught.sort()).toEqual(['p1', 'p3']);
    expect(s.safe).toEqual(['p2']);
    expect(s.nextEbeId).toBe('p1');
  });

  it('herkesi kurtarma: last hider frees everyone, same Ebe counts again', () => {
    const g = seeking(4);
    g.spot('p1');
    g.touchBase('p0');
    g.spot('p2');
    g.touchBase('p0');
    const ev = g.touchBase('p3');
    expect(types(ev)).toEqual(['safe', 'herkesKurtuldu', 'roundEnd', 'phase']);
    expect(ev[1]).toMatchObject({ by: 'p3', freed: ['p1', 'p2'] });
    expect(g.hiders().every((h) => h.status === 'safe')).toBe(true);
    expect(g.get('p3')!.score).toBe(SCORE.reachBase + SCORE.saveAll);
    expect(g.lastSummary!.herkesKurtuldu).toBe(true);
    expect(g.lastSummary!.nextEbeId).toBe('p0');
    g.tick(cfg.roundEndMs);
    expect(g.ebeId).toBe('p0');
  });

  it('last hider reaching base with nobody caught is not "herkes kurtuldu"', () => {
    const g = seeking(3);
    g.touchBase('p1');
    const ev = g.touchBase('p2');
    expect(types(ev)).toEqual(['safe', 'roundEnd', 'phase']);
    expect(g.lastSummary!.herkesKurtuldu).toBe(false);
  });

  it('timeout: remaining hiders count as safe and score survive points', () => {
    const g = seeking(4);
    g.spot('p1');
    g.touchBase('p0');
    g.spot('p2');
    const ev = g.tick(cfg.seekingMs);
    expect(types(ev)).toEqual(['safe', 'safe', 'roundEnd', 'phase']);
    expect(g.get('p2')!.status).toBe('safe');
    expect(g.get('p3')!.score).toBe(SCORE.survive);
    expect(g.lastSummary!.reason).toBe('timeout');
    expect(g.lastSummary!.nextEbeId).toBe('p1');
  });

  it('nobody caught → same Ebe again', () => {
    const g = seeking(3);
    g.tick(cfg.seekingMs);
    expect(g.lastSummary!.nextEbeId).toBe('p0');
    g.tick(cfg.roundEndMs);
    expect(g.ebeId).toBe('p0');
    expect(g.round).toBe(2);
  });

  it('summary: best hider (unseen longest) and longest survivor', () => {
    const g = seeking(4);
    g.tick(10000);
    g.spot('p1');
    g.tick(5000);
    g.touchBase('p0'); // p1 caught at 15 s
    g.tick(20000);
    g.spot('p2'); // p2 unseen 35 s
    g.tick(1000);
    g.touchBase('p2'); // safe
    g.tick(9000);
    g.touchBase('p3'); // p3 sneaks at 45 s (unseen 45 s)
    const s = g.lastSummary!;
    expect(s.bestHiderId).toBe('p3');
    expect(s.bestHiderMs).toBe(45000);
    expect(s.firstCaughtId).toBe('p1');
    // safe hiders stayed in play until the end
    expect(['p2', 'p3']).toContain(s.longestSurvivorId);
  });

  it('first caught hider becomes the next Ebe', () => {
    const g = seeking(4);
    g.spot('p2');
    g.touchBase('p0');
    g.tick(cfg.seekingMs);
    g.tick(cfg.roundEndMs);
    expect(g.phase).toBe('ebeSelection');
    expect(g.ebeId).toBe('p2');
    expect(g.get('p0')!.role).toBe('hider');
  });
});

describe('edge cases', () => {
  it('Ebe disconnects during seeking → round ends, new Ebe chosen at random', () => {
    const g = seeking(4);
    g.spot('p1');
    g.touchBase('p0');
    const ev = g.removePlayer('p0');
    expect(types(ev)).toEqual(['roundEnd', 'phase']);
    expect(g.lastSummary!.reason).toBe('ebeLeft');
    expect(g.lastSummary!.nextEbeId).toBeNull();
    g.tick(cfg.roundEndMs);
    expect(g.phase).toBe('ebeSelection');
    expect(g.ebeId).toBe('p1'); // fixed rng(0) → first remaining
  });

  it('Ebe disconnects during counting → round ends', () => {
    const g = game(4);
    g.start();
    g.tick(cfg.ebeSelectionMs);
    expect(types(g.removePlayer('p0'))).toEqual(['roundEnd', 'phase']);
  });

  it('player joining mid-round is a spectator, plays next round', () => {
    const g = seeking(3);
    g.addPlayer('late');
    expect(g.get('late')!.role).toBe('spectator');
    expect(g.spot('late')).toEqual([]);
    expect(g.touchBase('late')).toEqual([]);
    expect(g.activeHiders().map((h) => h.id)).not.toContain('late');
    g.tick(cfg.seekingMs);
    g.tick(cfg.roundEndMs);
    expect(['hider', 'ebe']).toContain(g.get('late')!.role);
  });

  it('last active hider leaving ends the round', () => {
    const g = seeking(3);
    g.touchBase('p1');
    const ev = g.removePlayer('p2');
    expect(types(ev)).toEqual(['roundEnd', 'phase']);
    expect(g.lastSummary!.reason).toBe('allDone');
  });

  it('too few players after round end → back to lobby', () => {
    const g = seeking(3);
    g.tick(cfg.seekingMs);
    g.removePlayer('p2');
    const ev = g.tick(cfg.roundEndMs);
    expect(types(ev)).toEqual(['phase']);
    expect(g.phase).toBe('lobby');
    expect(g.list().every((p) => p.role === 'none')).toBe(true);
  });

  it('next Ebe leaving during the break → random pick', () => {
    const g = seeking(4);
    g.spot('p3');
    g.touchBase('p0');
    g.tick(cfg.seekingMs);
    expect(g.lastSummary!.nextEbeId).toBe('p3');
    g.removePlayer('p3');
    g.tick(cfg.roundEndMs);
    expect(g.ebeId).toBe('p0');
  });

  it('removing unknown players and duplicate joins are no-ops', () => {
    const g = game(3);
    expect(g.removePlayer('ghost')).toEqual([]);
    g.addPlayer('p0');
    expect(g.players.size).toBe(3);
  });

  it('scores accumulate across rounds', () => {
    const g = seeking(3);
    g.touchBase('p1');
    g.tick(cfg.seekingMs);
    g.tick(cfg.roundEndMs);
    g.tick(cfg.ebeSelectionMs);
    g.tick(cfg.countingMs);
    g.touchBase('p1');
    expect(g.get('p1')!.score).toBe(SCORE.reachBase * 2);
  });

  it('toLobby resets roles', () => {
    const g = seeking(3);
    g.toLobby();
    expect(g.phase).toBe('lobby');
    expect(g.ebeId).toBeNull();
    expect(g.canStart()).toBe(true);
  });
});
