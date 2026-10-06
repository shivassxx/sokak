import { useEffect, useState } from 'react';
import type { Room } from 'colyseus.js';
import type { RoomView } from '@sokak/shared';

/** Plain-JSON snapshot of the replicated room state for React. */
export function useRoomView(room: Room | null): RoomView | null {
  const [view, setView] = useState<RoomView | null>(null);
  useEffect(() => {
    if (!room) return;
    const update = () => setView(room.state ? (room.state.toJSON() as RoomView) : null);
    update();
    room.onStateChange(update);
    return () => room.onStateChange.remove(update);
  }, [room]);
  return view;
}
