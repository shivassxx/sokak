import * as THREE from 'three';
import { attachStream } from './streamAttach';

export type TvVideoStatus = 'idle' | 'loading' | 'playing' | 'failed';

/**
 * The hidden <video> behind the 3D TVs: plays the stream muted until the first user gesture
 * (autoplay rules), exposes it as a VideoTexture, and reports 'failed' when the stream cannot
 * be used as a texture (CORS taint, network/codec error, or nothing playing after a while),
 * so the TV falls back to the "watch in the overlay" card.
 */
export class TvVideo {
  readonly video = document.createElement('video');
  readonly texture: THREE.VideoTexture;
  status: TvVideoStatus = 'idle';
  private url = '';
  private detach: (() => void) | null = null;
  private timer = 0;
  private gesture = false;
  private volume = 0;

  constructor(private onStatus: (s: TvVideoStatus) => void) {
    const v = this.video;
    v.crossOrigin = 'anonymous';
    v.playsInline = true;
    v.setAttribute('playsinline', '');
    v.setAttribute('webkit-playsinline', '');
    v.muted = true;
    v.loop = true;
    v.preload = 'auto';
    v.setAttribute('aria-hidden', 'true');
    // kept in the document (some mobile browsers do not decode detached videos), but invisible
    v.style.cssText = 'position:fixed;left:0;top:0;width:2px;height:2px;opacity:0;pointer-events:none;z-index:-1';
    this.texture = new THREE.VideoTexture(v);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.generateMipmaps = false;
    v.addEventListener('playing', () => this.checkPlayable());
    v.addEventListener('error', () => this.fail());
    const unlock = () => {
      this.gesture = true;
      this.applyVolume();
      if (this.url && v.paused) void v.play().catch(() => {});
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
  }

  play(url: string): void {
    if (url === this.url) return;
    this.stop();
    this.url = url;
    if (!this.video.isConnected) document.body.appendChild(this.video);
    this.set('loading');
    this.video.muted = true;
    const at = url;
    void attachStream(this.video, url, () => this.fail()).then((d) => {
      if (this.url !== at) return d();
      this.detach = d;
      void this.video.play().catch(() => {
        /* blocked even muted (power saving): the gesture listener retries */
      });
    });
    // nothing on screen after 25 s: fall back to the overlay card
    this.timer = window.setTimeout(() => {
      if (this.status === 'loading') this.fail();
    }, 25_000);
  }

  stop(): void {
    clearTimeout(this.timer);
    this.url = '';
    this.detach?.();
    this.detach = null;
    this.video.pause();
    this.video.remove();
    this.set('idle');
  }

  /** 0…1, already including distance and the game's mute */
  setVolume(v: number): void {
    this.volume = Math.max(0, Math.min(1, v));
    this.applyVolume();
  }

  private applyVolume(): void {
    const v = this.video;
    // muted until the first interaction: browsers block audible autoplay
    v.muted = !this.gesture || this.volume <= 0.001;
    v.volume = this.volume;
  }

  private checkPlayable(): void {
    if (this.status !== 'loading') return;
    // a cross-origin frame without CORS taints WebGL: probe it on a tiny canvas first
    try {
      const c = document.createElement('canvas');
      c.width = c.height = 2;
      const g = c.getContext('2d', { willReadFrequently: true })!;
      g.drawImage(this.video, 0, 0, 2, 2);
      g.getImageData(0, 0, 1, 1);
    } catch {
      this.fail();
      return;
    }
    clearTimeout(this.timer);
    this.set('playing');
    this.applyVolume();
  }

  private fail(): void {
    if (!this.url || this.status === 'failed') return;
    clearTimeout(this.timer);
    this.detach?.();
    this.detach = null;
    this.video.pause();
    this.set('failed');
  }

  private set(s: TvVideoStatus): void {
    if (this.status === s) return;
    this.status = s;
    this.onStatus(s);
  }
}
