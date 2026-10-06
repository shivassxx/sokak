/**
 * Action map: game logic only ever reads actions, never raw keys.
 * Sources: keyboard + mouse (desktop), on-screen joystick / drag-look /
 * React buttons (touch).
 */
export type Action =
  | 'forward'
  | 'back'
  | 'left'
  | 'right'
  | 'jump'
  | 'crouch'
  | 'spot'
  | 'scoreboard'
  | 'emote1'
  | 'emote2'
  | 'emote3'
  | 'emote4';

const KEYS: Record<string, Action> = {
  KeyW: 'forward',
  ArrowUp: 'forward',
  KeyS: 'back',
  ArrowDown: 'back',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
  Space: 'jump',
  KeyC: 'crouch',
  KeyE: 'spot',
  KeyF: 'spot',
  Tab: 'scoreboard',
  Digit1: 'emote1',
  Digit2: 'emote2',
  Digit3: 'emote3',
  Digit4: 'emote4',
};

export type PressListener = (action: Action) => void;

export class Input {
  private held = new Set<Action>();
  private uiHeld = new Set<Action>();
  private listeners = new Set<PressListener>();
  /** joystick vector, x right, y forward, |v| ≤ 1 */
  joy = { x: 0, y: 0 };
  /** accumulated look deltas in radians, consumed each frame */
  look = { yaw: 0, pitch: 0 };
  enabled = true;
  private cleanup: (() => void)[] = [];
  private joyId: number | null = null;
  private joyOrigin = { x: 0, y: 0 };
  private lookId: number | null = null;
  private lookLast = { x: 0, y: 0 };
  private mouseDrag = false;
  /** visual joystick state for the HUD */
  joyVisual: { active: boolean; ox: number; oy: number; x: number; y: number } = { active: false, ox: 0, oy: 0, x: 0, y: 0 };

  attach(el: HTMLElement): void {
    const on = <K extends keyof WindowEventMap>(t: EventTarget, type: K, fn: (e: WindowEventMap[K]) => void, opts?: AddEventListenerOptions) => {
      t.addEventListener(type, fn as EventListener, opts);
      this.cleanup.push(() => t.removeEventListener(type, fn as EventListener));
    };
    on(window, 'keydown', (e) => {
      const a = KEYS[e.code];
      if (!a || isTyping(e)) return;
      if (a === 'scoreboard' || a === 'jump') e.preventDefault();
      if (!this.held.has(a)) {
        this.held.add(a);
        if (!e.repeat) this.emit(a);
      }
    });
    on(window, 'keyup', (e) => {
      const a = KEYS[e.code];
      if (a) this.held.delete(a);
    });
    on(window, 'blur', () => this.held.clear());

    on(el, 'pointerdown', (e) => {
      if (e.pointerType === 'mouse') {
        if (e.button === 0 || e.button === 2) {
          this.mouseDrag = true;
          this.lookLast = { x: e.clientX, y: e.clientY };
        }
        return;
      }
      const leftSide = e.clientX < window.innerWidth * 0.45;
      if (leftSide && this.joyId === null) {
        this.joyId = e.pointerId;
        this.joyOrigin = { x: e.clientX, y: e.clientY };
        this.joyVisual = { active: true, ox: e.clientX, oy: e.clientY, x: e.clientX, y: e.clientY };
      } else if (this.lookId === null) {
        this.lookId = e.pointerId;
        this.lookLast = { x: e.clientX, y: e.clientY };
      }
    });
    on(window, 'pointermove', (e) => {
      if (e.pointerType === 'mouse') {
        if (document.pointerLockElement === el) {
          this.addLook(e.movementX, e.movementY, 0.0028);
        } else if (this.mouseDrag) {
          this.addLook(e.clientX - this.lookLast.x, e.clientY - this.lookLast.y, 0.006);
          this.lookLast = { x: e.clientX, y: e.clientY };
        }
        return;
      }
      if (e.pointerId === this.joyId) {
        const R = 55;
        let dx = e.clientX - this.joyOrigin.x;
        let dy = e.clientY - this.joyOrigin.y;
        const l = Math.hypot(dx, dy);
        if (l > R) {
          dx = (dx / l) * R;
          dy = (dy / l) * R;
        }
        this.joy = { x: dx / R, y: -dy / R };
        this.joyVisual = { ...this.joyVisual, x: this.joyOrigin.x + dx, y: this.joyOrigin.y + dy };
      } else if (e.pointerId === this.lookId) {
        this.addLook(e.clientX - this.lookLast.x, e.clientY - this.lookLast.y, 0.008);
        this.lookLast = { x: e.clientX, y: e.clientY };
      }
    });
    const end = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') this.mouseDrag = false;
      if (e.pointerId === this.joyId) {
        this.joyId = null;
        this.joy = { x: 0, y: 0 };
        this.joyVisual = { ...this.joyVisual, active: false };
      }
      if (e.pointerId === this.lookId) this.lookId = null;
    };
    on(window, 'pointerup', end);
    on(window, 'pointercancel', end);
    on(el, 'contextmenu', (e) => e.preventDefault());
    on(el, 'dblclick', () => {
      if (matchMedia('(pointer: fine)').matches) el.requestPointerLock?.();
    });
  }

  detach(): void {
    for (const c of this.cleanup) c();
    this.cleanup = [];
  }

  private addLook(dx: number, dy: number, s: number): void {
    if (!this.enabled) return;
    this.look.yaw -= dx * s;
    this.look.pitch += dy * s;
  }

  consumeLook(): { yaw: number; pitch: number } {
    const l = this.look;
    this.look = { yaw: 0, pitch: 0 };
    return l;
  }

  /** For on-screen buttons. */
  setHeld(a: Action, down: boolean): void {
    if (down) {
      if (!this.uiHeld.has(a)) this.emit(a);
      this.uiHeld.add(a);
    } else this.uiHeld.delete(a);
  }

  trigger(a: Action): void {
    this.emit(a);
  }

  isHeld(a: Action): boolean {
    return this.enabled && (this.held.has(a) || this.uiHeld.has(a));
  }

  /** Movement intent relative to the camera: x right, y forward. */
  moveVector(): { x: number; y: number } {
    if (!this.enabled) return { x: 0, y: 0 };
    let x = this.joy.x;
    let y = this.joy.y;
    if (this.isHeld('forward')) y += 1;
    if (this.isHeld('back')) y -= 1;
    if (this.isHeld('right')) x += 1;
    if (this.isHeld('left')) x -= 1;
    const l = Math.hypot(x, y);
    return l > 1 ? { x: x / l, y: y / l } : { x, y };
  }

  onPress(fn: PressListener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(a: Action): void {
    if (!this.enabled && a !== 'scoreboard') return;
    for (const l of this.listeners) l(a);
  }
}

function isTyping(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement | null;
  return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA');
}
