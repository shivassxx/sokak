import type { Room } from 'colyseus.js';
import { KMSG, type SignalMsg } from '@sokak/shared';

/**
 * Opt-in voice chat for the kahvehane: peer-to-peer WebRTC audio between
 * players at the same okey table, or standing near each other. The server
 * only relays signalling between two players who both switched voice on.
 * "Perfect negotiation" (polite/impolite peers) avoids offer collisions.
 * Without a microphone you can still listen.
 */
interface Peer {
  pc: RTCPeerConnection;
  polite: boolean;
  makingOffer: boolean;
  ignoreOffer: boolean;
  gain: GainNode | null;
  analyser: AnalyserNode | null;
  el: HTMLAudioElement | null;
  target: number;
  level: number;
}

const ICE: RTCIceServer[] = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }];
// optional TURN relay for players behind strict NATs (see Docs/Deploy.md)
const turn = import.meta.env.VITE_TURN_URL as string | undefined;
if (turn) ICE.push({ urls: turn, username: import.meta.env.VITE_TURN_USER as string | undefined, credential: import.meta.env.VITE_TURN_PASS as string | undefined });

export class VoiceChat {
  private peers = new Map<string, Peer>();
  private local: MediaStream | null = null;
  private ctx: AudioContext | null = null;
  private muted = new Set<string>();
  private buf = new Float32Array(256);
  enabled = false;
  micMuted = false;
  hasMic = false;

  constructor(
    private room: Room,
    private me: string,
  ) {}

  /** Switch voice on (asks for the microphone; listen-only if refused). */
  async enable(): Promise<void> {
    if (this.enabled) return;
    this.ctx = new AudioContext();
    void this.ctx.resume();
    try {
      this.local = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      this.hasMic = true;
    } catch {
      this.local = null;
      this.hasMic = false;
    }
    this.enabled = true;
    this.room.send(KMSG.voice, true);
  }

  disable(): void {
    for (const id of [...this.peers.keys()]) this.close(id);
    this.local?.getTracks().forEach((t) => t.stop());
    this.local = null;
    void this.ctx?.close();
    this.ctx = null;
    if (this.enabled) this.room.send(KMSG.voice, false);
    this.enabled = false;
  }

  setMicMuted(m: boolean): void {
    this.micMuted = m;
    this.local?.getAudioTracks().forEach((t) => (t.enabled = !m));
  }

  mutePeer(id: string, m: boolean): void {
    if (m) this.muted.add(id);
    else this.muted.delete(id);
  }

  isPeerMuted(id: string): boolean {
    return this.muted.has(id);
  }

  connectedPeers(): string[] {
    return [...this.peers.entries()].filter(([, p]) => p.pc.connectionState === 'connected').map(([id]) => id);
  }

  /**
   * Who should be connected and how loud (0..1). Peers missing from the map are
   * dropped. Call a few times a second.
   */
  sync(wanted: Map<string, number>): void {
    if (!this.enabled) return;
    for (const [id, gain] of wanted) {
      const p = this.peers.get(id) ?? this.open(id);
      p.target = gain;
    }
    for (const id of [...this.peers.keys()]) if (!wanted.has(id)) this.close(id);
    for (const [id, p] of this.peers) {
      const g = this.muted.has(id) ? 0 : p.target;
      if (p.gain && this.ctx) p.gain.gain.setTargetAtTime(g, this.ctx.currentTime, 0.15);
    }
  }

  /** Current speaking level (0..1) of every connected peer, plus our own mic. */
  levels(): Map<string, number> {
    const out = new Map<string, number>();
    for (const [id, p] of this.peers) {
      if (!p.analyser) continue;
      p.analyser.getFloatTimeDomainData(this.buf);
      let sum = 0;
      for (const v of this.buf) sum += v * v;
      p.level = p.level * 0.6 + Math.sqrt(sum / this.buf.length) * 0.4;
      out.set(id, this.muted.has(id) ? 0 : p.level);
    }
    return out;
  }

  /** Signalling from the server. */
  async onSignal(m: SignalMsg): Promise<void> {
    if (!this.enabled) return;
    const p = this.peers.get(m.peer) ?? this.open(m.peer);
    const { sdp, ice } = m.data;
    try {
      if (sdp) {
        const collision = sdp.type === 'offer' && (p.makingOffer || p.pc.signalingState !== 'stable');
        p.ignoreOffer = !p.polite && collision;
        if (p.ignoreOffer) return;
        await p.pc.setRemoteDescription(sdp as RTCSessionDescriptionInit);
        if (sdp.type === 'offer') {
          await p.pc.setLocalDescription();
          this.send(m.peer, { sdp: p.pc.localDescription!.toJSON() as { type: string; sdp: string } });
        }
      } else if (ice) {
        try {
          await p.pc.addIceCandidate(ice as RTCIceCandidateInit);
        } catch (e) {
          if (!p.ignoreOffer) throw e;
        }
      }
    } catch {
      // a broken negotiation: drop the peer, the next sync reconnects
      this.close(m.peer);
    }
  }

  private send(peer: string, data: SignalMsg['data']): void {
    this.room.send(KMSG.signal, { peer, data } satisfies SignalMsg);
  }

  private open(id: string): Peer {
    const pc = new RTCPeerConnection({ iceServers: ICE });
    const p: Peer = { pc, polite: this.me > id, makingOffer: false, ignoreOffer: false, gain: null, analyser: null, el: null, target: 0, level: 0 };
    this.peers.set(id, p);
    const tr = pc.addTransceiver('audio', { direction: 'sendrecv' });
    const track = this.local?.getAudioTracks()[0];
    if (track) void tr.sender.replaceTrack(track);
    pc.onicecandidate = (e) => e.candidate && this.send(id, { ice: e.candidate.toJSON() });
    pc.onnegotiationneeded = async () => {
      try {
        p.makingOffer = true;
        await pc.setLocalDescription();
        this.send(id, { sdp: pc.localDescription!.toJSON() as { type: string; sdp: string } });
      } catch {
        /* retried by the next negotiation */
      } finally {
        p.makingOffer = false;
      }
    };
    pc.ontrack = (e) => {
      if (!this.ctx || p.gain) return;
      const stream = e.streams[0] ?? new MediaStream([e.track]);
      // Chrome only feeds remote WebRTC audio into WebAudio while an element plays it
      const el = new Audio();
      el.srcObject = stream;
      el.muted = true;
      void el.play().catch(() => {});
      const src = this.ctx.createMediaStreamSource(stream);
      const gain = this.ctx.createGain();
      gain.gain.value = 0;
      const an = this.ctx.createAnalyser();
      an.fftSize = 512;
      src.connect(gain).connect(this.ctx.destination);
      src.connect(an);
      p.gain = gain;
      p.analyser = an;
      p.el = el;
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed') this.close(id);
    };
    return p;
  }

  private close(id: string): void {
    const p = this.peers.get(id);
    if (!p) return;
    p.pc.close();
    p.gain?.disconnect();
    if (p.el) p.el.srcObject = null;
    this.peers.delete(id);
  }
}
