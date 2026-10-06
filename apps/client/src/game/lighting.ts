import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

export interface Lighting {
  /** keep the shadow frustum centered on what the camera looks at */
  follow(x: number, z: number): void;
  /** 0 = golden late afternoon … 1 = blue hour */
  setDusk(d: number): void;
}

/** Warm summer-evening light: low sun, gradient sky, soft fill, fog. */
export function setupLighting(scene: THREE.Scene, renderer: THREE.WebGLRenderer): Lighting {
  const mobile = matchMedia('(pointer: coarse)').matches;

  // soft image-based fill so standard materials get gentle reflections
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.45;
  pmrem.dispose();

  // gradient sky dome
  const skyUniforms = {
    top: { value: new THREE.Color(0x6f8fd6) },
    horizon: { value: new THREE.Color(0xffc48a) },
  };
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(320, 24, 12),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: skyUniforms,
      vertexShader: 'varying float vH; void main(){ vH = normalize(position).y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader:
        'uniform vec3 top; uniform vec3 horizon; varying float vH; void main(){ float t = pow(clamp(vH,0.0,1.0), 0.55); gl_FragColor = vec4(mix(horizon, top, t), 1.0); }',
    }),
  );
  sky.renderOrder = -1;
  scene.add(sky);

  // low sun disc
  const sunDisc = new THREE.Mesh(new THREE.CircleGeometry(14, 24), new THREE.MeshBasicMaterial({ color: 0xffe2a0, fog: false }));
  sunDisc.position.set(-210, 55, -125);
  sunDisc.lookAt(0, 0, 0);
  scene.add(sunDisc);

  scene.fog = new THREE.Fog(0xf3c08e, 60, 170);

  const hemi = new THREE.HemisphereLight(0xffe2bd, 0x7a6a6e, 1.15);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xffc68a, 2.9);
  const offset = new THREE.Vector3(-30, 24, -18);
  sun.castShadow = true;
  const size = mobile ? 24 : 34;
  sun.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -size, right: size, top: size, bottom: -size, near: 1, far: 120 });
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.04;
  sun.shadow.radius = mobile ? 1 : 3;
  scene.add(sun, sun.target);

  const c = {
    sunA: new THREE.Color(0xffc68a),
    sunB: new THREE.Color(0xff8a5c),
    topA: new THREE.Color(0x7c9be0),
    topB: new THREE.Color(0x1b2352),
    horA: new THREE.Color(0xffc48a),
    horB: new THREE.Color(0xd9785e),
    fogA: new THREE.Color(0xf3c08e),
    fogB: new THREE.Color(0x6e5568),
  };

  return {
    follow(x, z) {
      const sx = Math.round(x / 2) * 2;
      const sz = Math.round(z / 2) * 2;
      sun.target.position.set(sx, 0, sz);
      sun.position.set(sx + offset.x, offset.y, sz + offset.z);
      sky.position.set(x, 0, z);
      sunDisc.position.set(x - 210, 55, z - 125);
    },
    setDusk(d) {
      sun.color.copy(c.sunA).lerp(c.sunB, d);
      sun.intensity = 2.9 - d * 2.3;
      hemi.intensity = 1.15 - d * 0.62;
      scene.environmentIntensity = 0.45 - d * 0.32;
      skyUniforms.top.value.copy(c.topA).lerp(c.topB, d);
      skyUniforms.horizon.value.copy(c.horA).lerp(c.horB, d);
      (scene.fog as THREE.Fog).color.copy(c.fogA).lerp(c.fogB, d);
      offset.y = 24 - d * 10;
    },
  };
}
