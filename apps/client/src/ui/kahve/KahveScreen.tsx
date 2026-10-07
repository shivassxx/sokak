import { useEffect, useMemo, useRef, useState } from 'react';
import type { Room } from 'colyseus.js';
import * as THREE from 'three';
import {
  AVATARS,
  BET_OPTIONS,
  BOARD_REACH,
  BOARD_SPOT,
  vapurState,
  type VapurPhase,
  HAND_OPTIONS,
  TEAM_COLORS,
  TEAM_NAMES,
  TURN_OPTIONS,
  turnLabel,
  KMSG,
  MENU,
  MSG,
  QUICK_CHAT_OKEY,
  FISH,
  DAILY_MISSIONS,
  type MissionState,
  levelOf,
  levelTitle,
  SHOPS,
  SHOP_ITEMS,
  SHOP_REACH,
  SIT_REACH,
  SEA_Z,
  SIT_SPOTS,
  SPOT_REACH,
  TABLES,
  TAVLA_REACH,
  TAVLA_TABLES,
  seatPosition,
  tavlaSeatPosition,
  type KTavlaView,
  type TavlaAction,
  type TavlaEventMsg,
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
  type TvBroadcast,
  HALL,
  tvMatchAt,
  tvTeam,
} from '@sokak/shared';
import type { Game } from '../../game/Game';
import { footsteps, goalRoar, gullCry, play, seaside } from '../../game/audio';
import { useToasts } from '../toasts';
import { AnnounceBanner } from './AnnounceBanner';
import { Social } from '../Social';
import { SettingsButton } from '../Settings';
import { TouchControls, isTouch } from '../TouchControls';
import { OkeyBoard } from '../okey/OkeyBoard';
import { TavlaBoard } from '../tavla/TavlaBoard';
import type { TavlaView } from '@sokak/tavla';
import { shareRoom } from '../share';
import { VoiceChat } from '../../net/voice';
import { initialQuality } from '../../game/postfx';
import { loadPrefs } from '../prefs';

/** standing (or sitting) at the sea railing / ledge, not on the pier */
const bySea = (p: { x: number; z: number } | null | undefined): boolean => !!p && p.z > SEA_Z - 3.2 && p.x < 32;

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
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const SHOP_TITLE: Record<string, [string, string, string]> = {
  market: ['🛒 Market', '🛒 Bakkal Hasan', 'Hoş geldin! Ne lazım?'],
  simitci: ['🥯 Simitçi', '🥯 Simitçi Cemal', 'Taze simit, sıcak çay!'],
  vapur: ['⛴️ Vapur çaycısı', '⛴️ Vapur çaycısı Ahmet', 'Çaylar tazeee! Simidini martılara da atarsın.'],
};

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
  const [nearThing, setNearThing] = useState<{ kind: 'table' | 'shop' | 'spot' | 'tavla'; i: number } | null>(null);
  const [nearSea, setNearSea] = useState(false);
  /** at the pier's boarding spot (not riding) */
  const [nearPier, setNearPier] = useState(false);
  /** the vapur's phase and whole seconds to its next departure / arrival (only near the pier or aboard) */
  const [vapur, setVapur] = useState<{ phase: VapurPhase; eta: number } | null>(null);
  /** spectating a table: which one and from which side */
  const [watching, setWatching] = useState<{ table: number; side: number } | null>(null);
  const watchRef = useRef(watching);
  watchRef.current = watching;
  const myFish = useRef(0);
  const myLevel = useRef(0);
  const [missionsOpen, setMissionsOpen] = useState(false);
  const [chats, setChats] = useState<Record<string, { text: string; t: number }>>({});
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
  const myTavla: KTavlaView | null = myP && myP.tavla >= 0 ? (view?.tavla?.[myP.tavla] ?? null) : null;
  const tavlaView: TavlaView | null = useMemo(() => (myTavla?.view ? (JSON.parse(myTavla.view) as TavlaView) : null), [myTavla?.view]);
  /** seated at any table (okey or tavla) */
  const atTable = !!myTable || !!myTavla;
  const name = (id: string) => viewRef.current?.players[id]?.name ?? view?.players[id]?.name ?? 'biri';

  // ------------------------------------------------------------ 3D scene
  useEffect(() => {
    let g: Game | null = null;
    let cancelled = false;
    void Promise.all([import('../../game/Game'), import('../../game/kahveScene')]).then(async ([{ Game, loadCharacterKit, loadRealKit }, { buildKahve }]) => {
      // phones load a subset of the avatars up front, plus the one this player chose
      const mine = AVATARS[loadPrefs().avatar]?.id;
      await Promise.all([loadCharacterKit(), loadRealKit(initialQuality() === 'low', mine ? [mine] : [])]);
      if (cancelled || !canvasRef.current) return;
      g = new Game(canvasRef.current, buildKahve);
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
          const dx = s.me[8];
          const dz = s.me[9];
          if (!game.hasLocal()) game.spawnLocal(x, y, z, p ?? { color: '#e74c3c', hat: 0, hair: 0, skin: 0 }, 0);
          if (dx !== undefined && dz !== undefined) game.reconcileDeck(s.a, dx, dz);
          else {
            game.leaveDeck();
            game.reconcile(s.a, x, y, z, vy, g === 1, st, tired === 1);
          }
        }
        for (const p of s.p) game.pushRemote(p[0], s.t, p[1], p[2], p[3], p[4], false, (p[5] & 8) !== 0);
      }),
      room.onMessage(MSG.teleport, (t: TeleportMsg) => game.teleportLocal(t.x, t.y, t.z, t.yaw)),
      room.onMessage(KMSG.hand, (h: { tiles: number[]; taken: number | null }) => setHand({ tiles: h.tiles, taken: h.taken })),
      room.onMessage(KMSG.okeyError, (text: string) => {
        toastRef.current({ text, kind: 'bad' });
        play('click');
      }),
      room.onMessage(KMSG.okeyEvent, (m: OkeyEventMsg) => onOkeyEvent(m)),
      room.onMessage(KMSG.tavlaEvent, (m: TavlaEventMsg) => onTavlaEvent(m)),
      room.onMessage(KMSG.signal, (m: SignalMsg) => void voiceRef.current?.onSignal(m)),
      room.onMessage(KMSG.notice, (text: string) => {
        toastRef.current({ text, kind: 'good' });
        play('pop');
      }),
      room.onMessage(KMSG.served, (s: ServedMsg) => onServed(s)),
      room.onMessage(KMSG.used, (u: UsedMsg) => {
        const item = SHOP_ITEMS.find((i) => i.id === u.item);
        if (!item) return;
        const who = u.id === me ? null : u.id;
        const at = game.characterPosition(who);
        if (item.id === 'olta') {
          const fish = FISH.find((f) => f.id === u.fish);
          if (!fish) return game.useItem(who, 'fish');
          const shoe = fish.id === 'ayakkabi';
          const text =
            u.id === me
              ? shoe
                ? '🥾 Denizden eski bir ayakkabı çıkardın! 😂'
                : `🎣 Bir ${fish.name} tuttun!`
              : shoe
                ? `🥾 ${name(u.id)} denizden eski bir ayakkabı çıkardı! 😂`
                : `🎣 ${name(u.id)} bir ${fish.name} tuttu!`;
          toastRef.current({ text, kind: 'good' });
          game.bubble(who, `${fish.emoji} ${fish.name[0]!.toLocaleUpperCase('tr')}${fish.name.slice(1)}!`);
          if (who) game.remoteEmote(who, fish.id === 'ayakkabi' ? 'laugh' : 'wave');
          else play(fish.id === 'ayakkabi' ? 'pop' : 'safe');
          return;
        }
        if (item.id === 'simit' && (bySea(at) || (at && viewRef.current?.players[u.id]?.aboard))) {
          // by the water (or from the vapur's deck) a simit goes to the gulls
          if (who) game.remoteEmote(who, 'point');
          else game.playLocalEmote('point');
          game.kahve?.feedGulls(at!.x, at!.z, at!.y);
          setTimeout(() => gullCry(0.8), 700);
        } else game.useItem(who, item.use);
      }),
      room.onMessage(MSG.emote, (e: EmoteMsg) => (e.id === me ? game.playLocalEmote(e.e) : game.remoteEmote(e.id, e.e))),
      room.onMessage(MSG.chat, (c: ChatMsg) => {
        const text = QUICK_CHAT_OKEY[c.q];
        if (!text) return;
        play('pop');
        game.bubble(c.id === me ? null : c.id, text);
        setChats((old) => ({ ...old, [c.id]: { text, t: Date.now() } }));
      }),
    ];
    if (import.meta.env.DEV) (window as unknown as { __room: Room }).__room = room;
    // anything private sent before these handlers existed (rejoin after a reload) was dropped
    room.send(KMSG.resync);
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
      case 'shownGosterge':
        toastRef.current({ text: `🀄 ${seatName(e.seat)} göstergeyi gösterdi: −101!`, kind: 'good' });
        play('pop');
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

  const onTavlaEvent = (m: TavlaEventMsg) => {
    const v = viewRef.current;
    const mine = v?.players[me];
    if (!v || !mine || mine.tavla !== m.table) return;
    const t = v.tavla[m.table]!;
    const seatName = (s: unknown) => name(t.seats[Number(s)] ?? '');
    const e = m.e;
    const mineSide = (s: unknown) => Number(s) === mine.seat;
    switch (e.type) {
      case 'opening': {
        const d = e.dice as [number, number];
        toastRef.current({ text: `🎲 Açılış zarı: ${seatName(0)} ${d[0]} – ${seatName(1)} ${d[1]}. ${mineSide(e.first) ? 'Sen başlıyorsun!' : `${seatName(e.first)} başlıyor.`}`, kind: 'good' });
        play('go');
        break;
      }
      case 'rolled':
        play('pop');
        break;
      case 'moved':
        play('click');
        if (e.hit) {
          toastRef.current({ text: mineSide(e.side) ? '💥 Kırdın! Rakibin taşı ortaya gitti.' : `💥 ${seatName(e.side)} taşını kırdı!`, kind: mineSide(e.side) ? 'good' : 'bad' });
          game?.shake(0.08);
        }
        break;
      case 'noMoves':
        toastRef.current({ text: mineSide(e.side) ? 'Oynayacak hamlen yok, sıra geçiyor.' : `${seatName(e.side)} oynayamadı.`, kind: 'info' });
        break;
      case 'timeout':
        toastRef.current({ text: mineSide(e.seat) ? 'Süren doldu, hamlen otomatik oynandı.' : `${seatName(e.seat)} süresini doldurdu.`, kind: 'info' });
        break;
      case 'botTookOver':
        toastRef.current({ text: `${String(e.name)} masaya oturdu (bot).`, kind: 'info' });
        break;
      case 'gameEnd': {
        const won = mineSide(e.winner);
        toastRef.current({ text: `${e.mars ? 'Mars! ' : ''}${won ? 'Oyunu kazandın!' : `${seatName(e.winner)} oyunu kazandı.`}`, kind: won ? 'good' : 'bad' });
        play(won ? 'herkes' : 'roundEnd');
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
  const handCounts = useRef(new Map<number, number[]>());
  useEffect(() => {
    if (!game || !view) return;
    const ids = new Set(Object.keys(view.players));
    for (const id of game.remoteIds()) if (!ids.has(id)) game.removeRemote(id);
    for (const p of Object.values(view.players)) {
      if (p.id === me) continue;
      game.upsertRemote(p.id, p, p.trophy ? `🏆 ${p.name}` : p.name, p.isBot ? '#cfe3f7' : '#ffffff');
      const spot = p.spot >= 0 ? SIT_SPOTS[p.spot] : undefined;
      if (p.isBot && p.table >= 0) {
        const sp = seatPosition(p.table, p.seat);
        game.setFixed(p.id, { x: sp.x, y: 0, z: sp.z, yaw: sp.yaw });
      } else if (p.isBot && p.tavla >= 0) {
        const sp = tavlaSeatPosition(p.tavla, p.seat);
        game.setFixed(p.id, { x: sp.x, y: 0, z: sp.z, yaw: sp.yaw });
      } else if (spot) game.setFixed(p.id, { x: spot.x, y: spot.h - 0.48, z: spot.z, yaw: spot.yaw });
      else game.setFixed(p.id, null);
      game.setPose(p.id, p.table >= 0 || p.tavla >= 0 || spot ? 'sit' : p.fish || p.holding === 'olta' ? 'fish' : 'none');
      game.setHeld(p.id, p.holding);
      game.setFishing(p.id, p.fish);
    }
    const mine = view.players[me];
    const seated = !!mine && mine.table >= 0;
    const atTavla = !!mine && mine.tavla >= 0;
    const mySpot = mine && mine.spot >= 0 ? SIT_SPOTS[mine.spot] : undefined;
    game.frozen = seated || atTavla || !!mySpot || !!watching;
    game.watch = watching && !seated && !atTavla ? watching : null;
    game.tavla = atTavla ? { table: mine.tavla, seat: mine.seat } : null;
    game.localSeatY = mySpot ? mySpot.h - 0.48 : 0;
    game.setLabelsVisible(!seated && !atTavla && !watching);
    game.setPose(null, seated || atTavla || mySpot ? 'sit' : mine?.fish || mine?.holding === 'olta' ? 'fish' : 'none');
    game.setHeld(null, mine?.holding ?? '');
    game.setFishing(null, mine?.fish ?? 0);
    if (mine?.fish === 2 && myFish.current !== 2) {
      play('spotted');
      game.bubble(null, 'Vurdu! Çek!');
    }
    myFish.current = mine?.fish ?? 0;
    if (mine) {
      const lvl = levelOf(mine.played, mine.won);
      if (myLevel.current && lvl > myLevel.current) {
        toastRef.current({ text: `⭐ Seviye atladın: ${lvl} · ${levelTitle(lvl)}!`, kind: 'good' });
        play('herkes');
      }
      myLevel.current = lvl;
    }
    game.seat = seated ? { table: mine.table, seat: mine.seat } : null;
    // real tiles on every table
    view.tables.forEach((t) => {
      const tv = t.view ? (JSON.parse(t.view) as TableView) : null;
      // whoever's hand count changed made a move: their character reaches to the table
      const prev = handCounts.current.get(t.id);
      if (tv && prev && t.status !== 'open')
        tv.handCounts.forEach((n, s) => {
          if (prev[s] === undefined || prev[s] === n) return;
          const who = Object.values(view.players).find((p) => p.table === t.id && p.seat === s);
          if (who) game.reach(who.id === me ? null : who.id);
        });
      if (tv) handCounts.current.set(t.id, tv.handCounts);
      else handCounts.current.delete(t.id);
      game.kahve?.setTable(t.id, tv && t.status !== 'open' ? tv : null, seated && mine.table === t.id ? mine.seat : null, watching?.table === t.id ? watching.side : 0);
    });
    // real checkers and dice on every tavla board
    (view.tavla ?? []).forEach((t) => game.kahve?.setTavla(t.id, t.view && t.status !== 'open' ? (JSON.parse(t.view) as TavlaView) : null));
  }, [game, view, me, watching]);
  // stop watching when the match is over or you sit down somewhere
  useEffect(() => {
    if (!watching || !view) return;
    if ((view.players[me]?.table ?? -1) >= 0 || (view.players[me]?.tavla ?? -1) >= 0 || view.tables[watching.table]?.status === 'open') setWatching(null);
  }, [view, watching, me]);
  const startWatching = (table: number) => {
    const pos = game?.localPosition();
    if (!pos) return;
    // watch from the side you are standing on
    let side = 0;
    let best = Infinity;
    for (let s = 0; s < 4; s++) {
      const sp = seatPosition(table, s);
      const d = Math.hypot(sp.x - pos.x, sp.z - pos.z);
      if (d < best) (best = d), (side = s);
    }
    setWatching({ table, side });
  };

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
  const voicePending = useRef(false);
  const toggleVoice = async () => {
    if (voicePending.current) return; // the mic permission prompt is still open
    if (voiceRef.current?.enabled) {
      voiceRef.current.disable();
      voiceRef.current = null;
      setVoiceOn(false);
      return;
    }
    const vc = new VoiceChat(room, me);
    voiceRef.current = vc;
    if (import.meta.env.DEV) (window as unknown as { __voice: VoiceChat }).__voice = vc;
    voicePending.current = true;
    await vc.enable();
    voicePending.current = false;
    if (!vc.enabled) return; // left the kahve while asking
    setVoiceOn(true);
    setVoicePanel(true);
    pushToast({ text: vc.hasMic ? '🎙️ Sesli sohbet açık. Masandakiler ve yanındakiler seni duyar.' : '🎧 Mikrofon izni yok: sadece dinliyorsun.', kind: 'info' });
  };

  // the kıraathane TV: staff-started derbies, simulated from the broadcast at server time
  const tvJson = view?.tv ?? '';
  useEffect(() => {
    if (!game) return;
    let b: TvBroadcast | null = null;
    try {
      b = tvJson ? (JSON.parse(tvJson) as TvBroadcast) : null;
    } catch {
      b = null;
    }
    game.kahve?.setTv(b);
    if (!b) return;
    const home = tvTeam(b.home);
    const away = tvTeam(b.away);
    if (!home || !away) return;
    // events already on the clock when we tuned in do not cheer again
    let seen = -1;
    const check = () => {
      const s = tvMatchAt(b!, game.serverNow());
      if (s.done) return;
      const fresh = seen < 0 ? [] : s.events.slice(seen);
      seen = s.events.length;
      if (!fresh.length) return;
      const pos = game.localPosition();
      const mine = viewRef.current?.players[me];
      const inHall = !!pos && !game.isAboard() && pos.x > HALL.x0 && pos.x < HALL.x1 && pos.z > HALL.z0 && pos.z < HALL.z1;
      // seated players look at their table, not at the TV
      const seesTv = inHall && !!mine && mine.table < 0 && mine.tavla < 0 && !watchRef.current;
      const bug = `${home.short} ${s.score[0]}–${s.score[1]} ${away.short}`;
      for (const e of fresh) {
        if (e.kind === 'goal') {
          game.kahve?.tvGoal();
          goalRoar(inHall ? 0.8 : 0.25);
          if (!seesTv) toastRef.current({ text: `📺 GOOOL! ${e.player} · Derbi: ${bug} (${Math.min(e.minute, 90)}')`, kind: 'good' });
        } else if (e.kind === 'kickoff' && e.minute <= 1) toastRef.current({ text: `📺 Derbi başladı: ${home.name} – ${away.name}! Kıraathanenin büyük ekranında.`, kind: 'info' });
        else if (e.kind === 'half' && !seesTv) toastRef.current({ text: `📺 Derbi devre arası: ${bug}`, kind: 'info' });
        else if (e.kind === 'full') toastRef.current({ text: `📺 Derbi bitti: ${bug}`, kind: 'info' });
        else if (e.kind === 'red' && !seesTv) toastRef.current({ text: `📺 Derbide kırmızı kart: ${e.player}!`, kind: 'bad' });
      }
    };
    check();
    // first check only records what already happened; a match that starts as we join still says hello
    if (tvMatchAt(b, game.serverNow()).minute <= 1) seen = 0;
    const iv = setInterval(check, 400);
    return () => clearInterval(iv);
  }, [game, tvJson, me]);

  // the nearest interactable (table, shop, free seat) for the prompt and the E key
  useEffect(() => {
    if (!game) return;
    const iv = setInterval(() => {
      const v = viewRef.current;
      const pos = game.localPosition();
      const mine = v?.players[me];
      const riding = game.isAboard();
      setNearSea(bySea(pos) || riding);
      const pier = !!pos && !riding && !!mine && mine.table < 0 && Math.hypot(pos.x - BOARD_SPOT.x, pos.z - BOARD_SPOT.z) < BOARD_REACH;
      setNearPier(pier);
      if (pier || riding) {
        const vs = vapurState(game.serverNow());
        setVapur((old) => (old && old.phase === vs.phase && old.eta === Math.ceil(vs.eta) ? old : { phase: vs.phase, eta: Math.ceil(vs.eta) }));
      } else setVapur(null);
      if (riding) {
        // on the deck only the vapur's çaycı is around
        const d = game.deckPosition();
        const i = SHOPS.findIndex((sh) => sh.deck);
        const sh = SHOPS[i];
        const b = d && sh && Math.hypot(d.x - sh.x, d.z - sh.z) <= SHOP_REACH ? { kind: 'shop' as const, i } : null;
        setNearTable(-1);
        setNearThing(b);
        if (!b) setShopOpen(-1);
        return;
      }
      if (!pos || !v || !mine || mine.table >= 0 || mine.tavla >= 0 || mine.spot >= 0) {
        setNearTable(-1);
        setNearThing(null);
        return;
      }
      let best: { kind: 'table' | 'shop' | 'spot' | 'tavla'; i: number } | null = null;
      let bd = Infinity;
      const consider = (kind: 'table' | 'shop' | 'spot' | 'tavla', i: number, d: number, reach: number) => {
        // scale by reach so a bench right next to you beats a table 3 m away
        if (d <= reach && d / reach < bd) [best, bd] = [{ kind, i }, d / reach];
      };
      TABLES.forEach((t, i) => consider('table', i, Math.hypot(pos.x - t.x, pos.z - t.z), SIT_REACH));
      TAVLA_TABLES.forEach((t, i) => consider('tavla', i, Math.hypot(pos.x - t.x, pos.z - t.z), TAVLA_REACH));
      SHOPS.forEach((sh, i) => !sh.deck && consider('shop', i, Math.hypot(pos.x - sh.x, pos.z - sh.z), SHOP_REACH));
      const taken = new Set(Object.values(v.players).map((p) => p.spot));
      SIT_SPOTS.forEach((sp, i) => !taken.has(i) && consider('spot', i, Math.hypot(pos.x - sp.x, pos.z - sp.z), SPOT_REACH));
      const b = best as { kind: 'table' | 'shop' | 'spot' | 'tavla'; i: number } | null;
      setNearThing(b);
      setNearTable(b?.kind === 'table' ? b.i : -1);
      if (b?.kind !== 'shop') setShopOpen(-1);
    }, 200);
    return () => clearInterval(iv);
  }, [game, me]);

  // sounds: footsteps, the sea getting louder towards the sahil, gulls now and then
  useEffect(() => {
    if (!game) return;
    game.events = {
      onJump: () => play('jump'),
      onLand: () => play('land'),
      onStep: (speed, sprinting) => footsteps(speed, sprinting),
    };
    let nextGull = performance.now() + 6000;
    const iv = setInterval(() => {
      const pos = game.localPosition();
      if (!pos) return;
      // faint through the glass in the hall, full on the promenade
      const lv = pos.z < 0 ? 0.06 : Math.min(1, 0.15 + Math.max(0, pos.z - 2) / 26);
      seaside(lv);
      const now = performance.now();
      if (pos.z > 12 && now > nextGull) {
        gullCry(0.25 + lv * 0.5, Math.random() * 2 - 1);
        nextGull = now + 7000 + Math.random() * 14000;
      }
    }, 400);
    return () => {
      clearInterval(iv);
      seaside(0);
      footsteps(0, false);
      game.events = {};
    };
  }, [game]);

  // E = interact with the nearby thing, Q = use the item in hand, moving gets you off a bench
  useEffect(() => {
    if (!game) return;
    const offPress = game.input.onPress((a) => {
      const mine = viewRef.current?.players[me];
      if (a === 'throw' && mine?.holding) room.send(KMSG.use);
      if (a !== 'spot') return;
      if (mine && mine.spot >= 0) return room.send(KMSG.stand);
      if (watchRef.current) return setWatching(null);
      const n = nearThingRef.current;
      // the vapur: E gets you off at the pier (the çaycı's menu at sea), or on board at the pier
      if (mine?.aboard) {
        if (n?.kind === 'shop' && vapurRef.current?.phase !== 'docked') return setShopOpen((o) => (o === n.i ? -1 : n.i));
        return room.send(KMSG.alight);
      }
      if (nearPierRef.current) return room.send(KMSG.board);
      if (!n) return;
      if (n.kind === 'table') {
        const t = viewRef.current?.tables[n.i];
        if (t && t.status !== 'open') startWatchRef.current(n.i);
        else room.send(KMSG.sit, { table: n.i });
      }
      else if (n.kind === 'spot') room.send(KMSG.sitSpot, { spot: n.i });
      else if (n.kind === 'tavla') room.send(KMSG.tavlaSit, { table: n.i });
      else setShopOpen((o) => (o === n.i ? -1 : n.i));
    });
    const iv = setInterval(() => {
      const mine = viewRef.current?.players[me];
      const mv = game.input.moveVector();
      if (mine && mine.spot >= 0 && Math.hypot(mv.x, mv.y) > 0.3) room.send(KMSG.stand);
      if (watchRef.current && Math.hypot(mv.x, mv.y) > 0.3) setWatching(null);
    }, 150);
    return () => {
      offPress();
      clearInterval(iv);
    };
  }, [game, room]); // eslint-disable-line react-hooks/exhaustive-deps
  const nearThingRef = useRef(nearThing);
  nearThingRef.current = nearThing;
  const nearPierRef = useRef(nearPier);
  nearPierRef.current = nearPier;
  const vapurRef = useRef(vapur);
  vapurRef.current = vapur;
  const startWatchRef = useRef(startWatching);
  startWatchRef.current = startWatching;
  const nearTableRef = useRef(nearTable);
  nearTableRef.current = nearTable;

  const send = (a: OkeyAction) => room.send(KMSG.okey, a);
  const sendTavla = (a: TavlaAction) => room.send(KMSG.tavla, a);
  const standUp = () => {
    if (confirm('Masadan kalkarsan bahsin yanar ve yerine bot oturur. Emin misin?')) room.send(KMSG.stand);
  };
  const serverNow = () => Date.now() + offset.current;
  const invite = async () => {
    const r = await shareRoom(room.roomId, { title: '101 Okey oynayalım mı?', text: `Üsküdar'da kahvedeyiz (${view?.name ?? 'salon'}), gel bir el okey atalım!` });
    if (r === 'copied') toastRef.current({ text: 'Davet linki kopyalandı! Arkadaşına gönder.', kind: 'good' });
    else if (r === 'failed') toastRef.current({ text: 'Link kopyalanamadı. Adres çubuğundaki linki paylaşabilirsin.', kind: 'info' });
  };
  const richest = view ? Object.values(view.players).filter((p) => !p.isBot).sort((a, b) => b.money - a.money).slice(0, 5) : [];
  const isHost = myTable?.hostId === me;
  const isTavlaHost = myTavla?.hostId === me;
  const nearTavla = nearThing?.kind === 'tavla' && view?.tavla ? (view.tavla[nearThing.i] ?? null) : null;
  const myMissions = (() => {
    try {
      return myP?.missions ? (JSON.parse(myP.missions) as MissionState) : null;
    } catch {
      return null;
    }
  })();
  const near = nearTable >= 0 && view ? view.tables[nearTable]! : null;

  return (
    <div className={`game-root kahve ${(myTable && myTable.status !== 'open') || (myTavla && myTavla.status !== 'open') ? 'seated' : ''} ${myTavla && myTavla.status !== 'open' ? 'at-tavla' : ''}`}>
      <canvas ref={canvasRef} className="game-canvas" />
      {!game && <div className="loading">Kahvehane açılıyor…</div>}
      <div className="hud-top">
        <button className="btn small" onClick={onLeave}>
          ← Çık
        </button>
        {reconnecting && <span className="pill warn">Bağlantı koptu, yeniden bağlanılıyor…</span>}
        {myP && <span className="wallet">💰 {money(myP.money)}</span>}
        {myP && (
          <span className="pill lvl" title={`${levelTitle(levelOf(myP.played, myP.won))} · ${myP.played} maç, ${myP.won} galibiyet`}>
            ⭐ {levelOf(myP.played, myP.won)}
          </span>
        )}
        {myP && myMissions && (
          <button className="btn small" title="Günlük görevler" onClick={() => setMissionsOpen((o) => !o)}>
            📋<span className="lbl"> Görevler</span> <b className="count">{DAILY_MISSIONS.filter((d) => (myMissions.progress[d.id] ?? 0) >= d.goal).length}/{DAILY_MISSIONS.length}</b>
          </button>
        )}
        <button className="btn small" title="Çaycı" onClick={() => setMenuOpen((o) => !o)}>
          ☕<span className="lbl"> Çaycı!</span>
        </button>
        {!atTable && (
          <button className="btn small" title="Masalar" onClick={() => setTablesOpen((o) => !o)}>
            🃏<span className="lbl"> Masalar</span>
          </button>
        )}
        {view?.name && <span className="pill salon-name">📍 {view.name}</span>}
        <button className="btn small" title="Arkadaşını davet et" onClick={() => void invite()}>
          🔗<span className="lbl"> Davet et</span>
        </button>
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
        <SettingsButton inGame />
      </div>

      {!atTable && !watching && (
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
        {myP?.aboard && vapur && (
          <div className="sit-prompt vapur-prompt">
            <span>
              ⛴️ <b>Vapurdasın</b> · Kız Kulesi turu · {vapur.phase === 'docked' ? `Kalkış ${mmss(vapur.eta)}` : `İskeleye dönüş ${mmss(vapur.eta)}`}
              {vapur.phase !== 'docked' && <small>İnmek için iskelede {isTouch ? 'İn' : 'E'}</small>}
            </span>
            {vapur.phase === 'docked' && (
              <button className="btn" onClick={() => room.send(KMSG.alight)}>
                İn {!isTouch && <kbd>E</kbd>}
              </button>
            )}
          </div>
        )}
        {nearPier && !myP?.aboard && vapur && !watching && (
          <div className="sit-prompt vapur-prompt">
            {vapur.phase === 'docked' ? (
              <>
                <span>
                  ⛴️ <b>Kız Kulesi turu</b> · Kalkış {mmss(vapur.eta)}
                </span>
                <button className="btn primary" onClick={() => room.send(KMSG.board)}>
                  Vapura bin {!isTouch && <kbd>E</kbd>}
                </button>
              </>
            ) : (
              <span>
                ⛴️ Vapur seferde · İskeleye varış {mmss(vapur.eta)}
              </span>
            )}
          </div>
        )}
        {watching && view && !myTable && (
          <div className="sit-prompt watch-panel">
            <span>
              👀 <b>{watching.table + 1}. masayı izliyorsun</b> · El {view.tables[watching.table]!.handNo}/{view.tables[watching.table]!.hands}
              {view.tables[watching.table]!.pot > 0 && <> · Kasa {money(view.tables[watching.table]!.pot)}</>}
              <small className="watch-seats">
                {[...view.tables[watching.table]!.seats].map((id, s) => (
                  <span key={s}>
                    {view.players[id]?.name ?? '—'} <b>{view.tables[watching.table]!.totals[s]}</b>
                  </span>
                ))}
              </small>
            </span>
            <button className="btn small" onClick={() => setWatching(null)}>
              Bırak {!isTouch && <kbd>E</kbd>}
            </button>
          </div>
        )}
        {near && !myTable && !watching && (
          <div className="sit-prompt">
            <b>{near.id + 1}. masa</b> · {[...near.seats].filter(Boolean).length}/4 · {near.partners ? 'eşli · ' : ''}
            {near.status === 'open' ? (near.bet ? `${near.bet} ₺ bahis` : 'bahissiz') : 'oyun sürüyor'}
            {near.status === 'open' && [...near.seats].some((s) => !s) && (
              <button className="btn primary" onClick={() => room.send(KMSG.sit, { table: near.id })}>
                Otur {!isTouch && <kbd>E</kbd>}
              </button>
            )}
            {near.status !== 'open' && (
              <button className="btn primary" onClick={() => startWatching(near.id)}>
                👀 İzle {!isTouch && <kbd>E</kbd>}
              </button>
            )}
          </div>
        )}
        {nearTavla && !atTable && !watching && (
          <div className="sit-prompt">
            <b>🎲 Tavla {nearTavla.id + 1}</b> · {[...nearTavla.seats].filter(Boolean).length}/2 ·{' '}
            {nearTavla.status === 'open' ? (nearTavla.bet ? `${nearTavla.bet} ₺ bahis` : 'bahissiz') : `oyun sürüyor (${nearTavla.score[0]}–${nearTavla.score[1]})`}
            {nearTavla.status === 'open' && [...nearTavla.seats].some((s) => !s) && (
              <button className="btn primary" onClick={() => room.send(KMSG.tavlaSit, { table: nearTavla.id })}>
                Otur {!isTouch && <kbd>E</kbd>}
              </button>
            )}
          </div>
        )}
        {nearThing?.kind === 'spot' && !myTable && !watching && (
          <div className="sit-prompt">
            <b>{SIT_SPOTS[nearThing.i]!.label}</b>
            <button className="btn primary" onClick={() => room.send(KMSG.sitSpot, { spot: nearThing.i })}>
              Otur {!isTouch && <kbd>E</kbd>}
            </button>
          </div>
        )}
        {nearThing?.kind === 'shop' && shopOpen < 0 && !watching && (
          <div className="sit-prompt">
            <b>{SHOP_TITLE[SHOPS[nearThing.i]!.id]![0]}</b>
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
        {myP && myP.holding && !atTable && (
          <div className="held">
            <span className="held-emoji">{SHOP_ITEMS.find((i) => i.id === myP.holding)?.emoji}</span>
            <span>
              {SHOP_ITEMS.find((i) => i.id === myP.holding)?.name} <small>({myP.uses})</small>
            </span>
            <button className={`btn small primary ${myP.fish === 2 ? 'glow' : ''}`} onClick={() => room.send(KMSG.use)}>
              {myP.holding === 'olta'
                ? ['Oltayı at', 'Bekle…', 'ÇEK! 🐟'][myP.fish]
                : myP.holding === 'simit' && nearSea
                  ? 'Martılara at 🕊️'
                  : { smoke: 'Yak', eat: 'Ye', drink: 'İç', read: 'Oku', fish: 'At' }[SHOP_ITEMS.find((i) => i.id === myP.holding)?.use ?? 'eat']}{' '}
              {!isTouch && <kbd>Q</kbd>}
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
            <h2>{SHOP_TITLE[SHOPS[shopOpen]!.id]![1]}</h2>
            <button className="btn small" onClick={() => setShopOpen(-1)}>
              Kapat
            </button>
          </div>
          <p className="hint">{SHOP_TITLE[SHOPS[shopOpen]!.id]![2]} · Cebinde {money(myP.money)}</p>
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
                    <b>{t.id >= 18 ? 'Teras' : 'Salon'}</b> · {filled.length}/4 {t.partners ? '· eşli ' : ''}
                    {t.status === 'open' ? (t.bet ? `· ${t.bet} ₺` : '· bahissiz') : '· oyunda'}
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
                  {myTable.partners && (
                    <span className="tag team" style={{ background: TEAM_COLORS[s % 2] }} title={TEAM_NAMES[s % 2]}>
                      {myP && s !== myP.seat && s % 2 === myP.seat % 2 ? 'Eşin' : TEAM_NAMES[s % 2]}
                    </span>
                  )}
                  {p?.isBot && <span className="tag bot">bot</span>}
                  {p && myTable.hostId === p.id && <span className="tag">masa sahibi</span>}
                  {p && <span className="muted">{money(p.money)}</span>}
                </li>
              );
            })}
          </ul>
          <h3 className="settings-title">Masa ayarları</h3>
          <div className="field">
            <span>Oyun</span>
            <div className="chips">
              {(['tekli', 'esli'] as const).map((m) => (
                <button key={m} disabled={!isHost} className={`chip ${myTable.partners === (m === 'esli') ? 'on' : ''}`} onClick={() => room.send(KMSG.tableConfig, { mode: m })}>
                  {m === 'esli' ? '👥 Eşli' : '👤 Tekli'}
                </button>
              ))}
            </div>
          </div>
          {myTable.partners && <p className="hint">Karşılıklı oturanlar eştir. Eşlerin puanı toplanır; kaybeden takımın ikisi de öder, kazananlar kasayı paylaşır.</p>}
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
          <div className="field">
            <span>Süre (hamle başı)</span>
            <div className="chips">
              {TURN_OPTIONS.map((o) => (
                <button key={o.secs} disabled={!isHost} className={`chip ${myTable.turnSecs === o.secs ? 'on' : ''}`} onClick={() => room.send(KMSG.tableConfig, { turn: o.secs })}>
                  {o.label} ({o.secs} sn)
                </button>
              ))}
            </div>
          </div>
          {!isHost && (
            <p className="hint">
              {myTable.partners ? 'Eşli' : 'Tekli'} · {myTable.hands} el · {turnLabel(myTable.turnSecs)} · {myTable.bet ? `${myTable.bet} ₺` : 'bahissiz'}
            </p>
          )}
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
            phrases={QUICK_CHAT_OKEY}
            chats={chats}
            onChat={(q) => room.send(MSG.chat, q)}
          />
          <button className="btn small stand-btn" onClick={standUp}>
            Kalk
          </button>
        </>
      )}

      {myTavla && myTavla.status === 'open' && (
        <div className="panel table-lobby">
          <div className="panel-head">
            <h2>🎲 Tavla {myTavla.id + 1}</h2>
            <button className="btn small" onClick={() => room.send(KMSG.stand)}>
              Kalk
            </button>
          </div>
          <ul className="players">
            {[0, 1].map((s) => {
              const p = view?.players[myTavla.seats[s] ?? ''];
              return (
                <li key={s}>
                  <span className={`tv-dot s${s}`} />
                  <span className="pname">{p ? p.name : 'Boş sandalye'}</span>
                  <span className="muted">{s === 0 ? 'beyaz' : 'siyah'}</span>
                  {p?.isBot && <span className="tag bot">bot</span>}
                  {p && myTavla.hostId === p.id && <span className="tag">masa sahibi</span>}
                  {p && <span className="muted">{money(p.money)}</span>}
                </li>
              );
            })}
          </ul>
          <div className="field">
            <span>Bahis (kişi başı)</span>
            <div className="chips">
              {BET_OPTIONS.map((b) => (
                <button key={b} disabled={!isTavlaHost} className={`chip ${myTavla.bet === b ? 'on' : ''}`} onClick={() => room.send(KMSG.tableConfig, { bet: b })}>
                  {b ? `${b} ₺` : 'Bahissiz'}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <span>Maç</span>
            <div className="chips">
              {[1, 3, 5].map((n) => (
                <button key={n} disabled={!isTavlaHost} className={`chip ${myTavla.target === n ? 'on' : ''}`} onClick={() => room.send(KMSG.tableConfig, { points: n })}>
                  {n} sayı
                </button>
              ))}
            </div>
          </div>
          {isTavlaHost ? (
            <div className="row wrap">
              {[...myTavla.seats].every(Boolean) ? (
                <>
                  {[...myTavla.seats].some((id) => view?.players[id]?.isBot) && (
                    <button className="btn small" onClick={() => room.send(KMSG.tableBot, { remove: true })}>
                      − Botu kaldır
                    </button>
                  )}
                  <button className="btn primary" onClick={() => room.send(KMSG.tableStart)}>
                    Başla
                  </button>
                </>
              ) : (
                <button className="btn primary" onClick={() => room.send(KMSG.fillBots)}>
                  🤖 Bot çağır ve başla
                </button>
              )}
            </div>
          ) : (
            <p className="hint">Masa sahibinin başlatması bekleniyor…</p>
          )}
          <p className="hint">Arkadaşın boş sandalyeye oturabilir ya da bir botla oyna. Mars 2 sayı; maçı kazanan kasayı alır.</p>
        </div>
      )}

      {myTavla && myTavla.status !== 'open' && myP && (
        <TavlaBoard
          table={myTavla}
          view={tavlaView}
          players={view!.players}
          mySeat={myP.seat}
          serverNow={serverNow}
          send={sendTavla}
          onStand={standUp}
          phrases={QUICK_CHAT_OKEY}
          onChat={(q) => room.send(MSG.chat, q)}
        />
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
              {atTable && <option value="table">Bütün masaya</option>}
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

      {missionsOpen && myMissions && (
        <div className="panel missions-panel">
          <div className="panel-head">
            <h2>📋 Günün görevleri</h2>
            <button className="btn small" onClick={() => setMissionsOpen(false)}>
              Kapat
            </button>
          </div>
          <ul className="missions">
            {DAILY_MISSIONS.map((d) => {
              const n = Math.min(d.goal, myMissions.progress[d.id] ?? 0);
              const done = n >= d.goal;
              return (
                <li key={d.id} className={done ? 'done' : ''}>
                  <span className="mtext">
                    {done ? '✅' : '⬜'} {d.text}
                    <i style={{ width: `${(n / d.goal) * 100}%` }} />
                  </span>
                  <b>{done ? 'Tamam' : `${n}/${d.goal}`}</b>
                  <span className="reward">+{d.reward} ₺</span>
                </li>
              );
            })}
          </ul>
          <p className="hint">Görevler her gece yarısı yenilenir. Ödül görev bitince cebine girer.</p>
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

      <AnnounceBanner room={room} />
      <div className="toasts">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.kind ?? ''}`}>
            {t.text}
          </div>
        ))}
      </div>
      {game && view && !atTable && <Social room={room} input={game.input} phrases={QUICK_CHAT_OKEY} />}
      {game && isTouch && !atTable && <TouchControls input={game.input} />}
    </div>
  );
}
