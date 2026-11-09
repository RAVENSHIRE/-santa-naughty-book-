import type { Guest } from '../demoData';

/** Namen aus gesprochenem Text herauslesen und mit der Gästeliste abgleichen */

const FILLER = new Set(
  [
    'ich', 'bin', 'heisse', 'heiße', 'heiss', 'mein', 'name', 'ist', 'hallo', 'hi', 'hey', 'ja', 'nein', 'der', 'die', 'das',
    'äh', 'ähm', 'also', 'und', 'guten', 'tag', 'abend', 'morgen', 'ok', 'okay', 'santa', 'weihnachtsmann', 'samichlaus',
    'lieber', 'liebe', 'ho', 'hier', 'jetzt', 'mich', 'man', 'nennt', 'grüezi', 'sali', 'salut', 'servus', 'moin', 'na',
    'the', 'my', 'is', 'i', 'am', "i'm", 'im', 'hello', 'yes', 'no', 'um', 'uh', "it's", 'its', 'call', 'me', 'this', 'dear',
    'oh', 'well', 'so', 'and', 'name’s', "name's",
  ].map((w) => w.normalize('NFC')),
);

export const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9\s'-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const cap = (w: string) => w.charAt(0).toUpperCase() + w.slice(1);

export function extractName(transcript: string): string | null {
  const t = transcript.trim();
  if (!t) return null;
  const patterns = [
    /(?:ich hei(?:ss|ß)e|ich bin(?: die| der)?|mein name ist|man nennt mich|hier ist|das ist)\s+([\p{L}][\p{L}'-]*(?:\s+[\p{L}][\p{L}'-]*)?)/iu,
    /(?:my name is|i am|i'm|it's|this is|call me|name's)\s+([\p{L}][\p{L}'-]*(?:\s+[\p{L}][\p{L}'-]*)?)/iu,
  ];
  for (const p of patterns) {
    const m = t.match(p);
    if (m) {
      const words = m[1].split(/\s+/).filter((w) => !FILLER.has(w.toLowerCase()));
      if (words.length) return words.slice(0, 2).map(cap).join(' ');
    }
  }
  const words = t
    .replace(/[.,!?;:«»"“”„]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .filter((w) => !FILLER.has(w.toLowerCase()));
  if (!words.length || words.length > 3) return words.length > 3 ? cap(words[words.length - 1]) : null;
  return words.slice(0, 2).map(cap).join(' ');
}

function lev(a: string, b: string) {
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
}

/** Bester Gast zu einem gehörten Text (auch wenn der Name irgendwo im Satz steckt) */
export function matchGuest(heard: string, guests: Guest[]): Guest | null {
  const words = norm(heard).split(' ').filter(Boolean);
  if (!words.length) return null;
  let best: { g: Guest; d: number } | null = null;
  for (const g of guests) {
    const parts = norm(g.name).split(' ').filter((p) => p.length > 1);
    if (!parts.length) continue;
    const full = parts.join(' ');
    const joined = words.join(' ');
    if (joined.includes(full)) return g;
    for (const p of parts) {
      for (const w of words) {
        if (w.length < 2) continue;
        const d = lev(w, p);
        const tol = p.length <= 3 ? 0 : p.length <= 5 ? 1 : 2;
        if (d <= tol && (!best || d < best.d)) best = { g, d };
      }
    }
  }
  return best?.g ?? null;
}
