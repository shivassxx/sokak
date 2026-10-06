import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { SKINS, type Look } from '@sokak/shared';

/**
 * Chibi-style neighborhood kid built from smooth primitives, with a small
 * joint hierarchy (hips, knees, shoulders, elbows, neck) and procedural
 * animation: idle breathing, blinking, walk/run cycles, sneak-crouch, jump,
 * emotes and round poses (counting at the wall, caught, celebrating).
 */
export type Emote = 'wave' | 'laugh' | 'dance' | 'point';
export type Pose = 'none' | 'counting' | 'caught' | 'celebrate' | 'spotted' | 'sit' | 'sitThink' | 'drink';

const std = (color: number | string, roughness = 0.75) => new THREE.MeshStandardMaterial({ color, roughness, metalness: 0 });

const MAT = {
  pants: std(0x2f4a6d, 0.85),
  sole: std(0xf4f1ea, 0.6),
  shoe: std(0x3b3f46, 0.6),
  sock: std(0xf7f7f2, 0.9),
  eyeWhite: std(0xffffff, 0.3),
  pupil: std(0x1d1712, 0.2),
  shine: new THREE.MeshBasicMaterial({ color: 0xffffff }),
  mouth: std(0x7a2f26, 0.6),
  cheek: new THREE.MeshBasicMaterial({ color: 0xff8a8a, transparent: true, opacity: 0.35, depthWrite: false }),
  hairDark: std(0x3a2618, 0.9),
  hatRed: std(0xd8473b, 0.7),
  straw: std(0xe2c27a, 0.95),
  gold: new THREE.MeshStandardMaterial({ color: 0xf2c94c, roughness: 0.3, metalness: 0.7 }),
  band: std(0x2b2b2b, 0.6),
  white: std(0xf7f3ea, 0.7),
};

const HAIR_COLORS = [0x3a2618, 0x1c1714, 0x6b3e1f, 0xa5652a, 0xd9b26a];

const cache = new Map<string, THREE.MeshStandardMaterial>();
function mat(color: string | number, roughness = 0.75): THREE.MeshStandardMaterial {
  const key = `${color}|${roughness}`;
  let m = cache.get(key);
  if (!m) cache.set(key, (m = std(color, roughness)));
  return m;
}

// shared geometry (smooth, modest segment counts for phones)
const G = {
  head: new THREE.SphereGeometry(0.31, 20, 16),
  ear: new THREE.SphereGeometry(0.07, 10, 8),
  eyeWhite: new THREE.SphereGeometry(0.068, 12, 10),
  pupil: new THREE.SphereGeometry(0.042, 10, 8),
  shine: new THREE.SphereGeometry(0.014, 6, 5),
  nose: new THREE.SphereGeometry(0.03, 8, 6),
  cheek: new THREE.CircleGeometry(0.055, 12),
  brow: new THREE.CapsuleGeometry(0.014, 0.07, 3, 6),
  mouth: new THREE.TorusGeometry(0.05, 0.013, 6, 12, Math.PI),
  torso: new THREE.CapsuleGeometry(0.21, 0.22, 6, 14),
  collar: new THREE.TorusGeometry(0.11, 0.025, 6, 14),
  shorts: new THREE.CylinderGeometry(0.21, 0.23, 0.2, 14),
  upperArm: new THREE.CapsuleGeometry(0.075, 0.16, 4, 10),
  foreArm: new THREE.CapsuleGeometry(0.062, 0.15, 4, 10),
  hand: new THREE.SphereGeometry(0.075, 10, 8),
  thigh: new THREE.CapsuleGeometry(0.088, 0.14, 4, 10),
  shin: new THREE.CapsuleGeometry(0.07, 0.17, 4, 10),
  sock: new THREE.CylinderGeometry(0.072, 0.072, 0.07, 10),
  shoe: new THREE.CapsuleGeometry(0.075, 0.14, 4, 10),
  sole: new THREE.BoxGeometry(0.15, 0.04, 0.28),
  hairCap: new THREE.SphereGeometry(0.325, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.55),
  fringe: new THREE.SphereGeometry(0.33, 16, 6, Math.PI * 1.12, Math.PI * 0.76, Math.PI * 0.18, Math.PI * 0.2),
  curl: new THREE.IcosahedronGeometry(0.1, 1),
  tail: new THREE.CapsuleGeometry(0.075, 0.18, 4, 8),
  spike: new THREE.ConeGeometry(0.07, 0.2, 6),
  capTop: new THREE.SphereGeometry(0.35, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.5),
  capBrim: new THREE.CylinderGeometry(0.2, 0.2, 0.025, 16, 1, false, 0, Math.PI),
  beanie: new THREE.SphereGeometry(0.35, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.55),
  pompom: new THREE.SphereGeometry(0.075, 10, 8),
  strawBrim: new THREE.CylinderGeometry(0.55, 0.55, 0.03, 24),
  strawTop: new THREE.CylinderGeometry(0.24, 0.3, 0.2, 18),
  crown: new THREE.CylinderGeometry(0.2, 0.22, 0.16, 10, 1, true),
  crownGem: new THREE.ConeGeometry(0.045, 0.1, 5),
  phoneBand: new THREE.TorusGeometry(0.33, 0.025, 6, 20, Math.PI),
  phoneCup: new THREE.CylinderGeometry(0.1, 0.1, 0.07, 14),
  marker: new THREE.ConeGeometry(0.16, 0.34, 4),
  blob: new THREE.CircleGeometry(0.42, 20),
};

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
G.capBrim.rotateY(Math.PI / 2);

function mesh(g: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0, shadow = false): THREE.Mesh {
  const o = new THREE.Mesh(g, m);
  o.position.set(x, y, z);
  o.castShadow = shadow;
  return o;
}

interface Limb {
  upper: THREE.Group;
  lower: THREE.Group;
}

export class Character {
  readonly root = new THREE.Group();
  private body = new THREE.Group();
  private hips = new THREE.Group();
  private chest = new THREE.Group();
  private neck = new THREE.Group();
  private armL: Limb;
  private armR: Limb;
  private legL: Limb;
  private legR: Limb;
  private eyes: THREE.Group[] = [];
  private hatGroup = new THREE.Group();
  private hairGroup = new THREE.Group();
  private shirtMeshes: THREE.Mesh[] = [];
  private skinMeshes: THREE.Mesh[] = [];
  private marker: THREE.Mesh;
  private phase = 0;
  private t = Math.random() * 10;
  private blinkT = 2 + Math.random() * 3;
  private emote: Emote | null = null;
  private emoteT = 0;
  private label: THREE.Sprite | null = null;
  private bubble: THREE.Sprite | null = null;
  private bubbleT = 0;
  private crouchAmt = 0;
  private airAmt = 0;
  private lean = 0;
  pose: Pose = 'none';
  facing = 0;

  constructor(look: Look) {
    const shirt = mat(look.color, 0.8);
    const skin = mat(SKINS[look.skin] ?? SKINS[0], 0.65);

    // hierarchy: root → body(bob) → hips → (legs, chest → arms, neck → head)
    this.hips.position.y = 0.78;
    this.body.add(this.hips);
    const shorts = mesh(G.shorts, MAT.pants, 0, 0.0, 0);
    this.hips.add(shorts);

    this.chest.position.y = 0.06;
    this.hips.add(this.chest);
    const torso = mesh(G.torso, shirt, 0, 0.27, 0, true);
    torso.scale.set(1.05, 1, 0.82);
    const collar = mesh(G.collar, MAT.white, 0, 0.5, 0, false);
    collar.rotation.x = Math.PI / 2;
    collar.scale.set(1, 0.8, 1);
    this.chest.add(torso, collar);
    this.shirtMeshes.push(torso);

    // neck + head
    this.neck.position.y = 0.55;
    this.chest.add(this.neck);
    const head = new THREE.Group();
    head.position.y = 0.3;
    this.neck.add(head);
    const skull = mesh(G.head, skin, 0, 0, 0, true);
    skull.scale.set(1, 0.95, 0.96);
    this.skinMeshes.push(skull);
    head.add(skull);
    for (const s of [-1, 1]) {
      const ear = mesh(G.ear, skin, s * 0.3, -0.02, 0.01);
      ear.scale.set(0.6, 1, 0.8);
      this.skinMeshes.push(ear);
      head.add(ear);
      // eye: white + pupil + shine, grouped so we can blink (scale y)
      const eye = new THREE.Group();
      eye.position.set(s * 0.115, 0.02, -0.255);
      const white = mesh(G.eyeWhite, MAT.eyeWhite, 0, 0, 0, false);
      white.scale.set(0.85, 1.1, 0.45);
      const pupil = mesh(G.pupil, MAT.pupil, 0, -0.005, -0.028, false);
      pupil.scale.set(0.9, 1.1, 0.5);
      const shine = mesh(G.shine, MAT.shine, 0.015, 0.022, -0.045, false);
      eye.add(white, pupil, shine);
      head.add(eye);
      this.eyes.push(eye);
      const brow = mesh(G.brow, MAT.hairDark, s * 0.115, 0.115, -0.265, false);
      brow.rotation.z = Math.PI / 2 + s * 0.12;
      head.add(brow);
      const cheek = mesh(G.cheek, MAT.cheek, s * 0.17, -0.08, -0.255, false);
      cheek.rotation.y = s * 0.45 + Math.PI;
      head.add(cheek);
    }
    const nose = mesh(G.nose, skin, 0, -0.04, -0.3, false);
    this.skinMeshes.push(nose);
    const mouth = mesh(G.mouth, MAT.mouth, 0, -0.12, -0.272, false);
    mouth.rotation.set(0, 0, Math.PI);
    head.add(nose, mouth);
    head.add(this.hairGroup, this.hatGroup);

    // arms (shoulder → elbow)
    const mkArm = (s: number): Limb => {
      const upper = new THREE.Group();
      upper.position.set(s * 0.27, 0.43, 0);
      upper.rotation.z = s * 0.12;
      const sleeve = mesh(G.upperArm, shirt, 0, -0.12, 0);
      this.shirtMeshes.push(sleeve);
      upper.add(sleeve);
      const lower = new THREE.Group();
      lower.position.y = -0.24;
      const fore = mesh(G.foreArm, skin, 0, -0.1, 0);
      const hand = mesh(G.hand, skin, 0, -0.22, 0);
      this.skinMeshes.push(fore, hand);
      lower.add(fore, hand);
      upper.add(lower);
      this.chest.add(upper);
      return { upper, lower };
    };
    // legs (hip → knee)
    const mkLeg = (s: number): Limb => {
      const upper = new THREE.Group();
      upper.position.set(s * 0.11, -0.04, 0);
      const thigh = mesh(G.thigh, MAT.pants, 0, -0.11, 0);
      upper.add(thigh);
      const lower = new THREE.Group();
      lower.position.y = -0.26;
      const shin = mesh(G.shin, skin, 0, -0.13, 0);
      this.skinMeshes.push(shin);
      const sock = mesh(G.sock, MAT.sock, 0, -0.29, 0);
      const shoe = mesh(G.shoe, MAT.shoe, 0, -0.38, -0.05);
      shoe.rotation.x = Math.PI / 2;
      shoe.scale.set(1.05, 1, 0.8);
      const sole = mesh(G.sole, MAT.sole, 0, -0.44, -0.05, false);
      lower.add(shin, sock, shoe, sole);
      upper.add(lower);
      this.hips.add(upper);
      return { upper, lower };
    };
    this.armL = mkArm(-1);
    this.armR = mkArm(1);
    this.legL = mkLeg(-1);
    this.legR = mkLeg(1);

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
  }

  /** Change outfit color, skin tone, hair style and hat. */
  setLook(look: Look): void {
    const shirt = mat(look.color, 0.8);
    for (const m of this.shirtMeshes) m.material = shirt;
    const skin = mat(SKINS[look.skin] ?? SKINS[0], 0.65);
    for (const m of this.skinMeshes) m.material = skin;
    this.buildHair(look.hair, look);
    this.buildHat(look.hat);
  }

  private buildHair(style: number, look: Look): void {
    this.hairGroup.clear();
    this.buildHairParts(style, look);
    // merge same-material pieces into one mesh (fewer draw calls)
    const byMat = new Map<THREE.Material, THREE.BufferGeometry[]>();
    this.hairGroup.updateMatrixWorld(true);
    for (const o of this.hairGroup.children) {
      const m = o as THREE.Mesh;
      const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
      m.updateMatrix();
      g.applyMatrix4(m.matrix);
      for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
      const mat = m.material as THREE.Material;
      if (!byMat.has(mat)) byMat.set(mat, []);
      byMat.get(mat)!.push(g);
    }
    this.hairGroup.clear();
    for (const [mat, list] of byMat) {
      const merged = mergeGeometries(list, false);
      for (const g of list) g.dispose();
      const hm = new THREE.Mesh(merged, mat);
      hm.castShadow = true;
      this.hairGroup.add(hm);
    }
  }

  private buildHairParts(style: number, look: Look): void {
    // hair color derived from the look so each kid stays recognisable
    const hc = HAIR_COLORS[(look.hair * 3 + look.skin + look.color.charCodeAt(2)) % HAIR_COLORS.length]!;
    const hm = mat(hc, 0.95);
    const add = (o: THREE.Mesh) => this.hairGroup.add(o);
    const cap = mesh(G.hairCap, hm, 0, 0.02, 0.01);
    cap.rotation.x = 0.3;
    // hats that cover the top of the head flatten tall hair styles
    const covered = look.hat === 1 || look.hat === 2 || look.hat === 3;
    if (covered && (style === 1 || style === 4)) style = 0;
    if (covered) cap.scale.setScalar(0.95);
    if (style === 4) {
      // spiky
      add(mesh(G.hairCap, hm, 0, 0.0, 0.02));
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2;
        const sp = mesh(G.spike, hm, Math.sin(a) * 0.16, 0.27, Math.cos(a) * 0.16 + 0.03);
        sp.rotation.set(Math.cos(a) * 0.6, 0, -Math.sin(a) * 0.6);
        add(sp);
      }
      return;
    }
    add(cap);
    if (style !== 1 && look.hat !== 2) add(mesh(G.fringe, hm, 0, 0.02, 0));
    if (style === 1) {
      // curly: a crown of curls
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2;
        const r = i % 2 ? 0.25 : 0.2;
        add(mesh(G.curl, hm, Math.sin(a) * r, 0.2 + (i % 3) * 0.04, Math.cos(a) * r + 0.02));
      }
      add(mesh(G.curl, hm, 0, 0.3, 0.02));
    } else if (style === 2) {
      const tail = mesh(G.tail, hm, 0, 0.0, 0.33);
      tail.rotation.x = 0.5;
      add(tail);
      add(mesh(G.pompom, MAT.hatRed, 0, 0.13, 0.3));
    } else if (style === 3) {
      for (const s of [-1, 1]) {
        const braid = mesh(G.tail, hm, s * 0.25, -0.22, 0.12);
        braid.rotation.z = -s * 0.15;
        add(braid);
        add(mesh(G.pompom, MAT.hatRed, s * 0.27, -0.38, 0.12));
      }
    }
  }

  private buildHat(hat: number): void {
    this.hatGroup.clear();
    const add = (o: THREE.Mesh) => this.hatGroup.add(o);
    switch (hat) {
      case 1: {
        // kasket (cap) facing forward
        const top = mesh(G.capTop, MAT.hatRed, 0, 0.03, 0.01);
        top.scale.set(1.01, 0.92, 1.01);
        add(top);
        add(mesh(G.capBrim, MAT.hatRed, 0, 0.07, -0.18));
        break;
      }
      case 2: {
        const b = mesh(G.beanie, mat(0x2f6fb0, 0.95), 0, 0.04, 0.01);
        b.scale.set(1, 0.9, 1);
        add(b);
        add(mesh(G.pompom, MAT.white, 0, 0.36, 0.02));
        break;
      }
      case 3:
        add(mesh(G.strawBrim, MAT.straw, 0, 0.2, 0)).rotation.x = 0.12;
        add(mesh(G.strawTop, MAT.straw, 0, 0.3, 0));
        add(mesh(G.shorts, MAT.hatRed, 0, 0.23, 0)).scale.set(1.12, 0.25, 1.12);
        break;
      case 4: {
        const c = mesh(G.crown, MAT.gold, 0, 0.33, 0);
        c.material = MAT.gold;
        (c.material as THREE.Material).side = THREE.DoubleSide;
        add(c);
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2;
          add(mesh(G.crownGem, MAT.gold, Math.sin(a) * 0.2, 0.45, Math.cos(a) * 0.2));
        }
        break;
      }
      case 5:
        add(mesh(G.phoneBand, MAT.band, 0, 0.02, 0)).rotation.z = 0;
        for (const s of [-1, 1]) {
          const cup = mesh(G.phoneCup, MAT.hatRed, s * 0.31, 0, 0);
          cup.rotation.z = Math.PI / 2;
          add(cup);
        }
        break;
      default:
        break;
    }
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
    ctx.font = '800 34px "Trebuchet MS", system-ui, sans-serif';
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
    s.position.y = 2.2;
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
    ctx.font = '800 36px "Trebuchet MS", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const w = Math.min(500, ctx.measureText(text).width + 44);
    ctx.fillStyle = '#fffaf0';
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
    s.scale.set(3.2, 0.69, 1);
    s.position.y = 2.7;
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

    // legs: hip swing + knee bend on the back-swing
    const amp = (0.55 + run * 0.35) * stride * (1 - cr * 0.5);
    this.legL.upper.rotation.x = s * amp + cr * 1.05;
    this.legR.upper.rotation.x = -s * amp + cr * 1.05;
    this.legL.lower.rotation.x = -(Math.max(0, -c) * (0.7 + run * 0.6) * stride + cr * 1.75);
    this.legR.lower.rotation.x = -(Math.max(0, c) * (0.7 + run * 0.6) * stride + cr * 1.75);

    // arms swing opposite to legs, elbows bend more when running
    const aamp = (0.5 + run * 0.6) * stride;
    this.armL.upper.rotation.set(-s * aamp + cr * 0.35, 0, -0.12);
    this.armR.upper.rotation.set(s * aamp + cr * 0.35, 0, 0.12);
    this.armL.lower.rotation.set(0.25 + run * 0.9 + cr * 0.8, 0, 0);
    this.armR.lower.rotation.set(0.25 + run * 0.9 + cr * 0.8, 0, 0);

    // body: bob, forward lean, breathing, crouch drop
    const breathe = Math.sin(this.t * 2.2) * 0.012;
    const bob = moving ? Math.abs(c) * (0.04 + run * 0.05) : 0;
    this.lean += ((moving ? 0.08 + run * 0.14 : 0) + cr * 0.32 - this.lean) * k;
    this.body.position.y = bob - cr * 0.36;
    this.hips.rotation.set(0, 0, 0);
    this.chest.rotation.set(-this.lean, moving ? s * 0.08 : 0, 0);
    this.chest.scale.set(1, 1 + breathe, 1);
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

    // blink
    this.blinkT -= dt;
    const blink = this.blinkT < 0.12 ? 0.1 : 1;
    if (this.blinkT < 0) this.blinkT = 2 + Math.random() * 4;
    for (const e of this.eyes) e.scale.y = blink;

    this.applyPose(moving);
    this.applyEmote(dt, moving);
  }

  private applyPose(moving: boolean): void {
    const t = this.t;
    this.marker.visible = this.pose === 'spotted';
    if (this.marker.visible) {
      this.marker.position.y = 2.5 + Math.sin(t * 6) * 0.06;
      this.marker.rotation.y = t * 3;
    }
    if (moving && this.pose !== 'spotted') return;
    if (this.pose === 'sit' || this.pose === 'sitThink' || this.pose === 'drink') {
      // on a chair (seat height ≈ 0.48): thighs forward, shins down
      this.body.position.y = -0.3;
      this.legL.upper.rotation.set(1.45, 0, 0.06);
      this.legR.upper.rotation.set(1.45, 0, -0.06);
      this.legL.lower.rotation.set(-1.45, 0, 0);
      this.legR.lower.rotation.set(-1.45, 0, 0);
      this.chest.rotation.x = -0.12;
      // hands on the table (or chin in hand when thinking)
      this.armL.upper.rotation.set(0.9, 0, -0.05);
      this.armR.upper.rotation.set(0.9, 0, 0.05);
      this.armL.lower.rotation.set(0.5, 0, 0);
      this.armR.lower.rotation.set(0.5, 0, 0);
      if (this.pose === 'sitThink') {
        this.armR.upper.rotation.set(1.2, 0, -0.2);
        this.armR.lower.rotation.set(1.9, 0, 0);
        this.neck.rotation.z = -0.15 + Math.sin(t * 0.8) * 0.05;
      } else if (this.pose === 'drink') {
        this.armR.upper.rotation.set(1.3, 0, -0.25);
        this.armR.lower.rotation.set(1.7 + Math.max(0, Math.sin(t * 1.3)) * 0.4, 0, 0);
      }
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
  }
}
