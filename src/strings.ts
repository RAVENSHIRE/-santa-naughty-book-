/** Texte für Buch und Oberfläche (nur Deutsch) */
export const STRINGS = {
  loading: 'Mrs. Claus sucht ihre Brille …',
  noWebgl: 'Dein Browser unterstützt leider kein WebGL. Bitte öffne die Seite in einem aktuellen Chrome oder Edge.',

  // Buch
  nice: 'Brav',
  naughty: 'Unartig',
  undecided: 'Offen',
  secret: 'Streng geheim',
  subtitle: 'Wer war brav – und wer nicht?',
  index: 'Verzeichnis der Akten',
  property: 'Eigentum des Weihnachtsmanns · Nordpol',
  fileNo: 'Akte Nr.',
  niceDeeds: 'Gute Taten',
  naughtyDeeds: 'Missetaten',
  nothing: '– nichts verzeichnet –',
  verdictLabel: 'Urteil von Mrs. Claus',
  pending: 'Das Urteil steht noch aus …',
  meterNice: 'brav',
  meterNaughty: 'frech',
  stampNice: 'BRAV',
  stampNaughty: 'UNARTIG',
  stampUndecided: 'OFFEN',
  tally: 'Bilanz des Abends',
  merry: 'Frohe Weihnachten!',
  seeAll: 'Ich sehe alles. Ho ho ho!',
  exLibris: 'Ex Libris',
  northPole: 'Nordpol',
  toBeContinued: 'Fortsetzung folgt …',
  nextYear: 'nächstes Jahr!',
  morePeople: (n: number) => `… und ${n} weitere`,
  hidden: 'Noch geheim',
};

export type Strings = typeof STRINGS;
