/**
 * Tiny procedural sound kit (WebAudio synth, no audio files) + optional
 * browser speech for the Turkish calls. Everything is generated at runtime,
 * so there are no third-party sound assets.
 */
type Sfx = 'tick' | 'go' | 'spotted' | 'caught' | 'safe' | 'herkes' | 'pop' | 'roundEnd' | 'click';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
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
  master.gain.value = muted ? 0 : 0.5;
  master.connect(ctx.destination);
  return ctx;
}

/** Call from a user gesture (browsers block audio until then). */
export function unlockAudio(): void {
  const c = ac();
  if (c && c.state === 'suspended') void c.resume();
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
  if (master) master.gain.value = m ? 0 : 0.5;
  if (m) window.speechSynthesis?.cancel();
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = 'sine', vol = 0.4, slideTo?: number): void {
  const c = ac();
  if (!c || !master) return;
  const t = c.currentTime + start;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function noise(start: number, dur: number, vol = 0.3, freq = 800): void {
  const c = ac();
  if (!c || !master) return;
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
  src.connect(f).connect(g).connect(master);
  src.start(t);
}

export function play(s: Sfx): void {
  if (muted) return;
  switch (s) {
    case 'tick':
      tone(880, 0, 0.08, 'square', 0.12);
      break;
    case 'go': // whistle
      tone(1800, 0, 0.25, 'sine', 0.35, 2300);
      tone(2300, 0.28, 0.45, 'sine', 0.35, 1900);
      break;
    case 'spotted':
      tone(660, 0, 0.12, 'square', 0.2);
      tone(990, 0.13, 0.2, 'square', 0.2);
      break;
    case 'caught':
      noise(0, 0.25, 0.5, 400);
      tone(220, 0, 0.3, 'triangle', 0.35, 110);
      break;
    case 'safe':
      tone(523, 0, 0.12, 'triangle', 0.3);
      tone(659, 0.1, 0.12, 'triangle', 0.3);
      tone(784, 0.2, 0.25, 'triangle', 0.3);
      break;
    case 'herkes':
      [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, i * 0.11, 0.2, 'triangle', 0.32));
      break;
    case 'roundEnd':
      tone(784, 0, 0.18, 'sine', 0.3);
      tone(587, 0.2, 0.3, 'sine', 0.3);
      break;
    case 'pop':
      tone(500, 0, 0.08, 'sine', 0.25, 900);
      break;
    case 'click':
      tone(1200, 0, 0.03, 'square', 0.08);
      break;
  }
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
