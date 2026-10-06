import { useEffect, useRef, useState } from 'react';
import type { Room } from 'colyseus.js';
import {
  COUNTING_SECONDS,
  MSG,
  SOBE_CALL,
  PEBBLE_COOLDOWN,
  type PebbleMsg,
  type EmoteMsg,
  type EventMsg,
  type InputMsg,
  type SnapshotMsg,
  type SummaryMsg,
  type TeleportMsg,
  type PlayerView,
  type ChatMsg,
  QUICK_CHAT,
} from '@sokak/shared';
import type { Game } from '../game/Game';
import { useRoomView } from '../net/useRoom';
import { Lobby, shareRoom } from './Lobby';
import { Social } from './Social';
import { ambience, countWord, footsteps, play, say } from '../game/audio';
import { LiveHud, screenAngle, type Senses } from './LiveHud';
import type { Pose } from '../game/character';
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
  const pushToastRef = useRef(pushToast);
  pushToastRef.current = pushToast;
  const [banner, showBanner] = useBanner();
  const [summary, setSummary] = useState<SummaryMsg | null>(null);
  const [showScores, setShowScores] = useState(false);
  const senses = useRef<Senses>({ noise: [], e: 0, lastThrow: -1e9 });
  const me = room.sessionId;
  // the first timeLeft seen while counting = total count (server decides the length)
  const countTotal = useRef(COUNTING_SECONDS);
  const lastPhase = useRef<string | null>(null);
  if (view && view.phase !== lastPhase.current) {
    if (view.phase === 'counting') countTotal.current = Math.max(1, view.timeLeft);
    lastPhase.current = view.phase;
  }
  const lastTick = useRef(-1);
  useEffect(() => {
    if (!view || view.phase !== 'counting' || view.timeLeft === lastTick.current) return;
    lastTick.current = view.timeLeft;
    play('tick');
    if (view.ebeId === me) say(countWord(Math.max(1, countTotal.current - view.timeLeft + 1)), 1.2);
  }, [view, me]);
  // E = "Gördüm!" for the Ebe, get in/out of a container for hiders; Q = pebble
  useEffect(() => {
    if (!game) return;
    return game.input.onPress((a) => {
      const v = viewRef.current;
      if (a === 'spot') room.send(v?.ebeId === me ? MSG.spot : MSG.interact);
      if (a === 'throw' && v?.phase === 'seeking' && v.ebeId !== me) {
        const now = performance.now();
        if (now - senses.current.lastThrow < PEBBLE_COOLDOWN * 1000 || game.inside >= 0) return;
        senses.current.lastThrow = now;
        game.playLocalEmote('point');
        room.send(MSG.throwPebble);
      }
    });
  }, [game, room, me]);

  // movement sounds + street ambience
  useEffect(() => {
    if (!game) return;
    game.events = {
      onJump: () => play('jump'),
      onLand: () => play('land'),
      onStep: (speed, sprinting) => footsteps(game.inside >= 0 ? 0 : speed, sprinting),
    };
    const iv = setInterval(() => ambience(true), 1500);
    return () => {
      clearInterval(iv);
      ambience(false);
      game.events = {};
    };
  }, [game]);

  // round poses: Ebe hides its eyes at the wall, "!" over spotted kids, sad caught kids, happy winners
  useEffect(() => {
    if (!game || !view) return;
    for (const p of Object.values(view.players)) {
      let pose: Pose = 'none';
      if (p.id === view.ebeId && (view.phase === 'counting' || view.phase === 'ebeSelection')) pose = 'counting';
      else if (view.phase === 'seeking' && p.status === 'spotted') pose = 'spotted';
      else if ((view.phase === 'seeking' || view.phase === 'roundEnd') && p.status === 'caught') pose = 'caught';
      else if (view.phase === 'roundEnd' && p.status === 'safe') pose = 'celebrate';
      game.setPose(p.id === me ? null : p.id, pose);
    }
  }, [game, view, me]);

  // Ebe cannot move or look around while counting
  const frozen = !!view && view.ebeId === me && (view.phase === 'ebeSelection' || view.phase === 'counting');
  useEffect(() => {
    if (game) game.frozen = frozen;
  }, [game, frozen]);

  // the evening darkens while the Ebe seeks; streetlights fade in
  const seekTotal = useRef(180);
  useEffect(() => {
    if (!game || !view) return;
    if (view.phase === 'seeking') {
      seekTotal.current = Math.max(seekTotal.current === 180 ? view.timeLeft : seekTotal.current, 1);
      game.setDusk(0.3 + 0.7 * (1 - view.timeLeft / seekTotal.current));
    } else if (view.phase === 'lobby') game.setDusk(0.1);
    else if (view.phase !== 'roundEnd') {
      seekTotal.current = 180;
      game.setDusk(0.25);
    }
  }, [game, view]);

  // rule events → toasts / banners
  useEffect(() => {
    const offEv = room.onMessage(MSG.event, (e: EventMsg) => {
      const v = viewRef.current;
      if (e.type === 'spotMiss') {
        pushToast({ text: e.reason === 'base' ? 'Ebe Duvarı’ndan “Gördüm” diyemezsin, biraz uzaklaş!' : 'Yakında görünen kimse yok…', kind: 'info' });
        return;
      }
      if (e.type === 'countingDone') {
        play('go');
        say(SOBE_CALL, 1.15);
        gameRef.current?.shake(0.15);
      } else if (e.type === 'spotted') {
        play('spotted');
        if (e.id === me) gameRef.current?.shake(0.35);
      } else if (e.type === 'caught') {
        play('caught');
        gameRef.current?.shake(e.id === me ? 0.4 : 0.12);
      }
      else if (e.type === 'safe' && e.how === 'base') play('safe');
      else if (e.type === 'ebeChosen') play('pop');
      else if (e.type === 'herkesKurtuldu') {
        play('herkes');
        say('Herkes kurtuldu!');
      }
      if (e.type === 'countingDone') showBanner(SOBE_CALL, 4000);
      else if (e.type === 'herkesKurtuldu') showBanner(e.by === me ? 'HERKES KURTULDU! Hepsi senin sayende!' : `HERKES KURTULDU! (${nameOf(v, e.by)} sayesinde)`, 4500);
      else if (e.type === 'phase' && e.phase === 'ebeSelection') setSummary(null);
      const t = eventText(v, e, me);
      if (t) pushToast(t);
    });
    const offSum = room.onMessage(MSG.summary, (s: SummaryMsg) => {
      play('roundEnd');
      setSummary(s);
    });
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

  const gameRef = useRef<Game | null>(null);
  gameRef.current = game;

  // create the 3D scene once
  useEffect(() => {
    let g: Game | null = null;
    let cancelled = false;
    void import('../game/Game').then(async ({ Game, loadCharacterKit }) => {
      await loadCharacterKit();
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
        const m: InputMsg = { s, mx: input.mx, mz: input.mz, j: input.jump ? 1 : 0, c: input.crouch ? 1 : 0, y: yaw, r: input.sprint ? 1 : 0 };
        room.send(MSG.input, m);
      },
    };
    const offSnap = room.onMessage(MSG.snapshot, (s: SnapshotMsg) => {
      game.noteServerTime(s.t);
      if (s.me) {
        const [x, y, z, vy, g, stamina = 1, tired = 0, inside = -1] = s.me;
        const me = viewRef.current?.players[room.sessionId];
        if (!game.hasLocal()) game.spawnLocal(x, y, z, me ?? { color: '#e74c3c', hat: 0, hair: 0, skin: 0 });
        else game.reconcile(s.a, x, y, z, vy, g === 1, stamina, tired === 1, inside);
      } else if (game.hasLocal()) game.removeLocal();
      const now = performance.now();
      if (s.n) for (const [a, loud] of s.n) senses.current.noise.push({ a, loud, t: now });
      if (senses.current.noise.length > 30) senses.current.noise.splice(0, senses.current.noise.length - 30);
      senses.current.e = s.e ?? 0;
      for (const p of s.p) game.pushRemote(p[0], s.t, p[1], p[2], p[3], p[4], (p[5] & 1) === 1);
    });
    const offTp = room.onMessage(MSG.teleport, (t: TeleportMsg) => game.teleportLocal(t.x, t.y, t.z, t.yaw));
    const offPebble = room.onMessage(MSG.pebble, (p: PebbleMsg) => {
      game.pebble(p.x, p.z);
      const pos = game.localPosition();
      const pan = pos ? Math.sin(screenAngle(Math.atan2(p.x - pos.x, p.z - pos.z), game.camYaw)) : 0;
      play('pebble', pan);
    });
    const offEmote = room.onMessage(MSG.emote, (e: EmoteMsg) => {
      if (e.id === room.sessionId) game.playLocalEmote(e.e);
      else game.remoteEmote(e.id, e.e);
    });
    const offChat = room.onMessage(MSG.chat, (c: ChatMsg) => {
      const text = QUICK_CHAT[c.q];
      if (!text) return;
      play('pop');
      if (c.id === room.sessionId) game.bubble(null, text);
      else if (game.visibleRemotes().some((r) => r.id === c.id)) game.bubble(c.id, text);
      else pushToastRef.current({ text: `${nameOf(viewRef.current, c.id)}: “${text}”`, kind: 'info' });
    });
    return () => {
      game.sender = null;
      offSnap();
      offTp();
      offPebble();
      offEmote();
      offChat();
    };
  }, [game, room]);

  // keep remote characters in sync with the player list
  useEffect(() => {
    if (!game || !view) return;
    const ids = new Set(Object.keys(view.players));
    for (const id of game.remoteIds()) if (!ids.has(id)) game.removeRemote(id);
    for (const p of Object.values(view.players)) {
      if (p.id === room.sessionId) continue;
      const [label, color] = labelFor(p, view.ebeId, view.phase);
      game.upsertRemote(p.id, p, label, color);
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
        {view && view.phase !== 'lobby' && Object.keys(view.players).length < 10 && (
          <button
            className="btn small"
            onClick={async () => {
              const r = await shareRoom(room.roomId);
              pushToast({ text: r === 'failed' ? 'Link kopyalanamadı' : 'Davet linki hazır, arkadaşına gönder!', kind: 'info' });
            }}
          >
            Davet et
          </button>
        )}
      </div>
      {view && view.phase === 'lobby' && <Lobby room={room} view={view} />}
      {view && view.phase !== 'lobby' && <Hud view={view} me={me} toasts={toasts} banner={banner} countingTotal={countTotal.current} />}
      {view && view.phase === 'roundEnd' && summary && <SummaryPanel view={view} summary={summary} me={me} />}
      {view && showScores && view.phase !== 'roundEnd' && <Scoreboard view={view} me={me} onClose={() => setShowScores(false)} />}
      {game && view && <Social room={room} input={game.input} />}
      {game && view && view.phase !== 'roundEnd' && <LiveHud game={game} view={view} me={me} senses={senses} />}
      {game && isTouch && <TouchControls input={game.input} />}
    </div>
  );
}

function labelFor(p: PlayerView, ebeId: string, phase: string): [string, string] {
  if (phase !== 'lobby' && p.id === ebeId) return [`👁 ${p.name} (ebe)`, '#ffb4a6'];
  switch (p.status) {
    case 'spotted':
      return [`${p.name} — görüldü!`, '#ffd27a'];
    case 'caught':
      return [`${p.name} — sobelendi`, '#c8c8c8'];
    case 'safe':
      return [`${p.name} ✓`, '#9ff0b8'];
    default:
      return [p.name, '#ffffff'];
  }
}
