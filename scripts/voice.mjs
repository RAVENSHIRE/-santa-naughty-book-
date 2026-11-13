// Vertont alle Texte EINMALIG mit ElevenLabs – auf dem eigenen PC, nie im Browser.
//
//   node scripts/voice.mjs --voices                 Stimmen im Konto + Kontingent
//   node scripts/voice.mjs --search [--accent swiss] Frauenstimmen (Deutsch) aus der Voice Library
//   node scripts/voice.mjs --add <owner> <voice> <name>   Library-Stimme ins Konto übernehmen
//   node scripts/voice.mjs --voice <id> [--model eleven_multilingual_v2] [--dry] [--force]
//
// API-Key: Datei %USERPROFILE%\santa-elevenlabs.txt (oder ELEVENLABS_KEY_FILE / ELEVENLABS_API_KEY)
// Eingabe: private/event.json + private/codes.json (Klartext, nie committen), public/event.json (Salz)
// Ausgabe:
//   public/voice/manifest.json, public/voice/p/<hash>.mp3   öffentliche Sätze und Rahmen
//   public/voice/g/<id>.bin                                  pro Gast, mit dessen Zauberwort verschlüsselt
// Zum Schluss wird der ElevenLabs-Verlauf dieser Vertonung gelöscht.
import { createHash, webcrypto as crypto } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const args = process.argv.slice(2);
const opt = (n, d) => (args.includes(`--${n}`) ? args[args.indexOf(`--${n}`) + 1] : d);
const flag = (n) => args.includes(`--${n}`);

const API = 'https://api.elevenlabs.io';
const keyFile = process.env.ELEVENLABS_KEY_FILE || join(homedir(), 'santa-elevenlabs.txt');
const KEY = (process.env.ELEVENLABS_API_KEY || (existsSync(keyFile) ? readFileSync(keyFile, 'utf8') : '')).trim();
if (!KEY) {
  console.error(`Kein API-Key gefunden (${keyFile}).`);
  process.exit(1);
}

async function api(path, init = {}, tries = 4) {
  for (let i = 1; ; i++) {
    const r = await fetch(API + path, {
      ...init,
      headers: { 'xi-api-key': KEY, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
    });
    if (r.ok) return r;
    const body = (await r.text()).slice(0, 400);
    if (i < tries && (r.status === 429 || r.status >= 500)) {
      await new Promise((res) => setTimeout(res, 2000 * i));
      continue;
    }
    throw new Error(`${init.method ?? 'GET'} ${path} → ${r.status} ${body}`);
  }
}

async function quota() {
  const s = await (await api('/v1/user/subscription')).json();
  return { tier: s.tier, used: s.character_count, limit: s.character_limit, left: s.character_limit - s.character_count };
}

// ---------- Stimmen ----------
if (flag('voices')) {
  const q = await quota();
  console.log(`Abo: ${q.tier} · ${q.used}/${q.limit} Zeichen verbraucht · ${q.left} frei`);
  const { voices } = await (await api('/v1/voices')).json();
  for (const v of voices) {
    const l = v.labels ?? {};
    console.log([v.voice_id, v.name, v.category, l.gender, l.age, l.accent, l.language, l.description, l.use_case].filter(Boolean).join(' | '));
  }
  process.exit(0);
}
if (flag('search')) {
  const p = new URLSearchParams({ page_size: '40', gender: 'female', language: 'de', sort: 'cloned_by_count' });
  if (opt('accent')) p.set('accent', opt('accent'));
  const { voices } = await (await api(`/v1/shared-voices?${p}`)).json();
  for (const v of voices) {
    console.log([v.public_owner_id, v.voice_id, v.name, v.age, v.accent, v.descriptive, v.use_case, `geklont ${v.cloned_by_count}`, (v.description ?? '').slice(0, 90)].join(' | '));
  }
  process.exit(0);
}
if (flag('add')) {
  const [owner, voice, name] = args.slice(args.indexOf('--add') + 1);
  const r = await (await api(`/v1/voices/add/${owner}/${voice}`, { method: 'POST', body: JSON.stringify({ new_name: name || 'Mrs. Claus' }) })).json();
  console.log('Übernommen:', r.voice_id);
  process.exit(0);
}

// ---------- Vertonung ----------
const VOICE = opt('voice');
const MODEL = opt('model', 'eleven_multilingual_v2');
if (!VOICE) {
  console.error('Bitte --voice <voice_id> angeben (siehe --voices).');
  process.exit(1);
}
const SETTINGS = { stability: 0.5, similarity_boost: 0.8, style: 0.25, use_speaker_boost: true, speed: 0.95 };

const TEXT = JSON.parse(readFileSync('src/santa/lines.json', 'utf8'));
const pub = JSON.parse(readFileSync('public/event.json', 'utf8'));
const priv = JSON.parse(readFileSync('private/event.json', 'utf8'));
const codes = JSON.parse(readFileSync('private/codes.json', 'utf8'));

/** Gleicher Schlüssel wie im Browser (src/santa/voicebank.ts) */
export const clipKey = (t) => createHash('sha256').update(t.normalize('NFC')).digest('hex').slice(0, 16);

/** Gleiche Satztrennung wie sentences() in src/santa/lines.ts */
function sentences(text) {
  const out = [];
  const re = /[.!?…]+["»“”']?(?=\s|$)/g;
  let start = 0;
  let m;
  while ((m = re.exec(text))) {
    const before = text.slice(Math.max(start, m.index - 4), m.index);
    if (m[0] === '.' && (/(^|\D)\d{1,2}$/.test(before) || /(^|\s)(Mrs|Mr|Dr|Nr|St|bzw|ca|z\.B)$/i.test(before))) continue;
    out.push(text.slice(start, m.index + m[0].length).trim());
    start = m.index + m[0].length;
  }
  if (start < text.length) out.push(text.slice(start).trim());
  return out.filter(Boolean);
}

let spent = 0;
async function tts(text, prev, next) {
  const body = { text, model_id: MODEL, voice_settings: SETTINGS };
  if (prev) body.previous_text = prev.slice(-400);
  if (next) body.next_text = next.slice(0, 400);
  const j = await (
    await api(`/v1/text-to-speech/${VOICE}/with-timestamps?output_format=mp3_44100_128`, { method: 'POST', body: JSON.stringify(body) })
  ).json();
  spent += text.length;
  const audio = Buffer.from(j.audio_base64, 'base64');
  const a = j.alignment ?? j.normalized_alignment;
  const starts = a?.character_start_times_seconds ?? [];
  const ends = a?.character_end_times_seconds ?? [];
  const dur = ends.length ? ends[ends.length - 1] : text.length * 0.065;
  const exact = a && a.characters?.length === text.length;
  const at = (i, arr) => (exact ? arr[Math.min(i, arr.length - 1)] : (i / text.length) * dur);
  const s = [];
  let cursor = 0;
  for (const sentence of sentences(text)) {
    const i = text.indexOf(sentence, cursor);
    const from = i < 0 ? cursor : i;
    cursor = from + sentence.length;
    s.push([+at(from, starts).toFixed(2), +at(cursor - 1, ends).toFixed(2), sentence]);
  }
  return { audio, d: +dur.toFixed(2), s };
}

async function derive(code, salt) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(code), 'PBKDF2', false, ['deriveBits']);
  const bits = new Uint8Array(
    await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: pub.kdf.iterations }, base, 512),
  );
  const key = await crypto.subtle.importKey('raw', bits.slice(0, 32), 'AES-GCM', false, ['encrypt']);
  return { key, id: Buffer.from(bits.slice(32, 48)).toString('hex') };
}
const normalizeCode = (s) =>
  s.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').normalize('NFKD').replace(/[^a-z0-9]/g, '');

// Was vertont wird
const publicTexts = [...Object.values(TEXT.static), pub.frame.greeting, pub.frame.closing, pub.frame.farewell].filter(Boolean);
const guestTexts = (g) => {
  const n = (t) => t.replace('{name}', g.name);
  return [n(TEXT.named.found), ...(g.stories ?? []), n(TEXT.named.verdictIntro), n(TEXT.named.already)];
};

mkdirSync('public/voice/p', { recursive: true });
mkdirSync('public/voice/g', { recursive: true });
const manPath = 'public/voice/manifest.json';
const man = existsSync(manPath) ? JSON.parse(readFileSync(manPath, 'utf8')) : { v: 1, clips: {} };
const force = flag('force') || man.voice !== VOICE || man.model !== MODEL;
if (force) man.clips = {};
man.voice = VOICE;
man.model = MODEL;

const todoPublic = [...new Set(publicTexts)].filter((t) => force || !man.clips[clipKey(t)] || !existsSync(`public/voice/${man.clips[clipKey(t)].f}`));
const plans = [];
for (const g of priv.guests) {
  const code = codes[g.name];
  if (!code) throw new Error(`Kein Zauberwort für ${g.name}`);
  const { key, id } = await derive(normalizeCode(code), Buffer.from(pub.kdf.salt, 'base64'));
  if (!pub.entries.some((e) => e.id === id)) throw new Error(`${g.name}: passt nicht zu public/event.json – zuerst npm run seal`);
  if (!force && existsSync(`public/voice/g/${id}.bin`)) continue;
  plans.push({ g, key, id, texts: guestTexts(g) });
}
const chars = todoPublic.join('').length + plans.reduce((n, p) => n + p.texts.join('').length, 0);
const q = await quota();
console.log(`Zu vertonen: ${todoPublic.length} öffentliche Sätze, ${plans.length} Gäste, ${chars} Zeichen · frei: ${q.left}`);
if (flag('dry')) process.exit(0);
if (chars > q.left) {
  console.error('Das Kontingent reicht nicht.');
  process.exit(1);
}

const t0 = Math.floor(Date.now() / 1000) - 5;
try {
  for (const t of todoPublic) {
    const k = clipKey(t);
    const r = await tts(t);
    writeFileSync(`public/voice/p/${k}.mp3`, r.audio);
    man.clips[k] = { f: `p/${k}.mp3`, d: r.d, s: r.s };
    writeFileSync(manPath, JSON.stringify(man));
    process.stdout.write('.');
  }
  for (const p of plans) {
    const clips = {};
    const parts = [];
    let off = 0;
    for (let i = 0; i < p.texts.length; i++) {
      const t = p.texts[i];
      const r = await tts(t, p.texts[i - 1], p.texts[i + 1]);
      clips[clipKey(t)] = { o: off, n: r.audio.length, d: r.d, s: r.s };
      parts.push(r.audio);
      off += r.audio.length;
      process.stdout.write('+');
    }
    const header = Buffer.from(JSON.stringify({ v: 1, clips }));
    const len = Buffer.alloc(4);
    len.writeUInt32LE(header.length);
    const plain = Buffer.concat([len, header, ...parts]);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const enc = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, p.key, plain));
    writeFileSync(`public/voice/g/${p.id}.bin`, Buffer.concat([Buffer.from(iv), Buffer.from(enc)]));
  }
  console.log(`\n✔ vertont: ${spent} Zeichen`);
} finally {
  // Verlauf bei ElevenLabs löschen (nur Einträge dieses Laufs mit dieser Stimme)
  try {
    let deleted = 0;
    let after = '';
    for (let page = 0; page < 20; page++) {
      const qs = new URLSearchParams({ page_size: '100', voice_id: VOICE, ...(after ? { start_after_history_item_id: after } : {}) });
      const h = await (await api(`/v1/history?${qs}`)).json();
      for (const item of h.history ?? []) {
        if (item.date_unix >= t0) {
          await api(`/v1/history/${item.history_item_id}`, { method: 'DELETE' });
          deleted++;
        }
      }
      if (!h.has_more) break;
      after = h.last_history_item_id;
    }
    console.log(`✔ ElevenLabs-Verlauf gelöscht: ${deleted} Einträge`);
  } catch (e) {
    console.warn(`⚠ Verlauf konnte nicht gelöscht werden – bitte in ElevenLabs unter „History“ von Hand löschen. (${e.message})`);
  }
}
