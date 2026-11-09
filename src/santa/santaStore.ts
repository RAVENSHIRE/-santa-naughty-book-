import { create } from 'zustand';

export type AppMode = 'santa' | 'book';
export type SessionPhase =
  | 'idle'
  | 'starting'
  | 'greeting'
  | 'waiting'
  | 'asking-name'
  | 'reading'
  | 'verdict'
  | 'next'
  | 'farewell'
  | 'finished';

export type DeviceState = 'off' | 'starting' | 'on' | 'denied' | 'unavailable' | 'error';

export interface FaceBox {
  /** normiert 0..1, gespiegelt wie in der Vorschau */
  x: number;
  y: number;
  w: number;
  h: number;
}

interface SantaState {
  mode: AppMode;
  phase: SessionPhase;
  /** Was Santa gerade sagt */
  caption: string;
  /** Was zuletzt verstanden wurde */
  heard: string;
  camera: DeviceState;
  mic: DeviceState;
  detector: DeviceState;
  speechIn: boolean;
  speechOut: boolean;
  present: boolean;
  face: FaceBox | null;
  /** Gast, der gerade dran ist */
  currentGuestId: string | null;
  /** Wartet der Ablauf auf einen Namen? (dann zeigt die UI Eingabe + Gäste-Chips) */
  awaitingName: boolean;
  /** Wartet der Ablauf auf eine Person? */
  awaitingPerson: boolean;
  /** Gäste, die in dieser Runde schon dran waren */
  doneIds: string[];
  error: string | null;
  /** Filmische Elemente */
  letterbox: boolean;
  titleCard: { kicker?: string; title: string; sub?: string } | null;
  voice: 'checking' | 'elevenlabs' | 'browser' | 'none';

  setMode: (m: AppMode) => void;
  patch: (p: Partial<SantaState>) => void;
}

export const useSanta = create<SantaState>()((set) => ({
  mode: 'santa',
  phase: 'idle',
  caption: '',
  heard: '',
  camera: 'off',
  mic: 'off',
  detector: 'off',
  speechIn: false,
  speechOut: false,
  present: false,
  face: null,
  currentGuestId: null,
  awaitingName: false,
  awaitingPerson: false,
  doneIds: [],
  error: null,
  letterbox: false,
  titleCard: null,
  voice: 'checking',
  setMode: (mode) => set({ mode }),
  patch: (p) => set(p),
}));
