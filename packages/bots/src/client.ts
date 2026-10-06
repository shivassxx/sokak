import { Client, type Room } from 'colyseus.js';
import { MSG, ROOM_NAME, type InputMsg, type JoinOptions, type SnapshotMsg } from '@sokak/shared';

/**
 * Headless network bot: a real Colyseus client used by multiplayer tests
 * (and handy for load tests). Sends inputs exactly like the browser client.
 */
export class NetBot {
  room!: Room;
  lastSnapshot: SnapshotMsg | null = null;
  messages: { type: string | number; msg: unknown }[] = [];
  private seq = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  move: { mx: number; mz: number; jump: boolean; crouch: boolean; sprint?: boolean } = { mx: 0, mz: 0, jump: false, crouch: false };

  constructor(readonly endpoint: string) {}

  private wire(room: Room): void {
    this.room = room;
    room.onMessage(MSG.snapshot, (s: SnapshotMsg) => {
      this.lastSnapshot = s;
    });
    room.onMessage('*', (type, msg) => {
      if (type !== MSG.snapshot) this.messages.push({ type, msg });
    });
  }

  async create(opts: JoinOptions = {}): Promise<this> {
    this.wire(await new Client(this.endpoint).create(ROOM_NAME, opts));
    return this;
  }

  async joinOrCreate(roomName: string, opts: JoinOptions = {}): Promise<this> {
    this.wire(await new Client(this.endpoint).joinOrCreate(roomName, opts));
    return this;
  }

  async join(roomId: string, opts: JoinOptions = {}): Promise<this> {
    this.wire(await new Client(this.endpoint).joinById(roomId, opts));
    return this;
  }

  async reconnect(token: string): Promise<this> {
    this.wire(await new Client(this.endpoint).reconnect(token));
    return this;
  }

  /** start sending inputs at 20 Hz using `this.move` */
  drive(): void {
    this.stop();
    this.timer = setInterval(() => {
      const yaw = this.move.mx || this.move.mz ? Math.atan2(-this.move.mx, -this.move.mz) : 0;
      const m: InputMsg = { s: ++this.seq, mx: this.move.mx, mz: this.move.mz, j: this.move.jump ? 1 : 0, c: this.move.crouch ? 1 : 0, y: yaw, r: this.move.sprint ? 1 : 0 };
      this.room.send(MSG.input, m);
    }, 50);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  get id(): string {
    return this.room.sessionId;
  }

  async leave(consented = true): Promise<void> {
    this.stop();
    await this.room.leave(consented);
  }
}
