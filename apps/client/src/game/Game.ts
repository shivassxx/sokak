import * as THREE from 'three';
import {
  BASE,
  COLLIDERS,
  EBE_COUNT_SPOT,
  SIM_DT,
  cloneBody,
  createBody,
  segmentEntryT,
  stepBody,
  type Body,
  type MoveInput,
} from '@sokak/shared';
import { Character, type Emote } from './character';
import { Input } from './input';
import { buildWorld, type World } from './world';
import { setupLighting, type Lighting } from './lighting';

export interface InputSender {
  sendInput(seq: number, input: MoveInput, yaw: number): void;
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
  prevX: number;
  prevZ: number;
}

const SOLID_CAM = COLLIDERS.filter((c) => c.solid && c.maxY - c.minY > 1);
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

  private lighting: Lighting;
  private world: World;
  private dusk = 0.15;
  private duskTarget = 0.15;
  private raf = 0;
  private last = performance.now();
  private resizeObs: ResizeObserver;
  private disposed = false;
  onFrame: ((dt: number) => void) | null = null;

  constructor(private canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: window.devicePixelRatio < 2, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.lighting = setupLighting(this.scene, this.renderer);
    this.world = buildWorld(this.scene);
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
  setDusk(d: number): void {
    this.duskTarget = Math.max(0, Math.min(1, d));
  }

  private applyDusk(): void {
    this.lighting.setDusk(this.dusk);
    this.world.setDusk(this.dusk);
  }

  // ------------------------------------------------------------ local player
  spawnLocal(x: number, y: number, z: number, color: string, facing = 0): void {
    this.body = createBody(x, z, y);
    this.prevBody = cloneBody(this.body);
    this.pending = [];
    this.facing = facing;
    this.camYaw = facing;
    if (!this.localChar) {
      this.localChar = new Character(color);
      this.scene.add(this.localChar.root);
    } else this.localChar.setColor(color);
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

  /** Server reconciliation: authoritative state after input `ack`. */
  reconcile(ack: number, x: number, y: number, z: number, vy: number, onGround: boolean): void {
    if (!this.body) return;
    const b: Body = { x, y, z, vy, onGround };
    this.pending = this.pending.filter((p) => p.seq > ack);
    for (const p of this.pending) stepBody(b, p.input);
    const err = Math.hypot(b.x - this.body.x, b.y - this.body.y, b.z - this.body.z);
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
  upsertRemote(id: string, color: string, label: string, labelColor?: string): void {
    let r = this.remotes.get(id);
    const key = `${color}|${label}|${labelColor ?? ''}`;
    if (r?.key === key) return;
    if (!r) {
      r = { char: new Character(color), key, buf: [], lastSeen: 0, prevX: 0, prevZ: 0 };
      r.char.root.visible = false;
      this.scene.add(r.char.root);
      this.remotes.set(id, r);
    } else r.char.setColor(color);
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
    this.camera.aspect = w / h;
    this.camera.fov = w < h ? 75 : 62;
    this.camera.updateProjectionMatrix();
  }

  private simStep(): void {
    if (!this.body) return;
    let input: MoveInput = { mx: 0, mz: 0, jump: false, crouch: this.crouch };
    if (!this.frozen) {
      const mv = this.input.moveVector();
      const s = Math.sin(this.camYaw);
      const c = Math.cos(this.camYaw);
      // forward = (-sin, -cos), right = (cos, -sin)
      const mx = -s * mv.y + c * mv.x;
      const mz = -c * mv.y - s * mv.x;
      input = { mx, mz, jump: this.jumpQueued || this.input.isHeld('jump'), crouch: this.crouch };
      if (Math.hypot(mx, mz) > 0.1) this.facing = Math.atan2(-mx, -mz);
    }
    this.jumpQueued = false;
    this.prevBody = cloneBody(this.body);
    stepBody(this.body, input, SIM_DT);
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
    let focus = new THREE.Vector3(BASE.x, 1.4, BASE.z + 6);
    if (this.body && this.prevBody && this.localChar) {
      const a = this.acc / SIM_DT;
      const p = this.prevBody;
      const b = this.body;
      const x = p.x + (b.x - p.x) * a;
      const y = p.y + (b.y - p.y) * a;
      const z = p.z + (b.z - p.z) * a;
      const ch = this.localChar;
      const speed = Math.hypot(b.x - p.x, b.z - p.z) / SIM_DT;
      ch.root.position.set(x, y, z);
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
      r.char.animate(dt, Math.min(speed, 8), s1.crouch, false);
    }

    this.updateCamera(focus);
    this.lighting.follow(focus.x, focus.z);
    if (Math.abs(this.dusk - this.duskTarget) > 0.002) {
      this.dusk += (this.duskTarget - this.dusk) * Math.min(1, dt * 0.5);
      this.applyDusk();
    }
    this.world.update(dt);
    this.onFrame?.(dt);
    this.renderer.render(this.scene, this.camera);
  }

  private updateCamera(focus: THREE.Vector3): void {
    if (this.frozen && this.body) {
      // counting Ebe: face the wall, close
      this.camera.position.set(EBE_COUNT_SPOT.x, 1.7, EBE_COUNT_SPOT.z + 1.6);
      this.camera.lookAt(EBE_COUNT_SPOT.x, 1.4, EBE_COUNT_SPOT.z - 3);
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
      for (const c of SOLID_CAM) {
        const t = segmentEntryT(focus, desired, c);
        if (t >= 0 && t < tMin) tMin = t;
      }
      if (tMin < 1) desired.lerpVectors(focus, desired, Math.max(0.12, tMin - 0.05));
      if (desired.y < 0.3) desired.y = 0.3;
    }
    this.camera.position.lerp(desired, 0.5);
    this.camera.lookAt(focus);
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.resizeObs.disconnect();
    this.input.detach();
    for (const id of [...this.remotes.keys()]) this.removeRemote(id);
    this.renderer.dispose();
  }
}

function lerpAngle(a: number, b: number, t: number): number {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}
