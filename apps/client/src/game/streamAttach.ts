import { isHlsUrl } from '@sokak/shared';

/**
 * Real match streams (owner-added channels of type `video`): attach a direct .mp4/.webm file or
 * an HLS .m3u8 to a <video>. Safari/iOS play HLS natively; everywhere else hls.js is loaded on
 * demand (a separate lazy chunk, never part of the lobby bundle).
 */
export async function attachStream(video: HTMLVideoElement, url: string, onFatal: () => void): Promise<() => void> {
  if (!isHlsUrl(url) || video.canPlayType('application/vnd.apple.mpegurl')) {
    video.src = url;
    return () => {
      video.removeAttribute('src');
      video.load();
    };
  }
  const { default: Hls } = await import('hls.js/light');
  if (!Hls.isSupported()) {
    onFatal();
    return () => {};
  }
  const hls = new Hls({ lowLatencyMode: true, backBufferLength: 30 });
  hls.on(Hls.Events.ERROR, (_e, d) => {
    if (d.fatal) onFatal();
  });
  hls.loadSource(url);
  hls.attachMedia(video);
  return () => hls.destroy();
}
