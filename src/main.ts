import './styles.css';
import show from './show.json';
import { matchName } from './names';
import * as sfx from './sfx';

/* ======================================================================
   Daten
   ====================================================================== */
type Cue = [number, number, string];
interface Line {
  audio: string;
  text: string;
  cues?: Cue[];
}
interface Person extends Line {
  id: string;
  name: string;
  names: string[];
  title: string;
}
const people = show.people as Person[];
const lines = show.lines as Record<'greet' | 'found' | 'retry' | 'notfound' | 'bye', Line>;
const closing = show.closing as Line;

/* ======================================================================
   Elemente
   ====================================================================== */
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const body = document.body;
const stage = $('stage');
const deskImg = $<HTMLImageElement>('deskImg');
const globe = $<HTMLButtonElement>('globe');
const globeImg = globe.querySelector('.globe-img') as HTMLElement;
const globeSnow = $<HTMLCanvasElement>('globeSnow');
const deskSnow = $<HTMLCanvasElement>('deskSnow');
const introVideo = $<HTMLVideoElement>('introVideo');
const idleVideo = $<HTMLVideoElement>('idleVideo');
const talkVideo = $<HTMLVideoElement>('talkVideo');
const caption = $('caption');
const phone = $('phone');
const phoneState = $('phoneState');
const phoneTimer = $('phoneTimer');
const listenBox = $('listen');
const listenText = $('listenText');
const namesBox = $('names');
const fade = $('fade');
const loading = $('loading');
const help = $('help');

const voice = new Audio();
voice.preload = 'auto';
// Die Stimme kann separat kommen oder schon im Intro-Video gemischt sein (voice leer)
const introVoice = new Audio(show.intro.voice || undefined);
introVoice.preload = 'auto';

/* ======================================================================
   Szenen
   ====================================================================== */
type Scene = 'desk' | 'intro' | 'room';
let scene: Scene = 'desk';
function setScene(s: Scene) {
  scene = s;
  body.dataset.scene = s;
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function blackout(during: () => void) {
  fade.classList.add('on');
  await sleep(750);
  during();
  await sleep(150);
  fade.classList.remove('on');
}

/* ---------- Szene 1: Schreibtisch mit dunkler Schneekugel ---------- */
const G = show.desk.globe;
stage.style.setProperty('--gx', String(G.x));
stage.style.setProperty('--gy', String(G.y));
stage.style.setProperty('--gr', String(G.r));
deskImg.src = show.desk.image;
globeImg.style.backgroundImage = `url("${show.desk.image}")`;
deskImg.addEventListener('load', () => loading.classList.add('done'));
setTimeout(() => loading.classList.add('done'), 5000);

function layoutGlobe() {
  // Der Bildausschnitt in der Kugel muss genau auf dem Hintergrundbild liegen
  const W = stage.clientWidth;
  const H = stage.clientHeight;
  const R = G.r * W;
  globeImg.style.backgroundSize = `${W}px ${H}px`;
  globeImg.style.backgroundPosition = `${-(G.x * W - R)}px ${-(G.y * H - R)}px`;
  for (const c of [globeSnow, deskSnow]) {
    const r = c.getBoundingClientRect();
    c.width = Math.max(1, Math.round(r.width));
    c.height = Math.max(1, Math.round(r.height));
  }
}
addEventListener('resize', layoutGlobe);
layoutGlobe();

/* Schnee: draussen leise, in der Kugel beim Schütteln ein Wirbel */
interface Flake { x: number; y: number; vx: number; vy: number; r: number }
const outside: Flake[] = Array.from({ length: 140 }, () => ({ x: Math.random(), y: Math.random(), vx: 0, vy: 0.0006 + Math.random() * 0.0012, r: 0.6 + Math.random() * 1.8 }));
let inside: Flake[] = Array.from({ length: 90 }, () => ({ x: Math.random(), y: 0.75 + Math.random() * 0.2, vx: 0, vy: 0, r: 0.6 + Math.random() * 1.6 }));
let swirlUntil = 0;
function snowFrame(now: number) {
  requestAnimationFrame(snowFrame);
  if (scene !== 'desk') return;
  const dc = deskSnow.getContext('2d')!;
  dc.clearRect(0, 0, deskSnow.width, deskSnow.height);
  dc.fillStyle = 'rgba(255,255,255,0.7)';
  for (const f of outside) {
    f.y += f.vy;
    f.x += Math.sin(now / 1500 + f.r * 9) * 0.0003;
    if (f.y > 1) { f.y = 0; f.x = Math.random(); }
    dc.beginPath();
    dc.arc(f.x * deskSnow.width, f.y * deskSnow.height, f.r, 0, 6.283);
    dc.fill();
  }
  const gc = globeSnow.getContext('2d')!;
  const w = globeSnow.width;
  const h = globeSnow.height;
  gc.clearRect(0, 0, w, h);
  const swirling = now < swirlUntil;
  gc.fillStyle = 'rgba(255,255,255,0.9)';
  for (const f of inside) {
    if (swirling) {
      const dx = f.x - 0.5;
      const dy = f.y - 0.5;
      f.vx += -dy * 0.0025 + (Math.random() - 0.5) * 0.004;
      f.vy += dx * 0.0025 + (Math.random() - 0.5) * 0.004;
    } else {
      f.vy += 0.00004;
      f.vx *= 0.96;
    }
    f.vx *= 0.97;
    f.vy *= 0.97;
    f.x += f.vx;
    f.y += f.vy;
    const dx = f.x - 0.5;
    const dy = f.y - 0.5;
    const d = Math.hypot(dx, dy);
    if (d > 0.44) { f.x = 0.5 + (dx / d) * 0.44; f.y = 0.5 + (dy / d) * 0.44; f.vx *= -0.3; f.vy *= -0.3; }
    gc.globalAlpha = globe.classList.contains('lit') ? 0.95 : 0.35;
    gc.beginPath();
    gc.arc(f.x * w, f.y * h, f.r * (w / 300), 0, 6.283);
    gc.fill();
  }
}
requestAnimationFrame(snowFrame);

globe.addEventListener('click', () => void shakeGlobe());
async function shakeGlobe() {
  if (scene !== 'desk' || globe.classList.contains('shake')) return;
  sfx.unlockAudio();
  sfx.shake();
  inside.forEach((f) => { f.vx = (Math.random() - 0.5) * 0.03; f.vy = -Math.random() * 0.03; });
  swirlUntil = performance.now() + 1600;
  globe.classList.add('shake', 'lit');
  // Video schon laden und stumm anwerfen, damit der Übergang nahtlos ist
  introVideo.currentTime = 0;
  introVideo.muted = true;
  void introVideo.play().catch(() => {});
  introVideo.pause();
  await sleep(1500);
  startIntro();
}

/* ---------- Szene 2: Intro-Film ---------- */
introVideo.src = show.intro.video;
function startIntro() {
  setScene('intro');
  introVideo.currentTime = 0;
  introVideo.muted = false;
  introVideo.volume = show.intro.videoVolume;
  void introVideo.play().catch(() => {});
  introVoice.currentTime = 0;
  if (show.intro.voice) setTimeout(() => { if (scene === 'intro') void introVoice.play().catch(() => {}); }, show.intro.voiceDelay * 1000);
}
// Erst in die Stube, wenn auch der letzte Satz fertig ist
introVideo.addEventListener('ended', () => {
  if (show.intro.voice && !introVoice.paused && !introVoice.ended) introVoice.onended = () => void enterRoom();
  else void enterRoom();
});
$('skipIntro').addEventListener('click', () => void enterRoom());

/* ---------- Szene 3: Stube ---------- */
idleVideo.src = show.room.idle;
talkVideo.src = show.room.talk;
idleVideo.poster = talkVideo.poster = show.room.poster;
async function enterRoom() {
  if (scene === 'room') return;
  introVoice.pause();
  await blackout(() => {
    introVideo.pause();
    setScene('room');
    void idleVideo.play().catch(() => {});
    void talkVideo.play().catch(() => {});
  });
}
function talking(on: boolean) {
  body.classList.toggle('talking', on);
  talkVideo.classList.toggle('on', on);
}

/* ======================================================================
   Sprechen mit Untertiteln
   ====================================================================== */
let gen = 0;
class Aborted extends Error {}
const check = (tok: number) => {
  if (tok !== gen) throw new Aborted();
};

function say(line: Line, tok: number): Promise<void> {
  return new Promise((resolve, reject) => {
    voice.src = line.audio;
    voice.currentTime = 0;
    let raf = 0;
    const done = (ok: boolean) => {
      cancelAnimationFrame(raf);
      voice.onended = voice.onerror = null;
      talking(false);
      caption.textContent = '';
      ok ? resolve() : reject(new Aborted());
    };
    const tick = () => {
      if (tok !== gen) return done(false);
      const t = voice.currentTime;
      if (line.cues?.length) {
        const cue = line.cues.find(([s, e]) => t >= s - 0.05 && t <= e + 0.35);
        caption.textContent = cue ? cue[2] : '';
      } else caption.textContent = line.text;
      raf = requestAnimationFrame(tick);
    };
    voice.onended = () => done(true);
    voice.onerror = () => done(true);
    talking(true);
    voice.play().then(tick, () => done(true));
  });
}

/* ======================================================================
   Anruf: klingeln → «Wie heisst du?» → zuhören → Geschichte
   ====================================================================== */
type SR = { lang: string; interimResults: boolean; maxAlternatives: number; continuous: boolean; start(): void; stop(): void; abort(): void; onresult: ((e: any) => void) | null; onend: (() => void) | null; onerror: ((e: any) => void) | null };
const SRClass: (new () => SR) | undefined = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
let micOk = !!SRClass;
let recognizer: SR | null = null;
let pick: ((p: Person | null) => void) | null = null;

namesBox.innerHTML = people.map((p) => `<button data-id="${p.id}">${p.name}</button>`).join('');
namesBox.addEventListener('click', (e) => {
  const id = (e.target as HTMLElement).closest('button')?.dataset.id;
  const p = people.find((x) => x.id === id);
  if (p && pick) pick(p);
});

function listen(tok: number): Promise<string[]> {
  return new Promise((resolve) => {
    if (!SRClass || !micOk) return resolve([]);
    const rec = new SRClass();
    recognizer = rec;
    rec.lang = 'de-CH';
    rec.interimResults = true;
    rec.maxAlternatives = 5;
    rec.continuous = false;
    const heard: string[] = [];
    listenBox.hidden = false;
    listenText.textContent = 'Sag deinen Namen …';
    const timer = setTimeout(() => rec.stop(), 8000);
    rec.onresult = (e: any) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        listenText.textContent = `«${r[0].transcript.trim()}»`;
        if (r.isFinal) for (let a = 0; a < r.length; a++) heard.push(r[a].transcript);
        else heard.push(r[0].transcript);
      }
    };
    rec.onerror = (e: any) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') micOk = false;
    };
    rec.onend = () => {
      clearTimeout(timer);
      recognizer = null;
      listenBox.hidden = true;
      resolve(tok === gen ? heard : []);
    };
    try {
      rec.start();
    } catch {
      clearTimeout(timer);
      listenBox.hidden = true;
      resolve([]);
    }
  });
}

/** Wartet auf Sprache oder einen Tipp auf einen Namen */
async function askName(tok: number): Promise<Person | null> {
  namesBox.hidden = false;
  let tapped: Person | null = null;
  const tap = new Promise<Person | null>((r) => (pick = (p) => { tapped = p; recognizer?.abort(); r(p); }));
  try {
    for (let attempt = 0; attempt < 2 && micOk; attempt++) {
      const heard = await Promise.race([listen(tok), tap.then(() => [] as string[])]);
      check(tok);
      if (tapped) return tapped;
      const id = matchName(heard, people);
      const person = people.find((p) => p.id === id);
      if (person) return person;
      await say(attempt === 0 ? lines.retry : lines.notfound, tok);
    }
    if (!micOk) listenText.textContent = 'Tippe deinen Namen an';
    return await tap;
  } finally {
    pick = null;
    namesBox.hidden = true;
    listenBox.hidden = true;
  }
}

let timerId = 0;
function startTimer() {
  const t0 = Date.now();
  clearInterval(timerId);
  timerId = window.setInterval(() => {
    const s = Math.floor((Date.now() - t0) / 1000);
    phoneTimer.textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  }, 500);
}

let inCall = false;
async function call(preset?: Person | Line) {
  if (scene !== 'room') return;
  endCall(false);
  const tok = ++gen;
  inCall = true;
  sfx.unlockAudio();
  body.classList.add('in-call');
  phone.hidden = false;
  phone.classList.add('ringing');
  phoneState.textContent = 'Verbinde mit dem Nordpol-HQ …';
  phoneTimer.textContent = '00:00';
  try {
    if (!preset) {
      await sfx.ring();
      check(tok);
    }
    phone.classList.remove('ringing');
    sfx.pickup();
    startTimer();
    phoneState.textContent = 'Samichlaus · Nordpol-HQ';
    if (preset) {
      await say(preset, tok);
    } else {
      await say(lines.greet, tok);
      const person = await askName(tok);
      check(tok);
      if (!person) return endCall(true);
      phoneState.textContent = `Samichlaus · im Gespräch mit ${person.name}`;
      await say(lines.found, tok);
      await say(person, tok);
      await say(lines.bye, tok);
    }
    endCall(true);
  } catch (e) {
    if (!(e instanceof Aborted)) throw e;
  }
}

function endCall(withTone: boolean) {
  if (!inCall) return;
  inCall = false;
  gen++;
  recognizer?.abort();
  voice.pause();
  talking(false);
  caption.textContent = '';
  clearInterval(timerId);
  if (withTone) sfx.hangup();
  phone.hidden = true;
  phone.classList.remove('ringing');
  namesBox.hidden = true;
  listenBox.hidden = true;
  body.classList.remove('in-call');
}

$('callBtn').addEventListener('click', () => void call());
$('hangupBtn').addEventListener('click', () => endCall(true));

/* ======================================================================
   Gastgeber-Tasten
   ====================================================================== */
function backToDesk() {
  endCall(false);
  introVoice.pause();
  introVideo.pause();
  idleVideo.pause();
  talkVideo.pause();
  globe.classList.remove('shake', 'lit');
  setScene('desk');
}

addEventListener('keydown', (e) => {
  const k = e.key;
  if (k === 'f' || k === 'F') {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.();
  } else if (k === 'h' || k === 'H') help.hidden = !help.hidden;
  else if (k === 'Escape') backToDesk();
  else if (k === ' ') {
    if (scene === 'desk') void shakeGlobe();
    else if (scene === 'intro') void enterRoom();
    else if (inCall) voice.paused ? void voice.play() : voice.pause();
    else void call();
  } else if (scene === 'room' && /^[1-8]$/.test(k)) {
    const p = people[Number(k) - 1];
    if (p) void call(p);
  } else if (scene === 'room' && (k === 's' || k === 'S')) void call(closing);
  else return;
  e.preventDefault();
});

// Für automatische Tests
Object.assign(window, { __show: { people, call, setScene, enterRoom, shakeGlobe, matchName } });
