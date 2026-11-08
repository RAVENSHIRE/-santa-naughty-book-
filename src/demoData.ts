import type { Locale } from './i18n';

export type Verdict = 'naughty' | 'nice' | 'undecided';

export interface Guest {
  id: string;
  name: string;
  /** Rohzeilen aus dem Editor (leere Zeilen werden beim Zeichnen ignoriert) */
  nice: string[];
  naughty: string[];
  verdict: Verdict;
  /** 0 = engelsgleich … 100 = Kohle-Kandidat */
  score: number;
  revealed: boolean;
}

export interface EventInfo {
  name: string;
  date: string;
  santa: string;
}

export const uid = () => Math.random().toString(36).slice(2, 10);

type Seed = Omit<Guest, 'id' | 'revealed'>;

const demoDe: Seed[] = [
  {
    name: 'Anna',
    nice: ['Hat fürs ganze Team Guetzli gebacken', 'Rettet jeden Drucker-Notfall', 'Giesst heimlich die Büropflanzen'],
    naughty: ['Hat das letzte Gipfeli gegessen – zweimal', 'Antwortet auf lange E-Mails nur mit «ok.»'],
    verdict: 'nice',
    score: 24,
  },
  {
    name: 'Luca',
    nice: ['Bringt jeden Montag gute Laune mit'],
    naughty: [
      'Drückt siebenmal auf «Schlummern»',
      'Hat die Weihnachtsdeko schon im September aufgehängt',
      'Singt laut im Grossraumbüro',
    ],
    verdict: 'naughty',
    score: 78,
  },
  {
    name: 'Mia',
    nice: ['Organisiert das Wichteln', 'Kennt alle Geburtstage auswendig', 'Hat den Rentieren Rüebli gebracht'],
    naughty: ['Hat beim Wichteln geschummelt (wir wissen es!)'],
    verdict: 'nice',
    score: 33,
  },
  {
    name: 'Noah',
    nice: ['Repariert alles mit Klebeband'],
    naughty: [
      'Rührt das Fondue nie um',
      'Hat den Kaffee leer getrunken und keinen neuen gemacht',
      'Parkiert auf zwei Parkplätzen gleichzeitig',
    ],
    verdict: 'naughty',
    score: 88,
  },
  {
    name: 'Lea',
    nice: ['Teilt immer ihre Schoggi', 'Hat dem Samichlaus einen Brief geschrieben – mit Zeichnung'],
    naughty: ['Lacht über ihre eigenen Witze, bevor sie fertig erzählt sind'],
    verdict: 'nice',
    score: 15,
  },
  {
    name: 'Chef Beat',
    nice: ['Hat die Ferien bewilligt', 'Spendiert den Apéro'],
    naughty: ['Setzt Meetings auf 17:55 Uhr an', '«Nur ganz kurz» dauert bei ihm zwei Stunden', 'Hat sein Wichtelgeschenk vergessen'],
    verdict: 'naughty',
    score: 66,
  },
];

const demoEn: Seed[] = [
  {
    name: 'Anna',
    nice: ['Baked cookies for the whole team', 'Rescues every printer emergency', 'Secretly waters the office plants'],
    naughty: ['Ate the last croissant – twice', 'Replies to long emails with just “ok.”'],
    verdict: 'nice',
    score: 24,
  },
  {
    name: 'Luca',
    nice: ['Brings good vibes every Monday'],
    naughty: ['Hits snooze seven times', 'Put up the Christmas decorations in September', 'Sings loudly in the open-plan office'],
    verdict: 'naughty',
    score: 78,
  },
  {
    name: 'Mia',
    nice: ['Organises Secret Santa', 'Knows everyone’s birthday by heart', 'Brought carrots for the reindeer'],
    naughty: ['Cheated at Secret Santa (we know!)'],
    verdict: 'nice',
    score: 33,
  },
  {
    name: 'Noah',
    nice: ['Fixes everything with duct tape'],
    naughty: ['Never stirs the fondue', 'Finished the coffee and didn’t make more', 'Parks across two spaces'],
    verdict: 'naughty',
    score: 88,
  },
  {
    name: 'Lea',
    nice: ['Always shares her chocolate', 'Wrote Santa a letter – with a drawing'],
    naughty: ['Laughs at her own jokes before finishing them'],
    verdict: 'nice',
    score: 15,
  },
  {
    name: 'Boss Ben',
    nice: ['Approved everyone’s holidays', 'Pays for the drinks'],
    naughty: ['Schedules meetings at 5:55 pm', '“Just a quick one” lasts two hours', 'Forgot his Secret Santa gift'],
    verdict: 'naughty',
    score: 66,
  },
];

export function demoGuests(locale: Locale): Guest[] {
  return (locale === 'de' ? demoDe : demoEn).map((g) => ({
    ...g,
    nice: [...g.nice],
    naughty: [...g.naughty],
    id: uid(),
    revealed: false,
  }));
}

export function demoEvent(locale: Locale): EventInfo {
  return locale === 'de'
    ? { name: 'Weihnachtsfeier 2026', date: '18. Dezember 2026 · Zürich', santa: 'Santa Claus' }
    : { name: 'Christmas Party 2026', date: 'December 18, 2026', santa: 'Santa Claus' };
}

export function blankGuest(name: string): Guest {
  return { id: uid(), name, nice: [], naughty: [], verdict: 'undecided', score: 50, revealed: false };
}
