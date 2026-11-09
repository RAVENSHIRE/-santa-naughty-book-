import * as THREE from 'three';
import { palette } from '../theme';

/** Roter Samt wie Santas Mantel: dunkle Grundfarbe + Sheen für die hellen Kanten */
export function makeVelvet(color: string = palette.velvet, map?: THREE.Texture | null) {
  return new THREE.MeshPhysicalMaterial({
    color: map ? '#ffffff' : color,
    map: map ?? null,
    roughness: 0.92,
    metalness: 0,
    sheen: 1,
    sheenRoughness: 0.38,
    sheenColor: new THREE.Color(palette.velvetSheen),
  });
}

export function makeGold(roughness = 0.3) {
  return new THREE.MeshStandardMaterial({ color: '#e2bd68', metalness: 1, roughness });
}

/**
 * Fell per „Shell Texturing“: dieselbe Geometrie wird N-mal (InstancedMesh)
 * entlang der Normalen aufgeblasen; pro Schale werden immer mehr Pixel verworfen.
 */
export function makeFurMaterial(opts: {
  length: number;
  density: [number, number];
  shells: number;
  color?: string;
  droop?: number;
  /** Wellen/Locken (0 = glatt) */
  curl?: number;
  /** Farbvariation einzelner Haare (gelblich/grau) und tiefere Wurzeln */
  tint?: number;
}) {
  const mat = new THREE.MeshStandardMaterial({ color: opts.color ?? palette.fur, roughness: 1, metalness: 0 });
  mat.defines = { ...(mat.defines ?? {}), USE_UV: '' };
  const uniforms = {
    uShells: { value: opts.shells },
    uLen: { value: opts.length },
    uDensity: { value: new THREE.Vector2(opts.density[0], opts.density[1]) },
    uDroop: { value: opts.droop ?? 0.3 },
    uCurl: { value: opts.curl ?? 0 },
    uTint: { value: opts.tint ?? 0 },
  };
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uShells;
        uniform float uLen;
        uniform float uDroop;
        uniform float uCurl;
        varying float vShell;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        float furShell = float(gl_InstanceID) / max(uShells - 1.0, 1.0);
        vShell = furShell;
        transformed += objectNormal * (furShell * uLen);
        transformed.y -= furShell * furShell * uLen * uDroop;
        // Locken: ganze Strähnen wellen sich gemeinsam
        float furW = furShell * uLen * uCurl;
        transformed.x += sin(position.y * 37.0 + position.z * 23.0 + furShell * 5.0) * furW;
        transformed.z += cos(position.x * 31.0 + position.y * 19.0 + furShell * 4.0) * furW * 0.6;
        transformed.y += sin(position.x * 29.0 + position.z * 17.0) * furW * 0.4;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform vec2 uDensity;
        uniform float uTint;
        varying float vShell;
        float furHash(vec2 p) {
          p = fract(p * vec2(123.34, 456.21));
          p += dot(p, p + 45.32);
          return fract(p.x * p.y);
        }`,
      )
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        vec2 furCell = vUv * uDensity;
        vec2 furId = floor(furCell);
        vec2 furF = fract(furCell) - 0.5;
        float furH = furHash(furId);
        furF += (vec2(furHash(furId + 7.13), furHash(furId + 3.71)) - 0.5) * 0.35;
        float furLen = 0.5 + 0.5 * furH;
        if (vShell > 0.001) {
          if (vShell > furLen) discard;
          float thick = 0.62 * (1.0 - vShell / furLen) + 0.06;
          if (length(furF) > thick) discard;
        }
        diffuseColor.rgb *= mix(0.5, 1.06, vShell) * (0.9 + 0.1 * furH);
        // einzelne Haare leicht gelblich oder grau, Wurzeln dunkler (mehr Tiefe)
        float furT = furHash(furId + 1.7);
        diffuseColor.rgb *= mix(vec3(1.0), furT > 0.5 ? vec3(1.0, 0.92, 0.8) : vec3(0.86, 0.86, 0.88), abs(furT - 0.5) * 2.0 * uTint);
        diffuseColor.rgb *= 1.0 - uTint * 0.22 * (1.0 - vShell);`,
      );
  };
  mat.customProgramCacheKey = () => 'fur-shells-v2';
  return mat;
}

/** InstancedMesh mit N Schalen – identische Instanzmatrizen */
export function makeFurMesh(geometry: THREE.BufferGeometry, material: THREE.Material, shells: number) {
  const mesh = new THREE.InstancedMesh(geometry, material, shells);
  const m = new THREE.Matrix4();
  for (let i = 0; i < shells; i++) mesh.setMatrixAt(i, m);
  mesh.instanceMatrix.needsUpdate = true;
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  return mesh;
}
