import { useEffect, useRef, useState } from 'react';
import { santaRuntime } from '../santa/santaRuntime';
import { useSanta } from '../santa/santaStore';

/**
 * Mrs. Claus als echtes Video: zwei Endlosschleifen aus dem Porträt (public/avatar/),
 * mit LivePortrait aus echten Aufnahmen bewegt – Atmen, Blinzeln, Blick, Kopfbewegung.
 *  - idle.mp4: hört zu, lächelt, blinzelt
 *  - talk.mp4: spricht
 * Während die Stimme einen Satz spricht, wird weich auf „talk“ überblendet.
 * Fehlen die Videos, bleibt das Foto stehen.
 */
const src = (f: string) => new URL(`avatar/${f}`, document.baseURI).href;

export function LiveAvatar() {
  const mode = useSanta((s) => s.mode);
  const host = useRef<HTMLDivElement>(null);
  const talk = useRef<HTMLVideoElement>(null);
  const idle = useRef<HTMLVideoElement>(null);
  const [videoOk, setVideoOk] = useState(true);

  useEffect(() => {
    let raf = 0;
    let shown = -1;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const rt = santaRuntime;
      const el = host.current;
      if (!el) return;
      el.dataset.shot = rt.shot;
      const speak = rt.speaking ? 1 : 0;
      if (speak !== shown && talk.current) {
        shown = speak;
        talk.current.style.opacity = String(speak);
      }
    };
    loop();
    // Autoplay kann blockiert sein, bis jemand klickt – dann nochmals starten
    const kick = () => [idle.current, talk.current].forEach((v) => v?.paused && void v.play().catch(() => {}));
    window.addEventListener('pointerdown', kick);
    window.addEventListener('keydown', kick);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointerdown', kick);
      window.removeEventListener('keydown', kick);
    };
  }, []);

  const video = (ref: React.RefObject<HTMLVideoElement | null>, file: string, cls: string) => (
    <video
      ref={ref}
      className={cls}
      src={src(file)}
      poster={src('mrs-claus.jpg')}
      muted
      loop
      autoPlay
      playsInline
      preload="auto"
      disablePictureInPicture
      onError={() => setVideoOk(false)}
    />
  );

  return (
    <div ref={host} className={`avatar ${mode === 'santa' ? '' : 'is-off'}`} aria-hidden>
      <div className="avatar-bg" style={{ backgroundImage: `url(${src('mrs-claus.jpg')})` }} />
      <div className="avatar-frame">
        {videoOk ? (
          <>
            {video(idle, 'idle.mp4', 'avatar-idle')}
            {video(talk, 'talk.mp4', 'avatar-talk')}
          </>
        ) : (
          <img src={src('mrs-claus.jpg')} alt="" />
        )}
      </div>
    </div>
  );
}
