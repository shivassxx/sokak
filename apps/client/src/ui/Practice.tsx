import { useEffect, useRef, useState } from 'react';
import type { Game } from '../game/Game';
import { TouchControls, isTouch } from './TouchControls';

/** Offline sandbox: walk around the mahalle alone. */
export function Practice({ onExit }: { onExit: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [game, setGame] = useState<Game | null>(null);
  useEffect(() => {
    let g: Game | null = null;
    let cancelled = false;
    void import('../game/Game').then(({ Game }) => {
      if (cancelled || !canvasRef.current) return;
      g = new Game(canvasRef.current);
      g.spawnLocal(0, 0, 4, '#e74c3c');
      setGame(g);
    });
    return () => {
      cancelled = true;
      g?.dispose();
    };
  }, []);
  return (
    <div className="game-root">
      <canvas ref={canvasRef} className="game-canvas" />
      {!game && <div className="loading">Mahalle yükleniyor…</div>}
      <div className="hud-top">
        <button className="btn small" onClick={onExit}>
          ← Çık
        </button>
        <span className="pill">Antrenman — mahalleyi keşfet</span>
      </div>
      {game && isTouch && <TouchControls input={game.input} showSpot={false} spotReady={false} />}
      {!isTouch && <div className="help">WASD / oklar: yürü · Fare sürükle: bak · Boşluk: zıpla · C: çömel · Çift tık: fare kilidi</div>}
    </div>
  );
}
