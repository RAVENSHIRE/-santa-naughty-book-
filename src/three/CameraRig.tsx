import { useFrame, useThree } from '@react-three/fiber';
import { easing } from 'maath';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { isTouch, settleMode } from '../config';
import { CLAUS_HEAD as SANTA_HEAD, CLAUS_POS as SANTA_POS } from '../santa/MrsClaus';
import { santaRuntime } from '../santa/santaRuntime';
import { useSanta } from '../santa/santaStore';
import { useBook } from '../store';
import { H, HC, W, WC } from './book/geometry';
import { runtime } from './runtime';
import { PH, STAMP } from './tex/pageArt';

const VIEW_DIR = new THREE.Vector3(0, 0.62, 1).normalize();
const INTRO_DIR = new THREE.Vector3(0.12, 0.34, 1).normalize();
const INTRO_LOOK = new THREE.Vector3(-0.55, 0.42, -2.2);
/** Platz, den die Bedienelemente oben/unten belegen (px) */
const UI_TOP = 66;
const STAMP_Y = (0.5 - STAMP.cy / PH) * H;
const SANTA_DIR = new THREE.Vector3(0.16, 0.05, 1).normalize();

/** Kamerafahrt: Raum-Totale → Buch → (beim Verkünden) Nahaufnahme des Urteils */
export function CameraRig() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const size = useThree((s) => s.size);
  const look = useRef(INTRO_LOOK.clone());
  const tmp = useMemo(() => ({ target: new THREE.Vector3(), pos: new THREE.Vector3(), local: new THREE.Vector3() }), []);

  useFrame((state, delta) => {
    const dt = Math.min(delta, settleMode ? 4 : 0.1);
    const st = useBook.getState();
    const aspect = size.width / Math.max(1, size.height);
    const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const tanH = tanV * aspect;
    const fit = (w: number, h: number) => Math.max(w / 2 / tanH, h / 2 / tanV);
    const book = runtime.book;

    let smoothPos = 0.7;
    let smoothLook = 0.55;
    if (useSanta.getState().mode === 'santa') {
      // Santa-Modus: Kameraeinstellungen wie in einem Film (Totale, Halbnah, Nah, Buch)
      const shot = santaRuntime.shot;
      const portrait = aspect < 0.9;
      if (shot === 'wide') {
        tmp.target.set(-0.7, 1.7, -3.4);
        tmp.pos.copy(tmp.target).addScaledVector(INTRO_DIR, THREE.MathUtils.clamp(fit(portrait ? 4.8 : 11, 6.8), 7.5, 16));
        smoothPos = 2.6;
        smoothLook = 2.2;
      } else if (shot === 'close') {
        tmp.target.set(SANTA_HEAD.x, SANTA_HEAD.y - 0.2, SANTA_HEAD.z + 0.35);
        tmp.pos.copy(tmp.target).addScaledVector(SANTA_DIR, THREE.MathUtils.clamp(fit(portrait ? 1.8 : 2.6, 2.3), 2.6, 8));
        smoothPos = 1.4;
        smoothLook = 1.1;
      } else if (shot === 'book' && book) {
        tmp.local.set(W / 2 + 0.02, STAMP_Y + 0.06, runtime.rightTopZ);
        book.localToWorld(tmp.local);
        tmp.target.copy(tmp.local);
        tmp.pos.copy(tmp.target).addScaledVector(VIEW_DIR, fit(W + 0.25, 1.0));
        smoothPos = 0.5;
        smoothLook = 0.4;
      } else {
        const reading = santaRuntime.pose === 'read';
        tmp.target.set(portrait ? 0 : -0.25, reading ? 2.2 : 2.3, SANTA_POS.z + 0.5);
        const w = portrait ? 3.0 : 4.4;
        const h = reading ? 3.7 : 4.3;
        tmp.pos.copy(tmp.target).addScaledVector(SANTA_DIR, THREE.MathUtils.clamp(fit(w, h), 4.2, 15));
        smoothPos = 1.6;
        smoothLook = 1.2;
      }
    } else if (st.page === 0 || !book) {
      if (aspect < 0.9) {
        tmp.target.set(0.15, 0.62, -0.6);
        tmp.pos.copy(tmp.target).addScaledVector(INTRO_DIR, THREE.MathUtils.clamp(fit(3.4, 5.2), 5.5, 13));
      } else {
        tmp.target.copy(INTRO_LOOK);
        tmp.pos.copy(tmp.target).addScaledVector(INTRO_DIR, THREE.MathUtils.clamp(fit(11.5, 6.6), 7.5, 15));
      }
    } else {
      const now = performance.now();
      const r = st.reveal;
      const revealing = r.phase === 'suspense' || r.phase === 'slam' || (r.phase === 'done' && now - r.t0 < 1500);
      const onGuest = st.page >= 2 && st.page <= st.guests.length + 1;
      let fx = 0;
      let fy = 0;
      let w = 2 * WC + 0.34;
      let h = HC + 0.24;
      if (st.singlePage) {
        fx = st.focus === 'left' ? -WC / 2 : WC / 2;
        w = WC + 0.2;
        h = HC + 0.2;
      }
      if (revealing) {
        fx = W / 2 + 0.02;
        fy = STAMP_Y + 0.06;
        w = W + 0.12;
        h = 0.9;
      }
      // Buch zwischen oberer und unterer Leiste einpassen
      const uiBottom = onGuest ? 136 : 88;
      const band = Math.max(0.55, 1 - (UI_TOP + uiBottom) / size.height);
      const dist = fit(w, (h * 0.8) / band);
      const shift = (((uiBottom - UI_TOP) / 2 / size.height) * 2 * dist * tanV) / 0.88;
      tmp.local.set(fx, fy - shift, runtime.rightTopZ);
      book.localToWorld(tmp.local);
      tmp.target.copy(tmp.local);
      tmp.pos.copy(tmp.target).addScaledVector(VIEW_DIR, dist);
    }

    if (runtime.camOverride) {
      tmp.pos.set(...runtime.camOverride.pos);
      tmp.target.set(...runtime.camOverride.target);
    }

    if (!isTouch) {
      tmp.pos.x += state.pointer.x * 0.16;
      tmp.pos.y += state.pointer.y * 0.09;
    }
    tmp.pos.y += Math.sin(state.clock.elapsedTime * 0.45) * 0.02;

    const intro = st.page === 0 && useSanta.getState().mode !== 'santa';
    if (intro) {
      smoothPos = 1.0;
      smoothLook = 0.9;
    }
    if (santaRuntime.camCut) {
      // harter Schnitt
      santaRuntime.camCut = false;
      camera.position.copy(tmp.pos);
      look.current.copy(tmp.target);
    }
    easing.damp3(camera.position, tmp.pos, smoothPos, dt);
    easing.damp3(look.current, tmp.target, smoothLook, dt);
    camera.lookAt(look.current);

    if (runtime.shake > 0.002) {
      const s = runtime.shake * 0.045;
      camera.position.x += (Math.random() - 0.5) * s;
      camera.position.y += (Math.random() - 0.5) * s;
      runtime.shake *= Math.exp(-dt * 6.5);
    }
  });
  return null;
}
