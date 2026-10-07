import { Client, type Room } from 'colyseus.js';
import { KAHVE_ROOM, SERVER_PORT, type JoinOptions, type LeaderInfo, type SalonInfo } from '@sokak/shared';

export function serverEndpoint(): string {
  const env = import.meta.env.VITE_SERVER_URL as string | undefined;
  if (env) return env;
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  if (import.meta.env.DEV) return `${proto}://${location.hostname}:${SERVER_PORT}`;
  return `${proto}://${location.host}`;
}

const client = new Client(serverEndpoint());
const RECONNECT_KEY = 'sokak.reconnect';

function remember(room: Room): void {
  try {
    sessionStorage.setItem(RECONNECT_KEY, JSON.stringify({ roomId: room.roomId, token: room.reconnectionToken }));
  } catch {
    /* storage unavailable */
  }
}

export function forgetRoom(): void {
  try {
    sessionStorage.removeItem(RECONNECT_KEY);
  } catch {
    /* ignore */
  }
}

/** Try to resume a previous seat (page reload / network drop). */
export async function tryReconnect(roomId?: string): Promise<Room | null> {
  let saved: { roomId: string; token: string } | null = null;
  try {
    saved = JSON.parse(sessionStorage.getItem(RECONNECT_KEY) ?? 'null');
  } catch {
    saved = null;
  }
  if (!saved || (roomId && saved.roomId !== roomId)) return null;
  try {
    const room = await client.reconnect(saved.token);
    remember(room);
    return room;
  } catch {
    forgetRoom();
    return null;
  }
}

/** Anonymous random token that keeps this device's play money between visits. */
export function deviceToken(): string {
  const KEY = 'sokak.device';
  try {
    let t = localStorage.getItem(KEY);
    if (!t || !/^[a-f0-9]{32}$/.test(t)) {
      const b = new Uint8Array(16);
      crypto.getRandomValues(b);
      t = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
      localStorage.setItem(KEY, t);
    }
    return t;
  } catch {
    return '';
  }
}

export function httpEndpoint(): string {
  return serverEndpoint().replace(/^ws/, 'http');
}

/** Lobby: public salons with player counts. */
export async function listSalons(): Promise<SalonInfo[]> {
  const r = await fetch(`${httpEndpoint()}/api/salons`, { cache: 'no-store' });
  if (!r.ok) throw new Error('salons');
  return (await r.json()) as SalonInfo[];
}

/** This device's play-money wallet and match record (null on a first visit). */
export async function getWallet(): Promise<{ money: number; played: number; won: number } | null> {
  const t = deviceToken();
  if (!t) return null;
  const r = await fetch(`${httpEndpoint()}/api/wallet?device=${t}`, { cache: 'no-store' });
  if (!r.ok) throw new Error('wallet');
  return (await r.json()) as { money: number; played: number; won: number } | null;
}

export async function listLeaders(): Promise<LeaderInfo[]> {
  const r = await fetch(`${httpEndpoint()}/api/leaders`, { cache: 'no-store' });
  if (!r.ok) throw new Error('leaders');
  return (await r.json()) as LeaderInfo[];
}

export interface KahveJoin {
  /** a specific salon (lobby list / invite link) */
  roomId?: string;
  /** sit me at a table right away */
  quick?: boolean;
  /** open a new salon (optionally private: link only) */
  create?: boolean;
  private?: boolean;
}

/** Kahvehane salon: join by id, quick-join any, or create a new (private) one. */
export async function joinKahve(opts: JoinOptions, how: KahveJoin = {}): Promise<Room> {
  const o: JoinOptions = { ...opts, device: deviceToken(), quick: how.quick, private: how.private };
  const room = how.roomId ? await client.joinById(how.roomId, o) : how.create ? await client.create(KAHVE_ROOM, o) : await client.joinOrCreate(KAHVE_ROOM, o);
  remember(room);
  return room;
}

export function roomLink(roomId: string): string {
  return `${location.origin}${location.pathname}?kahve=${encodeURIComponent(roomId)}`;
}
