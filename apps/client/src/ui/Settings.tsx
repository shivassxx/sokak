import { useEffect, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import {
  SETTING_LABEL,
  currentTier,
  fpsVisible,
  measuredFps,
  onQualityChange,
  qualitySetting,
  setFpsVisible,
  setQualitySetting,
  type QualitySetting,
} from '../game/quality';
import { getVolume, play, setVolume } from '../game/audio';

const SETTINGS: readonly QualitySetting[] = ['auto', 'low', 'medium', 'high'];
const HELP: Record<QualitySetting, string> = {
  auto: 'Cihazına göre seçer, takılırsa kendiliğinden düşürür.',
  low: 'Gölge ve efekt yok. Eski telefonlar için.',
  medium: 'Gölgeler ve ışık parlaması. Çoğu telefon için.',
  high: 'Yumuşak gölgeler, ortam gölgesi, en güzel görüntü.',
};

/** Re-renders when the quality store changes (preset, Otomatik's pick, fps toggle). */
function useQuality() {
  const version = useSyncExternalStore(subscribe, getVersion);
  return { version, setting: qualitySetting(), showFps: fpsVisible() };
}
let version = 0;
onQualityChange(() => version++);
const subscribe = (cb: () => void) => onQualityChange(cb);
const getVersion = () => version;

/** Small live fps readout ("FPS göster"). */
function FpsCounter() {
  const [fps, setFps] = useState(0);
  useQuality();
  const tier = currentTier();
  useEffect(() => {
    const id = setInterval(() => setFps(measuredFps()), 500);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="fps-counter" aria-live="off">
      {fps ? Math.round(fps) : '–'} fps · {SETTING_LABEL[tier]}
    </div>
  );
}

function SettingsPanel({ inGame, onClose }: { inGame: boolean; onClose: () => void }) {
  const { setting, showFps } = useQuality();
  const [vol, setVol] = useState(getVolume);
  return (
    <div className="panel settings-panel" role="dialog" aria-label="Ayarlar" onPointerDown={(e) => e.stopPropagation()}>
      <div className="panel-head">
        <h2>Ayarlar</h2>
        <button className="btn small" aria-label="Kapat" onClick={onClose}>
          ✕
        </button>
      </div>
      <div className="field">
        <span>Grafik kalitesi</span>
        <div className="chips quality-chips">
          {SETTINGS.map((s) => (
            <button
              key={s}
              className={`chip ${setting === s ? 'on' : ''}`}
              onClick={() => {
                setQualitySetting(s);
                play('click');
              }}
            >
              {SETTING_LABEL[s]}
            </button>
          ))}
        </div>
        <small className="settings-help">
          {HELP[setting]}
          {setting === 'auto' && inGame && (
            <>
              {' '}
              Şu an: <b>{SETTING_LABEL[currentTier()]}</b>.
            </>
          )}
        </small>
        {inGame && <small className="settings-help">Bitki, lamba ve avatar ayrıntısı bir sonraki girişte değişir.</small>}
      </div>
      <label className="settings-row">
        <input type="checkbox" checked={showFps} onChange={(e) => setFpsVisible(e.target.checked)} />
        <span>FPS göster</span>
      </label>
      <label className="field">
        <span>Ses düzeyi · %{Math.round(vol * 100)}</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={vol}
          onChange={(e) => {
            const v = Number(e.target.value);
            setVol(v);
            setVolume(v);
          }}
        />
      </label>
    </div>
  );
}

/** ⚙️ "Ayarlar" button with its panel: graphics quality, fps counter, sound volume. */
export function SettingsButton({ inGame = false }: { inGame?: boolean }) {
  const [open, setOpen] = useState(false);
  const { showFps } = useQuality();
  return (
    <>
      <button className={`btn small settings-btn ${open ? 'on' : ''}`} title="Ayarlar" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        ⚙️<span className="lbl"> Ayarlar</span>
      </button>
      {/* on body: the HUD row is its own stacking context, so side panels would cover the panel */}
      {open && createPortal(<SettingsPanel inGame={inGame} onClose={() => setOpen(false)} />, document.body)}
      {showFps && inGame && <FpsCounter />}
    </>
  );
}
