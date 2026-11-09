import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { QUALITY } from '../config';
import { CANDLE_POS, FIRE_LIGHT_POS } from './layout';

const FIRE_I = 55;
const CANDLE_I = 3.2;

export function Lights() {
  const fire = useRef<THREE.PointLight>(null);
  const candle = useRef<THREE.PointLight>(null);
  const spot = useRef<THREE.SpotLight>(null);
  const santaKey = useRef<THREE.SpotLight>(null);
  const target = useMemo(() => new THREE.Object3D(), []);
  const santaTarget = useMemo(() => new THREE.Object3D(), []);

  useEffect(() => {
    if (spot.current) spot.current.target = target;
    if (santaKey.current) santaKey.current.target = santaTarget;
  }, [target, santaTarget]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const f = 0.82 + 0.09 * Math.sin(t * 7.3) + 0.06 * Math.sin(t * 13.1 + 1.3) + 0.04 * Math.sin(t * 23.7) + 0.03 * Math.sin(t * 31.1);
    if (fire.current) fire.current.intensity = FIRE_I * f;
    if (candle.current) candle.current.intensity = CANDLE_I * (0.9 + 0.06 * Math.sin(t * 11.0) + 0.05 * Math.sin(t * 17.3 + 0.4));
  });

  return (
    <>
      <hemisphereLight args={['#7d6a80', '#2f1a0c', 0.75]} />
      <pointLight ref={fire} position={FIRE_LIGHT_POS} color="#ff8436" intensity={FIRE_I} decay={2} distance={0} />
      <spotLight
        ref={spot}
        position={[-2.4, 5.4, 4.4]}
        angle={0.48}
        penumbra={0.85}
        intensity={105}
        decay={2}
        color="#ffdcb4"
        castShadow
        shadow-mapSize-width={QUALITY.shadowMapSize}
        shadow-mapSize-height={QUALITY.shadowMapSize}
        shadow-bias={-0.0002}
        shadow-normalBias={0.025}
        shadow-camera-near={2}
        shadow-camera-far={16}
      />
      <primitive object={target} position={[0, 0.45, 0]} />
      {/* weiches Führungslicht auf Santas Gesicht (wie das Fotolicht im Referenzbild) */}
      <spotLight ref={santaKey} position={[1.6, 4.4, 2.2]} angle={0.42} penumbra={1} intensity={70} decay={2} color="#ffe4c8" />
      <primitive object={santaTarget} position={[0, 2.4, -2.6]} />
      <pointLight ref={candle} position={[CANDLE_POS[0], 0.92, CANDLE_POS[2]]} color="#ffad5c" intensity={CANDLE_I} decay={2} distance={8} />
      <directionalLight position={[7, 6, -8]} intensity={0.55} color="#89a6ff" />
    </>
  );
}
