import { useEffect, useState } from 'react';
import type { EventMsg, RoomView, SummaryMsg } from '@sokak/shared';

export interface Toast {
  id: number;
  text: string;
  kind?: 'good' | 'bad' | 'info';
}

export function nameOf(view: RoomView | null, id: string | null | undefined): string {
  if (!id) return '—';
  return view?.players[id]?.name ?? 'biri';
}

export function fmtTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** Turkish text for a rule event (null = no toast). */
export function eventText(view: RoomView | null, e: EventMsg, me: string): Toast | null {
  const n = (id: string) => (id === me ? 'Sen' : nameOf(view, id));
  switch (e.type) {
    case 'ebeChosen':
      if (e.reason === 'firstCaught') return { id: 0, text: `${n(e.id)} ilk sobelendi, şimdi ebe ${e.id === me ? 'sensin' : 'o'}!`, kind: 'info' };
      if (e.reason === 'sameEbe') return { id: 0, text: `${n(e.id)} yine ebe!`, kind: 'info' };
      return { id: 0, text: `Ebe: ${n(e.id)}!`, kind: 'info' };
    case 'spotted':
      return { id: 0, text: `👀 Ebe ${e.id === me ? 'seni' : nameOf(view, e.id) + '’i'} gördü! Duvara yarış!`, kind: 'bad' };
    case 'caught':
      return { id: 0, text: `🧱 ${n(e.id)} sobelendi!`, kind: 'bad' };
    case 'safe':
      return e.how === 'base' ? { id: 0, text: `✋ ${n(e.id)} kurtuldu!`, kind: 'good' } : null;
    default:
      return null;
  }
}

interface HudProps {
  view: RoomView;
  me: string;
  toasts: Toast[];
  banner: string | null;
  countingTotal: number;
}

export function Hud({ view, me, toasts, banner, countingTotal }: HudProps) {
  const p = view.players[me];
  const isEbe = view.ebeId === me;
  const phase = view.phase;
  let center: string | null = null;
  if (phase === 'ebeSelection') center = 'Ebe seçiliyor…';
  else if (phase === 'counting') center = isEbe ? null : `Ebe sayıyor… ${view.timeLeft} — hemen saklan!`;
  else if (phase === 'seeking') center = fmtTime(view.timeLeft);
  else if (phase === 'roundEnd') center = `Yeni el ${view.timeLeft} sn sonra`;

  let roleText: string | null = null;
  let roleClass = '';
  if (phase === 'seeking' || phase === 'counting') {
    if (isEbe) roleText = phase === 'seeking' ? 'EBE’sin! Birini görünce “Gördüm!” de, sonra duvara koş.' : null;
    else if (p?.role === 'spectator') roleText = 'İzliyorsun — bir sonraki elde oyundasın.';
    else if (p?.status === 'hiding') roleText = phase === 'counting' ? 'Saklan! Çömelmek (C) seni daha zor görünür yapar.' : 'Saklan ya da fırsatını kollayıp Ebe Duvarı’na dokun!';
    else if (p?.status === 'spotted') {
      roleText = 'GÖRÜLDÜN! Ebe’den önce duvara koş!';
      roleClass = 'alert';
    } else if (p?.status === 'caught') roleText = 'Sobelendin! Son kalan arkadaşın herkesi kurtarabilir…';
    else if (p?.status === 'safe') {
      roleText = 'Kurtuldun! 🎉';
      roleClass = 'good';
    }
  }

  return (
    <>
      {center && <div className={`hud-center ${phase === 'seeking' && view.timeLeft <= 20 ? 'hurry' : ''}`}>{center}</div>}
      {roleText && <div className={`hud-role ${roleClass}`}>{roleText}</div>}
      {phase === 'counting' && isEbe && <CountingOverlay timeLeft={view.timeLeft} total={countingTotal} />}
      {banner && <div className="big-banner">{banner}</div>}
      <div className="toasts">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.kind ?? ''}`}>
            {t.text}
          </div>
        ))}
      </div>
    </>
  );
}

function CountingOverlay({ timeLeft, total }: { timeLeft: number; total: number }) {
  const n = Math.max(1, Math.min(total, total - timeLeft + 1));
  return (
    <div className="counting">
      <div className="count-num" key={n}>
        {n}…
      </div>
      <div className="count-sub">Gözlerini kapat, Ebe Duvarı’na dön ve say!</div>
    </div>
  );
}

export function Scoreboard({ view, me, onClose }: { view: RoomView; me: string; onClose?: () => void }) {
  const players = Object.values(view.players).sort((a, b) => b.score - a.score);
  const statusText: Record<string, string> = {
    hiding: 'saklanıyor',
    spotted: 'görüldü!',
    caught: 'sobelendi',
    safe: 'kurtuldu',
    none: '',
  };
  return (
    <div className="panel scoreboard" onClick={onClose}>
      <h2>Skor tablosu</h2>
      <table>
        <tbody>
          {players.map((p, i) => (
            <tr key={p.id} className={p.id === me ? 'me' : ''}>
              <td>{i + 1}.</td>
              <td>
                <span className="dot" style={{ background: p.color }} /> {p.name}
                {p.isBot && <span className="tag bot">bot</span>}
              </td>
              <td className="muted">{p.id === view.ebeId && view.phase !== 'lobby' ? 'ebe' : p.role === 'spectator' ? 'izliyor' : statusText[p.status]}</td>
              <td className="score">{p.score}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SummaryPanel({ view, summary, me }: { view: RoomView; summary: SummaryMsg; me: string }) {
  const n = (id: string | null) => (id === me ? 'Sen' : nameOf(view, id));
  const sec = (ms: number) => `${Math.round(ms / 1000)} sn`;
  const reason =
    summary.reason === 'ebeLeft'
      ? 'Ebe oyundan çıktı, el bitti.'
      : summary.herkesKurtuldu
        ? 'Herkes kurtuldu! Ebe yine sayacak.'
        : summary.reason === 'timeout'
          ? 'Süre doldu! Kalanlar kurtuldu.'
          : 'Herkes bulundu ya da kurtuldu.';
  return (
    <div className="panel summary">
      <h2>{summary.round}. el bitti</h2>
      <p className="hint">{reason}</p>
      <ul className="facts">
        <li>
          <b>İlk sobelenen:</b> {summary.firstCaughtId ? n(summary.firstCaughtId) : 'kimse yakalanmadı'}
        </li>
        {summary.bestHiderId && (
          <li>
            <b>En iyi saklanan:</b> {n(summary.bestHiderId)} — {summary.bestHiderSpot ?? 'gizli bir yer'} ({sec(summary.bestHiderMs)} görünmedi)
          </li>
        )}
        {summary.longestSurvivorId && (
          <li>
            <b>En uzun dayanan:</b> {n(summary.longestSurvivorId)} ({sec(summary.longestSurvivorMs)})
          </li>
        )}
        <li>
          <b>Sıradaki ebe:</b> {summary.nextEbeId ? n(summary.nextEbeId) : 'kura ile seçilecek'}
        </li>
      </ul>
      <Scoreboard view={view} me={me} />
    </div>
  );
}

/** Auto-expiring toast list. */
export function useToasts(): [Toast[], (t: Omit<Toast, 'id'>) => void] {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = (t: Omit<Toast, 'id'>) => {
    const id = Date.now() + Math.random();
    setToasts((l) => [...l.slice(-3), { ...t, id }]);
    setTimeout(() => setToasts((l) => l.filter((x) => x.id !== id)), 3500);
  };
  return [toasts, push];
}

/** Banner that disappears after `ms`. */
export function useBanner(): [string | null, (text: string, ms?: number) => void] {
  const [banner, setBanner] = useState<string | null>(null);
  const [timer, setTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (timer && clearTimeout(timer)), [timer]);
  const show = (text: string, ms = 3500) => {
    setBanner(text);
    setTimer(setTimeout(() => setBanner(null), ms));
  };
  return [banner, show];
}
