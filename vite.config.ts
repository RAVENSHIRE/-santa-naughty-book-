import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { existsSync, readFileSync } from 'node:fs';
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

/** Dev-Server: /api/* wie auf Vercel (z. B. GEMINI_API_KEY=… npm run dev) */
function devApi(): Plugin {
  return {
    name: 'dev-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const m = req.url?.match(/^\/api\/([\w-]+)/);
        if (!m || !existsSync(`api/${m[1]}.js`)) return next();
        const mod = await import(/* @vite-ignore */ `${resolve(`api/${m[1]}.js`)}?t=${Date.now()}`);
        const r = res as typeof res & { status: (c: number) => typeof r; json: (o: unknown) => void };
        r.status = (c: number) => ((res.statusCode = c), r);
        r.json = (o: unknown) => (res.setHeader('Content-Type', 'application/json'), res.end(JSON.stringify(o)));
        await mod.default(req, r);
      });
    },
  };
}

export default defineConfig({
  base: './',
  server: { allowedHosts: ['.app.github.dev'] },
  plugins: [react(), mediapipeAssets(), devApi()],
  build: { chunkSizeWarningLimit: 2500 },
});
