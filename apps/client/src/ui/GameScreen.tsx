import { useEffect, useRef, useState } from 'react';
import type { Room } from 'colyseus.js';
import {
  COUNTING_SECONDS,
  MSG,
  SOBE_CALL,
  type EmoteMsg,
  type EventMsg,
  type InputMsg,
  type SnapshotMsg,
  type SummaryMsg,
  type TeleportMsg,
} from '@sokak/shared';
import type { Game } from '../game/Game';
import { useRoomView } from '../net/useRoom';
import { Lobby } from './Lobby';
import { Hud, Scoreboard, SummaryPanel, eventText, nameOf, useBanner, useToasts } from './Hud';
import { TouchControls, isTouch } from './TouchControls';

interface Props {
  room: Room;
  onLeave: () => void;
  reconnecting: boolean;
}

export function GameScreen({ room, onLeave, reconnecting }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [game, setGame] = useState<Game | null>(null);
  const view = useRoomView(room);
  const viewRef = useRef(view);
  viewRef.current = view;
  const [toasts, pushToast] = useToasts();
  const [banner, showBanner] = useBanner();
  const [summary, setSummary] = useState<SummaryMsg | null>(null);
  const [showScores, setShowScores] = useState(false);
  const me = room.sessionId;

  // Ebe cannot move or look around while counting
  const frozen = !!view && view.ebeId === me && (view.phase === 'ebeSelection' || view.phase === 'counting');
  useEffect(() => {
    if (game) game.frozen = frozen;
  }, [game, frozen]);

  // rule events → toasts / banners
  useEffect(() => {
    const offEv = room.onMessage(MSG.event, (e: EventMsg) => {
      const v = viewRef.current;
      if (e.type === 'countingDone') showBanner(SOBE_CALL, 4000);
      else if (e.type === 'herkesKurtuldu') showBanner(e.by === me ? 'HERKES KURTULDU! Hepsi senin sayende!' : `HERKES KURTULDU! (${nameOf(v, e.by)} sayesinde)`, 4500);
      else if (e.type === 'phase' && e.phase === 'ebeSelection') setSummary(null);
      const t = eventText(v, e, me);
      if (t) pushToast(t);
    });
    const offSum = room.onMessage(MSG.summary, (s: SummaryMsg) => setSummary(s));
    return () => {
      offEv();
      offSum();
    };
  }, [room]); // eslint-disable-line react-hooks/exhaustive-deps

  // Tab = hold to show scoreboard
  useEffect(() => {
    if (!game) return;
    const off = game.input.onPress((a) => {
      if (a === 'scoreboard') setShowScores(true);
    });
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Tab') setShowScores(false);
    };
    window.addEventListener('keyup', up);
    return () => {
      off();
      window.removeEventListener('keyup', up);
    };
  }, [game]);

  // create the 3D scene once
  useEffect(() => {
    let g: Game | null = null;
    let cancelled = false;
    void import('../game/Game').then(({ Game }) => {
      if (cancelled || !canvasRef.current) return;
      g = new Game(canvasRef.current);
      setGame(g);
    });
    return () => {
      cancelled = true;
      g?.dispose();
    };
  }, []);

  // wire the room to the game (re-runs after a reconnect)
  useEffect(() => {
    if (!game) return;
    game.sender = {
      sendInput: (s, input, yaw) => {
        const m: InputMsg = { s, mx: input.mx, mz: input.mz, j: input.jump ? 1 : 0, c: input.crouch ? 1 : 0, y: yaw };
        room.send(MSG.input, m);
      },
    };
    const offSnap = room.onMessage(MSG.snapshot, (s: SnapshotMsg) => {
      game.noteServerTime(s.t);
      if (s.me) {
        const [x, y, z, vy, g] = s.me;
        const me = viewRef.current?.players[room.sessionId];
        if (!game.hasLocal()) game.spawnLocal(x, y, z, me?.color ?? '#e74c3c');
        else game.reconcile(s.a, x, y, z, vy, g === 1);
      } else if (game.hasLocal()) game.removeLocal();
      for (const p of s.p) game.pushRemote(p[0], s.t, p[1], p[2], p[3], p[4], (p[5] & 1) === 1);
    });
    const offTp = room.onMessage(MSG.teleport, (t: TeleportMsg) => game.teleportLocal(t.x, t.y, t.z, t.yaw));
    const offEmote = room.onMessage(MSG.emote, (e: EmoteMsg) => {
      if (e.id === room.sessionId) game.playLocalEmote(e.e);
      else game.remoteEmote(e.id, e.e);
    });
    return () => {
      game.sender = null;
      offSnap();
      offTp();
      offEmote();
    };
  }, [game, room]);

  // keep remote characters in sync with the player list
  useEffect(() => {
    if (!game || !view) return;
    const ids = new Set(Object.keys(view.players));
    for (const id of game.remoteIds()) if (!ids.has(id)) game.removeRemote(id);
    for (const p of Object.values(view.players)) {
      if (p.id === room.sessionId) continue;
      game.upsertRemote(p.id, p.color, p.name);
    }
  }, [game, view, room]);

  return (
    <div className="game-root">
      <canvas ref={canvasRef} className="game-canvas" />
      {!game && <div className="loading">Mahalle yükleniyor…</div>}
      <div className="hud-top">
        <button className="btn small" onClick={onLeave}>
          ← Çık
        </button>
        {reconnecting && <span className="pill warn">Bağlantı koptu, yeniden bağlanılıyor…</span>}
        {view && view.phase !== 'lobby' && (
          <button className="btn small" onPointerDown={() => setShowScores((v) => !v)}>
            Skor
          </button>
        )}
      </div>
      {view && view.phase === 'lobby' && <Lobby room={room} view={view} />}
      {view && view.phase !== 'lobby' && <Hud view={view} me={me} toasts={toasts} banner={banner} countingTotal={COUNTING_SECONDS} />}
      {view && view.phase === 'roundEnd' && summary && <SummaryPanel view={view} summary={summary} me={me} />}
      {view && showScores && view.phase !== 'roundEnd' && <Scoreboard view={view} me={me} onClose={() => setShowScores(false)} />}
      {game && isTouch && <TouchControls input={game.input} showSpot={false} spotReady={false} />}
    </div>
  );
}
