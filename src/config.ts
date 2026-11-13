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

const devFlag = (name: string) => {
  try {
    return import.meta.env.DEV && new URLSearchParams(window.location.search).has(name);
  } catch {
    return false;
  }
};

/** Nur im Dev-Server: Kamera-Dämpfung bei sehr wenigen FPS ausschwingen lassen (?settle) */
export const settleMode = devFlag('settle');
/** Nur im Dev-Server: WebGL-Bild per toDataURL abgreifbar, Stores an window (?capture) */
export const captureMode = devFlag('capture');
