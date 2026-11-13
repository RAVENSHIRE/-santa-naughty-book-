import * as THREE from 'three';
import { cached, createCanvas, get2d, toTexture, valueNoise } from '../three/tex/canvas';

/**
 * Realistischeres Gesicht für Santa (alles prozedural, keine Fotos/Scans):
 * Kopfform mit Brauenbogen, Augenhöhlen, Wangenknochen und Nasenrücken,
 * gealterte Haut (Poren, Rötungen, Falten) als Farb- und Normal-Map, Iris-Textur.
 */

/** Skalierung der Kopf-Kugel (Radius 0.5) */
const HS = new THREE.Vector3(0.9, 1.02, 0.96);
/** Augenmitte (Kopf-Koordinaten) */
export const EYE = { x: 0.16, y: 0.075, z: 0.37, r: 0.052 };

type V3 = [number, number, number];
const bump = (p: THREE.Vector3, c: V3, s: V3) =>
  Math.exp(-(((p.x - c[0]) / s[0]) ** 2 + ((p.y - c[1]) / s[1]) ** 2 + ((p.z - c[2]) / s[2]) ** 2));

/** Kopfform. feminine = 1 → weicher: flacher Brauenbogen, feinere Nase, Kinn und schmaler Kiefer */
export function headGeometry(feminine = 0) {
  const m = 1 - feminine;
  const g = new THREE.SphereGeometry(0.5, 160, 120);
  g.scale(HS.x, HS.y, HS.z);
  const pos = g.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  const n = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    n.copy(v).normalize();
    let d = 0;
    for (const s of [1, -1]) {
      d -= 0.05 * bump(v, [s * EYE.x, EYE.y, 0.44], [0.075, 0.05, 0.14]); // Augenhöhle
      d += (0.01 + 0.014 * m) * bump(v, [s * 0.16, 0.158, 0.43], [0.11, 0.034, 0.14]); // Brauenbogen
      d += 0.02 * bump(v, [s * 0.25, -0.02, 0.38], [0.09, 0.06, 0.14]); // Wangenknochen
      d += (0.007 + 0.009 * m) * bump(v, [s * 0.165, 0.0, 0.44], [0.07, 0.032, 0.12]); // Tränensäcke
      d -= 0.035 * feminine * bump(v, [s * 0.3, -0.27, 0.22], [0.12, 0.14, 0.22]); // schmaler Kiefer
      d += 0.022 * bump(v, [s * 0.2, -0.12, 0.42], [0.09, 0.07, 0.12]); // runde Wangen
      d -= 0.016 * bump(v, [s * 0.38, 0.15, 0.2], [0.1, 0.1, 0.15]); // Schläfen
    }
    d += (0.012 + 0.018 * m) * bump(v, [0, 0.05, 0.47], [0.045, 0.09, 0.12]); // Nasenwurzel
    d += 0.022 * feminine * bump(v, [0, -0.38, 0.33], [0.1, 0.07, 0.14]); // Kinn
    d -= 0.012 * feminine * bump(v, [0, -0.31, 0.4], [0.07, 0.025, 0.1]); // Kinnfalte unter der Unterlippe
    if (v.z > 0) d -= 0.02 * Math.min(1, v.z / 0.48) ** 4; // flacheres Gesicht
    v.addScaledVector(n, d);
    // weibliche Kopfform: Unterkiefer läuft zum Kinn hin schmal zu
    if (feminine && v.y < -0.05) {
      const k = THREE.MathUtils.smoothstep(-v.y, 0.05, 0.5);
      v.x *= 1 - 0.24 * feminine * k;
      v.z *= 1 - 0.06 * feminine * k;
    }
    // kürzeres Untergesicht
    if (feminine && v.y < -0.15) v.y = -0.15 + (v.y + 0.15) * (1 - 0.18 * feminine);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

/** Vorderste Hautoberfläche (z) an Stelle x/y – um Lippen & Co. exakt aufzusetzen */
export function frontZ(g: THREE.BufferGeometry, x: number, y: number) {
  const pos = g.attributes.position as THREE.BufferAttribute;
  let best = -1;
  let z = 0;
  for (let i = 0; i < pos.count; i++) {
    const vz = pos.getZ(i);
    if (vz <= 0) continue;
    const d = (pos.getX(i) - x) ** 2 + (pos.getY(i) - y) ** 2;
    if (best < 0 || d < best) {
      best = d;
      z = vz;
    }
  }
  return z;
}

// ---------- Texturen ----------

const W = 1024;
const H = 512;

/** Punkt am Kopf (Kopf-Koordinaten) → Pixel in der Kugel-UV-Textur */
function uvPx(x: number, y: number, z = 0.45): [number, number] {
  const d = new THREE.Vector3(x / HS.x, y / HS.y, z / HS.z).normalize();
  let u = Math.atan2(d.z, -d.x) / (Math.PI * 2);
  if (u < 0) u += 1;
  const vv = Math.acos(THREE.MathUtils.clamp(d.y, -1, 1)) / Math.PI;
  return [u * W, vv * H];
}
/** Länge in Kopf-Einheiten → Pixel (nahe dem Äquator) */
const PX = W / (Math.PI * 2 * 0.5 * HS.x);

function mulberry(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Falten als Linien (Kopf-Koordinaten), in Farbe und Höhe gleich */
const WRINKLES: { pts: [number, number][]; w: number; a: number }[] = [];
for (const s of [1, -1]) {
  // Krähenfüsse
  for (let k = 0; k < 4; k++) {
    const y0 = EYE.y + 0.03 - k * 0.022;
    WRINKLES.push({ pts: [[s * 0.225, y0], [s * 0.26, y0 + (k - 1.5) * 0.008], [s * 0.3, y0 + (k - 1.5) * 0.02]], w: 1.4, a: 0.32 });
  }
  // Tränensäcke / Unterlid
  WRINKLES.push({ pts: [[s * 0.1, 0.035], [s * 0.16, 0.012], [s * 0.225, 0.03]], w: 1.6, a: 0.3 });
  WRINKLES.push({ pts: [[s * 0.11, 0.0], [s * 0.17, -0.02], [s * 0.235, 0.0]], w: 1.4, a: 0.22 });
  // Lidfalte oben
  WRINKLES.push({ pts: [[s * 0.1, 0.118], [s * 0.16, 0.135], [s * 0.225, 0.115]], w: 1.6, a: 0.3 });
  // Wangenfalte (Lachfalte, verschwindet im Bart)
  WRINKLES.push({ pts: [[s * 0.08, -0.06], [s * 0.12, -0.13], [s * 0.15, -0.2]], w: 2.2, a: 0.3 });
}
// Stirn
for (let k = 0; k < 3; k++) {
  const y = 0.21 + k * 0.022;
  WRINKLES.push({ pts: [[-0.2, y - 0.006], [-0.07, y + 0.004], [0.07, y + 0.002], [0.2, y - 0.007]], w: 1.5, a: 0.24 });
}
// Zornesfalte
WRINKLES.push({ pts: [[0.018, 0.17], [0.014, 0.12]], w: 1.4, a: 0.25 });
WRINKLES.push({ pts: [[-0.018, 0.17], [-0.014, 0.12]], w: 1.4, a: 0.25 });

function strokeWrinkles(g: CanvasRenderingContext2D, color: (a: number) => string, widthScale: number, strength = 1) {
  g.lineCap = 'round';
  g.lineJoin = 'round';
  for (const wr of WRINKLES) {
    const pts = wr.pts.map(([x, y]) => uvPx(x, y));
    g.strokeStyle = color(wr.a * strength);
    g.lineWidth = wr.w * widthScale;
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1]);
    if (pts.length === 2) g.lineTo(pts[1][0], pts[1][1]);
    for (let i = 1; i < pts.length - 1; i++) {
      const [x1, y1] = pts[i];
      const [x2, y2] = i === pts.length - 2 ? pts[i + 1] : [(pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2];
      g.quadraticCurveTo(x1, y1, x2, y2);
    }
    g.stroke();
  }
}

function blob(g: CanvasRenderingContext2D, x: number, y: number, r: number, rgba: [number, number, number, number], sy = 1) {
  const [px, py] = uvPx(x, y);
  const rp = r * PX;
  g.save();
  g.translate(px, py);
  g.scale(1, sy);
  const rg = g.createRadialGradient(0, 0, 0, 0, 0, rp);
  rg.addColorStop(0, `rgba(${rgba[0]},${rgba[1]},${rgba[2]},${rgba[3]})`);
  rg.addColorStop(1, `rgba(${rgba[0]},${rgba[1]},${rgba[2]},0)`);
  g.fillStyle = rg;
  g.fillRect(-rp, -rp, rp * 2, rp * 2);
  g.restore();
}

/** Haut: Grundton, Fleckigkeit, Rötungen, Altersflecken, Poren, Falten */
export function faceColorTexture(wrinkles = 1, base = '#e2a88d', blush = 1) {
  const c = createCanvas(W, H);
  const g = get2d(c);
  g.fillStyle = base;
  g.fillRect(0, 0, W, H);
  g.globalAlpha = 0.38;
  g.drawImage(cached('face-mottle', () => valueNoise(256, 12, 77, 4, [192, 116, 98], [246, 204, 182], 1.3)), 0, 0, W, H);
  g.globalAlpha = 0.18;
  g.drawImage(cached('face-mottle-fine', () => valueNoise(256, 48, 13, 2, [170, 96, 86], [250, 214, 196], 1.1)), 0, 0, W, H);
  g.globalAlpha = 1;
  for (const s of [1, -1]) {
    blob(g, s * 0.22, -0.07, 0.13, [214, 84, 76, 0.5 * blush]); // rote Wangen
    blob(g, s * 0.24, -0.03, 0.06, [200, 70, 70, 0.25 * wrinkles]); // Äderchen
    blob(g, s * EYE.x, 0.01, 0.05, [140, 80, 100, 0.16], 0.6); // Schatten unter den Augen
    blob(g, s * 0.32, 0.14, 0.08, [205, 120, 100, 0.18]); // Schläfen
  }
  blob(g, 0, -0.02, 0.07, [210, 90, 80, 0.35]); // um die Nase
  blob(g, 0, 0.2, 0.18, [214, 120, 100, 0.15]); // Stirn
  const rnd = mulberry(5);
  // Altersflecken (nur bei älterer Haut)
  for (let i = 0; i < 18 * Math.min(1, wrinkles * 2); i++) {
    const x = (rnd() - 0.5) * 0.7;
    const y = 0.12 + rnd() * 0.16;
    blob(g, x, y, 0.008 + rnd() * 0.012, [150, 92, 60, (0.18 + rnd() * 0.12) * wrinkles]);
  }
  // Poren / Unreinheiten
  for (let i = 0; i < 9000; i++) {
    const x = rnd() * W;
    const y = H * (0.25 + rnd() * 0.45);
    g.fillStyle = rnd() > 0.5 ? 'rgba(120, 60, 50, 0.08)' : 'rgba(255, 230, 215, 0.06)';
    g.fillRect(x, y, 1.2, 1.2);
  }
  strokeWrinkles(g, (a) => `rgba(130, 64, 52, ${a})`, 1, wrinkles);
  // Glanzlinie oberhalb der Falten (wirkt plastischer)
  g.translate(0, -1.2);
  strokeWrinkles(g, (a) => `rgba(255, 220, 200, ${a * 0.35})`, 0.7, wrinkles);
  g.setTransform(1, 0, 0, 1, 0, 0);
  return toTexture(c);
}

/** Normal-Map aus einer Höhenkarte (Falten = Rillen, Poren = feines Rauschen) */
export function faceNormalTexture(wrinkles = 1) {
  const c = createCanvas(W, H);
  const g = get2d(c);
  g.fillStyle = 'rgb(128,128,128)';
  g.fillRect(0, 0, W, H);
  g.globalAlpha = 0.5;
  g.drawImage(cached('face-pores', () => valueNoise(256, 96, 31, 2, [108, 108, 108], [148, 148, 148], 1)), 0, 0, W, H);
  g.globalAlpha = 1;
  strokeWrinkles(g, (a) => `rgba(40,40,40,${Math.min(1, a * 2.6)})`, 1.8, wrinkles);
  const src = g.getImageData(0, 0, W, H).data;
  const out = g.createImageData(W, H);
  const h = (x: number, y: number) => src[(((y + H) % H) * W + ((x + W) % W)) * 4] / 255;
  const k = 3.2;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const dx = (h(x + 1, y) - h(x - 1, y)) * k;
      const dy = (h(x, y + 1) - h(x, y - 1)) * k;
      const len = Math.hypot(dx, dy, 1);
      const i = (y * W + x) * 4;
      out.data[i] = ((-dx / len) * 0.5 + 0.5) * 255;
      out.data[i + 1] = ((dy / len) * 0.5 + 0.5) * 255;
      out.data[i + 2] = ((1 / len) * 0.5 + 0.5) * 255;
      out.data[i + 3] = 255;
    }
  }
  g.putImageData(out, 0, 0);
  return toTexture(c, { srgb: false });
}

/** Iris als gewölbte Kappe auf dem Augapfel (UV radial, passend zu irisTexture) */
export function irisGeometry(irisR = 0.0255) {
  const r = EYE.r + 0.0006;
  const theta = Math.asin(irisR / r);
  const g = new THREE.SphereGeometry(r, 40, 12, 0, Math.PI * 2, 0, theta);
  g.rotateX(Math.PI / 2); // Pol zeigt nach vorne (+z)
  const pos = g.attributes.position as THREE.BufferAttribute;
  const uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / irisR / 2 + 0.5, pos.getY(i) / irisR / 2 + 0.5);
  uv.needsUpdate = true;
  return g;
}

/** Iris: blau-grau mit radialen Fasern, dunklem Rand und Pupille */
export function irisTexture(colors: [string, string, string] = ['#7d93a6', '#5f7f9f', '#3d5874']) {
  const S = 256;
  const c = createCanvas(S, S);
  const g = get2d(c);
  const m = S / 2;
  const base = g.createRadialGradient(m, m, 0, m, m, m);
  base.addColorStop(0, '#2b3d4f');
  base.addColorStop(0.32, colors[0]);
  base.addColorStop(0.62, colors[1]);
  base.addColorStop(0.86, colors[2]);
  base.addColorStop(1, '#1b2633');
  g.fillStyle = base;
  g.fillRect(0, 0, S, S);
  const rnd = mulberry(9);
  for (let i = 0; i < 260; i++) {
    const a = rnd() * Math.PI * 2;
    const r0 = m * (0.3 + rnd() * 0.15);
    const r1 = m * (0.7 + rnd() * 0.28);
    g.strokeStyle = rnd() > 0.5 ? `rgba(210, 225, 235, ${0.08 + rnd() * 0.15})` : `rgba(20, 35, 50, ${0.1 + rnd() * 0.2})`;
    g.lineWidth = 0.8 + rnd() * 1.5;
    g.beginPath();
    g.moveTo(m + Math.cos(a) * r0, m + Math.sin(a) * r0);
    g.lineTo(m + Math.cos(a + (rnd() - 0.5) * 0.12) * r1, m + Math.sin(a + (rnd() - 0.5) * 0.12) * r1);
    g.stroke();
  }
  // goldener Kranz um die Pupille
  g.strokeStyle = 'rgba(190, 160, 110, 0.35)';
  g.lineWidth = m * 0.08;
  g.beginPath();
  g.arc(m, m, m * 0.4, 0, Math.PI * 2);
  g.stroke();
  // Limbus
  g.strokeStyle = 'rgba(12, 18, 26, 0.85)';
  g.lineWidth = m * 0.08;
  g.beginPath();
  g.arc(m, m, m * 0.96, 0, Math.PI * 2);
  g.stroke();
  // Pupille
  g.fillStyle = '#050608';
  g.beginPath();
  g.arc(m, m, m * 0.32, 0, Math.PI * 2);
  g.fill();
  return toTexture(c);
}

/** Augapfel: leicht cremig mit rosa Rand und feinen Äderchen */
export function scleraTexture() {
  const c = createCanvas(256, 128);
  const g = get2d(c);
  g.fillStyle = '#ece3d8';
  g.fillRect(0, 0, 256, 128);
  // u = 0.25 ist vorne → Rand (seitlich) rötlicher
  const grad = g.createLinearGradient(0, 0, 256, 0);
  grad.addColorStop(0, 'rgba(220,150,140,0.5)');
  grad.addColorStop(0.15, 'rgba(220,150,140,0.0)');
  grad.addColorStop(0.35, 'rgba(220,150,140,0.0)');
  grad.addColorStop(0.5, 'rgba(220,150,140,0.5)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 128);
  const rnd = mulberry(3);
  g.strokeStyle = 'rgba(190, 70, 70, 0.25)';
  g.lineWidth = 0.7;
  for (let i = 0; i < 26; i++) {
    let x = rnd() > 0.5 ? 64 + 30 + rnd() * 20 : 64 - 30 - rnd() * 20;
    let y = 40 + rnd() * 48;
    g.beginPath();
    g.moveTo(x, y);
    for (let k = 0; k < 4; k++) {
      x += (x > 64 ? -1 : 1) * (3 + rnd() * 5);
      y += (rnd() - 0.5) * 6;
      g.lineTo(x, y);
    }
    g.stroke();
  }
  return toTexture(c);
}
