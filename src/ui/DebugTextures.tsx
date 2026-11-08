import { useEffect, useRef, useState } from 'react';
import { loadFonts } from '../fonts';
import { STRINGS } from '../i18n';
import { useBook } from '../store';
import { drawCoverFront } from '../three/tex/coverArt';
import { CH, CW, drawEndpaper, drawPage, PH, PW, type PageData, type PageSpec, type Side } from '../three/tex/pageArt';

/** Entwickler-Ansicht aller generierten 2D-Texturen: ?debug=textures */
export function DebugTextures() {
  const guests = useBook((s) => s.guests);
  const event = useBook((s) => s.event);
  const locale = useBook((s) => s.locale);
  const [ready, setReady] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    loadFonts().then(() => setReady(true));
  }, []);
  useEffect(() => {
    if (!ready || !ref.current) return;
    const root = ref.current;
    root.innerHTML = '';
    const s = STRINGS[locale];
    const revealed = guests.map((g, i) => (i === 0 || i === 1 ? { ...g, revealed: true } : g));
    const d: PageData = { event, guests: revealed, s };
    const add = (w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void, label: string) => {
      const c = document.createElement('canvas');
      c.width = w / 2;
      c.height = h / 2;
      const ctx = c.getContext('2d')!;
      ctx.scale(0.5, 0.5);
      draw(ctx);
      const fig = document.createElement('figure');
      fig.style.cssText = 'margin:0;color:#ccc;font:12px sans-serif';
      fig.appendChild(c);
      const cap = document.createElement('figcaption');
      cap.textContent = label;
      fig.appendChild(cap);
      root.appendChild(fig);
    };
    add(CW, CH, (ctx) => drawCoverFront(ctx, 'color', { event, s }), 'cover color');
    add(CW, CH, (ctx) => drawCoverFront(ctx, 'mr', { event, s }), 'cover mr');
    add(CW, CH, (ctx) => drawEndpaper(ctx, 'front', d), 'endpaper front');
    add(CW, CH, (ctx) => drawEndpaper(ctx, 'back', d), 'endpaper back');
    const pages: [PageSpec, Side, string][] = [
      [{ kind: 'title' }, 'right', 'title'],
      [{ kind: 'nice', gi: 0 }, 'left', 'nice 0'],
      [{ kind: 'naughty', gi: 0 }, 'right', 'naughty 0 (revealed)'],
      [{ kind: 'naughty', gi: 2 }, 'right', 'naughty 2 (hidden)'],
      [{ kind: 'nice', gi: 3 }, 'left', 'nice 3'],
      [{ kind: 'naughty', gi: 1 }, 'right', 'naughty 1 (revealed)'],
      [{ kind: 'closing' }, 'left', 'closing'],
    ];
    for (const [spec, side, label] of pages) add(PW, PH, (ctx) => drawPage(ctx, spec, d, side), label);
  }, [ready, guests, event, locale]);
  return (
    <div
      ref={ref}
      style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, padding: 12, background: '#222', minHeight: '100vh' }}
    />
  );
}
