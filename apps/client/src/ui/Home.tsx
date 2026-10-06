import { useEffect, useRef, useState } from 'react';
import { HAIR_NAMES, HAT_NAMES, NAME_MAX, OUTFIT_COLORS, SKINS } from '@sokak/shared';
import { loadPrefs, savePrefs, type Prefs } from './prefs';
import type { CharacterPreview } from '../game/preview';
import { play } from '../game/audio';

export type Mode = 'saklambac' | 'okey';

interface Props {
  invite: { kind: 'oda' | 'kahve'; id: string } | null;
  busy: boolean;
  error: string | null;
  onStart: (mode: Mode, p: Prefs) => void;
  onPractice: () => void;
}

/** Live 3D turntable of the player's kid (loaded lazily after the page shows). */
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
    });
    return () => {
      cancelled = true;
      preview.current?.dispose();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    preview.current?.setLook(prefs);
  }, [prefs.color, prefs.hat, prefs.hair, prefs.skin]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="card preview-card">
      <canvas ref={ref} />
      <div className="preview-name">{prefs.name.trim() || 'Sen'}</div>
    </div>
  );
}

export function Home({ invite, busy, error, onStart, onPractice }: Props) {
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs);
  const update = (p: Partial<Prefs>) => {
    const next = { ...prefs, ...p };
    setPrefs(next);
    savePrefs(next);
    play('click');
  };
  const [mode, setMode] = useState<Mode>(invite?.kind === 'kahve' ? 'okey' : 'saklambac');
  const go = () => onStart(mode, prefs);
  const joining = (mode === 'saklambac' && invite?.kind === 'oda') || (mode === 'okey' && invite?.kind === 'kahve');
  return (
    <div className="home">
      <h1 className="logo">
        SOKAK<span>OYUNLARI</span>
      </h1>
      <p className="tagline">
        {invite?.kind === 'oda' ? 'Arkadaşların seni Saklambaç’a çağırıyor!' : invite?.kind === 'kahve' ? 'Arkadaşların kahvehanede, okey masası seni bekliyor!' : 'Bugün ne oynuyoruz?'}
      </p>
      <div className="modes">
        <button className={`mode ${mode === 'saklambac' ? 'on' : ''}`} onClick={() => setMode('saklambac')}>
          <span className="mode-ico">🙈</span>
          <b>Saklambaç</b>
          <small>Mahallede saklan, Ebe’den kaç</small>
        </button>
        <button className={`mode ${mode === 'okey' ? 'on' : ''}`} onClick={() => setMode('okey')}>
          <span className="mode-ico">🀄</span>
          <b>101 Okey</b>
          <small>Kahvehanede masaya otur, çayları ısmarla</small>
        </button>
      </div>
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
            <span>Tişört</span>
            <div className="colors">
              {OUTFIT_COLORS.map((c) => (
                <button key={c} aria-label={c} className={`color ${prefs.color === c ? 'selected' : ''}`} style={{ background: c }} onClick={() => update({ color: c })} />
              ))}
            </div>
          </div>
          <div className="field">
            <span>Saç</span>
            <div className="chips">
              {HAIR_NAMES.map((h, i) => (
                <button key={h} className={`chip ${prefs.hair === i ? 'on' : ''}`} onClick={() => update({ hair: i })}>
                  {h}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <span>Şapka</span>
            <div className="chips">
              {HAT_NAMES.map((h, i) => (
                <button key={h} className={`chip ${prefs.hat === i ? 'on' : ''}`} onClick={() => update({ hat: i })}>
                  {h}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <span>Ten rengi</span>
            <div className="colors">
              {SKINS.map((s, i) => (
                <button key={s} aria-label={`ten ${i + 1}`} className={`skin ${prefs.skin === i ? 'on' : ''}`} style={{ background: s }} onClick={() => update({ skin: i })} />
              ))}
            </div>
          </div>
          <button className="btn big" disabled={busy} onClick={go}>
            {busy ? 'Bağlanıyor…' : mode === 'okey' ? (joining ? 'Arkadaşlarının kahvesine gir' : 'Kahvehaneye gir') : joining ? 'Oyuna katıl' : 'Oda kur'}
          </button>
          {error && <div className="error">{error}</div>}
          <button className="link" onClick={onPractice}>
            ya da tek başına mahallede dolaş
          </button>
        </div>
      </div>
      <div className="howto">
        <div>
          <b>1. Oda kur</b>
          <span>Linki arkadaşlarına gönder. Tıklayan saniyeler içinde mahallede!</span>
        </div>
        <div>
          <b>2. Saklan</b>
          <span>Ebe 30’a kadar sayarken çalıya, merdiven altına ya da çöp konteynerine gir. Çömel, sessiz ol.</span>
        </div>
        <div>
          <b>3. Sobele ya da kurtul</b>
          <span>Ebe “Gördüm!” der, herkes Ebe Duvarı’na koşar. Taş atıp Ebe’yi kandır, son kalan herkesi kurtarır!</span>
        </div>
      </div>
      <p className="fineprint">Hesap yok, kayıt yok. Sadece bir takma ad. 3–10 oyuncu (boş yerlere bot eklenebilir), telefonda ve bilgisayarda.</p>
    </div>
  );
}
