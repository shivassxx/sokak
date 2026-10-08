import { useState } from 'react';
import { SPECTATOR_LIMIT, type KPlayerView } from '@sokak/shared';
import './kibitzer.css';

/**
 * "👀 Seyirciler (n)" chip on the table HUD (players and spectators both see it).
 * Tap to see who is watching; a spectator's latest quick-chat line shows next to the name.
 */
export function Spectators({
  players,
  kind,
  table,
  me,
  chats,
}: {
  players: Record<string, KPlayerView>;
  kind: 'okey' | 'tavla';
  table: number;
  me: string;
  chats: Record<string, { text: string; t: number }>;
}) {
  const [open, setOpen] = useState(false);
  const list = Object.values(players).filter((p) => (kind === 'okey' ? p.watch : p.watchTavla) === table);
  if (!list.length) return null;
  const said = (id: string) => {
    const c = chats[id];
    return c && Date.now() - c.t < 6000 ? c.text : null;
  };
  const talking = list.map((p) => said(p.id)).find(Boolean);
  return (
    <div className={`kibitz ${open ? 'open' : ''}`} onPointerDown={(e) => e.stopPropagation()}>
      <button className="btn small kibitz-chip" onClick={() => setOpen((o) => !o)} title={`En fazla ${SPECTATOR_LIMIT} seyirci`}>
        👀 Seyirciler ({list.length})
      </button>
      {!open && talking && <div className="kibitz-say">“{talking}”</div>}
      {open && (
        <ul className="kibitz-list">
          {list.map((p) => (
            <li key={p.id} className={p.id === me ? 'me' : ''}>
              <span className="dotc" style={{ background: p.color }} />
              <b>{p.name}</b>
              {said(p.id) && <small>“{said(p.id)}”</small>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
