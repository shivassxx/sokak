import { appendFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

/**
 * Minimal, privacy-friendly analytics: counts only (okey tables started, hands played,
 * table sizes and bets). No names, no IPs, no ids. Optionally appended to a JSONL file.
 */
export class Analytics {
  startedAt = new Date().toISOString();
  okeyTablesStarted = 0;
  okeyHandsPlayed = 0;
  tavlaMatchesStarted = 0;
  tavlaGamesPlayed = 0;
  /** human players per started table → count (the other seats were bots) */
  tableSizes: Record<number, number> = {};
  /** bet per player → count */
  bets: Record<number, number> = {};

  constructor(private file: string | null = null) {}

  tableStarted(humans: number, bet: number): void {
    this.okeyTablesStarted++;
    this.tableSizes[humans] = (this.tableSizes[humans] ?? 0) + 1;
    this.bets[bet] = (this.bets[bet] ?? 0) + 1;
    this.write({ type: 'okeyTable', humans, bet });
  }

  okeyHandPlayed(): void {
    this.okeyHandsPlayed++;
  }

  tavlaStarted(humans: number, bet: number): void {
    this.tavlaMatchesStarted++;
    this.write({ type: 'tavlaMatch', humans, bet });
  }

  tavlaGamePlayed(): void {
    this.tavlaGamesPlayed++;
  }

  summary() {
    const sizes = Object.entries(this.tableSizes);
    const total = sizes.reduce((a, [, n]) => a + n, 0);
    const avg = total ? sizes.reduce((a, [s, n]) => a + Number(s) * n, 0) / total : 0;
    return {
      startedAt: this.startedAt,
      okeyTablesStarted: this.okeyTablesStarted,
      okeyHandsPlayed: this.okeyHandsPlayed,
      tavlaMatchesStarted: this.tavlaMatchesStarted,
      tavlaGamesPlayed: this.tavlaGamesPlayed,
      tableSizes: this.tableSizes,
      averageHumansPerTable: Math.round(avg * 10) / 10,
      bets: this.bets,
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
