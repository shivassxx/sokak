import * as THREE from 'three';
import { hash, type Mover } from './world';

/**
 * Street pigeons (rock doves): blue-grey bodies with the iridescent green-purple neck, dark
 * head, two black wing bars, a dark-banded tail and pink feet. They peck, wander and turn;
 * when someone comes close (closer still if they walk slowly) they take off, flap away and
 * glide back to land near where they live — no teleporting.
 */
let kit: { geos: Record<string, THREE.BufferGeometry>; mats: Record<string, THREE.Material> } | null = null;
function getKit() {
  if (kit) return kit;
  const sphere = (r: number, sx: number, sy: number, sz: number) => new THREE.SphereGeometry(r, 10, 8).scale(sx, sy, sz);
  kit = {
    geos: {
      body: sphere(0.12, 0.78, 0.78, 1.3),
      neck: sphere(0.07, 1, 1.1, 1),
      head: sphere(0.055, 1, 1, 1.05),
      beak: new THREE.ConeGeometry(0.014, 0.05, 5).rotateX(-Math.PI / 2),
      cere: sphere(0.012, 1, 0.7, 1.3),
      eye: sphere(0.011, 1, 1, 1),
      wing: sphere(0.1, 0.32, 0.22, 1.15),
      bar: new THREE.BoxGeometry(0.035, 0.012, 0.03),
      tail: new THREE.BoxGeometry(0.11, 0.02, 0.15),
      band: new THREE.BoxGeometry(0.112, 0.022, 0.03),
      leg: new THREE.CylinderGeometry(0.008, 0.008, 0.07, 4),
    },
    mats: {
      grey: new THREE.MeshStandardMaterial({ color: 0x8f98a6, roughness: 0.85 }),
      dark: new THREE.MeshStandardMaterial({ color: 0x5d6572, roughness: 0.85 }),
      neck: new THREE.MeshStandardMaterial({ color: 0x4f7d6c, roughness: 0.35, metalness: 0.45, emissive: 0x2a1838, emissiveIntensity: 0.4 }),
      black: new THREE.MeshStandardMaterial({ color: 0x23272d, roughness: 0.8 }),
      beak: new THREE.MeshStandardMaterial({ color: 0x3a3a3e, roughness: 0.6 }),
      cere: new THREE.MeshStandardMaterial({ color: 0xe9e6dc, roughness: 0.9 }),
      eye: new THREE.MeshStandardMaterial({ color: 0xe8862a, roughness: 0.3 }),
      feet: new THREE.MeshStandardMaterial({ color: 0xc8606a, roughness: 0.7 }),
    },
  };
  return kit;
}

function makePigeon(): THREE.Group {
  const { geos: G, mats: M } = getKit();
  const mesh = (g: string, m: string, x: number, y: number, z: number, parent: THREE.Object3D) => {
    const o = new THREE.Mesh(G[g], M[m]);
    o.position.set(x, y, z);
    o.castShadow = g === 'body';
    parent.add(o);
    return o;
  };
  const g = new THREE.Group();
  mesh('body', 'grey', 0, 0.14, 0, g);
  mesh('neck', 'neck', 0, 0.21, -0.1, g);
  const head = new THREE.Group();
  head.name = 'head';
  head.position.set(0, 0.27, -0.13);
  mesh('head', 'dark', 0, 0, 0, head);
  mesh('beak', 'beak', 0, -0.008, -0.07, head);
  mesh('cere', 'cere', 0, 0.005, -0.048, head);
  for (const s of [-1, 1]) mesh('eye', 'eye', s * 0.042, 0.012, -0.022, head);
  g.add(head);
  const wing = new THREE.Group();
  wing.name = 'wing';
  wing.position.y = 0.19;
  for (const s of [-1, 1]) {
    const w = new THREE.Group();
    w.position.set(s * 0.075, 0, 0.02);
    mesh('wing', 'grey', 0, 0, 0, w);
    for (const z of [0.0, 0.05]) mesh('bar', 'black', s * 0.01, 0.012, z, w);
    wing.add(w);
  }
  g.add(wing);
  const tail = mesh('tail', 'dark', 0, 0.16, 0.18, g);
  tail.rotation.x = -0.3;
  const band = mesh('band', 'black', 0, 0.141, 0.235, g);
  band.rotation.x = -0.3;
  for (const s of [-1, 1]) mesh('leg', 'feet', s * 0.035, 0.035, 0.0, g);
  return g;
}

interface Bird {
  g: THREE.Group;
  home: THREE.Vector3;
  t: number;
  state: 'ground' | 'fly' | 'land';
  timer: number;
  vel: THREE.Vector3;
  from: THREE.Vector3;
  to: THREE.Vector3;
  walk: THREE.Vector3 | null;
}

export class Pigeons {
  private birds: Bird[] = [];
  /** night: every other pigeon has gone to roost, the rest sit still with the head tucked in */
  resting = false;

  constructor(scene: THREE.Scene, homes: THREE.Vector3[]) {
    homes.forEach((home, i) => {
      const g = makePigeon();
      g.position.copy(home);
      g.rotation.y = hash(i * 7.3) * 6.28;
      scene.add(g);
      this.birds.push({ g, home: home.clone(), t: hash(i) * 10, state: 'ground', timer: 0, vel: new THREE.Vector3(), from: new THREE.Vector3(), to: new THREE.Vector3(), walk: null });
    });
  }

  update(dt: number, movers: readonly Mover[]): void {
    for (const [i, b] of this.birds.entries()) {
      b.t += dt;
      const wing = b.g.getObjectByName('wing')!;
      const head = b.g.getObjectByName('head')!;
      if (b.state === 'fly') {
        // flap away and climb, then turn back towards a landing spot near home
        b.timer -= dt;
        b.vel.y = Math.max(0.4, b.vel.y - dt * 1.2);
        b.g.position.addScaledVector(b.vel, dt);
        flap(wing, b.t, 30);
        if (b.timer <= 0) {
          b.state = 'land';
          b.timer = 0;
          b.from.copy(b.g.position);
          b.to.set(b.home.x + (hash(i + b.t) - 0.5) * 2.4, b.home.y, b.home.z + (hash(i * 3 + b.t) - 0.5) * 2.4);
          b.g.rotation.y = Math.atan2(-(b.to.x - b.from.x), -(b.to.z - b.from.z));
        }
        continue;
      }
      if (b.state === 'land') {
        // glide back on an arc, wings spread, a few beats just before touching down
        b.timer += dt / 3.2;
        const k = Math.min(1, b.timer);
        const e = k * k * (3 - 2 * k);
        b.g.position.lerpVectors(b.from, b.to, e);
        b.g.position.y += Math.sin(Math.PI * k) * 1.2;
        if (k > 0.8) flap(wing, b.t, 24);
        else glide(wing);
        if (k >= 1) {
          b.state = 'ground';
          b.g.position.copy(b.to);
          rest(wing);
        }
        continue;
      }
      // night: every other bird has gone to roost (hidden), the rest doze with the head tucked in
      b.g.visible = !(this.resting && i % 2 === 1);
      if (this.resting) {
        b.walk = null;
        head.position.set(0, 0.235, -0.1);
      } else if (b.walk) {
        // on the ground: peck, sometimes walk a few steps with the head bobbing, turn
        const d = b.walk.clone().sub(b.g.position).setY(0);
        const l = d.length();
        if (l < 0.05) b.walk = null;
        else {
          b.g.position.addScaledVector(d.normalize(), Math.min(l, dt * 0.45));
          b.g.rotation.y = Math.atan2(-d.x, -d.z);
          head.position.z = -0.13 - Math.max(0, Math.sin(b.t * 14)) * 0.035;
          head.position.y = 0.27;
        }
      } else {
        head.position.z = -0.13;
        head.position.y = 0.27 - Math.max(0, Math.sin(b.t * 3 + i)) * 0.09;
        if (hash(Math.floor(b.t * 0.5) * 13 + i) > 0.93) b.walk = new THREE.Vector3(b.home.x + (hash(b.t + i) - 0.5) * 2.5, b.home.y, b.home.z + (hash(b.t * 2 + i) - 0.5) * 2.5);
      }
      if (!b.g.visible) continue;
      for (const m of movers) {
        const dx = b.g.position.x - m.x;
        const dz = b.g.position.z - m.z;
        if (dx * dx + dz * dz < (m.speed > 3 ? 16 : 3)) {
          const l = Math.hypot(dx, dz) || 1;
          b.vel.set((dx / l) * 5 + (hash(i + b.t) - 0.5) * 2, 3.2, (dz / l) * 5 + (hash(i * 2 + b.t) - 0.5) * 2);
          b.g.rotation.y = Math.atan2(-b.vel.x, -b.vel.z);
          b.state = 'fly';
          b.timer = 2.2 + hash(i) * 1.2;
          b.walk = null;
          head.position.set(0, 0.27, -0.13);
          break;
        }
      }
    }
  }
}

function flap(wing: THREE.Object3D, t: number, rate: number): void {
  const a = Math.sin(t * rate) * 0.9;
  wing.children[0]!.rotation.z = 0.6 + a;
  wing.children[1]!.rotation.z = -0.6 - a;
  for (const w of wing.children) w.scale.set(2.4, 1, 1);
}
function glide(wing: THREE.Object3D): void {
  wing.children[0]!.rotation.z = 0.15;
  wing.children[1]!.rotation.z = -0.15;
  for (const w of wing.children) w.scale.set(2.6, 1, 1);
}
function rest(wing: THREE.Object3D): void {
  for (const w of wing.children) {
    w.rotation.z = 0;
    w.scale.set(1, 1, 1);
  }
}
