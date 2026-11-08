import type * as THREE from 'three';
import type { Verdict } from '../demoData';

/** Geteilter, nicht-reaktiver Laufzeitzustand zwischen 3D-Komponenten */
export const runtime = {
  /** Buchgruppe (für Kamera-Ziele) */
  book: null as THREE.Group | null,
  /** Oberkante des rechten Seitenstapels in Buch-Koordinaten */
  rightTopZ: 0.1,
  /** Kamera-Wackeln (0..1) */
  shake: 0,
  /** Zeitpunkt (clock.elapsedTime) des letzten Stempel-Aufpralls */
  impactAt: -100,
  impactVerdict: 'nice' as Verdict,
  /** Textur-Schlüssel der aktuell sichtbaren rechten Seite (zeigt, ob der Stempel schon eingezeichnet ist) */
  rightPageKey: '',
  /** Fortschritt des Deckels (0 = zu, 1 = offen) */
  coverT: 0,
};
