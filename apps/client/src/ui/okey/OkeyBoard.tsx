import { useEffect, useMemo, useRef, useState } from 'react';
import { asSeries, playFace, sameFace, type OkeyCtx } from '@sokak/okey';
import type { HandResultView, KPlayerView, KTableView, MatchResultView, Meld, OkeyAction, TableView } from '@sokak/shared';
import { Tile } from './Tile';
import { ROW, SLOTS, arrangePairs, arrangeSeries, emptyRack, openPlan, syncRack, type Rack } from './rack';
import { play } from '../../game/audio';

interface Props {
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
}

const SEAT_POS = ['me', 'right', 'top', 'left'] as const;

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

export function OkeyBoard({ table, view, players, mySeat, hand, takenTile, serverNow, send, toast, drinks = {} }: Props) {
  const ctx: OkeyCtx | null = view ? { okey: view.okey as OkeyCtx['okey'] } : null;
  const [rack, setRack] = useState<Rack>(emptyRack);
  const [sel, setSel] = useState<number | null>(null);
  const [stealMode, setStealMode] = useState(false);
  const [drag, setDrag] = useState<{ tile: number; x: number; y: number } | null>(null);
  const dragRef = useRef<{ tile: number; startX: number; startY: number; moved: boolean } | null>(null);
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

  // new hand → fresh rack
  const handKey = `${table.handNo}-${view?.gosterge}`;
  const lastKey = useRef(handKey);
  useEffect(() => {
    if (lastKey.current !== handKey) {
      lastKey.current = handKey;
      setRack(syncRack(emptyRack(), hand));
    }
  }, [handKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const seatAt = (pos: (typeof SEAT_POS)[number]) => (mySeat + SEAT_POS.indexOf(pos)) % 4;
  const leftSeat = seatAt('left');
  const myTurn = !!view && view.turn === mySeat && view.phase !== 'ended';
  const drawPhase = myTurn && view.phase === 'draw';
  const playPhase = myTurn && view.phase === 'play';
  const opened = view?.opened[mySeat] ?? null;
  const plan = useMemo(() => (ctx ? openPlan(rack, ctx) : null), [rack, ctx?.okey.color, ctx?.okey.num]); // eslint-disable-line react-hooks/exhaustive-deps
  const name = (s: number) => players[table.seats[s] ?? '']?.name ?? '—';
  const remaining = Math.max(0, Math.ceil((table.turnEndsAt - serverNow()) / 1000));

  // ------------------------------------------------------------ actions
  const discard = (tile: number) => {
    if (!playPhase) return toast('Sıra sende değil ya da önce taş çekmelisin.', 'info');
    send({ t: 'discard', tile });
    play('click');
    setSel(null);
  };
  const onMeld = (m: Meld, tile: number | null) => {
    if (tile === null || !ctx) return;
    if (!playPhase) return toast('Önce sıranı bekle.', 'info');
    if (!opened) return toast('İşlemek için önce elini açmalısın.', 'info');
    if (canAdd(m, tile, ctx)) send({ t: 'add', tile, meld: m.id });
    else if (canSwap(m, tile, ctx)) send({ t: 'swap', tile, meld: m.id });
    else return toast('Bu taş bu pere uymuyor.', 'bad');
    play('click');
    setSel(null);
  };
  const onPile = (seat: number) => {
    if (stealMode) {
      if (sel === null) return toast('Önce ıstakadan vereceğin taşı seç.', 'info');
      send({ t: 'steal', tile: sel, pile: seat });
      setStealMode(false);
      setSel(null);
      return;
    }
    if (seat === leftSeat && drawPhase) {
      send({ t: 'take' });
      play('click');
    }
  };
  const openHand = () => {
    if (!plan || !plan.mode) return;
    if (opened) {
      for (const g of plan.groups) send({ t: 'lay', tiles: g });
    } else send({ t: 'open', groups: plan.groups });
    play('pop');
  };

  // ------------------------------------------------------------ drag & drop (pointer based, works on touch)
  const onTileDown = (tile: number) => (e: React.PointerEvent) => {
    e.preventDefault();
    dragRef.current = { tile, startX: e.clientX, startY: e.clientY, moved: false };
  };
  useEffect(() => {
    const move = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      if (!d.moved && Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < 6) return;
      d.moved = true;
      setDrag({ tile: d.tile, x: e.clientX, y: e.clientY });
    };
    const up = (e: PointerEvent) => {
      const d = dragRef.current;
      dragRef.current = null;
      setDrag(null);
      if (!d) return;
      if (!d.moved) {
        // tap = select / unselect
        setSel((s) => (s === d.tile ? null : d.tile));
        return;
      }
      const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
      const slotEl = el?.closest('[data-slot]') as HTMLElement | null;
      const meldEl = el?.closest('[data-meld]') as HTMLElement | null;
      const discardEl = el?.closest('[data-drop="discard"]');
      if (slotEl) {
        const to = Number(slotEl.dataset.slot);
        setRack((r) => {
          const next = [...r];
          const from = next.indexOf(d.tile);
          if (from < 0) return r;
          [next[from], next[to]] = [next[to] ?? null, d.tile];
          return next;
        });
        play('click');
      } else if (meldEl && view) {
        const m = view.melds.find((x) => x.id === Number(meldEl.dataset.meld));
        if (m) onMeld(m, d.tile);
      } else if (discardEl) discard(d.tile);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  });

  if (!view || !ctx) return null;

  // ------------------------------------------------------------ render helpers
  const opponent = (pos: 'left' | 'top' | 'right') => {
    const s = seatAt(pos);
    const p = players[table.seats[s] ?? ''];
    const top = view.discards[s]!.slice(-1)[0];
    const pileClickable = (stealMode && s !== leftSeat) || (s === leftSeat && drawPhase);
    return (
      <div className={`opp opp-${pos} ${view.turn === s ? 'turn' : ''}`}>
        <div className="opp-card">
          <span className="dotc" style={{ background: p?.color ?? '#999' }} />
          <b>{p?.name ?? '—'}</b>
          {p?.isBot && <span className="tag bot">bot</span>}
          <span className="cnt">{view.handCounts[s]} taş</span>
          {view.opened[s] && <span className="tag open">{view.opened[s] === 'pairs' ? 'çift açtı' : 'açtı'}</span>}
          {view.turn === s && <span className="timer">{remaining}</span>}
          {(drinks[table.seats[s] ?? ''] ?? []).map((d) => (
            <span key={d.t} className="drink" title="ısmarlandı">
              {d.emoji}
            </span>
          ))}
        </div>
        <div className={`pile ${pileClickable ? 'clickable' : ''}`} onClick={() => onPile(s)} title={s === leftSeat ? 'Soldaki taş (alabilirsin)' : 'Atılan taş'}>
          {top !== undefined ? <Tile id={top} ctx={ctx} small /> : <div className="tile sm empty" />}
          {s === leftSeat && <span className="pile-label">sol</span>}
        </div>
      </div>
    );
  };

  const myTop = view.discards[mySeat]!.slice(-1)[0];
  const okeyLabel = `${['Kırmızı', 'Sarı', 'Mavi', 'Siyah'][view.okey.color]} ${view.okey.num}`;
  const lastHand: HandResultView | null = table.lastHand ? JSON.parse(table.lastHand) : null;
  const lastMatch: MatchResultView | null = table.lastMatch ? JSON.parse(table.lastMatch) : null;

  return (
    <div className="okey-board">
      <div className="rotate-hint">📱↻ Okey için telefonunu yan çevir</div>
      {opponent('top')}
      {opponent('left')}
      {opponent('right')}

      <div className="center">
        <div className="deck-row">
          <button className={`deck ${drawPhase && view.deck > 0 ? 'clickable' : ''}`} onClick={() => drawPhase && view.deck > 0 && (send({ t: 'draw' }), play('click'))}>
            <span>{view.deck}</span>
            <small>deste</small>
          </button>
          <div className="gosterge">
            <Tile id={view.gosterge} ctx={null} small />
            <small>gösterge</small>
          </div>
          <div className="okey-info">
            Okey: <b>{okeyLabel}</b>
          </div>
          <div className="match-info">
            El {table.handNo}/{table.hands} · Kasa {table.pot} ₺
          </div>
        </div>
        <div className="melds">
          {view.melds.length === 0 && <div className="melds-empty">Henüz açan yok. 101 puanlık per ya da 5 çift ile elini aç!</div>}
          {view.melds.map((m) => (
            <div
              key={m.id}
              data-meld={m.id}
              className={`meld ${sel !== null && ctx && (canAdd(m, sel, ctx) || canSwap(m, sel, ctx)) && playPhase && opened ? 'can' : ''}`}
              onClick={() => onMeld(m, sel)}
              title={`${name(m.owner)}`}
            >
              {m.tiles.map((t) => (
                <Tile key={t} id={t} ctx={ctx} small />
              ))}
              <span className="meld-owner">{name(m.owner).slice(0, 8)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="me-area">
        <div className="status-line">
          {myTurn ? (
            <span className="your-turn">
              Sıra sende! {drawPhase ? 'Desteden ya da soldan taş çek.' : 'Per indir/işle, sonra bir taş at.'} <b>{remaining} sn</b>
            </span>
          ) : (
            <span>Sıra: {name(view.turn)}</span>
          )}
          {view.penalties[mySeat]! > 0 && <span className="pen">Ceza: +{view.penalties[mySeat]}</span>}
          {opened && <span className="tag open">Elin açık ({opened === 'pairs' ? 'çift' : 'seri'})</span>}
          {(drinks[table.seats[mySeat] ?? ''] ?? []).map((d) => (
            <span key={d.t} className="drink">
              {d.emoji}
            </span>
          ))}
        </div>
        <div className="rack-wrap">
          <div className="rack">
            {Array.from({ length: SLOTS }, (_, i) => {
              const t = rack[i];
              return (
                <div key={i} className={`slot ${i === ROW ? 'row2' : ''}`} data-slot={i}>
                  {t !== null && t !== undefined && (
                    <Tile id={t} ctx={ctx} selected={sel === t} dim={drag?.tile === t} onPointerDown={onTileDown(t)} />
                  )}
                </div>
              );
            })}
          </div>
          <div className={`my-pile ${playPhase ? 'can' : ''}`} data-drop="discard" onClick={() => sel !== null && discard(sel)}>
            {myTop !== undefined ? <Tile id={myTop} ctx={ctx} small /> : <span>Taş at</span>}
          </div>
        </div>
        <div className="okey-actions">
          <button className="btn small" onClick={() => setRack(arrangeSeries(hand, ctx))}>
            Seri diz
          </button>
          <button className="btn small" onClick={() => setRack(arrangePairs(hand, ctx))}>
            Çift diz
          </button>
          {plan && plan.mode && playPhase && (
            <button className="btn small primary" onClick={openHand}>
              {opened
                ? 'Per indir'
                : plan.mode === 'series'
                  ? `Elini aç (${plan.points}/101)`
                  : `Çiftle aç (${plan.pairs}/5)`}
            </button>
          )}
          {playPhase && sel !== null && (
            <button className="btn small primary" onClick={() => discard(sel)}>
              Seçili taşı at
            </button>
          )}
          {takenTile !== null && myTurn && (
            <button className="btn small" onClick={() => send({ t: 'putBack' })}>
              Geri koy
            </button>
          )}
          {drawPhase && view.deck === 0 && (
            <button className="btn small" onClick={() => send({ t: 'deckEmpty' })}>
              Deste bitti
            </button>
          )}
          {playPhase && !view.stealUsed[mySeat] && (
            <button className={`btn small ${stealMode ? 'primary' : ''}`} onClick={() => setStealMode((m) => !m)} title="Elde bir kez: karşıdakinin ya da sağdakinin attığı taşı kendi taşınla gizlice değiştir. Yakalanırsan ceza!">
              🤫 {stealMode ? 'Hangi yığın?' : 'Taş çal'}
            </button>
          )}
          <button className="btn small warn" onClick={() => send({ t: 'accuse' })} title="Biri taş çaldıysa 6 saniye içinde bas. Yanlış suçlama 20 ₺!">
            👀 Hile var!
          </button>
        </div>
      </div>

      {drag && (
        <div className="drag-ghost" style={{ left: drag.x, top: drag.y }}>
          <Tile id={drag.tile} ctx={ctx} />
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
                  <td className="muted">bu el {lastHand.scores[s]! > 0 ? '+' : ''}{lastHand.scores[s]}</td>
                  <td className="score">{table.totals[s]}</td>
                  {lastMatch && <td className={lastMatch.payout[s]! > 0 ? 'win' : 'lose'}>{lastMatch.payout[s]! > 0 ? '+' : ''}{lastMatch.payout[s]} ₺</td>}
                </tr>
              ))}
            </tbody>
          </table>
          {lastMatch ? (
            <p className="hint ok">Kasa ({lastMatch.pot} ₺) → {lastMatch.winners.map(name).join(', ')}</p>
          ) : (
            <p className="hint">Yeni el birazdan dağıtılıyor…</p>
          )}
        </div>
      )}
    </div>
  );
}
