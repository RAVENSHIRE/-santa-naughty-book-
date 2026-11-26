/**
 * Namen aus gesprochenem Text erkennen.
 * Vergleicht jedes Wort mit allen Namen (und Spitznamen) über die Kölner Phonetik
 * und die Editierdistanz, damit «Pawel», «Mattias» oder «Nikola» trotzdem passen.
 */

/** Kölner Phonetik (Postel 1969) – klangähnliche deutsche Wörter bekommen denselben Code */
export function koelner(word: string): string {
  const s = word
    .toLowerCase()
    .replace(/ä/g, 'a')
    .replace(/ö/g, 'o')
    .replace(/ü/g, 'u')
    .replace(/ß/g, 's')
    .normalize('NFKD')
    .replace(/[^a-z]/g, '');
  let code = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    const prev = s[i - 1] ?? '';
    const next = s[i + 1] ?? '';
    let d = '';
    if ('aeijouy'.includes(c)) d = '0';
    else if (c === 'h') d = '';
    else if (c === 'b') d = '1';
    else if (c === 'p') d = next === 'h' ? '3' : '1';
    else if (c === 'd' || c === 't') d = 'csz'.includes(next) ? '8' : '2';
    else if (c === 'f' || c === 'v' || c === 'w') d = '3';
    else if (c === 'g' || c === 'k' || c === 'q') d = '4';
    else if (c === 'c') {
      if (i === 0) d = 'ahkloqrux'.includes(next) ? '4' : '8';
      else d = 'sz'.includes(prev) || !'ahkoqux'.includes(next) ? '8' : '4';
    } else if (c === 'x') d = 'ckq'.includes(prev) ? '8' : '48';
    else if (c === 'l') d = '5';
    else if (c === 'm' || c === 'n') d = '6';
    else if (c === 'r') d = '7';
    else if (c === 's' || c === 'z') d = '8';
    code += d;
  }
  // doppelte Ziffern zusammenfassen, Nullen (ausser am Anfang) entfernen
  let out = '';
  for (const ch of code) if (out[out.length - 1] !== ch) out += ch;
  return out[0] + out.slice(1).replace(/0/g, '');
}

function lev(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 1; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[m][n];
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z\s]/g, ' ');

export interface Candidate {
  id: string;
  names: string[];
}

/**
 * Bester Treffer für mehrere Erkennungs-Varianten (Alternativen der Spracherkennung).
 * Liefert die id oder null.
 */
export function matchName(heard: string[], people: Candidate[]): string | null {
  let best: { id: string; score: number } | null = null;
  for (const text of heard) {
    const words = norm(text).split(/\s+/).filter((w) => w.length >= 3);
    for (const w of words) {
      const wk = koelner(w);
      for (const p of people) {
        for (const name of p.names) {
          const n = norm(name).trim();
          let score = 0;
          if (w === n) score = 100;
          else if (wk && wk === koelner(n)) score = 80;
          else {
            const dist = lev(w, n);
            if (dist <= 1 && n.length >= 4) score = 70;
            else if (dist <= 2 && n.length >= 6) score = 55;
          }
          if (score && (!best || score > best.score)) best = { id: p.id, score };
        }
      }
    }
  }
  return best?.id ?? null;
}
