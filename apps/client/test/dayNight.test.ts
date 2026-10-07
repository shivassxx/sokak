import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { LIGHT_KEYS, createLightState, sampleLight } from '../src/game/dayNight';

const hex = (c: THREE.Color) => c.getHex();

describe('day–night lighting keyframes', () => {
  it('keys are sorted and midnight wraps seamlessly', () => {
    for (let i = 1; i < LIGHT_KEYS.length; i++) expect(LIGHT_KEYS[i]!.h).toBeGreaterThan(LIGHT_KEYS[i - 1]!.h);
    expect(LIGHT_KEYS[0]!.h).toBe(0);
    expect(LIGHT_KEYS[LIGHT_KEYS.length - 1]!.h).toBe(24);
    const a = sampleLight(23.999, createLightState());
    const b = sampleLight(0.001, createLightState());
    expect(a.sunI).toBeCloseTo(b.sunI, 5);
    expect(hex(a.top)).toBe(hex(b.top));
  });

  it('the evening key is the original fixed summer-evening look', () => {
    const L = sampleLight(18.5, createLightState());
    expect(hex(L.top)).toBe(0x4a5d9a);
    expect(hex(L.mid)).toBe(0xe98a6a);
    expect(hex(L.horizon)).toBe(0xffc690);
    expect(hex(L.bg)).toBe(0xe9a07a);
    expect(hex(L.fog)).toBe(0xe7a888);
    expect([L.fogNear, L.fogFar]).toEqual([90, 520]);
    expect(hex(L.sun)).toBe(0xffb27a);
    expect(L.sunI).toBe(2.3);
    expect(hex(L.hemiSky)).toBe(0xffdcb8);
    expect(hex(L.hemiGround)).toBe(0x5a4a42);
    expect(L.hemiI).toBe(0.72);
    expect(L.exposure).toBe(1);
    expect(L.env).toBe(0.32);
    expect(L.night).toBe(0);
    expect(L.lamps).toBe(1);
    expect(L.bloom).toBe(0.28);
    const d = new THREE.Vector3(-0.66, 0.24, 0.71).normalize();
    expect(L.dir.distanceTo(d)).toBeLessThan(1e-9);
  });

  it('night is dark, moonlit and bluish; midday is bright and high', () => {
    const n = sampleLight(23.5, createLightState());
    expect(n.night).toBe(1);
    expect(n.sunI).toBeLessThan(0.8);
    expect(n.sun.b).toBeGreaterThan(n.sun.r);
    expect(n.dir.y).toBeGreaterThan(0.2); // the moon is up: still one directional light
    expect(n.lamps).toBeGreaterThan(1.3);
    const d = sampleLight(13, createLightState());
    expect(d.night).toBe(0);
    expect(d.dir.y).toBeGreaterThan(0.8);
    expect(d.sunI).toBeGreaterThan(2.3);
  });

  it('changes smoothly (no jumps between neighbouring minutes)', () => {
    const a = createLightState();
    const b = createLightState();
    for (let h = 0; h < 24; h += 1 / 60) {
      sampleLight(h, a);
      sampleLight(h + 1 / 60, b);
      expect(Math.abs(a.sunI - b.sunI)).toBeLessThan(0.05);
      expect(a.dir.distanceTo(b.dir)).toBeLessThan(0.08);
      expect(Math.abs(a.night - b.night)).toBeLessThan(0.03);
      expect(Math.abs(a.top.r - b.top.r) + Math.abs(a.top.g - b.top.g) + Math.abs(a.top.b - b.top.b)).toBeLessThan(0.03);
    }
  });

  it('samples into the same objects (no allocation per update)', () => {
    const s = createLightState();
    const { dir, sun, top } = s;
    sampleLight(7, s);
    sampleLight(22, s);
    expect(s.dir).toBe(dir);
    expect(s.sun).toBe(sun);
    expect(s.top).toBe(top);
  });
});
