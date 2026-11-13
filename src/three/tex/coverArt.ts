import type { EventInfo } from '../../model';
import type { Strings } from '../../strings';
import { cached, createCanvas, get2d, grain, valueNoise } from './canvas';
import { cornerOrnament, fitFont, flourish, font, snowflake, spacedText, star } from './draw2d';
import { CH, CW } from './pageArt';

/**
 * Vorderdeckel aus rotem Samt mit Goldprägung.
 * Es werden drei deckungsgleiche Bilder erzeugt:
 *  - color: Farbe (sRGB)
 *  - mr:    G = Rauheit, B = Metall (für roughnessMap + metalnessMap)
 *  - sheen: Samtglanz-Maske (weiss = Samt, schwarz = Gold)
 */
export type CoverMode = 'color' | 'mr' | 'sheen';

export interface CoverData {
  event: EventInfo;
  s: Strings;
}

const VELVET_ROUGH = 235;
const GOLD_ROUGH = 80;

function velvetBase(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = '#640910';
  ctx.fillRect(0, 0, CW, CH);
  const crush = cached('velvet-crush', () => valueNoise(128, 4, 9, 4, [40, 2, 6], [190, 40, 46], 1.5));
  ctx.globalCompositeOperation = 'soft-light';
  ctx.globalAlpha = 0.7;
  ctx.drawImage(crush, 0, 0, CW, CH);
  const fine = cached('velvet-grain', () => grain(256, 3, 150, 255, [1, 0.85, 0.85]));
  const pat = ctx.createPattern(fine, 'repeat');
  if (pat) {
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = pat;
    ctx.fillRect(0, 0, CW, CH);
  }
  ctx.globalCompositeOperation = 'multiply';
  ctx.globalAlpha = 1;
  const vg = ctx.createRadialGradient(CW / 2, CH / 2, CW * 0.3, CW / 2, CH / 2, CH * 0.75);
  vg.addColorStop(0, 'rgba(255,255,255,1)');
  vg.addColorStop(1, 'rgba(120,60,60,1)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, CW, CH);
  ctx.globalCompositeOperation = 'source-over';
}

function goldGradient(ctx: CanvasRenderingContext2D) {
  const g = ctx.createLinearGradient(0, 0, CW, CH);
  g.addColorStop(0, '#9a7426');
  g.addColorStop(0.18, '#f3d98b');
  g.addColorStop(0.32, '#b8892f');
  g.addColorStop(0.5, '#ffeaa8');
  g.addColorStop(0.68, '#b38431');
  g.addColorStop(0.85, '#f0cf78');
  g.addColorStop(1, '#8a6420');
  return g;
}

/** Alle Goldelemente – in jedem Modus mit derselben Geometrie */
function goldElements(ctx: CanvasRenderingContext2D, d: CoverData) {
  const s = d.s;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  // Rahmen
  ctx.lineWidth = 7;
  ctx.strokeRect(48, 48, CW - 96, CH - 96);
  ctx.lineWidth = 2.5;
  ctx.strokeRect(68, 68, CW - 136, CH - 136);
  cornerOrnament(ctx, 80, 80, 150, 0, 4);
  cornerOrnament(ctx, CW - 80, 80, 150, Math.PI / 2, 4);
  cornerOrnament(ctx, 80, CH - 80, 150, -Math.PI / 2, 4);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.font = font.heading(600, 28);
  const tw = spacedText(ctx, s.secret.toUpperCase(), CW / 2, 168, 7);
  star(ctx, CW / 2 - tw / 2 - 30, 158, 10);
  star(ctx, CW / 2 + tw / 2 + 30, 158, 10);

  ctx.font = font.script(150);
  ctx.fillText("Santa's", CW / 2, 340);
  fitFont(ctx, 'NAUGHTY', CW - 250, 150, 60, (z) => font.title(900, z));
  ctx.fillText('NAUGHTY', CW / 2, 500);
  ctx.font = font.title(700, 84);
  spacedText(ctx, 'BOOK', CW / 2, 610, 24);
  flourish(ctx, CW / 2, 676, 540, 4);

  // Medaillon mit Schneeflocke
  const mx = CW / 2;
  const my = 878;
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.arc(mx, my, 118, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(mx, my, 100, 0, Math.PI * 2);
  ctx.stroke();
  snowflake(ctx, mx, my, 74, 7);
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(mx + Math.cos(a) * 138, my + Math.sin(a) * 138, i % 2 ? 3 : 5, 0, Math.PI * 2);
    ctx.fill();
  }

  fitFont(ctx, s.subtitle.toUpperCase(), CW - 300, 30, 18, (z) => font.heading(600, z));
  spacedText(ctx, s.subtitle.toUpperCase(), CW / 2, 1076, 2);
  fitFont(ctx, d.event.name || ' ', 560, 50, 24, (z) => font.heading(700, z));
  ctx.fillText(d.event.name, CW / 2, 1170);
  fitFont(ctx, d.event.date || ' ', 560, 30, 18, (z) => font.body(z, true));
  ctx.fillText(d.event.date, CW / 2, 1220);
}

export function drawCoverFront(ctx: CanvasRenderingContext2D, mode: CoverMode, d: CoverData) {
  if (mode === 'color') {
    velvetBase(ctx);
    ctx.save();
    // Prägeschatten
    ctx.shadowColor = 'rgba(20, 0, 2, 0.75)';
    ctx.shadowBlur = 5;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 3;
    const g = goldGradient(ctx);
    ctx.fillStyle = g;
    ctx.strokeStyle = g;
    goldElements(ctx, d);
    ctx.restore();
    return;
  }
  ctx.fillStyle = mode === 'mr' ? `rgb(0, ${VELVET_ROUGH}, 0)` : '#ffffff';
  ctx.fillRect(0, 0, CW, CH);
  const gold = mode === 'mr' ? `rgb(0, ${GOLD_ROUGH}, 255)` : '#000000';
  ctx.fillStyle = gold;
  ctx.strokeStyle = gold;
  goldElements(ctx, d);
}

/** Samt ohne Prägung (Rückseite, Rücken) */
export function velvetCanvas(size = 512): HTMLCanvasElement {
  return cached(`velvet-plain-${size}`, () => {
    const c = createCanvas(size, size);
    const ctx = get2d(c);
    ctx.save();
    ctx.scale(size / CW, size / CH);
    velvetBase(ctx);
    ctx.restore();
    return c;
  });
}
