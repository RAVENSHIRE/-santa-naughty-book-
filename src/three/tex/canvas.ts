import * as THREE from 'three';

/** Kleiner deterministischer Zufallsgenerator */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

export function get2d(c: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D nicht verfügbar');
  return ctx;
}

let maxAnisotropy = 8;
export const setMaxAnisotropy = (v: number) => {
  maxAnisotropy = Math.max(1, Math.min(16, v));
};

export function toTexture(
  canvas: HTMLCanvasElement,
  opts: { srgb?: boolean; repeat?: [number, number]; anisotropy?: number } = {},
): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = opts.srgb === false ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  t.anisotropy = opts.anisotropy ?? maxAnisotropy;
  if (opts.repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(opts.repeat[0], opts.repeat[1]);
  }
  t.needsUpdate = true;
  return t;
}

type RGB = [number, number, number];

/**
 * Kachelbares Value-Noise (fBm) als Canvas.
 * Farbe = mix(colA, colB, noise).
 */
export function valueNoise(
  n: number,
  cells: number,
  seed: number,
  octaves = 3,
  colA: RGB = [0, 0, 0],
  colB: RGB = [255, 255, 255],
  contrast = 1,
): HTMLCanvasElement {
  const rand = mulberry32(seed);
  const acc = new Float32Array(n * n);
  let amp = 1;
  let total = 0;
  for (let o = 0; o < octaves; o++) {
    const g = cells << o;
    const stride = g + 1;
    const grid = new Float32Array(stride * stride);
    for (let i = 0; i < grid.length; i++) grid[i] = rand();
    for (let y = 0; y <= g; y++) grid[y * stride + g] = grid[y * stride];
    for (let x = 0; x <= g; x++) grid[g * stride + x] = grid[x];
    for (let y = 0; y < n; y++) {
      const fy = (y / n) * g;
      const iy = Math.floor(fy);
      const ty = fy - iy;
      const sy = ty * ty * (3 - 2 * ty);
      for (let x = 0; x < n; x++) {
        const fx = (x / n) * g;
        const ix = Math.floor(fx);
        const tx = fx - ix;
        const sx = tx * tx * (3 - 2 * tx);
        const a = grid[iy * stride + ix];
        const b = grid[iy * stride + ix + 1];
        const c = grid[(iy + 1) * stride + ix];
        const d = grid[(iy + 1) * stride + ix + 1];
        const top = a + (b - a) * sx;
        const bot = c + (d - c) * sx;
        acc[y * n + x] += amp * (top + (bot - top) * sy);
      }
    }
    total += amp;
    amp *= 0.5;
  }
  const canvas = createCanvas(n, n);
  const ctx = get2d(canvas);
  const img = ctx.createImageData(n, n);
  for (let i = 0; i < n * n; i++) {
    let v = acc[i] / total;
    v = Math.min(1, Math.max(0, (v - 0.5) * contrast + 0.5));
    img.data[i * 4] = colA[0] + (colB[0] - colA[0]) * v;
    img.data[i * 4 + 1] = colA[1] + (colB[1] - colA[1]) * v;
    img.data[i * 4 + 2] = colA[2] + (colB[2] - colA[2]) * v;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

/** Feines Korn (pro Pixel zufällig) */
export function grain(n: number, seed: number, lo = 200, hi = 255, tint: RGB = [1, 1, 1]): HTMLCanvasElement {
  const rand = mulberry32(seed);
  const canvas = createCanvas(n, n);
  const ctx = get2d(canvas);
  const img = ctx.createImageData(n, n);
  for (let i = 0; i < n * n; i++) {
    const v = lo + (hi - lo) * rand();
    img.data[i * 4] = v * tint[0];
    img.data[i * 4 + 1] = v * tint[1];
    img.data[i * 4 + 2] = v * tint[2];
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

const memo = new Map<string, HTMLCanvasElement>();
/** Teure Canvas-Erzeugung nur einmal pro Schlüssel */
export function cached(key: string, make: () => HTMLCanvasElement): HTMLCanvasElement {
  let c = memo.get(key);
  if (!c) {
    c = make();
    memo.set(key, c);
  }
  return c;
}

/** Einfacher Canvas-Pool, damit beim Blättern nicht ständig neuer Speicher entsteht */
const pool: HTMLCanvasElement[] = [];
export function acquireCanvas(w: number, h: number): HTMLCanvasElement {
  const i = pool.findIndex((c) => c.width === w && c.height === h);
  if (i >= 0) return pool.splice(i, 1)[0];
  return createCanvas(w, h);
}
export function releaseCanvas(c: HTMLCanvasElement) {
  if (pool.length < 8) pool.push(c);
}
