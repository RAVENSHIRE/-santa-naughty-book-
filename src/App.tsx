import { useEffect, useState } from 'react';
import { captureMode } from './config';
import { director } from './santa/director';
import { santaRuntime } from './santa/santaRuntime';
import { useSanta } from './santa/santaStore';
import { useBook } from './store';
import { STRINGS } from './strings';
import { Experience } from './three/Experience';
import { LiveAvatar } from './ui/LiveAvatar';
import { Loader } from './ui/Loader';
import { Stage } from './ui/Stage';
import { loadVoiceManifest } from './santa/voicebank';
import { loadEvent } from './vault';

// Nur im Dev-Server für automatische Tests
if (captureMode) Object.assign(window, { __santaStore: useSanta, __santaRT: santaRuntime, __director: director });

function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

function useKeyboard() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'SELECT')) return;
      const { phase, mode } = useSanta.getState();
      const book = useBook.getState();
      if (e.key === 'f' || e.key === 'F') {
        // Vollbild nur auf Wunsch (F schaltet ein und aus)
        if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
        else void document.documentElement.requestFullscreen?.().catch(() => {});
      }
      else if (mode === 'book' && ['ArrowRight', 'PageDown', ' '].includes(e.key)) book.next();
      else if (mode === 'book' && ['ArrowLeft', 'PageUp'].includes(e.key)) book.prev();
      else if (phase !== 'idle' && phase !== 'finale' && e.key === ' ') director.skip();
      else if (phase !== 'idle' && (e.key === 'p' || e.key === 'P')) director.personHere();
      else if (phase !== 'idle' && (e.key === 'e' || e.key === 'E')) director.end();
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

export default function App() {
  const [webgl] = useState(hasWebGL);
  useKeyboard();

  useEffect(() => {
    void loadEvent().then((r) => useSanta.getState().patch({ frame: r?.frame ?? null, total: r?.count ?? 0 }));
    void loadVoiceManifest().then((recorded) => useSanta.getState().patch({ recorded }));
    const onResize = () => useBook.getState().setSinglePage(window.innerWidth / window.innerHeight < 0.8);
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  if (!webgl) return <p className="nowebgl">{STRINGS.noWebgl}</p>;
  return (
    <div className="app">
      <div className="scene-wrap">
        <Experience />
      </div>
      <LiveAvatar />
      <Stage />
      <Loader />
    </div>
  );
}
