import { fastTalk } from '../config';
import type { Locale } from '../i18n';
import { santaRuntime } from './santaRuntime';

/**
 * Sprachausgabe (speechSynthesis) und Spracherkennung (SpeechRecognition) des Browsers.
 * Beides ist optional – ohne Unterstützung laufen Untertitel mit geschätzter Dauer weiter.
 */

export function speechLang(locale: Locale) {
  const nav = typeof navigator !== 'undefined' ? navigator.language : '';
  if (locale === 'de') return nav?.toLowerCase().startsWith('de') ? nav : 'de-DE';
  return nav?.toLowerCase().startsWith('en') ? nav : 'en-US';
}

const MALE_DE = /stefan|markus|conrad|killian|jonas|florian|ralf|bernd|hans|yannick|\bjan\b|male|männ/i;
const MALE_EN = /daniel|alex\b|guy|ryan|christopher|brian|eric|david|mark\b|george|thomas|male/i;

let voicesReady: Promise<SpeechSynthesisVoice[]> | null = null;
function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  if (!('speechSynthesis' in window)) return Promise.resolve([]);
  if (!voicesReady) {
    voicesReady = new Promise((resolve) => {
      const now = speechSynthesis.getVoices();
      if (now.length) return resolve(now);
      const done = () => resolve(speechSynthesis.getVoices());
      speechSynthesis.addEventListener?.('voiceschanged', done, { once: true });
      setTimeout(done, 1500);
    });
  }
  return voicesReady;
}

function pickVoice(voices: SpeechSynthesisVoice[], locale: Locale): SpeechSynthesisVoice | null {
  const lang = speechLang(locale).toLowerCase();
  const base = locale;
  const cands = voices.filter((v) => v.lang?.toLowerCase().startsWith(base));
  if (!cands.length) return null;
  const male = locale === 'de' ? MALE_DE : MALE_EN;
  const score = (v: SpeechSynthesisVoice) =>
    (male.test(v.name) ? 4 : 0) +
    (/natural|neural|premium|enhanced/i.test(v.name) ? 3 : 0) +
    (v.lang.toLowerCase() === lang ? 2 : 0) +
    (v.localService ? 1 : 0);
  return [...cands].sort((a, b) => score(b) - score(a))[0];
}

export const ttsSupported = () => typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;

let cancelToken = 0;

/** Spricht einen Text (satzweise). Löst auf, wenn fertig – oder nach einer Sicherheits-Zeit. */
export async function speak(text: string, locale: Locale, onWord?: (charIndex: number) => void): Promise<void> {
  const token = ++cancelToken;
  const chunks = text.match(/[^.!?…]+[.!?…]*["»“”]?\s*/g)?.map((c) => c.trim()).filter(Boolean) ?? [text];
  santaRuntime.speaking = true;
  try {
    if (!ttsSupported() || fastTalk) {
      await wait(fastTalk ? 700 : Math.max(1200, text.length * 62), () => token !== cancelToken);
      return;
    }
    const voices = await loadVoices();
    const voice = pickVoice(voices, locale);
    let offset = 0;
    for (const chunk of chunks) {
      if (token !== cancelToken) return;
      const start = offset;
      offset += chunk.length + 1;
      await new Promise<void>((resolve) => {
        let finished = false;
        const finish = () => {
          if (finished) return;
          finished = true;
          clearTimeout(safety);
          resolve();
        };
        const u = new SpeechSynthesisUtterance(chunk);
        u.lang = voice?.lang ?? speechLang(locale);
        if (voice) u.voice = voice;
        u.rate = 0.93;
        u.pitch = voice && (locale === 'de' ? MALE_DE : MALE_EN).test(voice.name) ? 0.85 : 0.7;
        u.onboundary = (e) => {
          santaRuntime.lastBoundary = performance.now();
          onWord?.(start + e.charIndex);
        };
        u.onend = finish;
        u.onerror = finish;
        // Chrome feuert „end“ manchmal nicht – dann nach geschätzter Dauer weiter
        const safety = setTimeout(() => {
          finish();
        }, Math.max(2500, chunk.length * 110));
        speechSynthesis.speak(u);
      });
    }
  } finally {
    if (token === cancelToken) santaRuntime.speaking = false;
  }
}

export function stopSpeaking() {
  cancelToken++;
  santaRuntime.speaking = false;
  try {
    if (ttsSupported()) speechSynthesis.cancel();
  } catch {
    /* egal */
  }
}

function wait(ms: number, cancelled: () => boolean) {
  return new Promise<void>((resolve) => {
    const t0 = performance.now();
    const tick = () => {
      if (cancelled() || performance.now() - t0 >= ms) resolve();
      else setTimeout(tick, 80);
    };
    tick();
  });
}

// ---------- Spracherkennung ----------

type SR = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};

function SRCtor(): (new () => SR) | null {
  const w = window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export const sttSupported = () => typeof window !== 'undefined' && !!SRCtor();

let activeRec: SR | null = null;

export interface ListenResult {
  text: string | null;
  error?: string;
}

/** Hört einmal zu und liefert das Gesagte (oder null bei Stille/Fehler) */
export function listen(locale: Locale, timeoutMs: number, onInterim?: (t: string) => void): Promise<ListenResult> {
  const Ctor = SRCtor();
  if (!Ctor) return Promise.resolve({ text: null, error: 'unsupported' });
  stopListening();
  return new Promise((resolve) => {
    let finalText = '';
    let interim = '';
    let error: string | undefined;
    let settled = false;
    const rec = new Ctor();
    activeRec = rec;
    rec.lang = speechLang(locale);
    rec.interimResults = true;
    rec.maxAlternatives = 3;
    rec.continuous = false;
    const done = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      santaRuntime.listening = false;
      if (activeRec === rec) activeRec = null;
      const text = (finalText || interim).trim();
      resolve({ text: text || null, error });
    };
    rec.onresult = (e) => {
      interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript + ' ';
        else interim += r[0].transcript;
      }
      onInterim?.((finalText + interim).trim());
    };
    rec.onerror = (e) => {
      error = e.error;
      done();
    };
    rec.onend = done;
    const timer = setTimeout(() => {
      try {
        rec.stop();
      } catch {
        done();
      }
      setTimeout(done, 1200);
    }, timeoutMs);
    try {
      santaRuntime.listening = true;
      rec.start();
    } catch (e) {
      error = String(e);
      done();
    }
  });
}

export function stopListening() {
  const r = activeRec;
  activeRec = null;
  santaRuntime.listening = false;
  try {
    r?.abort();
  } catch {
    /* egal */
  }
}

/** Sprachausgabe einmal „anwerfen“ – muss in einem Klick passieren (iOS/Chrome) */
export function primeSpeech() {
  try {
    if (!ttsSupported()) return;
    void loadVoices();
    const u = new SpeechSynthesisUtterance(' ');
    u.volume = 0;
    speechSynthesis.speak(u);
  } catch {
    /* egal */
  }
}
