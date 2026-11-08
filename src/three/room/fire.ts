import * as THREE from 'three';

const noiseGLSL = /* glsl */ `
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
    return v;
  }
`;

const vertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

/** Kaminfeuer: animiertes fBm-Rauschen, additiv geblendet */
export function makeFireMaterial(seed = 0, intensity = 1) {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uSeed: { value: seed }, uIntensity: { value: intensity } },
    vertexShader: vertex,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uSeed;
      uniform float uIntensity;
      varying vec2 vUv;
      ${noiseGLSL}
      void main() {
        vec2 uv = vUv;
        float t = uTime + uSeed * 13.0;
        float n1 = fbm(vec2(uv.x * 3.0 + uSeed, uv.y * 2.0 - t * 1.6));
        float n2 = fbm(vec2(uv.x * 6.0 - uSeed * 2.0, uv.y * 3.6 - t * 2.5));
        float x = (uv.x - 0.5) * 2.0 + (n1 - 0.5) * 0.6 * uv.y;
        float width = mix(0.95, 0.1, pow(uv.y, 0.8));
        float body = 1.0 - smoothstep(width * 0.45, width, abs(x));
        float height = 1.0 - smoothstep(0.25, 0.95, uv.y + (n2 - 0.5) * 0.6);
        float f = body * height * (0.55 + 0.9 * n2);
        f *= smoothstep(0.0, 0.1, uv.y);
        f = clamp(f * 1.45 * uIntensity, 0.0, 1.6);
        vec3 col = mix(vec3(0.5, 0.05, 0.0), vec3(1.0, 0.36, 0.04), smoothstep(0.12, 0.55, f));
        col = mix(col, vec3(1.0, 0.74, 0.3), smoothstep(0.6, 1.0, f));
        col = mix(col, vec3(1.0, 0.94, 0.78), smoothstep(1.05, 1.45, f));
        float a = smoothstep(0.06, 0.4, f);
        gl_FragColor = vec4(col * 2.4, a);
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
}

/** Kerzenflamme: Tropfenform mit Flackern */
export function makeCandleFlameMaterial(seed = 0) {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uSeed: { value: seed } },
    vertexShader: vertex,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uSeed;
      varying vec2 vUv;
      ${noiseGLSL}
      void main() {
        vec2 uv = vUv;
        float t = uTime * 1.3 + uSeed * 7.0;
        float sway = (noise(vec2(t * 2.0, uSeed)) - 0.5) * 0.18 * uv.y;
        vec2 p = vec2((uv.x - 0.5 - sway) * 2.0, uv.y);
        float r = length(vec2(p.x * (1.0 + uv.y * 1.6), (uv.y - 0.28) * 1.3));
        float core = 1.0 - smoothstep(0.0, 0.5, r);
        float glow = 1.0 - smoothstep(0.0, 1.0, length(vec2(p.x, (uv.y - 0.3) * 1.2)));
        float flick = 0.85 + 0.15 * noise(vec2(t * 6.0, uSeed * 3.0));
        vec3 col = mix(vec3(1.0, 0.45, 0.08), vec3(1.0, 0.92, 0.7), core);
        float blue = smoothstep(0.2, 0.0, uv.y) * core;
        col = mix(col, vec3(0.3, 0.45, 1.0), blue * 0.6);
        float a = clamp(core * 1.2 + glow * 0.18, 0.0, 1.0) * flick;
        gl_FragColor = vec4(col * 2.6, a);
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
}

/** Aufsteigende Glut-Funken (Punkte, komplett im Shader animiert) */
export function makeEmbersMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uHeight: { value: 2.6 }, uPixel: { value: 1 } },
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform float uHeight;
      uniform float uPixel;
      attribute float aSeed;
      varying float vLife;
      void main() {
        float speed = 0.35 + fract(aSeed * 7.31) * 0.6;
        float life = fract(uTime * speed / uHeight + aSeed);
        vLife = life;
        vec3 p = position;
        p.y += life * uHeight;
        p.x += sin(uTime * (1.0 + aSeed) + aSeed * 20.0) * 0.12 * life;
        p.z += cos(uTime * (0.8 + aSeed) + aSeed * 9.0) * 0.08 * life;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = (2.0 + fract(aSeed * 3.7) * 3.0) * uPixel * (4.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      varying float vLife;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d) * (1.0 - vLife) * smoothstep(0.0, 0.08, vLife);
        gl_FragColor = vec4(vec3(1.0, 0.5, 0.15) * 3.0, a);
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
}

/** Schneeflocken (Punkte, im Shader animiert, in einer Box wiederholt) */
export function makeSnowMaterial(box: { min: THREE.Vector3; max: THREE.Vector3 }) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uMin: { value: box.min },
      uMax: { value: box.max },
      uPixel: { value: 1 },
    },
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uMin;
      uniform vec3 uMax;
      uniform float uPixel;
      attribute float aSeed;
      varying float vAlpha;
      void main() {
        vec3 size = uMax - uMin;
        float speed = 0.25 + fract(aSeed * 5.13) * 0.35;
        vec3 p = position;
        p.y = uMin.y + mod(position.y - uMin.y - uTime * speed, size.y);
        p.x += sin(uTime * 0.6 + aSeed * 30.0) * 0.15;
        p.z += cos(uTime * 0.5 + aSeed * 17.0) * 0.1;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = (1.5 + fract(aSeed * 9.1) * 2.5) * uPixel * (6.0 / -mv.z);
        vAlpha = 0.55 + 0.45 * fract(aSeed * 3.3);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      varying float vAlpha;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.1, d) * vAlpha;
        gl_FragColor = vec4(vec3(0.85, 0.92, 1.0), a);
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    depthWrite: false,
  });
}
