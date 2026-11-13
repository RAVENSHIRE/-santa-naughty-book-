import type { Verdict } from '../model';

import TEXT from './lines.json';

const named = (t: string) => (name: string) => t.replace('{name}', name);
const S = TEXT.static;

/** Was Mrs. Claus zwischen den Geschichten sagt. Die Texte stehen in lines.json,
 *  damit scripts/voice.mjs genau dieselben Sätze vorab vertonen kann. */
export const LINES = {
  ...S,
  found: named(TEXT.named.found),
  already: named(TEXT.named.already),
  verdictIntro: named(TEXT.named.verdictIntro),
  verdict: { nice: S.verdictNice, naughty: S.verdictNaughty, undecided: S.verdictUndecided } satisfies Record<Verdict, string>,
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
