import { useContent } from '../content';
import { santaRuntime } from './santaRuntime';

/**
 * ElevenLabs-Stimme für Santa.
 * Reihenfolge: 1) vorgerenderte Datei aus public/voice (manifest.json)
 *              2) Server-Proxy /api/voice/tts (Dev-Server/Codespace, API-Key bleibt auf dem Server)
 *              3) sonst: false → Browser-Stimme
 * Der Mund bewegt sich nach der echten Lautstärke des Audios.
 */

export const DEFAULT_VOICE = {
  // Santa-Stimme (aus der ElevenLabs Voice Library). In content.json (voice.voiceId) überschreibbar.
  // Modelle: eleven_v3, eleven_v4, eleven_multilingual_v2 („eleven_multilingual_v3“ gibt es nicht)
  voiceId: 'ogdlaxy0T9rCSVdH0VJM',
  modelId: 'eleven_v3',
  stability: 0.45,
  similarity: 0.8,
  style: 0.35,
  speed: 0.92,
};

interface Manifest {
  voiceId?: string;
  modelId?: string;
  files: Record<string, string>;
}

interface Status {
  server: boolean;
  enabled: boolean;
  voiceId?: string;
  modelId?: string;
}

let ctx: AudioContext | null = null;
let manifestP: Promise<Manifest | null> | null = null;
let statusP: Promise<Status> | null = null;
let disabled = false;
const bufCache = new Map<string, Promise<ArrayBuffer | null>>();
let current: AudioBufferSourceNode | null = null;

const url = (p: string) => new URL(p, document.baseURI).href;

/** Im Klick aufrufen (Autoplay-Regeln) */
export function unlockVoice() {
  try {
    if (!ctx) {
      const C = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (C) ctx = new C();
    }
    if (ctx?.state === 'suspended') void ctx.resume();
  } catch {
    /* egal */
  }
  void status();
  void manifest();
}

function manifest() {
  if (!manifestP)
    manifestP = fetch(url('voice/manifest.json'), { cache: 'no-cache' })
      .then((r) => (r.ok ? (r.json() as Promise<Manifest>) : null))
      .catch(() => null);
  return manifestP;
}

export function status(): Promise<Status> {
  if (!statusP)
    statusP = fetch(url('api/voice/status'))
      .then(async (r) => {
        if (!r.ok) return { server: false, enabled: false };
        const j = (await r.json()) as { enabled: boolean; voiceId?: string; modelId?: string };
        return { server: true, ...j };
      })
      .catch(() => ({ server: false, enabled: false }));
  return statusP;
}

export async function voiceSettings() {
  const v = useContent.getState().voice;
  const [m, st] = await Promise.all([manifest(), status()]);
  return {
    // content.json → Server-Einstellung (Codespace) → vorgerenderte Dateien (GitHub Pages) → Standard
    // Mit Server (Codespace): Umgebungsvariable vor voice.ts; ohne Server: Stimme der vorgerenderten Dateien
    voiceId: v.voiceId || (st.server ? st.voiceId || DEFAULT_VOICE.voiceId : m?.voiceId || DEFAULT_VOICE.voiceId),
    modelId: v.modelId || (st.server ? st.modelId || DEFAULT_VOICE.modelId : m?.modelId || DEFAULT_VOICE.modelId),
    stability: v.stability ?? DEFAULT_VOICE.stability,
    similarity: v.similarity ?? DEFAULT_VOICE.similarity,
    style: v.style ?? DEFAULT_VOICE.style,
    speed: v.speed ?? DEFAULT_VOICE.speed,
  };
}

export async function voiceKey(text: string, prev = '', next = '') {
  const s = await voiceSettings();
  const raw = [s.voiceId, s.modelId, s.stability, s.similarity, s.style, s.speed, prev, next, text].join('|');
  const data = new TextEncoder().encode(raw);
  const digest = await crypto.subtle.digest('SHA-1', data);
  const hash = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return { hash, settings: s };
}

/** Ist eine ElevenLabs-Stimme verfügbar (Server oder vorgerenderte Dateien)? */
export async function voiceAvailable() {
  if (disabled || useContent.getState().voice.provider === 'browser') return false;
  if (!crypto?.subtle) return false;
  const [m, st] = await Promise.all([manifest(), status()]);
  return st.enabled || Object.keys(m?.files ?? {}).length > 0;
}

/** Holt das Audio (mit Cache) – kann vorab aufgerufen werden, damit es ohne Pause weitergeht */
export function fetchVoice(text: string, prev = '', next = ''): Promise<ArrayBuffer | null> {
  const key = `${prev}\u0000${text}\u0000${next}`;
  let p = bufCache.get(key);
  if (!p) {
    p = (async () => {
      if (!(await voiceAvailable())) return null;
      const { hash, settings } = await voiceKey(text, prev, next);
      const m = await manifest();
      const file = m?.files[hash];
      if (file) {
        const r = await fetch(url(`voice/${file}`)).catch(() => null);
        if (r?.ok) return r.arrayBuffer();
      }
      const st = await status();
      if (!st.enabled) return null;
      const r = await fetch(url('api/voice/tts'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, previousText: prev, nextText: next, ...settings }),
      }).catch(() => null);
      if (!r) return null;
      if (r.status === 401 || r.status === 402 || r.status === 403) disabled = true;
      return r.ok ? r.arrayBuffer() : null;
    })().catch(() => null);
    bufCache.set(key, p);
    if (bufCache.size > 120) bufCache.delete(bufCache.keys().next().value!);
  }
  return p;
}

/** Spielt einen Satz mit ElevenLabs. false = nicht verfügbar → Browser-Stimme nehmen */
export async function playVoice(text: string, prev = '', next = '', isCancelled: () => boolean = () => false): Promise<boolean> {
  const buf = await fetchVoice(text, prev, next);
  if (!buf || isCancelled()) return !!buf;
  if (!ctx) unlockVoice();
  if (!ctx) return false;
  let audio: AudioBuffer;
  try {
    audio = await ctx.decodeAudioData(buf.slice(0));
  } catch {
    return false;
  }
  if (isCancelled()) return true;
  await new Promise<void>((resolve) => {
    const src = ctx!.createBufferSource();
    src.buffer = audio;
    const analyser = ctx!.createAnalyser();
    analyser.fftSize = 1024;
    src.connect(analyser);
    analyser.connect(ctx!.destination);
    const data = new Float32Array(new ArrayBuffer(analyser.fftSize * 4));
    let raf = 0;
    const tick = () => {
      analyser.getFloatTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
      santaRuntime.voiceLevel = Math.min(1, Math.sqrt(sum / data.length) * 5.5);
      raf = requestAnimationFrame(tick);
    };
    const done = () => {
      cancelAnimationFrame(raf);
      santaRuntime.voiceLevel = 0;
      santaRuntime.voiceActive = false;
      if (current === src) current = null;
      resolve();
    };
    src.onended = done;
    santaRuntime.voiceActive = true;
    current = src;
    src.start();
    tick();
  });
  return true;
}

export function stopVoice() {
  try {
    current?.stop();
  } catch {
    /* schon gestoppt */
  }
  current = null;
  santaRuntime.voiceActive = false;
  santaRuntime.voiceLevel = 0;
}

/** Alle bekannten Sätze vorab rendern (landet in public/voice – danach auch ohne API-Key abspielbar) */
export async function prerender(texts: string[][], onProgress: (done: number, total: number) => void) {
  const total = texts.reduce((a, t) => a + t.length, 0);
  let done = 0;
  let ok = 0;
  for (const group of texts) {
    for (let i = 0; i < group.length; i++) {
      const buf = await fetchVoice(group[i], group[i - 1] ?? '', group[i + 1] ?? '');
      if (buf) ok++;
      else if (disabled || done === 0) {
        onProgress(total, total);
        return ok;
      }
      onProgress(++done, total);
    }
  }
  manifestP = null;
  return ok;
}

/** Nach Änderungen an content.json / Stimme neu prüfen */
export function resetVoice() {
  disabled = false;
  statusP = null;
  manifestP = null;
  bufCache.clear();
}
