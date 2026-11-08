import * as THREE from 'three';
import { acquireCanvas, get2d, releaseCanvas, toTexture } from '../tex/canvas';
import { drawPage, pageKey, PH, PW, type PageData, type PageSpec, type Side } from '../tex/pageArt';
import { runtime } from '../runtime';
import type { LeafRig } from './geometry';

/** Blatt i: Vorderseite (rechte Seite) und Rückseite (linke Seite) */
export const leafFront = (i: number): PageSpec => (i === 0 ? { kind: 'title' } : { kind: 'naughty', gi: i - 1 });
export const leafBack = (i: number, leafCount: number): PageSpec =>
  i === leafCount - 1 ? { kind: 'closing' } : { kind: 'nice', gi: i };

/**
 * Erzeugt Seitentexturen nur für Blätter in der Nähe der aktuellen Doppelseite
 * (alle anderen zeigen leeres Pergament) und räumt nicht mehr benötigte Texturen weg.
 */
export class PageTextureManager {
  private cache = new Map<string, THREE.CanvasTexture>();
  constructor(
    private scale: number,
    private blank: Record<Side, THREE.Texture>,
  ) {}

  private generate(spec: PageSpec, side: Side, data: PageData) {
    const w = Math.round(PW * this.scale);
    const h = Math.round(PH * this.scale);
    const c = acquireCanvas(w, h);
    const ctx = get2d(c);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, w, h);
    ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    drawPage(ctx, spec, data, side);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    return toTexture(c);
  }

  /** @returns Anzahl noch ausstehender Texturen */
  update(page: number, leaves: LeafRig[], data: PageData, budget: number): number {
    const n = leaves.length;
    const lo = page - 4;
    const hi = page + 1;
    const center = page - 1.5;
    const pending: { mat: THREE.MeshStandardMaterial; key: string; spec: PageSpec; side: Side; dist: number }[] = [];
    for (let i = 0; i < n; i++) {
      const near = i >= lo && i <= hi;
      for (const side of ['right', 'left'] as const) {
        const mat = side === 'right' ? leaves[i].front : leaves[i].back;
        if (!near) {
          if (mat.map !== this.blank[side]) mat.map = this.blank[side];
          mat.userData.key = '';
          continue;
        }
        const spec = side === 'right' ? leafFront(i) : leafBack(i, n);
        const key = `${side}|${pageKey(spec, data)}`;
        const tex = this.cache.get(key);
        if (tex) {
          if (mat.map !== tex) mat.map = tex;
          mat.userData.key = key;
        } else {
          const visible = (side === 'right' && i === page - 1) || (side === 'left' && i === page - 2);
          pending.push({ mat, key, spec, side, dist: visible ? -1 : Math.abs(i - center) });
        }
      }
    }
    pending.sort((a, b) => a.dist - b.dist);
    let made = 0;
    for (const p of pending) {
      if (made >= budget) break;
      let tex = this.cache.get(p.key);
      if (!tex) {
        tex = this.generate(p.spec, p.side, data);
        this.cache.set(p.key, tex);
        made++;
      }
      p.mat.map = tex;
      p.mat.userData.key = p.key;
    }
    const right = leaves[page - 1]?.front;
    runtime.rightPageKey = right && right.map !== this.blank.right ? String(right.userData.key ?? '') : '';
    // Aufräumen
    const used = new Set<THREE.Texture>();
    for (const l of leaves) {
      if (l.front.map) used.add(l.front.map);
      if (l.back.map) used.add(l.back.map);
    }
    for (const [key, tex] of this.cache) {
      if (!used.has(tex)) {
        tex.dispose();
        releaseCanvas(tex.image as HTMLCanvasElement);
        this.cache.delete(key);
      }
    }
    return Math.max(0, pending.length - made);
  }

  dispose() {
    for (const tex of this.cache.values()) tex.dispose();
    this.cache.clear();
  }
}
