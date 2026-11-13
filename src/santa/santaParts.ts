import * as THREE from 'three';
import { QUALITY } from '../config';
import { palette } from '../theme';
import { makeFurMaterial, makeFurMesh } from '../three/materials';
import { cached, createCanvas, get2d, toTexture, valueNoise } from '../three/tex/canvas';
import { font } from '../three/tex/draw2d';
import { parchmentBase } from '../three/tex/pageArt';

/** Rumpf aus einem Profil (Radius über Höhe), vorne/hinten etwas flacher */
export const BODY_DEPTH = 0.82;

export function profileBody(profile: [number, number][]) {
  const pts = new THREE.SplineCurve(profile.map(([r, y]) => new THREE.Vector2(r, y))).getPoints(80);
  const radius = (y: number) => {
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      if ((y >= a.y && y <= b.y) || (y <= a.y && y >= b.y)) return a.x + ((b.x - a.x) * (y - a.y)) / (b.y - a.y || 1);
    }
    return 0;
  };
  /** Ring/Band um den Rumpf zwischen y0 und y1 (Gürtel, Schürze …) */
  const band = (y0: number, y1: number, offset: number, phiStart = 0, phiLength = Math.PI * 2) => {
    const ring: THREE.Vector2[] = [];
    for (let i = 0; i <= 8; i++) {
      const y = y0 + ((y1 - y0) * i) / 8;
      ring.push(new THREE.Vector2(radius(y) + offset, y));
    }
    return lathe(ring, phiStart, phiLength);
  };
  return { geometry: lathe(pts), radius, band };
}

function lathe(pts: THREE.Vector2[], phiStart = 0, phiLength = Math.PI * 2) {
  const g = new THREE.LatheGeometry(pts, 64, phiStart, phiLength);
  g.scale(1, 1, BODY_DEPTH);
  g.computeVertexNormals();
  return g;
}

export function tubeGeometry(points: [number, number, number][], radius: number, segs = 48, radial = 12) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  return new THREE.TubeGeometry(curve, segs, radius, radial, false);
}

const SPHERE = new THREE.SphereGeometry(1, 40, 28);

/**
 * Fell-Ellipsoid (Bart, Haare, Kragen …). Länge und Dichte werden an die Grösse angepasst,
 * damit die Haare überall ähnlich fein aussehen.
 */
type FurOpts = { length?: number; spacing?: number; droop?: number; color?: string; curl?: number; tint?: number };

export function furBlob(radii: [number, number, number], opts: FurOpts = {}) {
  const [rx, ry, rz] = radii;
  const avg = (rx + ry + rz) / 3;
  const spacing = opts.spacing ?? 0.0075;
  const mat = makeFurMaterial({
    length: (opts.length ?? 0.07) / avg,
    density: [(Math.PI * (rx + rz)) / spacing, (Math.PI * ry) / spacing],
    shells: QUALITY.furShells,
    droop: opts.droop ?? 0.5,
    color: opts.color ?? palette.fur,
    curl: opts.curl,
    tint: opts.tint,
  });
  const mesh = makeFurMesh(SPHERE, mat, QUALITY.furShells);
  mesh.scale.set(rx, ry, rz);
  return mesh;
}

/** Fell entlang einer Kurve (Schnauz, Augenbrauen, Pelzkante) */
export function furTube(
  points: [number, number, number][],
  radius: number,
  opts: FurOpts = {},
) {
  const geo = tubeGeometry(points, radius, 64, 14);
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  const len = curve.getLength();
  const spacing = opts.spacing ?? 0.0075;
  const mat = makeFurMaterial({
    length: opts.length ?? 0.05,
    density: [len / spacing, (2 * Math.PI * radius) / spacing],
    shells: QUALITY.furShells,
    droop: opts.droop ?? 0.3,
    color: opts.color ?? palette.fur,
    curl: opts.curl,
    tint: opts.tint,
  });
  return makeFurMesh(geo, mat, QUALITY.furShells);
}

export function furTorus(R: number, r: number, opts: { length?: number; spacing?: number; droop?: number } = {}) {
  const geo = new THREE.TorusGeometry(R, r, 20, 72);
  const spacing = opts.spacing ?? 0.0085;
  const mat = makeFurMaterial({
    length: opts.length ?? 0.07,
    density: [(2 * Math.PI * R) / spacing, (2 * Math.PI * r) / spacing],
    shells: QUALITY.furShells,
    droop: opts.droop ?? 0.25,
  });
  return makeFurMesh(geo, mat, QUALITY.furShells);
}

/** Haut mit roten Wangen und leicht geröteter Nase */
export function skinTexture() {
  const c = createCanvas(512, 256);
  const g = get2d(c);
  g.fillStyle = '#efc0a2';
  g.fillRect(0, 0, 512, 256);
  g.globalAlpha = 0.3;
  g.drawImage(cached('skin-noise', () => valueNoise(128, 10, 21, 3, [214, 140, 118], [255, 226, 206], 1.2)), 0, 0, 512, 256);
  g.globalAlpha = 1;
  const blush = (u: number, v: number, r: number, a: number) => {
    const x = u * 512;
    const y = v * 256;
    const rg = g.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, `rgba(222, 96, 88, ${a})`);
    rg.addColorStop(1, 'rgba(222, 96, 88, 0)');
    g.fillStyle = rg;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  };
  blush(0.168, 0.57, 44, 0.6);
  blush(0.332, 0.57, 44, 0.6);
  blush(0.25, 0.52, 26, 0.35);
  // feine Lachfalten an den Augen
  g.strokeStyle = 'rgba(150, 80, 60, 0.18)';
  g.lineWidth = 1.2;
  for (const [u, dir] of [
    [0.13, -1],
    [0.37, 1],
  ] as const) {
    for (let k = 0; k < 3; k++) {
      g.beginPath();
      g.moveTo(u * 512, 0.43 * 256 + k * 5);
      g.quadraticCurveTo(u * 512 + dir * 10, 0.43 * 256 + k * 5 + 2, u * 512 + dir * 18, 0.44 * 256 + k * 7);
      g.stroke();
    }
  }
  return toTexture(c);
}

/** Santas Liste (die Seite, die er in der Hand hält – wie auf dem Foto) */
export function listTexture(names: string[], title: string) {
  const w = 384;
  const h = 512;
  const c = createCanvas(w, h);
  const g = get2d(c);
  g.drawImage(parchmentBase(384, 513, 'right'), 0, 0, w, h);
  g.fillStyle = '#2b1a0f';
  g.textAlign = 'center';
  g.font = font.script(44);
  g.fillText(title, w / 2, 70);
  g.font = font.body(24);
  g.textAlign = 'left';
  names.slice(0, 14).forEach((n, i) => {
    g.fillText(`${i + 1}. ${n}`, 54, 130 + i * 28);
  });
  return toTexture(c);
}

export function paperGeometry(w: number, h: number) {
  const g = new THREE.PlaneGeometry(w, h, 6, 10);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    pos.setZ(i, 0.05 * Math.sin((y / h) * Math.PI * 0.9 + 0.4) + 0.03 * (x / w) * (x / w));
  }
  g.computeVertexNormals();
  return g;
}
