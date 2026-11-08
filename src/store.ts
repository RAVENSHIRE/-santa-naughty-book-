import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';
import { blankGuest, demoEvent, demoGuests, uid, type EventInfo, type Guest, type Verdict } from './demoData';
import { detectLocale, STRINGS, type Locale } from './i18n';

export type RevealPhase = 'idle' | 'suspense' | 'slam' | 'done';
export type Focus = 'left' | 'right';

export interface BookState {
  event: EventInfo;
  guests: Guest[];
  locale: Locale;
  sound: boolean;

  /** 0 = zu, 1 = Titelseite, 2..G+1 = Gast-Doppelseiten, G+2 = Bilanz */
  page: number;
  /** Im Hochformat wird nur eine Seite gezeigt */
  focus: Focus;
  singlePage: boolean;
  hostOpen: boolean;
  ready: boolean;
  reveal: { phase: RevealPhase; guestId: string | null; t0: number };

  next: () => void;
  prev: () => void;
  setPage: (page: number, focus?: Focus) => void;
  goToGuest: (index: number) => void;
  setSinglePage: (v: boolean) => void;
  setHostOpen: (v: boolean) => void;
  setReady: () => void;
  setLocale: (l: Locale) => void;
  toggleSound: () => void;
  updateEvent: (patch: Partial<EventInfo>) => void;
  addGuest: (name?: string) => void;
  addGuests: (names: string[]) => void;
  updateGuest: (id: string, patch: Partial<Guest>) => void;
  removeGuest: (id: string) => void;
  moveGuest: (id: string, dir: -1 | 1) => void;
  startReveal: () => void;
  setRevealPhase: (phase: RevealPhase) => void;
  resetReveals: () => void;
  loadDemo: () => void;
  importData: (data: unknown) => boolean;
  clearAll: () => void;
}

export const lastPage = (guestCount: number) => guestCount + 2;
export const guestIndexForPage = (page: number, guestCount: number) =>
  page >= 2 && page <= guestCount + 1 ? page - 2 : -1;

const safeStorage: StateStorage = {
  getItem: (k) => {
    try {
      return window.localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  setItem: (k, v) => {
    try {
      window.localStorage.setItem(k, v);
    } catch {
      /* Speicher nicht verfügbar – egal */
    }
  },
  removeItem: (k) => {
    try {
      window.localStorage.removeItem(k);
    } catch {
      /* ignore */
    }
  },
};

const idleReveal = { phase: 'idle' as RevealPhase, guestId: null, t0: 0 };
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const toLines = (v: unknown): string[] =>
  Array.isArray(v)
    ? v.map((x) => String(x ?? '').slice(0, 200)).slice(0, 30)
    : typeof v === 'string'
      ? v.split('\n').slice(0, 30)
      : [];

const initialLocale = detectLocale();

export const useBook = create<BookState>()(
  persist(
    (set, get) => ({
      event: demoEvent(initialLocale),
      guests: demoGuests(initialLocale),
      locale: initialLocale,
      sound: true,

      page: 0,
      focus: 'right',
      singlePage: false,
      hostOpen: false,
      ready: false,
      reveal: idleReveal,

      next: () =>
        set((s) => {
          const reveal = idleReveal;
          if (s.page === 0) return { page: 1, focus: 'right', reveal };
          if (s.singlePage && s.focus === 'left') return { focus: 'right', reveal };
          if (s.page < lastPage(s.guests.length)) return { page: s.page + 1, focus: 'left', reveal };
          return {};
        }),

      prev: () =>
        set((s) => {
          const reveal = idleReveal;
          if (s.page === 0) return {};
          if (s.singlePage && s.focus === 'right' && s.page >= 2) return { focus: 'left', reveal };
          if (s.page === 1) return { page: 0, focus: 'right', reveal };
          return { page: s.page - 1, focus: 'right', reveal };
        }),

      setPage: (page, focus) =>
        set((s) => {
          const p = clamp(Math.round(page), 0, lastPage(s.guests.length));
          return { page: p, focus: focus ?? (p <= 1 ? 'right' : 'left'), reveal: idleReveal };
        }),

      goToGuest: (index) => get().setPage(index + 2, 'left'),
      setSinglePage: (v) => set({ singlePage: v }),
      setHostOpen: (v) => set({ hostOpen: v }),
      setReady: () => set({ ready: true }),
      setLocale: (l) => set({ locale: l }),
      toggleSound: () => set((s) => ({ sound: !s.sound })),
      updateEvent: (patch) => set((s) => ({ event: { ...s.event, ...patch } })),

      addGuest: (name) =>
        set((s) => ({ guests: [...s.guests, blankGuest(name ?? STRINGS[s.locale].newGuest)] })),

      addGuests: (names) =>
        set((s) => ({
          guests: [
            ...s.guests,
            ...names
              .map((n) => n.trim())
              .filter(Boolean)
              .slice(0, 200)
              .map((n) => blankGuest(n.slice(0, 80))),
          ],
        })),

      updateGuest: (id, patch) =>
        set((s) => ({ guests: s.guests.map((g) => (g.id === id ? { ...g, ...patch } : g)) })),

      removeGuest: (id) =>
        set((s) => {
          const guests = s.guests.filter((g) => g.id !== id);
          return { guests, page: Math.min(s.page, lastPage(guests.length)), reveal: idleReveal };
        }),

      moveGuest: (id, dir) =>
        set((s) => {
          const i = s.guests.findIndex((g) => g.id === id);
          const j = i + dir;
          if (i < 0 || j < 0 || j >= s.guests.length) return {};
          const guests = [...s.guests];
          [guests[i], guests[j]] = [guests[j], guests[i]];
          return { guests };
        }),

      startReveal: () =>
        set((s) => {
          const gi = guestIndexForPage(s.page, s.guests.length);
          if (gi < 0 || s.reveal.phase !== 'idle') return {};
          const g = s.guests[gi];
          const guests = g.revealed ? s.guests.map((x) => (x.id === g.id ? { ...x, revealed: false } : x)) : s.guests;
          return { guests, focus: 'right', reveal: { phase: 'suspense', guestId: g.id, t0: performance.now() } };
        }),

      setRevealPhase: (phase) =>
        set((s) => {
          if (phase === 'idle') return { reveal: idleReveal };
          if (!s.reveal.guestId) return {};
          if (phase === 'done') {
            const id = s.reveal.guestId;
            return {
              reveal: { ...s.reveal, phase, t0: performance.now() },
              guests: s.guests.map((g) => (g.id === id ? { ...g, revealed: true } : g)),
            };
          }
          return { reveal: { ...s.reveal, phase, t0: performance.now() } };
        }),

      resetReveals: () => set((s) => ({ guests: s.guests.map((g) => ({ ...g, revealed: false })), reveal: idleReveal })),

      loadDemo: () =>
        set((s) => ({
          guests: demoGuests(s.locale),
          event: demoEvent(s.locale),
          page: Math.min(s.page, lastPage(6)),
          reveal: idleReveal,
        })),

      importData: (data) => {
        try {
          const d = data as { event?: Partial<EventInfo>; guests?: unknown[] };
          if (!d || !Array.isArray(d.guests)) return false;
          const verdicts: Verdict[] = ['nice', 'naughty', 'undecided'];
          const guests: Guest[] = d.guests
            .filter((g): g is Record<string, unknown> => !!g && typeof g === 'object')
            .slice(0, 200)
            .map((g) => ({
              id: uid(),
              name: String(g.name ?? '').slice(0, 80),
              nice: toLines(g.nice),
              naughty: toLines(g.naughty),
              verdict: verdicts.includes(g.verdict as Verdict) ? (g.verdict as Verdict) : 'undecided',
              score: clamp(Number(g.score ?? 50) || 0, 0, 100),
              revealed: false,
            }));
          const cur = get().event;
          set({
            guests,
            event: {
              name: String(d.event?.name ?? cur.name).slice(0, 80),
              date: String(d.event?.date ?? cur.date).slice(0, 80),
              santa: String(d.event?.santa ?? cur.santa).slice(0, 40),
            },
            page: 0,
            focus: 'right',
            reveal: idleReveal,
          });
          return true;
        } catch {
          return false;
        }
      },

      clearAll: () => set({ guests: [], page: 0, focus: 'right', reveal: idleReveal }),
    }),
    {
      name: 'santa-naughty-book-v1',
      storage: createJSONStorage(() => safeStorage),
      partialize: (s) => ({ event: s.event, guests: s.guests, locale: s.locale, sound: s.sound }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<BookState>;
        return {
          ...current,
          ...p,
          // ältere Daten ohne "revealed"-Feld absichern
          guests: Array.isArray(p.guests) ? p.guests.map((g) => ({ ...g, revealed: g.revealed ?? false })) : current.guests,
        };
      },
    },
  ),
);

export const useStrings = () => STRINGS[useBook((s) => s.locale)];
