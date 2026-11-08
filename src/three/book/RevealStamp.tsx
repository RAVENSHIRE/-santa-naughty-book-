import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { slowmo } from '../../config';
import { STRINGS } from '../../i18n';
import { useBook } from '../../store';
import { toTexture } from '../tex/canvas';
import { stampCanvas } from '../tex/draw2d';
import { PH, PW, STAMP, stampFor } from '../tex/pageArt';
import { runtime } from '../runtime';
import { H, W } from './geometry';

const PX = W / PW; // Buch-Einheiten pro Seiten-Pixel
const sx = STAMP.cx * PX;
const sy = (0.5 - STAMP.cy / PH) * H;

const CONFETTI = 140;
const COAL = 16;

/**
 * Der Stempel, der beim Verkünden auf die Seite knallt – plus Konfetti (brav) oder Kohle (unartig).
 * Lebt in Buch-Koordinaten (rechte Seite).
 */
export function RevealStamp() {
  const group = useRef<THREE.Group>(null);
  const plane = useRef<THREE.Mesh>(null);
  const confetti = useRef<THREE.InstancedMesh>(null);
  const coal = useRef<THREE.InstancedMesh>(null);
  const current = useRef<{ key: string; tex: THREE.Texture | null; w: number; h: number }>({ key: '', tex: null, w: 1, h: 1 });
  const fadeFrom = useRef(-1);

  const mat = useMemo(
    () => new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, toneMapped: false, color: '#ffffff' }),
    [],
  );
  const planeGeo = useMemo(() => new THREE.PlaneGeometry(1, 1), []);
  const confettiGeo = useMemo(() => new THREE.PlaneGeometry(0.022, 0.034), []);
  const confettiMat = useMemo(
    () => new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, metalness: 0.6, roughness: 0.35, emissive: '#3a2a08', emissiveIntensity: 0.4 }),
    [],
  );
  const coalGeo = useMemo(() => new THREE.DodecahedronGeometry(0.032, 0), []);
  const coalMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#141210', roughness: 0.75, metalness: 0.15, emissive: '#2a0700', emissiveIntensity: 0.25 }), []);

  const parts = useMemo(() => {
    const rnd = Math.random;
    return {
      confetti: Array.from({ length: CONFETTI }, () => ({
        p: new THREE.Vector3(),
        v: new THREE.Vector3(),
        r: new THREE.Euler(rnd() * 6, rnd() * 6, rnd() * 6),
        w: new THREE.Vector3(rnd() * 8 - 4, rnd() * 8 - 4, rnd() * 8 - 4),
        c: new THREE.Color().setHSL([0.12, 0.13, 0.0, 0.35][Math.floor(rnd() * 4)], 0.85, 0.5 + rnd() * 0.15),
      })),
      coal: Array.from({ length: COAL }, () => ({
        p: new THREE.Vector3(),
        v: new THREE.Vector3(),
        r: new THREE.Euler(rnd() * 6, rnd() * 6, rnd() * 6),
        w: new THREE.Vector3(rnd() * 4 - 2, rnd() * 4 - 2, rnd() * 4 - 2),
        s: 0.6 + rnd() * 0.8,
        settled: false,
      })),
      started: -100,
      verdict: 'nice' as string,
    };
  }, []);

  const tmpO = useMemo(() => new THREE.Object3D(), []);

  useFrame((state, delta) => {
    const st = useBook.getState();
    const g = group.current;
    const pl = plane.current;
    if (!g || !pl) return;
    const dt = Math.min(delta, 1 / 30) / slowmo;
    const now = performance.now();
    const guest = st.guests.find((x) => x.id === st.reveal.guestId);
    const phase = st.reveal.phase;
    // etwas über der Seite (die Seiten heben sich am Bund leicht an)
    const z0 = runtime.rightTopZ + 0.012;
    g.position.set(sx, sy, 0);

    // Stempel-Textur passend zum Gast vorbereiten
    if (guest) {
      const s = STRINGS[st.locale];
      const stp = stampFor(guest, s);
      const key = `${stp.text}|${stp.color}`;
      if (current.current.key !== key) {
        current.current.tex?.dispose();
        const c = stampCanvas({ w: STAMP.w, h: STAMP.h, text: stp.text, color: stp.color, seed: 11 }, 1);
        const tex = toTexture(c);
        current.current = { key, tex, w: c.width * PX, h: c.height * PX };
        mat.map = tex;
        mat.needsUpdate = true;
      }
    }

    let opacity = 0;
    let lift = 0;
    let scale = 1;
    if (phase !== 'done') fadeFrom.current = -1;
    if (phase === 'slam' && guest) {
      const u = Math.min(1, (now - st.reveal.t0) / (380 * slowmo));
      const e = u * u * u;
      lift = (1 - e) * 0.55;
      scale = 1 + (1 - e) * 0.9;
      opacity = Math.min(1, u * 2.2);
    } else if (phase === 'done' && guest) {
      const age = (now - st.reveal.t0) / slowmo;
      // erst ausblenden, wenn der Stempel in der Seitentextur angekommen ist
      const baked = runtime.rightPageKey.includes('"REVEALED"');
      if (!baked) fadeFrom.current = -1;
      else if (fadeFrom.current < 0) fadeFrom.current = Math.max(age, 450);
      opacity = fadeFrom.current < 0 || age < fadeFrom.current ? 1 : Math.max(0, 1 - (age - fadeFrom.current) / 350);
      const bump = age < 160 ? Math.sin((age / 160) * Math.PI) * 0.06 : 0;
      scale = 1 - bump;
    }
    pl.visible = opacity > 0.001;
    mat.opacity = opacity * 0.92;
    pl.position.set(0, 0, z0 + lift);
    pl.rotation.set(0, 0, -STAMP.rot);
    pl.scale.set(current.current.w * scale, current.current.h * scale, 1);

    // Partikel starten beim Aufprall
    if (runtime.impactAt > parts.started) {
      parts.started = runtime.impactAt;
      parts.verdict = runtime.impactVerdict;
      for (const c of parts.confetti) {
        c.p.set((Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.12, z0 + 0.02);
        const a = Math.random() * Math.PI * 2;
        const sp = 0.6 + Math.random() * 1.4;
        c.v.set(Math.cos(a) * sp * 0.6, Math.sin(a) * sp * 0.6, 1.2 + Math.random() * 1.6);
      }
      for (const c of parts.coal) {
        c.p.set((Math.random() - 0.5) * 0.7, (Math.random() - 0.5) * 0.4, z0 + 0.6 + Math.random() * 0.7);
        c.v.set((Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.3, -0.5 - Math.random());
        c.settled = false;
      }
    }
    const age = (state.clock.elapsedTime - parts.started) / slowmo;
    const active = age >= 0 && age < 3.6;
    const cm = confetti.current;
    const km = coal.current;
    if (cm) {
      cm.visible = active && parts.verdict !== 'naughty';
      if (cm.visible) {
        const fade = age > 2.6 ? Math.max(0, 1 - (age - 2.6)) : 1;
        parts.confetti.forEach((c, i) => {
          c.v.z -= 3.2 * dt;
          c.v.multiplyScalar(1 - 1.6 * dt);
          c.p.addScaledVector(c.v, dt);
          if (c.p.z < z0 + 0.003) {
            c.p.z = z0 + 0.003;
            c.v.set(0, 0, 0);
          }
          c.r.x += c.w.x * dt;
          c.r.y += c.w.y * dt;
          c.r.z += c.w.z * dt;
          tmpO.position.copy(c.p);
          tmpO.rotation.copy(c.r);
          tmpO.scale.setScalar(fade);
          tmpO.updateMatrix();
          cm.setMatrixAt(i, tmpO.matrix);
          cm.setColorAt(i, c.c);
        });
        cm.instanceMatrix.needsUpdate = true;
        if (cm.instanceColor) cm.instanceColor.needsUpdate = true;
      }
    }
    if (km) {
      km.visible = active && parts.verdict === 'naughty';
      if (km.visible) {
        const fade = age > 2.8 ? Math.max(0, 1 - (age - 2.8) / 0.8) : 1;
        parts.coal.forEach((c, i) => {
          if (!c.settled) {
            c.v.z -= 5.5 * dt;
            c.p.addScaledVector(c.v, dt);
            c.r.x += c.w.x * dt;
            c.r.y += c.w.y * dt;
            const floor = z0 + 0.02 * c.s;
            if (c.p.z < floor) {
              c.p.z = floor;
              if (Math.abs(c.v.z) > 0.4) {
                c.v.z = -c.v.z * 0.35;
                c.v.x *= 0.6;
                c.v.y *= 0.6;
              } else {
                c.settled = true;
              }
            }
          }
          tmpO.position.copy(c.p);
          tmpO.rotation.copy(c.r);
          tmpO.scale.setScalar(c.s * fade);
          tmpO.updateMatrix();
          km.setMatrixAt(i, tmpO.matrix);
        });
        km.instanceMatrix.needsUpdate = true;
      }
    }
  });

  return (
    <group ref={group}>
      <mesh ref={plane} geometry={planeGeo} material={mat} renderOrder={5} visible={false} />
      <instancedMesh ref={confetti} args={[confettiGeo, confettiMat, CONFETTI]} visible={false} frustumCulled={false} />
      <instancedMesh ref={coal} args={[coalGeo, coalMat, COAL]} visible={false} frustumCulled={false} castShadow />
    </group>
  );
}
