import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { santaRuntime } from '../santa/santaRuntime';
import { useSanta } from '../santa/santaStore';

/**
 * Live-Avatar: ein Foto (public/avatar/mrs-claus.jpg, 16:9), das im Shader lebendig wird –
 * Atmen, leichte Kopfbewegung, Blinzeln und Mundbewegung zur Stimme. Läuft komplett lokal.
 *
 * Landmarken in Bild-UV (0..1, y nach oben), einmal am Bild vermessen.
 */
const FACE = {
  eyes: [
    { c: [0.4516, 0.4519], r: [0.021, 0.0155], a: -0.14 },
    { c: [0.5339, 0.4713], r: [0.019, 0.0135], a: 0.26 },
  ],
  /** Oberkante der Unterlippe (unter den Zähnen), halbe Mundbreite (u), Neigung */
  mouth: { c: [0.5156, 0.2926], w: 0.0339, a: 0.197 },
  chin: [0.5285, 0.1947],
  /** Drehpunkt (Hals) und Kopfbereich für die Kopfbewegung */
  pivot: [0.5469, 0.0883],
  head: { c: [0.5, 0.47], r: [0.2, 0.42] },
  /** Bildausschnitt für die Nahaufnahme */
  closeCenter: [0.52, 0.33],
};

const vert = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const frag = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D uTex;
uniform float uTime, uMouth, uBlink, uZoom, uTilt, uBreath;
uniform vec2 uCenter, uScale, uSway;
uniform vec4 uEye1, uEye2;
uniform float uEyeA1, uEyeA2;
uniform vec3 uMouthP;
uniform float uMouthA, uChin;
uniform vec2 uPivot;
uniform vec4 uHead;
const float IA = 1.7777778;

vec2 rot(vec2 p, float a) { float c = cos(a), s = sin(a); return vec2(c * p.x - s * p.y, s * p.x + c * p.y); }
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

// Bild-UV → Ellipsen-Raum eines Merkmals (x entlang der Achse, y nach oben, Seitenverhältnis korrigiert)
vec2 toLocal(vec2 uv, vec2 c, float a) { vec2 p = uv - c; p.x *= IA; return rot(p, -a); }
vec2 toUv(vec2 p, vec2 c, float a) { p = rot(p, a); p.x /= IA; return c + p; }

// Oberlid senkt sich über das Auge; darunter wird das Auge gestaucht
vec2 blink(vec2 uv, vec4 eye, float a, out float lash, out float lid) {
  lash = 0.0;
  lid = 0.0;
  vec2 r = vec2(eye.z * IA, eye.w);
  vec2 q = toLocal(uv, eye.xy, a) / r;
  float m = 1.0 - smoothstep(0.85, 1.08, length(q));
  if (m <= 0.0 || uBlink <= 0.001) return uv;
  float L = 1.0 - 2.0 * uBlink;
  vec2 q2 = q;
  if (q.y > L) q2.y = 1.12 + (q.y - L) / max(1.0 - L, 0.001) * 0.22; // Lidhaut aus dem Lidschatten direkt über dem Auge
  else q2.y = -1.0 + (q.y + 1.0) * 2.0 / max(L + 1.0, 0.001);
  lash = m * (1.0 - smoothstep(0.0, 0.16, abs(q.y - L))) * smoothstep(0.02, 0.15, uBlink);
  lid = q.y > L ? m : 0.0;
  return mix(uv, toUv(q2 * r, eye.xy, a), m);
}

void main() {
  // Bildschirm → Bild (füllend), Zoom für Nahaufnahme
  vec2 uv = uCenter + (vUv - 0.5) * uScale / uZoom;

  // Kopf: leichte Neigung um den Hals + Versatz, weich ausgeblendet
  vec2 hq = (uv - uHead.xy) / uHead.zw;
  float hm = 1.0 - smoothstep(0.55, 1.0, length(hq));
  vec2 pv = uv - uPivot; pv.x *= IA; pv = rot(pv, -uTilt * hm); pv.x /= IA;
  uv = uPivot + pv - uSway * hm;

  // Atmen: Schultern heben sich minimal
  float bm = 1.0 - smoothstep(uPivot.y - 0.02, uPivot.y + 0.12, uv.y);
  uv.y -= uBreath * bm;

  // Mund: Unterlippe und Kinn sinken, dazwischen öffnet sich der Mund
  vec2 m = toLocal(uv, uMouthP.xy, uMouthA);
  float w = uMouthP.z * IA;
  float open = uMouth * 0.014;
  float gx = abs(m.x) / w;
  // Öffnung zu den Mundwinkeln hin schmaler; Verschiebung nimmt zum Kinn hin ab
  float gapH = open * max(0.0, 1.0 - gx * gx);
  float fall = m.y < 0.0 ? 1.0 - smoothstep(uChin * 0.7, uChin * 1.4, -m.y) : 0.0;
  float gap = (m.y < 0.0 && gapH > 0.0) ? (1.0 - smoothstep(-gapH - 0.0015, -gapH + 0.0008, -m.y - 0.0)) : 0.0;
  gap = (m.y < 0.0 && -m.y < gapH) ? smoothstep(0.0, 0.0012, gapH + m.y) * smoothstep(0.0, 0.0008, -m.y) : 0.0;
  if (m.y < 0.0) uv = toUv(vec2(m.x, m.y + gapH * fall), uMouthP.xy, uMouthA);

  // Augen
  float l1, l2, d1, d2;
  uv = blink(uv, uEye1, uEyeA1, l1, d1);
  uv = blink(uv, uEye2, uEyeA2, l2, d2);

  vec3 col = texture2D(uTex, uv).rgb;
  // Lid etwas aufhellen: halb Lidschatten, halb Hautton unter dem Auge
  vec3 skin1 = texture2D(uTex, uEye1.xy - vec2(0.0, uEye1.w * 2.4)).rgb;
  vec3 skin2 = texture2D(uTex, uEye2.xy - vec2(0.0, uEye2.w * 2.4)).rgb;
  col = mix(col, mix(col, skin1, 0.3), d1);
  col = mix(col, mix(col, skin2, 0.3), d2);
  col *= 1.0 - 0.6 * max(l1, l2);
  // Mundinneres: dunkel, zur Mitte hin am dunkelsten
  float depth = gapH > 0.0 ? clamp(-m.y / max(gapH, 1e-4), 0.0, 1.0) : 0.0;
  vec3 inner = mix(vec3(0.32, 0.08, 0.08), vec3(0.09, 0.02, 0.03), sin(depth * 3.14159));
  col = mix(col, inner, gap * smoothstep(0.002, 0.008, open));

  // Schneefall
  vec2 s = vUv * vec2(IA, 1.0);
  float snow = 0.0;
  for (int i = 0; i < 3; i++) {
    float k = float(i);
    vec2 p = s * (7.0 + k * 5.0) + vec2(sin(uTime * 0.3 + k) * 0.6, uTime * (0.35 + k * 0.18));
    vec2 id = floor(p);
    vec2 f = fract(p) - 0.5;
    float h = hash(id + k * 17.0);
    vec2 o = vec2(h - 0.5, fract(h * 13.7) - 0.5) * 0.7;
    snow += step(0.72, h) * (1.0 - smoothstep(0.02, 0.06 - k * 0.012, length(f - o))) * (0.55 - k * 0.12);
  }
  col = mix(col, vec3(1.0), clamp(snow, 0.0, 0.7));

  // Vignette
  vec2 vq = vUv - 0.5;
  col *= 1.0 - 0.35 * dot(vq, vq) * 2.0;
  gl_FragColor = vec4(col, 1.0);
}
`;

export function LiveAvatar() {
  const host = useRef<HTMLDivElement>(null);
  const mode = useSanta((s) => s.mode);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    el.appendChild(renderer.domElement);
    const tex = new THREE.TextureLoader().load(new URL('avatar/mrs-claus.jpg', document.baseURI).href);
    // Shader gibt die Pixel unverändert aus – keine Farbraum-Umrechnung
    tex.colorSpace = THREE.NoColorSpace;
    tex.minFilter = THREE.LinearFilter;
    const v2 = (a: number[]) => new THREE.Vector2(a[0], a[1]);
    const eye = (e: (typeof FACE.eyes)[number]) => new THREE.Vector4(e.c[0], e.c[1], e.r[0], e.r[1]);
    const uniforms = {
      uTex: { value: tex },
      uTime: { value: 0 },
      uMouth: { value: 0 },
      uBlink: { value: 0 },
      uZoom: { value: 1 },
      uTilt: { value: 0 },
      uBreath: { value: 0 },
      uCenter: { value: new THREE.Vector2(0.5, 0.5) },
      uScale: { value: new THREE.Vector2(1, 1) },
      uSway: { value: new THREE.Vector2() },
      uEye1: { value: eye(FACE.eyes[0]) },
      uEye2: { value: eye(FACE.eyes[1]) },
      uEyeA1: { value: FACE.eyes[0].a },
      uEyeA2: { value: FACE.eyes[1].a },
      uMouthP: { value: new THREE.Vector3(FACE.mouth.c[0], FACE.mouth.c[1], FACE.mouth.w) },
      uMouthA: { value: FACE.mouth.a },
      uChin: { value: FACE.mouth.c[1] - FACE.chin[1] },
      uPivot: { value: v2(FACE.pivot) },
      uHead: { value: new THREE.Vector4(FACE.head.c[0], FACE.head.c[1], FACE.head.r[0], FACE.head.r[1]) },
    };
    const mat = new THREE.ShaderMaterial({ vertexShader: vert, fragmentShader: frag, uniforms, depthTest: false });
    const geo = new THREE.PlaneGeometry(2, 2);
    const scene = new THREE.Scene();
    scene.add(new THREE.Mesh(geo, mat));
    const camera = new THREE.Camera();

    const resize = () => {
      const w = el.clientWidth || window.innerWidth;
      const h = el.clientHeight || window.innerHeight;
      renderer.setSize(w, h, false);
      // „cover“: Bild (16:9) füllt den Bildschirm
      const sa = w / h / (16 / 9);
      uniforms.uScale.value.set(sa < 1 ? sa : 1, sa < 1 ? 1 : 1 / sa);
    };
    resize();
    window.addEventListener('resize', resize);

    const st = { mouth: 0, phase: 0, blinkAt: 2, zoom: 1, cx: 0.5, cy: 0.5 };
    const clock = new THREE.Clock();
    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(clock.getDelta(), 0.1);
      const t = clock.elapsedTime;
      const rt = santaRuntime;
      const now = performance.now();
      const g = rt.gesture;
      const age = g ? (now - g.at) / 1000 : 99;

      // Mund: Wortgrenzen der lokalen Stimme + Rauschen (wie Lippenbewegung)
      let target = 0;
      if (rt.speaking) {
        st.phase += dt * (9 + Math.sin(t * 2.3) * 2.5);
        const since = now - rt.lastBoundary;
        const boost = rt.lastBoundary > 0 && since < 380 ? 0.4 * (1 - since / 380) : 0;
        target = 0.15 + 0.55 * Math.abs(Math.sin(st.phase)) * (0.7 + 0.3 * Math.sin(t * 5.1)) + boost;
      }
      if (g?.kind === 'laugh' && age < 1.4) target = Math.max(target, 0.55 + 0.3 * Math.abs(Math.sin(t * 13)));
      st.mouth += (Math.min(1, target) - st.mouth) * Math.min(1, dt * 18);

      // Blinzeln alle 2–5 s
      if (t > st.blinkAt + 0.18) st.blinkAt = t + 2 + Math.random() * 3;
      const bt = (t - st.blinkAt) / 0.18;
      const blink = bt > 0 && bt < 1 ? Math.sin(bt * Math.PI) : 0;

      // Kopf: Atmen, leichtes Pendeln, Gesten
      let tilt = Math.sin(t * 0.45) * 0.012 + rt.look.x * 0.01;
      let sx = Math.sin(t * 0.31) * 0.0015 + rt.look.x * 0.002;
      let sy = Math.sin(t * 0.53) * 0.001;
      if (g?.kind === 'nod' && age < 1.2) sy += Math.sin(age * 11) * 0.004 * (1 - age / 1.2);
      if (g?.kind === 'shake' && age < 1.4) sx += Math.sin(age * 13) * 0.004 * (1 - age / 1.4);
      if (g?.kind === 'laugh' && age < 1.6) {
        sy -= 0.003 * Math.sin(Math.min(1, age / 0.3) * Math.PI * 0.5) * (1 - age / 1.6);
        tilt += Math.sin(age * 9) * 0.01;
      }
      if (age > 2) rt.gesture = null;

      // Kamera: Halbnah = ganzes Bild, Nah = Gesicht
      const close = rt.shot === 'close';
      const zt = close ? 1.65 : 1;
      st.zoom += (zt - st.zoom) * Math.min(1, dt * 1.6);
      const half = uniforms.uScale.value.clone().multiplyScalar(0.5 / st.zoom);
      const want = close ? FACE.closeCenter : [0.5, 0.5];
      st.cx += (THREE.MathUtils.clamp(want[0], half.x, 1 - half.x) - st.cx) * Math.min(1, dt * 1.6);
      st.cy += (THREE.MathUtils.clamp(want[1], half.y, 1 - half.y) - st.cy) * Math.min(1, dt * 1.6);

      uniforms.uTime.value = t;
      uniforms.uMouth.value = st.mouth;
      uniforms.uBlink.value = blink;
      uniforms.uTilt.value = tilt;
      uniforms.uSway.value.set(sx, sy);
      uniforms.uBreath.value = (Math.sin(t * 1.5) * 0.5 + 0.5) * 0.0025;
      uniforms.uZoom.value = st.zoom;
      uniforms.uCenter.value.set(st.cx, st.cy);
      renderer.render(scene, camera);

      // Sichtbar ausser bei Buch- und Raumaufnahmen
      el.style.opacity = rt.shot === 'book' || rt.shot === 'wide' ? '0' : '1';
    };
    loop();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      geo.dispose();
      mat.dispose();
      tex.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return <div ref={host} className={`avatar ${mode === 'santa' ? '' : 'is-off'}`} aria-hidden />;
}
