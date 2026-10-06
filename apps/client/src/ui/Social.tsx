import { useEffect, useState } from 'react';
import type { Room } from 'colyseus.js';
import { EMOTES, MSG, QUICK_CHAT, type EmoteId } from '@sokak/shared';
import type { Input } from '../game/input';
import { isMuted, play, setMuted } from '../game/audio';

const EMOTE_ICON: Record<EmoteId, string> = { wave: '👋', laugh: '😂', dance: '💃', point: '👉' };
const EMOTE_NAME: Record<EmoteId, string> = { wave: 'El salla', laugh: 'Gül', dance: 'Dans et', point: 'Göster' };

/** Emote buttons + preset quick-chat (no free text, child-safe). */
export function Social({ room, input, phrases = QUICK_CHAT }: { room: Room; input: Input; phrases?: readonly string[] }) {
  const [open, setOpen] = useState(false);
  const [muted, setM] = useState(isMuted());

  useEffect(() => {
    return input.onPress((a) => {
      const i = ['emote1', 'emote2', 'emote3', 'emote4'].indexOf(a);
      if (i >= 0) room.send(MSG.emote, EMOTES[i]);
    });
  }, [input, room]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'KeyT') setOpen((o) => !o);
      if (open && /^Digit[5-9]$|^Digit0$/.test(e.code)) {
        const idx = e.code === 'Digit0' ? 5 : Number(e.code.slice(5)) - 5;
        if (idx < phrases.length) {
          room.send(MSG.chat, idx);
          setOpen(false);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, room, phrases]);

  return (
    <div className="social" onPointerDown={(e) => e.stopPropagation()}>
      {open && (
        <div className="chat-menu">
          {phrases.map((q, i) => (
            <button
              key={q}
              className="btn small"
              onClick={() => {
                room.send(MSG.chat, i);
                play('click');
                setOpen(false);
              }}
            >
              {i < 6 && <span className="key">{i === 5 ? 0 : i + 5}</span>} {q}
            </button>
          ))}
        </div>
      )}
      <div className="social-row">
        <button className={`round-btn ${open ? 'on' : ''}`} title="Hızlı sohbet (T)" onClick={() => setOpen((o) => !o)}>
          💬
        </button>
        {EMOTES.map((e, i) => (
          <button key={e} className="round-btn" title={`${EMOTE_NAME[e]} (${i + 1})`} onClick={() => room.send(MSG.emote, e)}>
            {EMOTE_ICON[e]}
          </button>
        ))}
        <button
          className="round-btn"
          title={muted ? 'Sesi aç' : 'Sesi kapat'}
          onClick={() => {
            setMuted(!muted);
            setM(!muted);
          }}
        >
          {muted ? '🔇' : '🔊'}
        </button>
      </div>
    </div>
  );
}
