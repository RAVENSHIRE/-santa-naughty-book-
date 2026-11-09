import type { ThreeElements } from '@react-three/fiber';
import { useMemo } from 'react';
import * as THREE from 'three';
import { QUALITY } from '../../config';
import { makeFurMaterial, makeFurMesh, makeVelvet } from '../materials';

/** Santas Mütze: roter Samt, Pelzkrempe und Bommel (Fell per Shell-Texturing) */
export function SantaHat({ furScale = 1, ...props }: ThreeElements['group'] & { furScale?: number }) {
  const res = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0.2, 0),
      new THREE.Vector3(0.03, 0.4, 0),
      new THREE.Vector3(0.14, 0.56, 0.02),
      new THREE.Vector3(0.32, 0.6, 0.05),
      new THREE.Vector3(0.47, 0.5, 0.07),
      new THREE.Vector3(0.53, 0.33, 0.08),
    ]);
    const tubular = 80;
    const radial = 28;
    const body = new THREE.TubeGeometry(curve, tubular, 1, radial, false);
    const pos = body.attributes.position;
    const c = new THREE.Vector3();
    const v = new THREE.Vector3();
    for (let i = 0; i <= tubular; i++) {
      const t = i / tubular;
      curve.getPointAt(t, c);
      const r = 0.3 * Math.pow(1 - t, 0.85) + 0.022;
      for (let j = 0; j <= radial; j++) {
        const idx = i * (radial + 1) + j;
        v.fromBufferAttribute(pos, idx).sub(c).multiplyScalar(r).add(c);
        pos.setXYZ(idx, v.x, v.y, v.z);
      }
    }
    body.computeVertexNormals();
    const tip = curve.getPointAt(1);
    const shells = QUALITY.furShells;
    const brimGeo = new THREE.TorusGeometry(0.31, 0.075, 18, 72);
    const brimMat = makeFurMaterial({ length: 0.045 / Math.sqrt(furScale), density: [340 * furScale, 80 * furScale], shells, droop: 0.25 });
    const pomGeo = new THREE.SphereGeometry(0.085, 32, 20);
    const pomMat = makeFurMaterial({ length: 0.045 / Math.sqrt(furScale), density: [110 * furScale, 55 * furScale], shells, droop: 0.3 });
    return {
      body,
      tip,
      velvet: makeVelvet(),
      brim: makeFurMesh(brimGeo, brimMat, shells),
      pom: makeFurMesh(pomGeo, pomMat, shells),
    };
  }, [furScale]);
  return (
    <group {...props}>
      <mesh geometry={res.body} material={res.velvet} castShadow receiveShadow />
      <group position={[0, 0.03, 0]} rotation-x={Math.PI / 2}>
        <primitive object={res.brim} />
      </group>
      <group position={res.tip}>
        <primitive object={res.pom} />
      </group>
    </group>
  );
}
