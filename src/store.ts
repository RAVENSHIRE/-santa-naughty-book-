import { create } from 'zustand';
import type { EventInfo, Guest } from './model';

export type RevealPhase = 'idle' | 'suspense' | 'slam' | 'done';
export type Focus = 'left' | 'right';

/**
 * Zustand des Buchs. Bewusst OHNE persist: entschlüsselte Gästedaten leben nur im Arbeitsspeicher
 * und sind nach dem Schliessen/Neuladen der Seite weg.
 */
export interface BookState {
  event: EventInfo;
  /** Nur Gäste, die ihr Zauberwort genannt haben (Reihenfolge = Reihenfolge im Abend) */
  guests: Guest[];
  sound: boolean;
  /** 0 = zu, 1 = Titelseite, 2..G+1 = Gast-Doppelseiten, G+2 = Bilanz */
  page: number;
  focus: Focus;
  singlePage: boolean;
  ready: boolean;
  reveal: { phase: RevealPhase; guestId: string | null; t0: number };

  next: () => void;
  prev: () => void;
  setPage: (page: number, focus?: Focus) => void;
  setSinglePage: (v: boolean) => void;
  setReady: () => void;
  toggleSound: () => void;
  setEvent: (e: EventInfo) => void;
  /** Fügt einen entschlüsselten Gast hinzu (idempotent über die id) und liefert seinen Index */
  addGuest: (g: Guest) => number;
  /** Startet den Stempel für genau diesen Gast. false = gerade belegt oder Gast nicht auf der Seite. */
  startReveal: (guestId: string) => boolean;
  setRevealPhase: (phase: RevealPhase) => void;
  /** Alles vergessen (Ende des Abends) */
  wipe: () => void;
}

export const lastPage = (guestCount: number) => guestCount + 2;
export const guestIndexForPage = (page: number, guestCount: number) =>
  page >= 2 && page <= guestCount + 1 ? page - 2 : -1;

const idleReveal = { phase: 'idle' as RevealPhase, guestId: null, t0: 0 };
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const emptyEvent: EventInfo = { name: '', date: '', santa: 'Mrs. Claus' };

export const useBook = create<BookState>()((set, get) => ({
  event: emptyEvent,
  guests: [],
  sound: true,
  page: 0,
  focus: 'right',
  singlePage: false,
  ready: false,
  reveal: idleReveal,

  // Blättern bricht keinen laufenden Stempel ab
  next: () =>
    set((s) => {
      if (s.reveal.phase !== 'idle') return {};
      if (s.page === 0) return { page: 1, focus: 'right' };
      if (s.singlePage && s.focus === 'left') return { focus: 'right' };
      if (s.page < lastPage(s.guests.length)) return { page: s.page + 1, focus: 'left' };
      return {};
    }),

  prev: () =>
    set((s) => {
      if (s.reveal.phase !== 'idle' || s.page === 0) return {};
      if (s.singlePage && s.focus === 'right' && s.page >= 2) return { focus: 'left' };
      if (s.page === 1) return { page: 0, focus: 'right' };
      return { page: s.page - 1, focus: 'right' };
    }),

  setPage: (page, focus) =>
    set((s) => {
      if (s.reveal.phase !== 'idle') return {};
      const p = clamp(Math.round(page), 0, lastPage(s.guests.length));
      return { page: p, focus: focus ?? (p <= 1 ? 'right' : 'left') };
    }),

  setSinglePage: (v) => set({ singlePage: v }),
  setReady: () => set({ ready: true }),
  toggleSound: () => set((s) => ({ sound: !s.sound })),
  setEvent: (event) => set({ event }),

  addGuest: (g) => {
    const i = get().guests.findIndex((x) => x.id === g.id);
    if (i >= 0) return i;
    set((s) => ({ guests: [...s.guests, { ...g, revealed: false }] }));
    return get().guests.length - 1;
  },

  startReveal: (guestId) => {
    const s = get();
    if (s.reveal.phase !== 'idle') return s.reveal.guestId === guestId;
    const gi = s.guests.findIndex((g) => g.id === guestId);
    if (gi < 0 || guestIndexForPage(s.page, s.guests.length) !== gi) return false;
    if (s.guests[gi].revealed) return true;
    set({ focus: 'right', reveal: { phase: 'suspense', guestId, t0: performance.now() } });
    return true;
  },

  setRevealPhase: (phase) =>
    set((s) => {
      if (phase === 'idle') return { reveal: idleReveal };
      if (!s.reveal.guestId) return {};
      const reveal = { ...s.reveal, phase, t0: performance.now() };
      if (phase !== 'done') return { reveal };
      const id = s.reveal.guestId;
      return { reveal, guests: s.guests.map((g) => (g.id === id ? { ...g, revealed: true } : g)) };
    }),

  wipe: () => set({ guests: [], event: emptyEvent, page: 0, focus: 'right', reveal: idleReveal }),
}));
