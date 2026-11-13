// Versiegelt die Gästedaten für den Abend.
//
//   node scripts/seal.mjs [eingabe.json]        (Standard: private/event.json)
//
// Erzeugt:
//   public/event.json            → verschlüsselte Einträge + öffentlicher Rahmen (darf ins Repo)
//   private/zugangscodes.csv     → Name;Zauberwort  (NUR für dich, nie ins Repo)
//   private/codes.json           → gleiche Codes, damit ein erneuter Lauf sie beibehält
//
// Format der Eingabe: siehe demo/event.example.json
import { webcrypto as crypto, randomInt } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const ITERATIONS = 300_000;
const MAX_STORIES = 7;

// Gut verständliche Wörter ohne Umlaute (Spracherkennung!)
const WORDS = `Rentier Schlitten Kerze Glocke Zimtstern Lebkuchen Tannenbaum Schneemann Mandarine Nussknacker
Engel Laterne Kamin Geschenk Schneeflocke Christbaum Marzipan Punsch Wichtel Mistel Kugel Lametta Eiszapfen
Rodel Krippe Socke Stern Winter Fackel Kakao Vanille Apfel Walnuss Pinguin Eisbär Polarstern Kristall
Schokolade Zuckerstange Orange Haselnuss Honig Rakete Trompete Harfe Geige Trommel Flöte Laterne Kompass`
  .split(/\s+/)
  .filter((w, i, a) => w && !/[äöüß]/i.test(w) && a.indexOf(w) === i);

const normalizeCode = (s) =>
  s
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFKD')
    .replace(/[^a-z0-9]/g, '');

const b64 = (u8) => Buffer.from(u8).toString('base64');
const hex = (u8) => Buffer.from(u8).toString('hex');

async function derive(code, salt) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(code), 'PBKDF2', false, ['deriveBits']);
  const bits = new Uint8Array(
    await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITERATIONS }, base, 512),
  );
  const key = await crypto.subtle.importKey('raw', bits.slice(0, 32), 'AES-GCM', false, ['encrypt']);
  return { key, id: hex(bits.slice(32, 48)) };
}

const input = process.argv[2] ?? 'private/event.json';
if (!existsSync(input)) {
  console.error(`Eingabe fehlt: ${input} (Vorlage: demo/event.example.json)`);
  process.exit(1);
}
const src = JSON.parse(readFileSync(input, 'utf8'));
const guests = Array.isArray(src.guests) ? src.guests : [];
if (!guests.length) {
  console.error('Keine Gäste in der Eingabe.');
  process.exit(1);
}

mkdirSync('private', { recursive: true });
const codesFile = 'private/codes.json';
const codes = existsSync(codesFile) ? JSON.parse(readFileSync(codesFile, 'utf8')) : {};
const used = new Set(Object.values(codes).map(normalizeCode));
for (const g of guests) {
  if (codes[g.name]) continue;
  let code;
  do code = `${WORDS[randomInt(WORDS.length)]} ${WORDS[randomInt(WORDS.length)]}`;
  while (used.has(normalizeCode(code)) || new Set(code.split(' ')).size < 2);
  used.add(normalizeCode(code));
  codes[g.name] = code;
}

// Salz bleibt bei erneutem Lauf gleich, damit sich nichts unnötig ändert
let salt = crypto.getRandomValues(new Uint8Array(16));
if (existsSync('public/event.json')) {
  try {
    salt = Buffer.from(JSON.parse(readFileSync('public/event.json', 'utf8')).kdf.salt, 'base64');
  } catch {
    /* neues Salz */
  }
}

const entries = [];
for (const g of guests) {
  const { key, id } = await derive(normalizeCode(codes[g.name]), salt);
  const payload = {
    name: g.name,
    title: g.title,
    verdict: g.verdict,
    score: g.score,
    nice: g.nice ?? [],
    naughty: g.naughty ?? [],
    stories: (g.stories ?? (g.story ? [g.story] : [])).slice(0, MAX_STORIES),
  };
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify(payload))));
  entries.push({ id, iv: b64(iv), data: b64(data) });
}
// Reihenfolge mischen – die Datei verrät nicht, wer wo steht
for (let i = entries.length - 1; i > 0; i--) {
  const j = randomInt(i + 1);
  [entries[i], entries[j]] = [entries[j], entries[i]];
}

const frame = {
  title: src.title ?? "Santa's Naughty Book",
  subtitle: src.subtitle ?? '',
  greeting: src.greeting ?? '',
  closing: src.closing ?? '',
  farewell: src.farewell ?? '',
  event: { name: src.event?.name ?? '', date: src.event?.date ?? '', santa: src.event?.santa ?? 'Mrs. Claus' },
};
const out = { v: 1, frame, kdf: { salt: b64(salt), iterations: ITERATIONS }, count: entries.length, entries };
writeFileSync('public/event.json', JSON.stringify(out));
writeFileSync(codesFile, JSON.stringify(codes, null, 2));
writeFileSync('private/zugangscodes.csv', 'Name;Zauberwort\n' + guests.map((g) => `${g.name};${codes[g.name]}`).join('\n') + '\n');
console.log(`✔ ${entries.length} Gäste versiegelt → public/event.json`);
console.log('✔ Zauberwörter → private/zugangscodes.csv (nicht weitergeben, nicht committen)');
