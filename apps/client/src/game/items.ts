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
    case 'cay': {
      add(new THREE.CylinderGeometry(0.05, 0.045, 0.008, 14), mat(0xffffff, 0.25), 0, -0.02, 0);
      add(
        new THREE.LatheGeometry([new THREE.Vector2(0.018, 0), new THREE.Vector2(0.026, 0.02), new THREE.Vector2(0.02, 0.05), new THREE.Vector2(0.028, 0.085)], 10),
        mat(0x9b2a14, 0.15),
        0,
        -0.015,
        0,
      );
      break;
    }
    default:
      return null;
  }
  g.traverse((o) => ((o as THREE.Mesh).castShadow = true));
  return g;
}

/** How an item is used (the arm motion), matches SHOP_ITEMS[].use. */
export type UseKind = 'smoke' | 'eat' | 'drink' | 'read';
