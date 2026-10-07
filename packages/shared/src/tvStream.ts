/**
 * Real match streams on the kıraathane TV. The owner adds "channels" (a title and a stream
 * link they have the rights to); owner or admins put one on air. Both the server (validation)
 * and the client (playback, admin preview) use these helpers.
 *
 * - `video`: a direct .mp4 / .webm file or an HLS .m3u8 stream, drawn onto the 3D TV
 * - `embed`: any other https page (a YouTube live embed, a broadcaster's player), shown in a
 *   2D overlay iframe because a cross-origin page cannot be drawn into WebGL
 */
export type TvStreamType = 'video' | 'embed';

export const TV_STREAM_TITLE_MAX = 60;
export const TV_STREAM_URL_MAX = 500;
export const TV_CHANNELS_MAX = 50;

/** an owner-managed channel */
export interface TvStreamChannel {
  id: string;
  title: string;
  url: string;
  type: TvStreamType;
  createdAt: number;
  createdBy: string;
}

const YT_ID = /^[A-Za-z0-9_-]{11}$/;

/** the YouTube video id of a watch / short / live / embed link, or null */
export function youtubeId(u: URL): string | null {
  const host = u.hostname.toLowerCase().replace(/^(www\.|m\.|music\.)/, '');
  let id: string | null = null;
  if (host === 'youtu.be') id = u.pathname.slice(1).split('/')[0] ?? null;
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    const parts = u.pathname.split('/').filter(Boolean);
    if (parts[0] === 'watch') id = u.searchParams.get('v');
    else if (parts[0] === 'live' || parts[0] === 'embed' || parts[0] === 'shorts' || parts[0] === 'v') id = parts[1] ?? null;
  }
  return id && YT_ID.test(id) ? id : null;
}

/** a direct video file or an HLS playlist, by the path's extension */
export function detectStreamType(url: string): TvStreamType {
  try {
    const p = new URL(url).pathname.toLowerCase();
    return /\.(mp4|m4v|webm|m3u8)$/.test(p) ? 'video' : 'embed';
  } catch {
    return 'embed';
  }
}

export const isHlsUrl = (url: string): boolean => {
  try {
    return new URL(url).pathname.toLowerCase().endsWith('.m3u8');
  } catch {
    return false;
  }
};

/**
 * Validates and normalises a stream link: https only (no credentials, no other scheme),
 * at most TV_STREAM_URL_MAX characters. YouTube watch / youtu.be / live links become the
 * privacy-enhanced embed player. `type` overrides the detected type (a YouTube link is always
 * an embed). Returns null for anything unusable.
 */
export function normalizeStreamUrl(raw: unknown, type?: unknown): { url: string; type: TvStreamType } | null {
  if (typeof raw !== 'string') return null;
  const s = raw.trim();
  if (!s || s.length > TV_STREAM_URL_MAX || /[\s<>"'`\\]/.test(s)) return null;
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    return null;
  }
  if (u.protocol !== 'https:' || u.username || u.password || !u.hostname.includes('.')) return null;
  const yt = youtubeId(u);
  if (yt) return { url: `https://www.youtube-nocookie.com/embed/${yt}?autoplay=1`, type: 'embed' };
  const url = u.toString();
  if (url.length > TV_STREAM_URL_MAX) return null;
  const forced = type === 'video' || type === 'embed' ? type : undefined;
  return { url, type: forced ?? detectStreamType(url) };
}

/** a channel title: trimmed, single-spaced, 1…TV_STREAM_TITLE_MAX characters; null if empty / too long */
export function cleanStreamTitle(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const t = raw.replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim();
  return t && t.length <= TV_STREAM_TITLE_MAX ? t : null;
}
