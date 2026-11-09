import { music, sfx } from '../audio';
import { useContent } from '../content';
import type { Guest } from '../demoData';
import { resolveBrand } from '../brand';
import { useBook } from '../store';
import { extractName, matchGuest } from './names';
import { gesture, santaRuntime, setShot } from './santaRuntime';
import { useSanta } from './santaStore';
import { listen, primeSpeech, speak, stopListening, stopSpeaking, sttSupported, ttsSupported } from './speech';
import { buildStory, pick, santaLines, sentences } from './stories';
import { fetchVoice, voiceAvailable } from './voice';
import { vision } from './vision';

/**
 * Santa AI als kleiner Film:
 * Titelkarte → Prolog (Kamerafahrt, Spieldose) → Begrüssung → pro Gast ein Kapitel
 * (Person erkennen → Name → Geschichte → Schnitt aufs Buch: Stempel → Reaktion) → Epilog → Abspann.
 * Der Gastgeber kann jederzeit eingreifen (Name, Person da, Weiter, Abschied, Stopp).
 */

class Aborted extends Error {}

type Ev = { kind: 'presence' } | { kind: 'name'; name: string } | { kind: 'timeout' } | { kind: 'skip' } | { kind: 'end' };
type Kind = Ev['kind'];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

class Director {
  private gen = 0;
  private waiters = new Set<(e: Ev) => void>();
  private skipSay = false;
  private endRequested = false;
  private unsubPresence: (() => void) | null = null;

  private get patch() {
    return useSanta.getState().patch;
  }
  /** Sprache, in der Santa spricht (gsw / de / en) */
  private get lang() {
    return useContent.getState().language;
  }
  private get lines() {
    const L = santaLines(this.lang);
    const o = useContent.getState().story;
    return {
      ...L,
      prologue: () => o.prologue || L.prologue(),
      greeting: (event: string, count: number) => o.greeting || L.greeting(event, count),
      epilogue: () => o.epilogue || L.epilogue(),
      farewell: (event: string) => o.farewell || L.farewell(event),
    };
  }

  private emit(e: Ev) {
    for (const w of [...this.waiters]) w(e);
  }

  private check(g: number) {
    if (g !== this.gen) throw new Aborted();
  }

  private wait(g: number, kinds: Kind[], timeoutMs: number): Promise<Ev> {
    this.check(g);
    return new Promise((resolve, reject) => {
      const done = (e: Ev) => {
        clearTimeout(timer);
        this.waiters.delete(w);
        if (g !== this.gen) reject(new Aborted());
        else resolve(e);
      };
      const w = (e: Ev) => {
        if (kinds.includes(e.kind) || e.kind === 'end' || e.kind === 'skip') done(e);
      };
      const timer = setTimeout(() => done({ kind: 'timeout' }), timeoutMs);
      this.waiters.add(w);
    });
  }

  /** Santa spricht – satzweise mit Untertiteln; der nächste Satz wird schon vorgeladen */
  private async say(g: number, text: string) {
    this.check(g);
    this.skipSay = false;
    const parts = sentences(text);
    music.duck(true);
    try {
      for (let i = 0; i < parts.length; i++) {
        if (this.skipSay || this.endRequested) break;
        this.check(g);
        const prev = parts[i - 1] ?? '';
        const next = parts[i + 1] ?? '';
        if (next) void fetchVoice(next, parts[i], parts[i + 2] ?? '');
        this.patch({ caption: parts[i] });
        await speak(parts[i], this.lang, { prev, next });
        this.check(g);
      }
    } finally {
      music.duck(false);
    }
    this.check(g);
  }

  private async title(g: number, card: { kicker?: string; title: string; sub?: string }, ms: number) {
    this.patch({ titleCard: card, caption: '' });
    await this.wait(g, ['skip'], ms);
    this.patch({ titleCard: null });
    await sleep(500);
    this.check(g);
  }

  // ---------- Steuerung von aussen (UI) ----------

  async start(opts: { camera: boolean; mic: boolean }) {
    const g = ++this.gen;
    this.endRequested = false;
    sfx.unlock();
    primeSpeech();
    this.patch({
      phase: 'starting',
      caption: '',
      heard: '',
      doneIds: [],
      currentGuestId: null,
      error: null,
      awaitingName: false,
      awaitingPerson: false,
      letterbox: true,
      titleCard: null,
      voice: 'checking',
    });
    useBook.getState().setPage(0);
    setShot('wide', true);
    if (useContent.getState().story.music !== false) music.start();
    await vision().start(opts);
    const s = useSanta.getState();
    const eleven = await voiceAvailable();
    this.patch({
      speechIn: sttSupported() && s.mic === 'on',
      speechOut: eleven || ttsSupported(),
      voice: eleven ? 'elevenlabs' : ttsSupported() ? 'browser' : 'none',
    });
    this.unsubPresence?.();
    this.unsubPresence = vision().onPresence((p) => {
      if (p) this.emit({ kind: 'presence' });
    });
    try {
      await this.run(g);
    } catch (e) {
      if (!(e instanceof Aborted)) {
        console.error(e);
        this.patch({ error: String(e) });
      }
    }
  }

  stop() {
    this.gen++;
    this.emit({ kind: 'end' });
    stopSpeaking();
    stopListening();
    music.stop();
    this.unsubPresence?.();
    this.unsubPresence = null;
    vision().stop();
    santaRuntime.pose = 'idle';
    santaRuntime.brows = 0;
    setShot('medium');
    this.patch({
      phase: 'idle',
      caption: '',
      heard: '',
      awaitingName: false,
      awaitingPerson: false,
      currentGuestId: null,
      letterbox: false,
      titleCard: null,
    });
  }

  provideName(name: string) {
    const n = name.trim();
    if (n) this.emit({ kind: 'name', name: n });
  }

  personHere() {
    vision().forcePresent();
    this.emit({ kind: 'presence' });
  }

  skip() {
    this.skipSay = true;
    stopSpeaking();
    stopListening();
    this.emit({ kind: 'skip' });
  }

  end() {
    this.endRequested = true;
    this.skipSay = true;
    stopSpeaking();
    stopListening();
    this.emit({ kind: 'end' });
  }

  // ---------- Ablauf ----------

  private remaining(): Guest[] {
    const done = new Set(useSanta.getState().doneIds);
    return useBook.getState().guests.filter((x) => !done.has(x.id));
  }

  private async run(g: number) {
    const L = this.lines;
    const book = useBook.getState();
    const story = useContent.getState().story;
    const brand = resolveBrand(useContent.getState().brand);
    const cam = () => useSanta.getState().detector === 'on';

    // Titelkarte
    this.patch({ phase: 'greeting' });
    santaRuntime.pose = 'read';
    await this.title(
      g,
      {
        kicker: brand.presents ?? (brand.name ? L.presents(brand.name) : undefined),
        title: story.title || "Santa's Naughty Book",
        sub: story.subtitle || book.event.name,
      },
      5200,
    );

    // Prolog: langsame Fahrt von der Totalen zu Santa, der in seiner Liste liest
    setShot('medium');
    await this.say(g, L.prologue());
    if (this.endRequested) return this.finale(g);

    // Santa blickt auf – Begrüssung in Nahaufnahme
    santaRuntime.pose = 'wave';
    gesture('laugh');
    setShot('close', true);
    music.stop();
    await this.say(g, L.greeting(book.event.name, book.guests.length));
    santaRuntime.pose = 'idle';
    setShot('medium');
    this.patch({ letterbox: false });

    let first = true;
    let quiet = 0;
    while (!this.endRequested) {
      const remaining = this.remaining();
      if (useBook.getState().guests.length > 0 && remaining.length === 0) break;

      this.patch({ phase: 'next', currentGuestId: null });
      santaRuntime.pose = 'present';
      await this.say(g, first ? L.firstCall(cam()) : L.nextCall(remaining.map((x) => x.name), cam()));
      santaRuntime.pose = 'idle';
      first = false;
      if (this.endRequested) break;

      const arrival = await this.awaitArrival(g);
      if (arrival.kind === 'end') break;
      if (arrival.kind === 'timeout') {
        quiet++;
        if (quiet >= 2) break;
        await this.say(g, L.anyoneThere);
        continue;
      }
      quiet = 0;

      let name: string | null = arrival.kind === 'name' ? arrival.name : null;
      if (!name) {
        gesture('surprise');
        setShot('close');
        await this.say(g, pick(L.seePerson));
        name = await this.askName(g);
      }
      if (this.endRequested) break;
      await this.chapter(g, name ?? L.dearGuest);
    }
    await this.finale(g);
  }

  /** Epilog und Abspann */
  private async finale(g: number) {
    const L = this.lines;
    const allDone = this.remaining().length === 0;
    // Eigenes Schlusswort (Manuskript) auch bei vorzeitigem „Abschied“ halten, sofern schon jemand dran war
    const full = allDone || (!!useContent.getState().story.epilogue && useSanta.getState().doneIds.length > 0);
    this.endRequested = false;
    this.patch({ phase: 'farewell', currentGuestId: null, awaitingName: false, awaitingPerson: false, letterbox: true });
    useBook.getState().setPage(0);
    if (useContent.getState().story.music !== false) music.start();
    santaRuntime.pose = 'read';
    setShot('medium');
    if (full) await this.say(g, L.epilogue());
    santaRuntime.pose = 'wave';
    gesture('laugh');
    setShot('close');
    await this.say(g, full ? L.farewell(useBook.getState().event.name) : L.farewellEarly);
    santaRuntime.pose = 'idle';
    setShot('wide');
    const brand = resolveBrand(useContent.getState().brand);
    const story = useContent.getState().story;
    await this.title(g, { title: story.endTitle || L.endTitle, sub: [brand.name, useBook.getState().event.name].filter(Boolean).join(' · ') }, 7000);
    music.stop();
    this.unsubPresence?.();
    this.unsubPresence = null;
    vision().stop();
    setShot('medium');
    this.patch({ phase: 'finished', caption: '', heard: '', letterbox: false });
  }

  private async awaitArrival(g: number): Promise<Ev> {
    this.patch({ awaitingPerson: true });
    try {
      if (vision().present) {
        const e = await this.wait(g, ['name', 'skip'], 2600);
        if (e.kind !== 'timeout') return e.kind === 'skip' ? { kind: 'presence' } : e;
        return { kind: 'presence' };
      }
      if (useSanta.getState().detector === 'on') {
        const e = await this.wait(g, ['presence', 'name'], 32000);
        return e.kind === 'skip' ? { kind: 'presence' } : e;
      }
      if (useSanta.getState().speechIn) {
        const r = await this.listenOrName(g, 9000);
        if (r.kind === 'name') return r;
        if (r.kind === 'end') return r;
        if (r.text) {
          const guest = matchGuest(r.text, useBook.getState().guests);
          const n = guest?.name ?? extractName(r.text);
          if (n) return { kind: 'name', name: n };
        }
      }
      const e = await this.wait(g, ['presence', 'name'], 40000);
      return e.kind === 'skip' ? { kind: 'presence' } : e;
    } finally {
      this.patch({ awaitingPerson: false });
    }
  }

  private async listenOrName(
    g: number,
    ms: number,
  ): Promise<{ kind: 'name'; name: string } | { kind: 'end' } | { kind: 'heard'; text: string | null; error?: string }> {
    this.check(g);
    const manual = this.wait(g, ['name'], ms + 2000);
    manual.catch(() => {});
    const heard = listen(this.lang, ms, (t) => this.patch({ heard: t })).then((r) => ({ kind: 'heard' as const, ...r }));
    const r = await Promise.race([manual, heard]);
    stopListening();
    this.check(g);
    if (r.kind === 'name') return r;
    if (r.kind === 'end') return { kind: 'end' };
    if (r.kind === 'heard') {
      if (r.text) this.patch({ heard: r.text });
      if (r.error === 'not-allowed' || r.error === 'service-not-allowed' || r.error === 'network' || r.error === 'unsupported') {
        this.patch({ speechIn: false });
      }
      return r;
    }
    return { kind: 'heard', text: null };
  }

  private async askName(g: number): Promise<string | null> {
    const L = this.lines;
    this.patch({ phase: 'asking-name', awaitingName: true });
    santaRuntime.brows = 1;
    try {
      for (let attempt = 0; attempt < 2; attempt++) {
        await this.say(g, attempt === 0 ? pick(L.askName) : L.notUnderstood);
        if (!useSanta.getState().speechIn) break;
        await sleep(150);
        const r = await this.listenOrName(g, 7000);
        if (r.kind === 'name') return r.name;
        if (r.kind === 'end') return null;
        if (r.text) {
          const guest = matchGuest(r.text, useBook.getState().guests);
          if (guest) return guest.name;
          const n = extractName(r.text);
          if (n) return n;
        }
        if (!useSanta.getState().speechIn) break;
      }
      await this.say(g, L.hostHelp);
      const e = await this.wait(g, ['name'], 60000);
      return e.kind === 'name' ? e.name : null;
    } finally {
      santaRuntime.brows = 0;
      this.patch({ awaitingName: false });
    }
  }

  /** Ein Kapitel pro Gast */
  private async chapter(g: number, rawName: string) {
    const L = this.lines;
    let guests = useBook.getState().guests;
    let guest = matchGuest(rawName, guests);
    if (guest && useSanta.getState().doneIds.includes(guest.id)) {
      gesture('shake');
      await this.say(g, L.alreadyDone(guest.name));
      return;
    }
    await this.say(g, L.hello(guest?.name ?? rawName));
    if (!guest) {
      await this.say(g, L.unknown(rawName));
      useBook.getState().addGuest(rawName);
      guests = useBook.getState().guests;
      const added = guests[guests.length - 1];
      useBook.getState().updateGuest(added.id, { verdict: 'nice', score: 20 });
      guest = useBook.getState().guests.find((x) => x.id === added.id) ?? added;
    }
    const gid = guest.id;
    const gi = useBook.getState().guests.findIndex((x) => x.id === gid);
    const num = useSanta.getState().doneIds.length + 1;

    // Kapitel-Titel
    this.patch({ phase: 'reading', currentGuestId: gid, letterbox: true });
    useBook.getState().updateGuest(gid, { revealed: false });
    useBook.getState().setPage(gi + 2, 'right');
    const story = useContent.getState().story;
    await this.title(g, { kicker: `${story.chapterLabel || L.chapter} ${num}`, title: guest.name, sub: guest.title }, guest.title ? 3400 : 2600);

    // Geschichte: Santa liest, Kamera fährt langsam heran
    santaRuntime.pose = 'read';
    setShot('medium');
    await this.say(g, L.lookup(guest.name));
    await this.say(g, buildStory(guest, this.lang));

    // Urteil: Nahaufnahme → Schnitt aufs Buch (Stempel) → Schnitt zurück zur Reaktion
    this.patch({ phase: 'verdict' });
    santaRuntime.pose = 'present';
    setShot('close');
    await this.say(g, L.verdictIntro(guest.name));
    if (!this.endRequested) {
      setShot('book', true);
      await sleep(350);
      useBook.getState().startReveal();
      const t0 = performance.now();
      while (performance.now() - t0 < 5000) {
        const ph = useBook.getState().reveal.phase;
        if (ph === 'done' || ph === 'idle') break;
        await sleep(80);
        this.check(g);
      }
      await sleep(1100);
      this.check(g);
    }
    const v = useBook.getState().guests.find((x) => x.id === gid)?.verdict ?? 'nice';
    setShot('close', true);
    gesture(v === 'nice' ? 'laugh' : v === 'naughty' ? 'shake' : 'nod');
    await this.say(g, L.verdict(v));
    this.patch({ doneIds: [...useSanta.getState().doneIds, gid], letterbox: false });
    santaRuntime.pose = 'idle';
    setShot('medium');
  }

  /** Alle vorhersehbaren Sätze (für „Stimme vorbereiten“) – gruppiert wie sie gesprochen werden */
  scriptTexts(): string[][] {
    const L = this.lines;
    const book = useBook.getState();
    const ev = book.event.name;
    const out: string[][] = [];
    const add = (t: string) => out.push(sentences(t));
    add(L.prologue());
    add(L.greeting(ev, book.guests.length));
    add(L.firstCall(true));
    add(L.firstCall(false));
    [...L.seePerson, ...L.askName, L.notUnderstood, L.hostHelp, L.anyoneThere].forEach(add);
    add(L.epilogue());
    add(L.farewell(ev));
    add(L.farewellEarly);
    for (const x of book.guests) {
      add(L.hello(x.name));
      add(L.lookup(x.name));
      add(L.verdictIntro(x.name));
      add(L.verdict(x.verdict));
      add(buildStory(x, this.lang));
    }
    return out;
  }
}

export const director = new Director();
