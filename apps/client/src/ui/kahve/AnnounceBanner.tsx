import { useEffect, useState } from 'react';
import type { Room } from 'colyseus.js';
import { KMSG } from '@sokak/shared';
import { play } from '../../game/audio';

/** Staff announcement ("📢 Duyuru: …") shown on top of the HUD for a while. */
export function AnnounceBanner({ room }: { room: Room }) {
  const [text, setText] = useState<string | null>(null);
  useEffect(
    () =>
      room.onMessage(KMSG.announce, (t: unknown) => {
        if (typeof t !== 'string' || !t) return;
        setText(t.slice(0, 160));
        play('pop');
      }),
    [room],
  );
  useEffect(() => {
    if (!text) return;
    const t = setTimeout(() => setText(null), 12000);
    return () => clearTimeout(t);
  }, [text]);
  if (!text) return null;
  return (
    <div className="announce-banner" role="status">
      <span>{text}</span>
      <button aria-label="kapat" onClick={() => setText(null)}>
        ×
      </button>
    </div>
  );
}
