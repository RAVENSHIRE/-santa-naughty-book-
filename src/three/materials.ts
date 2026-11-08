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
export function makeFurMaterial(opts: { length: number; density: [number, number]; shells: number; color?: string; droop?: number }) {
  const mat = new THREE.MeshStandardMaterial({ color: opts.color ?? palette.fur, roughness: 1, metalness: 0 });
  mat.defines = { ...(mat.defines ?? {}), USE_UV: '' };
  const uniforms = {
    uShells: { value: opts.shells },
    uLen: { value: opts.length },
    uDensity: { value: new THREE.Vector2(opts.density[0], opts.density[1]) },
    uDroop: { value: opts.droop ?? 0.3 },
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
        varying float vShell;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        float furShell = float(gl_InstanceID) / max(uShells - 1.0, 1.0);
        vShell = furShell;
        transformed += objectNormal * (furShell * uLen);
        transformed.y -= furShell * furShell * uLen * uDroop;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform vec2 uDensity;
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
        diffuseColor.rgb *= mix(0.5, 1.06, vShell) * (0.9 + 0.1 * furH);`,
      );
  };
  mat.customProgramCacheKey = () => 'fur-shells-v1';
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
