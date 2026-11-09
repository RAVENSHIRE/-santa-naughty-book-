/** Posen des Avatars */
export type SantaPose = 'idle' | 'wave' | 'read' | 'think' | 'present';
export type SantaGesture = 'nod' | 'shake' | 'laugh' | 'surprise';
/** Kameraeinstellungen für die filmische Storyline */
export type Shot = 'wide' | 'medium' | 'close' | 'book';

/**
 * Nicht-reaktiver Zustand, der jedes Frame gelesen wird (Lippen, Blick, Gesten).
 * Wird vom Gesprächsablauf, der Sprachausgabe und der Kamera beschrieben.
 */
export const santaRuntime = {
  speaking: false,
  /** Zeitpunkt (performance.now) der letzten Wortgrenze – für die Lippenbewegung */
  lastBoundary: 0,
  pose: 'idle' as SantaPose,
  gesture: null as null | { kind: SantaGesture; at: number },
  /** Augenbrauen hochziehen (0..1) – bei Fragen */
  brows: 0,
  /** Blickziel aus der Kamera: -1..1 (gespiegelt, wie in der Vorschau) */
  look: { x: 0, y: 0 },
  hasPerson: false,
  /** Mikrofon-Pegel 0..1 */
  micLevel: 0,
  listening: false,
  /** Lautstärke der ElevenLabs-Stimme (0..1) – treibt den Mund */
  voiceLevel: 0,
  voiceActive: false,
  shot: 'medium' as Shot,
  /** true = harter Schnitt statt Kamerafahrt (wird von der Kamera zurückgesetzt) */
  camCut: false,
};

export function setShot(shot: Shot, cut = false) {
  santaRuntime.shot = shot;
  if (cut) santaRuntime.camCut = true;
}

export function gesture(kind: SantaGesture) {
  santaRuntime.gesture = { kind, at: performance.now() };
}
