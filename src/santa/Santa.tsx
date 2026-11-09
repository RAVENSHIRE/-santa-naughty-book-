import { useFrame } from '@react-three/fiber';
import { easing } from 'maath';
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useBook } from '../store';
import { makeGold, makeVelvet } from '../three/materials';
import { Brooch } from '../three/props/Holly';
import { SantaHat } from '../three/props/SantaHat';
import {
  beltGeometry,
  BODY_DEPTH,
  bodyGeometry,
  bodyRadius,
  frontTrimPoints,
  furBlob,
  furTorus,
  furTube,
  listTexture,
  paperGeometry,
  skinTexture,
  tubeGeometry,
} from './santaParts';
import { santaRuntime, type SantaPose } from './santaRuntime';
import { useSanta } from './santaStore';

export const SANTA_POS = new THREE.Vector3(0, 0, -2.85);
/** Kopfmitte in Welt-Koordinaten (für Kamera) */
export const SANTA_HEAD = new THREE.Vector3(0, 2.95, -2.7);

type ArmPose = { sx: number; sz: number; ex: number; ez: number; hx: number };
type Pose = { r: ArmPose; l: ArmPose; head: number; eyes: number };

// Arm-Rotationen: s = Schulter, e = Ellbogen, h = Hand (rechts = Santas rechte Hand = Bildseite links)
const POSES: Record<SantaPose, Pose> = {
  idle: {
    r: { sx: -0.32, sz: -0.38, ex: -1.25, ez: 0.35, hx: 0.25 },
    l: { sx: -0.32, sz: 0.38, ex: -1.25, ez: -0.35, hx: 0.25 },
    head: 0,
    eyes: 0,
  },
  wave: {
    r: { sx: -0.32, sz: -0.38, ex: -1.25, ez: 0.35, hx: 0.25 },
    l: { sx: -0.1, sz: 2.35, ex: -0.2, ez: 1.25, hx: 0 },
    head: -0.05,
    eyes: 0,
  },
  read: {
    r: { sx: -1.05, sz: -0.05, ex: -1.0, ez: 0.55, hx: 0.35 },
    l: { sx: -0.32, sz: 0.38, ex: -1.25, ez: -0.35, hx: 0.25 },
    head: 0.2,
    eyes: 0.38,
  },
  think: {
    r: { sx: -0.32, sz: -0.38, ex: -1.25, ez: 0.35, hx: 0.25 },
    l: { sx: -0.75, sz: 0.25, ex: -2.1, ez: -0.6, hx: 0.3 },
    head: 0.1,
    eyes: -0.15,
  },
  present: {
    r: { sx: -0.55, sz: -0.75, ex: -0.9, ez: 0.2, hx: 0.6 },
    l: { sx: -0.55, sz: 0.75, ex: -0.9, ez: -0.2, hx: 0.6 },
    head: -0.06,
    eyes: 0,
  },
};

function useMaterials() {
  return useMemo(() => {
    const skinTex = skinTexture();
    return {
      velvet: makeVelvet('#7a0b12'),
      skin: new THREE.MeshPhysicalMaterial({ map: skinTex, roughness: 0.58, sheen: 0.3, sheenColor: new THREE.Color('#ffc4b0'), sheenRoughness: 0.6 }),
      nose: new THREE.MeshPhysicalMaterial({ color: '#e79a88', roughness: 0.45, sheen: 0.3, sheenColor: new THREE.Color('#ffd0c0') }),
      glove: new THREE.MeshPhysicalMaterial({ color: '#f4f1ea', roughness: 0.85, sheen: 0.7, sheenColor: new THREE.Color('#ffffff'), sheenRoughness: 0.5 }),
      belt: new THREE.MeshPhysicalMaterial({ color: '#151010', roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.3 }),
      gold: makeGold(0.24),
      eyeWhite: new THREE.MeshPhysicalMaterial({ color: '#f3efe8', roughness: 0.12, clearcoat: 1 }),
      iris: new THREE.MeshStandardMaterial({ color: '#4f86c2', roughness: 0.25 }),
      pupil: new THREE.MeshBasicMaterial({ color: '#0b0b10' }),
      shine: new THREE.MeshBasicMaterial({ color: '#ffffff' }),
      mouth: new THREE.MeshStandardMaterial({ color: '#3a0b0b', roughness: 0.6 }),
      lens: new THREE.MeshPhysicalMaterial({ color: '#ffffff', transparent: true, opacity: 0.12, roughness: 0.02, clearcoat: 1, depthWrite: false }),
      paperBack: new THREE.MeshStandardMaterial({ color: '#eadbbb', roughness: 0.9, side: THREE.DoubleSide }),
      button: makeVelvet('#5e070c'),
    };
  }, []);
}

function Arm({ side, armRef, elbowRef, handRef, mats }: {
  side: 1 | -1;
  armRef: React.RefObject<THREE.Group | null>;
  elbowRef: React.RefObject<THREE.Group | null>;
  handRef: React.RefObject<THREE.Group | null>;
  mats: ReturnType<typeof useMaterials>;
}) {
  const cuff = useMemo(() => {
    const m = furTorus(0.2, 0.085, { length: 0.05 });
    m.rotation.x = Math.PI / 2;
    m.position.y = -0.86;
    return m;
  }, []);
  return (
    <group ref={armRef} position={[side * 0.98, 1.84, 0]}>
      <mesh position={[0, -0.47, 0]} material={mats.velvet} castShadow>
        <capsuleGeometry args={[0.245, 0.64, 8, 20]} />
      </mesh>
      <group ref={elbowRef} position={[0, -0.97, 0]}>
        <mesh position={[0, -0.42, 0]} material={mats.velvet} castShadow>
          <capsuleGeometry args={[0.235, 0.5, 8, 20]} />
        </mesh>
        <group position={[0, 0, 0]}>
          <primitive object={cuff} />
        </group>
        <group ref={handRef} position={[0, -1.02, 0]}>
          <mesh material={mats.glove} scale={[0.19, 0.23, 0.13]} castShadow>
            <sphereGeometry args={[1, 24, 18]} />
          </mesh>
          <mesh material={mats.glove} position={[0, -0.17, 0.02]} scale={[0.17, 0.13, 0.11]} castShadow>
            <sphereGeometry args={[1, 20, 14]} />
          </mesh>
          <mesh material={mats.glove} position={[-side * 0.15, 0.0, 0.06]} rotation={[0.2, 0, -side * 0.6]} castShadow>
            <capsuleGeometry args={[0.055, 0.12, 6, 12]} />
          </mesh>
        </group>
      </group>
    </group>
  );
}

export function Santa() {
  const mode = useSanta((s) => s.mode);
  const mats = useMaterials();
  const root = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const jaw = useRef<THREE.Group>(null);
  const mouth = useRef<THREE.Mesh>(null);
  const eyeL = useRef<THREE.Group>(null);
  const eyeR = useRef<THREE.Group>(null);
  const lidL = useRef<THREE.Mesh>(null);
  const lidR = useRef<THREE.Mesh>(null);
  const browL = useRef<THREE.Group>(null);
  const browR = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const elbowR = useRef<THREE.Group>(null);
  const elbowL = useRef<THREE.Group>(null);
  const handR = useRef<THREE.Group>(null);
  const handL = useRef<THREE.Group>(null);
  const paper = useRef<THREE.Group>(null);
  const anim = useRef({ blinkAt: 2, mouth: 0, phase: 0, lastPose: 'idle' as SantaPose });
  const guests = useBook((s) => s.guests);
  const locale = useBook((s) => s.locale);
  const list = useMemo(() => listTexture(guests.map((g) => g.name), locale === 'de' ? 'Brav oder unartig?' : 'Naughty or nice?'), [guests, locale]);
  const paperGeo = useMemo(() => paperGeometry(0.62, 0.84), []);
  const tmpV = useMemo(() => new THREE.Vector3(), []);

  const fur = useMemo(() => {
    const beardOpts = { length: 0.08, spacing: 0.0058, droop: 0.65 };
    const beardMain = furBlob([0.52, 0.5, 0.36], beardOpts);
    beardMain.position.set(0, -0.48, 0.12);
    // unterer Bart hängt am Körper (folgt dem Kopf nicht ganz – wie echte Schwerkraft)
    const beardLow = furBlob([0.72, 0.74, 0.48], { ...beardOpts, length: 0.1 });
    beardLow.position.set(0, 1.62, 0.6);
    const beardTip = furBlob([0.46, 0.52, 0.34], { ...beardOpts, length: 0.09 });
    beardTip.position.set(0, 1.08, 0.66);
    const cheekL = furBlob([0.24, 0.4, 0.28], beardOpts);
    cheekL.position.set(0.34, -0.32, 0.12);
    const cheekR = furBlob([0.24, 0.4, 0.28], beardOpts);
    cheekR.position.set(-0.34, -0.32, 0.12);
    const hairOpts = { length: 0.06, spacing: 0.007, droop: 0.4 };
    const hairL = furBlob([0.15, 0.27, 0.27], hairOpts);
    hairL.position.set(0.42, -0.02, -0.06);
    const hairR = furBlob([0.15, 0.27, 0.27], hairOpts);
    hairR.position.set(-0.42, -0.02, -0.06);
    const hairBack = furBlob([0.42, 0.32, 0.22], hairOpts);
    hairBack.position.set(0, -0.12, -0.3);
    const must = (s: number) =>
      furTube(
        [
          [s * 0.015, -0.155, 0.535],
          [s * 0.12, -0.175, 0.52],
          [s * 0.24, -0.235, 0.455],
          [s * 0.33, -0.31, 0.36],
        ],
        0.058,
        { length: 0.05, spacing: 0.0065, droop: 0.4 },
      );
    const brow = (s: number) =>
      furTube(
        [
          [s * 0.06, 0.205, 0.452],
          [s * 0.17, 0.245, 0.44],
          [s * 0.28, 0.205, 0.375],
        ],
        0.03,
        { length: 0.032, spacing: 0.006, droop: 0.2 },
      );
    const collar = furTorus(0.64, 0.21, { length: 0.09, spacing: 0.009, droop: 0.3 });
    collar.rotation.x = Math.PI / 2;
    collar.scale.set(1, BODY_DEPTH - 0.06, 1);
    collar.position.set(0, 2.16, -0.1);
    const trim = furTube(frontTrimPoints(-0.7, 1.95), 0.11, { length: 0.05, spacing: 0.008, droop: 0.15 });
    return { beardMain, beardLow, beardTip, cheekL, cheekR, hairL, hairR, hairBack, mustL: must(1), mustR: must(-1), browL: brow(1), browR: brow(-1), collar, trim };
  }, []);

  const geo = useMemo(
    () => ({
      body: bodyGeometry(),
      belt: beltGeometry(0.28, 0.58),
      buckle: new THREE.TorusGeometry(0.17, 0.035, 8, 4),
      lid: new THREE.SphereGeometry(0.081, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2),
      rim: new THREE.TorusGeometry(0.105, 0.007, 8, 48),
      lens: new THREE.CircleGeometry(0.103, 32),
      bridge: tubeGeometry(
        [
          [-0.07, -0.02, 0.555],
          [0, 0.0, 0.565],
          [0.07, -0.02, 0.555],
        ],
        0.006,
        12,
        6,
      ),
      temple: (s: number) =>
        tubeGeometry(
          [
            [s * 0.285, -0.03, 0.51],
            [s * 0.36, -0.01, 0.36],
            [s * 0.39, 0.0, 0.16],
          ],
          0.006,
          12,
          6,
        ),
    }),
    [],
  );

  const beltY = 0.43;
  const beltZ = bodyRadius(beltY) * BODY_DEPTH + 0.06;

  useLayoutEffect(() => {
    // Blick nach vorne, bis die Kamera jemanden sieht
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

    // Atmen
    if (body.current) {
      const br = Math.sin(t * 1.6);
      let jx = 0;
      if (rt.gesture?.kind === 'laugh') {
        const age = (now - rt.gesture.at) / 1000;
        if (age < 1.6) jx = Math.sin(age * 22) * 0.025 * (1 - age / 1.6);
      }
      body.current.scale.set(1 + jx, 1 + br * 0.006, 1 + jx);
      body.current.position.y = br * 0.012;
    }

    // Kopf: Blick zur Person, Lese-Neigung, Gesten
    if (head.current) {
      let ry = rt.look.x * 0.38 + Math.sin(t * 0.37) * 0.03;
      let rx = -rt.look.y * 0.14 + pose.head + Math.sin(t * 0.53) * 0.02;
      let rz = Math.sin(t * 0.29) * 0.02 - rt.look.x * 0.04;
      const g = rt.gesture;
      if (g) {
        const age = (now - g.at) / 1000;
        if (g.kind === 'nod' && age < 1.2) rx += Math.sin(age * 11) * 0.12 * (1 - age / 1.2);
        if (g.kind === 'shake' && age < 1.4) ry += Math.sin(age * 13) * 0.2 * (1 - age / 1.4);
        if (g.kind === 'laugh' && age < 1.6) {
          rx -= 0.16 * Math.sin(Math.min(1, age / 0.3) * Math.PI * 0.5) * (1 - age / 1.6);
          rz += Math.sin(age * 9) * 0.04;
        }
        if (g.kind === 'surprise' && age < 1.0) rx -= 0.08 * (1 - age);
        if (age > 2) rt.gesture = null;
      }
      easing.dampE(head.current.rotation, [rx, ry, rz], 0.22, dt);
    }

    // Augen
    const ex = -rt.look.y * 0.18 + pose.eyes;
    const ey = rt.look.x * 0.3;
    for (const e of [eyeL.current, eyeR.current]) if (e) easing.dampE(e.rotation, [ex, ey, 0], 0.08, dt);

    // Blinzeln
    if (t > a.blinkAt + 0.16) a.blinkAt = t + 1.8 + Math.random() * 3.2;
    const blinking = t > a.blinkAt && t < a.blinkAt + 0.16;
    const lidRot = blinking ? 0.35 : -0.95 + (pose.eyes > 0.2 ? 0.35 : 0);
    for (const l of [lidL.current, lidR.current]) if (l) l.rotation.x = THREE.MathUtils.lerp(l.rotation.x, lidRot, blinking ? 0.6 : 0.3);

    // Augenbrauen
    const browY = rt.brows * 0.035 + (rt.gesture?.kind === 'surprise' ? 0.04 : 0);
    for (const b of [browL.current, browR.current]) if (b) b.position.y = THREE.MathUtils.lerp(b.position.y, browY, 0.15);

    // Mund (Lippen-Synchronisation über Wortgrenzen + Rauschen)
    let target = 0;
    if (rt.speaking) {
      a.phase += dt * (8.5 + Math.sin(t * 2.3) * 2.5);
      const sinceWord = now - rt.lastBoundary;
      const boost = rt.lastBoundary > 0 && sinceWord < 400 ? 0.35 * (1 - sinceWord / 400) : 0;
      target = 0.25 + 0.55 * Math.abs(Math.sin(a.phase)) * (0.7 + 0.3 * Math.sin(t * 5.1)) + boost;
    }
    if (rt.gesture?.kind === 'laugh' && now - rt.gesture.at < 1400) target = Math.max(target, 0.6 + 0.3 * Math.abs(Math.sin(t * 14)));
    a.mouth = THREE.MathUtils.lerp(a.mouth, Math.min(1, target), 0.35);
    if (mouth.current) mouth.current.scale.set(1.25 + a.mouth * 0.15, 0.12 + a.mouth * 0.95, 1);
    if (jaw.current) jaw.current.position.y = -a.mouth * 0.045;

    // Arme
    const applyArm = (arm: THREE.Group | null, elbow: THREE.Group | null, hand: THREE.Group | null, p: ArmPose, waving: boolean) => {
      if (!arm || !elbow || !hand) return;
      easing.dampE(arm.rotation, [p.sx, 0, p.sz], 0.35, dt);
      const wave = waving ? Math.sin(t * 7) * 0.35 : 0;
      easing.dampE(elbow.rotation, [p.ex, 0, p.ez + wave], waving ? 0.12 : 0.3, dt);
      easing.dampE(hand.rotation, [p.hx, 0, 0], 0.3, dt);
    };
    applyArm(armR.current, elbowR.current, handR.current, pose.r, false);
    applyArm(armL.current, elbowL.current, handL.current, pose.l, rt.pose === 'wave');

    // Liste an der rechten Hand: beim Vorlesen zu Santa gedreht, sonst locker gehalten
    if (paper.current && handR.current && body.current) {
      handR.current.getWorldPosition(tmpV);
      body.current.worldToLocal(tmpV);
      const reading = rt.pose === 'read';
      tmpV.x += reading ? 0.05 : 0.02;
      tmpV.y += reading ? 0.22 : 0.05;
      tmpV.z += reading ? 0.12 : 0.1;
      paper.current.position.lerp(tmpV, 0.5);
      const rot: [number, number, number] = reading ? [-0.55, Math.PI - 0.55, 0.12] : [-0.15, Math.PI - 0.35, 0.18];
      easing.dampE(paper.current.rotation, rot, 0.25, dt);
    }
  });

  return (
    <group ref={root} position={SANTA_POS} visible={mode === 'santa'}>
      <group ref={body}>
        <mesh geometry={geo.body} material={mats.velvet} castShadow receiveShadow />
        <mesh geometry={geo.belt} material={mats.belt} castShadow />
        <mesh geometry={geo.buckle} material={mats.gold} position={[0, beltY, beltZ]} rotation={[0, 0, Math.PI / 4]} scale={[1.25, 1, 1]} castShadow />
        <primitive object={fur.trim} />
        <primitive object={fur.collar} />
        <primitive object={fur.beardLow} />
        <primitive object={fur.beardTip} />
        {[1.3, 0.95].map((y) => (
          <mesh key={y} material={mats.button} position={[-0.3, y, bodyRadius(y) * BODY_DEPTH * 0.96]} scale={[0.09, 0.09, 0.04]} castShadow>
            <sphereGeometry args={[1, 20, 14]} />
          </mesh>
        ))}
        <Brooch position={[0.52, 1.42, bodyRadius(1.42) * BODY_DEPTH * 0.86]} rotation={[-0.15, 0.55, 0.3]} scale={1.6} />

        <Arm side={-1} armRef={armR} elbowRef={elbowR} handRef={handR} mats={mats} />
        {/* Santas Liste – folgt der rechten Hand */}
        <group ref={paper}>
          <mesh geometry={paperGeo} position={[0, -0.36, 0]} castShadow>
            <meshStandardMaterial map={list} roughness={0.9} />
          </mesh>
          <mesh geometry={paperGeo} position={[0, -0.36, -0.004]} rotation-y={Math.PI} material={mats.paperBack} />
        </group>
        <Arm side={1} armRef={armL} elbowRef={elbowL} handRef={handL} mats={mats} />

        <group ref={head} position={[0, 3.02, 0.16]} scale={1.18}>
          <mesh material={mats.skin} scale={[0.92, 1, 0.96]} castShadow receiveShadow>
            <sphereGeometry args={[0.5, 48, 32]} />
          </mesh>
          <mesh material={mats.nose} position={[0, -0.04, 0.47]} scale={[1, 0.92, 1.05]} castShadow>
            <sphereGeometry args={[0.1, 28, 20]} />
          </mesh>
          {/* Augen */}
          {[
            [eyeL, lidL, 1],
            [eyeR, lidR, -1],
          ].map(([eRef, lRef, s]) => (
            <group key={s as number} position={[(s as number) * 0.165, 0.08, 0.385]}>
              <group ref={eRef as React.RefObject<THREE.Group>}>
                <mesh material={mats.eyeWhite}>
                  <sphereGeometry args={[0.074, 24, 18]} />
                </mesh>
                <mesh material={mats.iris} position={[0, 0, 0.0752]}>
                  <circleGeometry args={[0.036, 28]} />
                </mesh>
                <mesh material={mats.pupil} position={[0, 0, 0.0758]}>
                  <circleGeometry args={[0.017, 20]} />
                </mesh>
                <mesh material={mats.shine} position={[0.012, 0.013, 0.0764]}>
                  <circleGeometry args={[0.0065, 10]} />
                </mesh>
              </group>
              <mesh ref={lRef as React.RefObject<THREE.Mesh>} geometry={geo.lid} material={mats.skin} rotation-x={-0.95} />
            </group>
          ))}
          <group ref={browL}>
            <primitive object={fur.browL} />
          </group>
          <group ref={browR}>
            <primitive object={fur.browR} />
          </group>
          {/* Brille, tief auf der Nase – Santa schaut darüber */}
          {[1, -1].map((s) => (
            <group key={`g${s}`} position={[s * 0.168, -0.04, 0.54]} rotation={[-0.08, s * 0.12, 0]}>
              <mesh geometry={geo.rim} material={mats.gold} scale={[1.15, 0.78, 1]} />
              <mesh geometry={geo.lens} material={mats.lens} scale={[1.15, 0.78, 1]} />
            </group>
          ))}
          <mesh geometry={geo.bridge} material={mats.gold} />
          <mesh geometry={geo.temple(1)} material={mats.gold} />
          <mesh geometry={geo.temple(-1)} material={mats.gold} />
          {/* Haare, Schnauz, Mund, Bart */}
          <primitive object={fur.hairL} />
          <primitive object={fur.hairR} />
          <primitive object={fur.hairBack} />
          <primitive object={fur.cheekL} />
          <primitive object={fur.cheekR} />
          <mesh ref={mouth} material={mats.mouth} position={[0, -0.27, 0.475]}>
            <circleGeometry args={[0.075, 24]} />
          </mesh>
          <primitive object={fur.mustL} />
          <primitive object={fur.mustR} />
          <group ref={jaw}>
            <group position={[0, -0.22, 0.1]}>
              <primitive object={fur.beardMain} />
            </group>
          </group>
          <SantaHat position={[0, 0.27, -0.03]} rotation={[-0.12, Math.PI, 0.1]} scale={1.62} furScale={1.62} />
        </group>
      </group>
    </group>
  );
}
