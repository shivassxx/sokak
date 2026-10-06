import { Client, type Room } from 'colyseus.js';
import { KAHVE_ROOM, ROOM_NAME, SERVER_PORT, type JoinOptions } from '@sokak/shared';

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

export async function createRoom(opts: JoinOptions): Promise<Room> {
  const room = await client.create(ROOM_NAME, opts);
  remember(room);
  return room;
}

export async function joinRoom(roomId: string, opts: JoinOptions): Promise<Room> {
  const room = await client.joinById(roomId, opts);
  remember(room);
  return room;
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

/** Public kahvehane: join a friend's (by id) or any kahvehane with free chairs. */
export async function joinKahve(opts: JoinOptions, roomId?: string): Promise<Room> {
  const room = roomId ? await client.joinById(roomId, opts) : await client.joinOrCreate(KAHVE_ROOM, opts);
  remember(room);
  return room;
}

export function roomLink(roomId: string, kind: 'oda' | 'kahve' = 'oda'): string {
  return `${location.origin}${location.pathname}?${kind}=${encodeURIComponent(roomId)}`;
}
