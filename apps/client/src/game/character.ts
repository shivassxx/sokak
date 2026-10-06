import * as THREE from 'three';

/** Simple low-poly kid built from primitives, with procedural animation. */
export type Emote = 'wave' | 'laugh' | 'dance' | 'point';

const SKIN = new THREE.MeshLambertMaterial({ color: 0xf0c49a });
const HAIR = new THREE.MeshLambertMaterial({ color: 0x3b2a20 });
const PANTS = new THREE.MeshLambertMaterial({ color: 0x34495e });
const SHOE = new THREE.MeshLambertMaterial({ color: 0x222222 });

const torsoGeo = new THREE.BoxGeometry(0.55, 0.6, 0.32);
const headGeo = new THREE.SphereGeometry(0.24, 12, 10);
const hairGeo = new THREE.SphereGeometry(0.25, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2);
const limbGeo = new THREE.BoxGeometry(0.17, 0.55, 0.17);
limbGeo.translate(0, -0.27, 0);
const legGeo = new THREE.BoxGeometry(0.2, 0.62, 0.22);
legGeo.translate(0, -0.31, 0);
const shoeGeo = new THREE.BoxGeometry(0.21, 0.1, 0.3);

const outfitCache = new Map<string, THREE.MeshLambertMaterial>();
function outfit(color: string): THREE.MeshLambertMaterial {
  let m = outfitCache.get(color);
  if (!m) outfitCache.set(color, (m = new THREE.MeshLambertMaterial({ color })));
  return m;
}

export class Character {
  readonly root = new THREE.Group();
  private body = new THREE.Group();
  private armL: THREE.Object3D;
  private armR: THREE.Object3D;
  private legL: THREE.Object3D;
  private legR: THREE.Object3D;
  private head: THREE.Object3D;
  private torso: THREE.Mesh;
  private walkPhase = 0;
  private emote: Emote | null = null;
  private emoteT = 0;
  private label: THREE.Sprite | null = null;
  facing = 0;

  constructor(color: string) {
    const mat = outfit(color);
    this.torso = new THREE.Mesh(torsoGeo, mat);
    this.torso.position.y = 1.15;
    this.head = new THREE.Group();
    this.head.position.y = 1.67;
    const headMesh = new THREE.Mesh(headGeo, SKIN);
    const hair = new THREE.Mesh(hairGeo, HAIR);
    hair.position.y = 0.03;
    this.head.add(headMesh, hair);
    const mkArm = (x: number) => {
      const g = new THREE.Group();
      g.position.set(x, 1.42, 0);
      const sleeve = new THREE.Mesh(limbGeo, mat);
      g.add(sleeve);
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 5), SKIN);
      hand.position.y = -0.58;
      g.add(hand);
      return g;
    };
    const mkLeg = (x: number) => {
      const g = new THREE.Group();
      g.position.set(x, 0.85, 0);
      g.add(new THREE.Mesh(legGeo, PANTS));
      const shoe = new THREE.Mesh(shoeGeo, SHOE);
      shoe.position.set(0, -0.62, 0.04);
      g.add(shoe);
      return g;
    };
    this.armL = mkArm(-0.36);
    this.armR = mkArm(0.36);
    this.legL = mkLeg(-0.13);
    this.legR = mkLeg(0.13);
    this.body.add(this.torso, this.head, this.armL, this.armR, this.legL, this.legR);
    this.root.add(this.body);
    this.root.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) o.castShadow = true;
    });
  }

  setColor(color: string): void {
    const mat = outfit(color);
    this.torso.material = mat;
    for (const arm of [this.armL, this.armR]) (arm.children[0] as THREE.Mesh).material = mat;
  }

  setLabel(text: string, color = '#ffffff'): void {
    if (this.label) {
      this.root.remove(this.label);
      (this.label.material as THREE.SpriteMaterial).map?.dispose();
      this.label.material.dispose();
    }
    const c = document.createElement('canvas');
    c.width = 384;
    c.height = 64;
    const ctx = c.getContext('2d')!;
    ctx.font = 'bold 30px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const w = Math.min(380, ctx.measureText(text).width + 24);
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath();
    ctx.roundRect(192 - w / 2, 10, w, 44, 14);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.fillText(text, 192, 33);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: true, transparent: true }));
    s.scale.set(2.4, 0.4, 1);
    s.position.y = 2.25;
    this.label = s;
    this.root.add(s);
  }

  playEmote(e: Emote): void {
    this.emote = e;
    this.emoteT = 0;
  }

  /** speed: horizontal m/s; crouch: pose; dt seconds */
  animate(dt: number, speed: number, crouch: boolean, airborne: boolean): void {
    const moving = speed > 0.3;
    if (moving) this.walkPhase += dt * speed * 2.2;
    const swing = moving ? Math.sin(this.walkPhase) * Math.min(1, speed / 4) * 0.8 : 0;
    this.legL.rotation.x = swing;
    this.legR.rotation.x = -swing;
    this.armL.rotation.set(-swing * 0.8, 0, 0);
    this.armR.rotation.set(swing * 0.8, 0, 0);
    this.body.position.y = crouch ? -0.45 : moving ? Math.abs(Math.cos(this.walkPhase)) * 0.05 : 0;
    this.body.rotation.x = crouch ? 0.35 : 0;
    this.body.rotation.y = 0;
    this.head.rotation.set(0, 0, 0);
    if (crouch) {
      this.legL.rotation.x = -1.1 + swing * 0.3;
      this.legR.rotation.x = -1.1 - swing * 0.3;
    }
    if (airborne) {
      this.armL.rotation.z = -0.6;
      this.armR.rotation.z = 0.6;
    }

    if (this.emote) {
      this.emoteT += dt;
      const t = this.emoteT;
      if (moving || t > 2.4) this.emote = null;
      else if (this.emote === 'wave') {
        this.armR.rotation.set(0, 0, 2.6 + Math.sin(t * 12) * 0.35);
      } else if (this.emote === 'laugh') {
        this.body.rotation.x = -0.15 + Math.sin(t * 22) * 0.06;
        this.head.rotation.x = -0.3;
        this.armL.rotation.z = -0.3;
        this.armR.rotation.z = 0.3;
      } else if (this.emote === 'dance') {
        this.body.position.y = Math.abs(Math.sin(t * 8)) * 0.18;
        this.body.rotation.y = Math.sin(t * 4) * 0.6;
        this.armL.rotation.set(0, 0, -2.4 - Math.sin(t * 8) * 0.4);
        this.armR.rotation.set(0, 0, 2.4 + Math.sin(t * 8) * 0.4);
      } else if (this.emote === 'point') {
        this.armR.rotation.set(-1.6, 0, 0);
        this.head.rotation.x = -0.1;
      }
    }
  }

  dispose(): void {
    if (this.label) {
      (this.label.material as THREE.SpriteMaterial).map?.dispose();
      this.label.material.dispose();
    }
  }
}
