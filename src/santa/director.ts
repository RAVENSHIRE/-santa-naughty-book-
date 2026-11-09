import { sfx } from '../audio';
import type { Guest } from '../demoData';
import { useBook } from '../store';
import { matchGuest, extractName } from './names';
import { gesture, santaRuntime } from './santaRuntime';
import { useSanta } from './santaStore';
import { listen, primeSpeech, speak, stopListening, stopSpeaking, sttSupported, ttsSupported } from './speech';
import { buildStory, pick, santaLines, sentences } from './stories';
import { vision } from './vision';

/**
 * Der Gesprächsablauf von „Santa AI“:
 * Begrüssung → Person erkennen → Namen erfragen → Geschichte aus dem Buch vorlesen → Urteil
 * → „Wer ist als Nächstes?“ … bis alle dran waren → Abschied.
 * Der Gastgeber kann jederzeit eingreifen (Name eintippen, Person melden, überspringen, beenden).
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
  private get locale() {
    return useBook.getState().locale;
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

  /** Santa spricht (satzweise mit Untertiteln) */
  private async say(g: number, text: string) {
    this.check(g);
    this.skipSay = false;
    for (const s of sentences(text)) {
      if (this.skipSay || this.endRequested) break;
      this.check(g);
      this.patch({ caption: s });
      await speak(s, this.locale);
      this.check(g);
    }
    this.check(g);
  }

  // ---------- Steuerung von aussen (UI) ----------

  async start(opts: { camera: boolean; mic: boolean }) {
    const g = ++this.gen;
    this.endRequested = false;
    sfx.unlock();
    primeSpeech();
    this.patch({ phase: 'starting', caption: '', heard: '', doneIds: [], currentGuestId: null, error: null, awaitingName: false, awaitingPerson: false });
    useBook.getState().setPage(0);
    await vision().start(opts);
    const s = useSanta.getState();
    this.patch({ speechIn: sttSupported() && s.mic === 'on', speechOut: ttsSupported() });
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
    this.unsubPresence?.();
    this.unsubPresence = null;
    vision().stop();
    santaRuntime.pose = 'idle';
    santaRuntime.brows = 0;
    this.patch({ phase: 'idle', caption: '', heard: '', awaitingName: false, awaitingPerson: false, currentGuestId: null });
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
    return useBook.getState().guests.filter((g) => !done.has(g.id));
  }

  private async run(g: number) {
    const L = santaLines(this.locale);
    const book = useBook.getState();
    const cam = () => useSanta.getState().detector === 'on';

    this.patch({ phase: 'greeting' });
    santaRuntime.pose = 'wave';
    await this.say(g, L.greeting(book.event.name, book.guests.length));
    santaRuntime.pose = 'idle';

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

      // auf die nächste Person warten (Kamera, Name vom Gastgeber oder Sprache)
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
        await this.say(g, pick(L.seePerson));
        name = await this.askName(g);
      }
      if (this.endRequested) break;
      await this.handlePerson(g, name ?? L.dearGuest);
    }

    // Abschied
    this.patch({ phase: 'farewell', currentGuestId: null, awaitingName: false, awaitingPerson: false });
    santaRuntime.pose = 'wave';
    gesture('laugh');
    const done = this.remaining().length === 0;
    const Lf = santaLines(this.locale);
    this.endRequested = false;
    await this.say(g, done ? Lf.farewell(useBook.getState().event.name) : Lf.farewellEarly);
    santaRuntime.pose = 'idle';
    // Kamera und Mikrofon wieder freigeben
    this.unsubPresence?.();
    this.unsubPresence = null;
    vision().stop();
    this.patch({ phase: 'finished', caption: '', heard: '' });
    useBook.getState().setPage(0);
  }

  private async awaitArrival(g: number): Promise<Ev> {
    this.patch({ awaitingPerson: true });
    try {
      // kurze Pause, damit die vorige Person Platz machen kann
      if (vision().present) {
        const e = await this.wait(g, ['name', 'skip'], 2600);
        if (e.kind !== 'timeout') return e.kind === 'skip' ? { kind: 'presence' } : e;
        return { kind: 'presence' };
      }
      if (useSanta.getState().detector === 'on') {
        const e = await this.wait(g, ['presence', 'name'], 32000);
        return e.kind === 'skip' ? { kind: 'presence' } : e;
      }
      // ohne Kamera: direkt nach dem Namen horchen
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

  /** Hört zu – oder nimmt den Namen, den der Gastgeber eintippt */
  private async listenOrName(g: number, ms: number): Promise<{ kind: 'name'; name: string } | { kind: 'end' } | { kind: 'heard'; text: string | null; error?: string }> {
    this.check(g);
    const manual = this.wait(g, ['name'], ms + 2000);
    manual.catch(() => {});
    const heard = listen(this.locale, ms, (t) => this.patch({ heard: t })).then((r) => ({ kind: 'heard' as const, ...r }));
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
    const L = santaLines(this.locale);
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

  private async handlePerson(g: number, rawName: string) {
    const L = santaLines(this.locale);
    let guests = useBook.getState().guests;
    let guest = matchGuest(rawName, guests);
    const doneIds = new Set(useSanta.getState().doneIds);
    if (guest && doneIds.has(guest.id)) {
      gesture('shake');
      await this.say(g, L.alreadyDone(guest.name));
      return;
    }
    await this.say(g, L.hello(guest?.name ?? rawName));
    if (!guest) {
      await this.say(g, L.unknown(rawName));
      useBook.getState().addGuest(rawName);
      guests = useBook.getState().guests;
      guest = guests[guests.length - 1];
      useBook.getState().updateGuest(guest.id, { verdict: 'nice', score: 20 });
      guest = useBook.getState().guests.find((x) => x.id === guest!.id) ?? guest;
    }
    const gi = useBook.getState().guests.findIndex((x) => x.id === guest!.id);
    this.patch({ phase: 'reading', currentGuestId: guest.id });

    // Buch auf der richtigen Seite aufschlagen
    useBook.getState().updateGuest(guest.id, { revealed: false });
    useBook.getState().setPage(gi + 2, 'right');
    santaRuntime.pose = 'read';
    await this.say(g, L.lookup());
    await this.say(g, buildStory(guest, this.locale));

    // Urteil: Stempel im Buch, Santa reagiert
    this.patch({ phase: 'verdict' });
    santaRuntime.pose = 'present';
    await this.say(g, L.verdictIntro(guest.name));
    if (this.endRequested) return;
    useBook.getState().startReveal();
    const t0 = performance.now();
    while (performance.now() - t0 < 4500) {
      const ph = useBook.getState().reveal.phase;
      if (ph === 'done' || ph === 'idle') break;
      await sleep(80);
      this.check(g);
    }
    const v = useBook.getState().guests.find((x) => x.id === guest!.id)?.verdict ?? 'nice';
    gesture(v === 'nice' ? 'laugh' : v === 'naughty' ? 'shake' : 'nod');
    await this.say(g, L.verdict(v));
    this.patch({ doneIds: [...useSanta.getState().doneIds, guest.id] });
    santaRuntime.pose = 'idle';
  }
}

export const director = new Director();
