import { create } from 'zustand';
import type { Verdict } from './demoData';
import { useBook } from './store';

/**
 * Inhalte aus public/content.json: Branding, Stimme, Sprache, Storyline und Gästeliste.
 * So kann der Gastgeber alles (z. B. aus einem Word-Dokument übertragen) in einer Datei pflegen.
 * Format: siehe public/content.schema.json und public/content.example.json
 */

export type SantaLanguage = 'gsw' | 'de' | 'en';

export interface BrandConfig {
  preset?: 'classic' | 'ubs';
  /** Name, der neben dem Titel steht (z. B. „UBS“) */
  name?: string;
  /** Pfad/URL zu einem Logo (SVG/PNG) – vom Gastgeber bereitgestellt */
  logo?: string;
  primary?: string;
  primaryText?: string;
  accent?: string;
  font?: string;
  /** Zeile auf der Titelkarte („UBS präsentiert“) */
  presents?: string;
}

export interface VoiceConfig {
  provider?: 'elevenlabs' | 'browser';
  voiceId?: string;
  modelId?: string;
  stability?: number;
  similarity?: number;
  style?: number;
  speed?: number;
}

export interface StoryConfig {
  /** Filmischer Prolog, den Santa am Anfang erzählt */
  prologue?: string;
  greeting?: string;
  /** Text vor dem letzten Abschied */
  epilogue?: string;
  farewell?: string;
  /** Titelkarten */
  title?: string;
  subtitle?: string;
  chapterLabel?: string;
  endTitle?: string;
  music?: boolean;
}

export interface ContentGuest {
  name: string;
  nice?: string[] | string;
  naughty?: string[] | string;
  verdict?: Verdict;
  score?: number;
  /** Eigene Geschichte – wird wörtlich vorgelesen */
  story?: string;
  /** Kapitel-Untertitel */
  title?: string;
}

export interface ContentFile {
  version?: number;
  language?: SantaLanguage;
  uiLanguage?: 'de' | 'en';
  brand?: BrandConfig;
  voice?: VoiceConfig;
  story?: StoryConfig;
  event?: { name?: string; date?: string; santa?: string };
  guests?: ContentGuest[];
}

interface ContentState {
  loaded: boolean;
  source: 'file' | 'none';
  brand: BrandConfig;
  voice: VoiceConfig;
  story: StoryConfig;
  language: SantaLanguage;
  setLanguage: (l: SantaLanguage) => void;
}

const defaultLanguage = (): SantaLanguage => {
  try {
    const n = navigator.language.toLowerCase();
    if (n.startsWith('de-ch') || n === 'gsw' || n.startsWith('gsw')) return 'gsw';
    return n.startsWith('de') ? 'de' : 'en';
  } catch {
    return 'gsw';
  }
};

export const useContent = create<ContentState>()((set) => ({
  loaded: false,
  source: 'none',
  brand: { preset: 'classic' },
  voice: { provider: 'elevenlabs' },
  story: { music: true },
  language: defaultLanguage(),
  setLanguage: (language) => set({ language }),
}));

const toLines = (v: string[] | string | undefined) =>
  Array.isArray(v) ? v.map((x) => String(x)) : typeof v === 'string' ? v.split('\n') : [];

async function hashText(t: string) {
  let h = 2166136261;
  for (let i = 0; i < t.length; i++) {
    h ^= t.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}

const HASH_KEY = 'santa-content-hash';

/** Übernimmt Branding/Stimme/Story/Sprache (und optional die Gäste) aus einem Inhalts-Objekt */
export function applyContent(c: ContentFile, importGuests = true): boolean {
  if (!c || typeof c !== 'object') return false;
  const book = useBook.getState();
  let ok = true;
  if (importGuests) {
    if (Array.isArray(c.guests) && c.guests.length)
      ok = book.importData({
        event: { ...book.event, ...(c.event ?? {}) },
        guests: c.guests.map((g) => ({ ...g, nice: toLines(g.nice), naughty: toLines(g.naughty) })),
      });
    else if (c.event) book.updateEvent(c.event);
  }
  if (c.uiLanguage === 'de' || c.uiLanguage === 'en') book.setLocale(c.uiLanguage);
  const cur = useContent.getState();
  useContent.setState({
    brand: c.brand ? { preset: 'classic', ...c.brand } : cur.brand,
    voice: c.voice ? { provider: 'elevenlabs', ...c.voice } : cur.voice,
    story: c.story ? { music: true, ...c.story } : cur.story,
    language: c.language === 'gsw' || c.language === 'de' || c.language === 'en' ? c.language : cur.language,
  });
  return ok;
}

/** Für Export: aktuelle Einstellungen im content.json-Format */
export function contentSettings(): Pick<ContentFile, 'language' | 'brand' | 'voice' | 'story'> {
  const { language, brand, voice, story } = useContent.getState();
  return { language, brand, voice, story };
}

/** JSON laden; null, wenn die Datei fehlt (der Dev-Server antwortet dann mit index.html) */
async function fetchJson(file: string): Promise<{ text: string; data: ContentFile } | null> {
  try {
    const res = await fetch(new URL(file, document.baseURI).href, { cache: 'no-cache' });
    if (!res.ok) return null;
    const text = await res.text();
    const data = JSON.parse(text) as ContentFile;
    return data && typeof data === 'object' ? { text, data } : null;
  } catch {
    return null;
  }
}

/**
 * Lädt die Inhalte. Reihenfolge:
 *   ?content=<datei>.json  →  public/content.local.json (privat, nicht im Git)  →  public/content.json
 */
export async function loadContent() {
  const param = new URLSearchParams(location.search).get('content') ?? '';
  const files = /^[\w.-]+\.json$/.test(param) ? [param] : ['content.local.json', 'content.json'];
  let got: { text: string; data: ContentFile } | null = null;
  for (const f of files) if ((got = await fetchJson(f))) break;
  if (!got) {
    useContent.setState({ loaded: true, source: 'none' });
    return;
  }
  const hash = await hashText(got.text);
  let prev: string | null = null;
  try {
    prev = localStorage.getItem(HASH_KEY);
  } catch {
    /* egal */
  }
  // Gäste nur übernehmen, wenn sich die Datei geändert hat – lokale Änderungen im Gastgeber-Bereich bleiben sonst erhalten
  applyContent(got.data, prev !== hash);
  try {
    localStorage.setItem(HASH_KEY, hash);
  } catch {
    /* egal */
  }
  useContent.setState({ loaded: true, source: 'file' });
}
