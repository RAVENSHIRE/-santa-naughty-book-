import type { ThreeElements } from '@react-three/fiber';
import { useMemo, type ReactNode } from 'react';
import * as THREE from 'three';
import { COVER_T, HC, WC } from '../book/geometry';
import { CANDLE_POS, DESK, FLOOR_Y, LECTERN_POS, TILT } from '../layout';
import { makeGold } from '../materials';
import { Candle } from '../room/Fireplace';
import { cookieCanvas, woodCanvas } from '../room/textures';
import { createCanvas, get2d, toTexture } from '../tex/canvas';
import { Pinecone, berryMaterial, createHollyLeafGeometry, hollyMaterial } from './Holly';
import { SantaHat } from './SantaHat';

function padTexture() {
  const c = createCanvas(1024, 660);
  const g = get2d(c);
  g.fillStyle = '#183324';
  g.fillRect(0, 0, 1024, 660);
  g.strokeStyle = '#b8923e';
  g.lineWidth = 6;
  g.strokeRect(22, 22, 980, 616);
  g.lineWidth = 2;
  g.strokeRect(36, 36, 952, 588);
  return toTexture(c);
}

/** Goldene Lesebrille wie auf dem Foto */
function Glasses(props: ThreeElements['group']) {
  const res = useMemo(() => {
    const gold = makeGold(0.22);
    const glass = new THREE.MeshPhysicalMaterial({
      color: '#ffffff',
      transparent: true,
      opacity: 0.16,
      roughness: 0.02,
      metalness: 0,
      clearcoat: 1,
      depthWrite: false,
    });
    const bridge = new THREE.TubeGeometry(
      new THREE.QuadraticBezierCurve3(new THREE.Vector3(-0.05, 0.03, 0), new THREE.Vector3(0, 0.07, 0), new THREE.Vector3(0.05, 0.03, 0)),
      12,
      0.006,
      6,
      false,
    );
    return { gold, glass, bridge };
  }, []);
  return (
    <group {...props}>
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 0.205, 0, 0]}>
          <mesh material={res.gold} scale={[1.2, 0.82, 1]} castShadow>
            <torusGeometry args={[0.13, 0.0075, 10, 64]} />
          </mesh>
          <mesh material={res.glass} scale={[1.2, 0.82, 1]}>
            <circleGeometry args={[0.128, 48]} />
          </mesh>
          <mesh material={res.gold} position={[-s * 0.03, -0.035, -0.03]} rotation={[0, 0, s * 0.08]} castShadow>
            <boxGeometry args={[0.27, 0.011, 0.011]} />
          </mesh>
        </group>
      ))}
      <mesh geometry={res.bridge} material={res.gold} castShadow />
    </group>
  );
}

function HollySprig(props: ThreeElements['group']) {
  const res = useMemo(
    () => ({ leaf: createHollyLeafGeometry(0.3, 0.11), mat: hollyMaterial(), berry: new THREE.SphereGeometry(0.04, 20, 14), berryMat: berryMaterial() }),
    [],
  );
  return (
    <group {...props}>
      {[0.2, 1.4, 2.6, 3.9, 5.1].map((a, i) => (
        <mesh key={i} geometry={res.leaf} material={res.mat} rotation={[-Math.PI / 2 + 0.15 * Math.sin(i * 2), 0, a]} position={[0, 0.03 + i * 0.006, 0]} castShadow receiveShadow />
      ))}
      {[
        [0.0, 0.08, 0.0],
        [0.06, 0.07, 0.04],
        [-0.05, 0.075, 0.05],
        [0.02, 0.07, -0.06],
      ].map((p, i) => (
        <mesh key={`b${i}`} geometry={res.berry} material={res.berryMat} position={p as [number, number, number]} castShadow />
      ))}
      <Pinecone position={[0.25, 0.07, 0.12]} rotation={[Math.PI / 2 - 0.2, 0, 0.6]} length={0.22} radius={0.075} />
      <Pinecone position={[-0.2, 0.06, 0.18]} rotation={[Math.PI / 2 - 0.1, 0, -0.9]} length={0.18} radius={0.06} />
    </group>
  );
}

function MilkAndCookies(props: ThreeElements['group']) {
  const cookies = useMemo(
    () =>
      [1, 2, 3].map((s) => {
        const top = new THREE.MeshStandardMaterial({ map: toTexture(cookieCanvas(s)), roughness: 0.85 });
        return [new THREE.MeshStandardMaterial({ color: '#b8793a', roughness: 0.9 }), top, top];
      }),
    [],
  );
  return (
    <group {...props}>
      <mesh position={[0, 0.018, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[0.36, 0.3, 0.036, 48]} />
        <meshPhysicalMaterial color="#f4efe6" roughness={0.18} clearcoat={0.6} />
      </mesh>
      {[
        [-0.1, 0.05, 0.06, 0.05],
        [0.12, 0.05, -0.04, -0.2],
        [0.01, 0.078, -0.01, 0.35],
      ].map(([x, y, z, r], i) => (
        <mesh key={i} position={[x, y, z]} rotation={[0.04 * i, r, 0.03]} material={cookies[i]} castShadow>
          <cylinderGeometry args={[0.12, 0.12, 0.028, 32]} />
        </mesh>
      ))}
      <group position={[0.5, 0, -0.32]}>
        <mesh position={[0, 0.22, 0]} castShadow>
          <cylinderGeometry args={[0.105, 0.095, 0.44, 40, 1, true]} />
          <meshPhysicalMaterial color="#ffffff" transparent opacity={0.22} roughness={0.03} clearcoat={1} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
        <mesh position={[0, 0.15, 0]}>
          <cylinderGeometry args={[0.096, 0.088, 0.28, 40]} />
          <meshPhysicalMaterial color="#fbf8f2" roughness={0.35} sheen={0.4} />
        </mesh>
        <mesh position={[0, 0.008, 0]}>
          <cylinderGeometry args={[0.098, 0.098, 0.016, 40]} />
          <meshPhysicalMaterial color="#ffffff" transparent opacity={0.35} roughness={0.05} />
        </mesh>
      </group>
    </group>
  );
}

/** Schreibtisch, Lesepult (mit Buch als children) und Deko */
export function Desk({ children }: { children: ReactNode }) {
  const tex = useMemo(() => {
    const top = toTexture(woodCanvas(3, [112, 50, 28], [58, 22, 12], 512, 30), { repeat: [2, 1] });
    const lect = toTexture(woodCanvas(7, [92, 44, 24], [50, 20, 10], 512, 36));
    return { top, lect, pad: padTexture() };
  }, []);
  const woodMat = useMemo(() => new THREE.MeshPhysicalMaterial({ map: tex.top, roughness: 0.42, clearcoat: 0.5, clearcoatRoughness: 0.3 }), [tex]);
  const lectMat = useMemo(() => new THREE.MeshStandardMaterial({ map: tex.lect, roughness: 0.5 }), [tex]);

  // Lesepult-Seitenteile aus den Brett-Ecken berechnen
  const support = useMemo(() => {
    const zl = -COVER_T - 0.06;
    const yl = (HC + 0.24) / 2;
    const toWorld = (y: number, z: number) => ({
      y: LECTERN_POS.y + y * Math.sin(TILT) + z * Math.cos(TILT),
      z: LECTERN_POS.z - y * Math.cos(TILT) + z * Math.sin(TILT),
    });
    const front = toWorld(-yl, zl);
    const back = toWorld(yl, zl);
    const s = new THREE.Shape();
    // Shape-Koordinaten: x = -z(Welt), y = y(Welt)
    s.moveTo(-front.z - 0.05, 0);
    s.lineTo(-front.z - 0.05, Math.max(0.04, front.y));
    s.lineTo(-back.z, back.y);
    s.lineTo(-back.z, 0);
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.07, bevelEnabled: false });
    g.rotateY(Math.PI / 2);
    return { geo: g, front, back };
  }, []);

  const legs: [number, number][] = [
    [-DESK.w / 2 + 0.25, -DESK.d / 2 + 0.25],
    [DESK.w / 2 - 0.25, -DESK.d / 2 + 0.25],
    [-DESK.w / 2 + 0.25, DESK.d / 2 - 0.25],
    [DESK.w / 2 - 0.25, DESK.d / 2 - 0.25],
  ];
  const legH = -FLOOR_Y - DESK.t;

  return (
    <group>
      <mesh position={[0, -DESK.t / 2, 0]} material={woodMat} castShadow receiveShadow>
        <boxGeometry args={[DESK.w, DESK.t, DESK.d]} />
      </mesh>
      <mesh position={[0, -DESK.t - 0.22, DESK.d / 2 - 0.12]} material={woodMat} castShadow>
        <boxGeometry args={[DESK.w - 0.4, 0.44, 0.08]} />
      </mesh>
      {legs.map(([x, z], i) => (
        <mesh key={i} position={[x, -DESK.t - legH / 2, z]} material={woodMat} castShadow>
          <boxGeometry args={[0.22, legH, 0.22]} />
        </mesh>
      ))}
      <mesh position={[0, 0.006, 0.25]} receiveShadow>
        <boxGeometry args={[3.9, 0.012, 2.5]} />
        <meshStandardMaterial map={tex.pad} roughness={0.75} />
      </mesh>

      {/* Lesepult */}
      <group position={LECTERN_POS} rotation-x={-Math.PI / 2 + TILT}>
        {children}
        <mesh position={[0, 0, -COVER_T - 0.035]} material={lectMat} castShadow receiveShadow>
          <boxGeometry args={[2 * WC + 0.34, HC + 0.24, 0.05]} />
        </mesh>
        <mesh position={[0, -(HC + 0.24) / 2 + 0.03, -COVER_T + 0.03]} material={lectMat} castShadow receiveShadow>
          <boxGeometry args={[2 * WC + 0.34, 0.06, 0.18]} />
        </mesh>
      </group>
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={support.geo} material={lectMat} position={[s * (WC - 0.05) - 0.035, 0.012, 0]} castShadow receiveShadow />
      ))}
      <mesh position={[0, 0.03, (support.front.z + support.back.z) / 2]} material={lectMat} castShadow receiveShadow>
        <boxGeometry args={[2 * WC + 0.2, 0.05, Math.abs(support.front.z - support.back.z) + 0.1]} />
      </mesh>

      {/* Deko */}
      <Candle position={CANDLE_POS} height={0.62} radius={0.11} seed={7} />
      <mesh position={[CANDLE_POS[0], 0.02, CANDLE_POS[2]]} castShadow receiveShadow>
        <cylinderGeometry args={[0.2, 0.24, 0.04, 40]} />
        <meshStandardMaterial color="#b8923e" metalness={1} roughness={0.3} />
      </mesh>
      <Glasses position={[1.95, 0.075, 1.05]} rotation={[-1.25, 0, -0.35]} />
      <HollySprig position={[-2.05, 0, 1.0]} rotation-y={0.4} />
      <MilkAndCookies position={[2.2, 0, -0.85]} />
      <SantaHat position={[-2.55, 0.0, -0.05]} rotation-y={2.2} scale={1.05} />
    </group>
  );
}
