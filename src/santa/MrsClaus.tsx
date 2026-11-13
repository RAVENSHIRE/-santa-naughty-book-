import { useFrame } from '@react-three/fiber';
import { easing } from 'maath';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useBook } from '../store';
import { makeGold, makeVelvet } from '../three/materials';
import { Brooch } from '../three/props/Holly';
import { SantaHat } from '../three/props/SantaHat';
import { EYE, faceColorTexture, faceNormalTexture, frontZ, headGeometry, irisGeometry, irisTexture, scleraTexture } from './face';
import { BODY_DEPTH, furBlob, furTorus, furTube, listTexture, paperGeometry, profileBody, skinTexture, tubeGeometry } from './santaParts';
import { santaRuntime, type SantaPose } from './santaRuntime';
import { useSanta } from './santaStore';

export const CLAUS_POS = new THREE.Vector3(0, 0, -2.85);
/** Kopfmitte in Welt-Koordinaten (für die Kamera) */
export const CLAUS_HEAD = new THREE.Vector3(0, 2.78, -2.74);

/** Schlanke Silhouette: Rock (unter dem Tisch), Taille, Schultern */
const BODY = profileBody([
  [0.001, -1.6],
  [0.95, -1.55],
  [0.98, -0.9],
  [0.9, -0.2],
  [0.74, 0.5],
  [0.56, 1.1],
  [0.62, 1.5],
  [0.66, 1.8],
  [0.6, 2.05],
  [0.32, 2.22],
  [0.001, 2.3],
]);
const SHOULDER = 0.72;
const WAIST = 1.1;

type ArmPose = { sx: number; sz: number; ex: number; ez: number; hx: number };
type Pose = { r: ArmPose; l: ArmPose; head: number; eyes: number };

const REST_R: ArmPose = { sx: -0.32, sz: -0.38, ex: -1.25, ez: 0.35, hx: 0.25 };
const REST_L: ArmPose = { sx: -0.32, sz: 0.38, ex: -1.25, ez: -0.35, hx: 0.25 };
const POSES: Record<SantaPose, Pose> = {
  idle: { r: REST_R, l: REST_L, head: 0, eyes: 0 },
  wave: { r: REST_R, l: { sx: -0.1, sz: 2.35, ex: -0.2, ez: 1.25, hx: 0 }, head: -0.05, eyes: 0 },
  read: { r: { sx: -1.05, sz: -0.05, ex: -1.0, ez: 0.55, hx: 0.35 }, l: REST_L, head: 0.2, eyes: 0.38 },
  think: { r: REST_R, l: { sx: -0.75, sz: 0.25, ex: -2.1, ez: -0.6, hx: 0.3 }, head: 0.1, eyes: -0.15 },
  present: {
    r: { sx: -0.55, sz: -0.75, ex: -0.9, ez: 0.2, hx: 0.6 },
    l: { sx: -0.55, sz: 0.75, ex: -0.9, ez: -0.2, hx: 0.6 },
    head: -0.06,
    eyes: 0,
  },
};

const HAIR = '#d9b77c';

function useMaterials() {
  const mats = useMemo(() => {
    const skinTex = skinTexture();
    const skin = { roughness: 0.5, sheen: 0.45, sheenColor: new THREE.Color('#ff9c86'), sheenRoughness: 0.55, clearcoat: 0.08, clearcoatRoughness: 0.45 };
    return {
      velvet: makeVelvet('#7a0b12'),
      face: new THREE.MeshPhysicalMaterial({ map: faceColorTexture(0, '#f3cdb9', 0.55), normalMap: faceNormalTexture(0), normalScale: new THREE.Vector2(0.3, 0.3), ...skin }),
      skin: new THREE.MeshPhysicalMaterial({ map: skinTex, color: '#fbd8c6', ...skin }),
      // Lidschatten in Mauve, schwarze Wimpern
      lid: new THREE.MeshPhysicalMaterial({ color: '#c3918f', ...skin, side: THREE.DoubleSide }),
      lash: new THREE.MeshStandardMaterial({ color: '#120b09', roughness: 0.8 }),
      lip: new THREE.MeshPhysicalMaterial({ color: '#b3101d', roughness: 0.2, sheen: 0.3, sheenColor: new THREE.Color('#ff8090'), clearcoat: 0.9, clearcoatRoughness: 0.1 }),
      nose: new THREE.MeshPhysicalMaterial({ color: '#ffe2d6', map: skinTex, ...skin }),
      nostril: new THREE.MeshBasicMaterial({ color: '#3b1612' }),
      mouth: new THREE.MeshStandardMaterial({ color: '#3a0b10', roughness: 0.7 }),
      sclera: new THREE.MeshPhysicalMaterial({ map: scleraTexture(), roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.05 }),
      iris: new THREE.MeshPhysicalMaterial({ map: irisTexture(['#9cc8ee', '#4f93d6', '#285d9c']), roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.03 }),
      shine: new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.7 }),
      glove: new THREE.MeshPhysicalMaterial({ color: '#f4f1ea', roughness: 0.85, sheen: 0.7, sheenColor: new THREE.Color('#ffffff'), sheenRoughness: 0.5 }),
      belt: new THREE.MeshPhysicalMaterial({ color: '#151010', roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.3 }),
      gold: makeGold(0.24),
      paperBack: new THREE.MeshStandardMaterial({ color: '#eadbbb', roughness: 0.9, side: THREE.DoubleSide }),
    };
  }, []);
  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats]);
  return mats;
}

type Mats = ReturnType<typeof useMaterials>;

function Arm({ side, refs, mats }: { side: 1 | -1; refs: [React.RefObject<THREE.Group | null>, React.RefObject<THREE.Group | null>, React.RefObject<THREE.Group | null>]; mats: Mats }) {
  const cuff = useMemo(() => {
    const m = furTorus(0.15, 0.07, { length: 0.05 });
    m.rotation.x = Math.PI / 2;
    m.position.y = -0.86;
    return m;
  }, []);
  const [arm, elbow, hand] = refs;
  return (
    <group ref={arm} position={[side * SHOULDER, 1.9, 0]}>
      {/* gerundete Schulter */}
      <mesh position={[0, -0.08, 0]} material={mats.velvet} castShadow>
        <sphereGeometry args={[0.23, 24, 18]} />
      </mesh>
      <mesh position={[0, -0.47, 0]} material={mats.velvet} castShadow>
        <capsuleGeometry args={[0.19, 0.64, 8, 20]} />
      </mesh>
      <group ref={elbow} position={[0, -0.97, 0]}>
        <mesh position={[0, -0.42, 0]} material={mats.velvet} castShadow>
          <capsuleGeometry args={[0.15, 0.5, 8, 20]} />
        </mesh>
        <primitive object={cuff} />
        <group ref={hand} position={[0, -1.02, 0]}>
          <mesh material={mats.glove} scale={[0.13, 0.17, 0.09]} castShadow>
            <sphereGeometry args={[1, 24, 18]} />
          </mesh>
          <mesh material={mats.glove} position={[0, -0.13, 0.02]} scale={[0.11, 0.1, 0.08]} castShadow>
            <sphereGeometry args={[1, 20, 14]} />
          </mesh>
          <mesh material={mats.glove} position={[-side * 0.11, 0, 0.05]} rotation={[0.2, 0, -side * 0.6]} castShadow>
            <capsuleGeometry args={[0.04, 0.09, 6, 12]} />
          </mesh>
        </group>
      </group>
    </group>
  );
}

export function MrsClaus() {
  const mode = useSanta((s) => s.mode);
  const mats = useMaterials();
  const body = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const jaw = useRef<THREE.Group>(null);
  const mouth = useRef<THREE.Mesh>(null);
  const eyeL = useRef<THREE.Group>(null);
  const eyeR = useRef<THREE.Group>(null);
  const lidL = useRef<THREE.Mesh>(null);
  const lidR = useRef<THREE.Mesh>(null);
  const brows = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const elbowR = useRef<THREE.Group>(null);
  const elbowL = useRef<THREE.Group>(null);
  const handR = useRef<THREE.Group>(null);
  const handL = useRef<THREE.Group>(null);
  const paper = useRef<THREE.Group>(null);
  const anim = useRef({ blinkAt: 2, mouth: 0, phase: 0 });

  // Liste in der Hand: nur Namen, die heute schon entsiegelt wurden. Alte Textur wird freigegeben.
  const names = useBook((s) => s.guests.map((g) => g.name).join('\n'));
  const list = useMemo(() => listTexture(names ? names.split('\n') : [], 'Brav oder unartig?'), [names]);
  useEffect(() => () => list.dispose(), [list]);
  const tmpV = useMemo(() => new THREE.Vector3(), []);

  const geo = useMemo(() => {
    const head = headGeometry(1);
    const onFace = (pts: [number, number][], lift: number): [number, number, number][] => pts.map(([x, y]) => [x, y, frontZ(head, x, y) + lift]);
    const mouthZ = frontZ(head, 0, -0.26);
    return {
      head,
      mouthZ,
      body: BODY.geometry,
      belt: BODY.band(WAIST - 0.09, WAIST + 0.09, 0.02),
      buckle: new THREE.TorusGeometry(0.11, 0.022, 8, 4),
      paper: paperGeometry(0.62, 0.84),
      iris: irisGeometry(),
      lid: new THREE.SphereGeometry(EYE.r + 0.005, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2),
      lidLow: new THREE.SphereGeometry(EYE.r + 0.004, 32, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
      lash: new THREE.TorusGeometry(EYE.r + 0.006, 0.0042, 6, 40, Math.PI),
      lashLow: new THREE.TorusGeometry(EYE.r + 0.005, 0.0016, 6, 40, Math.PI),
      // volle rote Lippen, Mundwinkel leicht nach oben
      upperLip: tubeGeometry(onFace([[-0.072, -0.246], [-0.034, -0.24], [0, -0.247], [0.034, -0.24], [0.072, -0.246]], 0.004), 0.013, 32, 10),
      lowerLip: tubeGeometry(onFace([[-0.066, -0.252], [-0.03, -0.276], [0, -0.281], [0.03, -0.276], [0.066, -0.252]], 0.005), 0.017, 32, 10),
    };
  }, []);
  useEffect(() => () => Object.values(geo).forEach((g) => typeof g === 'object' && g.dispose()), [geo]);

  const fur = useMemo(() => {
    // lange, wellige blonde Haare unter der Mütze
    const hair = { length: 0.085, spacing: 0.005, droop: 0.85, curl: 1.4, tint: 0.9, color: HAIR };
    const capL = furBlob([0.4, 0.4, 0.48], { ...hair, curl: 0.4 });
    capL.position.set(0.11, 0.2, -0.1);
    capL.rotation.z = -0.12;
    const capR = furBlob([0.4, 0.4, 0.48], { ...hair, curl: 0.4 });
    capR.position.set(-0.11, 0.2, -0.1);
    capR.rotation.z = 0.12;
    const sideL = furBlob([0.16, 0.6, 0.27], hair);
    sideL.position.set(0.41, -0.36, -0.03);
    sideL.rotation.z = 0.12;
    const sideR = furBlob([0.16, 0.6, 0.27], hair);
    sideR.position.set(-0.41, -0.36, -0.03);
    sideR.rotation.z = -0.12;
    const back = furBlob([0.48, 0.75, 0.3], hair);
    back.position.set(0, -0.42, -0.3);
    // feine, gebogene Augenbrauen
    const brow = (s: number) =>
      furTube([[s * 0.075, 0.172, 0.452], [s * 0.15, 0.205, 0.449], [s * 0.25, 0.188, 0.405]], 0.01, {
        length: 0.012,
        spacing: 0.003,
        droop: 0.15,
        color: '#a8875c',
      });
    // Pelzbesatz: hochgeschlossener Kragen und Saum unter dem Gürtel
    const collar = furTorus(0.42, 0.12, { length: 0.07, spacing: 0.008, droop: 0.3 });
    collar.rotation.x = Math.PI / 2;
    collar.scale.set(1, BODY_DEPTH, 1);
    collar.position.set(0, 2.12, 0);
    const hem = furTorus(BODY.radius(0.86) + 0.02, 0.08, { length: 0.06, spacing: 0.008, droop: 0.3 });
    hem.rotation.x = Math.PI / 2;
    hem.scale.set(1, BODY_DEPTH, 1);
    hem.position.set(0, 0.86, 0);
    return { capL, capR, sideL, sideR, back, browL: brow(1), browR: brow(-1), collar, hem };
  }, []);

  useLayoutEffect(() => {
    santaRuntime.look.x = 0;
    santaRuntime.look.y = 0;
  }, []);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.1);
    const t = state.clock.elapsedTime;
    const now = performance.now();
    const a = anim.current;
    const rt = santaRuntime;
    const pose = POSES[rt.pose] ?? POSES.idle;
    const g = rt.gesture;
    const age = g ? (now - g.at) / 1000 : 99;
    if (age > 2) rt.gesture = null;

    // Atmen (+ Lachen)
    if (body.current) {
      const jx = g?.kind === 'laugh' && age < 1.6 ? Math.sin(age * 22) * 0.025 * (1 - age / 1.6) : 0;
      body.current.scale.set(1 + jx, 1 + Math.sin(t * 1.6) * 0.006, 1 + jx);
      body.current.position.y = Math.sin(t * 1.6) * 0.012;
    }

    // Kopf: Blick zur Person, Lese-Neigung, Gesten
    if (head.current) {
      let ry = rt.look.x * 0.38 + Math.sin(t * 0.37) * 0.03;
      let rx = -rt.look.y * 0.14 + pose.head + Math.sin(t * 0.53) * 0.02;
      let rz = Math.sin(t * 0.29) * 0.02 - rt.look.x * 0.04;
      if (g?.kind === 'nod' && age < 1.2) rx += Math.sin(age * 11) * 0.12 * (1 - age / 1.2);
      if (g?.kind === 'shake' && age < 1.4) ry += Math.sin(age * 13) * 0.2 * (1 - age / 1.4);
      if (g?.kind === 'laugh' && age < 1.6) {
        rx -= 0.16 * Math.sin(Math.min(1, age / 0.3) * Math.PI * 0.5) * (1 - age / 1.6);
        rz += Math.sin(age * 9) * 0.04;
      }
      easing.dampE(head.current.rotation, [rx, ry, rz], 0.22, dt);
    }

    // Augen + Blinzeln (Oberlid deckt den oberen Irisrand ab)
    const ex = -rt.look.y * 0.18 + pose.eyes;
    for (const e of [eyeL.current, eyeR.current]) if (e) easing.dampE(e.rotation, [ex, rt.look.x * 0.3, 0], 0.08, dt);
    if (t > a.blinkAt + 0.16) a.blinkAt = t + 1.8 + Math.random() * 3.2;
    const blinking = t > a.blinkAt && t < a.blinkAt + 0.16;
    const lidRot = blinking ? 0.62 : -0.32 + ex * 0.6 + (pose.eyes > 0.2 ? 0.18 : 0);
    for (const l of [lidL.current, lidR.current]) if (l) l.rotation.x = THREE.MathUtils.lerp(l.rotation.x, lidRot, blinking ? 0.6 : 0.3);
    if (brows.current) brows.current.position.y = THREE.MathUtils.lerp(brows.current.position.y, rt.brows * 0.025, 0.15);

    // Mund: Wortgrenzen der Stimme + leichtes Rauschen
    let target = 0;
    if (rt.speaking) {
      a.phase += dt * (8.5 + Math.sin(t * 2.3) * 2.5);
      const since = now - rt.lastBoundary;
      const boost = rt.lastBoundary > 0 && since < 400 ? 0.35 * (1 - since / 400) : 0;
      target = 0.2 + 0.5 * Math.abs(Math.sin(a.phase)) * (0.7 + 0.3 * Math.sin(t * 5.1)) + boost;
    }
    if (g?.kind === 'laugh' && age < 1.4) target = Math.max(target, 0.6 + 0.3 * Math.abs(Math.sin(t * 14)));
    a.mouth = THREE.MathUtils.lerp(a.mouth, Math.min(1, target), 0.35);
    if (mouth.current) mouth.current.scale.set(1 + a.mouth * 0.1, 0.06 + a.mouth * 0.5, 1);
    if (jaw.current) jaw.current.position.y = -a.mouth * 0.022;

    // Arme
    const arm = (s: THREE.Group | null, e: THREE.Group | null, h: THREE.Group | null, p: ArmPose, waving: boolean) => {
      if (!s || !e || !h) return;
      easing.dampE(s.rotation, [p.sx, 0, p.sz], 0.35, dt);
      easing.dampE(e.rotation, [p.ex, 0, p.ez + (waving ? Math.sin(t * 7) * 0.35 : 0)], waving ? 0.12 : 0.3, dt);
      easing.dampE(h.rotation, [p.hx, 0, 0], 0.3, dt);
    };
    arm(armR.current, elbowR.current, handR.current, pose.r, false);
    arm(armL.current, elbowL.current, handL.current, pose.l, rt.pose === 'wave');

    // Liste folgt der rechten Hand
    if (paper.current && handR.current && body.current) {
      handR.current.getWorldPosition(tmpV);
      body.current.worldToLocal(tmpV);
      const reading = rt.pose === 'read';
      tmpV.add({ x: reading ? 0.05 : 0.02, y: reading ? 0.22 : 0.05, z: reading ? 0.12 : 0.1 } as THREE.Vector3);
      paper.current.position.lerp(tmpV, 0.5);
      easing.dampE(paper.current.rotation, reading ? [-0.55, Math.PI - 0.55, 0.12] : [-0.15, Math.PI - 0.35, 0.18], 0.25, dt);
    }
  });

  return (
    <group position={CLAUS_POS} visible={mode === 'santa'}>
      <group ref={body}>
        <mesh geometry={geo.body} material={mats.velvet} castShadow receiveShadow />
        <mesh geometry={geo.belt} material={mats.belt} castShadow />
        <mesh geometry={geo.buckle} material={mats.gold} position={[0, WAIST, BODY.radius(WAIST) * BODY_DEPTH + 0.04]} rotation-z={Math.PI / 4} scale={[1.3, 1, 1]} castShadow />
        <primitive object={fur.collar} />
        <primitive object={fur.hem} />
        {/* Hals */}
        <mesh material={mats.skin} position={[0, 2.42, 0.06]} castShadow>
          <cylinderGeometry args={[0.115, 0.14, 0.5, 24]} />
        </mesh>

        <Arm side={-1} refs={[armR, elbowR, handR]} mats={mats} />
        <group ref={paper}>
          <mesh geometry={geo.paper} position={[0, -0.36, 0]} castShadow>
            <meshStandardMaterial map={list} roughness={0.9} />
          </mesh>
          <mesh geometry={geo.paper} position={[0, -0.36, -0.004]} rotation-y={Math.PI} material={mats.paperBack} />
        </group>
        <Arm side={1} refs={[armL, elbowL, handL]} mats={mats} />

        <group ref={head} position={[0, 2.82, 0.1]} scale={0.98}>
          <mesh geometry={geo.head} material={mats.face} castShadow receiveShadow />
          {/* Nase */}
          <mesh material={mats.nose} position={[0, -0.005, 0.466]} rotation-x={-0.38} castShadow>
            <capsuleGeometry args={[0.025, 0.06, 8, 20]} />
          </mesh>
          <mesh material={mats.nose} position={[0, -0.072, 0.49]} castShadow>
            <sphereGeometry args={[0.04, 32, 24]} />
          </mesh>
          {[1, -1].map((s) => (
            <group key={`n${s}`}>
              <mesh material={mats.nose} position={[s * 0.034, -0.088, 0.462]} scale={[1, 0.85, 1]} castShadow>
                <sphereGeometry args={[0.025, 24, 18]} />
              </mesh>
              <mesh material={mats.nostril} position={[s * 0.016, -0.11, 0.48]} rotation-x={Math.PI / 2 + 0.35} scale={[1, 0.6, 1]}>
                <circleGeometry args={[0.009, 16]} />
              </mesh>
            </group>
          ))}
          {/* Augen */}
          {(
            [
              [eyeL, lidL, 1],
              [eyeR, lidR, -1],
            ] as const
          ).map(([eRef, lRef, s]) => (
            <group key={s} position={[s * EYE.x, EYE.y, EYE.z]} scale={1.1}>
              <group ref={eRef}>
                <mesh material={mats.sclera}>
                  <sphereGeometry args={[EYE.r, 32, 24]} />
                </mesh>
                <mesh geometry={geo.iris} material={mats.iris} />
                <mesh material={mats.shine} position={[0.007, 0.008, EYE.r + 0.0012]}>
                  <circleGeometry args={[0.003, 10]} />
                </mesh>
              </group>
              <mesh ref={lRef} geometry={geo.lid} material={mats.lid} rotation-x={-0.32}>
                <mesh geometry={geo.lash} material={mats.lash} rotation-x={Math.PI / 2} />
              </mesh>
              <mesh geometry={geo.lidLow} material={mats.lid} rotation-x={0.42}>
                <mesh geometry={geo.lashLow} material={mats.lash} rotation-x={Math.PI / 2} />
              </mesh>
            </group>
          ))}
          <group ref={brows}>
            <primitive object={fur.browL} />
            <primitive object={fur.browR} />
          </group>
          {/* Mund: Lippen, dunkle Öffnung, Unterlippe bewegt sich */}
          <mesh ref={mouth} material={mats.mouth} position={[0, -0.262, geo.mouthZ + 0.001]}>
            <circleGeometry args={[0.055, 24]} />
          </mesh>
          <mesh geometry={geo.upperLip} material={mats.lip} scale={[1, 1, 1]} />
          <group ref={jaw}>
            <mesh geometry={geo.lowerLip} material={mats.lip} />
          </group>
          {/* Haare, Mütze mit Stechpalme, Ohrringe */}
          <primitive object={fur.capL} />
          <primitive object={fur.capR} />
          <primitive object={fur.sideL} />
          <primitive object={fur.sideR} />
          <primitive object={fur.back} />
          <SantaHat position={[0, 0.3, -0.04]} rotation={[-0.16, Math.PI, -0.12]} scale={1.72} furScale={1.72} />
          <Brooch position={[-0.3, 0.46, 0.33]} rotation={[-0.3, -0.5, 0.4]} scale={0.9} />
          {[1, -1].map((s) => (
            <group key={`e${s}`} position={[s * 0.43, -0.2, 0.08]}>
              <mesh material={mats.gold}>
                <sphereGeometry args={[0.014, 12, 10]} />
              </mesh>
              <mesh material={mats.gold} position={[0, -0.045, 0]} scale={[0.8, 1.3, 0.8]}>
                <sphereGeometry args={[0.02, 14, 12]} />
              </mesh>
            </group>
          ))}
        </group>
      </group>
    </group>
  );
}
