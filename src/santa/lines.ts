import type { Verdict } from '../model';

/** Was Mrs. Claus zwischen den Geschichten sagt (Hochdeutsch – passt zur lokalen Schweizer Stimme) */
export const LINES = {
  greeting: 'Ho ho ho! Grüezi mitenand! Ich bin Mrs. Claus, und heute lese ich aus dem goldenen Buch vor.',
  waitFirst: 'Wer möchte als Erstes zu mir kommen? Stell dich einfach vor die Kamera.',
  waitNext: 'Wer möchte als Nächstes zu mir kommen? Stell dich einfach vor die Kamera.',
  askName: 'Grüezi! Wie heisst du?',
  againName: 'Das habe ich nicht verstanden. Sag mir bitte noch einmal deinen Namen – oder tipp ihn ein.',
  hello: (name: string) => `Schön, dich zu sehen, ${name}!`,
  askCode: 'Nenn mir jetzt dein Zauberwort – beide Wörter.',
  wrongCode: 'Hmm, dieses Zauberwort öffnet mein Buch nicht. Versuch es bitte noch einmal.',
  giveUp: 'Leider bleibt das Buch zu. Komm später noch einmal zu mir.',
  already: (name: string) => `${name}, deine Geschichte habe ich heute schon vorgelesen!`,
  found: (name: string) => `Da bist du ja, ${name}! Hier steht deine Geschichte.`,
  verdictIntro: (name: string) => `Und jetzt, ${name}: das Urteil von Mrs. Claus …`,
  verdict: {
    nice: 'Brav! Ho ho ho – dafür gibt es ein Geschenk.',
    naughty: 'Unartig! Aber keine Sorge: Ein bisschen Kohle hält im Winter schön warm.',
    undecided: 'Hmm … das ist knapp. Das entscheide ich nächstes Jahr!',
  } satisfies Record<Verdict, string>,
  allDone: 'Jetzt habe ich alle Geschichten vorgelesen.',
  farewell: 'Frohe Weihnachten! Ho ho ho!',
  chapter: (n: number) => `Kapitel ${n}`,
  endTitle: 'Frohe Weihnachten',
};

/** Zerlegt Text in Sätze (Untertitel + Sprachausgabe). Ordinalzahlen wie „2. Liga“ trennen nicht. */
export function sentences(text: string): string[] {
  const out: string[] = [];
  const re = /[.!?…]+["»“”']?(?=\s|$)/g;
  let start = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const before = text.slice(Math.max(start, m.index - 4), m.index);
    // keine Trennung nach Ordinalzahlen („2. Liga“) und Abkürzungen („Mrs. Claus“, „Nr.“)
    if (m[0] === '.' && (/(^|\D)\d{1,2}$/.test(before) || /(^|\s)(Mrs|Mr|Dr|Nr|St|bzw|ca|z\.B)$/i.test(before))) continue;
    out.push(text.slice(start, m.index + m[0].length).trim());
    start = m.index + m[0].length;
  }
  if (start < text.length) out.push(text.slice(start).trim());
  return out.filter(Boolean);
}

/** „Ich heisse Anna Muster“ → „Anna Muster“ */
export function extractName(heard: string): string {
  const t = heard
    .replace(/^(hallo|hoi|grüezi|guten tag)[,!\s]*/i, '')
    .replace(/^(ich hei(ss|ß)e|ich bin( die| der)?|mein name ist|man nennt mich)\s+/i, '')
    .replace(/[.!?,]+$/g, '')
    .trim();
  return t
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}
