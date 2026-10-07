import { randomBytes } from 'node:crypto';
import { TV_TOTAL_MS, tvTeam, type TvBroadcast, type TvStreamChannel } from '@sokak/shared';

/**
 * The one TV channel shared by every salon. Staff start and stop broadcasts (admin panel);
 * KahvehaneRoom instances subscribe and mirror the current broadcast into their state.
 */
export class TvChannel {
  private cur: TvBroadcast | null = null;
  private listeners = new Set<(b: TvBroadcast | null) => void>();

  constructor(private now: () => number = () => Date.now()) {}

  /** a finished simulated derby (full-time screen over) no longer counts as on air; a real stream stays until stopped */
  current(): TvBroadcast | null {
    if (this.cur && this.cur.kind !== 'stream' && this.now() >= this.cur.startedAt + TV_TOTAL_MS) this.cur = null;
    return this.cur;
  }

  /** returns null for unknown or identical teams */
  start(home: string, away: string, by: string): TvBroadcast | null {
    if (!tvTeam(home) || !tvTeam(away) || home === away) return null;
    this.cur = { id: randomBytes(6).toString('hex'), kind: 'sim', home, away, startedAt: this.now(), seed: randomBytes(4).readUInt32LE(0), by };
    this.emit();
    return this.cur;
  }

  /** puts one of the owner's channels on air (the link was validated when the channel was added) */
  startStream(ch: Pick<TvStreamChannel, 'id' | 'title' | 'url' | 'type'>, by: string): TvBroadcast {
    this.cur = {
      id: randomBytes(6).toString('hex'),
      kind: 'stream',
      home: '',
      away: '',
      startedAt: this.now(),
      seed: 0,
      by,
      title: ch.title,
      url: ch.url,
      streamType: ch.type,
      channelId: ch.id,
    };
    this.emit();
    return this.cur;
  }

  stop(): void {
    if (!this.cur) return;
    this.cur = null;
    this.emit();
  }

  subscribe(fn: (b: TvBroadcast | null) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(): void {
    for (const fn of this.listeners) fn(this.cur);
  }
}
