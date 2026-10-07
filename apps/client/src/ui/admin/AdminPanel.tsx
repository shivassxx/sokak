import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { TV_STREAM_TITLE_MAX, TV_STREAM_URL_MAX, isTvStream, normalizeStreamUrl, type StaffSalonInfo, type TvBroadcast, type TvStreamChannel, type TvStreamType, type TvTeam } from '@sokak/shared';
import { StreamPlayer } from '../StreamPlayer';
import './admin.css';

/**
 * Staff admin panel (/admin): loaded lazily, never part of the lobby bundle.
 * Talks to /api/admin/* on the same origin (Vite proxies it in dev) with an HttpOnly cookie.
 */
type Role = 'owner' | 'admin';
interface Me {
  username: string;
  role: Role;
}
interface UserRow extends Me {
  createdAt: number;
  createdBy: string;
}
interface LogRow {
  t: number;
  by: string;
  action: string;
  detail?: string;
}

class ApiError extends Error {
  constructor(
    readonly status: number,
    msg: string,
  ) {
    super(msg);
  }
}

async function api<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
  let r: Response;
  try {
    r = await fetch(`/api/admin/${path}`, {
      method,
      credentials: 'same-origin',
      headers: body === undefined ? {} : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'Sunucuya ulaşılamadı.');
  }
  const data = (await r.json().catch(() => null)) as { error?: string } | null;
  if (!r.ok) throw new ApiError(r.status, data?.error ?? 'Bir hata oldu.');
  return data as T;
}

const ROLE_TR: Record<Role, string> = { owner: 'Sahip', admin: 'Yönetici' };
const ACTION_TR: Record<string, string> = {
  login: 'Giriş yaptı',
  'tv/start': 'Maç başlattı',
  'tv/stop': 'Maçı bitirdi',
  'users/add': 'Yetkili ekledi',
  'users/remove': 'Yetkili sildi',
  'users/password': 'Şifre değiştirdi',
  'salons/kick': 'Oyuncu çıkardı',
  'salons/close': 'Salon kapattı',
  announce: 'Duyuru yaptı',
  'wallet/grant': 'Para verdi/aldı',
  'channels/add': 'Kanal ekledi',
  'channels/remove': 'Kanal sildi',
};
const TYPE_TR: Record<TvStreamType, string> = { video: 'Video / HLS (TV ekranında oynar)', embed: 'Gömülü oynatıcı (“Maçı izle” penceresinde)' };
type ChannelRow = Pick<TvStreamChannel, 'id' | 'title' | 'type'>;
const time = (t: number) => new Date(t).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

export function AdminPanel() {
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  useEffect(() => {
    document.title = 'Yetkili Paneli · Sokak Oyunları';
    api<Me>('GET', 'me').then(setMe, () => setMe(null));
  }, []);
  const logout = async () => {
    await api('POST', 'logout').catch(() => {});
    setMe(null);
  };
  // any 401 later on (expired / removed) sends the user back to the login form
  const onError = useCallback((e: unknown) => {
    if (e instanceof ApiError && e.status === 401) setMe(null);
  }, []);
  return (
    <div className="admin">
      <header className="admin-top">
        <a className="admin-brand" href="/">
          SOKAK<span>OYUNLARI</span>
        </a>
        <b className="admin-title">Yetkili Paneli</b>
        {me && (
          <div className="admin-who">
            <span className={`role-badge ${me.role}`}>{ROLE_TR[me.role]}</span>
            <span className="admin-name">{me.username}</span>
            <button className="btn small" onClick={() => void logout()}>
              Çıkış
            </button>
          </div>
        )}
      </header>
      {me === undefined ? <div className="admin-wait">Yükleniyor…</div> : me ? <Dashboard me={me} onError={onError} /> : <Login onLogin={setMe} />}
    </div>
  );
}

function Login({ onLogin }: { onLogin: (m: Me) => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      onLogin(await api<Me>('POST', 'login', { username: username.trim().toLowerCase(), password }));
    } catch (x) {
      setErr(x instanceof Error ? x.message : 'Giriş yapılamadı.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <form className="card admin-login" onSubmit={(e) => void submit(e)}>
      <h2>Yetkili girişi</h2>
      <p className="admin-hint">Bu sayfa yalnızca kıraathane yetkilileri içindir. Oyuncuların hesaba ihtiyacı yok.</p>
      <label className="field">
        <span>Kullanıcı adı</span>
        <input value={username} autoComplete="username" autoCapitalize="none" spellCheck={false} maxLength={20} onChange={(e) => setUsername(e.target.value)} />
      </label>
      <label className="field">
        <span>Şifre</span>
        <input type="password" value={password} autoComplete="current-password" onChange={(e) => setPassword(e.target.value)} />
      </label>
      <button className="btn big" disabled={busy || !username || !password}>
        {busy ? 'Giriş yapılıyor…' : 'Giriş yap'}
      </button>
      {err && <div className="error">{err}</div>}
      <a className="link admin-back" href="/">
        ← Oyuna dön
      </a>
    </form>
  );
}

type Tab = 'channels' | 'users' | 'salons' | 'announce' | 'stats' | 'log';
const TABS: { id: Tab; label: string }[] = [
  { id: 'channels', label: 'Kanallar' },
  { id: 'users', label: 'Yetkililer' },
  { id: 'salons', label: 'Salonlar · Para' },
  { id: 'announce', label: 'Duyuru' },
  { id: 'stats', label: 'İstatistik' },
  { id: 'log', label: 'Kayıtlar' },
];

function Dashboard({ me, onError }: { me: Me; onError: (e: unknown) => void }) {
  const [tab, setTab] = useState<Tab>(() => (/^#(channels|users|salons|announce|stats|log)$/.exec(location.hash)?.[1] as Tab) ?? 'users');
  // the TV card reloads its channel list when the owner changes it
  const [channelsRev, setChannelsRev] = useState(0);
  const pick = (t: Tab) => {
    setTab(t);
    history.replaceState(null, '', `#${t}`);
  };
  return (
    <main className="admin-main">
      <TvCard onError={onError} rev={channelsRev} />
      {me.role === 'owner' ? (
        <section className="card admin-owner">
          <nav className="admin-tabs" role="tablist">
            {TABS.map((t) => (
              <button key={t.id} role="tab" aria-selected={tab === t.id} className={`chip ${tab === t.id ? 'on' : ''}`} onClick={() => pick(t.id)}>
                {t.label}
              </button>
            ))}
          </nav>
          {tab === 'channels' && <Channels onError={onError} onChange={() => setChannelsRev((r) => r + 1)} />}
          {tab === 'users' && <Users me={me} onError={onError} />}
          {tab === 'salons' && <Salons onError={onError} />}
          {tab === 'announce' && <Announce onError={onError} />}
          {tab === 'stats' && <Stats onError={onError} />}
          {tab === 'log' && <Log onError={onError} />}
        </section>
      ) : (
        <p className="admin-note">Yönetici olarak kıraathane televizyonunda maç açıp kapatabilirsin. Gerçek yayın kanallarını kıraathane sahibi ekler.</p>
      )}
    </main>
  );
}

/** small helper: a status line under a form */
function useFlash(): [ReactNode, (text: string, bad?: boolean) => void] {
  const [msg, setMsg] = useState<{ text: string; bad: boolean } | null>(null);
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 4000);
    return () => clearTimeout(t);
  }, [msg]);
  return [msg ? <div className={msg.bad ? 'error' : 'admin-ok'}>{msg.text}</div> : null, (text, bad = false) => setMsg({ text, bad })];
}

function useAction(onError: (e: unknown) => void, flash: (t: string, bad?: boolean) => void) {
  return async <T,>(fn: () => Promise<T>, ok?: string): Promise<T | undefined> => {
    try {
      const out = await fn();
      if (ok) flash(ok);
      return out;
    } catch (e) {
      onError(e);
      flash(e instanceof Error ? e.message : 'Bir hata oldu.', true);
      return undefined;
    }
  };
}

// ------------------------------------------------------------------ TV
function TvCard({ onError, rev }: { onError: (e: unknown) => void; rev: number }) {
  const [teams, setTeams] = useState<TvTeam[]>([]);
  const [channels, setChannels] = useState<ChannelRow[] | null>(null);
  const [cur, setCur] = useState<TvBroadcast | null>(null);
  const [mode, setMode] = useState<'stream' | 'sim' | null>(null);
  const [channelId, setChannelId] = useState('');
  const [home, setHome] = useState('');
  const [away, setAway] = useState('');
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [flashEl, flash] = useFlash();
  const run = useAction(onError, flash);
  const load = useCallback(async () => {
    const r = await api<{ current: TvBroadcast | null; teams: TvTeam[]; channels?: ChannelRow[] }>('GET', 'tv').catch((e) => (onError(e), null));
    if (!r) return;
    const chs = r.channels ?? [];
    setTeams(r.teams);
    setChannels(chs);
    setCur(r.current);
    setHome((h) => h || r.teams[0]?.id || '');
    setAway((a) => a || r.teams[1]?.id || '');
    setChannelId((c) => (chs.some((x) => x.id === c) ? c : (chs[0]?.id ?? '')));
    // real streams are the default as soon as the owner has added a channel
    setMode((m) => m ?? (chs.length ? 'stream' : 'sim'));
  }, [onError]);
  useEffect(() => {
    void load();
    const i = setInterval(() => {
      setNow(Date.now());
      void load();
    }, 10000);
    return () => clearInterval(i);
  }, [load, rev]);
  const team = (id: string) => teams.find((t) => t.id === id);
  const start = async () => {
    setBusy(true);
    const r =
      mode === 'stream'
        ? await run(() => api<{ current: TvBroadcast }>('POST', 'tv/start', { channelId }), 'Yayın başladı! Bütün salonlarda televizyonda.')
        : await run(() => api<{ current: TvBroadcast }>('POST', 'tv/start', { home, away }), 'Maç başladı! Bütün salonlarda televizyonda.');
    if (r) setCur(r.current);
    setBusy(false);
  };
  const stop = async () => {
    setBusy(true);
    if (await run(() => api('POST', 'tv/stop'), 'Yayın bitirildi.')) setCur(null);
    setBusy(false);
  };
  const mins = cur ? Math.max(0, Math.floor((now - cur.startedAt) / 60000)) : 0;
  const stream = isTvStream(cur) ? cur : null;
  return (
    <section className="card admin-tv">
      <h2>📺 Kıraathane televizyonu</h2>
      {cur ? (
        <div className="tv-now">
          <span className="tv-live">CANLI</span>
          {stream ? (
            <b className="tv-stream-title">📡 {stream.title}</b>
          ) : (
            <>
              <TeamTag t={team(cur.home)} />
              <b className="tv-vs">–</b>
              <TeamTag t={team(cur.away)} />
            </>
          )}
          <span className="tv-meta">
            {mins} dk önce başladı · {cur.by}
          </span>
        </div>
      ) : (
        <p className="admin-hint">Şu an televizyonda yayın yok.</p>
      )}
      <div className="admin-tabs tv-modes" role="tablist">
        <button role="tab" aria-selected={mode === 'stream'} className={`chip ${mode === 'stream' ? 'on' : ''}`} onClick={() => setMode('stream')}>
          Gerçek yayın (kanal seç)
        </button>
        <button role="tab" aria-selected={mode === 'sim'} className={`chip ${mode === 'sim' ? 'on' : ''}`} onClick={() => setMode('sim')}>
          Simülasyon derbi
        </button>
      </div>
      {mode === 'stream' ? (
        channels && channels.length ? (
          <label className="field">
            <span>Kanal</span>
            <select value={channelId} onChange={(e) => setChannelId(e.target.value)}>
              {channels.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title} · {c.type === 'video' ? 'video' : 'gömülü'}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <p className="admin-hint">Henüz kanal yok. Kanalları kıraathane sahibi “Kanallar” sekmesinden ekler.</p>
        )
      ) : (
        <div className="tv-pick">
          <label className="field">
            <span>Ev sahibi</span>
            <select value={home} onChange={(e) => setHome(e.target.value)}>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Deplasman</span>
            <select value={away} onChange={(e) => setAway(e.target.value)}>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
      <div className="admin-row">
        <button className="btn big" disabled={busy || (mode === 'stream' ? !channelId : !home || !away || home === away)} onClick={() => void start()}>
          {mode === 'stream' ? (cur ? 'Bu yayını aç' : 'Yayını Başlat') : cur ? 'Yeni maç başlat' : 'Maçı Başlat'}
        </button>
        <button className="btn warn" disabled={busy || !cur} onClick={() => void stop()}>
          Yayını Bitir
        </button>
      </div>
      {mode === 'sim' && home && home === away && <div className="error">İki farklı takım seç.</div>}
      {flashEl}
    </section>
  );
}

function TeamTag({ t }: { t?: TvTeam }) {
  if (!t) return <span className="team-tag">?</span>;
  return (
    <span className="team-tag" title={t.name}>
      <i style={{ background: `linear-gradient(90deg, ${t.colors[0]} 50%, ${t.colors[1]} 50%)` }} />
      {t.name}
    </span>
  );
}

// ------------------------------------------------------------------ owner tabs
function Channels({ onError, onChange }: { onError: (e: unknown) => void; onChange: () => void }) {
  const [rows, setRows] = useState<TvStreamChannel[] | null>(null);
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [type, setType] = useState<'auto' | TvStreamType>('auto');
  const [preview, setPreview] = useState<{ url: string; type: TvStreamType; title: string } | null>(null);
  const [flashEl, flash] = useFlash();
  const run = useAction(onError, flash);
  const load = useCallback(() => void api<TvStreamChannel[]>('GET', 'channels').then(setRows, onError), [onError]);
  useEffect(load, [load]);
  const detected = url.trim() ? normalizeStreamUrl(url, type === 'auto' ? undefined : type) : null;
  const add = async (e: FormEvent) => {
    e.preventDefault();
    const r = await run(() => api<TvStreamChannel>('POST', 'channels', { title, url, ...(type === 'auto' ? {} : { type }) }), `${title.trim()} kanalı eklendi.`);
    if (r) {
      setTitle('');
      setUrl('');
      setType('auto');
      load();
      onChange();
    }
  };
  const remove = async (c: TvStreamChannel) => {
    if (!confirm(`“${c.title}” kanalını silmek istiyor musun?`)) return;
    if (await run(() => api('DELETE', `channels/${encodeURIComponent(c.id)}`), `${c.title} silindi.`)) {
      if (preview?.url === c.url) setPreview(null);
      load();
      onChange();
    }
  };
  return (
    <div className="admin-pane">
      <p className="channel-note">Yayın hakkına sahip olduğun ya da herkese açık, gömülmesine izin verilen yayınları ekle.</p>
      <form className="admin-form" onSubmit={(e) => void add(e)}>
        <h3>Kanal ekle</h3>
        <label className="field">
          <span>Başlık</span>
          <input placeholder="ör. Derbi: GS–FB" value={title} maxLength={TV_STREAM_TITLE_MAX} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className="field">
          <span>Yayın adresi (https)</span>
          <input
            placeholder="https://… (.m3u8, .mp4, YouTube ya da gömülü oynatıcı linki)"
            value={url}
            maxLength={TV_STREAM_URL_MAX}
            inputMode="url"
            autoCapitalize="none"
            spellCheck={false}
            onChange={(e) => setUrl(e.target.value)}
          />
        </label>
        <div className="admin-row">
          <label className="field">
            <span>Tür</span>
            <select value={type} onChange={(e) => setType(e.target.value as 'auto' | TvStreamType)}>
              <option value="auto">Otomatik algıla</option>
              <option value="video">Video / HLS</option>
              <option value="embed">Gömülü oynatıcı</option>
            </select>
          </label>
          <div className="channel-detect">
            {!url.trim() ? (
              <small className="admin-hint">Linki yapıştırınca türü burada görünür.</small>
            ) : detected ? (
              <>
                <span className={`type-badge ${detected.type}`}>{TYPE_TR[detected.type]}</span>
                {detected.url !== url.trim() && <small className="admin-hint">Kaydedilecek adres: {detected.url}</small>}
              </>
            ) : (
              <span className="error">Geçersiz adres: yalnızca https:// linkleri (en fazla {TV_STREAM_URL_MAX} karakter).</span>
            )}
          </div>
        </div>
        <div className="admin-row">
          <button type="button" className="btn" disabled={!detected} onClick={() => detected && setPreview({ ...detected, title: title.trim() || 'Önizleme' })}>
            Test et
          </button>
          <button className="btn primary" disabled={!detected || !title.trim()}>
            Kanalı ekle
          </button>
        </div>
      </form>
      {flashEl}
      {preview && (
        <div className="channel-preview">
          <div className="admin-row">
            <b>Önizleme: {preview.title}</b>
            <button className="btn small" onClick={() => setPreview(null)}>
              Kapat
            </button>
          </div>
          <StreamPlayer url={preview.url} type={preview.type} />
          <small className="admin-hint">Görüntü burada açılıyorsa oyunda da açılır. Video türü yayınlar TV ekranında, gömülü olanlar “Maçı izle” penceresinde oynar.</small>
        </div>
      )}
      {!rows ? (
        <div className="admin-hint">Yükleniyor…</div>
      ) : !rows.length ? (
        <p className="admin-hint">Henüz kanal yok.</p>
      ) : (
        <ul className="admin-list">
          {rows.map((c) => (
            <li key={c.id}>
              <div>
                <b>{c.title}</b> <span className={`type-badge ${c.type}`}>{c.type === 'video' ? 'Video' : 'Gömülü'}</span>
                <small className="channel-url">{c.url}</small>
                <small>
                  {time(c.createdAt)} · ekleyen: {c.createdBy}
                </small>
              </div>
              <div className="admin-row">
                <button className="btn small" onClick={() => setPreview({ url: c.url, type: c.type, title: c.title })}>
                  Test et
                </button>
                <button className="btn small warn" onClick={() => void remove(c)}>
                  Sil
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Users({ me, onError }: { me: Me; onError: (e: unknown) => void }) {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [name, setName] = useState('');
  const [pw, setPw] = useState('');
  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [flashEl, flash] = useFlash();
  const run = useAction(onError, flash);
  const load = useCallback(() => void api<UserRow[]>('GET', 'users').then(setUsers, onError), [onError]);
  useEffect(load, [load]);
  const add = async (e: FormEvent) => {
    e.preventDefault();
    if (await run(() => api('POST', 'users', { username: name.trim().toLowerCase(), password: pw }), `${name} yönetici olarak eklendi.`)) {
      setName('');
      setPw('');
      load();
    }
  };
  const remove = async (u: string) => {
    if (!confirm(`${u} yetkisini kaldırmak istiyor musun?`)) return;
    if (await run(() => api('DELETE', `users/${encodeURIComponent(u)}`), `${u} kaldırıldı.`)) load();
  };
  const reset = async (u: string) => {
    const p = prompt(`${u} için yeni şifre (en az 8 karakter):`);
    if (p) await run(() => api('POST', `users/${encodeURIComponent(u)}/password`, { password: p }), `${u} şifresi değişti.`);
  };
  const changeMine = async (e: FormEvent) => {
    e.preventDefault();
    if (await run(() => api('POST', `users/${encodeURIComponent(me.username)}/password`, { oldPassword: oldPw, password: newPw }), 'Şifren değişti.')) {
      setOldPw('');
      setNewPw('');
    }
  };
  return (
    <div className="admin-pane">
      <ul className="admin-list">
        {users.map((u) => (
          <li key={u.username}>
            <div>
              <b>{u.username}</b> <span className={`role-badge ${u.role}`}>{ROLE_TR[u.role]}</span>
              <small>
                {time(u.createdAt)} · ekleyen: {u.createdBy}
              </small>
            </div>
            {u.role !== 'owner' && (
              <div className="admin-row">
                <button className="btn small" onClick={() => void reset(u.username)}>
                  Şifre sıfırla
                </button>
                <button className="btn small warn" onClick={() => void remove(u.username)}>
                  Kaldır
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
      <form className="admin-form" onSubmit={(e) => void add(e)}>
        <h3>Yönetici ekle</h3>
        <p className="admin-hint">Yöneticiler yalnızca televizyonda maç açıp kapatabilir.</p>
        <div className="admin-row">
          <input placeholder="kullanici_adi" value={name} maxLength={20} autoCapitalize="none" spellCheck={false} onChange={(e) => setName(e.target.value)} />
          <input placeholder="şifre (en az 8)" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
          <button className="btn primary" disabled={!name || pw.length < 8}>
            Ekle
          </button>
        </div>
      </form>
      <form className="admin-form" onSubmit={(e) => void changeMine(e)}>
        <h3>Şifremi değiştir</h3>
        <div className="admin-row">
          <input placeholder="eski şifre" type="password" autoComplete="current-password" value={oldPw} onChange={(e) => setOldPw(e.target.value)} />
          <input placeholder="yeni şifre (en az 8)" type="password" autoComplete="new-password" value={newPw} onChange={(e) => setNewPw(e.target.value)} />
          <button className="btn" disabled={!oldPw || newPw.length < 8}>
            Değiştir
          </button>
        </div>
      </form>
      {flashEl}
    </div>
  );
}

function Salons({ onError }: { onError: (e: unknown) => void }) {
  const [salons, setSalons] = useState<StaffSalonInfo[] | null>(null);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [flashEl, flash] = useFlash();
  const run = useAction(onError, flash);
  const load = useCallback(() => void api<StaffSalonInfo[]>('GET', 'salons').then(setSalons, onError), [onError]);
  useEffect(() => {
    load();
    const i = setInterval(load, 8000);
    return () => clearInterval(i);
  }, [load]);
  const kick = async (s: StaffSalonInfo, sid: string, name: string) => {
    if (!confirm(`${name} adlı oyuncuyu ${s.name} salonundan çıkarmak istiyor musun?`)) return;
    if (await run(() => api('POST', `salons/${s.roomId}/kick`, { sessionId: sid }), `${name} salondan çıkarıldı.`)) load();
  };
  const close = async (s: StaffSalonInfo) => {
    if (!confirm(`${s.name} salonunu kapatmak istiyor musun? İçerideki herkes lobiye döner.`)) return;
    if (await run(() => api('POST', `salons/${s.roomId}/close`), `${s.name} kapatıldı.`)) setTimeout(load, 500);
  };
  const grant = async (s: StaffSalonInfo, sid: string, name: string) => {
    const amount = Number(amounts[sid]);
    if (!Number.isFinite(amount) || !amount) return flash('Bir miktar yaz (eksi değer para alır).', true);
    const r = await run(() => api<{ money: number; amount: number }>('POST', 'wallet/grant', { roomId: s.roomId, sessionId: sid, amount }));
    if (r) {
      flash(`${name}: ${r.amount > 0 ? '+' : ''}${r.amount} ₺ → bakiye ${r.money} ₺`);
      setAmounts((a) => ({ ...a, [sid]: '' }));
      load();
    }
  };
  if (!salons) return <div className="admin-hint">Yükleniyor…</div>;
  return (
    <div className="admin-pane">
      <p className="admin-hint">Oyun parası gerçek değildir, satılmaz. Eksi miktar para alır (en fazla ±100.000 ₺).</p>
      {flashEl}
      {!salons.length && <p className="admin-hint">Şu an açık salon yok.</p>}
      {salons.map((s) => {
        const humans = s.players.filter((p) => !p.isBot);
        return (
          <div className="salon-box" key={s.roomId}>
            <div className="salon-head">
              <b>{s.name}</b>
              {s.private && <span className="role-badge admin">Özel</span>}
              <small>
                {humans.length} oyuncu{s.players.length > humans.length ? ` · ${s.players.length - humans.length} bot` : ''}
              </small>
              <button className="btn small warn" onClick={() => void close(s)}>
                Salonu kapat
              </button>
            </div>
            <ul className="admin-list">
              {humans.map((p) => (
                <li key={p.sessionId}>
                  <div>
                    <b>{p.name}</b>
                    <small>
                      {p.money} ₺{p.table >= 0 ? ` · ${p.table + 1}. masa` : ''}
                      {p.connected ? '' : ' · bağlantı koptu'}
                    </small>
                  </div>
                  <div className="admin-row">
                    <input
                      className="amount"
                      inputMode="numeric"
                      placeholder="± ₺"
                      value={amounts[p.sessionId] ?? ''}
                      onChange={(e) => setAmounts((a) => ({ ...a, [p.sessionId]: e.target.value.replace(/[^\d-]/g, '').slice(0, 8) }))}
                    />
                    <button className="btn small primary" onClick={() => void grant(s, p.sessionId, p.name)}>
                      Para
                    </button>
                    <button className="btn small warn" onClick={() => void kick(s, p.sessionId, p.name)}>
                      Çıkar
                    </button>
                  </div>
                </li>
              ))}
              {!humans.length && <li className="admin-hint">Salon boş.</li>}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

function Announce({ onError }: { onError: (e: unknown) => void }) {
  const [text, setText] = useState('');
  const [flashEl, flash] = useFlash();
  const run = useAction(onError, flash);
  const send = async (e: FormEvent) => {
    e.preventDefault();
    const r = await run(() => api<{ salons: number }>('POST', 'announce', { text }));
    if (r) {
      flash(`Duyuru ${r.salons} salona gönderildi.`);
      setText('');
    }
  };
  return (
    <form className="admin-pane" onSubmit={(e) => void send(e)}>
      <p className="admin-hint">Bütün salonlarda herkesin ekranında “📢 Duyuru: …” olarak görünür.</p>
      <textarea value={text} maxLength={140} rows={3} placeholder="ör. Bu akşam 21:00'de okey turnuvası var!" onChange={(e) => setText(e.target.value)} />
      <div className="admin-row">
        <small className="admin-count">{text.length}/140</small>
        <button className="btn primary" disabled={!text.trim()}>
          Duyur
        </button>
      </div>
      {flashEl}
    </form>
  );
}

const STAT_TR: Record<string, string> = {
  startedAt: 'Sunucu açılışı',
  okeyTablesStarted: 'Başlayan okey masası',
  okeyHandsPlayed: 'Oynanan okey eli',
  tavlaMatchesStarted: 'Başlayan tavla maçı',
  tavlaGamesPlayed: 'Oynanan tavla oyunu',
  averageHumansPerTable: 'Masa başına ortalama oyuncu',
  tableSizes: 'Masa doluluğu (kişi: adet)',
  bets: 'Bahisler (₺: adet)',
};

function Stats({ onError }: { onError: (e: unknown) => void }) {
  const [s, setS] = useState<Record<string, unknown> | null>(null);
  useEffect(() => void api<Record<string, unknown>>('GET', 'stats').then(setS, onError), [onError]);
  if (!s) return <div className="admin-hint">Yükleniyor…</div>;
  const fmt = (k: string, v: unknown) =>
    k === 'startedAt' && typeof v === 'number'
      ? time(v)
      : v && typeof v === 'object'
        ? Object.entries(v as Record<string, number>)
            .map(([a, b]) => `${a}: ${b}`)
            .join(' · ') || '—'
        : String(v);
  return (
    <dl className="admin-stats">
      {Object.entries(s).map(([k, v]) => (
        <div key={k}>
          <dt>{STAT_TR[k] ?? k}</dt>
          <dd>{fmt(k, v)}</dd>
        </div>
      ))}
    </dl>
  );
}

function Log({ onError }: { onError: (e: unknown) => void }) {
  const [rows, setRows] = useState<LogRow[] | null>(null);
  useEffect(() => void api<LogRow[]>('GET', 'log').then(setRows, onError), [onError]);
  if (!rows) return <div className="admin-hint">Yükleniyor…</div>;
  if (!rows.length) return <p className="admin-hint">Henüz kayıt yok.</p>;
  return (
    <ul className="admin-list admin-log">
      {rows.map((r, i) => (
        <li key={i}>
          <div>
            <b>{r.by}</b> {ACTION_TR[r.action] ?? r.action}
            {r.detail && <small>{r.detail}</small>}
          </div>
          <small>{time(r.t)}</small>
        </li>
      ))}
    </ul>
  );
}
