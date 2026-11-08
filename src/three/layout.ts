import * as THREE from 'three';

// Welt-Koordinaten (1 Einheit ≈ 30 cm). Tischplatte bei y = 0.
export const FLOOR_Y = -2.5;
export const WALL_Z = -7.5;
export const CEIL_Y = 8.5;

export const FIRE = { x: -3.7, openW: 3.0, openH: 2.6, depth: 0.9 };
export const FIRE_LIGHT_POS: [number, number, number] = [FIRE.x, FLOOR_Y + 1.1, WALL_Z + 1.2];

export const WIN = { x: 4.6, y0: -0.3, y1: 4.3, w: 3.0 };

export const DESK = { w: 6.6, d: 3.7, t: 0.14 };

export const TILT = 0.42;
export const LECTERN_POS = new THREE.Vector3(0, 0.56, 0.12);

export const CANDLE_POS: [number, number, number] = [-2.45, 0, -1.05];
