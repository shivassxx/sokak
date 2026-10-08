import { useEffect, useRef, useState } from 'react';
import { ACCESSORIES, ACC_SLOTS, accIndex, achievementById, wearToggle, type Look } from '@sokak/shared';
import type { CharacterPreview } from '../game/preview';
import { play } from '../game/audio';
import './wardrobe.css';

interface Props {
  look: Look;
  /** bitmasks over ACCESSORIES */
  owned: number;
  worn: number;
  /** play money in the pocket (null = unknown) */
  money: number | null;
  onWear: (id: string, on: boolean) => void;
  /** buy (in the kahvehane); without it items can only be tried on */
  onBuy?: (id: string) => void;
  onClose: () => void;
}

const has = (mask: number, id: string) => (mask & (1 << accIndex(id))) !== 0;

/** Bust-framed live preview of the look with the tried-on set. */
function TryOn({ look }: { look: Look }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const preview = useRef<CharacterPreview | null>(null);
  const latest = useRef(look);
  latest.current = look;
  useEffect(() => {
    let cancelled = false;
    void import('../game/preview').then(async ({ CharacterPreview, loadCharacterKit }) => {
      await loadCharacterKit();
      if (cancelled || !ref.current) return;
      preview.current = new CharacterPreview(ref.current, latest.current, true);
      void preview.current.setLook(latest.current);
    });
    return () => {
      cancelled = true;
      preview.current?.dispose();
    };
  }, []);
  useEffect(() => {
    void preview.current?.setLook(look, false);
  }, [look]);
  return <canvas ref={ref} className="wardrobe-preview" />;
}

/**
 * 👒 Dolap: try accessories on, buy them with play money (never real money) and
 * put them on or take them off. At most one item per slot.
 */
export function Wardrobe({ look, owned, worn, money, onWear, onBuy, onClose }: Props) {
  const [trial, setTrial] = useState(worn);
  useEffect(() => setTrial(worn), [worn]);
  const [tryLook, setTryLook] = useState<Look>({ ...look, acc: worn });
  useEffect(() => setTryLook({ ...look, acc: trial }), [trial, look.avatar]); // eslint-disable-line react-hooks/exhaustive-deps
  const tryOn = (id: string) => {
    setTrial((t) => wearToggle(t, id, !has(t, id)));
    play('click');
  };
  return (
    <div className="wardrobe-overlay" onClick={onClose}>
      <div className="wardrobe" onClick={(e) => e.stopPropagation()}>
        <div className="wardrobe-head">
          <h2>👒 Dolap</h2>
          {money !== null && <span className="wallet">💰 {money.toLocaleString('tr-TR')} ₺</span>}
          <button className="btn small" onClick={onClose}>
            Kapat
          </button>
        </div>
        <div className="wardrobe-body">
          <TryOn look={tryLook} />
          <div className="wardrobe-list">
            {ACC_SLOTS.map((slot) => (
              <div key={slot.id} className="wardrobe-slot">
                <h3>{slot.name}</h3>
                {ACCESSORIES.filter((a) => a.slot === slot.id).map((a) => {
                  const mine = has(owned, a.id);
                  const on = has(worn, a.id);
                  const trying = has(trial, a.id) && !on;
                  const ach = a.ach ? achievementById(a.ach) : undefined;
                  return (
                    <div key={a.id} className={`acc-row ${on ? 'on' : ''} ${trying ? 'trying' : ''}`}>
                      <button className="acc-try" onClick={() => tryOn(a.id)} title="Dene">
                        <span className="emoji">{a.emoji}</span>
                        <span className="acc-name">
                          {a.name}
                          <small>{on ? 'Üstünde' : mine ? 'Senin' : ach ? `🏆 ${ach.title} başarımıyla` : `${a.price.toLocaleString('tr-TR')} ₺`}</small>
                        </span>
                      </button>
                      {mine ? (
                        <button className={`btn small ${on ? '' : 'primary'}`} onClick={() => onWear(a.id, !on)}>
                          {on ? 'Çıkar' : 'Tak'}
                        </button>
                      ) : ach ? (
                        <span className="acc-lock">🔒</span>
                      ) : onBuy ? (
                        <button className="btn small primary" disabled={money !== null && money < a.price} onClick={() => onBuy(a.id)}>
                          Al
                        </button>
                      ) : (
                        <span className="acc-lock">🛍️</span>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
        <p className="hint">
          Bir şeye dokun, üstünde dene. {onBuy ? 'Oyun parasıyla alınır; gerçek parayla satılmaz.' : 'Satın almak için kahvehanede 👒 Dolap’ı aç (oyun parasıyla, gerçek parayla satılmaz).'} Her yere (baş, göz, yüz, boyun, el) bir tane takılır.
        </p>
      </div>
    </div>
  );
}
