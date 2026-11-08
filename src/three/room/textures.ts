import { cached, createCanvas, get2d, mulberry32, valueNoise } from '../tex/canvas';

type RGB = [number, number, number];

/** Holzmaserung (kachelbar, dezent) */
export function woodCanvas(seed: number, base: RGB, dark: RGB, size = 512, rings = 34): HTMLCanvasElement {
  return cached(`wood:${seed}:${base}:${dark}:${size}:${rings}`, () => {
    const c = createCanvas(size, size);
    const ctx = get2d(c);
    const img = ctx.createImageData(size, size);
    const rand = mulberry32(seed);
    const ph = Array.from({ length: 6 }, () => rand() * Math.PI * 2);
    const TAU = Math.PI * 2;
    const grainRand = mulberry32(seed + 1);
    const low = valueNoise(64, 3, seed + 2, 3);
    const lowData = get2d(low).getImageData(0, 0, 64, 64).data;
    for (let y = 0; y < size; y++) {
      const v = y / size;
      for (let x = 0; x < size; x++) {
        const u = x / size;
        const lv = lowData[((Math.floor(v * 64) % 64) * 64 + (Math.floor(u * 64) % 64)) * 4] / 255;
        const warp = Math.sin(u * TAU + ph[0]) * 0.012 + Math.sin(u * TAU * 3 + ph[1]) * 0.004 + (lv - 0.5) * 0.03;
        const r = (v + warp) * rings + Math.sin(u * TAU * 2 + ph[2]) * 0.35;
        const fr = r - Math.floor(r);
        const late = fr < 0.78 ? fr / 0.78 : 1 - (fr - 0.78) / 0.22;
        const g = Math.pow(late, 3);
        const fine = 0.5 + 0.5 * Math.sin(v * TAU * 157 + ph[3] + Math.sin(u * TAU * 4) * 2);
        const k = Math.min(1, 0.32 * g + 0.1 * fine + 0.1 * grainRand() + 0.25 * lv);
        const i = (y * size + x) * 4;
        img.data[i] = base[0] + (dark[0] - base[0]) * k;
        img.data[i + 1] = base[1] + (dark[1] - base[1]) * k;
        img.data[i + 2] = base[2] + (dark[2] - base[2]) * k;
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  });
}

/** Holzdielen */
export function floorCanvas(): HTMLCanvasElement {
  return cached('floor', () => {
    const size = 512;
    const c = createCanvas(size, size);
    const ctx = get2d(c);
    const wood = woodCanvas(31, [96, 56, 32], [44, 22, 12], 512, 26);
    const rand = mulberry32(8);
    const planks = 6;
    const pw = size / planks;
    for (let p = 0; p < planks; p++) {
      const off = rand() * size;
      ctx.save();
      ctx.beginPath();
      ctx.rect(p * pw, 0, pw, size);
      ctx.clip();
      ctx.translate(p * pw, 0);
      ctx.rotate(Math.PI / 2);
      ctx.drawImage(wood, -off, -pw, size, size);
      ctx.drawImage(wood, -off + size, -pw, size, size);
      ctx.restore();
      ctx.fillStyle = `rgba(0,0,0,${0.05 + rand() * 0.15})`;
      ctx.fillRect(p * pw, 0, pw, size);
      ctx.fillStyle = 'rgba(10, 4, 2, 0.85)';
      ctx.fillRect(p * pw, 0, 2, size);
      const seam = rand() * size;
      ctx.fillRect(p * pw, seam, pw, 2);
    }
    return c;
  });
}

/** Warmer Verputz */
export function plasterCanvas(): HTMLCanvasElement {
  return cached('plaster', () => valueNoise(256, 8, 4, 5, [150, 118, 88], [196, 166, 128], 1.3));
}

/** Backsteine im Kamin, oben verrusst */
export function brickCanvas(): HTMLCanvasElement {
  return cached('brick', () => {
    const w = 512;
    const h = 512;
    const c = createCanvas(w, h);
    const ctx = get2d(c);
    ctx.fillStyle = '#2a1a14';
    ctx.fillRect(0, 0, w, h);
    const rand = mulberry32(17);
    const bh = 32;
    const bw = 96;
    for (let row = 0; row < h / bh; row++) {
      const off = row % 2 ? bw / 2 : 0;
      for (let col = -1; col < w / bw + 1; col++) {
        const x = col * bw + off;
        const y = row * bh;
        const r = 92 + rand() * 50;
        const g = 40 + rand() * 22;
        const b = 26 + rand() * 14;
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(x + 3, y + 3, bw - 6, bh - 6);
        ctx.fillStyle = `rgba(0,0,0,${rand() * 0.25})`;
        ctx.fillRect(x + 3, y + 3, bw - 6, bh - 6);
      }
    }
    const soot = ctx.createLinearGradient(0, 0, 0, h);
    soot.addColorStop(0, 'rgba(5,3,2,0.92)');
    soot.addColorStop(0.55, 'rgba(5,3,2,0.55)');
    soot.addColorStop(1, 'rgba(5,3,2,0.15)');
    ctx.fillStyle = soot;
    ctx.fillRect(0, 0, w, h);
    return c;
  });
}

/** Nacht vor dem Fenster: Dunkelblau, Bokeh-Lichter, verschneite Tannen */
export function nightCanvas(): HTMLCanvasElement {
  return cached('night', () => {
    const w = 512;
    const h = 640;
    const c = createCanvas(w, h);
    const ctx = get2d(c);
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#050c14');
    g.addColorStop(0.6, '#0d2230');
    g.addColorStop(1, '#1b3a44');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    const rand = mulberry32(5);
    // Sterne
    for (let i = 0; i < 90; i++) {
      ctx.fillStyle = `rgba(220,235,255,${0.2 + rand() * 0.6})`;
      ctx.fillRect(rand() * w, rand() * h * 0.5, 1.5, 1.5);
    }
    // Tannen
    for (let i = 0; i < 9; i++) {
      const x = rand() * w;
      const base = h * (0.8 + rand() * 0.12);
      const th = 120 + rand() * 160;
      const tw = th * 0.42;
      ctx.fillStyle = `rgb(${8 + rand() * 6},${20 + rand() * 10},${24 + rand() * 8})`;
      for (let k = 0; k < 4; k++) {
        const y0 = base - th * (k / 4);
        const ww = tw * (1 - k / 5);
        ctx.beginPath();
        ctx.moveTo(x - ww / 2, y0);
        ctx.lineTo(x + ww / 2, y0);
        ctx.lineTo(x, y0 - th * 0.42);
        ctx.closePath();
        ctx.fill();
      }
      ctx.fillStyle = 'rgba(200,220,235,0.18)';
      ctx.beginPath();
      ctx.moveTo(x - tw * 0.2, base - th * 0.6);
      ctx.lineTo(x, base - th * 0.95);
      ctx.lineTo(x + tw * 0.16, base - th * 0.62);
      ctx.closePath();
      ctx.fill();
    }
    // Schnee am Boden
    const sg = ctx.createLinearGradient(0, h * 0.86, 0, h);
    sg.addColorStop(0, 'rgba(150,175,190,0.0)');
    sg.addColorStop(0.3, 'rgba(150,175,190,0.55)');
    sg.addColorStop(1, 'rgba(190,210,222,0.8)');
    ctx.fillStyle = sg;
    ctx.fillRect(0, h * 0.86, w, h * 0.14);
    // Bokeh (wie die Lichter im Fenster auf dem Foto)
    const colors = ['120,255,190', '90,220,255', '255,210,140', '160,255,150'];
    for (let i = 0; i < 26; i++) {
      const x = rand() * w;
      const y = h * (0.25 + rand() * 0.6);
      const r = 6 + rand() * 20;
      const col = colors[Math.floor(rand() * colors.length)];
      const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
      rg.addColorStop(0, `rgba(${col},${0.55 + rand() * 0.35})`);
      rg.addColorStop(0.6, `rgba(${col},0.25)`);
      rg.addColorStop(1, `rgba(${col},0)`);
      ctx.fillStyle = rg;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    return c;
  });
}

/** Kleine sepiafarbene Winterlandschaft für die Bilderrahmen */
export function pictureCanvas(seed: number): HTMLCanvasElement {
  return cached(`picture:${seed}`, () => {
    const w = 256;
    const h = 320;
    const c = createCanvas(w, h);
    const ctx = get2d(c);
    const rand = mulberry32(seed);
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#3b2c1e');
    g.addColorStop(0.55, '#a8875e');
    g.addColorStop(1, '#e8d4ae');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(255,240,210,0.85)';
    ctx.beginPath();
    ctx.arc(w * (0.2 + rand() * 0.6), h * (0.15 + rand() * 0.15), 16 + rand() * 10, 0, Math.PI * 2);
    ctx.fill();
    for (let layer = 0; layer < 3; layer++) {
      const base = h * (0.55 + layer * 0.14);
      ctx.fillStyle = ['#7a5d3e', '#5a4128', '#3a2817'][layer];
      ctx.beginPath();
      ctx.moveTo(0, h);
      for (let x = 0; x <= w; x += 16) ctx.lineTo(x, base + Math.sin(x * 0.03 + rand() * 6) * 14 - rand() * 8);
      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fill();
    }
    for (let i = 0; i < 5; i++) {
      const x = rand() * w;
      const y = h * (0.72 + rand() * 0.15);
      const th = 40 + rand() * 50;
      ctx.fillStyle = '#21160c';
      ctx.beginPath();
      ctx.moveTo(x - th * 0.22, y);
      ctx.lineTo(x + th * 0.22, y);
      ctx.lineTo(x, y - th);
      ctx.closePath();
      ctx.fill();
    }
    // Hütte mit warmem Fenster
    const hx = w * (0.3 + rand() * 0.4);
    const hy = h * 0.8;
    ctx.fillStyle = '#2b1d10';
    ctx.fillRect(hx - 24, hy - 26, 48, 26);
    ctx.beginPath();
    ctx.moveTo(hx - 30, hy - 24);
    ctx.lineTo(hx, hy - 48);
    ctx.lineTo(hx + 30, hy - 24);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffcf7a';
    ctx.fillRect(hx - 8, hy - 18, 10, 9);
    const vg = ctx.createRadialGradient(w / 2, h / 2, w * 0.2, w / 2, h / 2, w * 0.8);
    vg.addColorStop(0, 'rgba(40,25,10,0)');
    vg.addColorStop(1, 'rgba(40,25,10,0.6)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, w, h);
    return c;
  });
}

/** Geschmiedetes Kamingitter mit Schnörkeln (Alpha in der Textur) */
export function screenCanvas(): HTMLCanvasElement {
  return cached('firescreen', () => {
    const w = 1024;
    const h = 768;
    const c = createCanvas(w, h);
    const ctx = get2d(c);
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = '#000';
    ctx.fillStyle = '#000';
    // feines Gitter
    ctx.globalAlpha = 0.32;
    ctx.lineWidth = 1.4;
    for (let x = 40; x < w - 40; x += 9) {
      ctx.beginPath();
      ctx.moveTo(x, 210);
      ctx.lineTo(x, h - 40);
      ctx.stroke();
    }
    for (let y = 210; y < h - 40; y += 9) {
      ctx.beginPath();
      ctx.moveTo(40, y);
      ctx.lineTo(w - 40, y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.lineWidth = 16;
    ctx.strokeRect(36, 206, w - 72, h - 242);
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(w * 0.33, 206);
    ctx.lineTo(w * 0.33, h - 36);
    ctx.moveTo(w * 0.67, 206);
    ctx.lineTo(w * 0.67, h - 36);
    ctx.stroke();
    // Schnörkel oben
    ctx.lineWidth = 9;
    ctx.lineCap = 'round';
    const scroll = (x: number, y: number, s: number, dir: number) => {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.bezierCurveTo(x + dir * s * 0.5, y - s * 0.9, x + dir * s * 1.4, y - s * 0.8, x + dir * s * 1.5, y - s * 0.25);
      ctx.bezierCurveTo(x + dir * s * 1.55, y + s * 0.15, x + dir * s * 1.15, y + s * 0.2, x + dir * s * 1.1, y - s * 0.1);
      ctx.bezierCurveTo(x + dir * s * 1.08, y - s * 0.3, x + dir * s * 1.3, y - s * 0.32, x + dir * s * 1.3, y - s * 0.18);
      ctx.stroke();
    };
    for (let i = 0; i < 6; i++) {
      const x = 90 + i * ((w - 180) / 5);
      scroll(x, 200, 62, i % 2 ? -1 : 1);
    }
    ctx.beginPath();
    ctx.moveTo(60, 200);
    ctx.bezierCurveTo(w * 0.3, 40, w * 0.7, 40, w - 60, 200);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(w / 2, 92, 16, 0, Math.PI * 2);
    ctx.fill();
    for (const x of [36, w - 36, w * 0.33, w * 0.67]) {
      ctx.beginPath();
      ctx.arc(x, h - 30, 16, 0, Math.PI * 2);
      ctx.fill();
    }
    return c;
  });
}

/** Keks mit Schokostückchen */
export function cookieCanvas(seed: number): HTMLCanvasElement {
  return cached(`cookie:${seed}`, () => {
    const s = 256;
    const c = createCanvas(s, s);
    const ctx = get2d(c);
    const rand = mulberry32(seed);
    const g = ctx.createRadialGradient(s / 2, s / 2, 10, s / 2, s / 2, s / 2);
    g.addColorStop(0, '#d9a45c');
    g.addColorStop(0.75, '#c58a42');
    g.addColorStop(1, '#8a5524');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 14; i++) {
      ctx.fillStyle = '#3a1d0c';
      ctx.beginPath();
      const x = s * (0.2 + rand() * 0.6);
      const y = s * (0.2 + rand() * 0.6);
      ctx.ellipse(x, y, 7 + rand() * 7, 6 + rand() * 6, rand() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(90,50,20,0.5)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 8; i++) {
      ctx.beginPath();
      const x = s * (0.15 + rand() * 0.7);
      const y = s * (0.15 + rand() * 0.7);
      ctx.moveTo(x, y);
      ctx.lineTo(x + rand() * 30 - 15, y + rand() * 30 - 15);
      ctx.stroke();
    }
    return c;
  });
}
