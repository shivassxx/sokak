import { appendFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

/**
 * Minimal, privacy-friendly analytics: counts only (rooms, rounds, room sizes).
 * No names, no IPs, no ids. Optionally appended to a JSONL file.
 */
export class Analytics {
  startedAt = new Date().toISOString();
  roomsCreated = 0;
  roundsPlayed = 0;
  roundsByReason: Record<string, number> = {};
  /** players per finished round → count */
  roomSizes: Record<number, number> = {};
  activeRooms = 0;
  okeyTablesStarted = 0;
  okeyHandsPlayed = 0;

  tableStarted(): void {
    this.okeyTablesStarted++;
    this.write({ type: 'okeyTable' });
  }

  okeyHandPlayed(): void {
    this.okeyHandsPlayed++;
  }
  peakActiveRooms = 0;

  constructor(private file: string | null = null) {}

  roomCreated(): void {
    this.roomsCreated++;
    this.activeRooms++;
    this.peakActiveRooms = Math.max(this.peakActiveRooms, this.activeRooms);
    this.write({ type: 'room' });
  }

  roomDisposed(): void {
    this.activeRooms = Math.max(0, this.activeRooms - 1);
  }

  roundPlayed(size: number, reason: string): void {
    this.roundsPlayed++;
    this.roundsByReason[reason] = (this.roundsByReason[reason] ?? 0) + 1;
    this.roomSizes[size] = (this.roomSizes[size] ?? 0) + 1;
    this.write({ type: 'round', size, reason });
  }

  summary() {
    const sizes = Object.entries(this.roomSizes);
    const total = sizes.reduce((a, [, n]) => a + n, 0);
    const avg = total ? sizes.reduce((a, [s, n]) => a + Number(s) * n, 0) / total : 0;
    return {
      startedAt: this.startedAt,
      roomsCreated: this.roomsCreated,
      activeRooms: this.activeRooms,
      peakActiveRooms: this.peakActiveRooms,
      roundsPlayed: this.roundsPlayed,
      roundsByReason: this.roundsByReason,
      roomSizes: this.roomSizes,
      averageRoomSize: Math.round(avg * 10) / 10,
      okeyTablesStarted: this.okeyTablesStarted,
      okeyHandsPlayed: this.okeyHandsPlayed,
    };
  }

  private write(entry: Record<string, unknown>): void {
    if (!this.file) return;
    const line = JSON.stringify({ t: new Date().toISOString(), ...entry }) + '\n';
    const file = this.file;
    void mkdir(path.dirname(file), { recursive: true })
      .then(() => appendFile(file, line))
      .catch((e) => console.warn('[analytics] write failed', e));
  }
}
