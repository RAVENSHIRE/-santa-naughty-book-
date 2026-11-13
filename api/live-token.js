// Vercel-Funktion: gibt dem Browser einen kurzlebigen Einmal-Schlüssel für Gemini Live.
// Der eigentliche Key liegt nur als Umgebungsvariable GEMINI_API_KEY auf Vercel.
//   GET  /api/live-token  → { enabled, model }
//   POST /api/live-token  → { token, model, version }
const MODEL = process.env.GEMINI_LIVE_MODEL || 'gemini-3.8-live';
const API = 'https://generativelanguage.googleapis.com';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const key = (process.env.GEMINI_API_KEY || '').trim();
  // Nur für lokale Tests: Attrappe statt Google
  const mock = process.env.GEMINI_LIVE_MOCK_WS;
  if (mock && !process.env.VERCEL) {
    return res.status(200).json(req.method === 'GET' ? { enabled: true, model: 'mock' } : { token: 'mock', model: 'mock', version: 'v1beta', url: mock });
  }
  if (req.method === 'GET') return res.status(200).json({ enabled: !!key, model: MODEL });
  if (req.method !== 'POST') return res.status(405).json({ error: 'nur GET/POST' });
  if (!key) return res.status(503).json({ error: 'GEMINI_API_KEY fehlt in Vercel' });

  // Nur von der eigenen Seite (oder localhost) – hält zufällige Aufrufe fern
  const origin = String(req.headers.origin || '');
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '');
  const own = origin === `https://${host}` || /^http:\/\/localhost(:\d+)?$/.test(origin);
  if (origin && !own) return res.status(403).json({ error: 'fremde Herkunft' });

  const now = Date.now();
  const body = {
    uses: 1,
    expireTime: new Date(now + 30 * 60_000).toISOString(),
    newSessionExpireTime: new Date(now + 2 * 60_000).toISOString(),
  };
  let last = '';
  for (const version of ['v1beta', 'v1alpha']) {
    try {
      const r = await fetch(`${API}/${version}/auth_tokens`, {
        method: 'POST',
        headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (r.ok) {
        const j = await r.json();
        return res.status(200).json({ token: j.name, model: MODEL, version });
      }
      last = `${version}: ${r.status} ${(await r.text()).slice(0, 300)}`;
    } catch (e) {
      last = `${version}: ${e}`;
    }
  }
  return res.status(502).json({ error: last });
}
