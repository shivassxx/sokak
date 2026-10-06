import * as THREE from 'three';

export interface Lighting {
  /** keep the shadow frustum centered on what the camera looks at */
  follow(x: number, z: number): void;
}

/** Warm summer-evening light: low sun, soft sky fill, fog. */
export function setupLighting(scene: THREE.Scene, renderer: THREE.WebGLRenderer): Lighting {
  const mobile = matchMedia('(pointer: coarse)').matches;
  scene.background = new THREE.Color(0xf6c58f);
  scene.fog = new THREE.Fog(0xf3c08e, 55, 150);

  const hemi = new THREE.HemisphereLight(0xffe2bd, 0x6a5a6e, 1.3);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xffc68a, 2.4);
  const offset = new THREE.Vector3(-30, 26, -18);
  sun.castShadow = true;
  const size = mobile ? 26 : 34;
  sun.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048);
  sun.shadow.camera.left = -size;
  sun.shadow.camera.right = size;
  sun.shadow.camera.top = size;
  sun.shadow.camera.bottom = -size;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 120;
  sun.shadow.bias = -0.0008;
  sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);
  renderer.shadowMap.autoUpdate = true;

  return {
    follow(x, z) {
      // snap to texel-ish grid to reduce shimmering
      const sx = Math.round(x / 2) * 2;
      const sz = Math.round(z / 2) * 2;
      sun.target.position.set(sx, 0, sz);
      sun.position.set(sx + offset.x, offset.y, sz + offset.z);
    },
  };
}
