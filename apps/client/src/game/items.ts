import * as THREE from 'three';

/**
 * Small hand-held models for things bought at the market / simitçi.
 * Built around the grip point (origin), roughly life-size in metres.
 */
const mat = (color: number, roughness = 0.5, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness, ...extra });

export function itemModel(id: string): THREE.Group | null {
  const g = new THREE.Group();
  const add = (geo: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => {
    const o = new THREE.Mesh(geo, m);
    o.position.set(x, y, z);
    o.rotation.set(rx, ry, rz);
    g.add(o);
    return o;
  };
  switch (id) {
    case 'sigara': {
      // a lit cigarette between the fingers
      add(new THREE.CylinderGeometry(0.004, 0.004, 0.07, 6), mat(0xf4f1ea), 0, 0, 0.03, Math.PI / 2);
      add(new THREE.CylinderGeometry(0.0042, 0.0042, 0.02, 6), mat(0xd08a3a), 0, 0, -0.012, Math.PI / 2);
      const ember = add(new THREE.SphereGeometry(0.0045, 6, 4), new THREE.MeshBasicMaterial({ color: 0xff6a20 }), 0, 0, 0.066);
      ember.name = 'ember';
      break;
    }
    case 'su':
      add(new THREE.CylinderGeometry(0.03, 0.032, 0.2, 10), mat(0xbfe6ff, 0.1, { transparent: true, opacity: 0.7 }), 0, 0.06, 0);
      add(new THREE.CylinderGeometry(0.014, 0.014, 0.02, 8), mat(0x2f6fb0), 0, 0.17, 0);
      break;
    case 'gazoz':
      add(new THREE.CylinderGeometry(0.03, 0.034, 0.16, 10), mat(0x8fd18a, 0.1, { transparent: true, opacity: 0.85 }), 0, 0.05, 0);
      add(new THREE.CylinderGeometry(0.012, 0.03, 0.06, 10), mat(0x8fd18a, 0.1, { transparent: true, opacity: 0.85 }), 0, 0.16, 0);
      add(new THREE.CylinderGeometry(0.013, 0.013, 0.012, 8), mat(0xd8473b, 0.3), 0, 0.195, 0);
      break;
    case 'cekirdek':
      add(new THREE.ConeGeometry(0.05, 0.14, 10, 1, true), mat(0xe9dcc0, 0.9, { side: THREE.DoubleSide }), 0, 0.02, 0, Math.PI);
      for (let k = 0; k < 6; k++) add(new THREE.SphereGeometry(0.008, 5, 4), mat(0x2b2b2b), Math.sin(k) * 0.025, 0.09, Math.cos(k) * 0.025);
      break;
    case 'cikolata':
      add(new THREE.BoxGeometry(0.05, 0.11, 0.012), mat(0x7a3b1d, 0.4), 0, 0.04, 0);
      add(new THREE.BoxGeometry(0.052, 0.06, 0.014), mat(0x6c3fb5, 0.5), 0, 0.0, 0);
      break;
    case 'dondurma':
      add(new THREE.ConeGeometry(0.03, 0.11, 10), mat(0xd9a058, 0.8), 0, 0.0, 0, Math.PI);
      add(new THREE.SphereGeometry(0.035, 10, 8), mat(0xf7c6d9, 0.6), 0, 0.07, 0);
      add(new THREE.SphereGeometry(0.03, 10, 8), mat(0xfff4dc, 0.6), 0, 0.115, 0);
      break;
    case 'gazete':
      add(new THREE.BoxGeometry(0.2, 0.28, 0.01), mat(0xeeeae0, 0.9), 0, 0.08, 0);
      add(new THREE.BoxGeometry(0.16, 0.03, 0.012), mat(0x222222, 0.9), 0, 0.19, 0);
      break;
    case 'simit':
      add(new THREE.TorusGeometry(0.075, 0.024, 8, 18), mat(0xb8752f, 0.7), 0, 0.06, 0);
      break;
    case 'olta':
      return fishingRod(false);
    case 'cay': {
      add(new THREE.CylinderGeometry(0.05, 0.045, 0.008, 14), mat(0xffffff, 0.25), 0, -0.02, 0);
      // ince belli bardak: clear glass round a column of dark-red tea
      const tulip = (k: number, h: number) =>
        new THREE.LatheGeometry([new THREE.Vector2(0.001, 0), new THREE.Vector2(0.018 * k, 0), new THREE.Vector2(0.026 * k, 0.02 * h), new THREE.Vector2(0.02 * k, 0.05 * h), new THREE.Vector2(0.028 * k, 0.085 * h)], 12);
      add(tulip(0.9, 0.86), mat(0xa3260a, 0.12, { emissive: 0x3a0800 }), 0, -0.012, 0);
      const glass = add(tulip(1, 1), mat(0xffffff, 0.05, { transparent: true, opacity: 0.16, depthWrite: false }), 0, -0.015, 0);
      glass.renderOrder = 2;
      glass.castShadow = false;
      break;
    }
    default:
      return null;
  }
  g.traverse((o) => ((o as THREE.Mesh).castShadow = true));
  g.name = id;
  return g;
}

/** How an item is used (the arm motion), matches SHOP_ITEMS[].use. */
export type UseKind = 'smoke' | 'eat' | 'drink' | 'read' | 'fish';

/**
 * A fishing rod as held in a hand (the regulars' and the players'). The `tip` child marks
 * the end of the rod; players get a live line to their float instead of the hanging one.
 */
export function fishingRod(hangingLine = true): THREE.Group {
  const outer = new THREE.Group();
  // built with forward = +z, up = +y; this turns it into the hand frame of the 'fish' pose
  // (solved numerically: the rod then points out over the water, ~40° up)
  const g = new THREE.Group();
  g.rotation.set(1.7627, 0.344, -1.327);
  outer.add(g);
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.014, 2.6, 5), new THREE.MeshStandardMaterial({ color: 0x3b2a1c, roughness: 0.5 }));
  rod.position.set(0, 1.1, 0.5);
  rod.rotation.x = 1.1;
  rod.castShadow = true;
  const reel = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.03, 10), new THREE.MeshStandardMaterial({ color: 0x8a8f96, metalness: 0.6, roughness: 0.4 }));
  reel.position.set(0.03, 0.62, -0.42);
  reel.rotation.z = Math.PI / 2;
  const tip = new THREE.Object3D();
  tip.name = 'tip';
  // the cylinder's +y end after the tilt: centre + axis * half length
  tip.position.set(0, 1.1 + Math.cos(1.1) * 1.3, 0.5 + Math.sin(1.1) * 1.3);
  g.add(rod, reel, tip);
  if (hangingLine) {
    const line = new THREE.Mesh(new THREE.CylinderGeometry(0.002, 0.002, 2.2, 3), new THREE.MeshBasicMaterial({ color: 0xdddddd }));
    line.position.set(0, 1.25, 2.0);
    g.add(line);
  }
  return outer;
}
