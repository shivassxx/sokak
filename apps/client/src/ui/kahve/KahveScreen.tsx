import { useEffect, useMemo, useRef, useState } from 'react';
import type { Room } from 'colyseus.js';
import * as THREE from 'three';
import {
  BET_OPTIONS,
  HAND_OPTIONS,
  KMSG,
  MENU,
  MSG,
  QUICK_CHAT_OKEY,
  SIT_REACH,
  TABLES,
  seatPosition,
  type ChatMsg,
  type EmoteMsg,
  type InputMsg,
  type KTableView,
  type KahveView,
  type OkeyAction,
  type OkeyEventMsg,
  type ServedMsg,
  type SnapshotMsg,
  type TableView,
  type TeleportMsg,
} from '@sokak/shared';
import type { Game } from '../../game/Game';
import { play } from '../../game/audio';
import { useToasts } from '../Hud';
import { Social } from '../Social';
import { TouchControls, isTouch } from '../TouchControls';
import { OkeyBoard } from '../okey/OkeyBoard';

interface Props {
  room: Room;
  onLeave: () => void;
  reconnecting: boolean;
}

function useKahveView(room: Room): KahveView | null {
  const [view, setView] = useState<KahveView | null>(null);
  useEffect(() => {
    const update = () => {
      const json = room.state?.toJSON() as Partial<KahveView> | undefined;
      setView(json && json.players && json.tables ? (json as KahveView) : null);
    };
    update();
    room.onStateChange(update);
    return () => room.onStateChange.remove(update);
  }, [room]);
  return view;
}

const money = (n: number) => `${n.toLocaleString('tr-TR')} ₺`;

export function KahveScreen({ room, onLeave, reconnecting }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [game, setGame] = useState<Game | null>(null);
  const view = useKahveView(room);
  const viewRef = useRef(view);
  viewRef.current = view;
  const [toasts, pushToast] = useToasts();
  const toastRef = useRef(pushToast);
  toastRef.current = pushToast;
  const [hand, setHand] = useState<{ tiles: number[]; taken: number | null }>({ tiles: [], taken: null });
  const [menuOpen, setMenuOpen] = useState(false);
  const [orderTo, setOrderTo] = useState<string>('me');
  const [nearTable, setNearTable] = useState<number>(-1);
  /** recently served drinks per player (shown as badges at the table) */
  const [drinks, setDrinks] = useState<Record<string, { emoji: string; t: number }[]>>({});
  const offset = useRef(0);
  const me = room.sessionId;
  const myP = view?.players[me];
  const myTable: KTableView | null = myP && myP.table >= 0 ? view!.tables[myP.table]! : null;
  const tableView: TableView | null = useMemo(() => (myTable?.view ? (JSON.parse(myTable.view) as TableView) : null), [myTable?.view]);
  const name = (id: string) => view?.players[id]?.name ?? 'biri';

  // ------------------------------------------------------------ 3D scene
  useEffect(() => {
    let g: Game | null = null;
    let cancelled = false;
    void Promise.all([import('../../game/Game'), import('../../game/kahveScene')]).then(([{ Game }, { buildKahve }]) => {
      if (cancelled || !canvasRef.current) return;
      g = new Game(canvasRef.current, 'kahve', buildKahve);
      setGame(g);
    });
    return () => {
      cancelled = true;
      g?.dispose();
    };
  }, []);

  // ------------------------------------------------------------ network wiring
  useEffect(() => {
    if (!game) return;
    game.sender = {
      sendInput: (s, input, yaw) => {
        const m: InputMsg = { s, mx: input.mx, mz: input.mz, j: input.jump ? 1 : 0, c: input.crouch ? 1 : 0, y: yaw, r: input.sprint ? 1 : 0 };
        room.send(MSG.input, m);
      },
    };
    const offs = [
      room.onMessage(MSG.snapshot, (s: SnapshotMsg) => {
        game.noteServerTime(s.t);
        offset.current = s.t - Date.now();
        if (s.me) {
          const [x, y, z, vy, g, st = 1, tired = 0] = s.me;
          const p = viewRef.current?.players[me];
          if (!game.hasLocal()) game.spawnLocal(x, y, z, p ?? { color: '#e74c3c', hat: 0, hair: 0, skin: 0 }, 0);
          else game.reconcile(s.a, x, y, z, vy, g === 1, st, tired === 1, -1);
        }
        for (const p of s.p) game.pushRemote(p[0], s.t, p[1], p[2], p[3], p[4], false);
      }),
      room.onMessage(MSG.teleport, (t: TeleportMsg) => game.teleportLocal(t.x, t.y, t.z, t.yaw)),
      room.onMessage(KMSG.hand, (h: { tiles: number[]; taken: number | null }) => setHand({ tiles: h.tiles, taken: h.taken })),
      room.onMessage(KMSG.okeyError, (text: string) => {
        toastRef.current({ text, kind: 'bad' });
        play('click');
      }),
      room.onMessage(KMSG.okeyEvent, (m: OkeyEventMsg) => onOkeyEvent(m)),
      room.onMessage(KMSG.served, (s: ServedMsg) => onServed(s)),
      room.onMessage(MSG.emote, (e: EmoteMsg) => (e.id === me ? game.playLocalEmote(e.e) : game.remoteEmote(e.id, e.e))),
      room.onMessage(MSG.chat, (c: ChatMsg) => {
        const text = QUICK_CHAT_OKEY[c.q];
        if (!text) return;
        play('pop');
        game.bubble(c.id === me ? null : c.id, text);
      }),
    ];
    return () => {
      game.sender = null;
      for (const off of offs) off();
    };
  }, [game, room]); // eslint-disable-line react-hooks/exhaustive-deps

  const onOkeyEvent = (m: OkeyEventMsg) => {
    const v = viewRef.current;
    const mine = v?.players[me];
    if (!v || !mine || mine.table !== m.table) return;
    const t = v.tables[m.table]!;
    const seatName = (s: unknown) => name(t.seats[Number(s)] ?? '');
    const e = m.e;
    switch (e.type) {
      case 'opened':
        toastRef.current({ text: `${seatName(e.seat)} elini açtı (${e.mode === 'pairs' ? 'çift' : `${e.points} puan`})!`, kind: 'info' });
        play('pop');
        break;
      case 'discarded':
        play('click');
        if (e.islek) toastRef.current({ text: `${seatName(e.seat)} işlek taş attı: +101 ceza!`, kind: 'bad' });
        break;
      case 'drew':
        if (e.from === 'left') toastRef.current({ text: `${seatName(e.seat)} soldan aldı.`, kind: 'info' });
        break;
      case 'suspicious':
        toastRef.current({ text: `🤨 ${seatName(e.seat)}'in elleri bir garip… Taş mı çaldı? (6 sn)`, kind: 'bad' });
        play('spotted');
        break;
      case 'stoleOk':
        toastRef.current({ text: '🤫 Taşı çaktırmadan değiştirdin… Umarım kimse görmedi!', kind: 'info' });
        break;
      case 'caught':
        toastRef.current({ text: `🚨 ${seatName(e.thief)} taş çalarken yakalandı! ${seatName(e.by)}'e 50 ₺ ödedi, +101 ceza.`, kind: 'bad' });
        play('caught');
        game?.shake(0.15);
        break;
      case 'falseAccusation':
        toastRef.current({ text: `${seatName(e.by)} boşuna "Hile var!" dedi: 20 ₺ iftira cezası!`, kind: 'info' });
        break;
      case 'timeout':
        toastRef.current({ text: `${seatName(e.seat)} süresini doldurdu.`, kind: 'info' });
        break;
      case 'botTookOver':
        toastRef.current({ text: `${String(e.name)} masaya oturdu (bot).`, kind: 'info' });
        break;
      case 'deal':
        toastRef.current({ text: `${e.handNo}. el dağıtıldı!`, kind: 'good' });
        play('go');
        break;
      case 'handEnd': {
        const r = e.result as { finisher: number | null };
        if (r.finisher === mine.seat) play('herkes');
        else play('roundEnd');
        break;
      }
    }
  };

  const onServed = (s: ServedMsg) => {
    const v = viewRef.current;
    const item = MENU.find((m) => m.id === s.item);
    if (!v || !item || !game?.kahve) return;
    const to = s.to.length > 1 ? 'masaya' : s.to[0] === s.from ? 'kendine' : `${name(s.to[0]!)}'e`;
    toastRef.current({ text: `${item.emoji} ${name(s.from)} ${to} ${item.name.toLowerCase()} ısmarladı!`, kind: 'good' });
    const now = Date.now();
    setDrinks((d) => {
      const next = { ...d };
      for (const id of s.to) next[id] = [...(next[id] ?? []).filter((x) => now - x.t < 120000), { emoji: item.emoji, t: now }].slice(-4);
      return next;
    });
    play('pop');
    for (const id of s.to) {
      const p = v.players[id];
      if (!p) continue;
      if (p.table >= 0) {
        const sp = seatPosition(p.table, p.seat);
        const c = TABLES[p.table]!;
        const onTable = { x: c.x + (sp.x - c.x) * 0.42 + 0.15, z: c.z + (sp.z - c.z) * 0.42 + 0.15 };
        game.kahve.serve(item.id, new THREE.Vector3(sp.x, 0, sp.z), onTable);
      } else {
        const pos = game.characterPosition(id === me ? null : id) ?? new THREE.Vector3(0, 0, 0);
        game.kahve.serve(item.id, pos, null);
      }
    }
  };

  // ------------------------------------------------------------ keep characters in sync with the room
  useEffect(() => {
    if (!game || !view) return;
    const ids = new Set(Object.keys(view.players));
    for (const id of game.remoteIds()) if (!ids.has(id)) game.removeRemote(id);
    for (const p of Object.values(view.players)) {
      if (p.id === me) continue;
      game.upsertRemote(p.id, p, p.name, p.isBot ? '#cfe3f7' : '#ffffff');
      if (p.isBot && p.table >= 0) {
        const sp = seatPosition(p.table, p.seat);
        game.setFixed(p.id, { x: sp.x, y: 0, z: sp.z, yaw: sp.yaw });
      } else game.setFixed(p.id, null);
      game.setPose(p.id, p.table >= 0 ? 'sit' : 'none');
    }
    const mine = view.players[me];
    const seated = !!mine && mine.table >= 0;
    game.frozen = seated;
    game.setLabelsVisible(!seated);
    game.setPose(null, seated ? 'sit' : 'none');
    if (seated) {
      const sp = seatPosition(mine.table, mine.seat);
      const c = TABLES[mine.table]!;
      game.seatCam = { x: sp.x, z: sp.z, tx: c.x, tz: c.z };
    } else game.seatCam = null;
    // tile backs on every table
    view.tables.forEach((t) => {
      const tv = t.view ? (JSON.parse(t.view) as TableView) : null;
      game.kahve?.setRacks(t.id, tv && t.status !== 'open' ? tv.handCounts : null, tv?.deck ?? 0);
    });
  }, [game, view, me]);

  // nearest table for the "Otur" prompt
  useEffect(() => {
    if (!game) return;
    const iv = setInterval(() => {
      const pos = game.localPosition();
      if (!pos || (viewRef.current?.players[me]?.table ?? -1) >= 0) return setNearTable(-1);
      let best = -1;
      let bd = SIT_REACH;
      TABLES.forEach((t, i) => {
        const d = Math.hypot(pos.x - t.x, pos.z - t.z);
        if (d < bd) [best, bd] = [i, d];
      });
      setNearTable(best);
    }, 200);
    return () => clearInterval(iv);
  }, [game, me]);

  // E = sit at the nearby table
  useEffect(() => {
    if (!game) return;
    return game.input.onPress((a) => {
      if (a === 'spot' && nearTableRef.current >= 0) room.send(KMSG.sit, { table: nearTableRef.current });
    });
  }, [game, room]);
  const nearTableRef = useRef(nearTable);
  nearTableRef.current = nearTable;

  const send = (a: OkeyAction) => room.send(KMSG.okey, a);
  const serverNow = () => Date.now() + offset.current;
  const richest = view ? Object.values(view.players).filter((p) => !p.isBot).sort((a, b) => b.money - a.money).slice(0, 5) : [];
  const isHost = myTable?.hostId === me;
  const near = nearTable >= 0 && view ? view.tables[nearTable]! : null;

  return (
    <div className="game-root kahve">
      <canvas ref={canvasRef} className="game-canvas" />
      {!game && <div className="loading">Kahvehane açılıyor…</div>}
      <div className="hud-top">
        <button className="btn small" onClick={onLeave}>
          ← Çık
        </button>
        {reconnecting && <span className="pill warn">Bağlantı koptu, yeniden bağlanılıyor…</span>}
        {myP && <span className="wallet">💰 {money(myP.money)}</span>}
        <button className="btn small" onClick={() => setMenuOpen((o) => !o)}>
          ☕ Çaycı!
        </button>
        {myP && myP.money < 50 && (
          <button className="btn small" onClick={() => room.send(KMSG.credit)}>
            Veresiye yaz
          </button>
        )}
      </div>

      {!myTable && (
        <div className="panel richest">
          <h3>Kahvenin en zenginleri</h3>
          <ol>
            {richest.map((p) => (
              <li key={p.id} className={p.id === me ? 'me' : ''}>
                <span>{p.name}</span>
                <b>{money(p.money)}</b>
              </li>
            ))}
          </ol>
          <p className="hint">Bir masaya yaklaş, otur ve okey aç. Parayı kazan, çayları ısmarla!</p>
        </div>
      )}

      {near && !myTable && (
        <div className="sit-prompt">
          <b>{near.id + 1}. masa</b> · {[...near.seats].filter(Boolean).length}/4 · {near.status === 'open' ? (near.bet ? `${near.bet} ₺ bahis` : 'bahissiz') : 'oyun sürüyor'}
          {near.status === 'open' && [...near.seats].some((s) => !s) && (
            <button className="btn primary" onClick={() => room.send(KMSG.sit, { table: near.id })}>
              Otur {!isTouch && <kbd>E</kbd>}
            </button>
          )}
        </div>
      )}

      {myTable && myTable.status === 'open' && (
        <div className="panel table-lobby">
          <div className="panel-head">
            <h2>{myTable.id + 1}. masa</h2>
            <button className="btn small" onClick={() => room.send(KMSG.stand)}>
              Kalk
            </button>
          </div>
          <ul className="players">
            {[0, 1, 2, 3].map((s) => {
              const p = view?.players[myTable.seats[s] ?? ''];
              return (
                <li key={s}>
                  <span className="dot" style={{ background: p?.color ?? '#ddd' }} />
                  <span className="pname">{p ? p.name : 'Boş sandalye'}</span>
                  {p?.isBot && <span className="tag bot">bot</span>}
                  {p && myTable.hostId === p.id && <span className="tag">masa sahibi</span>}
                  {p && <span className="muted">{money(p.money)}</span>}
                </li>
              );
            })}
          </ul>
          <div className="field">
            <span>Bahis (kişi başı)</span>
            <div className="chips">
              {BET_OPTIONS.map((b) => (
                <button key={b} disabled={!isHost} className={`chip ${myTable.bet === b ? 'on' : ''}`} onClick={() => room.send(KMSG.tableConfig, { bet: b })}>
                  {b ? `${b} ₺` : 'Bahissiz'}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <span>El sayısı</span>
            <div className="chips">
              {HAND_OPTIONS.map((h) => (
                <button key={h} disabled={!isHost} className={`chip ${myTable.hands === h ? 'on' : ''}`} onClick={() => room.send(KMSG.tableConfig, { hands: h })}>
                  {h} el
                </button>
              ))}
            </div>
          </div>
          {isHost ? (
            <div className="row wrap">
              <button className="btn small" disabled={[...myTable.seats].every(Boolean)} onClick={() => room.send(KMSG.tableBot, {})}>
                + Bot oturt
              </button>
              <button className="btn small" onClick={() => room.send(KMSG.tableBot, { remove: true })}>
                − Bot kaldır
              </button>
              <button className="btn primary" disabled={![...myTable.seats].every(Boolean)} onClick={() => room.send(KMSG.tableStart)}>
                Taşları dağıt
              </button>
            </div>
          ) : (
            <p className="hint">Masa sahibinin başlatması bekleniyor…</p>
          )}
          <p className="hint">Arkadaşların bu kahvehaneye linkle gelir; boş sandalyeye otururlar. Kazanan kasayı alır.</p>
        </div>
      )}

      {myTable && myTable.status !== 'open' && myP && (
        <>
          <OkeyBoard
            table={myTable}
            view={tableView}
            players={view!.players}
            mySeat={myP.seat}
            hand={hand.tiles}
            takenTile={hand.taken}
            serverNow={serverNow}
            send={send}
            toast={(text, kind) => pushToast({ text, kind })}
            drinks={drinks}
          />
          <button className="btn small stand-btn" onClick={() => confirm('Masadan kalkarsan bahsin yanar ve yerine bot oturur. Emin misin?') && room.send(KMSG.stand)}>
            Kalk
          </button>
        </>
      )}

      {menuOpen && view && myP && (
        <div className="panel menu-panel">
          <div className="panel-head">
            <h2>☕ Çaycı Rıza</h2>
            <button className="btn small" onClick={() => setMenuOpen(false)}>
              Kapat
            </button>
          </div>
          <div className="field">
            <span>Kime?</span>
            <select value={orderTo} onChange={(e) => setOrderTo(e.target.value)}>
              <option value="me">Kendime</option>
              {myTable && <option value="table">Bütün masaya</option>}
              {Object.values(view.players)
                .filter((p) => p.id !== me)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </select>
          </div>
          <div className="menu-items">
            {MENU.map((m) => (
              <button
                key={m.id}
                className="menu-item"
                onClick={() => room.send(KMSG.order, { item: m.id, to: orderTo === 'me' ? me : orderTo })}
              >
                <span className="emoji">{m.emoji}</span>
                <span>{m.name}</span>
                <b>{m.price} ₺</b>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="toasts">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.kind ?? ''}`}>
            {t.text}
          </div>
        ))}
      </div>
      {game && view && !myTable && <Social room={room} input={game.input} phrases={QUICK_CHAT_OKEY} />}
      {game && isTouch && !myTable && <TouchControls input={game.input} />}
    </div>
  );
}
