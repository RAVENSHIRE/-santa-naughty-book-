// Nur lateinische Zeichensätze (inkl. Umlaute und latin-ext für Namen wie „Łukasz“)
import '@fontsource/cinzel-decorative/latin-700.css';
import '@fontsource/cinzel-decorative/latin-ext-700.css';
import '@fontsource/cinzel-decorative/latin-900.css';
import '@fontsource/cinzel-decorative/latin-ext-900.css';
import '@fontsource/cinzel/latin-600.css';
import '@fontsource/cinzel/latin-ext-600.css';
import '@fontsource/cinzel/latin-700.css';
import '@fontsource/cinzel/latin-ext-700.css';
import '@fontsource/cinzel/latin-900.css';
import '@fontsource/cinzel/latin-ext-900.css';
import '@fontsource/great-vibes/latin-400.css';
import '@fontsource/great-vibes/latin-ext-400.css';
import '@fontsource/im-fell-english/latin-400.css';
import '@fontsource/im-fell-english/latin-400-italic.css';

const faces = [
  '700 40px "Cinzel Decorative"',
  '900 40px "Cinzel Decorative"',
  '600 40px "Cinzel"',
  '700 40px "Cinzel"',
  '900 40px "Cinzel"',
  '400 40px "Great Vibes"',
  '400 40px "IM Fell English"',
  'italic 400 40px "IM Fell English"',
];

let promise: Promise<void> | null = null;

/** Lädt alle Schriften, bevor in Canvas-Texturen gezeichnet wird */
export function loadFonts(): Promise<void> {
  if (!promise) {
    promise = (async () => {
      try {
        if (!document.fonts) return;
        const timeout = new Promise<void>((r) => setTimeout(r, 6000));
        await Promise.race([Promise.all(faces.map((f) => document.fonts.load(f, 'AaÄäÖöÜüß„“…–'))), timeout]);
        await Promise.race([document.fonts.ready, timeout]);
      } catch {
        /* dann eben mit Ersatzschrift */
      }
    })();
  }
  return promise;
}
