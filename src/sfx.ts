/** Kleine Geräusche, im Browser erzeugt (keine Dateien nötig) */
let ctx: AudioContext | null = null;
const ac = () => (ctx ??= new AudioContext());

export function unlockAudio() {
  void ac().resume();
}

function tone(freq: number, start: number, dur: number, gain = 0.15, type: OscillatorType = 'sine') {
  const c = ac();
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0, c.currentTime + start);
  g.gain.linearRampToValueAtTime(gain, c.currentTime + start + 0.02);
  g.gain.setValueAtTime(gain, c.currentTime + start + dur - 0.05);
  g.gain.linearRampToValueAtTime(0, c.currentTime + start + dur);
  o.connect(g).connect(c.destination);
  o.start(c.currentTime + start);
  o.stop(c.currentTime + start + dur + 0.05);
}

/** Schweizer Freiton (425 Hz), zweimal klingeln – dauert ca. 3.2 s */
export function ring(): Promise<void> {
  tone(425, 0, 1.0, 0.12);
  tone(425, 2.0, 1.0, 0.12);
  return new Promise((r) => setTimeout(r, 3300));
}

/** Abheben: kurzes Knacken */
export function pickup() {
  const c = ac();
  const len = Math.floor(c.sampleRate * 0.08);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len) * 0.5;
  const src = c.createBufferSource();
  src.buffer = buf;
  src.connect(c.destination);
  src.start();
}

/** Aufgelegt: drei kurze Töne */
export function hangup() {
  for (let i = 0; i < 3; i++) tone(425, i * 0.35, 0.2, 0.1);
}

/** Schneekugel schütteln: Glöckchen + Rauschen */
export function shake() {
  const c = ac();
  const len = Math.floor(c.sampleRate * 1.2);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    const t = i / c.sampleRate;
    data[i] = (Math.random() * 2 - 1) * 0.18 * Math.abs(Math.sin(t * 14)) * (1 - t / 1.2);
  }
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = 3500;
  src.connect(f).connect(c.destination);
  src.start();
  [1568, 2093, 2637, 3136, 2349, 1760].forEach((fr, i) => tone(fr, 0.1 + i * 0.13 + Math.random() * 0.05, 0.6, 0.05, 'triangle'));
}
