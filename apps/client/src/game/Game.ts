import * as THREE from 'three';
import {
  BASE,
  COLLIDERS,
  CONTAINERS,
  KAHVE_COLLIDERS,
  KAHVE_SPAWN,
  KAHVE_WORLD,
  MAHALLE_WORLD,
  type CollisionWorld,
  EBE_COUNT_SPOT,
  SIM_DT,
  cloneBody,
  createBody,
  segmentEntryT,
  stepBody,
  type Body,
  type Look,
  type MoveInput,
} from '@sokak/shared';
import { Character, type Emote, type Pose } from './character';
export { loadCharacterKit } from './character';
import { Input } from './input';
import { buildWorld, type Mover, type World } from './world';
import { setupLighting, type Lighting } from './lighting';
import { PostFX, initialQuality } from './postfx';
import type { KahveScene } from './kahveScene';

export type Level = 'mahalle' | 'kahve';

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
}

interface Remote {
  char: Character;
  key: string;
  buf: Sample[];
  lastSeen: number;
  /** placed directly (seated bots), not interpolated */
  fixed: { x: number; y: number; z: number; yaw: number } | null;
  prevX: number;
  prevZ: number;
}

const SOLID_CAM_MAHALLE = COLLIDERS.filter((c) => c.solid && c.maxY - c.minY > 1);
const SOLID_CAM_KAHVE = KAHVE_COLLIDERS.filter((c) => c.solid && c.maxY - c.minY > 1.5);
const INTERP_DELAY = 110;

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
  /** container index when hiding inside one, -1 otherwise (server authoritative) */
  inside = -1;
  private wasOnGround = true;
  private shakeT = 0;
  private shakeAmp = 0;
  private fovKick = 0;
  private effects: { obj: THREE.Object3D; t: number; life: number; update: (k: number) => void }[] = [];
  events: LocalEvents = {};
  private facing = 0;
  private seq = 0;
  private pending: Pending[] = [];
  private acc = 0;

  /** frozen = cannot move (Ebe while counting) */
  frozen = false;
  camYaw = 0;
  camPitch = 0.45;
  private camDist = 5.2;

  private remotes = new Map<string, Remote>();
  private serverOffset: number | null = null;
  sender: InputSender | null = null;

  private lighting: Lighting | null = null;
  private post: PostFX;
  private world: World;
  /** kahvehane-only scene helpers (waiter, drinks, racks) */
  kahve: KahveScene | null = null;
  private phys: CollisionWorld;
  private solidCam: typeof SOLID_CAM_MAHALLE;
  /** seated at an okey table: camera from the seat looking down at the table */
  seat: { table: number; seat: number } | null = null;
  /** NDC y of the top of the on-screen rack (the table is framed above it) */
  seatBottom = -0.42;
  private seatLook = new THREE.Vector3();
  /** dev-only: fixed camera for screenshots */
  debugCam: { pos: THREE.Vector3; target: THREE.Vector3 } | null = null;
  private dusk = 0.15;
  private duskTarget = 0.15;
  private raf = 0;
  private last = performance.now();
  private resizeObs: ResizeObserver;
  private disposed = false;
  onFrame: ((dt: number) => void) | null = null;

  constructor(
    private canvas: HTMLCanvasElement,
    readonly level: Level = 'mahalle',
    kahveBuilder?: (scene: THREE.Scene, renderer: THREE.WebGLRenderer) => KahveScene,
  ) {
    this.phys = level === 'kahve' ? KAHVE_WORLD : MAHALLE_WORLD;
    this.solidCam = level === 'kahve' ? SOLID_CAM_KAHVE : SOLID_CAM_MAHALLE;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    const quality = initialQuality();
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    if (level === 'kahve' && kahveBuilder) {
      this.kahve = kahveBuilder(this.scene, this.renderer);
      this.world = this.kahve;
      this.camDist = 4.2;
    } else {
      this.lighting = setupLighting(this.scene, this.renderer);
      this.world = buildWorld(this.scene);
    }
    this.post = new PostFX(this.renderer, this.scene, this.camera, quality, level === 'kahve' ? { bloomStrength: 0.4, aoRadius: 0.45, vignette: 0.38 } : {});
    this.applyDusk();
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

  /** 0 = golden hour, 1 = night; eased over time */
  setDusk(d: number, instant = false): void {
    this.duskTarget = Math.max(0, Math.min(1, d));
    if (instant) {
      this.dusk = this.duskTarget;
      this.applyDusk();
    }
  }

  private applyDusk(): void {
    this.lighting?.setDusk(this.dusk);
    this.world.setDusk(this.dusk);
    if (this.level === 'mahalle') this.post?.setBloom(0.22 + this.dusk * 0.55);
  }

  // ------------------------------------------------------------ local player
  spawnLocal(x: number, y: number, z: number, look: Look, facing = 0): void {
    this.body = createBody(x, z, y);
    this.prevBody = cloneBody(this.body);
    this.pending = [];
    this.facing = facing;
    this.camYaw = facing;
    if (!this.localChar) {
      this.localChar = new Character(look, { adult: this.level === 'kahve' });
      this.scene.add(this.localChar.root);
    } else this.localChar.setLook(look);
    this.localChar.root.visible = true;
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

  /** Server says where a pebble landed: little stone + "TIK!" + ripple. */
  pebble(x: number, z: number): void {
    const g = new THREE.Group();
    const stone = new THREE.Mesh(new THREE.DodecahedronGeometry(0.09), new THREE.MeshStandardMaterial({ color: 0x8d8a85 }));
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.42, 24), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.09;
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 64;
    const ctx = c.getContext('2d')!;
    ctx.font = '900 46px "Trebuchet MS", sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 8;
    ctx.strokeStyle = '#2b2118';
    ctx.strokeText('TIK!', 64, 48);
    ctx.fillStyle = '#ffd27a';
    ctx.fillText('TIK!', 64, 48);
    const tex = new THREE.CanvasTexture(c);
    const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
    label.scale.set(1.4, 0.7, 1);
    g.add(stone, ring, label);
    g.position.set(x, 0, z);
    this.scene.add(g);
    this.effects.push({
      obj: g,
      t: 0,
      life: 1.6,
      update: (k) => {
        stone.position.y = Math.max(0.08, 3 * (1 - k * 4)) ;
        ring.scale.setScalar(1 + k * 5);
        (ring.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.8 - k);
        label.position.y = 1 + k * 1.2;
        (label.material as THREE.SpriteMaterial).opacity = Math.max(0, 1 - k * 1.1);
      },
    });
  }

  /** Round poses for characters (null id = local player). */
  setPose(id: string | null, pose: Pose): void {
    const ch = id === null ? this.localChar : this.remotes.get(id)?.char;
    if (ch) ch.pose = pose;
  }

  /** Server reconciliation: authoritative state after input `ack`. */
  reconcile(ack: number, x: number, y: number, z: number, vy: number, onGround: boolean, stamina = 1, tired = false, inside = -1): void {
    if (!this.body) return;
    this.inside = inside;
    const b: Body = { x, y, z, vy, onGround, stamina, tired };
    this.pending = this.pending.filter((p) => p.seq > ack);
    for (const p of this.pending) stepBody(b, p.input, SIM_DT, this.phys);
    const err = Math.hypot(b.x - this.body.x, b.y - this.body.y, b.z - this.body.z);
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

  // ------------------------------------------------------------ remotes
  /** Local look changes (e.g. lobby customisation). */
  setLocalLook(look: Look): void {
    this.localChar?.setLook(look);
  }

  upsertRemote(id: string, look: Look, label: string, labelColor?: string): void {
    let r = this.remotes.get(id);
    const key = `${look.color}|${look.hat}|${look.hair}|${look.skin}|${label}|${labelColor ?? ''}`;
    if (r?.key === key) return;
    if (!r) {
      r = { char: new Character(look, { adult: this.level === 'kahve' }), key, buf: [], lastSeen: 0, prevX: 0, prevZ: 0, fixed: null };
      r.char.root.visible = false;
      this.scene.add(r.char.root);
      this.remotes.set(id, r);
    } else r.char.setLook(look);
    r.key = key;
    r.char.setLabel(label, labelColor);
  }

  removeRemote(id: string): void {
    const r = this.remotes.get(id);
    if (!r) return;
    this.scene.remove(r.char.root);
    r.char.dispose();
    this.remotes.delete(id);
  }

  /** Hide name tags (e.g. while seated at a table, they would cover the board). */
  setLabelsVisible(v: boolean): void {
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

  pushRemote(id: string, t: number, x: number, y: number, z: number, yaw: number, crouch: boolean): void {
    const r = this.remotes.get(id);
    if (!r) return;
    r.buf.push({ t, x, y, z, yaw, crouch });
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
    let input: MoveInput = { mx: 0, mz: 0, jump: false, crouch: this.crouch };
    if (!this.frozen && this.inside < 0) {
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

  private loop(now: number): void {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;

    const look = this.input.consumeLook();
    if (!this.frozen || !this.body) {
      this.camYaw += look.yaw;
      this.camPitch = Math.max(-0.25, Math.min(1.25, this.camPitch + look.pitch));
    }

    this.acc += dt;
    while (this.acc >= SIM_DT) {
      this.acc -= SIM_DT;
      this.simStep();
    }

    // local render
    let focus = this.level === 'kahve' ? new THREE.Vector3(KAHVE_SPAWN.x, 1.4, KAHVE_SPAWN.z - 4) : new THREE.Vector3(BASE.x, 1.4, BASE.z + 6);
    if (this.body && this.prevBody && this.localChar) {
      const a = this.acc / SIM_DT;
      const p = this.prevBody;
      const b = this.body;
      const x = p.x + (b.x - p.x) * a;
      const y = p.y + (b.y - p.y) * a;
      const z = p.z + (b.z - p.z) * a;
      const ch = this.localChar;
      const speed = Math.hypot(b.x - p.x, b.z - p.z) / SIM_DT;
      ch.root.visible = this.inside < 0 && !this.seat;
      ch.root.position.set(x, y, z);
      if (b.onGround) this.events.onStep?.(speed, speed > 6);
      this.fovKick += ((speed > 6 ? 1 : 0) - this.fovKick) * Math.min(1, dt * 4);
      ch.facing = lerpAngle(ch.facing, this.facing, Math.min(1, dt * 14));
      ch.root.rotation.y = ch.facing;
      ch.animate(dt, speed, this.crouch, !b.onGround);
      focus = new THREE.Vector3(x, y + (this.crouch ? 1.0 : 1.5), z);
      if (this.inside >= 0) {
        const c = CONTAINERS[this.inside];
        if (c) focus = new THREE.Vector3(c.x, 1.6, c.z);
      }
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
      r.char.root.visible = true;
      r.char.root.position.set(x, y, z);
      r.char.facing = lerpAngle(r.char.facing, s1.yaw, Math.min(1, dt * 12));
      r.char.root.rotation.y = r.char.facing;
      const speed = wasVisible && dt > 0 ? Math.hypot(x - r.prevX, z - r.prevZ) / dt : 0;
      r.prevX = x;
      r.prevZ = z;
      r.char.animate(dt, Math.min(speed, 8), s1.crouch, s1.y > 0.05 && Math.abs(s1.y - s0.y) > 0.01);
    }

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

    this.updateCamera(focus);
    this.lighting?.follow(focus.x, focus.z);
    if (Math.abs(this.dusk - this.duskTarget) > 0.002) {
      this.dusk += (this.duskTarget - this.dusk) * Math.min(1, dt * 0.5);
      this.applyDusk();
    }
    const movers: Mover[] = [];
    if (this.body && this.prevBody) movers.push({ x: this.body.x, z: this.body.z, speed: Math.hypot(this.body.x - this.prevBody.x, this.body.z - this.prevBody.z) / SIM_DT });
    for (const r of this.remotes.values()) if (r.char.root.visible) movers.push({ x: r.prevX, z: r.prevZ, speed: 4 });
    this.world.update(dt, movers);
    this.onFrame?.(dt);
    this.post.render(dt);
  }

  private updateCamera(focus: THREE.Vector3): void {
    if (this.debugCam) {
      this.camera.position.copy(this.debugCam.pos);
      this.camera.lookAt(this.debugCam.target);
      return;
    }
    if (this.seat && this.kahve) {
      const sv = this.kahve.seatView(this.seat.table, this.seat.seat, this.camera.aspect, this.seatBottom);
      this.camera.position.lerp(sv.pos, 0.12);
      this.seatLook.lerp(sv.target, 0.2);
      this.camera.lookAt(this.seatLook);
      if (Math.abs(this.camera.fov - sv.fov) > 0.05) {
        this.camera.fov += (sv.fov - this.camera.fov) * 0.2;
        this.camera.updateProjectionMatrix();
      }
      return;
    }
    if (this.frozen && this.body) {
      // counting Ebe: face the wall, close
      this.camera.position.set(EBE_COUNT_SPOT.x + 1.2, 2.3, EBE_COUNT_SPOT.z + 3.4);
      this.camera.lookAt(EBE_COUNT_SPOT.x, 1.2, EBE_COUNT_SPOT.z - 1);
      return;
    }
    const dist = this.body ? this.camDist : 22;
    const cp = Math.cos(this.camPitch);
    const desired = new THREE.Vector3(
      focus.x + Math.sin(this.camYaw) * dist * cp,
      focus.y + Math.sin(this.camPitch) * dist + 0.3,
      focus.z + Math.cos(this.camYaw) * dist * cp,
    );
    if (this.body) {
      let tMin = 1;
      for (const c of this.solidCam) {
        const t = segmentEntryT(focus, desired, c);
        if (t >= 0 && t < tMin) tMin = t;
      }
      if (tMin < 1) desired.lerpVectors(focus, desired, Math.max(0.12, tMin - 0.05));
      if (desired.y < 0.3) desired.y = 0.3;
    }
    this.camera.position.lerp(desired, 0.5);
    this.camera.lookAt(focus);
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

function lerpAngle(a: number, b: number, t: number): number {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}
