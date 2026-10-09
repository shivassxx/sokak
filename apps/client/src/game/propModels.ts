import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

/**
 * Realistic props (CC0 Poly Haven models packed into `public/models/props/*.glb`,
 * see Docs/ThirdPartyAssets.md), drawn as one InstancedMesh per primitive so a
 * model placed 18 times costs one draw call per material. Placement happens
 * as soon as the file arrives; the world never waits for it.
 */
export interface Placement {
  x: number;
  y: number;
  z: number;
  /** rotation about y */
  yaw?: number;
  /** uniform scale */
  s?: number;
}

// Draco (the decoder ships in public/draco) and meshopt: a prop can use either compression
const draco = new DRACOLoader().setDecoderPath(`${import.meta.env.BASE_URL}draco/`);
const loader = new GLTFLoader().setDRACOLoader(draco).setMeshoptDecoder(MeshoptDecoder);
const cache = new Map<string, Promise<THREE.Group>>();

function load(name: string): Promise<THREE.Group> {
  let p = cache.get(name);
  if (!p) {
    p = loader.loadAsync(`${import.meta.env.BASE_URL}models/props/${name}.glb`).then((g) => g.scene);
    cache.set(name, p);
  }
  return p;
}

export interface PropOptions {
  castShadow?: boolean;
  /** tweak each material once (e.g. make a bulb glow) */
  material?: (m: THREE.MeshStandardMaterial, meshName: string) => void;
}

/** Instance a prop at every placement; resolves to the group added to `parent`. */
export function placeProps(parent: THREE.Object3D, name: string, at: readonly Placement[], opts: PropOptions = {}): Promise<THREE.Group> {
  const out = new THREE.Group();
  out.name = `props:${name}`;
  parent.add(out);
  if (!at.length) return Promise.resolve(out);
  return load(name)
    .then((src) => {
      src.updateMatrixWorld(true);
      const place = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      const up = new THREE.Vector3(0, 1, 0);
      const m = new THREE.Matrix4();
      src.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        const mat = (mesh.material as THREE.MeshStandardMaterial).clone();
        opts.material?.(mat, mesh.name);
        const inst = new THREE.InstancedMesh(mesh.geometry, mat, at.length);
        at.forEach((p, i) => {
          const s = p.s ?? 1;
          place.compose(new THREE.Vector3(p.x, p.y, p.z), q.setFromAxisAngle(up, p.yaw ?? 0), new THREE.Vector3(s, s, s));
          inst.setMatrixAt(i, m.multiplyMatrices(place, mesh.matrixWorld));
        });
        inst.castShadow = opts.castShadow ?? false;
        inst.receiveShadow = true;
        inst.computeBoundingSphere();
        out.add(inst);
      });
      return out;
    })
    .catch((e) => {
      console.warn(`prop ${name} failed`, e);
      return out;
    });
}
