import { useFrame } from '@react-three/fiber';
import { useEffect } from 'react';
import { sfx } from '../audio';

import { useBook } from '../store';
import { runtime } from './runtime';

const SUSPENSE_MS = 1650;
const SLAM_MS = 380;
const DONE_MS = 2800;

/** Ablauf beim Verkünden: Trommelwirbel → Stempel → Effekte */
export function RevealDirector() {
  useEffect(() => {
    sfx.setEnabled(useBook.getState().sound);
    return useBook.subscribe((s, prev) => {
      if (s.sound !== prev.sound) sfx.setEnabled(s.sound);
      if (s.reveal.phase !== prev.reveal.phase) {
        if (s.reveal.phase === 'suspense') {
          sfx.drumroll(SUSPENSE_MS / 1000);
          sfx.setAmbienceLevel(0.05);
        } else if (s.reveal.phase === 'idle') {
          sfx.setAmbienceLevel(0.16);
        }
      }
    });
  }, []);

  useFrame((state) => {
    const st = useBook.getState();
    const r = st.reveal;
    if (r.phase === 'idle') return;
    const age = performance.now() - r.t0;
    if (r.phase === 'suspense' && age > SUSPENSE_MS) {
      st.setRevealPhase('slam');
    } else if (r.phase === 'slam' && age > SLAM_MS) {
      const g = st.guests.find((x) => x.id === r.guestId);
      runtime.impactAt = state.clock.elapsedTime;
      runtime.impactVerdict = g?.verdict ?? 'undecided';
      runtime.shake = 1;
      sfx.thump();
      if (g?.verdict === 'naughty') sfx.naughty();
      else if (g?.verdict === 'nice') sfx.nice();
      st.setRevealPhase('done');
    } else if (r.phase === 'done' && age > DONE_MS) {
      st.setRevealPhase('idle');
    }
  });
  return null;
}
