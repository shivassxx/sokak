import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { SKINS, type Look } from '@sokak/shared';
import { paintSkin, type Outfit } from './skinPainter';

/**
 * Rigged low-poly person (Kenney "Animated Characters" mesh, CC0) with a
 * procedurally painted skin texture (face, hair, outfit), 3D hair pieces and
 * hats on the head bone, and procedural animation: idle breathing, walk/run
 * cycles, sneak-crouch, jump, sitting, emotes and round poses.
 *
 * Animation is authored on a small virtual joint hierarchy (hips, chest,
 * neck, shoulders/elbows, hips/knees) whose axes match the character frame
 * (facing -Z); every frame the joint rotations are mapped onto the skeleton.
 */
export type Emote = 'wave' | 'laugh' | 'dance' | 'point';
export type Pose = 'none' | 'counting' | 'caught' | 'celebrate' | 'spotted' | 'sit' | 'sitThink' | 'drink' | 'read' | 'doze' | 'fish';

export interface CharacterOpts {
  /** grown-up proportions (kahvehane) instead of a neighborhood kid */
  adult?: boolean;
  /** NPC-only extras (moustache, bald, grey hair, waistcoat …) */
  extra?: Partial<Outfit>;
}

// ------------------------------------------------------------------ kit
interface Kit {
  scene: THREE.Object3D;
}
let kit: Kit | null = null;
let kitPromise: Promise<void> | null = null;

/** Load the shared character mesh once (≈30 KB gzip). */
export function loadCharacterKit(): Promise<void> {
  kitPromise ??= new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}models/character.glb`).then((g) => {
    g.scene.traverse((o) => {
      const m = o as THREE.SkinnedMesh;
      if (m.isSkinnedMesh) {
        m.castShadow = true;
        m.frustumCulled = false;
      }
    });
    kit = { scene: g.scene };
  });
  return kitPromise;
}

export function characterKitLoaded(): boolean {
  return kit !== null;
}

// ------------------------------------------------------------------ materials / geometry
const std = (color: number | string, roughness = 0.75) => new THREE.MeshStandardMaterial({ color, roughness, metalness: 0 });

const MAT = {
  hatRed: std(0xd8473b, 0.7),
  straw: std(0xe2c27a, 0.95),
  gold: new THREE.MeshStandardMaterial({ color: 0xf2c94c, roughness: 0.3, metalness: 0.7, side: THREE.DoubleSide }),
  band: std(0x2b2b2b, 0.6),
  white: std(0xf7f3ea, 0.7),
  glass: new THREE.MeshStandardMaterial({ color: 0x1c1c1c, roughness: 0.3, metalness: 0.4 }),
  bead: std(0x6d2a1e, 0.35),
};

const HAIR_COLORS = ['#3a2618', '#1c1714', '#6b3e1f', '#a5652a', '#d9b26a'];
const PANTS = ['#2f4a6d', '#3b3f46', '#6b5a43', '#1f2a3a', '#4a5a3a'];
const SHOES = ['#f4f1ea', '#d8473b', '#2f6fb0', '#3b3f46', '#e8b23a'];

const hairMats = new Map<string, THREE.MeshStandardMaterial>();
function hairMat(color: string): THREE.MeshStandardMaterial {
  let m = hairMats.get(color);
  if (!m) hairMats.set(color, (m = std(color, 0.9)));
  return m;
}

const G = {
  curl: new THREE.IcosahedronGeometry(0.1, 1),
  tail: new THREE.CapsuleGeometry(0.075, 0.2, 4, 8),
  tie: new THREE.SphereGeometry(0.06, 10, 8),
  spike: new THREE.ConeGeometry(0.07, 0.2, 6),
  bun: new THREE.SphereGeometry(0.12, 12, 10),
  capTop: new THREE.SphereGeometry(0.35, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.5),
  capBrim: new THREE.CylinderGeometry(0.22, 0.22, 0.025, 16, 1, false, 0, Math.PI),
  flatCap: new THREE.SphereGeometry(0.36, 18, 8, 0, Math.PI * 2, 0, Math.PI * 0.42),
  beanie: new THREE.SphereGeometry(0.35, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.55),
  pompom: new THREE.SphereGeometry(0.075, 10, 8),
  strawBrim: new THREE.CylinderGeometry(0.55, 0.55, 0.03, 24),
  strawTop: new THREE.CylinderGeometry(0.24, 0.3, 0.2, 18),
  strawBand: new THREE.CylinderGeometry(0.305, 0.305, 0.06, 18),
  crown: new THREE.CylinderGeometry(0.2, 0.22, 0.16, 10, 1, true),
  crownGem: new THREE.ConeGeometry(0.045, 0.1, 5),
  phoneBand: new THREE.TorusGeometry(0.36, 0.025, 6, 20, Math.PI),
  phoneCup: new THREE.CylinderGeometry(0.11, 0.11, 0.08, 14),
  lens: new THREE.TorusGeometry(0.075, 0.012, 6, 16),
  bridge: new THREE.CylinderGeometry(0.01, 0.01, 0.07, 5),
  bead: new THREE.SphereGeometry(0.018, 6, 5),
  marker: new THREE.ConeGeometry(0.16, 0.34, 4),
  blob: new THREE.CircleGeometry(0.42, 20),
};
G.capBrim.rotateY(Math.PI / 2);

const BLOB_MAT = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(0,0,0,0.45)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 });
})();

function mesh(g: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0, shadow = false): THREE.Mesh {
  const o = new THREE.Mesh(g, m);
  o.position.set(x, y, z);
  o.castShadow = shadow;
  return o;
}

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Everything about the painted outfit that follows from a Look. */
export function outfitFor(look: Look, opts: CharacterOpts = {}): Outfit {
  const h = hashStr(`${look.color}|${look.hair}|${look.skin}|${look.hat}`);
  return {
    skin: SKINS[look.skin] ?? SKINS[0],
    hair: HAIR_COLORS[(look.hair * 3 + look.skin + look.color.charCodeAt(2)) % HAIR_COLORS.length]!,
    hairStyle: look.hair,
    shirt: look.color,
    shirtStyle: h % 4,
    pants: PANTS[(h >>> 3) % PANTS.length]!,
    shoes: SHOES[(h >>> 6) % SHOES.length]!,
    kid: !opts.adult,
    moustache: false,
    bald: false,
    vest: null,
    apron: false,
    ...opts.extra,
  };
}

// ------------------------------------------------------------------ rig
type JointName = 'hips' | 'chest' | 'neck' | 'armL' | 'foreL' | 'armR' | 'foreR' | 'legL' | 'shinL' | 'legR' | 'shinR';
const BONE_OF: Record<JointName, string> = {
  hips: 'Hips',
  chest: 'Spine',
  neck: 'Neck',
  armL: 'LeftArm',
  foreL: 'LeftForeArm',
  armR: 'RightArm',
  foreR: 'RightForeArm',
  legL: 'LeftUpLeg',
  shinL: 'LeftLeg',
  legR: 'RightUpLeg',
  shinR: 'RightLeg',
};

interface Limb {
  upper: THREE.Object3D;
  lower: THREE.Object3D;
}

interface BoneInfo {
  bone: THREE.Bone;
  rest: THREE.Quaternion;
  /** rest orientation in the body frame */
  restWorld: THREE.Quaternion;
  joint: JointName | null;
  /** extra rotation that maps the rest pose into the joint's neutral pose (arms down) */
  base: THREE.Quaternion;
  /** scratch: current orientation in the body frame */
  world: THREE.Quaternion;
  children: BoneInfo[];
}

const _q2 = new THREE.Quaternion();

export class Character {
  readonly root = new THREE.Group();
  private body = new THREE.Group();
  /** virtual joints (no meshes), animated like a simple puppet */
  private hips = new THREE.Group();
  private chest = new THREE.Group();
  private neck = new THREE.Group();
  private armL: Limb;
  private armR: Limb;
  private legL: Limb;
  private legR: Limb;
  private jointObj: Record<JointName, THREE.Object3D>;
  private jointQ = new Map<JointName, THREE.Quaternion>();

  private model: THREE.Object3D;
  private skinned: THREE.SkinnedMesh;
  private boneRoot: BoneInfo;
  private parentRest = new THREE.Quaternion();
  private headBone: THREE.Bone;
  private handR: THREE.Bone | null;
  /** accessories live here: old "head units" (radius ≈ 0.31, facing -Z) */
  private headAnchor = new THREE.Group();
  private hatGroup = new THREE.Group();
  private hairGroup = new THREE.Group();
  private propGroup = new THREE.Group();
  private material: THREE.MeshStandardMaterial;
  private adult: boolean;
  private extra: Partial<Outfit> | undefined;
  /** standing hip height in metres (for sitting / crouching offsets) */
  readonly hipHeight: number;

  private marker: THREE.Mesh;
  private phase = 0;
  private t = Math.random() * 10;
  private emote: Emote | null = null;
  private emoteT = 0;
  private useKind: 'smoke' | 'eat' | 'drink' | 'read' | null = null;
  private useT = 0;
  private holding = false;
  private label: THREE.Sprite | null = null;
  private bubble: THREE.Sprite | null = null;
  private bubbleT = 0;
  private crouchAmt = 0;
  private airAmt = 0;
  private lean = 0;
  pose: Pose = 'none';
  facing = 0;
  /** id of the item currently held (managed by Game.setHeld) */
  userHeld = '';

  constructor(look: Look, opts: CharacterOpts = {}) {
    if (!kit) throw new Error('character kit not loaded');
    this.adult = !!opts.adult;
    this.extra = opts.extra;

    // virtual joint hierarchy: body(bob) → hips → (legs, chest → arms, neck)
    this.body.add(this.hips);
    this.hips.add(this.chest);
    this.chest.add(this.neck);
    const mkLimb = (parent: THREE.Object3D): Limb => {
      const upper = new THREE.Object3D();
      const lower = new THREE.Object3D();
      upper.add(lower);
      parent.add(upper);
      return { upper, lower };
    };
    this.armL = mkLimb(this.chest);
    this.armR = mkLimb(this.chest);
    this.legL = mkLimb(this.hips);
    this.legR = mkLimb(this.hips);
    this.jointObj = {
      hips: this.hips,
      chest: this.chest,
      neck: this.neck,
      armL: this.armL.upper,
      foreL: this.armL.lower,
      armR: this.armR.upper,
      foreR: this.armR.lower,
      legL: this.legL.upper,
      shinL: this.legL.lower,
      legR: this.legR.upper,
      shinR: this.legR.lower,
    };

    // the skinned model: faces +Z in the file, we face -Z
    this.model = cloneSkinned(kit.scene);
    const scale = this.adult ? 0.8 : 0.72;
    this.model.scale.setScalar(scale);
    this.model.rotation.y = Math.PI;
    this.body.add(this.model);
    let sk: THREE.SkinnedMesh | null = null;
    this.model.traverse((o) => {
      if ((o as THREE.SkinnedMesh).isSkinnedMesh) sk = o as THREE.SkinnedMesh;
    });
    if (!sk) throw new Error('character mesh missing');
    this.skinned = sk;
    this.material = new THREE.MeshStandardMaterial({ roughness: 0.78, metalness: 0 });
    this.material.onBeforeCompile = rimLight;
    this.material.customProgramCacheKey = () => 'char-rim';
    this.skinned.material = this.material;
    this.skinned.castShadow = true;

    this.model.updateMatrixWorld(true);
    const bones = this.skinned.skeleton.bones;
    const byName = new Map(bones.map((b) => [b.name, b]));
    this.headBone = byName.get('Head')!;
    this.handR = byName.get('RightHand') ?? null;
    if (!this.adult) this.headBone.scale.setScalar(1.1);

    // rest orientations in the body frame (root/body are still identity here)
    // the deform chain hangs off HipsCtrl (other top-level bones are IK controls)
    const topBone = byName.get('HipsCtrl') ?? bones.find((b) => !(b.parent as THREE.Bone | null)?.isBone)!;
    topBone.parent!.getWorldQuaternion(this.parentRest);
    const jointOfBone = new Map<string, JointName>();
    for (const [j, b] of Object.entries(BONE_OF)) jointOfBone.set(b, j as JointName);
    const hangDown = (b: THREE.Bone, tip: string): THREE.Quaternion => {
      const p0 = b.getWorldPosition(new THREE.Vector3());
      const p1 = byName.get(tip)!.getWorldPosition(new THREE.Vector3());
      const dir = p1.sub(p0).normalize();
      return new THREE.Quaternion().setFromUnitVectors(dir, new THREE.Vector3(0, -1, 0));
    };
    const baseArmL = hangDown(byName.get('LeftArm')!, 'LeftHand');
    const baseArmR = hangDown(byName.get('RightArm')!, 'RightHand');
    const build = (b: THREE.Bone): BoneInfo => {
      const joint = jointOfBone.get(b.name) ?? null;
      const info: BoneInfo = {
        bone: b,
        rest: b.quaternion.clone(),
        restWorld: b.getWorldQuaternion(new THREE.Quaternion()),
        joint,
        base: joint === 'armL' || joint === 'foreL' ? baseArmL : joint === 'armR' || joint === 'foreR' ? baseArmR : new THREE.Quaternion(),
        world: new THREE.Quaternion(),
        children: [],
      };
      for (const c of b.children) if ((c as THREE.Bone).isBone) info.children.push(build(c as THREE.Bone));
      return info;
    };
    this.boneRoot = build(topBone);
    const hipsBone = byName.get('Hips')!;
    this.hipHeight = hipsBone.getWorldPosition(new THREE.Vector3()).y;

    // accessories on the head bone; head-local box ≈ x ±0.44, y −0.09…1.07, z ±0.52 (front +Z)
    this.headAnchor.position.set(0, 0.62, -0.02);
    this.headAnchor.rotation.y = Math.PI;
    this.headAnchor.scale.set(1.45, 1.45, 1.62);
    this.headAnchor.add(this.hairGroup, this.hatGroup);
    this.headBone.add(this.headAnchor);
    if (this.handR) this.handR.add(this.propGroup);

    // "!" marker shown when spotted
    this.marker = mesh(G.marker, new THREE.MeshBasicMaterial({ color: 0xffc533 }), 0, 2.45, 0, false);
    this.marker.rotation.x = Math.PI;
    this.marker.visible = false;
    this.root.add(this.marker);

    const blob = new THREE.Mesh(G.blob, BLOB_MAT);
    blob.rotation.x = -Math.PI / 2;
    blob.position.y = 0.03;
    blob.renderOrder = 1;
    this.root.add(this.body, blob);
    this.setLook(look);
    this.applyRig();
  }

  /** Change outfit color, skin tone, hair style and hat. */
  setLook(look: Look): void {
    const outfit = outfitFor(look, { adult: this.adult, extra: this.extra });
    this.material.map = paintSkin(outfit);
    this.material.needsUpdate = true;
    this.buildHair(outfit, look.hat);
    this.buildHat(look.hat);
    this.buildExtras(outfit);
  }

  private buildHair(o: Outfit, hat: number): void {
    this.hairGroup.clear();
    if (o.bald) return;
    const hm = hairMat(o.hair);
    const add = (m: THREE.Mesh) => this.hairGroup.add(m);
    const covered = hat === 1 || hat === 2 || hat === 3;
    const style = o.hairStyle;
    if (style === 1 && !covered) {
      // curly: a crown of curls on top
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        const r = i % 2 ? 0.24 : 0.19;
        add(mesh(G.curl, hm, Math.sin(a) * r, 0.22 + (i % 3) * 0.03, Math.cos(a) * r + 0.03));
      }
      for (let i = 0; i < 5; i++) add(mesh(G.curl, hm, Math.sin(i * 1.3) * 0.08, 0.31, Math.cos(i * 1.3) * 0.08 + 0.03));
    } else if (style === 2) {
      const tail = mesh(G.tail, hm, 0, -0.02, 0.36);
      tail.rotation.x = 0.55;
      add(tail);
      add(mesh(G.tie, MAT.hatRed, 0, 0.1, 0.32));
    } else if (style === 3) {
      for (const s of [-1, 1]) {
        const braid = mesh(G.tail, hm, s * 0.27, -0.26, 0.1);
        braid.rotation.z = -s * 0.12;
        add(braid);
        add(mesh(G.tie, MAT.hatRed, s * 0.29, -0.45, 0.1));
      }
    } else if (style === 4 && !covered) {
      for (let i = 0; i < 11; i++) {
        const a = (i / 11) * Math.PI * 2;
        const sp = mesh(G.spike, hm, Math.sin(a) * 0.15, 0.3, Math.cos(a) * 0.15 + 0.04);
        sp.rotation.set(Math.cos(a) * 0.65, 0, -Math.sin(a) * 0.65);
        add(sp);
      }
      add(mesh(G.spike, hm, 0, 0.36, 0.03));
    }
    for (const c of this.hairGroup.children) c.castShadow = true;
  }

  private buildHat(hat: number): void {
    this.hatGroup.clear();
    const add = (o: THREE.Mesh) => {
      o.castShadow = true;
      this.hatGroup.add(o);
      return o;
    };
    switch (hat) {
      case 1: {
        if (this.adult) {
          // flat cap (kasket) the way the amcas wear it
          const top = add(mesh(G.flatCap, mat('#5b5348', 0.95), 0, 0.12, 0.02));
          top.scale.set(1.0, 0.75, 1.08);
          add(mesh(G.capBrim, mat('#5b5348', 0.95), 0, 0.14, -0.27)).scale.set(1, 1, 0.8);
        } else {
          const top = add(mesh(G.capTop, MAT.hatRed, 0, 0.06, 0.01));
          top.scale.set(1.01, 0.92, 1.01);
          add(mesh(G.capBrim, MAT.hatRed, 0, 0.09, -0.2));
        }
        break;
      }
      case 2: {
        add(mesh(G.beanie, mat('#2f6fb0', 0.95), 0, 0.06, 0.01)).scale.set(1, 0.9, 1);
        add(mesh(G.pompom, MAT.white, 0, 0.38, 0.02));
        break;
      }
      case 3:
        add(mesh(G.strawBrim, MAT.straw, 0, 0.2, 0)).rotation.x = 0.1;
        add(mesh(G.strawTop, MAT.straw, 0, 0.3, 0));
        add(mesh(G.strawBand, MAT.hatRed, 0, 0.24, 0));
        break;
      case 4:
        add(mesh(G.crown, MAT.gold, 0, 0.36, 0));
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2;
          add(mesh(G.crownGem, MAT.gold, Math.sin(a) * 0.2, 0.48, Math.cos(a) * 0.2));
        }
        break;
      case 5:
        add(mesh(G.phoneBand, MAT.band, 0, 0.02, 0));
        for (const s of [-1, 1]) add(mesh(G.phoneCup, MAT.hatRed, s * 0.34, 0, 0)).rotation.z = Math.PI / 2;
        break;
      default:
        break;
    }
  }

  private buildExtras(o: Outfit): void {
    // glasses for NPCs that read the paper, prayer beads in hand
    this.propGroup.clear();
    if (o.glasses) {
      for (const s of [-1, 1]) {
        const l = add(this.hatGroup, mesh(G.lens, MAT.glass, s * 0.1, 0.0, -0.33));
        l.scale.set(1, 0.85, 1);
      }
      add(this.hatGroup, mesh(G.bridge, MAT.glass, 0, 0.0, -0.335)).rotation.z = Math.PI / 2;
    }
    if (o.tespih) {
      for (let i = 0; i < 11; i++) {
        const a = (i / 11) * Math.PI * 2;
        this.propGroup.add(mesh(G.bead, MAT.bead, Math.sin(a) * 0.06, -0.12 + Math.cos(a) * 0.09, 0.02));
      }
    }
  }

  /** Put a small prop (tea glass …) in the right hand. */
  hold(obj: THREE.Object3D | null): void {
    for (const c of [...this.propGroup.children]) if (c.userData.held) this.propGroup.remove(c);
    this.holding = !!obj;
    if (!obj) return;
    obj.userData.held = true;
    // hand bone units: the model is scaled ≈0.5, so props are scaled up to stay life-size
    // stylised big hands: props are drawn ~1.6× life size so they read on screen
    const s = 1.6 / (this.model.scale.x * 0.64);
    obj.scale.setScalar(s);
    obj.position.set(0, 0.045 * s, 0.02 * s);
    obj.rotation.set(0, 0, Math.PI);
    this.propGroup.add(obj);
  }

  setLabelVisible(v: boolean): void {
    if (this.label) this.label.visible = v;
  }

  setLabel(text: string, color = '#ffffff'): void {
    if (this.label) {
      this.root.remove(this.label);
      (this.label.material as THREE.SpriteMaterial).map?.dispose();
      this.label.material.dispose();
    }
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 80;
    const ctx = c.getContext('2d')!;
    ctx.font = '800 34px "Baloo 2", "Trebuchet MS", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const w = Math.min(500, ctx.measureText(text).width + 32);
    ctx.fillStyle = 'rgba(20,14,10,0.55)';
    ctx.beginPath();
    ctx.roundRect(256 - w / 2, 12, w, 54, 27);
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.strokeText(text, 256, 40);
    ctx.fillStyle = color;
    ctx.fillText(text, 256, 40);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: true, transparent: true }));
    s.scale.set(2.6, 0.41, 1);
    s.position.y = 2.25;
    this.label = s;
    this.root.add(s);
  }

  /** Quick-chat speech bubble above the head for a few seconds. */
  say(text: string): void {
    this.clearBubble();
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 110;
    const ctx = c.getContext('2d')!;
    ctx.font = '800 36px "Baloo 2", "Trebuchet MS", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const w = Math.min(500, ctx.measureText(text).width + 44);
    ctx.fillStyle = '#f1e9d8';
    ctx.strokeStyle = '#2b2118';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.roundRect(256 - w / 2, 8, w, 72, 30);
    ctx.moveTo(240, 80);
    ctx.lineTo(256, 104);
    ctx.lineTo(272, 80);
    ctx.fill();
    ctx.stroke();
    ctx.fillRect(242, 72, 28, 10);
    ctx.fillStyle = '#2b2118';
    ctx.fillText(text, 256, 45);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
    s.scale.set(2.5, 0.54, 1);
    s.position.y = 2.6;
    s.renderOrder = 10;
    this.bubble = s;
    this.bubbleT = 3.2;
    this.root.add(s);
  }

  private clearBubble(): void {
    if (!this.bubble) return;
    this.root.remove(this.bubble);
    (this.bubble.material as THREE.SpriteMaterial).map?.dispose();
    this.bubble.material.dispose();
    this.bubble = null;
  }

  /** Bring the held item to the mouth (smoke / eat / drink) or hold it up to read. */
  playUse(kind: 'smoke' | 'eat' | 'drink' | 'read'): void {
    this.useKind = kind;
    this.useT = 0;
  }

  /** World position of the mouth (for smoke puffs). */
  mouthPosition(out = new THREE.Vector3()): THREE.Vector3 {
    this.headBone.updateWorldMatrix(true, false);
    return this.headBone.localToWorld(out.set(0, 0.25, 0.45));
  }

  playEmote(e: Emote): void {
    this.emote = e;
    this.emoteT = 0;
  }

  /**
   * speed: horizontal m/s; crouch / airborne flags; dt seconds.
   * Everything eases so network jitter never snaps a pose.
   */
  animate(dt: number, speed: number, crouch: boolean, airborne: boolean): void {
    this.t += dt;
    if (this.bubble && (this.bubbleT -= dt) <= 0) this.clearBubble();
    const k = Math.min(1, dt * 10);
    this.crouchAmt += ((crouch ? 1 : 0) - this.crouchAmt) * k;
    this.airAmt += ((airborne ? 1 : 0) - this.airAmt) * Math.min(1, dt * 14);
    const moving = speed > 0.3;
    const run = Math.min(1, Math.max(0, (speed - 3) / 3)); // 0 walk … 1 sprint
    const stride = moving ? Math.min(1, speed / 4) : 0;
    if (moving) this.phase += dt * (5 + speed * 1.15);
    const s = Math.sin(this.phase);
    const c = Math.cos(this.phase);
    const cr = this.crouchAmt;
    const idle = moving ? 0 : 1;

    // legs: hip swing + knee bend on the back-swing
    const amp = (0.55 + run * 0.35) * stride * (1 - cr * 0.5);
    this.legL.upper.rotation.set(s * amp + cr * 1.05, 0, -0.03);
    this.legR.upper.rotation.set(-s * amp + cr * 1.05, 0, 0.03);
    this.legL.lower.rotation.set(-(Math.max(0, -c) * (0.7 + run * 0.6) * stride + cr * 1.75), 0, 0);
    this.legR.lower.rotation.set(-(Math.max(0, c) * (0.7 + run * 0.6) * stride + cr * 1.75), 0, 0);

    // arms swing opposite to legs, elbows bend more when running; idle sway
    const aamp = (0.5 + run * 0.6) * stride;
    const sway = Math.sin(this.t * 1.6) * 0.03 * idle;
    this.armL.upper.rotation.set(-s * aamp + cr * 0.35 + sway, 0, -0.1 - idle * 0.02);
    this.armR.upper.rotation.set(s * aamp + cr * 0.35 - sway, 0, 0.1 + idle * 0.02);
    this.armL.lower.rotation.set(0.2 + run * 1.0 + cr * 0.8, 0, 0);
    this.armR.lower.rotation.set(0.2 + run * 1.0 + cr * 0.8, 0, 0);

    // body: bob, forward lean, breathing, crouch drop
    const breathe = Math.sin(this.t * 2.2) * 0.02 * idle;
    const bob = moving ? Math.abs(c) * (0.035 + run * 0.05) : 0;
    this.lean += ((moving ? 0.08 + run * 0.16 : 0) + cr * 0.32 - this.lean) * k;
    this.body.position.y = bob - cr * 0.33;
    this.hips.rotation.set(0, moving ? -s * 0.08 : 0, 0);
    this.chest.rotation.set(-this.lean + breathe, moving ? s * 0.14 : 0, 0);
    this.neck.rotation.set(this.lean * 0.6, 0, 0);
    this.body.rotation.set(0, 0, 0);

    // airborne: tuck legs, arms up
    if (this.airAmt > 0.01) {
      const a = this.airAmt;
      this.legL.upper.rotation.x += 0.6 * a;
      this.legR.upper.rotation.x += -0.2 * a;
      this.legL.lower.rotation.x -= 0.9 * a;
      this.legR.lower.rotation.x -= 0.4 * a;
      this.armL.upper.rotation.z = -0.12 - 1.2 * a;
      this.armR.upper.rotation.z = 0.12 + 1.2 * a;
    }

    this.applyPose(moving);
    this.applyEmote(dt, moving);
    this.applyUse(dt);
    this.applyRig();
  }

  /** Map the virtual joints onto the skeleton (no allocations: runs for every character every frame). */
  private applyRig(): void {
    const q = this.jointQ;
    const get = (name: JointName, o: THREE.Object3D, parent: JointName | null) => {
      let r = q.get(name);
      if (!r) q.set(name, (r = new THREE.Quaternion()));
      r.setFromEuler(o.rotation);
      if (parent) r.premultiply(q.get(parent)!);
    };
    get('hips', this.hips, null);
    get('chest', this.chest, 'hips');
    get('neck', this.neck, 'chest');
    get('armL', this.armL.upper, 'chest');
    get('foreL', this.armL.lower, 'armL');
    get('armR', this.armR.upper, 'chest');
    get('foreR', this.armR.lower, 'armR');
    get('legL', this.legL.upper, 'hips');
    get('shinL', this.legL.lower, 'legL');
    get('legR', this.legR.upper, 'hips');
    get('shinR', this.legR.lower, 'legR');
    this.applyBone(this.boneRoot, this.parentRest);
  }

  private applyBone(info: BoneInfo, parentWorld: THREE.Quaternion): void {
    const world = info.world;
    if (info.joint) {
      // desired orientation in the body frame: joint rotation ∘ neutral pose ∘ rest
      world.copy(this.jointQ.get(info.joint)!).multiply(info.base).multiply(info.restWorld);
      _q2.copy(parentWorld).invert();
      info.bone.quaternion.copy(_q2.multiply(world));
    } else {
      info.bone.quaternion.copy(info.rest);
      world.copy(parentWorld).multiply(info.rest);
    }
    for (const c of info.children) this.applyBone(c, world);
  }

  private applyPose(moving: boolean): void {
    const t = this.t;
    this.marker.visible = this.pose === 'spotted';
    if (this.marker.visible) {
      this.marker.position.y = 2.5 + Math.sin(t * 6) * 0.06;
      this.marker.rotation.y = t * 3;
    }
    if (moving && this.pose !== 'spotted') return;
    if (this.pose === 'sit' || this.pose === 'sitThink' || this.pose === 'drink' || this.pose === 'read' || this.pose === 'doze') {
      // on a chair (seat height ≈ 0.48): thighs forward, shins down
      this.body.position.y = 0.52 - this.hipHeight;
      this.legL.upper.rotation.set(1.5, 0, 0.08);
      this.legR.upper.rotation.set(1.5, 0, -0.08);
      this.legL.lower.rotation.set(-1.5, 0, 0);
      this.legR.lower.rotation.set(-1.5, 0, 0);
      this.chest.rotation.set(-0.16 + Math.sin(t * 2) * 0.01, 0, 0);
      // hands resting at the table edge
      this.armL.upper.rotation.set(0.3, 0, -0.18);
      this.armR.upper.rotation.set(0.3, 0, 0.18);
      this.armL.lower.rotation.set(1.25, 0, 0.45);
      this.armR.lower.rotation.set(1.25, 0, -0.45);
      if (this.pose === 'sitThink') {
        this.armR.upper.rotation.set(0.9, 0, -0.25);
        this.armR.lower.rotation.set(2.0, 0, 0);
        this.neck.rotation.set(0.1, 0, -0.12 + Math.sin(t * 0.8) * 0.05);
      } else if (this.pose === 'read') {
        // holding the newspaper open in front of the face
        this.armL.upper.rotation.set(1.05, 0, -0.35);
        this.armR.upper.rotation.set(1.05, 0, 0.35);
        this.armL.lower.rotation.set(0.9, 0, 0.5);
        this.armR.lower.rotation.set(0.9, 0, -0.5);
        this.neck.rotation.set(-0.12 + Math.sin(t * 0.4) * 0.03, Math.sin(t * 0.25) * 0.15, 0);
      } else if (this.pose === 'doze') {
        this.chest.rotation.set(0.12, 0, 0);
        this.neck.rotation.set(-0.55 + Math.sin(t * 0.9) * 0.04, 0, 0.1);
        this.armL.upper.rotation.set(0.35, 0, -0.1);
        this.armR.upper.rotation.set(0.35, 0, 0.1);
        this.armL.lower.rotation.set(0.9, 0, 0.6);
        this.armR.lower.rotation.set(0.9, 0, -0.6);
      } else if (this.pose === 'drink') {
        const sip = Math.max(0, Math.sin(t * 1.3));
        this.armR.upper.rotation.set(0.9 + sip * 0.2, 0, -0.3);
        this.armR.lower.rotation.set(1.8 + sip * 0.4, 0, 0);
        this.neck.rotation.set(-sip * 0.12, 0, 0);
      }
      return;
    }
    if (this.pose === 'fish') {
      // both hands on the rod, leaning on the railing
      this.chest.rotation.x = -0.12;
      this.armL.upper.rotation.set(0.75, 0, 0.25);
      this.armR.upper.rotation.set(0.85, 0, -0.1);
      this.armL.lower.rotation.set(0.6, 0, 0.3);
      this.armR.lower.rotation.set(0.5, 0, 0);
      this.neck.rotation.x = -0.15 + Math.sin(t * 0.5) * 0.03;
      return;
    }
    if (this.pose === 'counting') {
      // face in the crook of the arm against the wall
      this.chest.rotation.x = -0.3;
      this.neck.rotation.x = -0.3;
      this.armL.upper.rotation.set(2.3, 0, 0.5);
      this.armL.lower.rotation.set(1.9, 0, 0);
      this.armR.upper.rotation.set(2.2, 0, -0.45);
      this.armR.lower.rotation.set(1.9, 0, 0);
    } else if (this.pose === 'caught') {
      this.neck.rotation.x = -0.45;
      this.chest.rotation.x = -0.15;
      this.armL.upper.rotation.set(0.1, 0, -0.05);
      this.armR.upper.rotation.set(0.1, 0, 0.05);
    } else if (this.pose === 'celebrate') {
      const j = Math.abs(Math.sin(t * 7));
      this.body.position.y += j * 0.15;
      this.armL.upper.rotation.set(0, 0, -2.6 + Math.sin(t * 7) * 0.2);
      this.armR.upper.rotation.set(0, 0, 2.6 - Math.sin(t * 7) * 0.2);
      this.armL.lower.rotation.set(0, 0, 0);
      this.armR.lower.rotation.set(0, 0, 0);
    }
  }

  private applyUse(dt: number): void {
    if (this.holding && !this.useKind && this.pose !== 'fish') {
      // carry it in front, elbow bent
      this.armR.lower.rotation.x = Math.max(this.armR.lower.rotation.x, 0.9);
    }
    if (!this.useKind) return;
    this.useT += dt;
    const dur = this.useKind === 'read' ? 3.2 : 2.4;
    if (this.useT > dur) {
      this.useKind = null;
      return;
    }
    const w = Math.sin(Math.min(1, this.useT / dur) * Math.PI);
    const k = Math.min(1, w * 1.6);
    if (this.useKind === 'read') {
      this.armL.upper.rotation.set(1.05 * k, 0, -0.35 * k);
      this.armR.upper.rotation.set(1.05 * k, 0, 0.35 * k);
      this.armL.lower.rotation.set(0.9 * k, 0, 0.5 * k);
      this.armR.lower.rotation.set(0.9 * k, 0, -0.5 * k);
      return;
    }
    // hand to mouth
    const r = this.armR.upper.rotation;
    r.set(r.x + (0.75 - r.x) * k, 0, r.z + (-0.32 - r.z) * k);
    const l = this.armR.lower.rotation;
    l.set(l.x + (2.15 - l.x) * k, 0, l.z * (1 - k));
    if (this.useKind === 'drink') this.neck.rotation.x -= 0.2 * k;
  }

  private applyEmote(dt: number, moving: boolean): void {
    if (!this.emote) return;
    this.emoteT += dt;
    const t = this.emoteT;
    if (moving || t > 2.6) {
      this.emote = null;
      return;
    }
    if (this.emote === 'wave') {
      this.armR.upper.rotation.set(0, 0, 2.5);
      this.armR.lower.rotation.set(0, 0, Math.sin(t * 12) * 0.5);
      this.neck.rotation.z = -0.12;
    } else if (this.emote === 'laugh') {
      this.chest.rotation.x = 0.18 + Math.sin(t * 24) * 0.05;
      this.neck.rotation.x = 0.35;
      this.armL.upper.rotation.set(0.3, 0, 0.35);
      this.armR.upper.rotation.set(0.3, 0, -0.35);
      this.armL.lower.rotation.set(1.6, 0, 0);
      this.armR.lower.rotation.set(1.6, 0, 0);
    } else if (this.emote === 'dance') {
      this.body.position.y = Math.abs(Math.sin(t * 8)) * 0.16;
      this.body.rotation.y = Math.sin(t * 4) * 0.5;
      this.hips.rotation.z = Math.sin(t * 8) * 0.12;
      this.armL.upper.rotation.set(0, 0, -2.3 - Math.sin(t * 8) * 0.4);
      this.armR.upper.rotation.set(0, 0, 2.3 + Math.sin(t * 8) * 0.4);
      this.legL.upper.rotation.x = Math.max(0, Math.sin(t * 8)) * 0.5;
      this.legR.upper.rotation.x = Math.max(0, -Math.sin(t * 8)) * 0.5;
    } else if (this.emote === 'point') {
      this.armR.upper.rotation.set(1.55, 0, 0.1);
      this.armR.lower.rotation.set(0, 0, 0);
      this.neck.rotation.x = 0.1;
    }
  }

  dispose(): void {
    this.clearBubble();
    if (this.label) {
      (this.label.material as THREE.SpriteMaterial).map?.dispose();
      this.label.material.dispose();
    }
    this.material.dispose();
  }
}

/** Soft warm rim so characters read against busy backgrounds. */
function rimLight(shader: THREE.WebGLProgramParametersWithUniforms): void {
  shader.fragmentShader = shader.fragmentShader.replace(
    '#include <emissivemap_fragment>',
    `#include <emissivemap_fragment>
     float rimF = 1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0);
     totalEmissiveRadiance += vec3(1.0, 0.86, 0.7) * pow(rimF, 3.0) * 0.22 * diffuseColor.rgb;`,
  );
}

const matCache = new Map<string, THREE.MeshStandardMaterial>();
function mat(color: string | number, roughness = 0.75): THREE.MeshStandardMaterial {
  const key = `${color}|${roughness}`;
  let m = matCache.get(key);
  if (!m) matCache.set(key, (m = std(color, roughness)));
  return m;
}

function add(g: THREE.Object3D, m: THREE.Mesh): THREE.Mesh {
  g.add(m);
  return m;
}
