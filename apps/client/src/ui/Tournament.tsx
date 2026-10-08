import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Room } from 'colyseus.js';
import { KMSG, TOUR_FEES, TOUR_HANDS, TOUR_SIZE, tourPrizes, type TourTableView, type TourView } from '@sokak/shared';
import './achievements.css';
import './tournament.css';

const tl = (n: number) => `${n.toLocaleString('tr-TR')} ₺`;

function TableCard({ title, t }: { title: string; t: TourTableView }) {
  const order = t.totals ? t.players.map((p, s) => ({ p, s, total: t.totals![s]! })).sort((a, b) => a.total - b.total || a.s - b.s) : t.players.map((p, s) => ({ p, s, total: null as number | null }));
  return (
    <div className="tour-table">
      <h4>
        {title} · {t.table + 1}. masa {t.totals ? '· bitti' : '· oynanıyor'}
      </h4>
      <ol>
        {order.map(({ p, total }, i) => (
          <li key={p.id} className={t.totals && i < 2 ? 'up' : ''}>
            <b>{p.name}</b>
            {total !== null && <span className="tour-pts">{total}</span>}
          </li>
        ))}
      </ol>
    </div>
  );
}

/** 🎯 Turnuva: open one, join, start (host); the bracket while it runs; the podium at the end. */
export function TourPanel({ room, view, me, money, onClose }: { room: Room; view: TourView | null; me: string; money: number; onClose: () => void }) {
  const [fee, setFee] = useState<number>(100);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  const v = view;
  const phase = v?.phase ?? 'idle';
  const joined = !!v?.entrants.some((e) => e.id === me);
  const host = v?.host === me;
  return createPortal(
    <div className="ach-overlay" onClick={onClose}>
      <div className="ach-panel tour-panel" role="dialog" aria-label="Turnuva" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
        <div className="ach-head">
          <h2>🎯 Okey turnuvası</h2>
          <button className="btn small" onClick={onClose}>
            Kapat
          </button>
        </div>
        <p className="hint">
          {TOUR_SIZE} kişi, iki yarı final masası ({TOUR_HANDS.semi} el), her masanın en iyi ikisi finale ({TOUR_HANDS.final} el). Ödül havuzu oyuncuların giriş ücretlerinden oluşur: 1. %50, 2. %30, 3. %20. Boş yerlere bot oturur, botlar ücret ödemez, ödül de almaz.
        </p>

        {(phase === 'idle' || phase === 'done') && (
          <section className="tour-open">
            <h3>Yeni turnuva aç</h3>
            <div className="tour-fees" role="radiogroup" aria-label="Giriş ücreti">
              {TOUR_FEES.map((f) => (
                <button key={f} role="radio" aria-checked={fee === f} className={`chip ${fee === f ? 'on' : ''}`} onClick={() => setFee(f)}>
                  {f ? tl(f) : 'Ücretsiz'}
                </button>
              ))}
            </div>
            <button className="btn primary" disabled={money < fee} onClick={() => room.send(KMSG.tourOpen, { fee })}>
              Turnuva aç ve katıl
            </button>
          </section>
        )}

        {phase === 'open' && v && (
          <section>
            <h3>
              Kayıtlar ({v.entrants.length}/{TOUR_SIZE}) · giriş {v.fee ? tl(v.fee) : 'ücretsiz'} · havuz {tl(v.pool)}
            </h3>
            <ul className="fr-list">
              {v.entrants.map((e) => (
                <li key={e.id}>
                  <b>{e.name}</b>
                  {e.id === v.host && <small>Turnuvayı açan</small>}
                </li>
              ))}
            </ul>
            <div className="tour-actions">
              {!joined && (
                <button className="btn primary" disabled={money < v.fee || v.entrants.length >= TOUR_SIZE} onClick={() => room.send(KMSG.tourJoin)}>
                  Katıl ({v.fee ? tl(v.fee) : 'ücretsiz'})
                </button>
              )}
              {joined && (
                <button className="btn" onClick={() => room.send(KMSG.tourLeave)}>
                  Ayrıl (ücret iade)
                </button>
              )}
              {host && (
                <button className="btn primary" onClick={() => room.send(KMSG.tourStart)}>
                  Başlat{v.entrants.length < TOUR_SIZE ? ` (${TOUR_SIZE - v.entrants.length} bot)` : ''}
                </button>
              )}
            </div>
            {!host && <p className="hint">Turnuvayı açan kişi başlatınca masalara otomatik oturtulursun.</p>}
            {v.pool > 0 && (
              <p className="hint">
                Şu anki ödüller: {tourPrizes(v.pool).map((p, i) => `${i + 1}. ${tl(p)}`).join(' · ')}
              </p>
            )}
          </section>
        )}

        {(phase === 'semis' || phase === 'final' || phase === 'done') && v && v.semis.length > 0 && (
          <section>
            <h3>Yarı finaller</h3>
            <div className="tour-grid">
              {v.semis.map((t, k) => (
                <TableCard key={t.table} title={`${k + 1}. yarı final`} t={t} />
              ))}
            </div>
            {phase === 'semis' && v.semis.every((t) => t.totals) && <p className="hint">Final birazdan başlıyor…</p>}
          </section>
        )}
        {v?.final && (
          <section>
            <h3>Final</h3>
            <TableCard title="Final" t={v.final} />
          </section>
        )}
        {phase === 'done' && v && (
          <section>
            <h3>🏆 Sonuç</h3>
            <ol className="tour-podium">
              {v.podium.map((p, i) => (
                <li key={i} className={`p${i + 1}`}>
                  <span className="medal">{['🥇', '🥈', '🥉', '4.'][i]}</span>
                  <b>{p.name}</b>
                  <span>{p.prize ? `+${tl(p.prize)}` : p.bot && i < 3 ? 'ödül bota kaldı' : ''}</span>
                </li>
              ))}
            </ol>
          </section>
        )}
      </div>
    </div>,
    document.body,
  );
}

/** In-game: the HUD button (with the number of entrants while it is open) and the panel. */
export function TourHud({ room, json, me, money }: { room: Room; json: string; me: string; money: number }) {
  const [open, setOpen] = useState(false);
  let v: TourView | null = null;
  try {
    v = json ? (JSON.parse(json) as TourView) : null;
  } catch {
    v = null;
  }
  const live = v && (v.phase === 'open' || v.phase === 'semis' || v.phase === 'final');
  return (
    <>
      <button className={`btn small ${live ? 'glow' : ''}`} title="Turnuva" onClick={() => setOpen((o) => !o)}>
        🎯<span className="lbl"> Turnuva</span>
        {v?.phase === 'open' && (
          <b className="count">
            {' '}
            {v.entrants.length}/{TOUR_SIZE}
          </b>
        )}
      </button>
      {open && <TourPanel room={room} view={v} me={me} money={money} onClose={() => setOpen(false)} />}
    </>
  );
}
