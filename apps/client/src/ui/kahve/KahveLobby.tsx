import { Suspense, lazy, useEffect, useState, type CSSProperties } from 'react';
import { START_MONEY, levelOf, levelTitle, type LeaderInfo, type SalonInfo, type WeeklyBoard, type WeeklyLeader } from '@sokak/shared';
import { getAchievements, getWallet, getWeeklyLeaders, listLeaders, listSalons, type KahveJoin } from '../../net/connection';
import type { Prefs } from '../prefs';

// the başarımlar panel (and its CSS) is only downloaded when opened
const AchievementsPanel = lazy(() => import('../Achievements'));
const FriendsPanel = lazy(() => import('../Friends'));

interface Props {
  prefs: Prefs;
  busy: boolean;
  error: string | null;
  onJoin: (how: KahveJoin) => void;
  onBack: () => void;
}

const tl = (n: number) => `${n.toLocaleString('tr-TR')} ₺`;
/** signed play money: +1.250 ₺ / −300 ₺ */
const signed = (n: number) => (n > 0 ? `+${tl(n)}` : n < 0 ? `−${tl(-n)}` : tl(0));
const netClass = (n: number) => (n > 0 ? 'net up' : n < 0 ? 'net down' : 'net');
/** "5–11 Ekim" (or "29 Eylül – 5 Ekim") from the week's Monday and Sunday */
function weekRange(start: string, end: string): string {
  const d = (s: string) => new Date(`${s}T12:00:00Z`);
  const fmt = (s: string, o: Intl.DateTimeFormatOptions) => d(s).toLocaleDateString('tr-TR', { ...o, timeZone: 'UTC' });
  if (start.slice(0, 7) === end.slice(0, 7)) return `${d(start).getUTCDate()}–${fmt(end, { day: 'numeric', month: 'long' })}`;
  return `${fmt(start, { day: 'numeric', month: 'long' })} – ${fmt(end, { day: 'numeric', month: 'long' })}`;
}

function WeeklyRow({ rank, r, me }: { rank: number; r: WeeklyLeader; me: boolean }) {
  return (
    <li className={me ? 'me' : undefined}>
      <span className="rank">{rank}</span>
      <b>{r.name}</b>
      {me && <span className="you">sen</span>}
      <span className="muted" title={`${r.played} maç`}>
        {r.wins} galibiyet
      </span>
      <span className={netClass(r.net)}>{signed(r.net)}</span>
    </li>
  );
}

/** "Haftanın en iyileri": this week's top 10 by net winnings, your own rank, last week's champion. */
function WeeklyPanel({ board }: { board: WeeklyBoard | null | undefined }) {
  if (board === undefined) return <p className="hint">Yükleniyor…</p>;
  if (board === null) return <p className="hint">Sıralama şu an alınamadı.</p>;
  const me = board.me;
  return (
    <div className="weekly">
      <p className="weekly-info">
        {weekRange(board.start, board.end)} · maçlardan kazanılan net para · Pazartesi sıfırlanır
        {board.champion && (
          <span className="champion">
            👑 Geçen haftanın şampiyonu: <b>{board.champion.name}</b> ({signed(board.champion.net)})
          </span>
        )}
      </p>
      {board.top.length === 0 ? (
        <p className="hint">Bu hafta henüz maç bitmedi, ilk sen ol!</p>
      ) : (
        <ol className="leaders weekly-list" style={{ '--rows': Math.ceil(board.top.length / 2) } as CSSProperties}>
          {board.top.map((r, i) => (
            <WeeklyRow key={`${r.name}-${i}`} rank={i + 1} r={r} me={me?.rank === i + 1} />
          ))}
        </ol>
      )}
      {me && me.rank > board.top.length && (
        <ol className="leaders weekly-list mine">
          <WeeklyRow rank={me.rank} r={me} me />
        </ol>
      )}
    </div>
  );
}

/** Online-okey style lobby: salons in Üsküdar, quick play, new (private) salon. */
export function KahveLobby({ prefs, busy, error, onJoin, onBack }: Props) {
  const [salons, setSalons] = useState<SalonInfo[] | null>(null);
  const [offline, setOffline] = useState(false);
  const [priv, setPriv] = useState(false);
  const [leaders, setLeaders] = useState<LeaderInfo[]>([]);
  const [weekly, setWeekly] = useState<WeeklyBoard | null | undefined>(undefined);
  const [board, setBoard] = useState<'week' | 'rich'>('week');
  const [wallet, setWallet] = useState<{ money: number; played: number; won: number } | null | undefined>(undefined);
  const [achCount, setAchCount] = useState<string | null>(null);
  const [achOpen, setAchOpen] = useState(false);
  const [friendsOpen, setFriendsOpen] = useState(false);
  useEffect(() => {
    getWallet()
      .then(setWallet)
      .catch(() => setWallet(undefined));
    getAchievements()
      .then((s) => setAchCount(s.total ? `${s.got.length}/${s.total}` : null))
      .catch(() => {});
  }, []);

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
    const loadLeaders = () =>
      listLeaders()
        .then((l) => alive && setLeaders(l))
        .catch(() => {});
    const loadWeekly = () =>
      getWeeklyLeaders()
        .then((b) => alive && setWeekly(b))
        .catch(() => alive && setWeekly((w) => w ?? null));
    void load();
    void loadLeaders();
    void loadWeekly();
    const iv2 = setInterval(loadLeaders, 10000);
    const iv3 = setInterval(loadWeekly, 30000);
    const iv = setInterval(load, 4000);
    return () => {
      alive = false;
      clearInterval(iv);
      clearInterval(iv2);
      clearInterval(iv3);
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
            {wallet !== undefined && (
              <p className="me-card">
                {wallet ? (
                  <>
                    💰 <b>{wallet.money.toLocaleString('tr-TR')} ₺</b> · ⭐ <b>Seviye {levelOf(wallet.played, wallet.won)}</b> {levelTitle(levelOf(wallet.played, wallet.won))} · {wallet.played} maç, {wallet.won} galibiyet
                  </>
                ) : (
                  <>🎁 İlk gelişin! Cebine {START_MONEY.toLocaleString('tr-TR')} ₺ koyuyoruz. Maç bitirdikçe seviye atlarsın.</>
                )}
              </p>
            )}
            <button className="btn small" style={{ margin: '6px 0 0 6px', verticalAlign: 'top' }} onClick={() => setAchOpen(true)}>
              🏅 Başarımlar{achCount && <b className="count"> {achCount}</b>}
            </button>
            <button className="btn small" style={{ margin: '6px 0 0 6px', verticalAlign: 'top' }} onClick={() => setFriendsOpen(true)}>
              👥 Arkadaşlar
            </button>
          </div>
        </div>
        {friendsOpen && (
          <Suspense fallback={null}>
            <FriendsPanel onClose={() => setFriendsOpen(false)} />
          </Suspense>
        )}
        {achOpen && (
          <Suspense fallback={null}>
            <AchievementsPanel onClose={() => setAchOpen(false)} />
          </Suspense>
        )}
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
        <div className="board-tabs" role="tablist">
          <button role="tab" aria-selected={board === 'week'} className={board === 'week' ? 'on' : ''} onClick={() => setBoard('week')}>
            🏆 Haftanın en iyileri
          </button>
          <button role="tab" aria-selected={board === 'rich'} className={board === 'rich' ? 'on' : ''} onClick={() => setBoard('rich')}>
            💰 Şu an en zenginler
          </button>
        </div>
        {board === 'week' ? (
          <WeeklyPanel board={weekly} />
        ) : leaders.length > 0 ? (
          <ol className="leaders">
            {leaders.map((l, i) => (
              <li key={`${l.name}-${i}`}>
                <span className="rank">{i + 1}</span>
                <b>{l.name}</b>
                <span className="muted">{l.salon}</span>
                <span className="money">{tl(l.money)}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="hint">Şu an açık salonlarda kimse yok.</p>
        )}
        {error && <div className="error">{error}</div>}
        <p className="fineprint">Para tamamen sanal, oyun içidir. Hesap yok: bakiyen bu cihazda saklanır, her gün ilk girişte 250 ₺ bonus.</p>
      </div>
    </div>
  );
}
