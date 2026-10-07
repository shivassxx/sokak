import * as THREE from 'three';
import {
  HALL,
  HALL_DOOR,
  KAHVE_COLLIDERS,
  KAHVE_OBJECTS,
  KAHVE_SPAWN,
  KAHVE_WORLD,
  SEA_Z,
  type Aabb,
  type CollisionWorld,
  SIM_DT,
  cloneBody,
  createBody,
  deckToWorld,
  segmentEntryT,
  stepBody,
  stepDeck,
  vapurState,
  worldDirToDeck,
  type VapurState,
  type Body,
  type Look,
  type MoveInput,
} from '@sokak/shared';
import { Character, ensureRealAvatar, isRealAvatarLoaded, realAvatarFor, wantedAvatar, type Emote, type Pose } from './character';
import { itemModel, type UseKind } from './items';
export { loadCharacterKit, loadRealKit } from './character';
import { Input } from './input';
import type { Mover, World } from './world';
import { PostFX, initialQuality } from './postfx';
import type { KahveScene } from './kahveScene';

export interface InputSender {
  sendInput(seq: number, input: MoveInput, yaw: number): void;
}

/** Local movement feedback for sounds / HUD. */
export interface LocalEvents {
  onJump?(): void;
  onLand?(): void;
  /** called every frame with horizontal speed (m/s) when on the ground */
  onStep?(speed: number, sprinting: boolean): void;
}

interface Pending {
  seq: number;
  input: MoveInput;
}

interface Sample {
  t: number;
  x: number;
  y: number;
  z: number;
  yaw: number;
  crouch: boolean;
  /** on the vapur: x, z, yaw are deck-local */
  deck: boolean;
}

interface Remote {
  char: Character;
  key: string;
  look: Look;
  label: string;
  labelColor?: string;
  buf: Sample[];
  lastSeen: number;
  /** placed directly (seated bots), not interpolated */
  fixed: { x: number; y: number; z: number; yaw: number } | null;
  prevX: number;
  prevZ: number;
  /** last rendered deck-local position (riders walk relative to the boat) */
  prevLX: number;
  prevLZ: number;
}

// camera occluders: tall, and walls or blocks rather than posts (lamp posts / trunks would make the
// camera pump in and out)
const camBlocker = (minH: number) => (c: Aabb) =>
  c.solid && c.maxY - c.minY > minH && (Math.min(c.maxX - c.minX, c.maxZ - c.minZ) >= 0.5 || Math.max(c.maxX - c.minX, c.maxZ - c.minZ) >= 2);
const SOLID_CAM_KAHVE = [
  // the invisible wall over the sea railing must not pull the camera in
  ...KAHVE_COLLIDERS.filter((c, i) => KAHVE_OBJECTS[i]!.kind !== 'seaWall' && camBlocker(1.5)(c)),
  // the storefront above the door (not a walking collider)
  { minX: HALL_DOOR.x - HALL_DOOR.w / 2, maxX: HALL_DOOR.x + HALL_DOOR.w / 2, minY: 3, maxY: HALL.h, minZ: -0.15, maxZ: 0.15, solid: true, opaque: true },
];
const INTERP_DELAY = 110;
const FLOAT_RED = new THREE.MeshStandardMaterial({ color: 0xe0362c, roughness: 0.4 });
const FLOAT_WHITE = new THREE.MeshStandardMaterial({ color: 0xf4f1ea, roughness: 0.4 });
const FLOAT_LINE = new THREE.LineBasicMaterial({ color: 0xf0f0f0, transparent: true, opacity: 0.75 });
const FLOAT_TOP = new THREE.SphereGeometry(0.07, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2);
const FLOAT_BOTTOM = new THREE.SphereGeometry(0.07, 10, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
const FLOAT_STICK = new THREE.CylinderGeometry(0.008, 0.008, 0.16, 4);
const _tipW = new THREE.Vector3();
const _camDir = new THREE.Vector3();
/** dev/test only: run the game without drawing (multi-client browser tests) */
const NO_RENDER = import.meta.env.DEV && new URLSearchParams(location.search).has('norender');
const SMOKE_TEX = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
  g.addColorStop(0, 'rgba(235,235,230,0.9)');
  g.addColorStop(1, 'rgba(235,235,230,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
})();

export class Game {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(62, 1, 0.1, 400);
  readonly input = new Input();

  /** local player (null = spectator camera) */
  private body: Body | null = null;
  private prevBody: Body | null = null;
  private localChar: Character | null = null;
  private crouch = false;
  private jumpQueued = false;
  private wasOnGround = true;
  private shakeT = 0;
  private shakeAmp = 0;
  private fovKick = 0;
  private effects: { obj: THREE.Object3D; t: number; life: number; update: (k: number) => void }[] = [];
  private floats = new Map<string, { state: number; bob: THREE.Group; line: THREE.Line; tip: THREE.Object3D | null; t: number }>();
  events: LocalEvents = {};
  private facing = 0;
  private seq = 0;
  private pending: Pending[] = [];
  private acc = 0;

  /** frozen = cannot move (seated, watching a table) */
  frozen = false;
  camYaw = 0;
  camPitch = 0.45;
  private camDist = 5.2;

  private remotes = new Map<string, Remote>();
  private serverOffset: number | null = null;
  /** riding the vapur: predicted deck-local position (the body then just mirrors the world spot) */
  private deck: { x: number; z: number } | null = null;
  private prevDeck: { x: number; z: number } | null = null;
  /** deck-local facing */
  private deckFacing = 0;
  private lastBoatYaw: number | null = null;
  /** the vapur's pose this frame (shared timeline at server time) */
  private boat: VapurState = vapurState(Date.now());
  sender: InputSender | null = null;

  private post: PostFX;
  private world: World;
  /** kahvehane-only scene helpers (waiter, drinks, racks) */
  kahve: KahveScene | null = null;
  private phys: CollisionWorld = KAHVE_WORLD;
  private solidCam = SOLID_CAM_KAHVE;
  /** seated at an okey table: camera from the seat looking down at the table */
  seat: { table: number; seat: number } | null = null;
  /** watching a table from beside it (spectator camera) */
  watch: { table: number; side: number } | null = null;
  /** NDC y of the top of the on-screen rack (the table is framed above it) */
  seatBottom = -0.42;
  private seatLook = new THREE.Vector3();
  private seatCam = false;
  private focusY: number | null = null;
  private camDistCur: number | null = null;
  /** sitting on a bench / stool: lift the local character by (seat height − chair height) */
  localSeatY = 0;
  /** prediction diagnostics (corrections applied by reconcile) */
  readonly stats = { corrections: 0, maxErr: 0 };
  /** dev-only: fixed camera for screenshots */
  debugCam: { pos: THREE.Vector3; target: THREE.Vector3 } | null = null;
  private raf = 0;
  private last = performance.now();
  private resizeObs: ResizeObserver;
  private disposed = false;
  onFrame: ((dt: number) => void) | null = null;

  constructor(
    private canvas: HTMLCanvasElement,
    kahveBuilder: (scene: THREE.Scene, renderer: THREE.WebGLRenderer) => KahveScene,
  ) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    const quality = initialQuality();
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    // the Bosphorus view needs a long far plane (sky, skyline, vapur)
    this.camera.far = 1500;
    this.camera.updateProjectionMatrix();
    this.kahve = kahveBuilder(this.scene, this.renderer);
    this.kahve.setClock(() => this.serverNow());
    this.world = this.kahve;
    this.camDist = 4.2;
    this.post = new PostFX(this.renderer, this.scene, this.camera, quality, { bloomStrength: 0.28, aoRadius: 0.45, vignette: 0.32 });
    this.input.attach(canvas);
    this.input.onPress((a) => {
      if (a === 'jump') this.jumpQueued = true;
      if (a === 'crouch') this.crouch = !this.crouch;
    });
    this.resizeObs = new ResizeObserver(() => this.resize());
    this.resizeObs.observe(canvas);
    this.resize();
    this.loop = this.loop.bind(this);
    this.raf = requestAnimationFrame(this.loop);
  }

  // ------------------------------------------------------------ local player
  spawnLocal(x: number, y: number, z: number, look: Look, facing = 0): void {
    this.body = createBody(x, z, y);
    this.prevBody = cloneBody(this.body);
    this.pending = [];
    this.facing = facing;
    this.camYaw = facing;
    this.localLook = look;
    if (!this.localChar) {
      this.localChar = new Character(look, { adult: true, real: realAvatarFor(look) });
      this.scene.add(this.localChar.root);
    } else if (this.localChar.avatar !== realAvatarFor(look)) this.localChar = this.swapChar(this.localChar, look);
    else this.localChar.setLook(look);
    this.localChar.root.visible = true;
    this.fetchAvatar(look, () => {
      if (this.localChar && this.localLook === look) this.localChar = this.swapChar(this.localChar, look);
    });
  }

  private localLook: Look | null = null;
  private labelsOn = true;

  /** The chosen avatar is not loaded yet (phones load a subset): fetch it, then `swap`. */
  private fetchAvatar(look: Look, swap: () => void): void {
    const want = wantedAvatar(look);
    if (!want || isRealAvatarLoaded(want)) return;
    void ensureRealAvatar(want).then((ok) => {
      if (ok && !this.disposed) swap();
    });
  }

  /** Replace a character by a new one for `look`, keeping where it is and what it does. */
  private swapChar(old: Character, look: Look, label?: { text: string; color?: string }): Character {
    const ch = new Character(look, { adult: true, real: realAvatarFor(look) });
    ch.root.position.copy(old.root.position);
    ch.root.rotation.copy(old.root.rotation);
    ch.root.visible = old.root.visible;
    ch.facing = old.facing;
    ch.pose = old.pose;
    if (old.userHeld) {
      ch.userHeld = old.userHeld;
      ch.hold(itemModel(old.userHeld));
    }
    if (label) {
      ch.setLabel(label.text, label.color);
      ch.setLabelVisible(this.labelsOn);
    }
    this.scene.remove(old.root);
    old.dispose();
    this.scene.add(ch.root);
    // a fishing line hangs from the old rod's tip: find the new one
    for (const f of this.floats.values()) if (f.tip && !f.tip.parent?.parent) f.tip = null;
    return ch;
  }

  removeLocal(): void {
    this.body = null;
    this.prevBody = null;
    if (this.localChar) this.localChar.root.visible = false;
  }

  hasLocal(): boolean {
    return this.body !== null;
  }

  localPosition(): { x: number; y: number; z: number } | null {
    return this.body ? { x: this.body.x, y: this.body.y, z: this.body.z } : null;
  }

  isCrouching(): boolean {
    return this.crouch;
  }

  setCrouch(v: boolean): void {
    this.crouch = v;
  }

  /** Teleport (server-forced, e.g. Ebe placed at the wall). */
  teleportLocal(x: number, y: number, z: number, facing?: number): void {
    if (!this.body) return;
    this.deck = this.prevDeck = null;
    this.body = createBody(x, z, y);
    this.prevBody = cloneBody(this.body);
    this.pending = [];
    if (facing !== undefined) {
      this.facing = facing;
      this.camYaw = facing;
    }
  }

  playLocalEmote(e: Emote): void {
    this.localChar?.playEmote(e);
  }

  stamina(): { value: number; tired: boolean } {
    return this.body ? { value: this.body.stamina, tired: this.body.tired } : { value: 1, tired: false };
  }

  /** Short camera shake (e.g. spotted / sobe). */
  shake(amount: number): void {
    this.shakeAmp = Math.max(this.shakeAmp, amount);
    this.shakeT = 0.45;
  }

  /** Poses for characters (null id = local player). */
  setPose(id: string | null, pose: Pose): void {
    const ch = id === null ? this.localChar : this.remotes.get(id)?.char;
    if (ch) ch.pose = pose;
  }

  /** Server reconciliation: authoritative state after input `ack`. */
  reconcile(ack: number, x: number, y: number, z: number, vy: number, onGround: boolean, stamina = 1, tired = false): void {
    if (!this.body) return;
    const b: Body = { x, y, z, vy, onGround, stamina, tired };
    this.pending = this.pending.filter((p) => p.seq > ack);
    for (const p of this.pending) stepBody(b, p.input, SIM_DT, this.phys);
    const err = Math.hypot(b.x - this.body.x, b.y - this.body.y, b.z - this.body.z);
    if (err > 0.001) {
      this.stats.corrections++;
      this.stats.maxErr = Math.max(this.stats.maxErr, err);
    }
    this.body.stamina = b.stamina;
    this.body.tired = b.tired;
    if (err > 0.001) {
      // keep render smooth: shift prev by the same correction when small
      if (err < 1.5 && this.prevBody) {
        this.prevBody.x += b.x - this.body.x;
        this.prevBody.y += b.y - this.body.y;
        this.prevBody.z += b.z - this.body.z;
      } else this.prevBody = cloneBody(b);
      this.body = b;
    }
  }

  // ------------------------------------------------------------ the vapur
  /** Server clock estimate (ms since epoch): drives the shared vapur timeline. */
  serverNow(): number {
    return this.serverOffset === null ? Date.now() : performance.now() + this.serverOffset;
  }

  isAboard(): boolean {
    return this.deck !== null;
  }

  /** deck-local position while riding the vapur */
  deckPosition(): { x: number; z: number } | null {
    return this.deck ? { ...this.deck } : null;
  }

  /** Server says I am on the deck at (x, z) after input `ack`: start riding or reconcile. */
  reconcileDeck(ack: number, x: number, z: number): void {
    if (!this.body) return;
    if (!this.deck) {
      this.deck = { x, z };
      this.prevDeck = { x, z };
      this.pending = [];
      // keep looking the way I was looking, now relative to the boat
      this.deckFacing = this.facing - this.boat.yaw;
      this.lastBoatYaw = null;
      return;
    }
    this.pending = this.pending.filter((p) => p.seq > ack);
    const b = { x, z };
    for (const p of this.pending) stepDeck(b, p.input.mx, p.input.mz, SIM_DT);
    const err = Math.hypot(b.x - this.deck.x, b.z - this.deck.z);
    if (err > 0.001) {
      this.stats.corrections++;
      if (err < 1.5 && this.prevDeck) {
        this.prevDeck.x += b.x - this.deck.x;
        this.prevDeck.z += b.z - this.deck.z;
      } else this.prevDeck = { ...b };
      this.deck = b;
    }
  }

  /** Off the vapur (the server's body / teleport puts me back on the pier). */
  leaveDeck(): void {
    if (!this.deck) return;
    this.deck = this.prevDeck = null;
    this.pending = [];
    this.facing = this.deckFacing + this.boat.yaw;
  }

  // ------------------------------------------------------------ remotes
  /** Local look changes (e.g. lobby customisation). */
  setLocalLook(look: Look): void {
    this.localChar?.setLook(look);
  }

  upsertRemote(id: string, look: Look, label: string, labelColor?: string): void {
    let r = this.remotes.get(id);
    const key = `${look.avatar ?? -1}|${look.color}|${look.hat}|${look.hair}|${look.skin}|${label}|${labelColor ?? ''}`;
    if (r?.key === key) return;
    if (!r) {
      r = { char: new Character(look, { adult: true, real: realAvatarFor(look) }), key, look, label, labelColor, buf: [], lastSeen: 0, prevX: 0, prevZ: 0, prevLX: 0, prevLZ: 0, fixed: null };
      r.char.root.visible = false;
      r.char.setLabelVisible(this.labelsOn);
      this.scene.add(r.char.root);
      this.remotes.set(id, r);
    } else if (r.char.avatar !== realAvatarFor(look)) r.char = this.swapChar(r.char, look);
    else r.char.setLook(look);
    Object.assign(r, { key, look, label, labelColor });
    r.char.setLabel(label, labelColor);
    this.fetchAvatar(look, () => {
      const cur = this.remotes.get(id);
      if (cur && cur.look === look) cur.char = this.swapChar(cur.char, look, { text: label, color: labelColor });
    });
  }

  removeRemote(id: string): void {
    const r = this.remotes.get(id);
    if (!r) return;
    this.scene.remove(r.char.root);
    r.char.dispose();
    this.remotes.delete(id);
    this.setFishing(id, 0);
  }

  /** Voice chat speaking indicator (null id = local player). */
  setSpeaking(id: string | null, on: boolean): void {
    const ch = id === null ? this.localChar : this.remotes.get(id)?.char;
    ch?.setSpeaking(on);
  }

  /** A player reaches to the table (they drew, discarded or laid tiles); null id = local player. */
  reach(id: string | null): void {
    const ch = id === null ? this.localChar : this.remotes.get(id)?.char;
    ch?.reach();
  }

  /** Item in hand (market / simitçi); null id = local player. */
  setHeld(id: string | null, item: string): void {
    const ch = id === null ? this.localChar : this.remotes.get(id)?.char;
    if (!ch || ch.userHeld === item) return;
    ch.userHeld = item;
    ch.hold(item ? itemModel(item) : null);
  }

  /**
   * Fishing state of a player (0 off, 1 float in the water, 2 a bite): a float bobbing in
   * the sea in front of them, a line from the rod tip that sags (taut and twitching on a bite).
   */
  setFishing(id: string | null, state: number): void {
    const key = id ?? '';
    const f = this.floats.get(key);
    if (!state) {
      if (f) {
        this.scene.remove(f.bob, f.line);
        f.line.geometry.dispose();
        this.floats.delete(key);
      }
      return;
    }
    if (f) {
      f.state = state;
      return;
    }
    const bob = new THREE.Group();
    const red = new THREE.Mesh(FLOAT_TOP, FLOAT_RED);
    const white = new THREE.Mesh(FLOAT_BOTTOM, FLOAT_WHITE);
    const stick = new THREE.Mesh(FLOAT_STICK, FLOAT_RED);
    stick.position.y = 0.1;
    bob.add(red, white, stick);
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(Array.from({ length: 8 }, () => new THREE.Vector3())), FLOAT_LINE);
    line.frustumCulled = false;
    this.scene.add(bob, line);
    this.floats.set(key, { state, bob, line, tip: null, t: 0 });
    // face the water
    if (id === null) this.facing = Math.PI;
  }

  private updateFloats(dt: number): void {
    for (const [key, f] of this.floats) {
      const ch = key ? this.remotes.get(key)?.char : this.localChar;
      if (!ch) continue;
      f.t += dt;
      const p = ch.root.position;
      const bite = f.state === 2;
      f.bob.position.set(p.x - Math.sin(ch.facing) * 1.5, -1.1 + (bite ? -0.07 + Math.sin(f.t * 30) * 0.05 : Math.sin(f.t * 2.3) * 0.025), Math.max(p.z + 4, SEA_Z + 5));
      f.bob.rotation.z = bite ? Math.sin(f.t * 23) * 0.4 : Math.sin(f.t * 1.7) * 0.08;
      f.tip ??= ch.root.getObjectByName('tip') ?? null;
      if (!f.tip?.parent) {
        f.line.visible = false;
        f.tip = null;
        continue;
      }
      f.line.visible = true;
      const a = f.tip.getWorldPosition(_tipW);
      const b = f.bob.position;
      const pos = f.line.geometry.getAttribute('position') as THREE.BufferAttribute;
      const sag = bite ? 0.08 : 0.7;
      for (let i = 0; i < pos.count; i++) {
        const s = i / (pos.count - 1);
        pos.setXYZ(i, a.x + (b.x - a.x) * s, a.y + (b.y + 0.18 - a.y) * s - Math.sin(Math.PI * s) * sag, a.z + (b.z - a.z) * s);
      }
      pos.needsUpdate = true;
    }
  }

  /** Someone used their item: arm to mouth, and a few smoke puffs for a cigarette. */
  useItem(id: string | null, kind: UseKind): void {
    const ch = id === null ? this.localChar : this.remotes.get(id)?.char;
    if (!ch) return;
    ch.playUse(kind);
    if (kind !== 'smoke') return;
    for (let k = 0; k < 4; k++) {
      const puff = new THREE.Sprite(new THREE.SpriteMaterial({ map: SMOKE_TEX, transparent: true, depthWrite: false, opacity: 0 }));
      this.scene.add(puff);
      const start = 1.15 + k * 0.18;
      const p0 = new THREE.Vector3();
      this.effects.push({
        obj: puff,
        t: 0,
        life: start + 2.2,
        update: (kk) => {
          const tt = kk * (start + 2.2) - start;
          if (tt < 0) return;
          if (tt < 0.05) ch.mouthPosition(p0);
          puff.position.set(p0.x + Math.sin(tt * 2 + k) * 0.1, p0.y + tt * 0.35, p0.z + Math.cos(tt * 1.7 + k) * 0.1);
          puff.scale.setScalar(0.15 + tt * 0.35);
          (puff.material as THREE.SpriteMaterial).opacity = Math.max(0, 0.45 * (1 - tt / 2.2));
        },
      });
    }
  }

  /** Hide name tags (e.g. while seated at a table, they would cover the board). */
  setLabelsVisible(v: boolean): void {
    this.labelsOn = v;
    for (const r of this.remotes.values()) r.char.setLabelVisible(v);
  }

  /** Place a remote without interpolation (seated bots); null = back to snapshots. */
  setFixed(id: string, pos: { x: number; y: number; z: number; yaw: number } | null): void {
    const r = this.remotes.get(id);
    if (r) r.fixed = pos;
  }

  /** Position of a character as rendered (local = null). */
  characterPosition(id: string | null): THREE.Vector3 | null {
    const ch = id === null ? this.localChar : this.remotes.get(id)?.char;
    return ch && ch.root.visible ? ch.root.position.clone() : null;
  }

  remoteIds(): string[] {
    return [...this.remotes.keys()];
  }

  /** Server time of a snapshot; keeps a smoothed clock offset. */
  noteServerTime(t: number): void {
    const off = t - performance.now();
    this.serverOffset = this.serverOffset === null ? off : this.serverOffset + (off - this.serverOffset) * 0.05;
    if (off > this.serverOffset + 200) this.serverOffset = off;
  }

  pushRemote(id: string, t: number, x: number, y: number, z: number, yaw: number, crouch: boolean, deck = false): void {
    const r = this.remotes.get(id);
    if (!r) return;
    // getting on / off the vapur changes the frame: don't interpolate across it
    if (r.buf.length && r.buf[r.buf.length - 1]!.deck !== deck) r.buf.length = 0;
    r.buf.push({ t, x, y, z, yaw, crouch, deck });
    if (r.buf.length > 30) r.buf.splice(0, r.buf.length - 30);
    r.lastSeen = t;
  }

  /** Speech bubble over a remote player (or the local one with id = null). */
  bubble(id: string | null, text: string): void {
    if (id === null) this.localChar?.say(text);
    else this.remotes.get(id)?.char.say(text);
  }

  remoteEmote(id: string, e: Emote): void {
    this.remotes.get(id)?.char.playEmote(e);
  }

  /** Positions currently rendered for visible remotes. */
  visibleRemotes(): { id: string; x: number; y: number; z: number }[] {
    const out: { id: string; x: number; y: number; z: number }[] = [];
    for (const [id, r] of this.remotes) {
      if (r.char.root.visible) out.push({ id, ...r.char.root.position });
    }
    return out;
  }

  // ------------------------------------------------------------ loop
  private resize(): void {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.post.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.fov = w < h ? 75 : 62;
    this.camera.updateProjectionMatrix();
  }

  private simStep(): void {
    if (!this.body) return;
    if (this.deck) return this.deckStep();
    let input: MoveInput = { mx: 0, mz: 0, jump: false, crouch: this.crouch };
    if (!this.frozen) {
      const mv = this.input.moveVector();
      const s = Math.sin(this.camYaw);
      const c = Math.cos(this.camYaw);
      // forward = (-sin, -cos), right = (cos, -sin)
      const mx = -s * mv.y + c * mv.x;
      const mz = -c * mv.y - s * mv.x;
      const sprint = this.input.isHeld('sprint');
      if (sprint && Math.hypot(mx, mz) > 0.3) this.crouch = false;
      input = { mx, mz, jump: this.jumpQueued || this.input.isHeld('jump'), crouch: this.crouch, sprint };
      if (Math.hypot(mx, mz) > 0.1) this.facing = Math.atan2(-mx, -mz);
    }
    this.jumpQueued = false;
    this.prevBody = cloneBody(this.body);
    // seated in the kahve (table, bench, ledge): the server holds the body still, so must we —
    // stepping would push it out of the seat's collider (e.g. up onto the sahil ledge)
    if (this.frozen) return;
    const wasGround = this.body.onGround;
    stepBody(this.body, input, SIM_DT, this.phys);
    if (wasGround && !this.body.onGround && this.body.vy > 0) this.events.onJump?.();
    if (!this.wasOnGround && this.body.onGround) this.events.onLand?.();
    this.wasOnGround = this.body.onGround;
    this.seq++;
    this.pending.push({ seq: this.seq, input });
    if (this.pending.length > 120) this.pending.shift();
    this.sender?.sendInput(this.seq, input, this.facing);
  }

  /** One fixed step on the vapur's deck: the input is turned into the deck frame and sent like that. */
  private deckStep(): void {
    const deck = this.deck!;
    let mx = 0;
    let mz = 0;
    if (!this.frozen) {
      const mv = this.input.moveVector();
      const s = Math.sin(this.camYaw);
      const c = Math.cos(this.camYaw);
      const d = worldDirToDeck(this.boat.yaw, -s * mv.y + c * mv.x, -c * mv.y - s * mv.x);
      mx = d.x;
      mz = d.z;
      if (Math.hypot(mx, mz) > 0.1) this.deckFacing = Math.atan2(-mx, -mz);
    }
    this.jumpQueued = false;
    this.prevDeck = { ...deck };
    stepDeck(deck, mx, mz, SIM_DT);
    const input: MoveInput = { mx, mz, jump: false, crouch: false };
    this.seq++;
    this.pending.push({ seq: this.seq, input });
    if (this.pending.length > 120) this.pending.shift();
    this.sender?.sendInput(this.seq, input, this.deckFacing);
  }

  private loop(now: number): void {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;

    const look = this.input.consumeLook();
    this.camYaw += look.yaw;
    this.camPitch = Math.max(-0.25, Math.min(1.25, this.camPitch + look.pitch));

    this.boat = vapurState(this.serverNow());
    this.acc += dt;
    while (this.acc >= SIM_DT) {
      this.acc -= SIM_DT;
      this.simStep();
    }

    // local render
    let focus = new THREE.Vector3(KAHVE_SPAWN.x, 1.4, KAHVE_SPAWN.z - 4);
    if (this.body && this.deck && this.prevDeck && this.localChar) {
      // riding the vapur: the deck position (predicted) placed on the boat as it is drawn this frame
      const a = this.acc / SIM_DT;
      const lx = this.prevDeck.x + (this.deck.x - this.prevDeck.x) * a;
      const lz = this.prevDeck.z + (this.deck.z - this.prevDeck.z) * a;
      const w = deckToWorld(this.boat, lx, lz);
      this.body.x = w.x;
      this.body.y = w.y;
      this.body.z = w.z;
      this.prevBody = cloneBody(this.body);
      const ch = this.localChar;
      ch.root.visible = !this.seat;
      ch.root.position.set(w.x, w.y, w.z);
      // the view turns with the boat
      if (this.lastBoatYaw !== null) this.camYaw += wrapAngle(this.boat.yaw - this.lastBoatYaw);
      this.lastBoatYaw = this.boat.yaw;
      const speed = Math.hypot(this.deck.x - this.prevDeck.x, this.deck.z - this.prevDeck.z) / SIM_DT;
      if (speed > 0.1) this.events.onStep?.(speed, false);
      ch.facing = lerpAngle(ch.facing, this.deckFacing + this.boat.yaw, Math.min(1, dt * 14));
      ch.root.rotation.y = ch.facing;
      ch.animate(dt, speed, false, false);
      this.fovKick += (0 - this.fovKick) * Math.min(1, dt * 4);
      focus = new THREE.Vector3(w.x, w.y + 1.5, w.z);
    } else if (this.body && this.prevBody && this.localChar) {
      this.lastBoatYaw = null;
      const a = this.acc / SIM_DT;
      const p = this.prevBody;
      const b = this.body;
      const x = p.x + (b.x - p.x) * a;
      const y = p.y + (b.y - p.y) * a;
      const z = p.z + (b.z - p.z) * a;
      const ch = this.localChar;
      const speed = Math.hypot(b.x - p.x, b.z - p.z) / SIM_DT;
      ch.root.visible = !this.seat;
      ch.root.position.set(x, y + this.localSeatY, z);
      if (b.onGround) this.events.onStep?.(speed, speed > 6);
      this.fovKick += ((speed > 6 ? 1 : 0) - this.fovKick) * Math.min(1, dt * 4);
      ch.facing = lerpAngle(ch.facing, this.facing, Math.min(1, dt * 14));
      ch.root.rotation.y = ch.facing;
      ch.animate(dt, speed, this.crouch, !b.onGround);
      focus = new THREE.Vector3(x, y + (this.crouch ? 1.0 : 1.5), z);
    } else if (!this.body) {
      this.camYaw += dt * 0.05;
    }

    // remotes (interpolated)
    const renderT = performance.now() + (this.serverOffset ?? 0) - INTERP_DELAY;
    for (const r of this.remotes.values()) {
      if (r.fixed) {
        r.char.root.visible = true;
        r.char.root.position.set(r.fixed.x, r.fixed.y, r.fixed.z);
        r.char.root.rotation.y = r.char.facing = r.fixed.yaw;
        r.char.animate(dt, 0, false, false);
        continue;
      }
      const buf = r.buf;
      if (buf.length === 0 || renderT - r.lastSeen > 260) {
        r.char.root.visible = false;
        continue;
      }
      let s0 = buf[0]!;
      let s1 = buf[buf.length - 1]!;
      for (let i = buf.length - 1; i > 0; i--) {
        if (buf[i - 1]!.t <= renderT) {
          s0 = buf[i - 1]!;
          s1 = buf[i]!;
          break;
        }
      }
      const span = s1.t - s0.t;
      const a = span > 0 ? Math.max(0, Math.min(1, (renderT - s0.t) / span)) : 1;
      const x = s0.x + (s1.x - s0.x) * a;
      const y = s0.y + (s1.y - s0.y) * a;
      const z = s0.z + (s1.z - s0.z) * a;
      const wasVisible = r.char.root.visible;
      if (s1.deck) {
        // a rider: interpolate on the deck, then stand on the boat as it is drawn now
        const w = deckToWorld(this.boat, x, z);
        const lspeed = wasVisible && dt > 0 ? Math.hypot(x - r.prevLX, z - r.prevLZ) / dt : 0;
        r.prevLX = x;
        r.prevLZ = z;
        r.char.root.visible = true;
        r.char.root.position.set(w.x, w.y, w.z);
        r.char.facing = lerpAngle(r.char.facing, s1.yaw + this.boat.yaw, Math.min(1, dt * 12));
        r.char.root.rotation.y = r.char.facing;
        r.prevX = w.x;
        r.prevZ = w.z;
        r.char.animate(dt, Math.min(lspeed, 4), false, false);
        continue;
      }
      r.char.root.visible = true;
      r.char.root.position.set(x, y, z);
      r.char.facing = lerpAngle(r.char.facing, s1.yaw, Math.min(1, dt * 12));
      r.char.root.rotation.y = r.char.facing;
      const speed = wasVisible && dt > 0 ? Math.hypot(x - r.prevX, z - r.prevZ) / dt : 0;
      r.prevX = x;
      r.prevZ = z;
      r.char.animate(dt, Math.min(speed, 8), s1.crouch, s1.y > 0.05 && Math.abs(s1.y - s0.y) > 0.01);
    }

    if (this.floats.size) this.updateFloats(dt);
    // short-lived effects
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const e = this.effects[i]!;
      e.t += dt;
      const k = e.t / e.life;
      if (k >= 1) {
        this.scene.remove(e.obj);
        this.effects.splice(i, 1);
      } else e.update(k);
    }

    this.updateCamera(focus, dt);
    this.world.follow?.(focus.x, focus.z);
    const movers: Mover[] = [];
    if (this.body && this.prevBody) movers.push({ x: this.body.x, z: this.body.z, speed: Math.hypot(this.body.x - this.prevBody.x, this.body.z - this.prevBody.z) / SIM_DT });
    for (const r of this.remotes.values()) if (r.char.root.visible) movers.push({ x: r.prevX, z: r.prevZ, speed: 4 });
    this.world.update(dt, movers);
    this.onFrame?.(dt);
    if (!NO_RENDER) this.post.render(dt);
  }

  private updateCamera(focus: THREE.Vector3, dt: number): void {
    if (this.debugCam) {
      this.camera.position.copy(this.debugCam.pos);
      this.camera.lookAt(this.debugCam.target);
      return;
    }
    if ((this.seat || this.watch) && this.kahve) {
      const sv = this.seat
        ? this.kahve.seatView(this.seat.table, this.seat.seat, this.camera.aspect, this.seatBottom)
        : this.kahve.watchView(this.watch!.table, this.watch!.side);
      if (!this.seatCam) {
        // start the look-at from where the camera already looks, not from the origin
        this.seatCam = true;
        this.seatLook.copy(this.camera.position).addScaledVector(this.camera.getWorldDirection(_camDir), 4);
      }
      const k = 1 - Math.exp(-dt * 6);
      this.camera.position.lerp(sv.pos, k);
      this.seatLook.lerp(sv.target, Math.min(1, k * 1.6));
      this.camera.lookAt(this.seatLook);
      if (Math.abs(this.camera.fov - sv.fov) > 0.05) {
        this.camera.fov += (sv.fov - this.camera.fov) * Math.min(1, k * 1.6);
        this.camera.updateProjectionMatrix();
      }
      return;
    }
    this.seatCam = false;
    // only the height is smoothed (steps, curbs, landings); the horizontal follow is exact so the
    // character never wobbles on screen when frame times vary
    if (this.focusY === null || !this.body) this.focusY = focus.y;
    else this.focusY += (focus.y - this.focusY) * (1 - Math.exp(-dt * 12));
    const f = new THREE.Vector3(focus.x, this.focusY, focus.z);
    const dist = this.body ? this.camDist : 22;
    const cp = Math.cos(this.camPitch);
    const dir = new THREE.Vector3(Math.sin(this.camYaw) * cp, Math.sin(this.camPitch), Math.cos(this.camYaw) * cp);
    let want = dist;
    if (this.body) {
      const full = f.clone().addScaledVector(dir, dist);
      full.y += 0.3;
      let tMin = 1;
      for (const c of this.solidCam) {
        const t = segmentEntryT(f, full, c);
        if (t >= 0 && t < tMin) tMin = t;
      }
      if (tMin < 1) want = Math.max(0.7, dist * (tMin - 0.05));
    }
    // pull in fast when something gets in the way, ease back out slowly
    if (this.camDistCur === null) this.camDistCur = want;
    const k = want < this.camDistCur ? 1 - Math.exp(-dt * 30) : 1 - Math.exp(-dt * 3.5);
    this.camDistCur += (want - this.camDistCur) * k;
    const pos = f.clone().addScaledVector(dir, this.camDistCur);
    pos.y += 0.3 * (this.camDistCur / dist);
    if (this.body && pos.y < 0.3) pos.y = 0.3;
    this.camera.position.copy(pos);
    this.camera.lookAt(f);
    if (this.shakeT > 0) {
      this.shakeT -= 1 / 60;
      const a = this.shakeAmp * Math.max(0, this.shakeT / 0.45);
      this.camera.position.x += (Math.random() - 0.5) * a;
      this.camera.position.y += (Math.random() - 0.5) * a;
    } else this.shakeAmp = 0;
    const baseFov = this.camera.aspect < 1 ? 75 : 62;
    const fov = baseFov + this.fovKick * 6;
    if (Math.abs(this.camera.fov - fov) > 0.05) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.resizeObs.disconnect();
    this.input.detach();
    for (const id of [...this.remotes.keys()]) this.removeRemote(id);
    this.post.dispose();
    this.renderer.dispose();
  }
}

function wrapAngle(d: number): number {
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function lerpAngle(a: number, b: number, t: number): number {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}
