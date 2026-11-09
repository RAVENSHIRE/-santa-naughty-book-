import { santaRuntime } from './santaRuntime';
import { useSanta, type DeviceState, type FaceBox } from './santaStore';

/**
 * Kamera + Mikrofon + Gesichtserkennung (MediaPipe Face Detection, läuft lokal im Browser).
 * Liefert „Person da / weg“ mit Hysterese und die Position des Gesichts für Santas Blick.
 */

interface MPDetection {
  boundingBox: { xCenter: number; yCenter: number; width: number; height: number };
}
interface MPFaceDetection {
  setOptions(o: { model?: string; minDetectionConfidence?: number; selfieMode?: boolean }): void;
  onResults(cb: (r: { detections?: MPDetection[] }) => void): void;
  initialize(): Promise<void>;
  send(i: { image: HTMLVideoElement }): Promise<void>;
  close(): Promise<void>;
}

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    if (document.querySelector(`script[data-src="${src}"]`)) return resolve();
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.dataset.src = src;
    s.crossOrigin = 'anonymous';
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('script ' + src));
    document.head.appendChild(s);
  });
}

type Listener = (present: boolean) => void;

class Vision {
  readonly video: HTMLVideoElement;
  private stream: MediaStream | null = null;
  private fd: MPFaceDetection | null = null;
  private running = false;
  private hits = 0;
  private misses = 0;
  private listeners = new Set<Listener>();
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private levelBuf: Float32Array<ArrayBuffer> | null = null;
  present = false;

  constructor() {
    this.video = document.createElement('video');
    this.video.muted = true;
    this.video.playsInline = true;
    this.video.setAttribute('playsinline', '');
    this.video.autoplay = true;
  }

  onPresence(cb: Listener) {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  get stream_() {
    return this.stream;
  }

  /** Startet Kamera/Mikrofon. Muss aus einem Klick heraus aufgerufen werden. */
  async start(opts: { camera: boolean; mic: boolean }) {
    const patch = useSanta.getState().patch;
    if (!navigator.mediaDevices?.getUserMedia) {
      patch({ camera: opts.camera ? 'unavailable' : 'off', mic: opts.mic ? 'unavailable' : 'off' });
      return;
    }
    patch({ camera: opts.camera ? 'starting' : 'off', mic: opts.mic ? 'starting' : 'off' });
    type Got = { stream: MediaStream | null; err: string | null };
    const tryGet = async (c: MediaStreamConstraints): Promise<Got> => {
      try {
        return { stream: await navigator.mediaDevices.getUserMedia(c), err: null };
      } catch (e) {
        return { stream: null, err: (e as DOMException)?.name ?? 'Error' };
      }
    };
    const videoC: MediaTrackConstraints = { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } };
    const audioC: MediaTrackConstraints = { echoCancellation: true, noiseSuppression: true, autoGainControl: true };
    let res: Got = await tryGet({ video: opts.camera ? videoC : false, audio: opts.mic ? audioC : false });
    let camState: DeviceState = opts.camera ? 'on' : 'off';
    let micState: DeviceState = opts.mic ? 'on' : 'off';
    if (!res.stream && opts.camera && opts.mic) {
      // einzeln probieren – vielleicht fehlt nur ein Gerät
      const v = await tryGet({ video: videoC });
      const a = await tryGet({ audio: audioC });
      const tracks = [...(v.stream?.getTracks() ?? []), ...(a.stream?.getTracks() ?? [])];
      res = { stream: tracks.length ? new MediaStream(tracks) : null, err: v.err ?? a.err };
      camState = v.stream ? 'on' : stateFor(v.err);
      micState = a.stream ? 'on' : stateFor(a.err);
    } else if (!res.stream) {
      camState = opts.camera ? stateFor(res.err) : 'off';
      micState = opts.mic ? stateFor(res.err) : 'off';
    }
    this.stream = res.stream;
    patch({ camera: camState, mic: micState });
    if (this.stream?.getVideoTracks().length) {
      this.video.srcObject = this.stream;
      try {
        await this.video.play();
      } catch {
        /* autoplay – läuft dann beim nächsten Frame */
      }
      void this.startDetector();
    }
    if (this.stream?.getAudioTracks().length) this.startLevel(this.stream);
  }

  private async startDetector() {
    const patch = useSanta.getState().patch;
    patch({ detector: 'starting' });
    try {
      const base = new URL('mediapipe/', document.baseURI).href;
      await loadScript(base + 'face_detection.js');
      const Ctor = (window as unknown as { FaceDetection?: new (c: { locateFile: (f: string) => string }) => MPFaceDetection }).FaceDetection;
      if (!Ctor) throw new Error('FaceDetection fehlt');
      const fd = new Ctor({ locateFile: (f) => base + f });
      fd.setOptions({ model: 'short', minDetectionConfidence: 0.55, selfieMode: false });
      fd.onResults((r) => this.onResults(r.detections ?? []));
      await fd.initialize();
      this.fd = fd;
      this.running = true;
      patch({ detector: 'on' });
      void this.loop();
    } catch (e) {
      console.warn('Gesichtserkennung nicht verfügbar', e);
      patch({ detector: 'unavailable' });
    }
  }

  private loop = async () => {
    while (this.running && this.fd) {
      const t0 = performance.now();
      if (this.video.readyState >= 2 && this.video.videoWidth > 0) {
        try {
          await this.fd.send({ image: this.video });
        } catch {
          /* einzelnes Frame überspringen */
        }
      }
      const spent = performance.now() - t0;
      await new Promise((r) => setTimeout(r, Math.max(40, 140 - spent)));
    }
  };

  private onResults(dets: MPDetection[]) {
    // grösstes Gesicht = die Person direkt vor der Kamera
    let best: MPDetection | null = null;
    for (const d of dets) if (!best || d.boundingBox.width > best.boundingBox.width) best = d;
    const big = best && best.boundingBox.width > 0.09;
    let face: FaceBox | null = null;
    if (best && big) {
      const b = best.boundingBox;
      face = { x: 1 - b.xCenter - b.width / 2, y: b.yCenter - b.height / 2, w: b.width, h: b.height };
      this.hits = Math.min(8, this.hits + 1);
      this.misses = 0;
      const cx = face.x + face.w / 2;
      const cy = face.y + face.h / 2;
      santaRuntime.look.x = Math.max(-1, Math.min(1, (cx - 0.5) * 2));
      santaRuntime.look.y = Math.max(-1, Math.min(1, -(cy - 0.45) * 2));
    } else {
      this.misses++;
      if (this.misses > 3) this.hits = 0;
    }
    const was = this.present;
    if (!was && this.hits >= 3) this.present = true;
    if (was && this.misses >= 9) this.present = false;
    santaRuntime.hasPerson = this.present;
    if (!this.present && this.misses > 12) {
      santaRuntime.look.x *= 0.9;
      santaRuntime.look.y *= 0.9;
    }
    useSanta.getState().patch({ face, present: this.present });
    if (was !== this.present) this.listeners.forEach((l) => l(this.present));
  }

  private startLevel(stream: MediaStream) {
    try {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.audioCtx = new Ctor();
      const src = this.audioCtx.createMediaStreamSource(new MediaStream(stream.getAudioTracks()));
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 512;
      src.connect(this.analyser);
      this.levelBuf = new Float32Array(new ArrayBuffer(this.analyser.fftSize * 4));
      const tick = () => {
        if (!this.analyser || !this.levelBuf) return;
        this.analyser.getFloatTimeDomainData(this.levelBuf);
        let sum = 0;
        for (let i = 0; i < this.levelBuf.length; i++) sum += this.levelBuf[i] * this.levelBuf[i];
        const rms = Math.sqrt(sum / this.levelBuf.length);
        santaRuntime.micLevel = Math.min(1, rms * 6);
        requestAnimationFrame(tick);
      };
      tick();
    } catch {
      /* kein Pegel – egal */
    }
  }

  /** Manuell melden, dass jemand da ist (ohne Kamera) */
  forcePresent() {
    const was = this.present;
    this.present = true;
    this.hits = 8;
    this.misses = 0;
    santaRuntime.hasPerson = true;
    useSanta.getState().patch({ present: true });
    if (!was) this.listeners.forEach((l) => l(true));
  }

  stop() {
    this.running = false;
    void this.fd?.close().catch(() => {});
    this.fd = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.video.srcObject = null;
    void this.audioCtx?.close().catch(() => {});
    this.audioCtx = null;
    this.analyser = null;
    this.present = false;
    this.hits = 0;
    this.misses = 0;
    santaRuntime.hasPerson = false;
    santaRuntime.micLevel = 0;
    useSanta.getState().patch({ camera: 'off', mic: 'off', detector: 'off', present: false, face: null });
  }
}

function stateFor(err: string | null): DeviceState {
  if (!err) return 'error';
  if (err === 'NotAllowedError' || err === 'SecurityError') return 'denied';
  if (err === 'NotFoundError' || err === 'OverconstrainedError') return 'unavailable';
  return 'error';
}

let instance: Vision | null = null;
export function vision(): Vision {
  if (!instance) instance = new Vision();
  return instance;
}
