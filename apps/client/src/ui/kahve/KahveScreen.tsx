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
  SHOPS,
  SHOP_ITEMS,
  SHOP_REACH,
  SIT_REACH,
  SIT_SPOTS,
  SPOT_REACH,
  TABLES,
  seatPosition,
  type SignalMsg,
  type UsedMsg,
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
import { VoiceChat } from '../../net/voice';

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
  /** the closest thing to interact with: a table, a shop or a seat (bench / stool) */
  const [nearThing, setNearThing] = useState<{ kind: 'table' | 'shop' | 'spot'; i: number } | null>(null);
  const [shopOpen, setShopOpen] = useState<number>(-1);
  const [tablesOpen, setTablesOpen] = useState(false);
  // voice chat (opt-in)
  const voiceRef = useRef<VoiceChat | null>(null);
  const [voiceOn, setVoiceOn] = useState(false);
  const [micMuted, setMicMuted] = useState(false);
  const [voicePanel, setVoicePanel] = useState(false);
  const [speaking, setSpeaking] = useState<Set<string>>(new Set());
  const [, voiceTick] = useState(0);
  /** recently served drinks per player (shown as badges at the table) */
  const [drinks, setDrinks] = useState<Record<string, { emoji: string; t: number }[]>>({});
  const [suspicion, setSuspicion] = useState<{ seat: number; until: number } | null>(null);
  const offset = useRef(0);
  const me = room.sessionId;
  const myP = view?.players[me];
  const myTable: KTableView | null = myP && myP.table >= 0 ? view!.tables[myP.table]! : null;
  const tableView: TableView | null = useMemo(() => (myTable?.view ? (JSON.parse(myTable.view) as TableView) : null), [myTable?.view]);
  const name = (id: string) => viewRef.current?.players[id]?.name ?? view?.players[id]?.name ?? 'biri';

  // ------------------------------------------------------------ 3D scene
  useEffect(() => {
    let g: Game | null = null;
    let cancelled = false;
    void Promise.all([import('../../game/Game'), import('../../game/kahveScene')]).then(async ([{ Game, loadCharacterKit }, { buildKahve }]) => {
      await loadCharacterKit();
      if (cancelled || !canvasRef.current) return;
      g = new Game(canvasRef.current, 'kahve', buildKahve);
      if (import.meta.env.DEV) (window as unknown as { __game: Game }).__game = g;
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
      room.onMessage(KMSG.signal, (m: SignalMsg) => void voiceRef.current?.onSignal(m)),
      room.onMessage(KMSG.notice, (text: string) => {
        toastRef.current({ text, kind: 'good' });
        play('pop');
      }),
      room.onMessage(KMSG.served, (s: ServedMsg) => onServed(s)),
      room.onMessage(KMSG.used, (u: UsedMsg) => {
        const item = SHOP_ITEMS.find((i) => i.id === u.item);
        if (item) game.useItem(u.id === me ? null : u.id, item.use);
      }),
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
        setSuspicion({ seat: Number(e.seat), until: Date.now() + 6000 });
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
      const spot = p.spot >= 0 ? SIT_SPOTS[p.spot] : undefined;
      if (p.isBot && p.table >= 0) {
        const sp = seatPosition(p.table, p.seat);
        game.setFixed(p.id, { x: sp.x, y: 0, z: sp.z, yaw: sp.yaw });
      } else if (spot) game.setFixed(p.id, { x: spot.x, y: spot.h - 0.48, z: spot.z, yaw: spot.yaw });
      else game.setFixed(p.id, null);
      game.setPose(p.id, p.table >= 0 || spot ? 'sit' : 'none');
      game.setHeld(p.id, p.holding);
    }
    const mine = view.players[me];
    const seated = !!mine && mine.table >= 0;
    const mySpot = mine && mine.spot >= 0 ? SIT_SPOTS[mine.spot] : undefined;
    game.frozen = seated || !!mySpot;
    game.localSeatY = mySpot ? mySpot.h - 0.48 : 0;
    game.setLabelsVisible(!seated);
    game.setPose(null, seated || mySpot ? 'sit' : 'none');
    game.setHeld(null, mine?.holding ?? '');
    game.seat = seated ? { table: mine.table, seat: mine.seat } : null;
    // real tiles on every table
    view.tables.forEach((t) => {
      const tv = t.view ? (JSON.parse(t.view) as TableView) : null;
      game.kahve?.setTable(t.id, tv && t.status !== 'open' ? tv : null, seated && mine.table === t.id ? mine.seat : null);
    });
  }, [game, view, me]);

  // voice chat: who to hear (same table, or close by when not playing) and how loud
  useEffect(() => {
    if (!game || !voiceOn) return;
    const iv = setInterval(() => {
      const vc = voiceRef.current;
      const v = viewRef.current;
      const mine = v?.players[me];
      if (!vc || !v || !mine) return;
      const wanted = new Map<string, number>();
      const pos = game.localPosition();
      for (const p of Object.values(v.players)) {
        if (p.id === me || !p.voice || p.isBot) continue;
        if (mine.table >= 0 || p.table >= 0) {
          if (p.table === mine.table) wanted.set(p.id, 1);
          continue;
        }
        const q = game.characterPosition(p.id);
        if (!pos || !q) continue;
        const d = Math.hypot(q.x - pos.x, q.z - pos.z);
        // hysteresis: connect within 14 m, keep until 18 m
        const reach = vc.connectedPeers().includes(p.id) ? 18 : 14;
        if (d < reach) wanted.set(p.id, Math.max(0.15, Math.min(1, 1.25 - d / 14)));
      }
      vc.sync(wanted);
      const lv = vc.levels();
      const now = new Set<string>();
      for (const [id, l] of lv) if (l > 0.02) now.add(id);
      for (const id of Object.keys(v.players)) if (id !== me) game.setSpeaking(id, now.has(id));
      setSpeaking((old) => (old.size === now.size && [...now].every((x) => old.has(x)) ? old : now));
      voiceTick((n) => n + 1);
    }, 250);
    return () => clearInterval(iv);
  }, [game, voiceOn, me]);
  useEffect(() => () => voiceRef.current?.disable(), []);
  const toggleVoice = async () => {
    if (voiceRef.current?.enabled) {
      voiceRef.current.disable();
      voiceRef.current = null;
      setVoiceOn(false);
      return;
    }
    const vc = new VoiceChat(room, me);
    voiceRef.current = vc;
    if (import.meta.env.DEV) (window as unknown as { __voice: VoiceChat }).__voice = vc;
    await vc.enable();
    setVoiceOn(true);
    setVoicePanel(true);
    pushToast({ text: vc.hasMic ? '🎙️ Sesli sohbet açık. Masandakiler ve yanındakiler seni duyar.' : '🎧 Mikrofon izni yok: sadece dinliyorsun.', kind: 'info' });
  };

  // the nearest interactable (table, shop, free seat) for the prompt and the E key
  useEffect(() => {
    if (!game) return;
    const iv = setInterval(() => {
      const v = viewRef.current;
      const pos = game.localPosition();
      const mine = v?.players[me];
      if (!pos || !v || !mine || mine.table >= 0 || mine.spot >= 0) {
        setNearTable(-1);
        setNearThing(null);
        return;
      }
      let best: { kind: 'table' | 'shop' | 'spot'; i: number } | null = null;
      let bd = Infinity;
      const consider = (kind: 'table' | 'shop' | 'spot', i: number, d: number, reach: number) => {
        // scale by reach so a bench right next to you beats a table 3 m away
        if (d <= reach && d / reach < bd) [best, bd] = [{ kind, i }, d / reach];
      };
      TABLES.forEach((t, i) => consider('table', i, Math.hypot(pos.x - t.x, pos.z - t.z), SIT_REACH));
      SHOPS.forEach((sh, i) => consider('shop', i, Math.hypot(pos.x - sh.x, pos.z - sh.z), SHOP_REACH));
      const taken = new Set(Object.values(v.players).map((p) => p.spot));
      SIT_SPOTS.forEach((sp, i) => !taken.has(i) && consider('spot', i, Math.hypot(pos.x - sp.x, pos.z - sp.z), SPOT_REACH));
      const b = best as { kind: 'table' | 'shop' | 'spot'; i: number } | null;
      setNearThing(b);
      setNearTable(b?.kind === 'table' ? b.i : -1);
      if (b?.kind !== 'shop') setShopOpen(-1);
    }, 200);
    return () => clearInterval(iv);
  }, [game, me]);

  // E = interact with the nearby thing, Q = use the item in hand, moving gets you off a bench
  useEffect(() => {
    if (!game) return;
    const offPress = game.input.onPress((a) => {
      const mine = viewRef.current?.players[me];
      if (a === 'throw' && mine?.holding) room.send(KMSG.use);
      if (a !== 'spot') return;
      if (mine && mine.spot >= 0) return room.send(KMSG.stand);
      const n = nearThingRef.current;
      if (!n) return;
      if (n.kind === 'table') room.send(KMSG.sit, { table: n.i });
      else if (n.kind === 'spot') room.send(KMSG.sitSpot, { spot: n.i });
      else setShopOpen((o) => (o === n.i ? -1 : n.i));
    });
    const iv = setInterval(() => {
      const mine = viewRef.current?.players[me];
      const mv = game.input.moveVector();
      if (mine && mine.spot >= 0 && Math.hypot(mv.x, mv.y) > 0.3) room.send(KMSG.stand);
    }, 150);
    return () => {
      offPress();
      clearInterval(iv);
    };
  }, [game, room]); // eslint-disable-line react-hooks/exhaustive-deps
  const nearThingRef = useRef(nearThing);
  nearThingRef.current = nearThing;
  const nearTableRef = useRef(nearTable);
  nearTableRef.current = nearTable;

  const send = (a: OkeyAction) => room.send(KMSG.okey, a);
  const standUp = () => {
    if (confirm('Masadan kalkarsan bahsin yanar ve yerine bot oturur. Emin misin?')) room.send(KMSG.stand);
  };
  const serverNow = () => Date.now() + offset.current;
  const richest = view ? Object.values(view.players).filter((p) => !p.isBot).sort((a, b) => b.money - a.money).slice(0, 5) : [];
  const isHost = myTable?.hostId === me;
  const near = nearTable >= 0 && view ? view.tables[nearTable]! : null;

  return (
    <div className={`game-root kahve ${myTable && myTable.status !== 'open' ? 'seated' : ''}`}>
      <canvas ref={canvasRef} className="game-canvas" />
      {!game && <div className="loading">Kahvehane açılıyor…</div>}
      <div className="hud-top">
        <button className="btn small" onClick={onLeave}>
          ← Çık
        </button>
        {reconnecting && <span className="pill warn">Bağlantı koptu, yeniden bağlanılıyor…</span>}
        {myP && <span className="wallet">💰 {money(myP.money)}</span>}
        <button className="btn small" title="Çaycı" onClick={() => setMenuOpen((o) => !o)}>
          ☕<span className="lbl"> Çaycı!</span>
        </button>
        {!myTable && (
          <button className="btn small" title="Masalar" onClick={() => setTablesOpen((o) => !o)}>
            🃏<span className="lbl"> Masalar</span>
          </button>
        )}
        {view?.name && <span className="pill salon-name">📍 {view.name}</span>}
        <button className={`btn small ${voiceOn ? 'on' : ''}`} onClick={() => void toggleVoice()} title="Sesli sohbet (isteğe bağlı)">
          🎙️<span className="lbl">{voiceOn ? ' Sesli: açık' : ' Sesli sohbet'}</span>
        </button>
        {voiceOn && (
          <>
            <button
              className={`btn small ${micMuted ? 'warn' : ''}`}
              onClick={() => {
                const m = !micMuted;
                voiceRef.current?.setMicMuted(m);
                setMicMuted(m);
              }}
            >
              {micMuted ? '🔇' : '🎤'}
              <span className="lbl">{micMuted ? ' Mikrofon kapalı' : ' Mikrofon'}</span>
            </button>
            <button className="btn small" onClick={() => setVoicePanel((o) => !o)}>
              👥 {voiceRef.current?.connectedPeers().length ?? 0}
            </button>
          </>
        )}
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

      <div className="kahve-bottom">
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
        {nearThing?.kind === 'spot' && !myTable && (
          <div className="sit-prompt">
            <b>{SIT_SPOTS[nearThing.i]!.h < 0.4 ? 'Tabure' : 'Bank'}</b>
            <button className="btn primary" onClick={() => room.send(KMSG.sitSpot, { spot: nearThing.i })}>
              Otur {!isTouch && <kbd>E</kbd>}
            </button>
          </div>
        )}
        {nearThing?.kind === 'shop' && shopOpen < 0 && (
          <div className="sit-prompt">
            <b>{SHOPS[nearThing.i]!.id === 'market' ? '🛒 Market' : '🥯 Simitçi'}</b>
            <button className="btn primary" onClick={() => setShopOpen(nearThing.i)}>
              Alışveriş {!isTouch && <kbd>E</kbd>}
            </button>
          </div>
        )}
        {myP && myP.spot >= 0 && (
          <div className="sit-prompt">
            <span>Oturuyorsun · manzaranın tadını çıkar</span>
            <button className="btn" onClick={() => room.send(KMSG.stand)}>
              Kalk {!isTouch && <kbd>E</kbd>}
            </button>
          </div>
        )}
        {myP && myP.holding && !myTable && (
          <div className="held">
            <span className="held-emoji">{SHOP_ITEMS.find((i) => i.id === myP.holding)?.emoji}</span>
            <span>
              {SHOP_ITEMS.find((i) => i.id === myP.holding)?.name} <small>({myP.uses})</small>
            </span>
            <button className="btn small primary" onClick={() => room.send(KMSG.use)}>
              {{ smoke: 'Yak', eat: 'Ye', drink: 'İç', read: 'Oku' }[SHOP_ITEMS.find((i) => i.id === myP.holding)?.use ?? 'eat']} {!isTouch && <kbd>Q</kbd>}
            </button>
            <button className="btn small" onClick={() => room.send(KMSG.drop)}>
              Bırak
            </button>
          </div>
        )}
      </div>
      {shopOpen >= 0 && myP && (
        <div className="panel shop-panel">
          <div className="panel-head">
            <h2>{SHOPS[shopOpen]!.id === 'market' ? '🛒 Bakkal Hasan' : '🥯 Simitçi Cemal'}</h2>
            <button className="btn small" onClick={() => setShopOpen(-1)}>
              Kapat
            </button>
          </div>
          <p className="hint">{SHOPS[shopOpen]!.id === 'market' ? 'Hoş geldin! Ne lazım?' : 'Taze simit, sıcak çay!'} · Cebinde {money(myP.money)}</p>
          <div className="menu-items">
            {SHOPS[shopOpen]!.items.map((id) => {
              const it = SHOP_ITEMS.find((x) => x.id === id)!;
              return (
                <button key={id} className="menu-item" disabled={myP.money < it.price} onClick={() => room.send(KMSG.buy, { shop: SHOPS[shopOpen]!.id, item: id })}>
                  <span className="emoji">{it.emoji}</span>
                  <span>
                    {it.name}
                    {it.note && <small className="warn-note">{it.note}</small>}
                  </span>
                  <b>{it.price} ₺</b>
                </button>
              );
            })}
          </div>
          <p className="hint">Aldığın şey elinde durur; Q ile kullanırsın. Yeni bir şey alırsan eskisi bırakılır.</p>
        </div>
      )}

      {tablesOpen && !myTable && view && (
        <div className="panel tables-panel">
          <div className="panel-head">
            <h2>🃏 Masalar</h2>
            <button className="btn small" onClick={() => setTablesOpen(false)}>
              Kapat
            </button>
          </div>
          <button
            className="btn primary"
            onClick={() => {
              room.send(KMSG.quickSeat, {});
              setTablesOpen(false);
            }}
          >
            ⚡ Hızlı masa: beni boş bir yere oturt
          </button>
          <ul className="table-list">
            {view.tables.map((t) => {
              const filled = [...t.seats].filter(Boolean);
              const humans = filled.filter((id) => !view.players[id]?.isBot);
              const free = t.status === 'open' && filled.length < 4;
              return (
                <li key={t.id} className={t.status !== 'open' ? 'busy' : humans.length ? 'waiting' : ''}>
                  <span className="tno">{t.id + 1}</span>
                  <span className="tinfo">
                    <b>{t.id >= 18 ? 'Teras' : 'Salon'}</b> · {filled.length}/4 {t.status === 'open' ? (t.bet ? `· ${t.bet} ₺` : '· bahissiz') : '· oyunda'}
                    {humans.length > 0 && <small>{humans.map((id) => view.players[id]?.name).join(', ')}</small>}
                  </span>
                  {free && (
                    <button
                      className="btn small primary"
                      onClick={() => {
                        room.send(KMSG.quickSeat, { table: t.id });
                        setTablesOpen(false);
                      }}
                    >
                      Otur
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
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
              {![...myTable.seats].every(Boolean) && (
                <button className="btn primary" onClick={() => room.send(KMSG.fillBots)}>
                  🤖 Botlarla hemen başla
                </button>
              )}
            </div>
          ) : (
            <p className="hint">Masa sahibinin başlatması bekleniyor…</p>
          )}
          <p className="hint">Arkadaşların bu kahvehaneye linkle gelir; boş sandalyeye otururlar. Kazanan kasayı alır.</p>
        </div>
      )}

      {myTable && myTable.status !== 'open' && myP && game && (
        <>
          <OkeyBoard
            game={game!}
            suspicion={suspicion}
            onStand={standUp}
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
          <button className="btn small stand-btn" onClick={standUp}>
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

      {voiceOn && voicePanel && view && (
        <div className="panel voice-panel">
          <div className="panel-head">
            <h2>🎙️ Sesli sohbet</h2>
            <button className="btn small" onClick={() => setVoicePanel(false)}>
              Kapat
            </button>
          </div>
          <p className="hint">Masadaysan masandakilerle, değilsen yakınındakilerle konuşursun. İstemediğin kişiyi sustur. Kimsenin sesi kaydedilmez.</p>
          <ul className="voice-list">
            {(voiceRef.current?.connectedPeers() ?? []).map((id) => {
              const muted = voiceRef.current?.isPeerMuted(id) ?? false;
              return (
                <li key={id}>
                  <span>{speaking.has(id) ? '🔊' : '🔈'}</span>
                  <b>{view.players[id]?.name ?? '—'}</b>
                  <button
                    className={`btn small ${muted ? 'warn' : ''}`}
                    onClick={() => {
                      voiceRef.current?.mutePeer(id, !muted);
                      voiceTick((n) => n + 1);
                    }}
                  >
                    {muted ? 'Sesini aç' : 'Sustur'}
                  </button>
                </li>
              );
            })}
            {(voiceRef.current?.connectedPeers().length ?? 0) === 0 && <li className="muted">Yakında sesli sohbeti açık kimse yok.</li>}
          </ul>
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
