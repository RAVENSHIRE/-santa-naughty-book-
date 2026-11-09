import { defineConfig, loadEnv, type Connect, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, join } from 'node:path';

/**
 * Stellt die Dateien der MediaPipe-Gesichtserkennung unter ./mediapipe/ bereit
 * (Dev-Server und Build), damit nichts von einem fremden CDN geladen werden muss.
 */
function mediapipeAssets(): Plugin {
  const dir = resolve('node_modules/@mediapipe/face_detection');
  const files = [
    'face_detection.js',
    'face_detection_short.binarypb',
    'face_detection_short_range.tflite',
    'face_detection_solution_simd_wasm_bin.js',
    'face_detection_solution_simd_wasm_bin.wasm',
    'face_detection_solution_simd_wasm_bin.data',
    'face_detection_solution_wasm_bin.js',
    'face_detection_solution_wasm_bin.wasm',
  ];
  const types: Record<string, string> = { js: 'text/javascript', wasm: 'application/wasm' };
  return {
    name: 'mediapipe-assets',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const m = req.url?.match(/\/mediapipe\/([\w.]+)/);
        if (!m || !files.includes(m[1])) return next();
        const ext = m[1].split('.').pop() ?? '';
        res.setHeader('Content-Type', types[ext] ?? 'application/octet-stream');
        res.end(readFileSync(join(dir, m[1])));
      });
    },
    generateBundle() {
      for (const f of files) {
        const p = join(dir, f);
        if (existsSync(p)) this.emitFile({ type: 'asset', fileName: `mediapipe/${f}`, source: readFileSync(p) });
      }
    },
  };
}


/**
 * ElevenLabs-Proxy für Santas Stimme (nur Dev-/Preview-Server, z. B. im Codespace).
 * Der API-Key kommt aus ELEVENLABS_API_KEY (Codespaces-Secret oder .env.local) und verlässt den Server nie.
 * Jede erzeugte Datei landet in .voice-cache/ – mit `npm run voice:export` nach public/voice kopieren,
 * dann spielt die Seite die Stimme auch auf GitHub Pages ohne Key ab.
 */
function elevenLabsVoice(env: Record<string, string>): Plugin {
  const key = env.ELEVENLABS_API_KEY || process.env.ELEVENLABS_API_KEY || '';
  // Nur gesetzt, wenn ausdrücklich per Umgebungsvariable gewählt – sonst gilt die Stimme aus content.json / voice.ts
  const defVoice = env.ELEVENLABS_VOICE_ID || process.env.ELEVENLABS_VOICE_ID || '';
  const defModel = env.ELEVENLABS_MODEL_ID || process.env.ELEVENLABS_MODEL_ID || '';
  // z. B. für Datenresidenz (EU) anpassbar
  const apiBase = (env.ELEVENLABS_API_BASE || process.env.ELEVENLABS_API_BASE || 'https://api.elevenlabs.io').replace(/\/$/, '');
  const cacheDir = resolve('.voice-cache');
  const manifestFile = join(cacheDir, 'manifest.json');
  const readManifest = () => {
    try {
      return JSON.parse(readFileSync(manifestFile, 'utf8')) as { voiceId?: string; modelId?: string; files: Record<string, string> };
    } catch {
      return { files: {} as Record<string, string> };
    }
  };
  const json = (res: import('node:http').ServerResponse, code: number, body: unknown) => {
    res.statusCode = code;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(body));
  };
  const handler: Connect.NextHandleFunction = (req, res, next) => {
    const path = (req.url ?? '').split('?')[0];
    if (path.endsWith('/api/voice/status')) return json(res, 200, { enabled: !!key, voiceId: defVoice || undefined, modelId: defModel || undefined });
    // Cache-Dateien im Dev-Server ausliefern (vor public/voice)
    const vm = path.match(/\/voice\/([a-f0-9]{40}\.mp3|manifest\.json)$/);
    if (vm && req.method === 'GET') {
      const f = join(cacheDir, vm[1]);
      if (existsSync(f)) {
        res.setHeader('Content-Type', vm[1].endsWith('.mp3') ? 'audio/mpeg' : 'application/json');
        res.setHeader('Cache-Control', 'no-cache');
        return res.end(readFileSync(f));
      }
      return next();
    }
    if (!path.endsWith('/api/voice/tts') || req.method !== 'POST') return next();
    let body = '';
    req.on('data', (c) => {
      body += c;
      if (body.length > 20000) req.destroy();
    });
    req.on('end', async () => {
      try {
        const b = JSON.parse(body || '{}');
        const text = String(b.text ?? '').trim().slice(0, 1500);
        if (!text) return json(res, 400, { error: 'text fehlt' });
        const voiceId = String(b.voiceId || defVoice || 'JBFqnCBsd6RMkjVDRZzb').replace(/[^\w-]/g, '');
        const modelId = String(b.modelId || defModel || 'eleven_multilingual_v2').replace(/[^\w.-]/g, '');
        const num = (v: unknown, d: number) => (typeof v === 'number' && isFinite(v) ? v : d);
        const stability = num(b.stability, 0.45);
        const similarity = num(b.similarity, 0.8);
        const style = num(b.style, 0.35);
        const speed = num(b.speed, 0.92);
        const prev = String(b.previousText ?? '').slice(0, 1000);
        const nxt = String(b.nextText ?? '').slice(0, 1000);
        const hash = createHash('sha1').update([voiceId, modelId, stability, similarity, style, speed, prev, nxt, text].join('|')).digest('hex');
        const file = join(cacheDir, `${hash}.mp3`);
        if (existsSync(file)) {
          res.setHeader('Content-Type', 'audio/mpeg');
          return res.end(readFileSync(file));
        }
        if (!key) return json(res, 503, { error: 'ELEVENLABS_API_KEY fehlt' });
        const call = (full: boolean) =>
          fetch(`${apiBase}/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`, {
            method: 'POST',
            headers: { 'xi-api-key': key, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
            body: JSON.stringify({
              text,
              model_id: modelId,
              previous_text: full && prev ? prev : undefined,
              next_text: full && nxt ? nxt : undefined,
              voice_settings: full
                ? { stability, similarity_boost: similarity, style, use_speaker_boost: true, speed }
                : { stability, similarity_boost: similarity },
            }),
          });
        let r = await call(true);
        // Nicht jedes Modell kennt alle Optionen (Kontext, Stil, Tempo) → mit minimalen Einstellungen nochmals versuchen
        if (r.status === 400 || r.status === 422) {
          console.warn(`[elevenlabs] ${r.status} ${(await r.text()).slice(0, 200)} – nochmals mit Grundeinstellungen`);
          r = await call(false);
        }
        if (!r.ok) {
          const msg = await r.text();
          console.warn(`[elevenlabs] ${r.status} ${msg.slice(0, 300)}`);
          return json(res, r.status, { error: msg.slice(0, 300) });
        }
        const audio = Buffer.from(await r.arrayBuffer());
        mkdirSync(cacheDir, { recursive: true });
        writeFileSync(file, audio);
        const m = readManifest();
        m.voiceId = m.voiceId ?? voiceId;
        m.modelId = m.modelId ?? modelId;
        m.files[hash] = `${hash}.mp3`;
        writeFileSync(manifestFile, JSON.stringify(m, null, 1));
        res.setHeader('Content-Type', 'audio/mpeg');
        res.end(audio);
      } catch (e) {
        json(res, 500, { error: String(e) });
      }
    });
  };
  return {
    name: 'elevenlabs-voice',
    configureServer(server) {
      server.middlewares.use(handler);
    },
    configurePreviewServer(server) {
      server.middlewares.use(handler);
    },
  };
}

// `npm run build`        -> dist/         (normal build, e.g. for GitHub Pages)
// `npm run build:single` -> dist-single/  (everything inlined in one index.html)
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
  base: './',
  // Codespaces leitet Ports über *.app.github.dev weiter
  server: { watch: { ignored: ['**/.voice-cache/**'] }, allowedHosts: ['.app.github.dev', '.github.dev'] },
  preview: { allowedHosts: ['.app.github.dev', '.github.dev'] },
  // Die Ein-Datei-Vorschau läuft in einer Sandbox ohne Kamera – dort braucht es MediaPipe nicht
  plugins: [react(), ...(mode === 'single' ? [viteSingleFile()] : [mediapipeAssets(), elevenLabsVoice(env)])],
  build: {
    outDir: mode === 'single' ? 'dist-single' : 'dist',
    chunkSizeWarningLimit: 2500,
  },
};
});
