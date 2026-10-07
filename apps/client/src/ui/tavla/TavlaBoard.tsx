import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { BAR, OFF, legalMovesFor, pipCount, type Move, type Side, type TavlaView } from '@sokak/tavla';
import type { KPlayerView, KTavlaView, TavlaAction, TavlaGameResultView, TavlaMatchResultView } from '@sokak/shared';
import { play } from '../../game/audio';
import './tavla.css';

interface Props {
  table: KTavlaView;
  view: TavlaView | null;
  players: Record<string, KPlayerView>;
  mySeat: number;
  serverNow: () => number;
  send: (a: TavlaAction) => void;
  onStand: () => void;
  phrases?: readonly string[];
  onChat?: (q: number) => void;
}

// ------------------------------------------------------------------ board geometry (SVG units)
const W = 1000;
const H = 640;
const M = 16;
const TRAY = 78;
const BARW = 56;
const PW = (W - 2 * M - TRAY - BARW) / 12;
const LEFT_END = M + 6 * PW;
const RIGHT_START = LEFT_END + BARW;
const RIGHT_END = RIGHT_START + 6 * PW;
const PH = (H - 2 * M) * 0.42;
const R = PW * 0.46;
const BAR_X = LEFT_END + BARW / 2;
const TRAY_X = RIGHT_END + (W - M - RIGHT_END) / 2;

/** centre x and whether the display point is on the bottom row (display 0 = bottom right) */
function pointX(d: number): { x: number; bottom: boolean } {
  if (d < 12) return { x: d < 6 ? RIGHT_END - (d + 0.5) * PW : LEFT_END - (d - 6 + 0.5) * PW, bottom: true };
  const c = d - 12;
  return { x: c < 6 ? M + (c + 0.5) * PW : RIGHT_START + (c - 6 + 0.5) * PW, bottom: false };
}

function stackY(bottom: boolean, k: number, n: number): number {
  const step = n > 1 ? Math.min(2 * R, (PH + 10 - 2 * R) / (n - 1)) : 0;
  return bottom ? H - M - R - k * step : M + R + k * step;
}

const PIPS: Record<number, [number, number][]> = {
  1: [[0.5, 0.5]],
  2: [[0.28, 0.28], [0.72, 0.72]],
  3: [[0.26, 0.26], [0.5, 0.5], [0.74, 0.74]],
  4: [[0.28, 0.28], [0.72, 0.28], [0.28, 0.72], [0.72, 0.72]],
  5: [[0.26, 0.26], [0.74, 0.26], [0.5, 0.5], [0.26, 0.74], [0.74, 0.74]],
  6: [[0.28, 0.24], [0.72, 0.24], [0.28, 0.5], [0.72, 0.5], [0.28, 0.76], [0.72, 0.76]],
};

function Die({ x, y, v, used, size = 58 }: { x: number; y: number; v: number; used: boolean; size?: number }) {
  return (
    <g className={`tv-die ${used ? 'used' : ''}`} transform={`translate(${x - size / 2} ${y - size / 2})`}>
      <rect width={size} height={size} rx={size * 0.18} />
      {PIPS[v]?.map(([px, py], i) => <circle key={i} cx={px * size} cy={py * size} r={size * (v === 1 ? 0.12 : 0.085)} className={v === 1 ? 'one' : ''} />)}
    </g>
  );
}

const SIDE_NAME = ['Beyaz', 'Siyah'];

/**
 * The seated tavla view: a clear 2D board (SVG) over the 3D table. The board is shown from
 * the player's side — their home is always bottom right (a black player sees it mirrored).
 * Tap a checker (or its point), the legal destinations light up, tap one to move.
 */
export function TavlaBoard({ table, view, players, mySeat, serverNow, send, onStand, phrases = [], onChat }: Props) {
  const [sel, setSel] = useState<number | null>(null);
  const [talk, setTalk] = useState(false);
  const [help, setHelp] = useState(false);
  const [, tick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => tick((n) => n + 1), 500);
    return () => clearInterval(iv);
  }, []);
  const me = mySeat as Side;
  const opp: Side = me === 0 ? 1 : 0;
  /** engine point → display point (mirrored for black) */
  const disp = (i: number) => (me === 1 ? 23 - i : i);
  const playing = table.status === 'playing' && !!view && view.phase !== 'ended';
  const myTurn = playing && view!.turn === me;
  const legal: Move[] = useMemo(
    () => (myTurn && view!.phase === 'move' ? legalMovesFor({ board: view!.board, bar: view!.bar, off: view!.off }, me, view!.dice) : []),
    [myTurn, view, me],
  );
  const sources = useMemo(() => new Set(legal.map((m) => m.from)), [legal]);
  // a checker on the bar is the only thing that can move: pick it for the player
  const selected = sel !== null && sources.has(sel) ? sel : sources.size === 1 && sources.has(BAR) ? BAR : null;
  const dests = useMemo(() => new Set(selected === null ? [] : legal.filter((m) => m.from === selected).map((m) => m.to)), [legal, selected]);
  useEffect(() => setSel(null), [view?.moved.length, view?.turn, view?.phase]);
  const wasMyTurn = useRef(false);
  useEffect(() => {
    if (myTurn && !wasMyTurn.current) {
      play('pop');
      navigator.vibrate?.(60);
    }
    wasMyTurn.current = myTurn;
  }, [myTurn]);

  const player = (s: number) => players[table.seats[s] ?? ''];
  const name = (s: number) => player(s)?.name ?? '—';
  const remaining = Math.max(0, Math.ceil((table.turnEndsAt - serverNow()) / 1000));

  const move = (to: number) => {
    if (selected === null) return;
    send({ t: 'move', from: selected, to });
    setSel(null);
  };
  const tapPoint = (i: number) => {
    if (!myTurn) return;
    if (selected !== null && dests.has(i)) return move(i);
    setSel(sources.has(i) ? (selected === i ? null : i) : null);
  };

  // ------------------------------------------------------------ render pieces
  const pos = view ?? null;
  const checkers: ReactElement[] = [];
  const checker = (key: string, side: number, x: number, y: number, cls = '', label?: string) =>
    checkers.push(
      <g key={key} className={`tv-ck s${side} ${cls}`}>
        <circle cx={x} cy={y} r={R} />
        <circle cx={x} cy={y} r={R * 0.62} className="ring" />
        {label && (
          <text x={x} y={y + 9} textAnchor="middle">
            {label}
          </text>
        )}
      </g>,
    );
  if (pos) {
    for (let i = 0; i < 24; i++) {
      const v = pos.board[i]!;
      if (!v) continue;
      const side = v > 0 ? 0 : 1;
      const n = Math.abs(v);
      const { x, bottom } = pointX(disp(i));
      for (let k = 0; k < n; k++) {
        const top = k === n - 1;
        const cls = top && side === me ? (selected === i ? 'sel' : sources.has(i) ? 'can' : '') : '';
        checker(`p${i}-${k}`, side, x, stackY(bottom, k, n), cls, top && n > 5 ? String(n) : undefined);
      }
    }
    // bar: mine in the upper half (I re-enter top right), theirs in the lower half
    for (const side of [0, 1] as Side[]) {
      const n = pos.bar[side];
      for (let k = 0; k < n; k++) {
        const y = side === me ? H / 2 - R - 8 - k * R * 1.2 : H / 2 + R + 8 + k * R * 1.2;
        checker(`b${side}-${k}`, side, BAR_X, y, side === me && k === n - 1 ? (selected === BAR ? 'sel' : sources.has(BAR) ? 'can' : '') : '');
      }
    }
  }
  const lastTo = new Set((view?.moved ?? []).map((m) => m.to));

  const rolled = view && view.rolled.length === 2 && view.phase === 'move' ? view.rolled : null;
  const doubles = !!rolled && rolled[0] === rolled[1];
  const dieUsed = (k: number) => (!rolled ? false : doubles ? (k === 0 ? view!.dice.length <= 2 : view!.dice.length === 0) : !view!.dice.includes(rolled[k]!));
  const diceX = view && view.turn === me ? (RIGHT_START + RIGHT_END) / 2 : (M + LEFT_END) / 2;

  let hint = '';
  if (playing) {
    if (!myTurn) hint = `${name(opp)} oynuyor…`;
    else if (view!.phase === 'roll') hint = 'Sıra sende — zar at!';
    else if (legal.length && pos!.bar[me] > 0) hint = 'Kırık taşın var, önce onu gir.';
    else if (legal.length) hint = selected === null ? 'Sıra sende: oynayacağın taşa dokun.' : 'Yeşil yerlerden birine dokun.';
    else if (view!.dice.length) hint = 'Oynayacak hamlen yok, sıra geçiyor…';
    else hint = 'Hamlelerin bitti: Tamam de (ya da geri al).';
  }
  const lastGame = table.lastGame ? (JSON.parse(table.lastGame) as TavlaGameResultView) : null;
  const lastMatch = table.lastMatch ? (JSON.parse(table.lastMatch) as TavlaMatchResultView) : null;
  const pips = (s: Side) => (pos ? pipCount({ board: pos.board, bar: pos.bar, off: pos.off }, s) : 167);

  const plate = (s: Side) => (
    <div className={`tv-plate ${playing && view!.turn === s ? 'turn' : ''}`}>
      <span className={`tv-dot s${s}`} />
      <b>{name(s)}</b>
      {player(s)?.isBot && <span className="tag bot">bot</span>}
      <span className="muted">
        {SIDE_NAME[s]} · {pips(s)} pip
      </span>
      <span className="tv-score">{table.score[s] ?? 0}</span>
      {playing && view!.turn === s && <span className="timer">{remaining}</span>}
    </div>
  );

  return (
    <div className="tavla-board">
      <div className="tv-head">
        {plate(opp)}
        <span className="pill">
          🎲 {table.target} sayılık maç · {table.game}. oyun{table.pot > 0 && <> · Kasa {table.pot.toLocaleString('tr-TR')} ₺</>}
        </span>
      </div>
      <div className="tv-wrap">
        <svg className="tv-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
          <rect className="tv-frame" x={0} y={0} width={W} height={H} rx={18} />
          <rect className="tv-field" x={M} y={M} width={LEFT_END - M} height={H - 2 * M} />
          <rect className="tv-field" x={RIGHT_START} y={M} width={RIGHT_END - RIGHT_START} height={H - 2 * M} />
          <rect className={`tv-tray ${dests.has(OFF) ? 'dest' : ''}`} x={RIGHT_END + 6} y={M} width={W - M - RIGHT_END - 6} height={H - 2 * M} rx={8} onClick={() => dests.has(OFF) && move(OFF)} />
          {Array.from({ length: 24 }, (_, d) => {
            const { x, bottom } = pointX(d);
            const base = bottom ? H - M : M;
            const tip = bottom ? H - M - PH : M + PH;
            const i = me === 1 ? 23 - d : d;
            return (
              <g key={d} onClick={() => tapPoint(i)} className="tv-point">
                <rect x={x - PW / 2} y={bottom ? H / 2 : M} width={PW} height={H / 2 - M} fill="transparent" />
                <polygon points={`${x - PW * 0.47},${base} ${x + PW * 0.47},${base} ${x},${tip}`} className={`tri ${d % 2 ? 'a' : 'b'} ${dests.has(i) ? 'dest' : ''} ${lastTo.has(i) ? 'last' : ''}`} />
                <text x={x} y={bottom ? H - 3 : 13} textAnchor="middle" className="tv-num">
                  {d + 1}
                </text>
              </g>
            );
          })}
          <rect className="tv-bar" x={LEFT_END} y={M} width={BARW} height={H - 2 * M} onClick={() => tapPoint(BAR)} />
          {checkers}
          {/* borne off: slices, mine at the bottom next to my home */}
          {pos &&
            ([0, 1] as Side[]).map((s) =>
              Array.from({ length: pos.off[s] }, (_, k) => (
                <rect key={`o${s}-${k}`} className={`tv-off s${s}`} x={TRAY_X - 28} width={56} height={14} rx={4} y={s === me ? H - M - 18 - k * 17 : M + 4 + k * 17} />
              )),
            )}
          {rolled && (
            <>
              <Die x={diceX - 36} y={H / 2} v={rolled[0]!} used={dieUsed(0)} />
              <Die x={diceX + 36} y={H / 2} v={rolled[1]!} used={dieUsed(1)} />
              {doubles && (
                <text x={diceX} y={H / 2 + 62} textAnchor="middle" className="tv-x4">
                  çift! {view!.dice.length} hamle kaldı
                </text>
              )}
            </>
          )}
        </svg>
        {myTurn && view!.phase === 'roll' && (
          <button className="btn big tv-roll" onClick={() => send({ t: 'roll' })}>
            🎲 Zar at
          </button>
        )}
      </div>
      <div className="tv-foot">
        {plate(me)}
        <span className={`tv-hint ${myTurn ? 'mine' : ''}`}>{hint}</span>
        <div className="tv-actions">
          {myTurn && (view?.moved.length ?? 0) > 0 && (
            <button className="btn small" onClick={() => send({ t: 'undo' })}>
              ↩ Geri al
            </button>
          )}
          {myTurn && view!.phase === 'move' && legal.length === 0 && (
            <button className="btn small primary glow" onClick={() => send({ t: 'end' })}>
              ✓ Tamam
            </button>
          )}
          {onChat && phrases.length > 0 && (
            <button className={`btn small ${talk ? 'on' : ''}`} onClick={() => setTalk((t) => !t)} title="Hazır cümleler">
              💬
            </button>
          )}
          <button className="btn small" onClick={() => setHelp(true)} title="Nasıl oynanır?">
            ❔
          </button>
          <button className="btn small" onClick={onStand}>
            Kalk
          </button>
          {talk && onChat && (
            <div className="more-menu talk-menu" onClick={() => setTalk(false)}>
              {phrases.map((p, i) => (
                <button key={p} onClick={() => onChat(i)}>
                  {p}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {help && (
        <div className="panel okey-help" onClick={() => setHelp(false)}>
          <div className="panel-head">
            <h2>Tavla nasıl oynanır?</h2>
            <button className="btn small">Tamam</button>
          </div>
          <ol>
            <li>Taşların sağ alttaki eve doğru, saat yönünün tersine ilerler. 15 taşı da eve toplayıp ilk dışarı çıkaran kazanır.</li>
            <li>
              <b>Zar at</b>, sonra oynayacağın taşa dokun: gidebileceği yerler yeşil yanar, birine dokun. Çift atarsan dört hamle oynarsın.
            </li>
            <li>İki zarı da oynamak zorundasın; sadece biri oynanabiliyorsa büyüğünü oynarsın.</li>
            <li>Tek duran taşa (açık taş) rakip gelirse taş kırılır ve ortaya gider. Kırık taşın varsa önce onu rakibin evinden içeri girmelisin.</li>
            <li>Rakibin iki ya da daha fazla taşı olan haneye giremezsin.</li>
            <li>Bütün taşların evdeyse taş toplarsın; büyük zar en uzaktaki taşı çıkarır.</li>
            <li>Kazanan 1 sayı alır. Rakip hiç taş toplayamadan bitirirsen <b>mars</b>: 2 sayı!</li>
          </ol>
        </div>
      )}

      {(table.status === 'between' || table.status === 'result') && lastGame && (
        <div className="panel hand-result tv-result">
          <h2>{lastMatch ? (lastMatch.winner === me ? '🏆 Maçı kazandın!' : `Maçı ${name(lastMatch.winner)} kazandı`) : lastGame.winner === me ? 'Oyunu kazandın!' : `Oyunu ${name(lastGame.winner)} kazandı`}</h2>
          {lastGame.mars && <p className="tv-mars">Mars! (+2)</p>}
          <p className="hint">
            Skor: {name(me)} {lastGame.score[me]} – {lastGame.score[opp]} {name(opp)}
          </p>
          {lastMatch ? (
            <p className={`hint ${lastMatch.payout[me]! > 0 ? 'ok' : ''}`}>
              {lastMatch.pot > 0 ? `Kasa (${lastMatch.pot} ₺) → ${name(lastMatch.winner)}` : 'Bahissiz maçtı.'}
              {lastMatch.pot > 0 && ` · Sen: ${lastMatch.payout[me]! > 0 ? '+' : ''}${lastMatch.payout[me]} ₺`}
            </p>
          ) : (
            <p className="hint">Yeni oyun birazdan başlıyor…</p>
          )}
        </div>
      )}
    </div>
  );
}
