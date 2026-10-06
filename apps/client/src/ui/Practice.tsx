import { useEffect, useRef, useState } from 'react';
import type { Game } from '../game/Game';
import { TouchControls, isTouch } from './TouchControls';
import { loadPrefs } from './prefs';

/** Offline sandbox: walk around the mahalle alone. */
export function Practice({ onExit }: { onExit: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [game, setGame] = useState<Game | null>(null);
  useEffect(() => {
    let g: Game | null = null;
    let cancelled = false;
    void import('../game/Game').then(async ({ Game, loadCharacterKit }) => {
      await loadCharacterKit();
      if (cancelled || !canvasRef.current) return;
      g = new Game(canvasRef.current);
      g.spawnLocal(0, 0, 4, { ...loadPrefs() });
      if (import.meta.env.DEV) (window as unknown as { __game: Game }).__game = g;
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
      {game && isTouch && <TouchControls input={game.input} />}
      {game && isTouch && (
        <div className="actions touch">
          {(['sprint', 'jump', 'crouch'] as const).map((a) => (
            <button
              key={a}
              className="act small"
              onPointerDown={(e) => (e.stopPropagation(), game.input.setHeld(a, true))}
              onPointerUp={() => game.input.setHeld(a, false)}
              onPointerCancel={() => game.input.setHeld(a, false)}
            >
              {a === 'sprint' ? 'Koş' : a === 'jump' ? 'Zıpla' : 'Çömel'}
            </button>
          ))}
        </div>
      )}
      {!isTouch && <div className="help">WASD: yürü · Shift: koş · Fare sürükle: bak · Boşluk: zıpla · C: çömel · Çift tık: fare kilidi</div>}
    </div>
  );
}
