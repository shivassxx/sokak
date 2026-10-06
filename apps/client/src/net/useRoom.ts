import { useEffect, useState } from 'react';
import type { Room } from 'colyseus.js';
import type { RoomView } from '@sokak/shared';

/** Plain-JSON snapshot of the replicated room state for React. */
export function useRoomView(room: Room | null): RoomView | null {
  const [view, setView] = useState<RoomView | null>(null);
  useEffect(() => {
    if (!room) return;
    // the first state patch may not have arrived yet (slow networks)
    const update = () => {
      const json = room.state?.toJSON() as Partial<RoomView> | undefined;
      setView(json && json.players && typeof json.phase === 'string' ? (json as RoomView) : null);
    };
    update();
    room.onStateChange(update);
    return () => room.onStateChange.remove(update);
  }, [room]);
  return view;
}
