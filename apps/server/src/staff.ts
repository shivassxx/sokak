import { appendFile, mkdir } from 'node:fs/promises';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

/**
 * Staff accounts (owner + admins) for the admin panel. Players never have accounts;
 * this is only for the people who run the kıraathane. Passwords are scrypt hashes
 * with a per-user salt; sessions are random tokens kept in memory.
 */
export type StaffRole = 'owner' | 'admin';

export interface StaffUser {
  username: string;
  role: StaffRole;
  /** "scrypt$<salt hex>$<hash hex>" */
  passwordHash: string;
  createdAt: number;
  createdBy: string;
}

/** What the API shows about a user: never the hash. */
export interface StaffUserView {
  username: string;
  role: StaffRole;
  createdAt: number;
  createdBy: string;
}

export interface StaffLogEntry {
  t: number;
  by: string;
  action: string;
  detail?: string;
}

export const OWNER_USERNAME = 'shivass';
export const SESSION_MS = 12 * 3600 * 1000;
const LOG_KEEP = 200;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX = 5;

export const validUsername = (u: unknown): u is string => typeof u === 'string' && /^[a-z0-9_]{3,20}$/.test(u);
export const validPassword = (p: unknown): p is string => typeof p === 'string' && p.length >= 8 && p.length <= 200;

function hashPassword(pw: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(pw, salt, 64);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

function checkPassword(pw: string, stored: string): boolean {
  const [kind, saltHex, hashHex] = stored.split('$');
  if (kind !== 'scrypt' || !saltHex || !hashHex) return false;
  const want = Buffer.from(hashHex, 'hex');
  const got = scryptSync(pw, Buffer.from(saltHex, 'hex'), want.length);
  return got.length === want.length && timingSafeEqual(got, want);
}

/** a precomputed hash so unknown usernames cost the same time as known ones */
const DUMMY_HASH = hashPassword(randomBytes(12).toString('hex'));

interface Session {
  username: string;
  expires: number;
}

export class StaffStore {
  private users = new Map<string, StaffUser>();
  private sessions = new Map<string, Session>();
  private failures = new Map<string, number[]>();
  private logBuf: StaffLogEntry[] = [];
  private readonly now: () => number;
  private readonly logFile: string | null;

  constructor(
    private file: string | null,
    opts: { ownerPassword?: string; now?: () => number; quiet?: boolean } = {},
  ) {
    this.now = opts.now ?? Date.now;
    this.logFile = file ? `${file.replace(/\.json$/i, '')}-log.jsonl` : null;
    if (file && existsSync(file)) {
      try {
        const raw = JSON.parse(readFileSync(file, 'utf8')) as { users?: StaffUser[] };
        for (const u of raw.users ?? []) if (u && validUsername(u.username) && typeof u.passwordHash === 'string') this.users.set(u.username, u);
      } catch {
        /* corrupt file: owner bootstrap below still gets them in */
      }
    }
    // the owner always exists and is always the owner
    for (const u of this.users.values()) if (u.role === 'owner' && u.username !== OWNER_USERNAME) u.role = 'admin';
    const owner = this.users.get(OWNER_USERNAME);
    const pw = opts.ownerPassword;
    if (pw) {
      if (!validPassword(pw)) throw new Error('SOKAK_OWNER_PASSWORD must be at least 8 characters');
      if (!owner || !checkPassword(pw, owner.passwordHash)) this.putOwner(hashPassword(pw), owner);
    } else if (!owner) {
      const generated = randomBytes(9).toString('base64url');
      this.putOwner(hashPassword(generated), undefined);
      if (!opts.quiet) {
        console.log('\n================ SOKAK ADMIN ================');
        console.log(`Owner account "${OWNER_USERNAME}" was created with a one-time password:`);
        console.log(`    ${generated}`);
        console.log('Log in at /admin and change it now (or set SOKAK_OWNER_PASSWORD).');
        console.log('This password is not shown again.');
        console.log('=============================================\n');
      }
    } else if (owner.role !== 'owner') {
      owner.role = 'owner';
      this.save();
    }
  }

  private putOwner(passwordHash: string, prev: StaffUser | undefined): void {
    this.users.set(OWNER_USERNAME, {
      username: OWNER_USERNAME,
      role: 'owner',
      passwordHash,
      createdAt: prev?.createdAt ?? this.now(),
      createdBy: prev?.createdBy ?? 'system',
    });
    this.save();
  }

  // ------------------------------------------------------------ login
  /** too many recent failures for this IP or this username */
  limited(ip: string, username: string): boolean {
    return this.recentFailures(`ip:${ip}`) >= RATE_MAX || this.recentFailures(`u:${username}`) >= RATE_MAX;
  }

  private recentFailures(key: string): number {
    const t = this.now();
    const list = (this.failures.get(key) ?? []).filter((x) => t - x < RATE_WINDOW_MS);
    if (list.length) this.failures.set(key, list);
    else this.failures.delete(key);
    return list.length;
  }

  private fail(key: string): void {
    const list = this.failures.get(key) ?? [];
    list.push(this.now());
    this.failures.set(key, list.slice(-RATE_MAX * 2));
  }

  /** Returns a new session token, or null (one generic failure for every reason). */
  login(username: unknown, password: unknown, ip: string): { token: string; user: StaffUserView } | null {
    const name = typeof username === 'string' ? username.trim().toLowerCase().slice(0, 40) : '';
    const pw = typeof password === 'string' ? password.slice(0, 200) : '';
    const u = this.users.get(name);
    // always run scrypt so a missing user takes as long as a wrong password
    const ok = checkPassword(pw, u?.passwordHash ?? DUMMY_HASH) && !!u;
    if (!ok || !u) {
      this.fail(`ip:${ip}`);
      if (name) this.fail(`u:${name}`);
      return null;
    }
    const token = randomBytes(32).toString('hex');
    this.sessions.set(token, { username: u.username, expires: this.now() + SESSION_MS });
    return { token, user: view(u) };
  }

  /** The user behind a session token (null if unknown, expired or the user was removed). */
  session(token: string | undefined): StaffUserView | null {
    if (!token) return null;
    const s = this.sessions.get(token);
    if (!s) return null;
    const u = this.users.get(s.username);
    if (s.expires <= this.now() || !u) {
      this.sessions.delete(token);
      return null;
    }
    return view(u);
  }

  logout(token: string | undefined): void {
    if (token) this.sessions.delete(token);
  }

  private killSessions(username: string, except?: string): void {
    for (const [t, s] of this.sessions) if (s.username === username && t !== except) this.sessions.delete(t);
  }

  // ------------------------------------------------------------ users (owner only, checked by the routes)
  list(): StaffUserView[] {
    return [...this.users.values()].map(view).sort((a, b) => (a.role === b.role ? a.username.localeCompare(b.username) : a.role === 'owner' ? -1 : 1));
  }

  get(username: string): StaffUserView | null {
    const u = this.users.get(username);
    return u ? view(u) : null;
  }

  addAdmin(username: unknown, password: unknown, by: string): StaffUserView | 'invalid' | 'exists' {
    if (!validUsername(username) || !validPassword(password)) return 'invalid';
    if (this.users.has(username)) return 'exists';
    const u: StaffUser = { username, role: 'admin', passwordHash: hashPassword(password), createdAt: this.now(), createdBy: by };
    this.users.set(username, u);
    this.save();
    return view(u);
  }

  /** removes an admin and ends their sessions; the owner cannot be removed */
  remove(username: string): boolean {
    const u = this.users.get(username);
    if (!u || u.role === 'owner') return false;
    this.users.delete(username);
    this.killSessions(username);
    this.save();
    return true;
  }

  /** sets a new password and ends the user's other sessions (keepToken stays logged in) */
  setPassword(username: string, password: unknown, keepToken?: string): boolean | 'invalid' {
    const u = this.users.get(username);
    if (!u) return false;
    if (!validPassword(password)) return 'invalid';
    u.passwordHash = hashPassword(password);
    this.killSessions(username, keepToken);
    this.save();
    return true;
  }

  verify(username: string, password: unknown): boolean {
    const u = this.users.get(username);
    return typeof password === 'string' && !!u && checkPassword(password.slice(0, 200), u.passwordHash);
  }

  // ------------------------------------------------------------ action log
  log(by: string, action: string, detail?: string): void {
    const e: StaffLogEntry = { t: this.now(), by, action, ...(detail ? { detail: detail.slice(0, 300) } : {}) };
    this.logBuf.push(e);
    if (this.logBuf.length > LOG_KEEP) this.logBuf.splice(0, this.logBuf.length - LOG_KEEP);
    if (!this.logFile) return;
    const file = this.logFile;
    void mkdir(path.dirname(file), { recursive: true })
      .then(() => appendFile(file, `${JSON.stringify(e)}\n`))
      .catch((err) => console.warn('[staff] log write failed', err));
  }

  /** newest first */
  recentLog(): StaffLogEntry[] {
    return [...this.logBuf].reverse();
  }

  private save(): void {
    if (!this.file) return;
    try {
      mkdirSync(path.dirname(this.file), { recursive: true });
      const tmp = `${this.file}.tmp`;
      writeFileSync(tmp, JSON.stringify({ users: [...this.users.values()] }, null, 1), { mode: 0o600 });
      renameSync(tmp, this.file);
    } catch (e) {
      console.warn('[staff] save failed', e);
    }
  }
}

function view(u: StaffUser): StaffUserView {
  return { username: u.username, role: u.role, createdAt: u.createdAt, createdBy: u.createdBy };
}
