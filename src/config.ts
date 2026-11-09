// Qualitätsstufen: Handys bekommen weniger teure Effekte.
// Über ?quality=low|high in der URL kann man das erzwingen.

const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
const coarse =
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(pointer: coarse)').matches
    : false;

export const isTouch = coarse;
const mobileUA = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);

function forcedQuality(): 'low' | 'high' | null {
  try {
    const q = new URLSearchParams(window.location.search).get('quality');
    return q === 'low' || q === 'high' ? q : null;
  } catch {
    return null;
  }
}

const forced = forcedQuality();
export const lowQuality = forced ? forced === 'low' : mobileUA || coarse;

export const QUALITY = {
  dpr: (lowQuality ? [1, 1.5] : [1, 2]) as [number, number],
  shadowMapSize: lowQuality ? 1024 : 2048,
  texScale: lowQuality ? 0.75 : 1,
  furShells: lowQuality ? 12 : 20,
  snow: lowQuality ? 220 : 600,
  dof: !lowQuality,
  embers: lowQuality ? 40 : 90,
};

/** Für automatische Screenshots: Kamera-Dämpfung auch bei sehr wenigen FPS ausschwingen lassen (?settle) */
export const settleMode = (() => {
  try {
    return new URLSearchParams(window.location.search).has('settle');
  } catch {
    return false;
  }
})();

/** Zeitlupe fürs Umblättern (?slowmo=4) – nur zum Testen */
export const slowmo = (() => {
  try {
    const v = Number(new URLSearchParams(window.location.search).get('slowmo'));
    return v > 0 ? v : 1;
  } catch {
    return 1;
  }
})();

/** Für automatische Tests: WebGL-Bild per canvas.toDataURL() abgreifbar (?capture) */
export const captureMode = (() => {
  try {
    return new URLSearchParams(window.location.search).has('capture');
  } catch {
    return false;
  }
})();

/** Nur für Tests: Santa spricht im Schnelldurchlauf (?fasttalk) */
export const fastTalk = (() => {
  try {
    return new URLSearchParams(window.location.search).has('fasttalk');
  } catch {
    return false;
  }
})();

/** Debug-Ansicht der generierten Texturen: ?debug=textures */
export const debugView = (() => {
  try {
    return new URLSearchParams(window.location.search).get('debug');
  } catch {
    return null;
  }
})();
