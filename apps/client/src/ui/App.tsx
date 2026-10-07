import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import type { Room } from 'colyseus.js';
import { forgetRoom, joinKahve, tryReconnect } from '../net/connection';
import { Home } from './Home';
import { KahveLobby } from './kahve/KahveLobby';
import type { Prefs } from './prefs';
import { unlockAudio } from '../game/audio';

// the kahvehane (3D + okey UI) is only downloaded when someone goes there
const KahveScreen = lazy(() => import('./kahve/KahveScreen').then((m) => ({ default: m.KahveScreen })));

// browsers only allow audio after a user gesture
for (const ev of ['pointerdown', 'keydown'] as const) window.addEventListener(ev, unlockAudio, { passive: true });

const valid = (id: string | null) => (id && /^[A-Za-z0-9]{6,20}$/.test(id) ? id : null);

/** a salon invite link: ?kahve=<roomId> */
function inviteFromUrl(): string | null {
  return valid(new URLSearchParams(location.search).get('kahve'));
}

function setUrlRoom(id: string | null): void {
  const url = new URL(location.href);
  url.searchParams.delete('kahve');
  if (id) url.searchParams.set('kahve', id);
  history.replaceState(null, '', url);
}

function errorText(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (/not found|locked|full/i.test(msg)) return 'Bu salon bulunamadı ya da dolu. Lobiden başka bir salona girebilirsin.';
  return 'Sunucuya bağlanılamadı. Biraz sonra tekrar dene.';
}

export function App() {
  const [invite, setInvite] = useState(inviteFromUrl);
  const [room, setRoom] = useState<Room | null>(null);
  const [lobby, setLobby] = useState<Prefs | null>(null);
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
    setLobby(null);
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
      setError('Bağlantı koptu. Tekrar katılmayı deneyebilirsin.');
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

  const leave = () => {
    if (!room) return;
    leavingRef.current = true;
    forgetRoom();
    void room.leave(true);
    setRoom(null);
    setUrlRoom(null);
    setInvite(null);
  };

  if (lobby && !room) {
    return <KahveLobby prefs={lobby} busy={busy} error={error} onBack={() => setLobby(null)} onJoin={(how) => void run(() => joinKahve(lobby, how))} />;
  }
  if (room) {
    return (
      <Suspense fallback={<div className="loading">Kahvehane açılıyor…</div>}>
        <KahveScreen room={room} reconnecting={reconnecting} onLeave={leave} />
      </Suspense>
    );
  }
  return (
    <Home
      invite={!!invite}
      busy={busy}
      error={error}
      onStart={(p: Prefs) => {
        if (invite) void run(() => joinKahve(p, { roomId: invite }));
        else {
          setError(null);
          setLobby(p);
        }
      }}
    />
  );
}
