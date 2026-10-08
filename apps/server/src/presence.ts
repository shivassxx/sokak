/**
 * Where friend codes are online (shared by every salon): rooms note their players' public
 * friend codes on join and clear them on leave. Only mutual friends are ever told.
 */
export class FriendPresence {
  private at = new Map<string, { roomId: string; salon: string }>();

  set(code: string, roomId: string, salon: string): void {
    if (code) this.at.set(code, { roomId, salon });
  }

  /** forget a code, but only if it is still in this room (another tab may have moved on) */
  clear(code: string, roomId: string): void {
    if (code && this.at.get(code)?.roomId === roomId) this.at.delete(code);
  }

  where(code: string): { roomId: string; salon: string } | null {
    return this.at.get(code) ?? null;
  }
}
