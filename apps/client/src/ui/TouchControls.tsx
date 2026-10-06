import { useEffect, useState } from 'react';
import type { Input } from '../game/input';

export const isTouch = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;

/** On-screen joystick visual (touch devices). Buttons live in LiveHud. */
export function TouchControls({ input }: { input: Input }) {
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
    </>
  );
}
