import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import type { Room } from 'colyseus.js';
import { createRoom, forgetRoom, joinKahve, joinRoom, tryReconnect } from '../net/connection';
import { Home, type Mode } from './Home';
import { Practice } from './Practice';
import { GameScreen } from './GameScreen';
import type { Prefs } from './prefs';
import { unlockAudio } from '../game/audio';

// the kahvehane (3D + okey UI) is only downloaded when someone goes there
const KahveScreen = lazy(() => import('./kahve/KahveScreen').then((m) => ({ default: m.KahveScreen })));

// browsers only allow audio after a user gesture
for (const ev of ['pointerdown', 'keydown'] as const) window.addEventListener(ev, unlockAudio, { passive: true });

type Kind = 'oda' | 'kahve';
const valid = (id: string | null) => (id && /^[A-Za-z0-9]{6,20}$/.test(id) ? id : null);

function inviteFromUrl(): { kind: Kind; id: string } | null {
  const q = new URLSearchParams(location.search);
  const kahve = valid(q.get('kahve'));
  if (kahve) return { kind: 'kahve', id: kahve };
  const oda = valid(q.get('oda'));
  return oda ? { kind: 'oda', id: oda } : null;
}

function setUrlRoom(kind: Kind, id: string | null): void {
  const url = new URL(location.href);
  url.searchParams.delete('oda');
  url.searchParams.delete('kahve');
  if (id) url.searchParams.set(kind, id);
  history.replaceState(null, '', url);
}

function errorText(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (/not found|locked|full/i.test(msg)) return 'Bu oda bulunamadı ya da dolu. Yeni bir oda kurabilirsin.';
  return 'Sunucuya bağlanılamadı. Biraz sonra tekrar dene.';
}

export function App() {
  const [invite, setInvite] = useState(inviteFromUrl);
  const [room, setRoom] = useState<{ room: Room; kind: Kind } | null>(null);
  const [practice, setPractice] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reconnecting, setReconnecting] = useState(false);
  const leavingRef = useRef(false);

  const attach = useCallback((r: Room, kind: Kind) => {
    leavingRef.current = false;
    // messages that arrive before the 3D scene is wired are simply dropped
    r.onMessage('*', () => {});
    setUrlRoom(kind, r.roomId);
    setRoom({ room: r, kind });
    r.onLeave(async (code) => {
      if (leavingRef.current || code === 4000 || code === 1000) return;
      // unexpected drop: retry within the reconnect window
      setReconnecting(true);
      const t0 = Date.now();
      while (Date.now() - t0 < 19000) {
        const again = await tryReconnect(r.roomId);
        if (again) {
          setReconnecting(false);
          attach(again, kind);
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
    void tryReconnect(invite.id).then((r) => {
      setBusy(false);
      if (r) attach(r, invite.kind);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const run = async (fn: () => Promise<Room>, kind: Kind) => {
    setBusy(true);
    setError(null);
    try {
      attach(await fn(), kind);
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
    void room.room.leave(true);
    setRoom(null);
    setUrlRoom('oda', null);
    setInvite(null);
  };

  if (practice) return <Practice onExit={() => setPractice(false)} />;
  if (room?.kind === 'oda') return <GameScreen room={room.room} reconnecting={reconnecting} onLeave={leave} />;
  if (room?.kind === 'kahve') {
    return (
      <Suspense fallback={<div className="loading">Kahvehane açılıyor…</div>}>
        <KahveScreen room={room.room} reconnecting={reconnecting} onLeave={leave} />
      </Suspense>
    );
  }
  return (
    <Home
      invite={invite}
      busy={busy}
      error={error}
      onStart={(mode: Mode, p: Prefs) => {
        if (mode === 'saklambac') {
          if (invite?.kind === 'oda') void run(() => joinRoom(invite.id, p), 'oda');
          else void run(() => createRoom(p), 'oda');
        } else void run(() => joinKahve(p, invite?.kind === 'kahve' ? invite.id : undefined), 'kahve');
      }}
      onPractice={() => setPractice(true)}
    />
  );
}
