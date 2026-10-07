import * as THREE from 'three';
import { Builder, hash } from './world';

/** Parked car styles: white "Doğan", yellow İstanbul taxi, blue "Şahin", red sedan. */
const CAR_PAINT = [0xeeeeea, 0xf2c12e, 0x2f5f9e, 0x9e2b25];

/**
 * A parked 1990s Turkish-street sedan (generic three-box shape, no brand): side profile
 * extruded across the car with rounded edges, a dark glass greenhouse under a painted roof,
 * bumpers, lamps, plates, mirrors and wheels with silver rims. Paint goes in the 'cars'
 * bucket (glossy clearcoat), tyres and trim in 'main'. Long axis along x (ry turns it).
 */
export function parkedCar(b: Builder, x: number, z: number, ry: number, tint: number, opts: { paint?: number; broken?: boolean } = {}): void {
  const broken = !!opts.broken;
  const paint = opts.paint ?? (broken ? 0xcdb682 : CAR_PAINT[tint % CAR_PAINT.length]!);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry);
  const place = (g: THREE.BufferGeometry, color: number, lx: number, ly: number, lz: number, bucket: 'cars' | 'main') => {
    m.compose(new THREE.Vector3(lx, ly, lz).applyQuaternion(q).add(new THREE.Vector3(x, 0, z)), q, new THREE.Vector3(1, 1, 1));
    b.addMatrix(g, color, m, bucket);
  };
  const W = 1.7;
  // lower body: bumper line to the waist, wheel arches cut out of the sill
  const body = new THREE.Shape();
  body.moveTo(2.1, 0.3);
  body.lineTo(1.7, 0.3);
  body.absarc(1.3, 0.33, 0.4, 0, Math.PI, false);
  body.lineTo(-0.9, 0.3);
  body.absarc(-1.3, 0.33, 0.4, 0, Math.PI, false);
  body.lineTo(-2.08, 0.3);
  body.lineTo(-2.12, 0.72);
  body.lineTo(-2.04, 0.96);
  body.lineTo(-1.32, 1.0);
  body.lineTo(1.0, 0.99);
  body.lineTo(2.0, 0.88);
  body.lineTo(2.13, 0.62);
  body.closePath();
  const ext = (sh: THREE.Shape, depth: number, bevel: number) => {
    const g = new THREE.ExtrudeGeometry(sh, { depth: depth - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 8 });
    g.translate(0, 0, -(depth - bevel * 2) / 2);
    return g;
  };
  place(ext(body, W, 0.07), paint, 0, 0, 0, 'cars');
  // greenhouse: dark glass, narrower than the body, under a painted roof
  const cabin = new THREE.Shape();
  cabin.moveTo(-1.36, 0.98);
  cabin.lineTo(-0.98, 1.36);
  cabin.lineTo(0.42, 1.38);
  cabin.lineTo(1.04, 0.98);
  cabin.closePath();
  place(ext(cabin, W - 0.22, 0.05), 0x1b232b, 0, 0, 0, 'cars');
  const roof = new THREE.Shape();
  roof.moveTo(-0.92, 1.35);
  roof.lineTo(0.38, 1.37);
  roof.lineTo(0.42, 1.41);
  roof.lineTo(-0.9, 1.4);
  roof.closePath();
  place(ext(roof, W - 0.2, 0.03), paint, 0, 0, 0, 'cars');
  // pillars between the side windows
  for (const s of [-1, 1]) place(new THREE.BoxGeometry(0.08, 0.4, 0.04), paint, -0.12, 1.17, s * (W / 2 - 0.12), 'cars');
  // bumpers, grille, lamps, plates
  for (const sx of [-1, 1]) {
    place(new THREE.BoxGeometry(0.12, 0.2, W + 0.04), 0x2b2d30, sx * 2.12, 0.4, 0, 'main');
    place(new THREE.BoxGeometry(0.03, 0.12, 0.5), 0xf4f4f4, sx * 2.19, 0.43, 0, 'main');
    for (const sz of [-1, 1]) place(new THREE.BoxGeometry(0.04, 0.13, 0.36), sx > 0 ? 0xe9eef2 : 0xb3241c, sx * 2.11, 0.7, sz * 0.58, 'cars');
  }
  place(new THREE.BoxGeometry(0.04, 0.14, 0.62), 0x1c1d1f, 2.12, 0.7, 0, 'main');
  for (const s of [-1, 1]) place(new THREE.BoxGeometry(0.12, 0.08, 0.1), paint, 0.92, 1.02, s * (W / 2 + 0.06), 'cars');
  // wheels: tyre, silver rim, dark hub
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      const tyre = new THREE.CylinderGeometry(0.31, 0.31, 0.2, 18);
      tyre.rotateX(Math.PI / 2);
      const flat = broken && sx > 0 && sz > 0 ? 0.08 : 0;
      place(tyre, 0x1a1a1a, sx * 1.3, 0.31 - flat, sz * (W / 2 - 0.13), 'main');
      const rim = new THREE.CylinderGeometry(0.19, 0.19, 0.21, 14);
      rim.rotateX(Math.PI / 2);
      if (!(broken && sx < 0)) place(rim, 0xc8ccd0, sx * 1.3, 0.31 - flat, sz * (W / 2 - 0.125), 'cars');
    }
  if (broken) {
    // the old wreck: rust patches, a primer-grey door, a flat tyre, weeds around it
    place(new THREE.BoxGeometry(0.9, 0.28, 0.02), 0x8a4a22, 0.4, 0.62, W / 2 + 0.06, 'main');
    place(new THREE.BoxGeometry(0.85, 0.5, 0.02), 0x8f9295, -0.2, 0.45, -W / 2 - 0.06, 'main');
    place(new THREE.BoxGeometry(0.5, 0.18, 0.02), 0x7a3f1d, -1.5, 0.5, -W / 2 - 0.06, 'main');
    place(new THREE.BoxGeometry(0.7, 0.03, 0.6), 0x7a3f1d, 1.5, 0.9, 0.2, 'main');
    for (let i = 0; i < 6; i++) b.blob(x + (hash(i) - 0.5) * 2.6, 0.15, z + (hash(i + 9) - 0.5) * 2.6, 0.25, 0x6aa84f, 0.7, 0, 'foliage');
  }
  if (!broken && paint === 0xf2c12e) {
    // TAKSİ roof light
    place(new THREE.BoxGeometry(0.22, 0.13, 0.55), 0xf6f2e2, -0.3, 1.47, 0, 'cars');
  }
}
