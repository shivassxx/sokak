import { useState } from 'react';
import type { Room } from 'colyseus.js';
import { MAX_PLAYERS, MIN_PLAYERS, MSG, type RoomView } from '@sokak/shared';
import { roomLink } from '../net/connection';

export function PlayerList({ view, me }: { view: RoomView; me: string }) {
  const players = Object.values(view.players).sort((a, b) => b.score - a.score);
  return (
    <ul className="players">
      {players.map((p) => (
        <li key={p.id} className={p.connected ? '' : 'offline'}>
          <span className="dot" style={{ background: p.color }} />
          <span className="pname">
            {p.name}
            {p.id === me && ' (sen)'}
          </span>
          {p.id === view.hostId && <span className="tag">kurucu</span>}
          {p.isBot && <span className="tag bot">bot</span>}
          {!p.connected && <span className="tag">bağlantı koptu…</span>}
        </li>
      ))}
    </ul>
  );
}

export async function shareRoom(roomId: string): Promise<'shared' | 'copied' | 'failed'> {
  const url = roomLink(roomId);
  const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
  if (nav.share && matchMedia('(pointer: coarse)').matches) {
    try {
      await nav.share({ title: 'Saklambaç oynayalım mı?', text: 'Mahalleye gel, Saklambaç oynuyoruz!', url });
      return 'shared';
    } catch {
      /* fall through to copy */
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    return 'copied';
  } catch {
    return 'failed';
  }
}

export function Lobby({ room, view }: { room: Room; view: RoomView }) {
  const [shareState, setShareState] = useState<string | null>(null);
  const [open, setOpen] = useState(true);
  const isHost = view.hostId === room.sessionId;
  const count = Object.keys(view.players).length;
  const bots = Object.values(view.players).filter((p) => p.isBot).length;
  const link = roomLink(room.roomId);
  if (!open) {
    return (
      <button className="btn small lobby-toggle" onClick={() => setOpen(true)}>
        Lobi ({count})
      </button>
    );
  }
  return (
    <div className="panel lobby">
      <div className="panel-head">
        <h2>Lobi</h2>
        <button className="btn small" onClick={() => setOpen(false)}>
          Gizle
        </button>
      </div>
      <p className="hint">Arkadaşlarını çağır! Linki gönder, bir tıkla gelsinler.</p>
      <div className="share">
        <input readOnly value={link} onFocus={(e) => e.currentTarget.select()} />
        <button
          className="btn primary small"
          onClick={async () => {
            const r = await shareRoom(room.roomId);
            setShareState(r === 'failed' ? 'Kopyalanamadı, linki elle seç.' : r === 'copied' ? 'Link kopyalandı!' : 'Paylaşıldı!');
          }}
        >
          Paylaş
        </button>
      </div>
      {shareState && <div className="hint ok">{shareState}</div>}
      <PlayerList view={view} me={room.sessionId} />
      <div className="row">
        <span className="hint">
          {count}/{MAX_PLAYERS} oyuncu
        </span>
      </div>
      {isHost ? (
        <div className="row wrap">
          <button className="btn small" disabled={count >= MAX_PLAYERS} onClick={() => room.send(MSG.addBot)}>
            + Bot ekle
          </button>
          <button className="btn small" disabled={bots === 0} onClick={() => room.send(MSG.removeBot)}>
            − Bot çıkar
          </button>
          <button className="btn primary" disabled={count < MIN_PLAYERS} onClick={() => room.send(MSG.start)}>
            Oyunu başlat
          </button>
        </div>
      ) : (
        <p className="hint">Kurucunun oyunu başlatması bekleniyor…</p>
      )}
      {count < MIN_PLAYERS && <p className="hint">En az {MIN_PLAYERS} oyuncu gerekli (bot da olur).</p>}
    </div>
  );
}
