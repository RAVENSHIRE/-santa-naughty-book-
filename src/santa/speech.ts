import { santaRuntime } from './santaRuntime';

/**
 * Sprachausgabe nur mit LOKALEN Stimmen des Betriebssystems (voice.localService):
 * Der Text verlässt den Computer nicht. Online-Stimmen (z. B. „Google Deutsch“,
 * Edge „… Online (Natural)“) werden bewusst ignoriert. Ohne lokale Stimme: nur Untertitel.
 *
 * Spracherkennung (Name, Zauberwort) nutzt die Erkennung des Browsers; sie kann
 * abgeschaltet werden – dann wird getippt.
 */

const LANG = 'de-CH';
const VOICE_KEY = 'claus-voice';
const FEMALE = /hedda|katja|anna|petra|helena|marlene|vicki|leni|female|weiblich/i;

let voicesP: Promise<SpeechSynthesisVoice[]> | null = null;

export const ttsSupported = () => typeof window !== 'undefined' && 'speechSynthesis' in window;

/** Alle lokalen deutschen Stimmen, Schweizer zuerst */
export function localVoices(): Promise<SpeechSynthesisVoice[]> {
  if (!ttsSupported()) return Promise.resolve([]);
  voicesP ??= new Promise((resolve) => {
    const pick = () =>
      speechSynthesis
        .getVoices()
        .filter((v) => v.localService && v.lang.toLowerCase().startsWith('de'))
        .sort((a, b) => score(b) - score(a));
    if (speechSynthesis.getVoices().length) return resolve(pick());
    speechSynthesis.addEventListener('voiceschanged', () => resolve(pick()), { once: true });
    setTimeout(() => resolve(pick()), 1500);
  });
  return voicesP;
}

const score = (v: SpeechSynthesisVoice) => (v.lang.toLowerCase() === 'de-ch' ? 4 : 0) + (FEMALE.test(v.name) ? 2 : 0);

export function savedVoiceName() {
  try {
    return localStorage.getItem(VOICE_KEY) ?? '';
  } catch {
    return '';
  }
}

export function saveVoiceName(name: string) {
  try {
    localStorage.setItem(VOICE_KEY, name);
  } catch {
    /* egal */
  }
}

async function currentVoice() {
  const voices = await localVoices();
  return voices.find((v) => v.name === savedVoiceName()) ?? voices[0] ?? null;
}

let token = 0;

const wait = (ms: number, cancelled: () => boolean) =>
  new Promise<void>((resolve) => {
    const t0 = performance.now();
    const tick = () => (cancelled() || performance.now() - t0 >= ms ? resolve() : setTimeout(tick, 80));
    tick();
  });

/** Spricht einen Satz. Ohne lokale Stimme wird nur die Lesedauer abgewartet. */
export async function speak(sentence: string): Promise<void> {
  const my = ++token;
  const cancelled = () => my !== token;
  santaRuntime.speaking = true;
  try {
    const voice = await currentVoice();
    if (!voice) return await wait(Math.max(1400, sentence.length * 65), cancelled);
    await new Promise<void>((resolve) => {
      const u = new SpeechSynthesisUtterance(sentence);
      u.voice = voice;
      u.lang = voice.lang;
      u.rate = 0.94;
      u.onboundary = () => (santaRuntime.lastBoundary = performance.now());
      u.onend = u.onerror = () => resolve();
      // Chrome feuert „end“ manchmal nicht
      setTimeout(resolve, Math.max(3000, sentence.length * 120));
      speechSynthesis.speak(u);
    });
  } finally {
    if (!cancelled()) santaRuntime.speaking = false;
  }
}

export function stopSpeaking() {
  token++;
  santaRuntime.speaking = false;
  audioEl?.pause();
  if (ttsSupported()) speechSynthesis.cancel();
}

// ---------- Aufnahmen (ElevenLabs, vorab) ----------

let audioEl: HTMLAudioElement | null = null;
/** Ein Audio-Element für alle Aufnahmen – im Start-Klick freigeschaltet */
export function voiceAudio() {
  audioEl ??= Object.assign(new Audio(), { preload: 'auto' });
  return audioEl;
}

/** 0,1 s Stille als WAV – schaltet die Wiedergabe im Klick frei (Safari/iOS) */
function silence() {
  const n = 4410;
  const b = new DataView(new ArrayBuffer(44 + n * 2));
  const w = (o: number, t: string) => [...t].forEach((c, i) => b.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF');
  b.setUint32(4, 36 + n * 2, true);
  w(8, 'WAVEfmt ');
  b.setUint32(16, 16, true);
  b.setUint16(20, 1, true);
  b.setUint16(22, 1, true);
  b.setUint32(24, 44100, true);
  b.setUint32(28, 88200, true);
  b.setUint16(32, 2, true);
  b.setUint16(34, 16, true);
  w(36, 'data');
  b.setUint32(40, n * 2, true);
  return URL.createObjectURL(new Blob([b.buffer], { type: 'audio/wav' }));
}

/** Muss in einem Klick passieren, sonst blockiert der Browser die Ausgabe */
export function primeSpeech() {
  const a = voiceAudio();
  a.src = silence();
  void a.play().catch(() => {});
  if (!ttsSupported()) return;
  void localVoices();
  const u = new SpeechSynthesisUtterance(' ');
  u.volume = 0;
  speechSynthesis.speak(u);
}

// ---------- Spracherkennung ----------

type Alt = { transcript: string };
type SR = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: { results: ArrayLike<ArrayLike<Alt> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};

const Recognition = (): (new () => SR) | null => {
  const w = window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

export const sttSupported = () => typeof window !== 'undefined' && !!Recognition();

let active: SR | null = null;

/** Hört einmal zu. Liefert alle erkannten Varianten (bestes Ergebnis zuerst). */
export function listen(timeoutMs: number, onInterim?: (t: string) => void): Promise<string[]> {
  const Ctor = Recognition();
  if (!Ctor) return Promise.resolve([]);
  stopListening();
  return new Promise((resolve) => {
    const rec = new Ctor();
    active = rec;
    let alts: string[] = [];
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      santaRuntime.listening = false;
      if (active === rec) active = null;
      resolve(alts.map((t) => t.trim()).filter(Boolean));
    };
    rec.lang = LANG;
    rec.interimResults = true;
    rec.maxAlternatives = 5;
    rec.onresult = (e) => {
      const r = e.results[e.results.length - 1];
      alts = Array.from(r, (a) => a.transcript);
      onInterim?.(alts[0] ?? '');
    };
    rec.onerror = done;
    rec.onend = done;
    const timer = setTimeout(() => {
      rec.stop();
      setTimeout(done, 1200);
    }, timeoutMs);
    santaRuntime.listening = true;
    try {
      rec.start();
    } catch {
      done();
    }
  });
}

export function stopListening() {
  const r = active;
  active = null;
  santaRuntime.listening = false;
  r?.abort();
}
