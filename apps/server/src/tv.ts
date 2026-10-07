import { randomBytes } from 'node:crypto';
import { tvTeam, type TvBroadcast } from '@sokak/shared';

/**
 * The one TV channel shared by every salon. Staff start and stop broadcasts (admin panel);
 * KahvehaneRoom instances subscribe and mirror the current broadcast into their state.
 */
export class TvChannel {
  private cur: TvBroadcast | null = null;
  private listeners = new Set<(b: TvBroadcast | null) => void>();

  constructor(private now: () => number = () => Date.now()) {}

  current(): TvBroadcast | null {
    return this.cur;
  }

  /** returns null for unknown or identical teams */
  start(home: string, away: string, by: string): TvBroadcast | null {
    if (!tvTeam(home) || !tvTeam(away) || home === away) return null;
    this.cur = { id: randomBytes(6).toString('hex'), home, away, startedAt: this.now(), seed: randomBytes(4).readUInt32LE(0), by };
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
