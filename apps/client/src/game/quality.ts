/**
 * Graphics quality ("Grafik kalitesi"): the player's preset (Düşük / Orta / Yüksek / Otomatik),
 * the render settings of each tier, a device guess and the automatic tuner that watches the frame
 * time. No three.js import here: the settings panel on the home screen uses this module and the
 * lobby bundle must stay small.
 */
export type Tier = 'low' | 'medium' | 'high';
export type QualitySetting = Tier | 'auto';

export interface TierSpec {
  /** cap on window.devicePixelRatio */
  pixelRatio: number;
  shadows: boolean;
  shadowMapSize: number;
  /** half-size of the sun's shadow box around the player (m) */
  shadowDistance: number;
  /** post-processing passes; none of them → plain forward render with the canvas MSAA */
  post: { ao: boolean; bloom: boolean; grade: boolean; msaa: number } | null;
}

export const TIERS: Record<Tier, TierSpec> = {
  high: { pixelRatio: 1.75, shadows: true, shadowMapSize: 2048, shadowDistance: 30, post: { ao: true, bloom: true, grade: true, msaa: 4 } },
  medium: { pixelRatio: 1.5, shadows: true, shadowMapSize: 1024, shadowDistance: 22, post: { ao: false, bloom: true, grade: true, msaa: 2 } },
  low: { pixelRatio: 1.25, shadows: false, shadowMapSize: 512, shadowDistance: 16, post: null },
};

export const TIER_ORDER: readonly Tier[] = ['low', 'medium', 'high'];
export const SETTING_LABEL: Record<QualitySetting, string> = { low: 'Düşük', medium: 'Orta', high: 'Yüksek', auto: 'Otomatik' };

const KEY = 'sokak.quality';
const FPS_KEY = 'sokak.showFps';

function readLS(key: string): string | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeLS(key: string, v: string): void {
  try {
    localStorage.setItem(key, v);
  } catch {
    /* private mode / blocked storage: the choice just lasts for this page */
  }
}

/** A dev/test override in the URL (?q=low|medium|high) wins over the stored preset. */
function urlTier(): Tier | null {
  if (typeof location === 'undefined') return null;
  const q = new URLSearchParams(location.search).get('q');
  return q === 'high' || q === 'medium' || q === 'low' ? q : null;
}

let rendererName: string | null | undefined;
/** The GPU's name, read once from a throwaway WebGL context (null when hidden or unavailable). */
function gpuName(): string | null {
  if (rendererName !== undefined) return rendererName;
  rendererName = null;
  try {
    const gl = document.createElement('canvas').getContext('webgl');
    if (gl) {
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      rendererName = String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER) ?? '') || null;
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    }
  } catch {
    /* ignore */
  }
  return rendererName;
}

/** Where Otomatik starts: phones and weak/software GPUs low or medium, desktops high. */
export function guessTier(info?: { touch: boolean; cores: number; gpu: string | null }): Tier {
  const i = info ?? {
    touch: typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches,
    cores: (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) || 4,
    gpu: typeof document !== 'undefined' ? gpuName() : null,
  };
  const gpu = (i.gpu ?? '').toLowerCase();
  if (/swiftshader|llvmpipe|software|softpipe|microsoft basic/.test(gpu)) return 'low';
  if (i.touch) return i.cores >= 8 ? 'medium' : 'low';
  if (i.cores <= 4 || /intel|uhd|hd graphics|mali|adreno/.test(gpu)) return 'medium';
  return 'high';
}

// ------------------------------------------------------------------ store
type Listener = () => void;
const listeners = new Set<Listener>();
const emit = () => listeners.forEach((l) => l());

function readSetting(): QualitySetting {
  const s = readLS(KEY);
  return s === 'low' || s === 'medium' || s === 'high' || s === 'auto' ? s : 'auto';
}

let setting: QualitySetting = readSetting();
let tier: Tier | null = null;
let tuner: AutoTuner | null = null;
let showFps = readLS(FPS_KEY) === '1';

export function qualitySetting(): QualitySetting {
  return setting;
}

/** The tier in use (for Otomatik: the tuner's current pick). */
export function currentTier(): Tier {
  if (!tier) {
    tier = urlTier() ?? (setting === 'auto' ? guessTier() : setting);
    if (setting === 'auto' && !urlTier()) tuner = new AutoTuner(tier);
  }
  return tier;
}

/** The tier the world is built with (foliage density, lamps, avatar detail, strollers). */
export const initialQuality = currentTier;

export function setQualitySetting(s: QualitySetting): void {
  setting = s;
  writeLS(KEY, s);
  const t = s === 'auto' ? guessTier() : s;
  tuner = s === 'auto' ? new AutoTuner(t) : null;
  tier = t;
  emit();
}

export function fpsVisible(): boolean {
  return showFps;
}
export function setFpsVisible(v: boolean): void {
  showFps = v;
  writeLS(FPS_KEY, v ? '1' : '0');
  emit();
}

export function onQualityChange(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

// ------------------------------------------------------------------ frame meter
let meterT = 0;
let meterN = 0;
let fps = 0;
/** Average fps over the last half second (for the "FPS göster" counter). */
export function measuredFps(): number {
  return fps;
}

/** Called once per rendered frame by the game loop. */
export function qualityFrame(dt: number): void {
  if (dt > 0 && dt < 5) {
    meterT += dt;
    meterN++;
    if (meterT >= 0.5) {
      fps = meterN / meterT;
      meterT = 0;
      meterN = 0;
    }
  }
  if (!tuner) return;
  const next = tuner.feed(dt);
  if (next) {
    tier = next;
    emit();
  }
}

// ------------------------------------------------------------------ automatic tuning
/**
 * Watches the frame time in one-second windows.
 *  - Down: fps under 45 for 3 windows in a row during the first ~12 s, or for 6 in a row later.
 *  - Up: only after 30 s of steady ≥ 57 fps, and never back to a tier that was already too slow
 *    (so it cannot flap). A refresh-rate cap of 60 makes "headroom" invisible, hence the caution.
 * Single frames count at most 0.25 s (a tab switch or shader compile is one hitch, not a trend),
 * and the 2 s after every change are ignored.
 */
export class AutoTuner {
  private t = 0;
  private sinceChange = 0;
  private winT = 0;
  private winN = 0;
  private slow = 0;
  private fast = 0;
  private readonly tooSlow = new Set<Tier>();

  constructor(public tier: Tier) {}

  feed(rawDt: number): Tier | null {
    if (!(rawDt > 0)) return null;
    const dt = Math.min(rawDt, 0.25);
    this.t += dt;
    this.sinceChange += dt;
    if (this.sinceChange < 2) return null;
    this.winT += dt;
    this.winN++;
    if (this.winT < 1) return null;
    const f = this.winN / this.winT;
    this.winT = 0;
    this.winN = 0;
    if (f < 45) this.slow++;
    else if (f >= 50) this.slow = 0;
    this.fast = f >= 57 ? this.fast + 1 : 0;
    const idx = TIER_ORDER.indexOf(this.tier);
    if (this.slow >= (this.t < 12 ? 3 : 6) && idx > 0) {
      this.tooSlow.add(this.tier);
      return this.change(TIER_ORDER[idx - 1]!);
    }
    const up = TIER_ORDER[idx + 1];
    if (this.fast >= 30 && up && !this.tooSlow.has(up)) return this.change(up);
    return null;
  }

  private change(t: Tier): Tier {
    this.tier = t;
    this.sinceChange = 0;
    this.slow = 0;
    this.fast = 0;
    return t;
  }
}
