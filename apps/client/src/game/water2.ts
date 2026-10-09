import * as THREE from 'three';
import { Water } from 'three/examples/jsm/objects/Water2.js';

/**
 * The high tier's Boğaz: three.js' Water2 (planar reflection + refraction + animated normals).
 * It renders the scene twice more per frame, so the medium/low tiers keep the cheap shader water.
 * The two normal maps are tileable noise made here (no download).
 */
function normalMap(seed: number, freq: number): THREE.CanvasTexture {
  const N = 256;
  const waves = Array.from({ length: 9 }, (_, i) => {
    const r = (k: number) => {
      const v = Math.sin((seed * 31 + i * 17 + k * 7.13) * 12.9898) * 43758.5453;
      return v - Math.floor(v);
    };
    return { fx: Math.round((r(1) - 0.5) * 2 * freq) || 1, fy: Math.round((r(2) - 0.5) * 2 * freq) || 1, ph: r(3) * 6.283, a: 0.4 + r(4) * 0.6 };
  });
  const h = new Float32Array(N * N);
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      let v = 0;
      for (const w of waves) v += w.a * Math.sin(((w.fx * x + w.fy * y) / N) * 6.2832 + w.ph);
      h[y * N + x] = v;
    }
  const cv = document.createElement('canvas');
  cv.width = cv.height = N;
  const ctx = cv.getContext('2d')!;
  const img = ctx.createImageData(N, N);
  const S = 2.2;
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const dx = h[y * N + ((x + 1) % N)]! - h[y * N + ((x + N - 1) % N)]!;
      const dy = h[((y + 1) % N) * N + x]! - h[((y + N - 1) % N) * N + x]!;
      const l = Math.hypot(dx * S, dy * S, 1);
      const i = (y * N + x) * 4;
      img.data[i] = ((-dx * S) / l) * 127 + 128;
      img.data[i + 1] = ((-dy * S) / l) * 127 + 128;
      img.data[i + 2] = (1 / l) * 127 + 128;
      img.data[i + 3] = 255;
    }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export function createWater2(): Water {
  const w = new Water(new THREE.PlaneGeometry(3000, 2000), {
    color: 0xb8d4dc,
    scale: 90,
    flowDirection: new THREE.Vector2(0.6, 0.8),
    flowSpeed: 0.02,
    reflectivity: 0.18,
    textureWidth: 512,
    textureHeight: 512,
    normalMap0: normalMap(1, 7),
    normalMap1: normalMap(2, 11),
  });
  w.userData.noAO = true;
  return w;
}
