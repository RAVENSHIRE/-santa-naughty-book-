/**
 * Vorab aufgenommene Stimme (scripts/voice.mjs, ElevenLabs).
 *  - public/voice/manifest.json + p/*.mp3: allgemeine Sätze, Begrüssung, Schlusswort
 *  - public/voice/g/<id>.bin: Geschichten einer Person, mit ihrem Zauberwort verschlüsselt
 * Am Abend geht nichts mehr an ElevenLabs. Entschlüsselt wird nur im Arbeitsspeicher.
 */

/** [Start s, Ende s, Satz] – für Untertitel und Mundbewegung */
export type Timed = [number, number, string];
export interface Clip {
  url: string;
  d: number;
  s: Timed[];
}

interface Manifest {
  v: 1;
  voice: string;
  clips: Record<string, { f: string; d: number; s: Timed[] }>;
}

let manifest: Manifest | null = null;
const guestClips = new Map<string, Clip>();

const base = () => new URL('voice/', document.baseURI).href;

/** Gleicher Schlüssel wie clipKey() in scripts/voice.mjs */
async function clipKey(text: string) {
  const d = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text.normalize('NFC'))));
  return Array.from(d.slice(0, 8), (x) => x.toString(16).padStart(2, '0')).join('');
}

export async function loadVoiceManifest(): Promise<boolean> {
  try {
    const r = await fetch(base() + 'manifest.json', { cache: 'no-cache' });
    if (!r.ok) return false;
    const m = (await r.json()) as Manifest;
    if (m?.v !== 1 || !m.clips) return false;
    manifest = m;
    return Object.keys(m.clips).length > 0;
  } catch {
    return false;
  }
}

export const hasRecordedVoice = () => !!manifest && Object.keys(manifest.clips).length > 0;

/** Lädt und entschlüsselt die Aufnahmen einer Person (gleicher Schlüssel wie ihre Geschichte) */
export async function loadGuestVoice(id: string, key: CryptoKey): Promise<boolean> {
  try {
    const r = await fetch(`${base()}g/${id}.bin`, { cache: 'no-cache' });
    if (!r.ok) return false;
    const buf = new Uint8Array(await r.arrayBuffer());
    const plain = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: buf.slice(0, 12) }, key, buf.slice(12)));
    const len = new DataView(plain.buffer).getUint32(0, true);
    const head = JSON.parse(new TextDecoder().decode(plain.slice(4, 4 + len))) as {
      clips: Record<string, { o: number; n: number; d: number; s: Timed[] }>;
    };
    const body = 4 + len;
    for (const [k, c] of Object.entries(head.clips)) {
      const blob = new Blob([plain.slice(body + c.o, body + c.o + c.n)], { type: 'audio/mpeg' });
      guestClips.set(k, { url: URL.createObjectURL(blob), d: c.d, s: c.s });
    }
    return true;
  } catch (e) {
    console.warn('Aufnahme nicht lesbar', e);
    return false;
  }
}

export async function clipFor(text: string): Promise<Clip | null> {
  const k = await clipKey(text);
  const g = guestClips.get(k);
  if (g) return g;
  const c = manifest?.clips[k];
  return c ? { url: base() + c.f, d: c.d, s: c.s } : null;
}

/** Entschlüsselte Aufnahmen vergessen (Beenden) */
export function forgetGuestVoices() {
  guestClips.forEach((c) => URL.revokeObjectURL(c.url));
  guestClips.clear();
}
