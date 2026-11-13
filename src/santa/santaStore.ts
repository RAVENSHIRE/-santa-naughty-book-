import { create } from 'zustand';
import type { Frame } from '../model';

export type AppMode = 'santa' | 'book';
export type SessionPhase = 'idle' | 'intro' | 'waiting' | 'name' | 'code' | 'reading' | 'verdict' | 'closing' | 'finale';
export type DeviceState = 'off' | 'starting' | 'on' | 'denied' | 'unavailable' | 'error';

export interface FaceBox {
  /** normiert 0..1, gespiegelt wie in der Vorschau */
  x: number;
  y: number;
  w: number;
  h: number;
}

interface SessionState {
  mode: AppMode;
  phase: SessionPhase;
  /** Öffentlicher Rahmen aus event.json (null = Datei fehlt) */
  frame: Frame | null;
  /** Anzahl versiegelter Geschichten / davon schon vorgelesen */
  total: number;
  done: number;
  caption: string;
  heard: string;
  /** Welche Eingabe die Oberfläche gerade anbietet */
  input: 'name' | 'code' | null;
  checking: boolean;
  /** Vorab aufgenommene Stimme (public/voice) vorhanden */
  recorded: boolean;
  camera: DeviceState;
  mic: DeviceState;
  detector: DeviceState;
  present: boolean;
  face: FaceBox | null;
  letterbox: boolean;
  titleCard: { kicker?: string; title: string; sub?: string } | null;
  error: string | null;

  setMode: (m: AppMode) => void;
  patch: (p: Partial<SessionState>) => void;
}

export const useSanta = create<SessionState>()((set) => ({
  mode: 'santa',
  phase: 'idle',
  frame: null,
  total: 0,
  done: 0,
  caption: '',
  heard: '',
  input: null,
  checking: false,
  recorded: false,
  camera: 'off',
  mic: 'off',
  detector: 'off',
  present: false,
  face: null,
  letterbox: false,
  titleCard: null,
  error: null,
  setMode: (mode) => set({ mode }),
  patch: (p) => set(p),
}));
