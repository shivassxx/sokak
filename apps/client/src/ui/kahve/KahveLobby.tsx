import { useEffect, useState } from 'react';
import type { SalonInfo } from '@sokak/shared';
import { listSalons, type KahveJoin } from '../../net/connection';
import type { Prefs } from '../prefs';

interface Props {
  prefs: Prefs;
  busy: boolean;
  error: string | null;
  onJoin: (how: KahveJoin) => void;
  onBack: () => void;
}

/** Online-okey style lobby: salons in Üsküdar, quick play, new (private) salon. */
export function KahveLobby({ prefs, busy, error, onJoin, onBack }: Props) {
  const [salons, setSalons] = useState<SalonInfo[] | null>(null);
  const [offline, setOffline] = useState(false);
  const [priv, setPriv] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = () =>
      listSalons()
        .then((l) => {
          if (!alive) return;
          setSalons(l.sort((a, b) => b.players - a.players));
          setOffline(false);
        })
        .catch(() => alive && setOffline(true));
    void load();
    const iv = setInterval(load, 4000);
    return () => {
      alive = false;
      clearInterval(iv);
    };
  }, []);

  const total = salons?.reduce((s, x) => s + x.players, 0) ?? 0;
  return (
    <div className="lobby-screen">
      <div className="lobby-sky" aria-hidden>
        <svg viewBox="0 0 800 200" preserveAspectRatio="xMidYMax slice">
          <path d="M0 160 L60 150 L120 156 L180 146 L240 152 L300 140 L360 150 L420 144 L480 150 L560 142 L640 152 L720 146 L800 150 L800 200 L0 200 Z" fill="#5b4466" opacity=".8" />
          <g fill="#4a3758">
            <rect x="140" y="118" width="40" height="30" />
            <circle cx="160" cy="118" r="18" />
            <rect x="128" y="80" width="4" height="70" />
            <rect x="188" y="80" width="4" height="70" />
            <rect x="300" y="122" width="34" height="24" />
            <circle cx="317" cy="122" r="15" />
            <rect x="292" y="86" width="3" height="60" />
            <rect x="340" y="86" width="3" height="60" />
            <rect x="620" y="96" width="10" height="54" />
            <path d="M617 96 L625 78 L633 96 Z" />
          </g>
          <g fill="#f1ebe0">
            <rect x="470" y="128" width="40" height="18" />
            <rect x="500" y="98" width="14" height="36" />
            <path d="M497 98 L507 80 L517 98 Z" fill="#7d8c96" />
          </g>
          <rect x="0" y="160" width="800" height="40" fill="#27596a" />
        </svg>
      </div>
      <div className="lobby-card">
        <div className="lobby-head">
          <button className="btn small" onClick={onBack}>
            ← Geri
          </button>
          <div>
            <h1>101 Okey · Üsküdar</h1>
            <p className="hint">
              Merhaba <b>{prefs.name.trim() || 'misafir'}</b> · Şu an {total} kişi çay içip okey oynuyor
            </p>
          </div>
        </div>
        <div className="lobby-actions">
          <button className="btn big primary" disabled={busy} onClick={() => onJoin({ quick: true })}>
            ⚡ Hızlı oyna
            <small>Seni boş bir masaya oturtur</small>
          </button>
          <div className="lobby-new">
            <button className="btn" disabled={busy} onClick={() => onJoin({ create: true, private: priv })}>
              + Yeni salon aç
            </button>
            <label className="check">
              <input type="checkbox" checked={priv} onChange={(e) => setPriv(e.target.checked)} /> Özel (sadece davet linkiyle)
            </label>
          </div>
        </div>
        <h2 className="lobby-sub">Salonlar</h2>
        {offline && <p className="error">Sunucuya ulaşılamadı. Biraz sonra tekrar dene.</p>}
        {!offline && salons && salons.length === 0 && <p className="hint">Henüz açık salon yok. Hızlı oyna ya da yeni salon aç, ilk sen gel!</p>}
        <ul className="salons">
          {(salons ?? []).map((s) => (
            <li key={s.roomId}>
              <div>
                <b>{s.name}</b>
                <span className="muted">
                  👥 {s.players}/{s.max} · 🃏 {s.playing} masada oyun · ⏳ {s.waiting} masa oyuncu bekliyor
                </span>
              </div>
              <button className="btn small primary" disabled={busy || s.players >= s.max} onClick={() => onJoin({ roomId: s.roomId })}>
                Gir
              </button>
            </li>
          ))}
        </ul>
        {error && <div className="error">{error}</div>}
        <p className="fineprint">Para tamamen sanal, oyun içidir. Hesap yok: bakiyen bu cihazda saklanır, her gün ilk girişte 250 ₺ bonus.</p>
      </div>
    </div>
  );
}
