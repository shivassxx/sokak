import { useCallback, useEffect, useRef, useState } from 'react';
import type { Room } from 'colyseus.js';
import { createRoom, forgetRoom, joinRoom, tryReconnect } from '../net/connection';
import { Home } from './Home';
import { Practice } from './Practice';
import { GameScreen } from './GameScreen';
import type { Prefs } from './prefs';
import { unlockAudio } from '../game/audio';

// browsers only allow audio after a user gesture
for (const ev of ['pointerdown', 'keydown'] as const) window.addEventListener(ev, unlockAudio, { passive: true });

function inviteFromUrl(): string | null {
  const id = new URLSearchParams(location.search).get('oda');
  return id && /^[A-Za-z0-9]{6,20}$/.test(id) ? id : null;
}

function setUrlRoom(id: string | null): void {
  const url = new URL(location.href);
  if (id) url.searchParams.set('oda', id);
  else url.searchParams.delete('oda');
  history.replaceState(null, '', url);
}

function errorText(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (/not found|locked|full/i.test(msg)) return 'Bu oda bulunamadı ya da dolu. Yeni bir oda kurabilirsin.';
  return 'Sunucuya bağlanılamadı. Biraz sonra tekrar dene.';
}

export function App() {
  const [invite, setInvite] = useState<string | null>(inviteFromUrl);
  const [room, setRoom] = useState<Room | null>(null);
  const [practice, setPractice] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reconnecting, setReconnecting] = useState(false);
  const leavingRef = useRef(false);

  const attach = useCallback((r: Room) => {
    leavingRef.current = false;
    // messages that arrive before the 3D scene is wired are simply dropped
    r.onMessage('*', () => {});
    setUrlRoom(r.roomId);
    setRoom(r);
    r.onLeave(async (code) => {
      if (leavingRef.current || code === 4000 || code === 1000) return;
      // unexpected drop: retry within the reconnect window
      setReconnecting(true);
      const t0 = Date.now();
      while (Date.now() - t0 < 19000) {
        const again = await tryReconnect(r.roomId);
        if (again) {
          setReconnecting(false);
          attach(again);
          return;
        }
        await new Promise((res) => setTimeout(res, 1500));
      }
      setReconnecting(false);
      setRoom(null);
      setError('Bağlantı koptu. Odaya tekrar katılmayı deneyebilirsin.');
    });
  }, []);

  // resume after page reload
  useEffect(() => {
    if (!invite) return;
    setBusy(true);
    void tryReconnect(invite).then((r) => {
      setBusy(false);
      if (r) attach(r);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const run = async (fn: () => Promise<Room>) => {
    setBusy(true);
    setError(null);
    try {
      attach(await fn());
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  if (practice) return <Practice onExit={() => setPractice(false)} />;
  if (room) {
    return (
      <GameScreen
        room={room}
        reconnecting={reconnecting}
        onLeave={() => {
          leavingRef.current = true;
          forgetRoom();
          void room.leave(true);
          setRoom(null);
          setUrlRoom(null);
          setInvite(null);
        }}
      />
    );
  }
  return (
    <Home
      inviteRoomId={invite}
      busy={busy}
      error={error}
      onCreate={(p: Prefs) => run(() => createRoom(p))}
      onJoin={(p: Prefs) => run(() => joinRoom(invite!, p))}
      onPractice={() => setPractice(true)}
    />
  );
}
