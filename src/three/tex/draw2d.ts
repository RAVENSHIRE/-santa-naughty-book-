import { createCanvas, get2d, mulberry32 } from './canvas';

type Ctx = CanvasRenderingContext2D;

export const INK = '#2b1a0f';
export const INK_SOFT = 'rgba(43, 26, 15, 0.72)';
export const INK_RED = '#8c1217';
export const INK_GREEN = '#235029';
export const INK_AMBER = '#8a5a0c';

export const font = {
  title: (w: number, s: number) => `${w} ${s}px "Cinzel Decorative", "Cinzel", Georgia, serif`,
  heading: (w: number, s: number) => `${w} ${s}px "Cinzel", Georgia, serif`,
  script: (s: number) => `400 ${s}px "Great Vibes", cursive`,
  body: (s: number, italic = false) => `${italic ? 'italic ' : ''}400 ${s}px "IM Fell English", Georgia, serif`,
};

export function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Setzt die grösste Schriftgrösse, bei der der Text in maxW passt */
export function fitFont(ctx: Ctx, text: string, maxW: number, maxSize: number, minSize: number, make: (s: number) => string) {
  let size = maxSize;
  ctx.font = make(size);
  const w = ctx.measureText(text).width;
  if (w > maxW) size = Math.max(minSize, Math.floor((size * maxW) / w));
  ctx.font = make(size);
  return size;
}

/** Zeilenumbruch nach Wörtern; überlange Wörter werden hart getrennt */
export function wrapText(ctx: Ctx, text: string, maxW: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  const pushHard = (word: string) => {
    let part = '';
    for (const ch of word) {
      if (ctx.measureText(part + ch).width > maxW && part) {
        lines.push(part);
        part = ch;
      } else part += ch;
    }
    return part;
  };
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width <= maxW) {
      line = test;
    } else if (!line) {
      line = pushHard(w);
    } else {
      lines.push(line);
      line = ctx.measureText(w).width > maxW ? pushHard(w) : w;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** Text mit Laufweite (zentriert um x) */
export function spacedText(ctx: Ctx, text: string, x: number, y: number, spacing: number) {
  const chars = [...text];
  const widths = chars.map((c) => ctx.measureText(c).width);
  const total = widths.reduce((a, b) => a + b, 0) + spacing * (chars.length - 1);
  const prevAlign = ctx.textAlign;
  ctx.textAlign = 'left';
  let cx = x - total / 2;
  chars.forEach((c, i) => {
    ctx.fillText(c, cx, y);
    cx += widths[i] + spacing;
  });
  ctx.textAlign = prevAlign;
  return total;
}

export function star(ctx: Ctx, cx: number, cy: number, r: number, points = 5, inner = 0.45, rot = -Math.PI / 2) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const rr = i % 2 === 0 ? r : r * inner;
    const a = rot + (i * Math.PI) / points;
    const x = cx + Math.cos(a) * rr;
    const y = cy + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
}

export function snowflake(ctx: Ctx, cx: number, cy: number, r: number, lw: number) {
  ctx.save();
  ctx.lineWidth = lw;
  ctx.lineCap = 'round';
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3 - Math.PI / 2;
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    ctx.beginPath();
    ctx.moveTo(cx + dx * r * 0.18, cy + dy * r * 0.18);
    ctx.lineTo(cx + dx * r, cy + dy * r);
    for (const [p, len] of [
      [0.45, 0.3],
      [0.72, 0.22],
    ] as const) {
      const bx = cx + dx * r * p;
      const by = cy + dy * r * p;
      for (const s of [-1, 1]) {
        const b = a + s * 0.75;
        ctx.moveTo(bx, by);
        ctx.lineTo(bx + Math.cos(b) * r * len, by + Math.sin(b) * r * len);
      }
    }
    ctx.stroke();
  }
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3;
    const x = cx + Math.cos(a) * r * 0.16;
    const y = cy + Math.sin(a) * r * 0.16;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

/** Symmetrischer Zierstrich mit Raute in der Mitte */
export function flourish(ctx: Ctx, cx: number, cy: number, w: number, lw = 2.5) {
  const h = w * 0.055;
  ctx.save();
  ctx.lineWidth = lw;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const d = Math.max(5, w * 0.02);
  ctx.beginPath();
  ctx.moveTo(cx, cy - d);
  ctx.lineTo(cx + d, cy);
  ctx.lineTo(cx, cy + d);
  ctx.lineTo(cx - d, cy);
  ctx.closePath();
  ctx.fill();
  for (const s of [-1, 1]) {
    const X = (f: number) => cx + s * w * f;
    ctx.beginPath();
    ctx.moveTo(cx + s * d * 1.7, cy);
    ctx.bezierCurveTo(X(0.13), cy - h, X(0.23), cy + h, X(0.34), cy);
    ctx.bezierCurveTo(X(0.42), cy - h * 1.2, X(0.46), cy - h * 2.7, X(0.4), cy - h * 2.6);
    ctx.bezierCurveTo(X(0.36), cy - h * 2.5, X(0.365), cy - h * 1.5, X(0.405), cy - h * 1.7);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(X(0.18), cy + h * 0.25);
    ctx.bezierCurveTo(X(0.22), cy + h * 2.0, X(0.29), cy + h * 1.8, X(0.28), cy + h * 1.05);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(X(0.49), cy, lw * 1.3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** Linie mit kleiner Raute in der Mitte */
export function rule(ctx: Ctx, cx: number, cy: number, w: number, lw = 2) {
  ctx.save();
  ctx.lineWidth = lw;
  ctx.beginPath();
  ctx.moveTo(cx - w / 2, cy);
  ctx.lineTo(cx - 14, cy);
  ctx.moveTo(cx + 14, cy);
  ctx.lineTo(cx + w / 2, cy);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx, cy - 7);
  ctx.lineTo(cx + 7, cy);
  ctx.lineTo(cx, cy + 7);
  ctx.lineTo(cx - 7, cy);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** Ecke mit Ranken (für den Einband), ausgerichtet nach links oben; rot dreht sie */
export function cornerOrnament(ctx: Ctx, x: number, y: number, s: number, rot: number, lw: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.lineWidth = lw;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(s * 0.14, s * 0.14);
  ctx.bezierCurveTo(s * 0.4, s * 0.04, s * 0.62, s * 0.26, s * 0.86, s * 0.12);
  ctx.bezierCurveTo(s * 1.0, s * 0.04, s * 1.0, s * 0.26, s * 0.89, s * 0.25);
  ctx.moveTo(s * 0.14, s * 0.14);
  ctx.bezierCurveTo(s * 0.04, s * 0.4, s * 0.26, s * 0.62, s * 0.12, s * 0.86);
  ctx.bezierCurveTo(s * 0.04, s * 1.0, s * 0.26, s * 1.0, s * 0.25, s * 0.89);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(s * 0.34, s * 0.05, s * 0.3, s * 0.3);
  ctx.quadraticCurveTo(s * 0.05, s * 0.34, 0, 0);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(s * 0.4, s * 0.4, lw * 1.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Handgezeichnetes Häkchen */
export function check(ctx: Ctx, x: number, y: number, s: number, color: string) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = s * 0.17;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(x, y - s * 0.05);
  ctx.quadraticCurveTo(x + s * 0.2, y + s * 0.18, x + s * 0.34, y + s * 0.36);
  ctx.quadraticCurveTo(x + s * 0.55, y - s * 0.1, x + s * 0.98, y - s * 0.52);
  ctx.stroke();
  ctx.restore();
}

/** Handgezeichnetes Kreuz */
export function cross(ctx: Ctx, x: number, y: number, s: number, color: string) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = s * 0.16;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x + s * 0.08, y - s * 0.42);
  ctx.quadraticCurveTo(x + s * 0.5, y - s * 0.05, x + s * 0.86, y + s * 0.38);
  ctx.moveTo(x + s * 0.82, y - s * 0.44);
  ctx.quadraticCurveTo(x + s * 0.45, y - s * 0.02, x + s * 0.1, y + s * 0.4);
  ctx.stroke();
  ctx.restore();
}

function hollyLeaf(ctx: Ctx, len: number, wid: number) {
  const prof = (t: number) => Math.pow(Math.sin(Math.PI * Math.min(1, t)), 0.75);
  const tips = [0.2, 0.42, 0.64, 0.84];
  ctx.beginPath();
  ctx.moveTo(0, 0);
  let px = 0;
  let py = 0;
  for (const t of tips) {
    const x = len * t;
    const y = -wid * prof(t) * 1.1;
    ctx.quadraticCurveTo((px + x) / 2, (py + y) / 2 + wid * 0.32, x, y);
    px = x;
    py = y;
  }
  ctx.quadraticCurveTo((px + len) / 2, py / 2 + wid * 0.25, len, 0);
  px = len;
  py = 0;
  for (const t of [...tips].reverse()) {
    const x = len * t;
    const y = wid * prof(t) * 1.1;
    ctx.quadraticCurveTo((px + x) / 2, (py + y) / 2 - wid * 0.32, x, y);
    px = x;
    py = y;
  }
  ctx.quadraticCurveTo(px / 2, py / 2 - wid * 0.25, 0, 0);
  ctx.closePath();
}

/** Stechpalmen-Zweig (2 Blätter, 3 Beeren) */
export function holly(ctx: Ctx, cx: number, cy: number, s: number, rot = 0) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rot);
  for (const [a, col] of [
    [-0.55, '#1f4a25'],
    [0.5, '#2b5c2f'],
    [Math.PI + 0.1, '#244f28'],
  ] as const) {
    ctx.save();
    ctx.rotate(a);
    hollyLeaf(ctx, s, s * 0.32);
    ctx.fillStyle = col;
    ctx.fill();
    ctx.strokeStyle = 'rgba(10, 30, 12, 0.6)';
    ctx.lineWidth = Math.max(1, s * 0.02);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(190, 220, 160, 0.45)';
    ctx.beginPath();
    ctx.moveTo(s * 0.05, 0);
    ctx.lineTo(s * 0.9, 0);
    ctx.stroke();
    ctx.restore();
  }
  for (const [bx, by] of [
    [-s * 0.06, -s * 0.1],
    [s * 0.1, -s * 0.02],
    [-s * 0.02, s * 0.1],
  ]) {
    const r = s * 0.11;
    const g = ctx.createRadialGradient(bx - r * 0.35, by - r * 0.35, r * 0.1, bx, by, r);
    g.addColorStop(0, '#ff6b5e');
    g.addColorStop(0.45, '#c2141c');
    g.addColorStop(1, '#5c060a');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(bx, by, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** Rotes Wachssiegel mit Stern */
export function waxSeal(ctx: Ctx, cx: number, cy: number, r: number, seed = 3) {
  const rand = mulberry32(seed);
  ctx.save();
  ctx.beginPath();
  const n = 26;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const rr = r * (1 + (rand() - 0.5) * 0.14);
    const x = cx + Math.cos(a) * rr;
    const y = cy + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.35, r * 0.1, cx, cy, r * 1.1);
  g.addColorStop(0, '#d8333a');
  g.addColorStop(0.55, '#9c1219');
  g.addColorStop(1, '#5a070c');
  ctx.shadowColor = 'rgba(40, 10, 5, 0.45)';
  ctx.shadowBlur = r * 0.15;
  ctx.shadowOffsetY = r * 0.06;
  ctx.fillStyle = g;
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = 'rgba(60, 5, 8, 0.55)';
  ctx.lineWidth = r * 0.06;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.72, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = 'rgba(70, 6, 10, 0.75)';
  star(ctx, cx, cy + r * 0.03, r * 0.48, 5, 0.42);
  ctx.fillStyle = 'rgba(255, 150, 140, 0.35)';
  star(ctx, cx - r * 0.03, cy, r * 0.46, 5, 0.42);
  ctx.restore();
}

export interface StampOpts {
  cx: number;
  cy: number;
  w: number;
  h: number;
  text: string;
  color: string;
  rot: number;
  seed?: number;
}

/** Gummistempel mit „abgenutzter“ Farbe; liefert ein eigenes Canvas (transparent) */
export function stampCanvas(o: Omit<StampOpts, 'cx' | 'cy' | 'rot'>, scale = 1): HTMLCanvasElement {
  const pad = 24;
  const c = createCanvas((o.w + pad * 2) * scale, (o.h + pad * 2) * scale);
  const g = get2d(c);
  g.scale(scale, scale);
  g.strokeStyle = o.color;
  g.fillStyle = o.color;
  roundRect(g, pad + 5, pad + 5, o.w - 10, o.h - 10, 20);
  g.lineWidth = 10;
  g.stroke();
  roundRect(g, pad + 21, pad + 21, o.w - 42, o.h - 42, 10);
  g.lineWidth = 3.5;
  g.stroke();
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  fitFont(g, o.text, o.w - 90, o.h * 0.5, 20, (s) => font.heading(900, s));
  g.fillText(o.text, pad + o.w / 2, pad + o.h / 2 + o.h * 0.03);
  // Abnutzung
  const rand = mulberry32(o.seed ?? 7);
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 1300; i++) {
    g.globalAlpha = rand() * 0.75;
    g.beginPath();
    g.arc(rand() * (o.w + pad * 2), rand() * (o.h + pad * 2), rand() * 2.4 + 0.4, 0, Math.PI * 2);
    g.fill();
  }
  g.lineCap = 'round';
  for (let i = 0; i < 9; i++) {
    g.globalAlpha = 0.18 + rand() * 0.2;
    g.lineWidth = rand() * 7 + 2;
    const x = rand() * (o.w + pad * 2);
    const y = rand() * (o.h + pad * 2);
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + rand() * 120 - 60, y + rand() * 16 - 8);
    g.stroke();
  }
  g.globalCompositeOperation = 'source-over';
  g.globalAlpha = 1;
  return c;
}

export function drawStamp(ctx: Ctx, o: StampOpts) {
  const c = stampCanvas(o);
  ctx.save();
  ctx.translate(o.cx, o.cy);
  ctx.rotate(o.rot);
  ctx.globalAlpha = 0.9;
  ctx.globalCompositeOperation = 'multiply';
  ctx.drawImage(c, -c.width / 2, -c.height / 2);
  ctx.restore();
}

/** Frech-O-Meter: Halbkreis-Skala mit Nadel (value 0..100) oder Fragezeichen */
export function gauge(ctx: Ctx, cx: number, cy: number, r: number, value: number | null, labels: [string, string]) {
  ctx.save();
  ctx.lineCap = 'butt';
  const segs: [string, number, number][] = [
    [INK_GREEN, 0, 0.34],
    [INK_AMBER, 0.34, 0.66],
    [INK_RED, 0.66, 1],
  ];
  ctx.lineWidth = 18;
  ctx.globalAlpha = 0.78;
  for (const [col, a, b] of segs) {
    ctx.strokeStyle = col;
    ctx.beginPath();
    ctx.arc(cx, cy, r, Math.PI + a * Math.PI + 0.01, Math.PI + b * Math.PI - 0.01);
    ctx.stroke();
  }
  ctx.globalAlpha = 0.9;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, r + 15, Math.PI, Math.PI * 2);
  ctx.stroke();
  for (let i = 0; i <= 10; i++) {
    const a = Math.PI + (i / 10) * Math.PI;
    const r1 = r - 15;
    const r2 = r - (i % 5 === 0 ? 38 : 27);
    ctx.lineWidth = i % 5 === 0 ? 3 : 2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
    ctx.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2);
    ctx.stroke();
  }
  ctx.fillStyle = INK;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.font = font.body(28, true);
  ctx.fillText(labels[0], cx - r, cy + 40);
  ctx.fillText(labels[1], cx + r, cy + 40);
  if (value === null) {
    ctx.font = font.heading(700, 70);
    ctx.fillStyle = INK_SOFT;
    ctx.fillText('?', cx, cy - 22);
  } else {
    const a = Math.PI + (Math.min(100, Math.max(0, value)) / 100) * Math.PI;
    const len = r - 30;
    const nx = Math.cos(a);
    const ny = Math.sin(a);
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.moveTo(cx + nx * len, cy + ny * len);
    ctx.lineTo(cx - ny * 9, cy + nx * 9);
    ctx.lineTo(cx - nx * 18, cy - ny * 18);
    ctx.lineTo(cx + ny * 9, cy - nx * 9);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(cx, cy, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#c9a24f';
  ctx.beginPath();
  ctx.arc(cx, cy, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Gepunktete Führungslinie (Inhaltsverzeichnis) */
export function leaderDots(ctx: Ctx, x0: number, x1: number, y: number) {
  ctx.save();
  for (let x = x0; x < x1; x += 12) {
    ctx.beginPath();
    ctx.arc(x, y, 1.8, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
