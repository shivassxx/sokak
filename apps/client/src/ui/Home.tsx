import { useState } from 'react';
import { NAME_MAX, OUTFIT_COLORS } from '@sokak/shared';
import { loadPrefs, savePrefs, type Prefs } from './prefs';

interface Props {
  inviteRoomId: string | null;
  busy: boolean;
  error: string | null;
  onCreate: (p: Prefs) => void;
  onJoin: (p: Prefs) => void;
  onPractice: () => void;
}

export function Home({ inviteRoomId, busy, error, onCreate, onJoin, onPractice }: Props) {
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs);
  const update = (p: Partial<Prefs>) => {
    const next = { ...prefs, ...p };
    setPrefs(next);
    savePrefs(next);
  };
  return (
    <div className="home">
      <h1 className="logo">
        SOKAK<span>OYUNLARI</span>
      </h1>
      <p className="tagline">{inviteRoomId ? 'Arkadaşların seni Saklambaç’a çağırıyor!' : 'Saklambaç oynayalım mı?'}</p>
      <div className="card">
        <label className="field">
          <span>Takma adın</span>
          <input
            value={prefs.name}
            maxLength={NAME_MAX}
            placeholder="ör. Afacan Ali"
            onChange={(e) => update({ name: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !busy) (inviteRoomId ? onJoin : onCreate)(prefs);
            }}
          />
        </label>
        <div className="field">
          <span>Tişört rengin</span>
          <div className="colors">
            {OUTFIT_COLORS.map((c) => (
              <button
                key={c}
                aria-label={c}
                className={`color ${prefs.color === c ? 'selected' : ''}`}
                style={{ background: c }}
                onClick={() => update({ color: c })}
              />
            ))}
          </div>
        </div>
        {inviteRoomId ? (
          <button className="btn big" disabled={busy} onClick={() => onJoin(prefs)}>
            {busy ? 'Bağlanıyor…' : 'Oyuna katıl'}
          </button>
        ) : (
          <button className="btn big" disabled={busy} onClick={() => onCreate(prefs)}>
            {busy ? 'Oda kuruluyor…' : 'Oda kur'}
          </button>
        )}
        {error && <div className="error">{error}</div>}
        <button className="link" onClick={onPractice}>
          ya da tek başına mahallede dolaş
        </button>
      </div>
      <p className="fineprint">Hesap yok, kayıt yok. Sadece bir takma ad. 3–10 oyuncu, telefonda ve bilgisayarda.</p>
    </div>
  );
}
