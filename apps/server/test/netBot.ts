import { Client, type Room } from 'colyseus.js';

/**
 * Headless network client for the multiplayer tests: a real Colyseus client that joins
 * the kahvehane and records every message it receives.
 */
export class NetBot {
  room!: Room;
  messages: { type: string | number; msg: unknown }[] = [];

  constructor(readonly endpoint: string) {}

  private wire(room: Room): void {
    this.room = room;
    room.onMessage('*', (type, msg) => {
      this.messages.push({ type, msg });
    });
  }

  async joinOrCreate(roomName: string, opts: Record<string, unknown> = {}): Promise<this> {
    this.wire(await new Client(this.endpoint).joinOrCreate(roomName, opts));
    return this;
  }

  async join(roomId: string, opts: Record<string, unknown> = {}): Promise<this> {
    this.wire(await new Client(this.endpoint).joinById(roomId, opts));
    return this;
  }

  get id(): string {
    return this.room.sessionId;
  }

  async leave(consented = true): Promise<void> {
    await this.room.leave(consented);
  }
}
