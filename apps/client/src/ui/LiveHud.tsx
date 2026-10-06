import { useEffect, useState, type MutableRefObject } from 'react';
import { BASE, BASE_RADIUS, CONTAINERS, CONTAINER_REACH, PEBBLE_COOLDOWN, SPOT_RANGE, type RoomView } from '@sokak/shared';
import type { Game } from '../game/Game';
import type { Action } from '../game/input';
import { isTouch } from './TouchControls';

export interface Senses {
  /** noises the Ebe heard: world angle, loudness, local time (ms) */
  noise: { a: number; loud: number; t: number }[];
  /** 0..1 how close the Ebe is (hiders) */
  e: number;
  lastThrow: number;
}

/** angle on screen (radians, clockwise from up) of a world direction */
export function screenAngle(worldAngle: number, camYaw: number): number {
  const fwd = Math.atan2(-Math.sin(camYaw), -Math.cos(camYaw));
  let d = -(worldAngle - fwd);
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function edgeDist(c: { x: number; z: number; w: number; d: number }, x: number, z: number): number {
  return Math.hypot(Math.max(Math.abs(x - c.x) - c.w / 2, 0), Math.max(Math.abs(z - c.z) - c.d / 2, 0));
}

function useTicker(hz: number): number {
  const [n, setN] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setN((v) => (v + 1) % 1e6), 1000 / hz);
    return () => clearInterval(iv);
  }, [hz]);
  return n;
}

function Hold({ game, action, children, className }: { game: Game; action: Action; children: React.ReactNode; className?: string }) {
  return (
    <button
      className={`act ${className ?? ''}`}
      onPointerDown={(e) => {
        e.stopPropagation();
        game.input.setHeld(action, true);
      }}
      onPointerUp={() => game.input.setHeld(action, false)}
      onPointerCancel={() => game.input.setHeld(action, false)}
      onPointerLeave={() => game.input.setHeld(action, false)}
    >
      {children}
    </button>
  );
}

/**
 * Fast-updating HUD (15 Hz): stamina, compass to the base, the Ebe's
 * footstep indicators, "Ebe yakın" heartbeat, contextual action buttons.
 */
export function LiveHud({ game, view, me, senses }: { game: Game; view: RoomView; me: string; senses: MutableRefObject<Senses> }) {
  useTicker(15);
  const p = view.players[me];
  const isEbe = view.ebeId === me && view.phase !== 'lobby';
  const playing = view.phase === 'counting' || view.phase === 'seeking';
  const hiderActive = !isEbe && p?.role === 'hider' && (p.status === 'hiding' || p.status === 'spotted') && playing;
  const pos = game.localPosition();
  const now = performance.now();
  const s = senses.current;
  const st = game.stamina();

  // contextual primary action
  let primary: { label: string; hint: string; ready: boolean } | null = null;
  if (isEbe && view.phase === 'seeking' && pos) {
    const atBase = Math.hypot(pos.x - BASE.x, pos.z - BASE.z) <= BASE_RADIUS;
    const sees = game.visibleRemotes().some((r) => view.players[r.id]?.status === 'hiding' && Math.hypot(r.x - pos.x, r.z - pos.z) <= SPOT_RANGE);
    const nearBox = CONTAINERS.some((c) => edgeDist(c, pos.x, pos.z) <= 1.8);
    primary = { label: nearBox && !sees ? 'Kapağı aç!' : 'Gördüm!', hint: 'E', ready: !atBase && (sees || nearBox) };
  } else if (hiderActive && pos && p?.status === 'hiding') {
    if (game.inside >= 0) primary = { label: 'Dışarı çık', hint: 'E', ready: true };
    else if (CONTAINERS.some((c) => edgeDist(c, pos.x, pos.z) <= CONTAINER_REACH)) primary = { label: 'Konteynere saklan', hint: 'E', ready: true };
  }
  const canThrow = hiderActive && view.phase === 'seeking' && game.inside < 0;
  const cd = Math.max(0, PEBBLE_COOLDOWN - (now - s.lastThrow) / 1000);

  // compass to the base for hiders
  let compass: { angle: number; dist: number } | null = null;
  if (hiderActive && pos) {
    const a = Math.atan2(BASE.x - pos.x, BASE.z - pos.z);
    compass = { angle: screenAngle(a, game.camYaw), dist: Math.round(Math.hypot(BASE.x - pos.x, BASE.z - pos.z)) };
  }

  const noises = isEbe ? s.noise.filter((n) => now - n.t < 1400) : [];
  const heart = hiderActive && view.phase === 'seeking' ? s.e : 0;

  return (
    <>
      {heart > 0.05 && (
        <div className="heartbeat" style={{ opacity: 0.25 + heart * 0.75, animationDuration: `${1.1 - heart * 0.6}s` }}>
          {heart > 0.45 && <span className="heart-text">Ebe çok yakın!</span>}
        </div>
      )}
      {noises.map((n, i) => {
        const ang = screenAngle(n.a, game.camYaw);
        const age = (now - n.t) / 1400;
        return (
          <div key={`${n.t}-${i}`} className="noise" style={{ transform: `rotate(${ang}rad)`, opacity: (1 - age) * (0.35 + n.loud * 0.65) }}>
            <div className="noise-arc" style={{ transform: `scale(${0.7 + n.loud * 0.6})` }} />
            <span style={{ transform: `rotate(${-ang}rad)` }}>tıkırtı</span>
          </div>
        );
      })}
      {compass && (
        <div className="compass">
          <div className="compass-arrow" style={{ transform: `rotate(${compass.angle}rad)` }}>
            ▲
          </div>
          <span>Ebe Duvarı · {compass.dist} m</span>
        </div>
      )}
      {(st.value < 0.999 || game.input.isHeld('sprint')) && game.hasLocal() && (
        <div className={`stamina ${st.tired ? 'tired' : ''}`}>
          <div style={{ width: `${st.value * 100}%` }} />
          <span>{st.tired ? 'Nefes nefese…' : 'Koş'}</span>
        </div>
      )}
      <div className={`actions ${isTouch ? 'touch' : ''}`}>
        {primary && (
          <button className={`act primary ${primary.ready ? 'ready' : ''}`} onPointerDown={(e) => (e.stopPropagation(), game.input.trigger('spot'))}>
            {primary.label}
            {!isTouch && <kbd>{primary.hint}</kbd>}
          </button>
        )}
        {canThrow && (
          <button className="act" disabled={cd > 0} onPointerDown={(e) => (e.stopPropagation(), game.input.trigger('throw'))}>
            {cd > 0 ? `${Math.ceil(cd)} sn` : 'Taş at'}
            {!isTouch && <kbd>Q</kbd>}
          </button>
        )}
        {isTouch && game.hasLocal() && game.inside < 0 && (
          <>
            <Hold game={game} action="sprint" className="small">
              Koş
            </Hold>
            <Hold game={game} action="jump" className="small">
              Zıpla
            </Hold>
            <Hold game={game} action="crouch" className="small">
              Çömel
            </Hold>
          </>
        )}
      </div>
    </>
  );
}
