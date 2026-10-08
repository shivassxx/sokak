import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { AVATARS, NAME_MAX, wearToggle } from '@sokak/shared';
import { loadPrefs, savePrefs, type Prefs } from './prefs';
import type { CharacterPreview } from '../game/preview';
import { play } from '../game/audio';
import { SettingsButton } from './Settings';
import { getAccessories } from '../net/connection';

// the wardrobe (and its 3D try-on) is only downloaded when opened
const Wardrobe = lazy(() => import('./Wardrobe').then((m) => ({ default: m.Wardrobe })));

interface Props {
  /** opened from a friend's salon link */
  invite: boolean;
  busy: boolean;
  error: string | null;
  onStart: (p: Prefs) => void;
}

/** Live 3D turntable of the player's character (loaded lazily after the page shows). */
function Preview({ prefs }: { prefs: Prefs }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const preview = useRef<CharacterPreview | null>(null);
  const latest = useRef(prefs);
  latest.current = prefs;
  useEffect(() => {
    let cancelled = false;
    void import('../game/preview').then(async ({ CharacterPreview, loadCharacterKit }) => {
      await loadCharacterKit();
      if (cancelled || !ref.current) return;
      preview.current = new CharacterPreview(ref.current, latest.current);
      void preview.current.setLook(latest.current);
    });
    return () => {
      cancelled = true;
      preview.current?.dispose();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    void preview.current?.setLook(prefs);
  }, [prefs.avatar, prefs.acc]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="card preview-card">
      <canvas ref={ref} />
      <div className="preview-name">{prefs.name.trim() || 'Sen'}</div>
    </div>
  );
}

export function Home({ invite, busy, error, onStart }: Props) {
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs);
  const update = (p: Partial<Prefs>) => {
    const next = { ...prefs, ...p };
    setPrefs(next);
    savePrefs(next);
    play('click');
  };
  const go = () => onStart(prefs);
  // 👒 dolap: owned items come from the device wallet; what to wear goes along in the join look
  const [wardrobe, setWardrobe] = useState<{ owned: number; wear: number; money: number } | null>(null);
  const openWardrobe = () => {
    play('click');
    getAccessories()
      .then((w) => {
        setWardrobe(w);
        if (prefs.acc === undefined) update({ acc: w.wear });
      })
      .catch(() => setWardrobe({ owned: 0, wear: 0, money: 0 }));
  };
  return (
    <div className="home">
      <div className="home-settings">
        <SettingsButton />
      </div>
      <h1 className="logo">
        SOKAK<span>OYUNLARI</span>
      </h1>
      <p className="tagline">{invite ? 'Arkadaşların kahvehanede, okey masası seni bekliyor!' : '101 Okey · Üsküdar’da bir kıraathane, çaylar bizden'}</p>
      <div className="home-main">
        <Preview prefs={prefs} />
        <div className="card">
          <label className="field">
            <span>Takma adın</span>
            <input
              value={prefs.name}
              maxLength={NAME_MAX}
              placeholder="ör. Afacan Ali"
              onChange={(e) => {
                const next = { ...prefs, name: e.target.value };
                setPrefs(next);
                savePrefs(next);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !busy) go();
              }}
            />
          </label>
          <div className="field">
            <span>Karakterin</span>
            <div className="avatar-pick">
              <button className="btn small" aria-label="önceki karakter" onClick={() => update({ avatar: (prefs.avatar + AVATARS.length - 1) % AVATARS.length })}>
                ‹
              </button>
              <b>
                {prefs.avatar + 1}/{AVATARS.length} · {AVATARS[prefs.avatar]?.name}
              </b>
              <button className="btn small" aria-label="sonraki karakter" onClick={() => update({ avatar: (prefs.avatar + 1) % AVATARS.length })}>
                ›
              </button>
            </div>
            <div className="chips">
              {AVATARS.map((a, i) => (
                <button key={a.id} className={`chip ${prefs.avatar === i ? 'on' : ''}`} onClick={() => update({ avatar: i })}>
                  {a.name}
                </button>
              ))}
            </div>
            <button className="btn small" style={{ marginTop: 8 }} onClick={openWardrobe}>
              👒 Dolap · aksesuarlar
            </button>
          </div>
          <button className="btn big" disabled={busy} onClick={go}>
            {busy ? 'Bağlanıyor…' : invite ? 'Arkadaşlarının salonuna gir' : 'Lobiye gir'}
          </button>
          {error && <div className="error">{error}</div>}
        </div>
      </div>
      <div className="howto">
        <div>
          <b>1. Salona gir</b>
          <span>Lobiden bir salon seç ya da yeni salon aç. Linki arkadaşlarına gönder, saniyeler içinde yanına gelsinler.</span>
        </div>
        <div>
          <b>2. Masaya otur</b>
          <span>Boş bir masaya otur, bahsi ve el sayısını seç. Eksik yerlere bot çağırabilirsin.</span>
        </div>
        <div>
          <b>3. 101'i aç, eli bitir</b>
          <span>Taşlarını diz, 101'i geçince elini aç, okeyi yerinde kullan. Kazanınca çaylar senden!</span>
        </div>
      </div>
      {wardrobe && (
        <Suspense fallback={null}>
          <Wardrobe
            look={prefs}
            owned={wardrobe.owned}
            worn={(prefs.acc ?? wardrobe.wear) & wardrobe.owned}
            money={wardrobe.money}
            onWear={(id, on) => update({ acc: wearToggle((prefs.acc ?? wardrobe.wear) & wardrobe.owned, id, on) })}
            onClose={() => setWardrobe(null)}
          />
        </Suspense>
      )}
      <p className="fineprint">Hesap yok, kayıt yok. Sadece bir takma ad. Oyun parası gerçek değildir. Telefonda ve bilgisayarda oynanır.</p>
      <a className="staff-link" href="/admin">
        Yetkili girişi
      </a>
    </div>
  );
}
