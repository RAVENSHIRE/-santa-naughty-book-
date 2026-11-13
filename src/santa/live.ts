import { santaRuntime } from './santaRuntime';

/**
 * Gemini Live: Mrs. Claus spricht und hört in Echtzeit (WebSocket, ohne SDK).
 * Der Browser bekommt von /api/live-token nur einen kurzlebigen Einmal-Schlüssel.
 * Mikrofon → 16 kHz PCM → Gemini; Gemini → 24 kHz PCM → Lautsprecher.
 * Der Mund des Avatars folgt dem Pegel der Ausgabe.
 * Solange Mrs. Claus spricht, wird das Mikrofon nicht gesendet (kein Echo, kein Partylärm).
 */

export interface LiveTool {
  name: string;
  description: string;
  parameters?: { type: 'OBJECT'; properties: Record<string, { type: 'STRING'; description: string }>; required?: string[] };
  run: (args: Record<string, unknown>) => Promise<Record<string, unknown>>;
}

export interface LiveOptions {
  system: string;
  voice: string;
  tools: LiveTool[];
  mic: boolean;
  onCaption: (text: string) => void;
  onTurnComplete: () => void;
  onClose: (reason: string) => void;
}

export async function liveAvailable(): Promise<boolean> {
  try {
    const r = await fetch(new URL('api/live-token', document.baseURI).href, { cache: 'no-store' });
    return r.ok && !!(await r.json()).enabled;
  } catch {
    return false;
  }
}

const b64 = (buf: ArrayBuffer) => {
  const u8 = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000));
  return btoa(s);
};
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

// Mikrofon in 16-Bit-Blöcke (64 ms) zerlegen
const WORKLET = `
class Rec extends AudioWorkletProcessor {
  constructor() { super(); this.buf = new Int16Array(1024); this.n = 0; }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (ch) for (let i = 0; i < ch.length; i++) {
      const v = Math.max(-1, Math.min(1, ch[i]));
      this.buf[this.n++] = v < 0 ? v * 0x8000 : v * 0x7fff;
      if (this.n === this.buf.length) { this.port.postMessage(this.buf.buffer.slice(0)); this.n = 0; }
    }
    return true;
  }
}
registerProcessor('rec', Rec);`;

export class LiveSession {
  private ws: WebSocket | null = null;
  private out: AudioContext | null = null;
  private inCtx: AudioContext | null = null;
  private mic: MediaStream | null = null;
  /** Hüllkurve der geplanten Ausgabe: [Startzeit, laut?] in 40-ms-Schritten */
  private env: [number, boolean][] = [];
  private gain: GainNode | null = null;
  private playHead = 0;
  private sources = new Set<AudioBufferSourceNode>();
  private caption = '';
  private raf = 0;
  private quietSince = 0;
  private closed = false;
  private ready: Promise<void> = Promise.resolve();
  /** Anzahl empfangener Audio-Stücke (für „hat schon gesprochen?“) */
  chunks = 0;

  constructor(private o: LiveOptions) {}

  /** Muss aus einem Klick kommen (Audio-Freigabe) */
  async start() {
    this.out = new AudioContext({ sampleRate: 24000 });
    await this.out.resume();
    this.gain = this.out.createGain();
    this.gain.connect(this.out.destination);
    this.meter();

    const r = await fetch(new URL('api/live-token', document.baseURI).href, { method: 'POST', cache: 'no-store' });
    const t = (await r.json()) as { token?: string; model?: string; version?: string; url?: string; error?: string };
    if (!r.ok || !t.token) throw new Error(`Gemini nicht erreichbar: ${t.error ?? r.status}`);

    const url =
      t.url ??
      `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.${t.version ?? 'v1beta'}` +
      `.GenerativeService.BidiGenerateContentConstrained?access_token=${encodeURIComponent(t.token)}`;
    const ws = new WebSocket(url);
    this.ws = ws;
    this.ready = new Promise((resolve, reject) => {
      const fail = (why: string) => reject(new Error(why));
      ws.onopen = () => {
        ws.send(
          JSON.stringify({
            setup: {
              model: `models/${t.model}`,
              generationConfig: {
                responseModalities: ['AUDIO'],
                speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: this.o.voice } } },
              },
              systemInstruction: { parts: [{ text: this.o.system }] },
              tools: [
                {
                  functionDeclarations: this.o.tools.map(({ name, description, parameters }) =>
                    parameters ? { name, description, parameters } : { name, description },
                  ),
                },
              ],
              outputAudioTranscription: {},
              inputAudioTranscription: {},
              realtimeInputConfig: {
                automaticActivityDetection: { startOfSpeechSensitivity: 'START_SENSITIVITY_LOW', silenceDurationMs: 700 },
                activityHandling: 'NO_INTERRUPTION',
              },
            },
          }),
        );
      };
      ws.onmessage = async (ev) => {
        const text = typeof ev.data === 'string' ? ev.data : await (ev.data as Blob).text();
        const msg = JSON.parse(text);
        if (msg.setupComplete) resolve();
        this.onMessage(msg);
      };
      ws.onerror = () => fail('Verbindung zu Gemini fehlgeschlagen');
      ws.onclose = (e) => {
        fail(`Gemini hat die Verbindung beendet (${e.code} ${e.reason})`);
        if (!this.closed) this.o.onClose(`${e.code} ${e.reason}`);
      };
    });
    await this.ready;
    if (this.o.mic) await this.startMic();
  }

  /** Text an Mrs. Claus (z. B. Hinweise vom System) */
  say(text: string) {
    this.send({ clientContent: { turns: [{ role: 'user', parts: [{ text }] }], turnComplete: true } });
  }

  get speaking() {
    return this.sources.size > 0;
  }

  stop() {
    this.closed = true;
    cancelAnimationFrame(this.raf);
    this.flush();
    this.ws?.close();
    this.ws = null;
    this.mic?.getTracks().forEach((t) => t.stop());
    this.mic = null;
    void this.inCtx?.close().catch(() => {});
    void this.out?.close().catch(() => {});
    santaRuntime.speaking = false;
    santaRuntime.listening = false;
  }

  private send(o: unknown) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(o));
  }

  private async startMic() {
    this.mic = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
    });
    this.inCtx = new AudioContext({ sampleRate: 16000 });
    const url = URL.createObjectURL(new Blob([WORKLET], { type: 'text/javascript' }));
    await this.inCtx.audioWorklet.addModule(url);
    URL.revokeObjectURL(url);
    const node = new AudioWorkletNode(this.inCtx, 'rec');
    node.port.onmessage = (e: MessageEvent<ArrayBuffer>) => {
      // Halb-Duplex: während Mrs. Claus spricht (und kurz danach) nichts senden
      if (this.speaking || performance.now() - this.quietSince < 400) return;
      this.send({ realtimeInput: { audio: { mimeType: 'audio/pcm;rate=16000', data: b64(e.data) } } });
    };
    this.inCtx.createMediaStreamSource(this.mic).connect(node);
    santaRuntime.listening = true;
  }

  private async onMessage(msg: Record<string, any>) {
    const sc = msg.serverContent;
    if (sc) {
      for (const p of sc.modelTurn?.parts ?? []) {
        if (p.inlineData?.data && String(p.inlineData.mimeType ?? '').startsWith('audio/')) this.play(p.inlineData.data);
      }
      if (sc.outputTranscription?.text) {
        this.caption = (this.caption + sc.outputTranscription.text).replace(/\s+/g, ' ');
        // Untertitel: nur der laufende Satz
        const parts = this.caption.split(/(?<=[.!?…])\s+/);
        this.o.onCaption(parts.slice(-2).join(' ').trim());
      }
      if (sc.interrupted) this.flush();
      if (sc.turnComplete) {
        this.caption = '';
        // warten, bis die Ausgabe wirklich fertig gespielt ist
        const wait = Math.max(0, (this.playHead - (this.out?.currentTime ?? 0)) * 1000);
        setTimeout(() => this.o.onTurnComplete(), wait + 150);
      }
    }
    if (msg.toolCall?.functionCalls) {
      const responses = [];
      for (const call of msg.toolCall.functionCalls as { id: string; name: string; args?: Record<string, unknown> }[]) {
        const tool = this.o.tools.find((t) => t.name === call.name);
        let response: Record<string, unknown>;
        try {
          response = tool ? await tool.run(call.args ?? {}) : { error: 'unbekanntes Werkzeug' };
        } catch (e) {
          response = { error: String(e) };
        }
        responses.push({ id: call.id, name: call.name, response });
      }
      this.send({ toolResponse: { functionResponses: responses } });
    }
    if (msg.goAway) console.warn('Gemini beendet die Sitzung bald', msg.goAway);
  }

  private play(data: string) {
    if (!this.out || !this.gain) return;
    this.chunks++;
    const pcm = unb64(data);
    const n = pcm.length >> 1;
    const view = new DataView(pcm.buffer);
    const buf = this.out.createBuffer(1, n, 24000);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < n; i++) ch[i] = view.getInt16(i * 2, true) / 0x8000;
    const src = this.out.createBufferSource();
    src.buffer = buf;
    src.connect(this.gain);
    const at = Math.max(this.out.currentTime + 0.05, this.playHead);
    src.start(at);
    // Lautstärke je 40 ms vormerken – daraus bewegt sich der Mund, unabhängig von Rucklern
    for (let i = 0; i < n; i += 960) {
      let sum = 0;
      const end = Math.min(n, i + 960);
      for (let k = i; k < end; k++) sum += ch[k] * ch[k];
      this.env.push([at + i / 24000, Math.sqrt(sum / (end - i)) > 0.02]);
    }
    this.playHead = at + buf.duration;
    this.sources.add(src);
    src.onended = () => {
      this.sources.delete(src);
      if (!this.sources.size) this.quietSince = performance.now();
    };
  }

  private flush() {
    this.sources.forEach((s) => {
      try {
        s.stop();
      } catch {
        /* schon fertig */
      }
    });
    this.sources.clear();
    this.env = [];
    this.playHead = 0;
    this.quietSince = performance.now();
  }

  /** Mund: vorgemerkte Lautstärke zur aktuellen Abspielzeit, mit kurzer Haltezeit */
  private meter() {
    let hold = 0;
    const tick = () => {
      this.raf = requestAnimationFrame(tick);
      const t = this.out?.currentTime ?? 0;
      while (this.env.length > 1 && this.env[1][0] <= t) this.env.shift();
      const cur = this.env[0];
      if (cur && cur[0] <= t && t < cur[0] + 0.04 && cur[1]) hold = t + 0.14;
      santaRuntime.speaking = t < hold;
    };
    tick();
  }
}
