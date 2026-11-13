import type { EventInfo, Guest } from '../../model';
import type { Strings } from '../../strings';
import { cached, createCanvas, get2d, grain, mulberry32, valueNoise } from './canvas';
import {
  INK,
  INK_AMBER,
  INK_GREEN,
  INK_RED,
  INK_SOFT,
  check,
  cross,
  drawStamp,
  fitFont,
  flourish,
  font,
  gauge,
  holly,
  leaderDots,
  rule,
  snowflake,
  spacedText,
  waxSeal,
  wrapText,
} from './draw2d';

/** Virtuelle Seitengrösse (Seitenverhältnis = 1.28 : 1.71) */
export const PW = 1024;
export const PH = 1368;

export type Side = 'left' | 'right';
export type PageSpec = { kind: 'title' } | { kind: 'nice'; gi: number } | { kind: 'naughty'; gi: number } | { kind: 'closing' };

export interface PageData {
  event: EventInfo;
  guests: Guest[];
  s: Strings;
}

/** Position des Urteils-Stempels auf der rechten (Missetaten-)Seite – wird auch für das 3D-Overlay benutzt */
export const STAMP = { cx: 690, cy: 1052, w: 400, h: 156, rot: -0.14 };

export const lines = (arr: string[]) => arr.map((l) => l.trim()).filter(Boolean);

export function pageNumber(spec: PageSpec, guestCount: number) {
  switch (spec.kind) {
    case 'title':
      return 1;
    case 'nice':
      return spec.gi * 2 + 2;
    case 'naughty':
      return spec.gi * 2 + 3;
    case 'closing':
      return guestCount * 2 + 2;
  }
}

export function stampFor(g: Guest, s: Strings) {
  if (g.verdict === 'nice') return { text: s.stampNice, color: INK_GREEN };
  if (g.verdict === 'naughty') return { text: s.stampNaughty, color: INK_RED };
  return { text: s.stampUndecided, color: INK_AMBER };
}

/** Schlüssel, der sich nur ändert, wenn sich der sichtbare Inhalt der Seite ändert */
export function pageKey(spec: PageSpec, d: PageData): string {
  const s = d.s;
  const n = d.guests.length;
  switch (spec.kind) {
    case 'title':
      return JSON.stringify(['t', n, d.event.name, d.event.date, d.guests.map((g) => g.name), s.index]);
    case 'nice': {
      const g = d.guests[spec.gi];
      return JSON.stringify(['n', spec.gi, g?.name, g ? lines(g.nice) : [], s.niceDeeds, s.fileNo]);
    }
    case 'naughty': {
      const g = d.guests[spec.gi];
      return JSON.stringify([
        'b',
        spec.gi,
        g?.name,
        g ? lines(g.naughty) : [],
        g?.revealed ? ['REVEALED', g.verdict, g.score] : 'hidden',
        s.naughtyDeeds,
        s.verdictLabel,
        d.event.santa,
      ]);
    }
    case 'closing': {
      const c = tally(d.guests);
      return JSON.stringify(['c', n, c, d.event.santa, s.tally]);
    }
  }
}

function tally(guests: Guest[]) {
  let nice = 0;
  let naughty = 0;
  let undecided = 0;
  let hidden = 0;
  for (const g of guests) {
    if (!g.revealed) hidden++;
    else if (g.verdict === 'nice') nice++;
    else if (g.verdict === 'naughty') naughty++;
    else undecided++;
  }
  return { nice, naughty, undecided, hidden };
}

/** Pergament-Hintergrund (pro Grösse und Seite nur einmal erzeugt) */
export function parchmentBase(w: number, h: number, side: Side): HTMLCanvasElement {
  return cached(`parchment:${w}x${h}:${side}`, () => {
    const c = createCanvas(w, h);
    const g = get2d(c);
    const sx = w / PW;
    const grad = g.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#f4ead2');
    grad.addColorStop(0.55, '#efe2c5');
    grad.addColorStop(1, '#e9d7b4');
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);

    const mottle = cached('mottle', () => valueNoise(128, 3, 11, 4, [205, 178, 135], [255, 255, 255], 1.4));
    g.globalCompositeOperation = 'multiply';
    g.globalAlpha = 0.55;
    g.drawImage(mottle, 0, 0, w, h);
    const fine = cached('paper-grain', () => grain(256, 5, 214, 255));
    g.globalAlpha = 0.28;
    const pat = g.createPattern(fine, 'repeat');
    if (pat) {
      g.fillStyle = pat;
      g.fillRect(0, 0, w, h);
    }

    const rand = mulberry32(side === 'left' ? 21 : 42);
    // Fasern
    g.globalAlpha = 0.07;
    g.strokeStyle = '#7a5530';
    g.lineWidth = 1.2 * sx;
    for (let i = 0; i < 260; i++) {
      const x = rand() * w;
      const y = rand() * h;
      const a = rand() * Math.PI;
      const l = (8 + rand() * 26) * sx;
      g.beginPath();
      g.moveTo(x, y);
      g.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + 4 * sx, y + Math.sin(a) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l);
      g.stroke();
    }
    // Flecken
    g.globalAlpha = 1;
    for (let i = 0; i < 6; i++) {
      const x = rand() * w;
      const y = rand() * h;
      const r = (40 + rand() * 140) * sx;
      const rg = g.createRadialGradient(x, y, 0, x, y, r);
      rg.addColorStop(0, 'rgba(150, 100, 45, 0.07)');
      rg.addColorStop(1, 'rgba(150, 100, 45, 0)');
      g.fillStyle = rg;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    // Ein Kakao-Ring (Santa trinkt beim Lesen)
    if (side === 'right') {
      const x = w * 0.82;
      const y = h * 0.9;
      const r = 62 * sx;
      g.globalAlpha = 0.07;
      g.strokeStyle = '#6b3f1c';
      g.lineWidth = 7 * sx;
      g.beginPath();
      g.arc(x, y, r, 0.3, Math.PI * 1.85);
      g.stroke();
      g.globalAlpha = 1;
    }
    // Ränder abdunkeln
    const edge = (x0: number, y0: number, x1: number, y1: number, a: number) => {
      const lg = g.createLinearGradient(x0, y0, x1, y1);
      lg.addColorStop(0, `rgba(118, 76, 34, ${a})`);
      lg.addColorStop(1, 'rgba(118, 76, 34, 0)');
      g.fillStyle = lg;
      g.fillRect(0, 0, w, h);
    };
    const e = 70 * sx;
    edge(0, 0, 0, e, 0.32);
    edge(0, h, 0, h - e, 0.36);
    if (side === 'right') edge(w, 0, w - e, 0, 0.34);
    else edge(0, 0, e, 0, 0.34);
    // Bundsteg-Schatten
    const gx0 = side === 'right' ? 0 : w;
    const gx1 = side === 'right' ? w * 0.2 : w * 0.8;
    const gl = g.createLinearGradient(gx0, 0, gx1, 0);
    gl.addColorStop(0, 'rgba(60, 34, 12, 0.5)');
    gl.addColorStop(0.18, 'rgba(60, 34, 12, 0.22)');
    gl.addColorStop(0.5, 'rgba(60, 34, 12, 0.06)');
    gl.addColorStop(1, 'rgba(60, 34, 12, 0)');
    g.fillStyle = gl;
    g.fillRect(0, 0, w, h);
    // Vignette
    const vg = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
    vg.addColorStop(0, 'rgba(110, 70, 30, 0)');
    vg.addColorStop(1, 'rgba(110, 70, 30, 0.22)');
    g.fillStyle = vg;
    g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = 'source-over';
    return c;
  });
}

interface Box {
  x0: number;
  x1: number;
  cx: number;
  w: number;
}

const boxFor = (side: Side): Box => {
  const x0 = side === 'left' ? 96 : 132;
  const x1 = side === 'left' ? PW - 132 : PW - 96;
  return { x0, x1, cx: (x0 + x1) / 2, w: x1 - x0 };
};

/**
 * Zeichnet eine komplette Buchseite. Erwartet einen Kontext, der bereits auf PW×PH skaliert ist.
 */
export function drawPage(ctx: CanvasRenderingContext2D, spec: PageSpec, d: PageData, side: Side) {
  ctx.drawImage(parchmentBase(ctx.canvas.width, ctx.canvas.height, side), 0, 0, PW, PH);
  const box = boxFor(side);
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'center';
  // dezentes Wasserzeichen
  ctx.save();
  ctx.globalAlpha = 0.045;
  ctx.strokeStyle = '#6b4520';
  snowflake(ctx, box.cx, PH * 0.56, 260, 10);
  ctx.restore();

  switch (spec.kind) {
    case 'title':
      drawTitle(ctx, d, box);
      break;
    case 'nice':
      drawNice(ctx, d, spec.gi, box, side);
      break;
    case 'naughty':
      drawNaughty(ctx, d, spec.gi, box);
      break;
    case 'closing':
      drawClosing(ctx, d, box, side);
      break;
  }

  if (spec.kind !== 'title') {
    const n = pageNumber(spec, d.guests.length);
    ctx.fillStyle = INK_SOFT;
    ctx.font = font.body(30, true);
    ctx.textAlign = 'center';
    ctx.fillText(`– ${n} –`, box.cx, PH - 74);
  }
}

function ink(ctx: CanvasRenderingContext2D, color = INK) {
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
}

function drawTitle(ctx: CanvasRenderingContext2D, d: PageData, b: Box) {
  const s = d.s;
  waxSeal(ctx, b.x1 - 62, 150, 56);

  ctx.save();
  ctx.translate(b.x0 + 150, 148);
  ctx.rotate(-0.07);
  ink(ctx, INK_RED);
  ctx.globalAlpha = 0.85;
  ctx.font = font.heading(700, 28);
  const tw = spacedText(ctx, s.secret.toUpperCase(), 0, 10, 5);
  ctx.lineWidth = 3;
  ctx.strokeRect(-tw / 2 - 18, -26, tw + 36, 50);
  ctx.restore();

  ink(ctx);
  ctx.textAlign = 'center';
  ctx.font = font.script(112);
  ctx.fillText("Santa's", b.cx, 300);
  fitFont(ctx, 'NAUGHTY BOOK', b.w - 90, 74, 36, (z) => font.heading(900, z));
  ctx.fillText('NAUGHTY BOOK', b.cx, 398);
  ink(ctx, INK_RED);
  flourish(ctx, b.cx, 458, 440, 3);

  ink(ctx);
  fitFont(ctx, d.event.name || ' ', b.w - 60, 50, 26, (z) => font.heading(700, z));
  ctx.fillText(d.event.name, b.cx, 540);
  ctx.font = font.body(32, true);
  ctx.fillStyle = INK_SOFT;
  ctx.fillText(d.event.date, b.cx, 588);

  // Verzeichnis
  ink(ctx);
  ctx.font = font.heading(600, 27);
  const iw = spacedText(ctx, s.index.toUpperCase(), b.cx, 670, 4);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(b.x0 + 20, 661);
  ctx.lineTo(b.cx - iw / 2 - 18, 661);
  ctx.moveTo(b.cx + iw / 2 + 18, 661);
  ctx.lineTo(b.x1 - 20, 661);
  ctx.stroke();

  const names = d.guests.map((g, i) => ({ name: g.name || '…', page: i * 2 + 2 }));
  const top = 722;
  const bottom = PH - 200;
  const cols = names.length > 10 ? 2 : 1;
  let size = 36;
  let lh = 46;
  const rowsFor = (lhh: number) => Math.floor((bottom - top) / lhh) + 1;
  while (rowsFor(lh) * cols < names.length && size > 26) {
    size -= 2;
    lh = Math.round(size * 1.25);
  }
  const rows = rowsFor(lh);
  const capacity = rows * cols;
  const shown = names.length > capacity ? names.slice(0, capacity - 1) : names;
  const gap = 46;
  const colW = cols === 1 ? Math.min(560, b.w - 80) : (b.w - 40 - gap) / 2;
  const startX = cols === 1 ? b.cx - colW / 2 : b.x0 + 20;
  ctx.font = font.body(size);
  shown.forEach((n, i) => {
    const col = Math.floor(i / rows);
    const row = i % rows;
    const x = startX + col * (colW + gap);
    const y = top + row * lh;
    ctx.fillStyle = INK;
    ctx.textAlign = 'left';
    let label = n.name;
    while (ctx.measureText(label).width > colW - 80 && label.length > 2) label = label.slice(0, -2) + '…';
    ctx.fillText(label, x, y);
    const nameW = ctx.measureText(label).width;
    ctx.textAlign = 'right';
    const num = `${n.page}`;
    ctx.fillText(num, x + colW, y);
    const numW = ctx.measureText(num).width;
    ctx.fillStyle = INK_SOFT;
    leaderDots(ctx, x + nameW + 12, x + colW - numW - 10, y - 4);
  });
  if (shown.length < names.length) {
    ctx.textAlign = 'left';
    ctx.fillStyle = INK_SOFT;
    ctx.font = font.body(size, true);
    const i = shown.length;
    ctx.fillText(s.morePeople(names.length - shown.length), startX + Math.floor(i / rows) * (colW + gap), top + (i % rows) * lh);
  }
  if (names.length === 0) {
    ctx.textAlign = 'center';
    ctx.fillStyle = INK_SOFT;
    ctx.font = font.body(32, true);
    ctx.fillText(s.nothing, b.cx, top + 20);
  }

  ctx.textAlign = 'center';
  ctx.fillStyle = INK_SOFT;
  ctx.font = font.body(28, true);
  ctx.fillText(s.property, b.cx, PH - 92);
}

/** Liste mit Aufzählungszeichen, schrumpft die Schrift bis alles passt */
function drawDeeds(
  ctx: CanvasRenderingContext2D,
  items: string[],
  b: Box,
  top: number,
  bottom: number,
  bullet: 'check' | 'cross',
  emptyText: string,
) {
  if (items.length === 0) {
    ctx.textAlign = 'center';
    ctx.fillStyle = INK_SOFT;
    ctx.font = font.body(34, true);
    ctx.fillText(emptyText, b.cx, top + 50);
    return;
  }
  const left = b.x0 + 26;
  const textX = left + 58;
  const maxW = b.x1 - textX - 16;
  let size = 42;
  let layout: string[][] = [];
  let lh = 0;
  const gapFor = (z: number) => z * 0.45;
  for (; size >= 24; size -= 2) {
    ctx.font = font.body(size);
    lh = size * 1.22;
    layout = items.map((t) => wrapText(ctx, t, maxW));
    const total = layout.reduce((acc, l) => acc + l.length * lh, 0) + gapFor(size) * (layout.length - 1);
    if (total <= bottom - top) break;
  }
  ctx.font = font.body(size);
  let y = top + size;
  ctx.textAlign = 'left';
  for (const l of layout) {
    if (y > bottom + size * 0.2) break;
    const bs = size * 0.78;
    if (bullet === 'check') check(ctx, left, y - size * 0.3, bs, INK_GREEN);
    else cross(ctx, left + 2, y - size * 0.32, bs * 0.9, INK_RED);
    ctx.fillStyle = INK;
    l.forEach((line, i) => ctx.fillText(line, textX, y + i * lh));
    y += l.length * lh + gapFor(size);
  }
}

function drawNice(ctx: CanvasRenderingContext2D, d: PageData, gi: number, b: Box, side: Side) {
  const g = d.guests[gi];
  if (!g) return;
  const s = d.s;
  ink(ctx, INK_SOFT);
  ctx.font = font.heading(600, 26);
  spacedText(ctx, `${s.fileNo.toUpperCase()} ${gi + 1}`, b.cx, 136, 5);
  ink(ctx, INK_RED);
  flourish(ctx, b.cx, 172, 360, 2.5);

  ink(ctx);
  ctx.textAlign = 'center';
  fitFont(ctx, g.name || '…', b.w - 60, 136, 60, (z) => font.script(z));
  ctx.fillText(g.name || '…', b.cx, 352);
  ink(ctx, INK_SOFT);
  rule(ctx, b.cx, 402, b.w - 160, 2);

  ink(ctx, INK_GREEN);
  ctx.font = font.heading(700, 46);
  const hw = spacedText(ctx, s.niceDeeds.toUpperCase(), b.cx, 486, 3);
  ctx.fillStyle = INK_GREEN;
  for (const sgn of [-1, 1]) {
    ctx.save();
    ctx.globalAlpha = 0.9;
    snowflakeStar(ctx, b.cx + sgn * (hw / 2 + 34), 470, 13);
    ctx.restore();
  }

  drawDeeds(ctx, lines(g.nice), b, 536, PH - 190, 'check', s.nothing);
  holly(ctx, side === 'left' ? b.x0 + 40 : b.x1 - 40, PH - 120, 64, side === 'left' ? -0.3 : 0.3);
}

function snowflakeStar(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    const rr = i % 2 === 0 ? r : r * 0.35;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
}

function drawNaughty(ctx: CanvasRenderingContext2D, d: PageData, gi: number, b: Box) {
  const g = d.guests[gi];
  if (!g) return;
  const s = d.s;
  ink(ctx);
  ctx.textAlign = 'center';
  fitFont(ctx, g.name || '…', b.w - 120, 70, 40, (z) => font.script(z));
  ctx.fillText(g.name || '…', b.cx, 172);
  ink(ctx, INK_RED);
  flourish(ctx, b.cx, 214, 360, 2.5);

  ctx.font = font.heading(700, 46);
  const hw = spacedText(ctx, s.naughtyDeeds.toUpperCase(), b.cx, 306, 3);
  for (const sgn of [-1, 1]) snowflakeStar(ctx, b.cx + sgn * (hw / 2 + 34), 290, 13);

  drawDeeds(ctx, lines(g.naughty), b, 352, 790, 'cross', s.nothing);

  ink(ctx, INK_SOFT);
  rule(ctx, b.cx, 846, b.w - 120, 2);
  ink(ctx);
  ctx.font = font.heading(600, 26);
  spacedText(ctx, s.verdictLabel.toUpperCase(), b.cx, 906, 4);

  gauge(ctx, b.x0 + 182, 1100, 122, g.revealed ? g.score : null, [s.meterNice, s.meterNaughty]);

  if (g.revealed) {
    const st = stampFor(g, s);
    drawStamp(ctx, { ...STAMP, text: st.text, color: st.color, seed: gi + 5 });
    ink(ctx);
    ctx.textAlign = 'center';
    ctx.font = font.script(56);
    ctx.fillText(d.event.santa || 'Santa Claus', STAMP.cx + 30, 1214);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(STAMP.cx - 120, 1228);
    ctx.quadraticCurveTo(STAMP.cx + 40, 1240, STAMP.cx + 190, 1222);
    ctx.stroke();
  } else {
    ctx.save();
    ctx.strokeStyle = INK_SOFT;
    ctx.setLineDash([10, 9]);
    ctx.lineWidth = 2.5;
    ctx.translate(STAMP.cx, STAMP.cy);
    ctx.rotate(STAMP.rot * 0.4);
    ctx.strokeRect(-STAMP.w / 2 + 10, -STAMP.h / 2 + 10, STAMP.w - 20, STAMP.h - 20);
    ctx.setLineDash([]);
    ctx.fillStyle = INK_SOFT;
    ctx.textAlign = 'center';
    ctx.font = font.heading(700, 64);
    ctx.fillText('?', 0, 4);
    ctx.font = font.body(26, true);
    ctx.fillText(s.pending, 0, 48);
    ctx.restore();
  }
}

function drawClosing(ctx: CanvasRenderingContext2D, d: PageData, b: Box, side: Side) {
  const s = d.s;
  const t = tally(d.guests);
  ink(ctx, INK_RED);
  flourish(ctx, b.cx, 170, 380, 2.5);
  ink(ctx);
  ctx.textAlign = 'center';
  fitFont(ctx, s.tally, b.w - 60, 54, 30, (z) => font.heading(700, z));
  ctx.fillText(s.tally, b.cx, 270);

  const rows: { label: string; value: number; icon: 'check' | 'cross' | 'q' | 'lock' }[] = [
    { label: s.nice, value: t.nice, icon: 'check' },
    { label: s.naughty, value: t.naughty, icon: 'cross' },
  ];
  if (t.undecided) rows.push({ label: s.undecided, value: t.undecided, icon: 'q' });
  if (t.hidden) rows.push({ label: s.hidden, value: t.hidden, icon: 'lock' });
  const x0 = b.x0 + 70;
  const x1 = b.x1 - 70;
  rows.forEach((r, i) => {
    const y = 382 + i * 78;
    if (r.icon === 'check') check(ctx, x0, y - 14, 36, INK_GREEN);
    else if (r.icon === 'cross') cross(ctx, x0, y - 14, 32, INK_RED);
    else {
      ctx.fillStyle = r.icon === 'q' ? INK_AMBER : INK_SOFT;
      ctx.font = font.heading(700, 40);
      ctx.textAlign = 'left';
      ctx.fillText(r.icon === 'q' ? '?' : '…', x0 + 6, y);
    }
    ctx.fillStyle = INK;
    ctx.font = font.body(44);
    ctx.textAlign = 'left';
    ctx.fillText(r.label, x0 + 60, y);
    const lw = ctx.measureText(r.label).width;
    ctx.textAlign = 'right';
    ctx.font = font.heading(700, 44);
    ctx.fillText(String(r.value), x1, y);
    const vw = ctx.measureText(String(r.value)).width;
    ctx.fillStyle = INK_SOFT;
    leaderDots(ctx, x0 + 60 + lw + 14, x1 - vw - 14, y - 6);
  });

  ink(ctx, INK_RED);
  ctx.textAlign = 'center';
  fitFont(ctx, s.merry, b.w - 40, 108, 50, (z) => font.script(z));
  ctx.fillText(s.merry, b.cx, 800);
  ink(ctx);
  ctx.font = font.body(38, true);
  ctx.fillText(s.seeAll, b.cx, 870);

  ctx.font = font.script(84);
  ctx.fillText(d.event.santa || 'Santa Claus', b.cx, 1040);
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(b.cx - 220, 1068);
  ctx.bezierCurveTo(b.cx - 60, 1090, b.cx + 120, 1050, b.cx + 230, 1072);
  ctx.stroke();
  holly(ctx, b.cx, 1170, 70, 0);
  void side;
}

/** Vorsatzpapier (Innenseiten der Buchdeckel) */
export const CW = 1024;
export const CH = 1378;

export function drawEndpaper(ctx: CanvasRenderingContext2D, variant: 'front' | 'back', d: PageData) {
  const s = d.s;
  ctx.fillStyle = '#16301f';
  ctx.fillRect(0, 0, CW, CH);
  const mottle = cached('endpaper-mottle', () => valueNoise(128, 4, 77, 4, [10, 30, 18], [40, 78, 50], 1.2));
  ctx.globalAlpha = 0.65;
  ctx.drawImage(mottle, 0, 0, CW, CH);
  ctx.globalAlpha = 1;
  // Goldmuster
  ctx.fillStyle = 'rgba(214, 178, 96, 0.38)';
  ctx.strokeStyle = 'rgba(214, 178, 96, 0.38)';
  const step = 118;
  for (let row = -1; row < CH / step + 1; row++) {
    for (let col = -1; col < CW / step + 1; col++) {
      const x = col * step + (row % 2 ? step / 2 : 0) + 30;
      const y = row * step + 40;
      snowflake(ctx, x, y, 17, 2.4);
      snowflakeStar(ctx, x + step / 2, y + step / 2 - 6, 5);
    }
  }
  // Etikett
  const lw = variant === 'front' ? 560 : 500;
  const lh = variant === 'front' ? 400 : 280;
  const lx = (CW - lw) / 2;
  const ly = variant === 'front' ? CH * 0.42 - lh / 2 : CH * 0.5 - lh / 2;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 6;
  ctx.drawImage(parchmentBase(512, 684, 'right'), 0, 0, 512, 684, lx, ly, lw, lh);
  ctx.restore();
  ctx.strokeStyle = INK_RED;
  ctx.lineWidth = 6;
  ctx.strokeRect(lx + 18, ly + 18, lw - 36, lh - 36);
  ctx.strokeStyle = '#a07a2c';
  ctx.lineWidth = 2;
  ctx.strokeRect(lx + 30, ly + 30, lw - 60, lh - 60);
  ctx.textAlign = 'center';
  const cx = CW / 2;
  if (variant === 'front') {
    ctx.fillStyle = INK_RED;
    ctx.font = font.script(84);
    ctx.fillText(s.exLibris, cx, ly + 130);
    ctx.fillStyle = INK;
    fitFont(ctx, (d.event.santa || 'Santa Claus').toUpperCase(), lw - 120, 52, 26, (z) => font.title(700, z));
    ctx.fillText((d.event.santa || 'Santa Claus').toUpperCase(), cx, ly + 222);
    ctx.font = font.body(34, true);
    ctx.fillStyle = INK_SOFT;
    ctx.fillText(s.northPole, cx, ly + 276);
    ctx.strokeStyle = INK_RED;
    snowflake(ctx, cx, ly + 334, 26, 3);
  } else {
    ctx.fillStyle = INK;
    fitFont(ctx, s.toBeContinued, lw - 100, 70, 36, (z) => font.script(z));
    ctx.fillText(s.toBeContinued, cx, ly + 128);
    ctx.fillStyle = INK_RED;
    ctx.font = font.heading(700, 40);
    ctx.fillText(s.nextYear, cx, ly + 196);
  }
}
