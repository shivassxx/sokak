import { describe, expect, it } from 'vitest';
import { TV_STREAM_TITLE_MAX, TV_STREAM_URL_MAX, cleanStreamTitle, detectStreamType, isHlsUrl, normalizeStreamUrl } from '../src/tvStream';
import { isTvStream, type TvBroadcast } from '../src/tv';

const EMBED = 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1';

describe('tv stream links', () => {
  it('normalises YouTube watch, youtu.be, live, shorts and embed links to the nocookie embed player', () => {
    for (const raw of [
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'https://youtube.com/watch?v=dQw4w9WgXcQ&t=42s&list=abc',
      'https://m.youtube.com/watch?v=dQw4w9WgXcQ',
      'https://youtu.be/dQw4w9WgXcQ',
      'https://youtu.be/dQw4w9WgXcQ?si=xyz',
      'https://www.youtube.com/live/dQw4w9WgXcQ?feature=share',
      'https://www.youtube.com/shorts/dQw4w9WgXcQ',
      'https://www.youtube.com/embed/dQw4w9WgXcQ',
      ' https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ ',
    ])
      expect(normalizeStreamUrl(raw), raw).toEqual({ url: EMBED, type: 'embed' });
    // a YouTube link is always an embed, whatever the override says
    expect(normalizeStreamUrl('https://youtu.be/dQw4w9WgXcQ', 'video')?.type).toBe('embed');
    // not a video id: an ordinary embed page
    expect(normalizeStreamUrl('https://www.youtube.com/channel/UC123')).toEqual({ url: 'https://www.youtube.com/channel/UC123', type: 'embed' });
  });

  it('detects direct video and HLS links; anything else is an embed; the type can be overridden', () => {
    expect(detectStreamType('https://cdn.example.com/a/maç.mp4')).toBe('video');
    expect(detectStreamType('https://cdn.example.com/live/index.m3u8?token=1')).toBe('video');
    expect(detectStreamType('https://cdn.example.com/x.WEBM')).toBe('video');
    expect(detectStreamType('https://player.example.com/embed/123')).toBe('embed');
    expect(detectStreamType('not a url')).toBe('embed');
    expect(normalizeStreamUrl('https://cdn.example.com/live.m3u8')).toEqual({ url: 'https://cdn.example.com/live.m3u8', type: 'video' });
    expect(normalizeStreamUrl('https://player.example.com/p/1', 'video')?.type).toBe('video');
    expect(normalizeStreamUrl('https://cdn.example.com/a.mp4', 'embed')?.type).toBe('embed');
    expect(normalizeStreamUrl('https://cdn.example.com/a.mp4', 'nonsense')?.type).toBe('video');
    expect(isHlsUrl('https://cdn.example.com/live/index.m3u8?x=1')).toBe(true);
    expect(isHlsUrl('https://cdn.example.com/a.mp4')).toBe(false);
  });

  it('accepts https only and rejects scripts, data, credentials and over-long links', () => {
    for (const bad of [
      'http://cdn.example.com/a.mp4',
      'javascript:alert(1)',
      'JAVASCRIPT:alert(1)',
      'data:text/html,<b>x</b>',
      'data:video/mp4;base64,AAAA',
      'ftp://example.com/a.mp4',
      'https://user:pw@example.com/a.mp4',
      'https://localhost/a.mp4',
      '//example.com/a.mp4',
      'example.com/a.mp4',
      'https://example.com/a b.mp4',
      'https://example.com/"onload=x',
      '',
      42,
      null,
      `https://example.com/${'a'.repeat(TV_STREAM_URL_MAX)}`,
    ])
      expect(normalizeStreamUrl(bad), String(bad)).toBeNull();
    const longest = `https://example.com/${'a'.repeat(TV_STREAM_URL_MAX - 'https://example.com/'.length)}`;
    expect(longest.length).toBe(TV_STREAM_URL_MAX);
    expect(normalizeStreamUrl(longest)?.url).toBe(longest);
  });

  it('cleans titles and enforces the length limit', () => {
    expect(cleanStreamTitle('  Derbi:   GS–FB \n')).toBe('Derbi: GS–FB');
    expect(cleanStreamTitle('')).toBeNull();
    expect(cleanStreamTitle('   ')).toBeNull();
    expect(cleanStreamTitle(7)).toBeNull();
    expect(cleanStreamTitle('x'.repeat(TV_STREAM_TITLE_MAX))).toHaveLength(TV_STREAM_TITLE_MAX);
    expect(cleanStreamTitle('x'.repeat(TV_STREAM_TITLE_MAX + 1))).toBeNull();
  });

  it('a broadcast without kind is a simulated derby', () => {
    const sim: TvBroadcast = { id: 'a', home: 'x', away: 'y', startedAt: 0, seed: 1, by: 't' };
    expect(isTvStream(sim)).toBe(false);
    expect(isTvStream(null)).toBe(false);
    expect(isTvStream({ ...sim, kind: 'stream', title: 'T', url: 'https://e.com/a.mp4', streamType: 'video' })).toBe(true);
  });
});
