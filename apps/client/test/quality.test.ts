import { describe, expect, it } from 'vitest';
import { AutoTuner, guessTier, type Tier } from '../src/game/quality';

/** Feed `seconds` of frames at a steady fps; returns every tier change. */
function run(t: AutoTuner, fps: number, seconds: number): Tier[] {
  const out: Tier[] = [];
  const dt = 1 / fps;
  for (let i = 0; i < seconds * fps; i++) {
    const c = t.feed(dt);
    if (c) out.push(c);
  }
  return out;
}

describe('quality: device guess', () => {
  it('software renderers and weak phones start low, desktops high', () => {
    expect(guessTier({ touch: false, cores: 8, gpu: 'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device))' })).toBe('low');
    expect(guessTier({ touch: true, cores: 4, gpu: 'Mali-G52' })).toBe('low');
    expect(guessTier({ touch: true, cores: 8, gpu: 'Apple GPU' })).toBe('medium');
    expect(guessTier({ touch: false, cores: 8, gpu: 'Intel(R) UHD Graphics 620' })).toBe('medium');
    expect(guessTier({ touch: false, cores: 8, gpu: 'NVIDIA GeForce GTX 1050 Ti' })).toBe('high');
  });
});

describe('quality: automatic tuner', () => {
  it('keeps a steady 60 fps tier', () => {
    expect(run(new AutoTuner('high'), 60, 20)).toEqual([]);
  });

  it('steps down quickly when the first seconds are slow', () => {
    const t = new AutoTuner('high');
    const changes = run(t, 30, 6);
    expect(changes).toEqual(['medium']);
  });

  it('ignores a short dip later on', () => {
    const t = new AutoTuner('medium');
    run(t, 60, 15);
    expect(run(t, 35, 3)).toEqual([]);
    expect(run(t, 60, 5)).toEqual([]);
  });

  it('steps up only after a long steady run and never back to a tier that was too slow', () => {
    const t = new AutoTuner('medium');
    expect(run(t, 60, 20)).toEqual([]);
    expect(run(t, 60, 15)).toEqual(['high']);
    // high turns out slow → back to medium, and high is never tried again
    expect(run(t, 30, 10)).toEqual(['medium']);
    expect(run(t, 60, 120)).toEqual([]);
    expect(t.tier).toBe('medium');
  });

  it('goes all the way down on a very slow device and stops at low', () => {
    const t = new AutoTuner('high');
    expect(run(t, 20, 30)).toEqual(['medium', 'low']);
  });

  it('ignores single hitches (tab switches, shader compiles)', () => {
    const t = new AutoTuner('high');
    for (let k = 0; k < 20; k++) {
      expect(t.feed(3)).toBeNull();
      expect(run(t, 60, 1)).toEqual([]);
    }
  });

  it('still steps down when every frame takes seconds (software rendering)', () => {
    const t = new AutoTuner('high');
    const changes: Tier[] = [];
    for (let i = 0; i < 40; i++) {
      const c = t.feed(2);
      if (c) changes.push(c);
    }
    expect(changes).toEqual(['medium', 'low']);
  });
});
