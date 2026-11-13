export type Verdict = 'naughty' | 'nice' | 'undecided';

/** Ein Gast – existiert im Browser erst, nachdem sein Zauberwort die Daten entschlüsselt hat */
export interface Guest {
  id: string;
  name: string;
  /** Kapitel-Untertitel */
  title?: string;
  /** Stichpunkte fürs Buch (kurz – das Buch bricht um und verkleinert die Schrift) */
  nice: string[];
  naughty: string[];
  verdict: Verdict;
  /** 0 = engelsgleich … 100 = Kohle */
  score: number;
  /** Bis zu 7 Geschichten, die Mrs. Claus vorliest */
  stories: string[];
  revealed: boolean;
}

export interface EventInfo {
  name: string;
  date: string;
  santa: string;
}

/** Öffentlicher Rahmen des Abends (laut Entscheid unverschlüsselt) */
export interface Frame {
  title: string;
  subtitle: string;
  greeting: string;
  closing: string;
  farewell: string;
  event: EventInfo;
}

export const MAX_STORIES = 7;
