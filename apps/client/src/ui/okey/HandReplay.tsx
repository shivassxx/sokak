import { useEffect, useState } from 'react';
import type { OkeyCtx } from '@sokak/okey';
import type { HandReplayMsg, ReplayMove } from '@sokak/shared';
import { Tile } from './Tile';
import { play } from '../../game/audio';
import '../kahve/kibitzer.css';

/** total length of the moves part; the melds then fan out for ~2 s */
const MOVES_MS = 5200;
const MELDS_MS = 2200;

function verb(m: ReplayMove): string {
  switch (m.k) {
    case 'draw':
      return m.from === 'deck' ? 'desteden çekti' : 'soldan aldı';
    case 'discard':
      return m.islek ? 'işlek attı!' : 'attı';
    case 'open':
      return m.mode === 'pairs' ? 'çiftle açtı' : `elini açtı (${m.points})`;
    case 'lay':
      return 'per indirdi';
    case 'add':
      return 'işledi';
    case 'swap':
      return 'okeyi aldı';
    case 'show':
      return 'göstergeyi gösterdi';
  }
}

function tilesOf(m: ReplayMove): number[] {
  if (m.k === 'lay') return m.tiles;
  if ('tile' in m && typeof m.tile === 'number') return [m.tile];
  return [];
}

/**
 * "▶ Eli izle": a short, skippable replay of how the hand was finished — the last public
 * moves as a quick timeline, then the winner's melds revealed one by one. Only public
 * information: deck draws stay face down, the other players' racks are never shown.
 */
export function HandReplay({ replay, name, onClose }: { replay: HandReplayMsg; name: (seat: number) => string; onClose: () => void }) {
  const ctx: OkeyCtx = { okey: replay.okey as OkeyCtx['okey'] };
  const n = replay.moves.length;
  const stepMs = n ? Math.max(260, Math.min(700, MOVES_MS / n)) : 0;
  const [step, setStep] = useState(0);
  const done = step >= n;
  const [melds, setMelds] = useState(0);

  useEffect(() => {
    if (done) return;
    const id = setTimeout(() => {
      setStep((s) => s + 1);
      play('click');
    }, stepMs);
    return () => clearTimeout(id);
  }, [step, done, stepMs]);
  useEffect(() => {
    if (!done || melds >= replay.melds.length) return;
    const id = setTimeout(() => {
      setMelds((k) => k + 1);
      play('pop');
    }, MELDS_MS / Math.max(1, replay.melds.length));
    return () => clearTimeout(id);
  }, [done, melds, replay.melds.length]);

  const skip = () => {
    setStep(n);
    setMelds(replay.melds.length);
  };
  const current = !done ? replay.moves[step] : null;
  const total = n * stepMs + MELDS_MS;
  const elapsed = Math.min(n, step) * stepMs + (done ? (melds / Math.max(1, replay.melds.length)) * MELDS_MS : 0);
  const winner = replay.finisher !== null ? name(replay.finisher) : null;

  return (
    <div className="replay-veil" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="panel replay">
        <div className="panel-head">
          <h2>▶ {replay.handNo}. el · {winner ? `${winner} böyle bitirdi${replay.okeyFinish ? ' (okey atarak!)' : ''}` : 'deste bitti'}</h2>
          {done && melds >= replay.melds.length ? (
            <button className="btn small" onClick={onClose}>
              Kapat
            </button>
          ) : (
            <button className="btn small" onClick={skip}>
              Geç ⏭
            </button>
          )}
        </div>
        <div className="rp-progress">
          <i style={{ width: `${Math.min(100, (elapsed / Math.max(1, total)) * 100)}%` }} />
        </div>
        <ol className="rp-moves">
          {replay.moves.map((m, i) => (
            <li key={i} className={`${i < step ? 'done' : ''} ${i === step && !done ? 'now' : ''} ${m.s === replay.finisher ? 'winner' : ''}`}>
              <b>{name(m.s)}</b> <span>{verb(m)}</span>
              <span className="rp-tiles">
                {m.k === 'draw' && m.from === 'deck' ? <span className="tile sm rp-back" /> : tilesOf(m).map((t) => <Tile key={t} id={t} ctx={ctx} small />)}
              </span>
            </li>
          ))}
        </ol>
        {current && (
          <div className="rp-stage" key={step}>
            <b>{name(current.s)}</b> {verb(current)}
          </div>
        )}
        {done && replay.melds.length > 0 && (
          <div className="rp-melds">
            <h3>{winner}'in açtığı eli</h3>
            <div className="rp-meld-row">
              {replay.melds.slice(0, melds).map((m) => (
                <div key={m.id} className={`rp-meld ${m.kind}`}>
                  {m.tiles.map((t) => (
                    <Tile key={t} id={t} ctx={ctx} small />
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
