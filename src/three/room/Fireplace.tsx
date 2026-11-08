import { Billboard } from '@react-three/drei';
import { useFrame, type ThreeElements } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { QUALITY } from '../../config';
import { FIRE, FLOOR_Y, WALL_Z } from '../layout';
import { createCanvas, get2d, mulberry32, toTexture } from '../tex/canvas';
import { makeCandleFlameMaterial, makeEmbersMaterial, makeFireMaterial } from './fire';
import { brickCanvas, pictureCanvas, plasterCanvas, screenCanvas } from './textures';

const MANTEL_TOP = FLOOR_Y + 4.0 + 0.24;
const FRONT_Z = WALL_Z + FIRE.depth;

/** Rote Stumpenkerze mit flackernder Flamme */
export function Candle({
  height = 0.5,
  radius = 0.1,
  color = '#8e1018',
  seed = 0,
  ...props
}: { height?: number; radius?: number; color?: string; seed?: number } & ThreeElements['group']) {
  const flame = useMemo(() => makeCandleFlameMaterial(seed), [seed]);
  useFrame(({ clock }) => {
    flame.uniforms.uTime.value = clock.elapsedTime;
  });
  return (
    <group {...props}>
      <mesh position={[0, height / 2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[radius, radius * 1.03, height, 32]} />
        <meshStandardMaterial color={color} roughness={0.5} emissive="#ff5a20" emissiveIntensity={0.06} />
      </mesh>
      <mesh position={[0, height + 0.002, 0]}>
        <cylinderGeometry args={[radius * 0.82, radius * 0.82, 0.006, 32]} />
        <meshStandardMaterial color="#ffb36b" emissive="#ff7a2a" emissiveIntensity={0.35} roughness={0.4} />
      </mesh>
      <mesh position={[0, height + 0.03, 0]}>
        <cylinderGeometry args={[0.005, 0.005, 0.06, 6]} />
        <meshBasicMaterial color="#1a0f08" />
      </mesh>
      <Billboard position={[0, height + 0.11, 0]}>
        <mesh material={flame}>
          <planeGeometry args={[0.1, 0.2]} />
        </mesh>
      </Billboard>
    </group>
  );
}

function glowTexture() {
  const c = createCanvas(256, 256);
  const g = get2d(c);
  const rg = g.createRadialGradient(128, 160, 0, 128, 160, 128);
  rg.addColorStop(0, 'rgba(255,150,60,1)');
  rg.addColorStop(0.4, 'rgba(255,90,20,0.45)');
  rg.addColorStop(1, 'rgba(255,60,10,0)');
  g.fillStyle = rg;
  g.fillRect(0, 0, 256, 256);
  return toTexture(c);
}

function barkTextures() {
  const rand = mulberry32(12);
  const bark = createCanvas(256, 256);
  const b = get2d(bark);
  b.fillStyle = '#2b1a0f';
  b.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 160; i++) {
    b.strokeStyle = rand() > 0.5 ? 'rgba(15,8,4,0.7)' : 'rgba(90,60,38,0.45)';
    b.lineWidth = 1 + rand() * 4;
    const x = rand() * 256;
    b.beginPath();
    b.moveTo(x, 0);
    for (let y = 0; y <= 256; y += 32) b.lineTo(x + (rand() - 0.5) * 10, y);
    b.stroke();
  }
  const ember = createCanvas(256, 256);
  const e = get2d(ember);
  e.fillStyle = '#000';
  e.fillRect(0, 0, 256, 256);
  e.shadowColor = '#ff7a1a';
  e.shadowBlur = 10;
  for (let i = 0; i < 40; i++) {
    e.strokeStyle = `rgba(255,${80 + rand() * 90},20,${0.5 + rand() * 0.5})`;
    e.lineWidth = 1 + rand() * 3;
    let x = rand() * 256;
    let y = 120 + rand() * 136;
    e.beginPath();
    e.moveTo(x, y);
    for (let k = 0; k < 4; k++) {
      x += (rand() - 0.5) * 50;
      y += (rand() - 0.5) * 30;
      e.lineTo(x, y);
    }
    e.stroke();
  }
  return { bark: toTexture(bark), ember: toTexture(ember) };
}

function PictureFrame({ w, h, seed, ...props }: { w: number; h: number; seed: number } & ThreeElements['group']) {
  const pic = useMemo(() => toTexture(pictureCanvas(seed)), [seed]);
  return (
    <group {...props}>
      <group rotation-x={-0.12} position={[0, h / 2, 0]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[w, h, 0.07]} />
          <meshStandardMaterial color={seed % 2 ? '#b8923e' : '#2a1a10'} metalness={seed % 2 ? 1 : 0.1} roughness={0.4} />
        </mesh>
        <mesh position={[0, 0, 0.037]}>
          <planeGeometry args={[w * 0.78, h * 0.8]} />
          <meshStandardMaterial map={pic} roughness={0.35} />
        </mesh>
      </group>
    </group>
  );
}

/** Tannengirlande entlang der Kaminsims-Kante */
function Garland({ from, to, sag }: { from: THREE.Vector3; to: THREE.Vector3; sag: number }) {
  const needles = useRef<THREE.InstancedMesh>(null);
  const balls = useRef<THREE.InstancedMesh>(null);
  const N = 420;
  const B = 16;
  const res = useMemo(
    () => ({
      needleGeo: new THREE.ConeGeometry(0.035, 0.24, 5),
      needleMat: new THREE.MeshStandardMaterial({ color: '#1f3d22', roughness: 0.8 }),
      ballGeo: new THREE.SphereGeometry(0.06, 16, 12),
      ballMat: new THREE.MeshPhysicalMaterial({ color: '#ffffff', metalness: 0.7, roughness: 0.18, clearcoat: 1 }),
    }),
    [],
  );
  useLayoutEffect(() => {
    const rand = mulberry32(99);
    const o = new THREE.Object3D();
    const at = (t: number) =>
      new THREE.Vector3().lerpVectors(from, to, t).add(new THREE.Vector3(0, -(Math.sin(t * Math.PI * 3) ** 2) * sag, 0));
    for (let i = 0; i < N; i++) {
      const t = rand();
      const p = at(t);
      o.position.set(p.x, p.y + (rand() - 0.5) * 0.1, p.z + (rand() - 0.5) * 0.12);
      o.rotation.set(rand() * Math.PI * 2, rand() * Math.PI * 2, rand() * Math.PI * 2);
      o.scale.setScalar(0.7 + rand() * 0.6);
      o.updateMatrix();
      needles.current?.setMatrixAt(i, o.matrix);
    }
    const colors = ['#b3121b', '#d8b25a', '#b3121b', '#e9e4da'];
    const col = new THREE.Color();
    for (let i = 0; i < B; i++) {
      const p = at((i + 0.5) / B + (rand() - 0.5) * 0.02);
      o.position.set(p.x, p.y - 0.08, p.z + 0.06);
      o.rotation.set(0, 0, 0);
      o.scale.setScalar(0.8 + rand() * 0.5);
      o.updateMatrix();
      balls.current?.setMatrixAt(i, o.matrix);
      balls.current?.setColorAt(i, col.set(colors[i % colors.length]));
    }
    if (needles.current) needles.current.instanceMatrix.needsUpdate = true;
    if (balls.current) {
      balls.current.instanceMatrix.needsUpdate = true;
      if (balls.current.instanceColor) balls.current.instanceColor.needsUpdate = true;
    }
  }, [from, to, sag]);
  return (
    <group>
      <instancedMesh ref={needles} args={[res.needleGeo, res.needleMat, N]} castShadow />
      <instancedMesh ref={balls} args={[res.ballGeo, res.ballMat, B]} castShadow />
    </group>
  );
}

export function Fireplace() {
  const tex = useMemo(() => {
    const stone = toTexture(plasterCanvas(), { repeat: [2, 2] });
    const brick = toTexture(brickCanvas(), { repeat: [2, 1.6] });
    const screen = toTexture(screenCanvas());
    return { stone, brick, screen, glow: glowTexture(), ...barkTextures() };
  }, []);
  const fires = useMemo(() => [makeFireMaterial(0, 1), makeFireMaterial(1.7, 0.9), makeFireMaterial(3.1, 0.85)], []);
  const embers = useMemo(() => {
    const count = QUALITY.embers;
    const pos = new Float32Array(count * 3);
    const seeds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = FIRE.x + (Math.random() - 0.5) * 1.8;
      pos[i * 3 + 1] = FLOOR_Y + 0.35;
      pos[i * 3 + 2] = WALL_Z + 0.35 + Math.random() * 0.45;
      seeds[i] = Math.random();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
    return { geo: g, mat: makeEmbersMaterial() };
  }, []);
  const logMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        map: tex.bark,
        roughness: 0.95,
        emissiveMap: tex.ember,
        emissive: '#ff5a14',
        emissiveIntensity: 1.8,
      }),
    [tex],
  );
  const glowMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: tex.glow,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
        opacity: 0.8,
      }),
    [tex],
  );
  const stoneMat = useMemo(() => new THREE.MeshStandardMaterial({ map: tex.stone, color: '#efdcb8', roughness: 0.85 }), [tex]);
  const brickMat = useMemo(() => new THREE.MeshStandardMaterial({ map: tex.brick, roughness: 0.95 }), [tex]);

  useFrame(({ clock, gl }) => {
    const t = clock.elapsedTime;
    for (const f of fires) f.uniforms.uTime.value = t;
    embers.mat.uniforms.uTime.value = t;
    embers.mat.uniforms.uPixel.value = gl.domElement.height / 900;
    const flick = 0.8 + 0.1 * Math.sin(t * 7.3) + 0.07 * Math.sin(t * 13.1 + 1.3) + 0.05 * Math.sin(t * 23.7);
    glowMat.opacity = 0.55 + 0.35 * flick;
    logMat.emissiveIntensity = 1.3 + 0.8 * flick;
  });

  const x = FIRE.x;
  const ow = FIRE.openW;
  const oh = FIRE.openH;
  const pillarW = 1.15;
  const totalW = ow + pillarW * 2;

  return (
    <group>
      {/* Einfassung */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[x + s * (ow / 2 + pillarW / 2), FLOOR_Y + 2.0, WALL_Z + FIRE.depth / 2]} material={stoneMat} castShadow receiveShadow>
          <boxGeometry args={[pillarW, 4.0, FIRE.depth]} />
        </mesh>
      ))}
      <mesh position={[x, FLOOR_Y + oh + (4.0 - oh) / 2, WALL_Z + FIRE.depth / 2]} material={stoneMat} castShadow receiveShadow>
        <boxGeometry args={[ow, 4.0 - oh, FIRE.depth]} />
      </mesh>
      {/* Zierleisten */}
      {[-1, 1].map((s) => (
        <mesh key={`p${s}`} position={[x + s * (ow / 2 + pillarW / 2), FLOOR_Y + 2.0, FRONT_Z + 0.05]} material={stoneMat} castShadow>
          <boxGeometry args={[pillarW * 0.6, 3.6, 0.1]} />
        </mesh>
      ))}
      <mesh position={[x, FLOOR_Y + 3.86, FRONT_Z + 0.08]} material={stoneMat} castShadow>
        <boxGeometry args={[totalW - 0.2, 0.16, 0.16]} />
      </mesh>
      <mesh position={[x, MANTEL_TOP - 0.12, WALL_Z + 0.66]} material={stoneMat} castShadow receiveShadow>
        <boxGeometry args={[totalW + 0.7, 0.24, 1.32]} />
      </mesh>
      {/* Feuerstelle */}
      <mesh position={[x, FLOOR_Y + 0.07, WALL_Z + FIRE.depth + 0.55]} receiveShadow>
        <boxGeometry args={[totalW + 0.4, 0.14, 1.1]} />
        <meshStandardMaterial color="#3b3330" roughness={0.6} />
      </mesh>
      <mesh position={[x, FLOOR_Y + oh / 2, WALL_Z + 0.06]} material={brickMat}>
        <planeGeometry args={[ow, oh]} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh
          key={`s${s}`}
          position={[x + s * (ow / 2 - 0.12), FLOOR_Y + oh / 2, WALL_Z + FIRE.depth / 2]}
          rotation-y={-s * (Math.PI / 2 - 0.25)}
          material={brickMat}
        >
          <planeGeometry args={[FIRE.depth + 0.1, oh]} />
        </mesh>
      ))}
      <mesh position={[x, FLOOR_Y + oh - 0.01, WALL_Z + FIRE.depth / 2]} rotation-x={Math.PI / 2}>
        <planeGeometry args={[ow, FIRE.depth]} />
        <meshStandardMaterial color="#0c0806" roughness={1} />
      </mesh>
      <mesh position={[x, FLOOR_Y + 0.15, WALL_Z + FIRE.depth / 2]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[ow, FIRE.depth]} />
        <meshStandardMaterial color="#1a1210" roughness={1} emissive="#ff4a10" emissiveIntensity={0.12} />
      </mesh>
      <mesh position={[x, FLOOR_Y + 1.0, WALL_Z + 0.1]} material={glowMat}>
        <planeGeometry args={[2.8, 2.3]} />
      </mesh>
      {/* Holzscheite */}
      <group position={[x, FLOOR_Y + 0.32, WALL_Z + 0.52]}>
        <mesh rotation={[0.1, 0.25, Math.PI / 2]} material={logMat} castShadow>
          <cylinderGeometry args={[0.17, 0.19, 1.9, 14]} />
        </mesh>
        <mesh rotation={[-0.2, -0.45, Math.PI / 2 - 0.1]} position={[0.1, 0.2, 0.1]} material={logMat}>
          <cylinderGeometry args={[0.14, 0.16, 1.6, 14]} />
        </mesh>
        <mesh rotation={[0.3, 0.9, Math.PI / 2 + 0.35]} position={[-0.3, 0.26, -0.05]} material={logMat}>
          <cylinderGeometry args={[0.12, 0.13, 1.3, 12]} />
        </mesh>
      </group>
      {/* Flammen */}
      <mesh position={[x, FLOOR_Y + 1.25, WALL_Z + 0.5]} material={fires[0]}>
        <planeGeometry args={[2.1, 2.0]} />
      </mesh>
      <mesh position={[x - 0.4, FLOOR_Y + 1.05, WALL_Z + 0.64]} material={fires[1]}>
        <planeGeometry args={[1.5, 1.6]} />
      </mesh>
      <mesh position={[x + 0.45, FLOOR_Y + 1.1, WALL_Z + 0.4]} material={fires[2]}>
        <planeGeometry args={[1.5, 1.7]} />
      </mesh>
      <points geometry={embers.geo} material={embers.mat} frustumCulled={false} />
      {/* Kamingitter */}
      <mesh position={[x, FLOOR_Y + 1.32, FRONT_Z + 0.32]} renderOrder={3}>
        <planeGeometry args={[ow + 0.5, (ow + 0.5) * 0.75]} />
        <meshStandardMaterial map={tex.screen} color="#141110" transparent alphaTest={0.02} metalness={0.6} roughness={0.45} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      {/* Deko auf dem Sims */}
      <group position={[0, MANTEL_TOP, WALL_Z + 0.55]}>
        <PictureFrame w={0.95} h={1.2} seed={1} position={[x - 2.25, 0, -0.15]} rotation-y={0.12} />
        <PictureFrame w={0.6} h={0.75} seed={2} position={[x - 1.45, 0, 0.05]} rotation-y={0.05} />
        <PictureFrame w={0.75} h={0.95} seed={3} position={[x + 2.0, 0, -0.1]} rotation-y={-0.1} />
        <Candle position={[x - 0.45, 0, 0.05]} height={0.75} radius={0.13} seed={1} />
        <Candle position={[x + 0.05, 0, 0.12]} height={0.5} radius={0.12} seed={2} />
        <Candle position={[x + 2.75, 0, 0.1]} height={0.65} radius={0.12} seed={3} />
      </group>
      <Garland
        from={new THREE.Vector3(x - totalW / 2 - 0.2, MANTEL_TOP - 0.05, WALL_Z + 1.32)}
        to={new THREE.Vector3(x + totalW / 2 + 0.2, MANTEL_TOP - 0.05, WALL_Z + 1.32)}
        sag={0.25}
      />
    </group>
  );
}
