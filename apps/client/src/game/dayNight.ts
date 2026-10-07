import * as THREE from 'three';

/**
 * Lighting keyframes of the day–night cycle over Üsküdar, sampled by game hour (see
 * `@sokak/shared` dayclock). The "evening" key (18:00–19:00) is the original fixed summer
 * evening look, value for value. Everything is sampled into one preallocated LightState
 * (no per-frame allocation); kahveWorld applies it a couple of times a second.
 */
export interface LightKey {
  h: number;
  /** direction towards the light: the sun by day, the moon at night */
  dir: readonly [number, number, number];
  sun: number;
  sunI: number;
  top: number;
  mid: number;
  horizon: number;
  /** sun disc + halo strength in the sky shader */
  glow: number;
  /** sun disc / halo colour in the sky */
  glowCol: number;
  bg: number;
  fog: number;
  fogNear: number;
  fogFar: number;
  hemiSky: number;
  hemiGround: number;
  hemiI: number;
  exposure: number;
  env: number;
  /** 0 day … 1 full night: stars, moon, floodlights, lamp pools, city lights, resting birds */
  night: number;
  /** multiplier on the emissive (lamp / window) materials */
  lamps: number;
  seaDeep: number;
  seaShallow: number;
  seaSky: number;
  /** sun / moon glitter on the water */
  seaGlint: number;
  /** tint over the painted skyline backdrop */
  skyline: number;
  bloom: number;
}

/** the moon (and the night's light direction): over the sea, right of Kız Kulesi from the sahil */
export const MOON_DIR: readonly [number, number, number] = [0.2, 0.42, 0.88];

const EVENING: Omit<LightKey, 'h'> = {
  dir: [-0.66, 0.24, 0.71],
  sun: 0xffb27a,
  sunI: 2.3,
  top: 0x4a5d9a,
  mid: 0xe98a6a,
  horizon: 0xffc690,
  glow: 1,
  glowCol: 0xffe1b3,
  bg: 0xe9a07a,
  fog: 0xe7a888,
  fogNear: 90,
  fogFar: 520,
  hemiSky: 0xffdcb8,
  hemiGround: 0x5a4a42,
  hemiI: 0.72,
  exposure: 1,
  env: 0.32,
  night: 0,
  lamps: 1,
  seaDeep: 0x173544,
  seaShallow: 0x27596a,
  seaSky: 0xb98a78,
  seaGlint: 0xffd9a0,
  skyline: 0xffffff,
  bloom: 0.28,
};

const NIGHT: Omit<LightKey, 'h'> = {
  dir: MOON_DIR,
  sun: 0x9fb4e0,
  sunI: 0.38,
  top: 0x03050c,
  mid: 0x0a1226,
  horizon: 0x222a44,
  glow: 0,
  glowCol: 0xffe1b3,
  bg: 0x0d1426,
  fog: 0x111a2c,
  fogNear: 60,
  fogFar: 430,
  hemiSky: 0x5a6c96,
  hemiGround: 0x1c1a16,
  hemiI: 0.3,
  exposure: 1.12,
  env: 0.12,
  night: 1,
  lamps: 1.6,
  seaDeep: 0x040a12,
  seaShallow: 0x0a1622,
  seaSky: 0x1a2440,
  seaGlint: 0xa8b8e0,
  skyline: 0x2a3150,
  bloom: 0.45,
};

const DUSK: Omit<LightKey, 'h'> = {
  dir: [-0.68, 0.08, 0.73],
  sun: 0xc88a9a,
  sunI: 0.6,
  top: 0x1c2753,
  mid: 0x63558a,
  horizon: 0xd8846a,
  glow: 0.35,
  glowCol: 0xff9a6a,
  bg: 0x5a5478,
  fog: 0x6a6080,
  fogNear: 80,
  fogFar: 480,
  hemiSky: 0x8a8ab8,
  hemiGround: 0x2e2a30,
  hemiI: 0.52,
  exposure: 1.06,
  env: 0.2,
  night: 0.6,
  lamps: 1.35,
  seaDeep: 0x0f2232,
  seaShallow: 0x1a3a4c,
  seaSky: 0x6a5a7a,
  seaGlint: 0xffb08a,
  skyline: 0x9a8ab0,
  bloom: 0.36,
};

const DAWN: Omit<LightKey, 'h'> = {
  dir: [0.4, 0.1, -0.9],
  sun: 0xffb8a0,
  sunI: 0.9,
  top: 0x3a4f80,
  mid: 0xc8a0b0,
  horizon: 0xffc8a8,
  glow: 0.6,
  glowCol: 0xffc8a0,
  bg: 0xd8b0b0,
  fog: 0xc8b4bc,
  fogNear: 90,
  fogFar: 520,
  hemiSky: 0xcfc8e0,
  hemiGround: 0x4a4448,
  hemiI: 0.6,
  exposure: 1,
  env: 0.26,
  night: 0.25,
  lamps: 1.1,
  seaDeep: 0x1a3848,
  seaShallow: 0x2c5a6c,
  seaSky: 0xa898b0,
  seaGlint: 0xffd0b8,
  skyline: 0xc0b8d0,
  bloom: 0.3,
};

const MORNING: Omit<LightKey, 'h'> = {
  dir: [0.45, 0.45, -0.77],
  sun: 0xfff0dc,
  sunI: 2.4,
  top: 0x3f78c8,
  mid: 0x8ab8e0,
  horizon: 0xd8e6f0,
  glow: 0.5,
  glowCol: 0xfff2dc,
  bg: 0xbcd4e8,
  fog: 0xc4d4e2,
  fogNear: 110,
  fogFar: 600,
  hemiSky: 0xd8e8ff,
  hemiGround: 0x6a5e50,
  hemiI: 0.8,
  exposure: 1,
  env: 0.38,
  night: 0,
  lamps: 0.55,
  seaDeep: 0x1d4a66,
  seaShallow: 0x2f6f88,
  seaSky: 0x9ab8d0,
  seaGlint: 0xfff4e0,
  skyline: 0xc8f0e0,
  bloom: 0.22,
};

const NOON: Omit<LightKey, 'h'> = {
  dir: [0.25, 0.92, 0.3],
  sun: 0xfff6ea,
  sunI: 2.6,
  top: 0x2f6cc4,
  mid: 0x7fb0e0,
  horizon: 0xcfe2f0,
  glow: 0.35,
  glowCol: 0xffffff,
  bg: 0xb8d2ea,
  fog: 0xc0d4e6,
  fogNear: 120,
  fogFar: 650,
  hemiSky: 0xdcecff,
  hemiGround: 0x6e6252,
  hemiI: 0.85,
  exposure: 0.95,
  env: 0.4,
  night: 0,
  lamps: 0.5,
  seaDeep: 0x1a4a68,
  seaShallow: 0x2e7090,
  seaSky: 0x9cbcd8,
  seaGlint: 0xffffff,
  skyline: 0xbff2d9,
  bloom: 0.2,
};

const AFTERNOON: Omit<LightKey, 'h'> = {
  dir: [-0.55, 0.5, 0.67],
  sun: 0xffe0b8,
  sunI: 2.5,
  top: 0x3a68b0,
  mid: 0x9ab4d4,
  horizon: 0xf0dcc0,
  glow: 0.6,
  glowCol: 0xffe8c8,
  bg: 0xd0c8c0,
  fog: 0xd4c4b8,
  fogNear: 100,
  fogFar: 560,
  hemiSky: 0xffe8d0,
  hemiGround: 0x625448,
  hemiI: 0.78,
  exposure: 1,
  env: 0.36,
  night: 0,
  lamps: 0.65,
  seaDeep: 0x18405a,
  seaShallow: 0x2a6478,
  seaSky: 0xb0a8a8,
  seaGlint: 0xffe8c8,
  skyline: 0xe4f0e4,
  bloom: 0.24,
};

/** sorted by hour; the first and last keys are the same night so midnight wraps seamlessly */
export const LIGHT_KEYS: readonly LightKey[] = [
  { h: 0, ...NIGHT },
  { h: 4.2, ...NIGHT },
  // the moon swings round to the east before sunrise (keeps the one light's turn gentle)
  { h: 5.0, ...NIGHT, dir: [0.7, 0.45, 0.05], night: 0.8, horizon: 0x4a4466, bg: 0x262c44 },
  { h: 5.7, ...DAWN },
  { h: 7.5, ...MORNING },
  { h: 13, ...NOON },
  { h: 16, ...AFTERNOON },
  { h: 18, ...EVENING },
  { h: 19, ...EVENING },
  { h: 20, ...DUSK },
  { h: 21, ...NIGHT },
  { h: 24, ...NIGHT },
];

export interface LightState {
  hour: number;
  dir: THREE.Vector3;
  sun: THREE.Color;
  sunI: number;
  top: THREE.Color;
  mid: THREE.Color;
  horizon: THREE.Color;
  glow: number;
  glowCol: THREE.Color;
  bg: THREE.Color;
  fog: THREE.Color;
  fogNear: number;
  fogFar: number;
  hemiSky: THREE.Color;
  hemiGround: THREE.Color;
  hemiI: number;
  exposure: number;
  env: number;
  night: number;
  lamps: number;
  seaDeep: THREE.Color;
  seaShallow: THREE.Color;
  seaSky: THREE.Color;
  seaGlint: THREE.Color;
  skyline: THREE.Color;
  bloom: number;
}

export function createLightState(): LightState {
  const c = () => new THREE.Color();
  return {
    hour: -1,
    dir: new THREE.Vector3(),
    sun: c(),
    sunI: 0,
    top: c(),
    mid: c(),
    horizon: c(),
    glow: 0,
    glowCol: c(),
    bg: c(),
    fog: c(),
    fogNear: 0,
    fogFar: 0,
    hemiSky: c(),
    hemiGround: c(),
    hemiI: 0,
    exposure: 1,
    env: 0,
    night: 0,
    lamps: 1,
    seaDeep: c(),
    seaShallow: c(),
    seaSky: c(),
    seaGlint: c(),
    skyline: c(),
    bloom: 0,
  };
}

const COLOR_KEYS = ['sun', 'top', 'mid', 'horizon', 'glowCol', 'bg', 'fog', 'hemiSky', 'hemiGround', 'seaDeep', 'seaShallow', 'seaSky', 'seaGlint', 'skyline'] as const;
const NUM_KEYS = ['sunI', 'glow', 'fogNear', 'fogFar', 'hemiI', 'exposure', 'env', 'night', 'lamps', 'bloom'] as const;
const _ca = new THREE.Color();
const _cb = new THREE.Color();

/** Interpolate the keyframes at game hour `hour` into `out` (smoothstep between neighbouring keys). */
export function sampleLight(hour: number, out: LightState): LightState {
  const h = ((hour % 24) + 24) % 24;
  let i = 0;
  while (i < LIGHT_KEYS.length - 2 && LIGHT_KEYS[i + 1]!.h <= h) i++;
  const a = LIGHT_KEYS[i]!;
  const b = LIGHT_KEYS[i + 1]!;
  const u = Math.min(1, Math.max(0, (h - a.h) / (b.h - a.h)));
  const k = u * u * (3 - 2 * u);
  out.hour = h;
  for (const n of NUM_KEYS) out[n] = a[n] + (b[n] - a[n]) * k;
  // colours blend in linear space (THREE.Color.setHex converts from sRGB)
  for (const n of COLOR_KEYS) out[n].copy(_ca.setHex(a[n])).lerp(_cb.setHex(b[n]), k);
  out.dir.set(a.dir[0] + (b.dir[0] - a.dir[0]) * k, a.dir[1] + (b.dir[1] - a.dir[1]) * k, a.dir[2] + (b.dir[2] - a.dir[2]) * k);
  if (out.dir.lengthSq() < 1e-6) out.dir.set(0, 1, 0);
  out.dir.normalize();
  return out;
}
