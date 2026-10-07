import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Room } from 'colyseus.js';
import { ACHIEVEMENTS, ACH_GROUPS, ACH_MSG, achProgress, achievementById, type AchState, type AchUnlockMsg, type AchievementDef } from '@sokak/shared';
import { getAchievements } from '../net/connection';
import { achievementChime } from '../game/audio';
import './achievements.css';

const tl = (n: number) => `${n.toLocaleString('tr-TR')} ₺`;

/** "🏅 Başarımlar": every achievement, earned ones in gold, locked ones greyed with a progress bar. */
export function AchievementsPanel({ onClose, state: given }: { onClose: () => void; state?: AchState | null }) {
  const [state, setState] = useState<AchState | null | undefined>(given ?? undefined);
  useEffect(() => {
    let alive = true;
    getAchievements()
      .then((s) => alive && setState(s))
      .catch(() => alive && setState((old) => old ?? null));
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  const earned = state ? ACHIEVEMENTS.filter((a) => achProgress(state, a).done).length : 0;
  // a portal: HUD bars and the lobby card form their own stacking / containing blocks
  return createPortal(
    <div className="ach-overlay" onClick={onClose}>
      <div className="ach-panel" role="dialog" aria-label="Başarımlar" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
        <div className="ach-head">
          <h2>
            🏅 Başarımlar <span className="ach-count">{state ? `${earned}/${ACHIEVEMENTS.length}` : ''}</span>
          </h2>
          <button className="btn small" onClick={onClose}>
            Kapat
          </button>
        </div>
        {state === undefined && <p className="hint">Yükleniyor…</p>}
        {state === null && <p className="hint">Başarımlar şu an alınamadı. Biraz sonra tekrar dene.</p>}
        {state &&
          ACH_GROUPS.map((g) => (
            <section key={g.id}>
              <h3>{g.title}</h3>
              <ul className="ach-grid">
                {ACHIEVEMENTS.filter((a) => a.group === g.id)
                  .sort((a, b) => Number(achProgress(state, b).done) - Number(achProgress(state, a).done))
                  .map((a) => {
                    const { n, done } = achProgress(state, a);
                    return (
                      <li key={a.id} className={done ? 'got' : 'locked'} title={a.desc}>
                        <span className="ach-emoji">{a.emoji}</span>
                        <b>{a.title}</b>
                        <small>{a.desc}</small>
                        {a.goal > 1 && !done && (
                          <span className="ach-bar" aria-label={`${n}/${a.goal}`}>
                            <i style={{ width: `${(n / a.goal) * 100}%` }} />
                            <em>
                              {n}/{a.goal}
                            </em>
                          </span>
                        )}
                        <span className="ach-reward">{done ? '✅ Kazanıldı' : `+${tl(a.reward)}`}</span>
                      </li>
                    );
                  })}
              </ul>
            </section>
          ))}
        <p className="hint">Başarımlar bu cihazda saklanır. Her biri bir kez kazanılır, ödülü (sanal oyun parası) hemen cebine girer.</p>
      </div>
    </div>,
    document.body,
  );
}

/** The gold unlock card (stacked one at a time). */
export function AchievementCard({ def, reward }: { def: AchievementDef; reward: number }) {
  return createPortal(
    <div className="ach-toast" role="status">
      <span className="ach-emoji">{def.emoji}</span>
      <div>
        <small>Başarım kazandın!</small>
        <b>{def.title}</b>
        <span>+{tl(reward)}</span>
      </div>
    </div>,
    document.body,
  );
}

/**
 * In-game part: the HUD button (with the earned count), the unlock toasts with a chime,
 * and the panel. Listens to the room's ACH_MSG itself.
 */
export function AchievementsHud({ room }: { room: Room }) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<AchState | null>(null);
  const [queue, setQueue] = useState<AchUnlockMsg[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    getAchievements()
      .then(setState)
      .catch(() => {});
    const off = room.onMessage(ACH_MSG, (m: AchUnlockMsg) => {
      if (!achievementById(m?.id)) return;
      setQueue((q) => [...q, m]);
      setState((s) => (s && !s.got.includes(m.id) ? { ...s, got: [...s.got, m.id] } : s));
    });
    if (import.meta.env.DEV) (window as unknown as { __achTest: (m: AchUnlockMsg) => void }).__achTest = (m) => setQueue((q) => [...q, m]);
    return () => {
      off();
      if (timer.current) clearTimeout(timer.current);
    };
  }, [room]);
  const head = queue[0];
  useEffect(() => {
    if (!head) return;
    achievementChime();
    timer.current = setTimeout(() => setQueue((q) => q.slice(1)), 4500);
  }, [head]);
  const def = head ? achievementById(head.id) : undefined;
  const earned = state ? state.got.filter((id) => achievementById(id)).length : null;
  return (
    <>
      <button className="btn small" title="Başarımlar" onClick={() => setOpen((o) => !o)}>
        🏅<span className="lbl"> Başarımlar</span>
        {earned !== null && (
          <b className="count">
            {' '}
            {earned}/{ACHIEVEMENTS.length}
          </b>
        )}
      </button>
      {def && head && <AchievementCard key={head.id} def={def} reward={head.reward} />}
      {open && <AchievementsPanel state={state} onClose={() => setOpen(false)} />}
    </>
  );
}

export default AchievementsPanel;
