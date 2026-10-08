import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { Room } from "colyseus.js";
import {
  KMSG,
  type FriendReqMsg,
  type FriendsView,
  type KPlayerView,
} from "@sokak/shared";
import { getFriends, removeFriend } from "../net/connection";
import "./achievements.css";
import "./friends.css";

/**
 * 👥 Arkadaşlar: mutual friends (no accounts). In a salon it also lists the people here so you
 * can ask them; a request is answered by asking back. Friends see each other's salon.
 */
export function FriendsPanel({
  onClose,
  room,
  players,
  me,
}: {
  onClose: () => void;
  room?: Room;
  players?: Record<string, KPlayerView>;
  me?: string;
}) {
  const [data, setData] = useState<FriendsView | null | undefined>(undefined);
  const load = useCallback(() => {
    getFriends()
      .then(setData)
      .catch(() => setData((d) => d ?? null));
  }, []);
  useEffect(() => {
    load();
    const off = room?.onMessage(KMSG.friendUpdate, load);
    const t = setInterval(load, 15000);
    return () => {
      off?.();
      clearInterval(t);
    };
  }, [room, load]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const friendNames = new Set(data?.friends.map((f) => f.name));
  const here =
    players && me
      ? Object.values(players).filter((p) => !p.isBot && p.id !== me)
      : [];
  const go = (roomId: string) => {
    if (room?.roomId === roomId) return onClose();
    location.assign(`${location.pathname}?kahve=${encodeURIComponent(roomId)}`);
  };
  const drop = async (code: string) => {
    await removeFriend(code).catch(() => false);
    load();
  };
  return createPortal(
    <div className="ach-overlay" onClick={onClose}>
      <div
        className="ach-panel friends-panel"
        role="dialog"
        aria-label="Arkadaşlar"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <div className="ach-head">
          <h2>👥 Arkadaşlar</h2>
          <button className="btn small" onClick={onClose}>
            Kapat
          </button>
        </div>
        <p className="hint">
          Arkadaşlık karşılıklıdır: sen eklersin, o da seni eklerse arkadaş
          olursunuz ve birbirinizin hangi salonda olduğunu görürsünüz.
        </p>
        {data === undefined && <p className="hint">Yükleniyor…</p>}
        {data === null && (
          <p className="hint">Arkadaş listesi şu an alınamadı.</p>
        )}
        {data && data.incoming.length > 0 && (
          <section>
            <h3>Seni eklemek isteyenler</h3>
            <ul className="fr-list">
              {data.incoming.map((r) => {
                const p = here.find((x) => x.name === r.name);
                return (
                  <li key={r.code}>
                    <b>{r.name}</b>
                    {p && room ? (
                      <button
                        className="btn small primary"
                        onClick={() => room.send(KMSG.friendAdd, { id: p.id })}
                      >
                        Kabul et
                      </button>
                    ) : (
                      <small>Aynı salona gelince kabul edebilirsin</small>
                    )}
                    <button
                      className="btn small"
                      onClick={() => void drop(r.code)}
                    >
                      Reddet
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
        {data && (
          <section>
            <h3>Arkadaşların ({data.friends.length})</h3>
            {data.friends.length === 0 && (
              <p className="hint">
                Henüz arkadaşın yok. Aynı salondaki biriyle oynadıysan aşağıdan
                ekleyebilirsin.
              </p>
            )}
            <ul className="fr-list">
              {[...data.friends]
                .sort((a, b) => Number(!!b.online) - Number(!!a.online))
                .map((f) => (
                  <li key={f.code} className={f.online ? "on" : ""}>
                    <span className="fr-dot" aria-hidden />
                    <b>{f.name}</b>
                    <small>
                      {f.online
                        ? room?.roomId === f.online.roomId
                          ? "Burada"
                          : f.online.salon || "Bir salonda"
                        : "Çevrimdışı"}
                    </small>
                    {f.online && room?.roomId !== f.online.roomId && (
                      <button
                        className="btn small primary"
                        onClick={() => go(f.online!.roomId)}
                      >
                        Yanına git
                      </button>
                    )}
                    <button
                      className="btn small"
                      title="Arkadaşlıktan çıkar"
                      onClick={() => void drop(f.code)}
                    >
                      ✕
                    </button>
                  </li>
                ))}
            </ul>
          </section>
        )}
        {data && room && (
          <section>
            <h3>Bu salondakiler</h3>
            {here.length === 0 && (
              <p className="hint">Salonda senden başka kimse yok.</p>
            )}
            <ul className="fr-list">
              {here.map((p) => (
                <li key={p.id}>
                  <span className="dotc" style={{ background: p.color }} />
                  <b>{p.name}</b>
                  {friendNames.has(p.name) ? (
                    <small>Arkadaşın</small>
                  ) : (
                    <button
                      className="btn small"
                      onClick={() => room.send(KMSG.friendAdd, { id: p.id })}
                    >
                      ➕ Ekle
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>,
    document.body,
  );
}

/** In-game: the HUD button (with pending requests) and a toast when someone here asks. */
export function FriendsHud({
  room,
  players,
  me,
}: {
  room: Room;
  players: Record<string, KPlayerView>;
  me: string;
}) {
  const [open, setOpen] = useState(false);
  const [asks, setAsks] = useState<FriendReqMsg[]>([]);
  useEffect(() => {
    const off = room.onMessage(KMSG.friendReq, (m: FriendReqMsg) =>
      setAsks((q) => [...q.filter((x) => x.from !== m.from), m]),
    );
    const off2 = room.onMessage(KMSG.friendUpdate, () => setAsks([]));
    return () => {
      off();
      off2();
    };
  }, [room]);
  const ask = asks[0];
  return (
    <>
      <button
        className="btn small"
        title="Arkadaşlar"
        onClick={() => setOpen((o) => !o)}
      >
        👥<span className="lbl"> Arkadaşlar</span>
        {asks.length > 0 && <b className="count"> {asks.length}</b>}
      </button>
      {ask &&
        players[ask.from] &&
        createPortal(
          <div className="fr-ask" role="status">
            <span>
              👥 <b>{ask.name}</b> seninle arkadaş olmak istiyor.
            </span>
            <button
              className="btn small primary"
              onClick={() => {
                room.send(KMSG.friendAdd, { id: ask.from });
                setAsks((q) => q.slice(1));
              }}
            >
              Kabul et
            </button>
            <button
              className="btn small"
              onClick={() => setAsks((q) => q.slice(1))}
            >
              Sonra
            </button>
          </div>,
          document.body,
        )}
      {open && (
        <FriendsPanel
          room={room}
          players={players}
          me={me}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

export default FriendsPanel;
