import { useEffect, useRef, useState } from 'react';
import { attachStream } from '../game/streamAttach';
import './streamPlayer.css';

/** the 2D player: also used by the admin panel's "Test et" preview */
export function StreamPlayer({ url, type }: { url: string; type: 'video' | 'embed' }) {
  return <div className="stream-frame">{type === 'embed' ? <EmbedFrame url={url} /> : <VideoFrame url={url} />}</div>;
}

function EmbedFrame({ url }: { url: string }) {
  return (
    <iframe
      src={url}
      title="Canlı yayın"
      sandbox="allow-scripts allow-same-origin allow-presentation"
      allow="autoplay; fullscreen; picture-in-picture"
      // YouTube refuses embeds that send no referrer at all (player error 153): it gets only our origin
      referrerPolicy={/^https:\/\/www\.youtube-nocookie\.com\/embed\//.test(url) ? 'strict-origin-when-cross-origin' : 'no-referrer'}
    />
  );
}

function VideoFrame({ url }: { url: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    setFailed(false);
    let detach: (() => void) | null = null;
    let live = true;
    void attachStream(v, url, () => setFailed(true)).then((d) => {
      if (!live) return d();
      detach = d;
      void v.play().catch(() => {
        // blocked with sound: start muted, the controls unmute
        v.muted = true;
        void v.play().catch(() => {});
      });
    });
    return () => {
      live = false;
      detach?.();
    };
  }, [url]);
  return (
    <>
      <video ref={ref} controls playsInline autoPlay onError={() => setFailed(true)} />
      {failed && <div className="stream-error">Yayın açılamadı. Bağlantı kapalı olabilir ya da bu yayın gömülmeye izin vermiyor.</div>}
    </>
  );
}
