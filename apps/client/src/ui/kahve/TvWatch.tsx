import { useEffect, useRef, useState } from 'react';
import { HALL, MAIN_TV, isTvStream, type TvBroadcast } from '@sokak/shared';
import type { Game } from '../../game/Game';
import { StreamPlayer } from '../StreamPlayer';
import './tvWatch.css';

type Mode = 'closed' | 'full' | 'mini';

/**
 * Real match streams on the kıraathane TV: the "📺 Maçı izle" HUD button while one is on air,
 * and the 2D player overlay (an iframe for embed links, a <video> for direct / HLS links).
 * The overlay keeps the game running underneath; "küçült" turns it into a corner view.
 */
export function TvWatch({ game, tvJson, seated, toast }: { game: Game | null; tvJson: string; seated: boolean; toast: (t: { text: string; kind: 'info' | 'good' | 'bad' }) => void }) {
  let b: TvBroadcast | null = null;
  try {
    b = tvJson ? (JSON.parse(tvJson) as TvBroadcast) : null;
  } catch {
    b = null;
  }
  const stream = isTvStream(b) ? b : null;
  const [mode, setMode] = useState<Mode>('closed');
  const [nearTv, setNearTv] = useState(false);
  const toastRef = useRef(toast);
  toastRef.current = toast;

  // "Canlı yayın başladı" once per broadcast; the overlay closes when the stream ends
  const id = stream?.id ?? '';
  const title = stream?.title ?? '';
  useEffect(() => {
    if (!id) {
      setMode('closed');
      return;
    }
    toastRef.current({ text: `📺 Canlı yayın başladı: ${title}`, kind: 'info' });
  }, [id, title]);

  // no double sound: the 3D TV goes quiet while the overlay plays
  useEffect(() => {
    game?.kahve?.setTvAudio(mode === 'closed');
  }, [game, mode]);

  // the button glows when you stand in front of the big screen
  useEffect(() => {
    if (!game || !id) return;
    const iv = setInterval(() => {
      const p = game.localPosition();
      setNearTv(!!p && p.x > HALL.x0 && p.x < HALL.x1 && p.z > HALL.z0 && p.z < HALL.z1 && Math.hypot(p.x - MAIN_TV.x, p.z - MAIN_TV.z) < 11);
    }, 500);
    return () => clearInterval(iv);
  }, [game, id]);

  if (!stream) return null;
  return (
    <>
      {mode === 'closed' && (
        <button className={`btn tvwatch-btn ${nearTv ? 'near' : ''}`} onClick={() => setMode(seated ? 'mini' : 'full')}>
          📺 Maçı izle{nearTv ? '' : <span className="lbl"> · {stream.title}</span>}
        </button>
      )}
      {mode !== 'closed' && (
        <div className={`tvwatch ${mode}`} role="dialog" aria-label={`Canlı yayın: ${stream.title}`}>
          <div className="tvwatch-box">
            <div className="tvwatch-head">
              <span className="tvwatch-live">● CANLI</span>
              <b className="tvwatch-title">{stream.title}</b>
              <button className="btn small" title={mode === 'full' ? 'Küçült' : 'Büyüt'} onClick={() => setMode(mode === 'full' ? 'mini' : 'full')}>
                {mode === 'full' ? '🗗' : '⛶'}
              </button>
              <button className="btn small" title="Kapat" onClick={() => setMode('closed')}>
                ✕
              </button>
            </div>
            <StreamPlayer url={stream.url} type={stream.streamType} />
          </div>
        </div>
      )}
    </>
  );
}
