// Kopiert die von ElevenLabs erzeugten Sätze aus .voice-cache/ nach public/voice/,
// damit Santas Stimme auch ohne API-Key (z. B. auf GitHub Pages) abgespielt wird.
import { cpSync, existsSync, mkdirSync, readdirSync } from 'node:fs';

if (!existsSync('.voice-cache')) {
  console.log('Noch nichts gerendert (.voice-cache fehlt). Erst im Gastgeber-Bereich „Stimme vorbereiten“ ausführen.');
  process.exit(0);
}
mkdirSync('public/voice', { recursive: true });
cpSync('.voice-cache', 'public/voice', { recursive: true });
const n = readdirSync('public/voice').filter((f) => f.endsWith('.mp3')).length;
console.log(`✔ ${n} Sätze nach public/voice kopiert (in .gitignore – enthält das gesprochene Manuskript).`);
