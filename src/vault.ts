import type { Frame, Guest, Verdict } from './model';
import { MAX_STORIES } from './model';

/**
 * Versiegelte Gästedaten (public/event.json, erzeugt mit `npm run seal`).
 * Jeder Eintrag ist mit dem Zauberwort der Person verschlüsselt (PBKDF2-SHA-256 → AES-256-GCM).
 * Im Browser wird nur im Arbeitsspeicher entschlüsselt; es wird nichts gespeichert.
 */
interface SealedFile {
  v: 1;
  frame: Frame;
  kdf: { salt: string; iterations: number };
  count: number;
  entries: { id: string; iv: string; data: string }[];
}

const b64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');

/** Muss identisch zu scripts/seal.mjs sein */
export function normalizeCode(s: string) {
  return s
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFKD')
    .replace(/[^a-z0-9]/g, '');
}

let file: SealedFile | null = null;

export async function loadEvent(): Promise<{ frame: Frame; count: number } | null> {
  try {
    const res = await fetch(new URL('event.json', document.baseURI).href, { cache: 'no-cache' });
    if (!res.ok) return null;
    const f = (await res.json()) as SealedFile;
    if (f?.v !== 1 || !Array.isArray(f.entries)) return null;
    file = f;
    return { frame: f.frame, count: f.count };
  } catch {
    return null;
  }
}

async function derive(code: string) {
  if (!file) throw new Error('event.json nicht geladen');
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(code), 'PBKDF2', false, ['deriveBits']);
  const bits = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: 'PBKDF2', hash: 'SHA-256', salt: b64(file.kdf.salt), iterations: file.kdf.iterations },
      base,
      512,
    ),
  );
  const key = await crypto.subtle.importKey('raw', bits.slice(0, 32), 'AES-GCM', false, ['decrypt']);
  return { key, id: hex(bits.slice(32, 48)) };
}

const VERDICTS: Verdict[] = ['nice', 'naughty', 'undecided'];
const lines = (v: unknown, max: number) => (Array.isArray(v) ? v.map((x) => String(x)).filter(Boolean).slice(0, max) : []);

/** Mögliche Zauberwörter aus erkannter Sprache oder Tastatur (beide Wörter zusammen, auch einzeln) */
export function codeCandidates(heard: string[]): string[] {
  const out: string[] = [];
  for (const h of heard) {
    out.push(h);
    const words = h.split(/\s+/).filter(Boolean);
    for (let i = 0; i + 1 < words.length; i++) out.push(`${words[i]} ${words[i + 1]}`);
  }
  return [...new Set(out.map(normalizeCode).filter((c) => c.length >= 4))].slice(0, 10);
}

/** Probiert die Kandidaten durch; liefert den entschlüsselten Gast oder null */
export async function unlock(candidates: string[]): Promise<Guest | null> {
  if (!file) return null;
  for (const c of candidates) {
    const { key, id } = await derive(c);
    const entry = file.entries.find((e) => e.id === id);
    if (!entry) continue;
    try {
      const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64(entry.iv) }, key, b64(entry.data));
      const d = JSON.parse(new TextDecoder().decode(plain)) as Record<string, unknown>;
      return {
        id: entry.id,
        name: String(d.name ?? '').slice(0, 80),
        title: typeof d.title === 'string' ? d.title.slice(0, 120) : undefined,
        nice: lines(d.nice, 12),
        naughty: lines(d.naughty, 12),
        verdict: VERDICTS.includes(d.verdict as Verdict) ? (d.verdict as Verdict) : 'undecided',
        score: Math.min(100, Math.max(0, Number(d.score) || 50)),
        stories: lines(d.stories, MAX_STORIES),
        revealed: false,
      };
    } catch {
      /* falscher Schlüssel – nächster Kandidat */
    }
  }
  return null;
}
