import { useEffect, useRef, useState } from 'react';
import { sfx } from './audio';
import { useBook, useStrings } from './store';
import { Experience } from './three/Experience';
import { HostPanel } from './ui/HostPanel';
import { Loader } from './ui/Loader';
import { Overlay } from './ui/Overlay';
import { Letterbox, SantaOverlay } from './ui/SantaOverlay';
import { loadContent } from './content';
import { useBrand } from './brand';
import { useSanta } from './santa/santaStore';
import { santaRuntime } from './santa/santaRuntime';
import { captureMode } from './config';
import { director } from './santa/director';

if (captureMode) Object.assign(window, { __santaStore: useSanta, __santaRT: santaRuntime, __director: director });

function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

/** Tastatur (auch Presenter-Fernbedienungen senden Pfeil-/Bildtasten) */
function useKeyboard() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) return;
      const st = useBook.getState();
      const busy = st.reveal.phase === 'suspense' || st.reveal.phase === 'slam';
      if (useSanta.getState().mode === 'santa' && !['h', 'H', 'f', 'F', 'Escape'].includes(e.key)) return;
      let handled = true;
      switch (e.key) {
        case 'ArrowRight':
        case 'PageDown':
        case ' ':
          if (!busy && !st.hostOpen) st.next();
          break;
        case 'ArrowLeft':
        case 'PageUp':
          if (!busy && !st.hostOpen) st.prev();
          break;
        case 'Enter':
        case 'r':
        case 'R':
          if (!st.hostOpen) st.startReveal();
          break;
        case 'Home':
          st.setPage(0);
          break;
        case 'End':
          st.setPage(st.guests.length + 2);
          break;
        case 'h':
        case 'H':
          st.setHostOpen(!st.hostOpen);
          break;
        case 'f':
        case 'F':
          try {
            if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
            else document.documentElement.requestFullscreen?.().catch(() => {});
          } catch {
            /* egal */
          }
          break;
        case 'Escape':
          if (st.hostOpen) st.setHostOpen(false);
          else handled = false;
          break;
        default:
          handled = false;
      }
      if (handled) {
        sfx.unlock();
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

/** Wischen zum Blättern */
function useSwipe(ref: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let x0 = 0;
    let y0 = 0;
    let t0 = 0;
    const down = (e: PointerEvent) => {
      x0 = e.clientX;
      y0 = e.clientY;
      t0 = performance.now();
    };
    const up = (e: PointerEvent) => {
      const dx = e.clientX - x0;
      const dy = e.clientY - y0;
      if (performance.now() - t0 > 800 || Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.3) return;
      const st = useBook.getState();
      if (st.reveal.phase === 'suspense' || st.reveal.phase === 'slam' || st.hostOpen) return;
      if (useSanta.getState().mode === 'santa') return;
      sfx.unlock();
      if (dx < 0) st.next();
      else st.prev();
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointerup', up);
    return () => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointerup', up);
    };
  }, [ref]);
}

export default function App() {
  const s = useStrings();
  const locale = useBook((st) => st.locale);
  const mode = useSanta((st) => st.mode);
  const [webgl] = useState(hasWebGL);
  const sceneRef = useRef<HTMLDivElement>(null);
  useKeyboard();
  useSwipe(sceneRef);
  useBrand();

  useEffect(() => {
    void loadContent();
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  useEffect(() => {
    const onResize = () => useBook.getState().setSinglePage(window.innerWidth / window.innerHeight < 0.8);
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  if (!webgl) {
    return (
      <div className="nowebgl">
        <p>{s.noWebgl}</p>
      </div>
    );
  }

  return (
    <div className="app">
      <div className="scene-wrap" ref={sceneRef}>
        <Experience />
      </div>
      <Letterbox />
      <Overlay />
      {mode === 'santa' && <SantaOverlay />}
      <HostPanel />
      <Loader />
    </div>
  );
}
