/**
 * Sound: CC0 samples from Kenney starter kits (public/sfx) with procedural
 * WebAudio fallbacks, a looping street ambience, footsteps and optional
 * browser speech for the Turkish calls.
 */
type Sfx = 'tick' | 'go' | 'spotted' | 'caught' | 'safe' | 'herkes' | 'pop' | 'roundEnd' | 'click' | 'jump' | 'land' | 'pebble' | 'step';

const SAMPLE_FILES = {
  walking: 'walking.ogg',
  jump: 'jump.ogg',
  land: 'land.ogg',
  coin: 'coin.ogg',
  break: 'break.ogg',
  click: 'click.ogg',
  pop: 'pop.ogg',
  thud: 'thud.ogg',
  ambience: 'ambience.ogg',
} as const;
type SampleName = keyof typeof SAMPLE_FILES;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let sfxBus: GainNode | null = null;
let ambienceBus: GainNode | null = null;
const samples = new Map<SampleName, AudioBuffer>();
let loading = false;
let ambienceSrc: AudioBufferSourceNode | null = null;
let stepSrc: AudioBufferSourceNode | null = null;
let stepGain: GainNode | null = null;

let muted = (() => {
  try {
    return localStorage.getItem('sokak.muted') === '1';
  } catch {
    return false;
  }
})();

function ac(): AudioContext | null {
  if (ctx) return ctx;
  const C = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!C) return null;
  ctx = new C();
  master = ctx.createGain();
  master.gain.value = muted ? 0 : 0.7;
  master.connect(ctx.destination);
  sfxBus = ctx.createGain();
  sfxBus.connect(master);
  ambienceBus = ctx.createGain();
  ambienceBus.gain.value = 0.22;
  ambienceBus.connect(master);
  return ctx;
}

async function loadSamples(): Promise<void> {
  const c = ac();
  if (!c || loading) return;
  loading = true;
  const base = `${import.meta.env.BASE_URL}sfx/`;
  await Promise.all(
    (Object.keys(SAMPLE_FILES) as SampleName[]).map(async (name) => {
      try {
        const res = await fetch(base + SAMPLE_FILES[name]);
        const buf = await c.decodeAudioData(await res.arrayBuffer());
        samples.set(name, buf);
      } catch {
        /* unsupported codec (e.g. old Safari) → synth fallback */
      }
    }),
  );
}

/** Call from a user gesture (browsers block audio until then). */
export function unlockAudio(): void {
  const c = ac();
  if (!c) return;
  if (c.state === 'suspended') void c.resume();
  void loadSamples();
}

export function isMuted(): boolean {
  return muted;
}

export function setMuted(m: boolean): void {
  muted = m;
  try {
    localStorage.setItem('sokak.muted', m ? '1' : '0');
  } catch {
    /* ignore */
  }
  if (master) master.gain.value = m ? 0 : 0.7;
  if (m) window.speechSynthesis?.cancel();
}

function playSample(name: SampleName, vol = 1, rate = 1, pan = 0): boolean {
  const c = ctx;
  const buf = samples.get(name);
  if (!c || !buf || !sfxBus || muted) return !!buf;
  const src = c.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = rate;
  const g = c.createGain();
  g.gain.value = vol;
  let node: AudioNode = src.connect(g);
  if (pan && c.createStereoPanner) {
    const p = c.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, pan));
    node = node.connect(p);
  }
  node.connect(sfxBus);
  src.start();
  return true;
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = 'sine', vol = 0.4, slideTo?: number): void {
  const c = ctx;
  if (!c || !sfxBus) return;
  const t = c.currentTime + start;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(sfxBus);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function noise(start: number, dur: number, vol = 0.3, freq = 800): void {
  const c = ctx;
  if (!c || !sfxBus) return;
  const t = c.currentTime + start;
  const buf = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = freq;
  const g = c.createGain();
  g.gain.value = vol;
  src.connect(f).connect(g).connect(sfxBus);
  src.start(t);
}

/** pan: -1 left … 1 right (for directional sounds) */
export function play(s: Sfx, pan = 0): void {
  if (muted || !ac()) return;
  switch (s) {
    case 'tick':
      tone(880, 0, 0.07, 'square', 0.1);
      break;
    case 'go': // referee whistle
      tone(1800, 0, 0.25, 'sine', 0.3, 2300);
      tone(2300, 0.28, 0.45, 'sine', 0.3, 1900);
      break;
    case 'spotted':
      tone(660, 0, 0.12, 'square', 0.18);
      tone(990, 0.13, 0.22, 'square', 0.18);
      break;
    case 'caught':
      if (!playSample('break', 0.9)) noise(0, 0.25, 0.5, 400);
      tone(220, 0, 0.3, 'triangle', 0.25, 110);
      break;
    case 'safe':
      if (!playSample('coin', 0.8)) {
        tone(523, 0, 0.12, 'triangle', 0.3);
        tone(659, 0.1, 0.12, 'triangle', 0.3);
        tone(784, 0.2, 0.25, 'triangle', 0.3);
      }
      break;
    case 'herkes':
      [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, i * 0.11, 0.2, 'triangle', 0.3));
      playSample('coin', 0.6, 1.25);
      break;
    case 'roundEnd':
      tone(784, 0, 0.18, 'sine', 0.3);
      tone(587, 0.2, 0.3, 'sine', 0.3);
      break;
    case 'pop':
      if (!playSample('pop', 0.6)) tone(500, 0, 0.08, 'sine', 0.25, 900);
      break;
    case 'click':
      if (!playSample('click', 0.5)) tone(1200, 0, 0.03, 'square', 0.08);
      break;
    case 'jump':
      playSample('jump', 0.35);
      break;
    case 'land':
      playSample('land', 0.35);
      break;
    case 'pebble':
      if (!playSample('thud', 0.6, 1.8, pan)) noise(0, 0.08, 0.4, 2000);
      break;
    case 'step':
      noise(0, 0.05, 0.12, 900);
      break;
  }
}

/** Looping footsteps whose rate follows the walking speed (0 = stop). */
export function footsteps(speed: number, sprinting: boolean): void {
  const c = ctx;
  const buf = samples.get('walking');
  if (!c || !buf || !sfxBus) return;
  if (!stepSrc) {
    stepSrc = c.createBufferSource();
    stepSrc.buffer = buf;
    stepSrc.loop = true;
    stepGain = c.createGain();
    stepGain.gain.value = 0;
    stepSrc.connect(stepGain).connect(sfxBus);
    stepSrc.start();
  }
  const moving = speed > 0.6 && !muted;
  stepGain!.gain.setTargetAtTime(moving ? (sprinting ? 0.5 : 0.32) : 0, c.currentTime, 0.05);
  stepSrc.playbackRate.setTargetAtTime(Math.max(0.6, Math.min(1.7, speed / 4.6)), c.currentTime, 0.1);
}

/** Street ambience (birds, distant traffic) — starts once samples are loaded. */
export function ambience(on: boolean): void {
  const c = ctx;
  if (!c || !ambienceBus) return;
  if (!on) {
    ambienceSrc?.stop();
    ambienceSrc = null;
    stepSrc?.stop();
    stepSrc = null;
    return;
  }
  const buf = samples.get('ambience');
  if (!buf || ambienceSrc) return;
  ambienceSrc = c.createBufferSource();
  ambienceSrc.buffer = buf;
  ambienceSrc.loop = true;
  ambienceSrc.connect(ambienceBus);
  ambienceSrc.start();
}

/** Speak a Turkish phrase if the browser has a voice (optional sugar). */
export function say(text: string, rate = 1.05): void {
  if (muted) return;
  const synth = window.speechSynthesis;
  if (!synth || typeof SpeechSynthesisUtterance === 'undefined') return;
  const voices = synth.getVoices();
  const tr = voices.find((v) => v.lang?.toLowerCase().startsWith('tr'));
  if (!tr) return;
  const u = new SpeechSynthesisUtterance(text);
  u.voice = tr;
  u.lang = 'tr-TR';
  u.rate = rate;
  synth.cancel();
  synth.speak(u);
}

const NUMBERS = ['bir', 'iki', 'üç', 'dört', 'beş', 'altı', 'yedi', 'sekiz', 'dokuz', 'on'];
export function countWord(n: number): string {
  if (n <= 10) return NUMBERS[n - 1]!;
  if (n < 20) return `on ${NUMBERS[n - 11]}`;
  if (n === 20) return 'yirmi';
  if (n < 30) return `yirmi ${NUMBERS[n - 21]}`;
  return 'otuz';
}
