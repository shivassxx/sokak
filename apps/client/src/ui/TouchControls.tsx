import { useEffect, useState } from 'react';
import type { Action, Input } from '../game/input';

export const isTouch = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;

interface Props {
  input: Input;
  showSpot: boolean;
  spotReady: boolean;
}

function HoldButton({ input, action, label, className }: { input: Input; action: Action; label: string; className?: string }) {
  return (
    <button
      className={`touch-btn ${className ?? ''}`}
      onPointerDown={(e) => {
        e.stopPropagation();
        input.setHeld(action, true);
      }}
      onPointerUp={() => input.setHeld(action, false)}
      onPointerCancel={() => input.setHeld(action, false)}
      onPointerLeave={() => input.setHeld(action, false)}
    >
      {label}
    </button>
  );
}

/** On-screen joystick visual + action buttons (touch devices). */
export function TouchControls({ input, showSpot, spotReady }: Props) {
  const [, force] = useState(0);
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      force((n) => (n + 1) % 1000);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  const j = input.joyVisual;
  return (
    <>
      {j.active && (
        <>
          <div className="joy-base" style={{ left: j.ox, top: j.oy }} />
          <div className="joy-knob" style={{ left: j.x, top: j.y }} />
        </>
      )}
      {!j.active && <div className="joy-hint">Hareket için sürükle</div>}
      <div className="touch-buttons">
        {showSpot && <HoldButton input={input} action="spot" label="Gördüm!" className={`spot ${spotReady ? 'ready' : ''}`} />}
        <HoldButton input={input} action="jump" label="Zıpla" />
        <HoldButton input={input} action="crouch" label="Çömel" />
      </div>
    </>
  );
}
