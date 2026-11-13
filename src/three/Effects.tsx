import { useFrame } from '@react-three/fiber';
import { Bloom, DepthOfField, EffectComposer, ToneMapping, Vignette } from '@react-three/postprocessing';
import { ToneMappingMode, type DepthOfFieldEffect } from 'postprocessing';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { QUALITY } from '../config';
import { runtime } from './runtime';
import { CLAUS_HEAD as SANTA_HEAD } from '../santa/MrsClaus';
import { useSanta } from '../santa/santaStore';

/** Glühen (Feuer, Gold), Tiefenunschärfe wie auf dem Foto, Vignette, Filmic-Tonemapping */
export function Effects() {
  const dof = useRef<DepthOfFieldEffect>(null);
  const focus = useMemo(() => new THREE.Vector3(), []);

  useFrame(() => {
    if (!dof.current) return;
    if (useSanta.getState().mode === 'santa') {
      focus.copy(SANTA_HEAD);
    } else {
      if (!runtime.book) return;
      focus.set(runtime.coverT > 0.5 ? 0 : 0.6, 0, runtime.rightTopZ);
      runtime.book.localToWorld(focus);
    }
    dof.current.target = focus;
  });

  if (QUALITY.dof) {
    return (
      <EffectComposer multisampling={4}>
        <Bloom mipmapBlur intensity={0.7} luminanceThreshold={0.9} luminanceSmoothing={0.3} radius={0.7} />
        <DepthOfField ref={dof} worldFocusRange={3.2} bokehScale={3} />
        <Vignette offset={0.3} darkness={0.7} />
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      </EffectComposer>
    );
  }
  return (
    <EffectComposer multisampling={0}>
      <Bloom mipmapBlur intensity={0.65} luminanceThreshold={0.9} luminanceSmoothing={0.3} radius={0.65} />
      <Vignette offset={0.3} darkness={0.7} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
    </EffectComposer>
  );
}
