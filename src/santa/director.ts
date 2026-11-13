import { music, sfx } from '../audio';
import type { Guest } from '../model';
import { useBook } from '../store';
import { codeCandidates, unlock } from '../vault';
import { extractName, LINES, sentences } from './lines';
import { gesture, santaRuntime, setShot } from './santaRuntime';
import { useSanta } from './santaStore';
import { listen, primeSpeech, speak, stopListening, stopSpeaking, sttSupported } from './speech';
import { vision } from './vision';

/**
 * Ablauf des Abends:
 * Begrüssung → (Person vor der Kamera → Name → Zauberwort → Geschichte → Stempel) × N
 * → Schlusswort → Buch blättert im 2-Minuten-Takt.
 */

type Ev = { kind: 'presence' | 'person' | 'skip' | 'end' | 'input' | 'abort'; text?: string };
type Waiter = { kinds: Ev['kind'][]; resolve: (e: Ev | null) => void };

class Aborted extends Error {}

const FLIP_MS = 120_000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

class Director {
  private gen = 0;
  private waiters: Waiter[] = [];
  private endRequested = false;
  private doneIds = new Set<string>();
  private flipTimer = 0;
  private unsubPresence: (() => void) | null = null;

  private get s() {
    return useSanta.getState();
  }

  /** Startet den Abend – muss aus einem Klick kommen (Kamera, Mikrofon, Ton) */
  async start(opts: { camera: boolean; mic: boolean }) {
    const g = ++this.gen;
    primeSpeech();
    sfx.unlock();
    this.endRequested = false;
    this.doneIds.clear();
    useBook.getState().wipe();
    const frame = this.s.frame;
    if (frame) useBook.getState().setEvent(frame.event);
    this.s.patch({ phase: 'intro', done: 0, error: null, caption: '', heard: '', input: null });
    this.s.setMode('santa');
    await vision().start(opts);
    this.unsubPresence?.();
    this.unsubPresence = vision().onPresence((p) => p && this.emit({ kind: 'presence' }));
    try {
      await this.run(g);
    } catch (e) {
      if (!(e instanceof Aborted)) this.s.patch({ error: String(e) });
    }
  }

  // Steuerung aus der Oberfläche / Tastatur
  skip = () => this.emit({ kind: 'skip' });
  personHere = () => {
    vision().forcePresent();
    this.emit({ kind: 'person' });
  };
  end = () => {
    this.endRequested = true;
    this.emit({ kind: 'end' });
  };
  input = (text: string) => this.emit({ kind: 'input', text });

  /** Alles beenden und vergessen */
  stop() {
    this.gen++;
    this.emit({ kind: 'abort' });
    clearInterval(this.flipTimer);
    stopSpeaking();
    stopListening();
    music.stop();
    this.unsubPresence?.();
    vision().stop();
    useBook.getState().wipe();
    this.doneIds.clear();
    this.s.patch({ phase: 'idle', caption: '', heard: '', input: null, letterbox: false, titleCard: null, done: 0 });
    this.s.setMode('santa');
  }

  private emit(e: Ev) {
    const i = this.waiters.findIndex((w) => e.kind === 'abort' || w.kinds.includes(e.kind));
    if (i < 0) return;
    if (e.kind === 'abort') {
      const all = this.waiters;
      this.waiters = [];
      all.forEach((w) => w.resolve(e));
      return;
    }
    const [w] = this.waiters.splice(i, 1);
    w.resolve(e);
  }

  private wait(kinds: Ev['kind'][], ms: number) {
    let w!: Waiter;
    const p = new Promise<Ev | null>((resolve) => {
      const timer = setTimeout(() => done(null), ms);
      const done = (e: Ev | null) => {
        clearTimeout(timer);
        this.waiters = this.waiters.filter((x) => x !== w);
        resolve(e);
      };
      w = { kinds: [...kinds, 'abort'], resolve: done };
      this.waiters.push(w);
    });
    return { p, cancel: () => w.resolve(null) };
  }

  private check(g: number) {
    if (g !== this.gen) throw new Aborted();
  }

  /** Spricht Satz für Satz mit Untertitel; Leertaste überspringt einen Satz */
  private async say(g: number, text: string) {
    for (const sentence of sentences(text)) {
      this.check(g);
      this.s.patch({ caption: sentence });
      music.duck(true);
      const skip = this.wait(['skip', 'end'], 600_000);
      const r = await Promise.race([speak(sentence).then(() => null), skip.p]);
      skip.cancel();
      if (r) stopSpeaking();
      this.check(g);
      if (r?.kind === 'end') break;
    }
    music.duck(false);
  }

  private async title(g: number, card: { kicker?: string; title: string; sub?: string }, ms: number) {
    this.s.patch({ titleCard: card });
    const w = this.wait(['skip'], ms);
    await w.p;
    this.check(g);
    this.s.patch({ titleCard: null });
    await sleep(700);
  }

  /** Antwort per Mikrofon oder Tastatur (was zuerst kommt) */
  private async ask(g: number, kind: 'name' | 'code', ms: number): Promise<string[]> {
    this.s.patch({ input: kind, heard: '' });
    const typed = this.wait(['input', 'end'], ms + 20_000);
    const useMic = this.s.mic === 'on' && sttSupported();
    let result: string[] = [];
    if (useMic) {
      const heard = listen(ms, (t) => this.s.patch({ heard: t }));
      const r = await Promise.race([heard.then((a) => ({ mic: a })), typed.p.then((e) => ({ typed: e }))]);
      if ('typed' in r) {
        stopListening();
        result = r.typed?.text ? [r.typed.text] : [];
      } else if (r.mic.length) {
        typed.cancel();
        result = r.mic;
      } else {
        // nichts gehört – noch kurz auf getippte Eingabe warten
        const e = await Promise.race([typed.p, sleep(6000).then(() => null)]);
        typed.cancel();
        result = e?.text ? [e.text] : [];
      }
    } else {
      const e = await typed.p;
      result = e?.text ? [e.text] : [];
    }
    this.check(g);
    this.s.patch({ input: null });
    return result;
  }

  private async run(g: number) {
    const frame = this.s.frame;
    const total = this.s.total;

    // Vorspann + Begrüssung
    this.s.patch({ letterbox: true });
    setShot('wide', true);
    music.start();
    await this.title(g, { title: frame?.title || "Santa's Naughty Book", sub: frame?.subtitle || frame?.event.name }, 5200);
    santaRuntime.pose = 'wave';
    setShot('medium');
    gesture('laugh');
    await this.say(g, frame?.greeting || LINES.greeting);
    santaRuntime.pose = 'idle';
    music.stop();
    this.s.patch({ letterbox: false });

    while (!this.endRequested && this.doneIds.size < total) {
      // Warten auf die nächste Person
      this.s.patch({ phase: 'waiting' });
      setShot('medium');
      if (!vision().present) {
        await this.say(g, this.doneIds.size === 0 ? LINES.waitFirst : LINES.waitNext);
        await this.wait(['presence', 'person', 'end'], 30 * 60_000).p;
        this.check(g);
        if (this.endRequested) break;
      }

      // Name
      this.s.patch({ phase: 'name' });
      setShot('close');
      santaRuntime.brows = 1;
      await this.say(g, LINES.askName);
      let heard = await this.ask(g, 'name', 7000);
      if (!heard.length && !this.endRequested) {
        await this.say(g, LINES.againName);
        heard = await this.ask(g, 'name', 8000);
      }
      santaRuntime.brows = 0;
      if (this.endRequested) break;
      const name = heard.length ? extractName(heard[0]) : '';
      if (name) {
        gesture('nod');
        await this.say(g, LINES.hello);
      }

      // Zauberwort
      this.s.patch({ phase: 'code' });
      let guest: Guest | null = null;
      for (let attempt = 0; attempt < 2 && !guest && !this.endRequested; attempt++) {
        await this.say(g, attempt === 0 ? LINES.askCode : LINES.wrongCode);
        const said = await this.ask(g, 'code', 9000);
        if (!said.length) continue;
        santaRuntime.pose = 'think';
        this.s.patch({ checking: true });
        guest = await unlock(codeCandidates(said));
        this.s.patch({ checking: false });
        santaRuntime.pose = 'idle';
        this.check(g);
      }
      if (this.endRequested) break;
      if (!guest) {
        gesture('shake');
        await this.say(g, LINES.giveUp);
        continue;
      }
      if (this.doneIds.has(guest.id)) {
        await this.say(g, LINES.already(guest.name));
        continue;
      }
      await this.chapter(g, guest);
    }

    // Schlusswort
    this.s.patch({ phase: 'closing', letterbox: true, input: null });
    setShot('medium');
    if (this.doneIds.size >= total) await this.say(g, LINES.allDone);
    if (frame?.closing && this.doneIds.size > 0) await this.say(g, frame.closing);
    santaRuntime.pose = 'wave';
    setShot('close');
    await this.say(g, frame?.farewell || LINES.farewell);
    santaRuntime.pose = 'idle';
    setShot('wide');
    music.start();
    await this.title(g, { title: LINES.endTitle, sub: frame?.event.name }, 7000);
    music.stop();
    this.unsubPresence?.();
    vision().stop();
    this.finale();
  }

  private async chapter(g: number, guest: Guest) {
    const book = useBook.getState();
    const gi = book.addGuest(guest);
    book.setPage(gi + 2, 'right');
    this.s.patch({ phase: 'reading', letterbox: true });
    await this.title(g, { kicker: LINES.chapter(this.doneIds.size + 1), title: guest.name, sub: guest.title }, guest.title ? 3400 : 2600);

    santaRuntime.pose = 'read';
    setShot('medium');
    await this.say(g, LINES.found(guest.name));
    for (const story of guest.stories) {
      if (this.endRequested) break;
      await this.say(g, story);
    }

    // Urteil: Nahaufnahme → Schnitt aufs Buch (Stempel) → zurück
    this.s.patch({ phase: 'verdict' });
    santaRuntime.pose = 'present';
    setShot('close');
    await this.say(g, LINES.verdictIntro(guest.name));
    setShot('book', true);
    await sleep(400);
    if (useBook.getState().startReveal(guest.id)) {
      const t0 = performance.now();
      while (performance.now() - t0 < 6000 && !useBook.getState().guests[gi]?.revealed) {
        await sleep(80);
        this.check(g);
      }
      await sleep(1100);
    }
    setShot('close', true);
    gesture(guest.verdict === 'nice' ? 'laugh' : guest.verdict === 'naughty' ? 'shake' : 'nod');
    await this.say(g, LINES.verdict[guest.verdict]);
    santaRuntime.pose = 'idle';
    this.doneIds.add(guest.id);
    this.s.patch({ done: this.doneIds.size, letterbox: false });
  }

  /** Nach allen Geschichten: Das Buch erscheint und blättert alle 2 Minuten um */
  private finale() {
    this.s.patch({ phase: 'finale', caption: '', letterbox: false });
    this.s.setMode('book');
    const book = useBook.getState();
    book.setPage(1);
    clearInterval(this.flipTimer);
    this.flipTimer = window.setInterval(() => {
      const b = useBook.getState();
      if (b.page >= b.guests.length + 2) b.setPage(1);
      else b.next();
    }, FLIP_MS);
  }
}

export const director = new Director();
