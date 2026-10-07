import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Play-money wallets keyed by an anonymous random device token (no account,
 * no name, no personal data): the balance and when the daily bonus was last
 * given. Kept in memory and written to a JSON file (debounced) when a file
 * path is configured.
 */
export interface Wallet {
  money: number;
  lastBonus: number;
  seen: number;
  /** finished okey matches and wins (for the level) */
  played?: number;
  won?: number;
  /** last "veresiye" (so leaving and coming back doesn't skip the wait) */
  lastCredit?: number;
}

const KEEP_MS = 60 * 24 * 3600 * 1000;

export class WalletStore {
  private data = new Map<string, Wallet>();
  private timer: NodeJS.Timeout | null = null;

  constructor(private file: string | null) {
    if (file && existsSync(file)) {
      try {
        const raw = JSON.parse(readFileSync(file, 'utf8')) as Record<string, Wallet>;
        const now = Date.now();
        for (const [k, w] of Object.entries(raw)) if (now - (w.seen ?? 0) < KEEP_MS) this.data.set(k, w);
      } catch {
        /* corrupt file: start fresh */
      }
    }
  }

  static validToken(t: unknown): t is string {
    return typeof t === 'string' && /^[a-f0-9]{24,64}$/i.test(t);
  }

  get(token: string): Wallet | null {
    return this.data.get(token) ?? null;
  }

  set(token: string, w: Wallet): void {
    this.data.set(token, { ...w, seen: Date.now() });
    this.scheduleSave();
  }

  private scheduleSave(): void {
    if (!this.file || this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.flush();
    }, 4000);
  }

  flush(): void {
    if (!this.file) return;
    try {
      mkdirSync(path.dirname(this.file), { recursive: true });
      // write a temp file and rename it over the old one: a crash mid-write never leaves broken JSON
      const tmp = `${this.file}.tmp`;
      writeFileSync(tmp, JSON.stringify(Object.fromEntries(this.data)));
      renameSync(tmp, this.file);
    } catch {
      /* disk full / read-only: keep going in memory */
    }
  }
}
