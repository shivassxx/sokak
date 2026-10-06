import * as THREE from 'three';
import { MAP_OBJECTS, MAP_HALF, BASE, BASE_RADIUS, type MapObject, type PropKind } from '@sokak/shared';

/** Greybox palette per prop kind (tints vary buildings / cars). */
const COLORS: Record<PropKind, number[]> = {
  ground: [0x8f8a80],
  boundary: [0xc9a27e],
  building: [0xe8c9a0, 0xd99c7b, 0xf1e3c4, 0xb9c7c9],
  shop: [0x6fa86b],
  kiosk: [0xc0533b],
  ebeWall: [0xd8573c],
  wall: [0xcbbfa8],
  fence: [0x7a5a3a],
  car: [0xd94b3b, 0x3b7bd9, 0xf2f0e8, 0x4caf6a],
  brokenCar: [0x9a8a5c],
  minibus: [0xf2d24b],
  crate: [0xb5793f],
  container: [0x3f6f52],
  trunk: [0x6b4a2f],
  canopy: [0x4f8f3f],
  bush: [0x5fa04a],
  step: [0xbdb5a6],
  slab: [0xbdb5a6],
  railing: [0x555a60],
  slide: [0xe0442f],
  table: [0x9b6a3f],
  stool: [0x7a5230],
  bench: [0x8a5a35],
  pole: [0x666a70],
  lamp: [0x3d4248],
  sheet: [0xf6f3ea, 0x9fd0f0, 0xf0b0c0],
};

export function buildWorld(scene: THREE.Scene): void {
  // ground: asphalt + sidewalk-ish center plaza
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(MAP_HALF * 2 + 2, MAP_HALF * 2 + 2),
    new THREE.MeshLambertMaterial({ color: 0x8c8780 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const plaza = new THREE.Mesh(new THREE.CircleGeometry(12, 40), new THREE.MeshLambertMaterial({ color: 0xc9b99a }));
  plaza.rotation.x = -Math.PI / 2;
  plaza.position.y = 0.01;
  plaza.receiveShadow = true;
  scene.add(plaza);

  const grass = new THREE.MeshLambertMaterial({ color: 0x7fb15a });
  for (const [x0, z0, x1, z1] of [
    [-60, 12, -12, 54],
    [18, 16, 46, 38],
  ]) {
    const g = new THREE.Mesh(new THREE.PlaneGeometry(x1! - x0!, z1! - z0!), grass);
    g.rotation.x = -Math.PI / 2;
    g.position.set((x0! + x1!) / 2, 0.015, (z0! + z1!) / 2);
    g.receiveShadow = true;
    scene.add(g);
  }

  // base marker ring
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(BASE_RADIUS - 0.25, BASE_RADIUS, 48),
    new THREE.MeshBasicMaterial({ color: 0xfff1a8, transparent: true, opacity: 0.85 }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(BASE.x, 0.03, BASE.z);
  scene.add(ring);

  // props: one InstancedMesh per (kind, tint)
  const groups = new Map<string, MapObject[]>();
  for (const o of MAP_OBJECTS) {
    const key = `${o.kind}:${o.tint ?? 0}`;
    let g = groups.get(key);
    if (!g) groups.set(key, (g = []));
    g.push(o);
  }
  const geo = new THREE.BoxGeometry(1, 1, 1);
  geo.translate(0, 0.5, 0);
  const m = new THREE.Matrix4();
  for (const [key, list] of groups) {
    const kind = key.split(':')[0] as PropKind;
    const palette = COLORS[kind];
    const color = palette[(list[0]!.tint ?? 0) % palette.length]!;
    const transparent = kind === 'canopy' || kind === 'bush';
    const mat = new THREE.MeshLambertMaterial({ color, transparent: false });
    const mesh = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach((o, i) => {
      m.makeScale(o.w, o.h, o.d);
      m.setPosition(o.x, o.y, o.z);
      mesh.setMatrixAt(i, m);
    });
    mesh.castShadow = kind !== 'boundary' && kind !== 'sheet';
    mesh.receiveShadow = !transparent;
    scene.add(mesh);
  }
}
