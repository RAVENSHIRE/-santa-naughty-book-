import { useEffect } from 'react';
import { useContent, type BrandConfig } from './content';

/** Farbvorgaben je Marke. Logos werden nicht mitgeliefert – der Gastgeber legt die offizielle Datei selbst ab. */
const PRESETS: Record<string, BrandConfig> = {
  classic: {},
  ubs: {
    name: 'UBS',
    primary: '#E60000',
    primaryText: '#FFFFFF',
    accent: '#FFFFFF',
    font: 'Frutiger, "Frutiger LT", "Frutiger Neue", "Helvetica Neue", Helvetica, Arial, sans-serif',
  },
};

export function resolveBrand(b: BrandConfig): BrandConfig {
  return { ...(PRESETS[b.preset ?? 'classic'] ?? {}), ...stripEmpty(b) };
}

function stripEmpty(b: BrandConfig): BrandConfig {
  return Object.fromEntries(Object.entries(b).filter(([, v]) => v !== undefined && v !== '')) as BrandConfig;
}

/** Setzt CSS-Variablen und data-brand am <html>-Element */
export function useBrand() {
  const brand = useContent((s) => s.brand);
  useEffect(() => {
    const r = resolveBrand(brand);
    const el = document.documentElement;
    el.dataset.brand = brand.preset ?? 'classic';
    const set = (k: string, v?: string) => (v ? el.style.setProperty(k, v) : el.style.removeProperty(k));
    set('--brand', r.primary);
    set('--brand-text', r.primaryText);
    set('--brand-accent', r.accent);
    set('--font-brand', r.font);
  }, [brand]);
  return resolveBrand(brand);
}
