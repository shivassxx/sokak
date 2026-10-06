import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { asPair, asSeries, playFace, sameFace, type OkeyCtx } from '@sokak/okey';
import { TABLES, seatPosition, type HandResultView, type KPlayerView, type KTableView, type MatchResultView, type Meld, type OkeyAction, type TableView } from '@sokak/shared';
import type { Game } from '../../game/Game';
import { Tile } from './Tile';
import { ROW, SLOTS, arrangePairs, arrangeSeries, emptyRack, moveTile, openPlan, rackGroups, syncRack, type Rack } from './rack';
import { play } from '../../game/audio';

interface Props {
  game: Game;
  table: KTableView;
  view: TableView | null;
  players: Record<string, KPlayerView>;
  mySeat: number;
  hand: number[];
  takenTile: number | null;
  serverNow: () => number;
  send: (a: OkeyAction) => void;
  toast: (text: string, kind?: 'good' | 'bad' | 'info') => void;
  drinks?: Record<string, { emoji: string; t: number }[]>;
  /** someone may have just stolen a tile (server hint) */
  suspicion?: { seat: number; until: number } | null;
  onStand: () => void;
}

/** Can `tile` be added to meld `m` (same rule as the server)? */
function canAdd(m: Meld, tile: number, ctx: OkeyCtx): boolean {
  if (m.kind === 'pair') return false;
  const info = asSeries([...m.tiles, tile], ctx);
  return !!info && info.kind === m.kind;
}

function canSwap(m: Meld, tile: number, ctx: OkeyCtx): boolean {
  if (m.kind === 'pair') return false;
  const info = asSeries(m.tiles, ctx);
  const f = playFace(tile, ctx);
  if (!info || !f) return false;
  return m.tiles.some((t, i) => playFace(t, ctx) === null && sameFace(info.faces[i]!, f));
}

const COLOR_NAMES = ['Kırmızı', 'Sarı', 'Mavi', 'Siyah'];
const _v = new THREE.Vector3();

/**
 * The seated okey view: the 3D table is the board (deck, gösterge, discard
 * piles and melds are real tiles); this overlay adds clickable hot-spots
 * projected onto them, name plates over the opponents, the player's own
 * wooden ıstaka with free drag-and-drop arranging, and one clear hint line.
 */
export function OkeyBoard({ game, table, view, players, mySeat, hand, takenTile, serverNow, send, toast, drinks = {}, suspicion, onStand }: Props) {
  const ctx: OkeyCtx | null = view ? { okey: view.okey as OkeyCtx['okey'] } : null;
  const [rack, setRack] = useState<Rack>(emptyRack);
  const [sel, setSel] = useState<number | null>(null);
  const [stealMode, setStealMode] = useState(false);
  const [more, setMore] = useState(false);
  const [help, setHelp] = useState(false);
  const [drag, setDrag] = useState<{ tile: number; x: number; y: number; over: number | null } | null>(null);
  const dragRef = useRef<{ tile: number; startX: number; startY: number; moved: boolean; pointer: number } | null>(null);
  const rackRef = useRef<HTMLDivElement>(null);
  const spots = useRef(new Map<string, HTMLElement>());
  const [, tick] = useState(0);

  useEffect(() => {
    const iv = setInterval(() => tick((n) => n + 1), 250);
    return () => clearInterval(iv);
  }, []);

  // keep the rack in sync with the authoritative hand
  useEffect(() => {
    setRack((r) => syncRack(r, hand));
    if (sel !== null && !hand.includes(sel)) setSel(null);
  }, [hand]); // eslint-disable-line react-hooks/exhaustive-deps

  // new hand → fresh rack, arranged once so it is readable
  const handKey = `${table.handNo}-${view?.gosterge}`;
  const lastKey = useRef('');
  useEffect(() => {
    if (lastKey.current !== handKey && ctx) {
      lastKey.current = handKey;
      setRack(arrangeSeries(hand, ctx));
    }
  }, [handKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const leftSeat = (mySeat + 3) % 4;
  const myTurn = !!view && view.turn === mySeat && view.phase !== 'ended';
  const drawPhase = myTurn && view.phase === 'draw';
  const playPhase = myTurn && view.phase === 'play';
  const opened = view?.opened[mySeat] ?? null;
  const plan = useMemo(() => (ctx ? openPlan(rack, ctx) : null), [rack, ctx?.okey.color, ctx?.okey.num]); // eslint-disable-line react-hooks/exhaustive-deps
  const seatPlayer = (s: number) => players[table.seats[s] ?? ''];
  const name = (s: number) => seatPlayer(s)?.name ?? '—';
  const remaining = Math.max(0, Math.ceil((table.turnEndsAt - serverNow()) / 1000));
  const suspicious = !!suspicion && suspicion.until > Date.now();

  // ------------------------------------------------------------ project 3D anchors to the screen
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const a = game.kahve?.anchors(table.id);
      const cam = game.camera;
      const el = game.renderer.domElement;
      const W = el.clientWidth;
      const H = el.clientHeight;
      const proj = (p: THREE.Vector3) => {
        _v.copy(p).project(cam);
        return { x: ((_v.x + 1) / 2) * W, y: ((1 - _v.y) / 2) * H, ok: _v.z < 1 };
      };
      const place = (key: string, p: THREE.Vector3 | null) => {
        const node = spots.current.get(key);
        if (!node) return;
        if (!p) return void (node.style.display = 'none');
        const s = proj(p);
        node.style.display = s.ok ? '' : 'none';
        node.style.transform = `translate(${s.x.toFixed(1)}px, ${s.y.toFixed(1)}px)`;
      };
      place('deck', a?.deck ?? null);
      for (let s = 0; s < 4; s++) place(`pile-${s}`, a?.piles[s] ?? null);
      const c = TABLES[table.id]!;
      for (let s = 0; s < 4; s++) {
        if (s === mySeat) continue;
        // just above each opponent's ıstaka
        const sp = seatPosition(table.id, s);
        const k = (s - mySeat + 4) % 4 === 2 ? 0.42 : 0.5;
        place(`plate-${s}`, _v.set(c.x + (sp.x - c.x) * k, 0.9, c.z + (sp.z - c.z) * k).clone());
      }
      for (const m of a?.melds ?? []) {
        const node = spots.current.get(`meld-${m.id}`);
        if (!node) continue;
        let x0 = 1e9;
        let y0 = 1e9;
        let x1 = -1e9;
        let y1 = -1e9;
        for (const c of m.corners) {
          const s = proj(c);
          x0 = Math.min(x0, s.x);
          y0 = Math.min(y0, s.y);
          x1 = Math.max(x1, s.x);
          y1 = Math.max(y1, s.y);
        }
        node.style.transform = `translate(${(x0 - 4).toFixed(1)}px, ${(y0 - 4).toFixed(1)}px)`;
        node.style.width = `${(x1 - x0 + 8).toFixed(1)}px`;
        node.style.height = `${(y1 - y0 + 8).toFixed(1)}px`;
      }
      // frame the table just above the rack
      const r = rackRef.current?.getBoundingClientRect();
      if (r && H > 0) game.seatBottom = 1 - (2 * (r.top - 6)) / H;
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [game, table.id, mySeat]);

  const spot = (key: string) => (node: HTMLElement | null) => {
    if (node) spots.current.set(key, node);
    else spots.current.delete(key);
  };

  // ------------------------------------------------------------ actions
  const discard = (tile: number) => {
    if (!playPhase) return toast(drawPhase ? 'Önce bir taş çekmelisin.' : 'Sıra sende değil.', 'info');
    send({ t: 'discard', tile });
    play('click');
    setSel(null);
  };
  const onMeld = (m: Meld, tile: number | null) => {
    if (tile === null || !ctx) return toast('Önce ıstakandan bir taş seç ya da taşı pere sürükle.', 'info');
    if (!playPhase) return toast('Sıranı bekle.', 'info');
    if (!opened) return toast('Yerdeki perlere taş işlemek için önce elini açmalısın.', 'info');
    if (canAdd(m, tile, ctx)) send({ t: 'add', tile, meld: m.id });
    else if (canSwap(m, tile, ctx)) send({ t: 'swap', tile, meld: m.id });
    else return toast('Bu taş bu pere uymuyor.', 'bad');
    play('click');
    setSel(null);
  };
  const onPile = (seat: number) => {
    if (stealMode && seat !== mySeat) {
      if (seat === leftSeat) return toast('Soldakinden çalınmaz; karşıdakinin ya da sağdakinin yığınını seç.', 'info');
      if (sel === null) return toast('Önce ıstakandan vereceğin taşı seç.', 'info');
      send({ t: 'steal', tile: sel, pile: seat });
      setStealMode(false);
      setSel(null);
      return;
    }
    if (seat === leftSeat && drawPhase) {
      send({ t: 'take' });
      play('click');
    } else if (seat === mySeat && sel !== null) discard(sel);
  };
  const draw = () => {
    if (!drawPhase || !view || view.deck <= 0) return;
    send({ t: 'draw' });
    play('click');
  };
  const openHand = () => {
    if (!plan || !plan.mode) return;
    if (opened) for (const g of plan.groups) send({ t: 'lay', tiles: g });
    else send({ t: 'open', groups: plan.groups });
    play('pop');
  };

  // ------------------------------------------------------------ rack drag & drop (pointer events: mouse + touch)
  const slotAt = (x: number, y: number): number | null => {
    const el = rackRef.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (x < r.left - 10 || x > r.right + 10 || y < r.top - 24 || y > r.bottom + 10) return null;
    const pad = parseFloat(getComputedStyle(el).paddingLeft) || 0;
    const inner = r.width - pad * 2;
    const col = Math.max(0, Math.min(ROW - 1, Math.floor(((x - r.left - pad) / inner) * ROW)));
    const row = y < r.top + r.height / 2 ? 0 : 1;
    return row * ROW + col;
  };
  const onTileDown = (tile: number) => (e: React.PointerEvent) => {
    e.preventDefault();
    dragRef.current = { tile, startX: e.clientX, startY: e.clientY, moved: false, pointer: e.pointerId };
  };
  // follow the pointer on the window: tiles re-flow while dragging, so element capture is not reliable
  useEffect(() => {
    const move = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d || d.pointer !== e.pointerId) return;
      if (!d.moved && Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < 6) return;
      d.moved = true;
      setDrag({ tile: d.tile, x: e.clientX, y: e.clientY, over: slotAt(e.clientX, e.clientY) });
    };
    const up = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d || d.pointer !== e.pointerId) return;
      dragRef.current = null;
      setDrag(null);
      dropTile(d, e.clientX, e.clientY);
    };
    const cancel = () => {
      dragRef.current = null;
      setDrag(null);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
    };
  });
  const dropTile = (d: { tile: number; moved: boolean }, x: number, y: number) => {
    if (!d.moved) {
      setSel((s) => (s === d.tile ? null : d.tile));
      return;
    }
    const to = slotAt(x, y);
    if (to !== null) {
      setRack((r) => moveTile(r, d.tile, to));
      setSel(null);
      play('click');
      return;
    }
    // dropped on the table: my pile = discard, a meld = işle, a pile in steal mode = swap
    const els = document.elementsFromPoint(x, y) as HTMLElement[];
    const hit = (q: string) => els.find((el) => el.closest(q))?.closest(q) as HTMLElement | undefined;
    const meldEl = hit('[data-meld]');
    const pileEl = hit('[data-pile]');
    if (meldEl && view) {
      const m = view.melds.find((mm) => mm.id === Number(meldEl.dataset.meld));
      if (m) onMeld(m, d.tile);
    } else if (pileEl) {
      const s = Number(pileEl.dataset.pile);
      if (s === mySeat) discard(d.tile);
      else if (stealMode) {
        send({ t: 'steal', tile: d.tile, pile: s });
        setStealMode(false);
      }
    }
  };
  const onSlotTap = (i: number) => {
    if (sel === null || rack[i] !== null) return;
    setRack((r) => moveTile(r, sel, i));
    setSel(null);
    play('click');
  };

  if (!view || !ctx) return null;

  // live preview while dragging over the rack
  const shown = drag && drag.over !== null ? moveTile(rack, drag.tile, drag.over) : rack;
  const groups = rackGroups(shown);
  const goodGroup = new Set<number>();
  for (const g of groups) if ((g.length >= 3 && asSeries(g, ctx)) || (g.length === 2 && asPair(g, ctx))) for (const t of g) goodGroup.add(t);

  const okeyLabel = `${COLOR_NAMES[view.okey.color]} ${view.okey.num}`;
  const lastHand: HandResultView | null = table.lastHand ? JSON.parse(table.lastHand) : null;
  const lastMatch: MatchResultView | null = table.lastMatch ? JSON.parse(table.lastMatch) : null;
  const dragTile = drag?.tile ?? sel;
  const fits = (m: Meld) => dragTile !== null && !!opened && playPhase && (canAdd(m, dragTile, ctx) || canSwap(m, dragTile, ctx));

  // one clear instruction at a time
  let hint: string;
  if (view.phase === 'ended') hint = 'El bitti.';
  else if (drawPhase) hint = `Sıra sende! Ortadaki desteden ya da soldaki oyuncunun (${name(leftSeat)}) attığı taştan birini al.`;
  else if (playPhase) {
    if (stealMode) hint = '🤫 Vereceğin taşı seç, sonra karşıdaki ya da sağdaki yığına dokun.';
    else if (!opened && plan?.mode === 'series' && plan.points >= 101) hint = `Perlerin ${plan.points} puan: "Elini aç" diyebilirsin! Sonra bir taş at.`;
    else if (!opened) hint = 'Taşlarını diz (aynı renk sıralı ya da aynı sayı farklı renk), sonra atacağın taşı sağ köşedeki yığına sürükle.';
    else hint = 'Yerdeki perlere taş işleyebilirsin. Sonra bir taşı sağ köşedeki yığına at.';
  } else hint = `Sıra: ${name(view.turn)}. Bu arada taşlarını dizebilirsin.`;

  const pileLabel = (s: number) => {
    if (stealMode && s !== mySeat && s !== leftSeat && playPhase) return 'Çal';
    if (s === leftSeat && drawPhase) return 'Al';
    if (s === mySeat && playPhase) return 'At';
    return null;
  };

  return (
    <div className={`okey-board ${drag ? 'dragging' : ''}`}>
      <div className="rotate-hint">📱↻ Okey için telefonunu yan çevir</div>

      {/* hot-spots over the 3D table */}
      <button ref={spot('deck')} className={`hs hs-deck ${drawPhase && view.deck > 0 ? 'live' : ''}`} onClick={draw} title="Desteden çek">
        {drawPhase && view.deck > 0 ? <span className="hs-label">Çek</span> : null}
        <span className="hs-count">{view.deck}</span>
      </button>
      {[0, 1, 2, 3].map((s) => {
        const label = pileLabel(s);
        return (
          <div key={s} ref={spot(`pile-${s}`)} data-pile={s} className={`hs hs-pile ${label ? 'live' : ''} ${s === mySeat ? 'mine' : ''}`} onClick={() => onPile(s)}>
            {label && <span className="hs-label">{label}</span>}
          </div>
        );
      })}
      {view.melds.map((m) => (
        <div key={m.id} ref={spot(`meld-${m.id}`)} data-meld={m.id} className={`hs hs-meld ${fits(m) ? 'live' : ''}`} onClick={() => onMeld(m, sel)} />
      ))}

      {/* name plates over the opponents */}
      {[0, 1, 2, 3]
        .filter((s) => s !== mySeat)
        .map((s) => {
          const p = seatPlayer(s);
          return (
            <div key={s} ref={spot(`plate-${s}`)} className={`plate ${view.turn === s ? 'turn' : ''}`}>
              <div className="plate-in">
                <span className="dotc" style={{ background: p?.color ?? '#999' }} />
                <b>{p?.name ?? '—'}</b>
                {p?.isBot && <span className="tag bot">bot</span>}
                {view.opened[s] && <span className="tag open">{view.opened[s] === 'pairs' ? 'çift' : 'açtı'}</span>}
                {view.turn === s && <span className="timer">{remaining}</span>}
                {s === leftSeat && <span className="tag left">solun</span>}
                {(drinks[table.seats[s] ?? ''] ?? []).map((d) => (
                  <span key={d.t} className="drink">
                    {d.emoji}
                  </span>
                ))}
              </div>
            </div>
          );
        })}

      {/* top: the one instruction + table info */}
      <div className={`okey-hint ${myTurn ? 'mine' : ''}`}>
        <span>{hint}</span>
        {myTurn && <b className="timer">{remaining}</b>}
      </div>
      <div className="okey-info">
        <span>
          Okey: <b>{okeyLabel}</b>
        </span>
        <span>
          El {table.handNo}/{table.hands}
        </span>
        <span>Kasa {table.pot} ₺</span>
        <button className="btn tiny" onClick={() => setHelp(true)}>
          ❔ Nasıl oynanır?
        </button>
      </div>

      {suspicious && (
        <button className="btn accuse" onClick={() => send({ t: 'accuse' })}>
          👀 Hile var!
        </button>
      )}

      {/* bottom: my ıstaka and actions */}
      <div className="me-area">
        <div className="me-bar">
          <span className={`me-name ${myTurn ? 'turn' : ''}`}>{name(mySeat)}</span>
          {opened && <span className="tag open">Elin açık ({opened === 'pairs' ? 'çift' : 'seri'})</span>}
          {view.penalties[mySeat]! > 0 && <span className="pen">Ceza +{view.penalties[mySeat]}</span>}
          {!opened && plan && (
            <span className="progress" title="Açmak için 101 puan ya da 5 çift gerekir">
              {plan.mode === 'pairs' ? `Çift: ${plan.pairs}/5` : `Per: ${plan.points}/101`}
              <i style={{ width: `${Math.min(100, plan.mode === 'pairs' ? (plan.pairs / 5) * 100 : (plan.points / 101) * 100)}%` }} />
            </span>
          )}
          {(drinks[table.seats[mySeat] ?? ''] ?? []).map((d) => (
            <span key={d.t} className="drink">
              {d.emoji}
            </span>
          ))}
        </div>
        <div className="istaka-wrap">
          <div className="istaka" ref={rackRef}>
            <div className="tier t1" />
            <div className="tier t2" />
            {Array.from({ length: SLOTS }, (_, i) => (
              <div
                key={`s${i}`}
                className={`slot ${drag?.over === i ? 'over' : ''} ${sel !== null && rack[i] === null ? 'free' : ''}`}
                style={{ gridRow: Math.floor(i / ROW) + 1, gridColumn: (i % ROW) + 1 }}
                onClick={() => onSlotTap(i)}
              />
            ))}
            {shown
              .map((t, i) => [t, i] as const)
              .filter((x): x is readonly [number, number] => x[0] !== null)
              .sort((a, b) => a[0] - b[0])
              .map(([t, i]) => (
                <div
                  key={t}
                  className={`rack-tile ${drag?.tile === t ? 'lifted' : ''} ${goodGroup.has(t) ? 'good' : ''}`}
                  style={{ gridRow: Math.floor(i / ROW) + 1, gridColumn: (i % ROW) + 1 }}
                  onPointerDown={onTileDown(t)}
                >
                  <Tile id={t} ctx={ctx} selected={sel === t} dim={drag?.tile === t} isNew={t === takenTile} />
                </div>
              ))}
          </div>
        </div>
        <div className="okey-actions">
          <button className="btn small" onClick={() => setRack(arrangeSeries(hand, ctx))} title="Taşları en iyi perlere göre diz">
            Seri diz
          </button>
          <button className="btn small" onClick={() => setRack(arrangePairs(hand, ctx))} title="Çiftleri yan yana diz">
            Çift diz
          </button>
          {plan && plan.mode && playPhase && (opened || (plan.mode === 'series' ? plan.points >= 101 : plan.pairs >= 5)) && (
            <button className="btn small primary glow" onClick={openHand}>
              {opened ? 'Per indir' : plan.mode === 'series' ? `Elini aç (${plan.points})` : `Çiftle aç (${plan.pairs})`}
            </button>
          )}
          {playPhase && sel !== null && (
            <button className="btn small primary" onClick={() => discard(sel)}>
              Seçili taşı at
            </button>
          )}
          <button className={`btn small ${more ? 'on' : ''}`} onClick={() => setMore((m) => !m)}>
            ⋯
          </button>
          {more && (
            <div className="more-menu" onClick={() => setMore(false)}>
              {takenTile !== null && myTurn && <button onClick={() => send({ t: 'putBack' })}>↩ Aldığın taşı geri koy</button>}
              {drawPhase && view.deck === 0 && <button onClick={() => send({ t: 'deckEmpty' })}>Deste bitti, eli kapat</button>}
              {playPhase && !view.stealUsed[mySeat] && (
                <button onClick={() => setStealMode((m) => !m)}>🤫 {stealMode ? 'Çalmaktan vazgeç' : 'Taş çal (elde bir kez)'}</button>
              )}
              <button onClick={() => send({ t: 'accuse' })}>👀 Hile var! (6 sn içinde)</button>
              <button onClick={() => setHelp(true)}>❔ Nasıl oynanır?</button>
              <button onClick={onStand}>Masadan kalk</button>
            </div>
          )}
        </div>
      </div>

      {drag && (
        <div className="drag-ghost" style={{ left: drag.x, top: drag.y }}>
          <Tile id={drag.tile} ctx={ctx} />
        </div>
      )}

      {help && (
        <div className="panel okey-help" onClick={() => setHelp(false)}>
          <div className="panel-head">
            <h2>101 Okey nasıl oynanır?</h2>
            <button className="btn small">Tamam</button>
          </div>
          <ol>
            <li>
              <b>Taş çek:</b> Sıra sana gelince ortadaki desteden ya da <b>soldakinin</b> attığı son taştan birini al.
            </li>
            <li>
              <b>Diz:</b> Taşları ıstakanda sürükleyip istediğin yere koy. Yan yana duran taşlar bir per sayılır, perlerin arasına boşluk bırak.
            </li>
            <li>
              <b>Per:</b> Aynı renkte sıralı sayılar (5-6-7) ya da aynı sayının farklı renkleri (9-9-9). En az 3 taş.
            </li>
            <li>
              <b>Elini aç:</b> Perlerinin toplamı en az <b>101</b> olunca (ya da 5 çiftin olunca) &quot;Elini aç&quot;a bas.
            </li>
            <li>
              <b>Okey</b> ({okeyLabel}, yıldızlı) her taşın yerine geçer. Yonca ♣ sahte okeydir, okeyin yerine sayılır.
            </li>
            <li>
              <b>Taş at:</b> Her turun sonunda bir taşı <b>sağ köşedeki</b> yığınına sürükle. Elini açtıysan önce yerdeki perlere taş işleyebilirsin.
            </li>
            <li>Elindeki taşları ilk bitiren eli kazanır. Maç sonunda puanı en düşük olan kasayı alır.</li>
          </ol>
        </div>
      )}

      {(table.status === 'between' || table.status === 'result') && lastHand && (
        <div className="panel hand-result">
          <h2>{table.status === 'result' && lastMatch ? 'Maç bitti!' : `${table.handNo}. el bitti`}</h2>
          <p className="hint">
            {lastHand.finisher !== null ? `${name(lastHand.finisher)} bitirdi${lastHand.multiplier > 1 ? ' (çift ceza!)' : ''}.` : 'Deste bitti, kimse bitiremedi.'}
          </p>
          <table>
            <tbody>
              {[0, 1, 2, 3].map((s) => (
                <tr key={s} className={s === mySeat ? 'me' : ''}>
                  <td>{name(s)}</td>
                  <td className="muted">
                    bu el {lastHand.scores[s]! > 0 ? '+' : ''}
                    {lastHand.scores[s]}
                  </td>
                  <td className="score">{table.totals[s]}</td>
                  {lastMatch && (
                    <td className={lastMatch.payout[s]! > 0 ? 'win' : 'lose'}>
                      {lastMatch.payout[s]! > 0 ? '+' : ''}
                      {lastMatch.payout[s]} ₺
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {lastMatch ? (
            <p className="hint ok">
              Kasa ({lastMatch.pot} ₺) → {lastMatch.winners.map(name).join(', ')}
            </p>
          ) : (
            <p className="hint">Yeni el birazdan dağıtılıyor…</p>
          )}
        </div>
      )}
    </div>
  );
}
