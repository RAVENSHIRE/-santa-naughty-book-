import type { ThreeElements } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { palette } from '../../theme';

/** Stechpalmenblatt mit Zacken, leicht gewölbt */
export function createHollyLeafGeometry(len = 0.2, wid = 0.075) {
  const prof = (t: number) => Math.pow(Math.sin(Math.PI * Math.min(1, t)), 0.75);
  const tips = [0.2, 0.42, 0.64, 0.84];
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  let px = 0;
  let py = 0;
  for (const t of tips) {
    const x = len * t;
    const y = wid * prof(t) * 1.1;
    s.quadraticCurveTo((px + x) / 2, (py + y) / 2 - wid * 0.32, x, y);
    px = x;
    py = y;
  }
  s.quadraticCurveTo((px + len) / 2, py / 2 - wid * 0.25, len, 0);
  px = len;
  py = 0;
  for (const t of [...tips].reverse()) {
    const x = len * t;
    const y = -wid * prof(t) * 1.1;
    s.quadraticCurveTo((px + x) / 2, (py + y) / 2 + wid * 0.32, x, y);
    px = x;
    py = y;
  }
  s.quadraticCurveTo(px / 2, py / 2 + wid * 0.25, 0, 0);
  const g = new THREE.ShapeGeometry(s, 10);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const ny = y / wid;
    const z = -0.32 * wid * ny * ny + 0.22 * wid * Math.sin((x / len) * Math.PI) + 0.08 * wid * Math.sin((x / len) * 9) * ny;
    pos.setZ(i, z);
  }
  g.computeVertexNormals();
  return g;
}

export const hollyMaterial = () =>
  new THREE.MeshPhysicalMaterial({
    color: palette.holly,
    roughness: 0.32,
    clearcoat: 1,
    clearcoatRoughness: 0.25,
    side: THREE.DoubleSide,
  });

export const berryMaterial = () =>
  new THREE.MeshPhysicalMaterial({ color: palette.berry, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.1 });

/** Tannenzapfen aus spiralförmig angeordneten Schuppen */
export function Pinecone({ length = 0.16, radius = 0.05, ...props }: { length?: number; radius?: number } & ThreeElements['group']) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const N = 54;
  const { scaleGeo, coreGeo, scaleMat, coreMat } = useMemo(() => {
    const scaleGeo = new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2);
    scaleGeo.rotateX(Math.PI / 2);
    const coreGeo = new THREE.SphereGeometry(1, 16, 12);
    const scaleMat = new THREE.MeshStandardMaterial({ color: '#6b4325', roughness: 0.85 });
    const coreMat = new THREE.MeshStandardMaterial({ color: '#3b2414', roughness: 0.95 });
    return { scaleGeo, coreGeo, scaleMat, coreMat };
  }, []);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const golden = Math.PI * (3 - Math.sqrt(5));
    const o = new THREE.Object3D();
    const col = new THREE.Color();
    for (let i = 0; i < N; i++) {
      const t = i / (N - 1);
      const y = (t - 0.5) * length;
      const r = radius * Math.pow(Math.sin(Math.PI * (0.1 + 0.82 * t)), 0.7) * (1 - 0.35 * t);
      const a = i * golden;
      o.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
      const out = new THREE.Vector3(Math.cos(a), -0.75, Math.sin(a));
      o.lookAt(o.position.clone().add(out));
      const k = 0.55 + 0.45 * Math.sin(Math.PI * t);
      o.scale.set(radius * 0.62 * k, radius * 0.45 * k, radius * 0.24 * k);
      o.updateMatrix();
      mesh.setMatrixAt(i, o.matrix);
      col.setHSL(0.07, 0.45, 0.2 + 0.12 * ((i * 7) % 5) / 5);
      mesh.setColorAt(i, col);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [length, radius]);
  return (
    <group {...props}>
      <mesh geometry={coreGeo} material={coreMat} scale={[radius * 0.7, length * 0.48, radius * 0.7]} castShadow />
      <instancedMesh ref={ref} args={[scaleGeo, scaleMat, N]} castShadow />
    </group>
  );
}

/** Stechpalmen-Brosche wie auf Santas Mantel: Blätter, Beeren, zwei Zapfen */
export function Brooch(props: ThreeElements['group']) {
  const { leafGeo, leafMat, berryGeo, berryMat } = useMemo(
    () => ({
      leafGeo: createHollyLeafGeometry(0.2, 0.072),
      leafMat: hollyMaterial(),
      berryGeo: new THREE.SphereGeometry(0.026, 20, 14),
      berryMat: berryMaterial(),
    }),
    [],
  );
  const leaves: [number, number, number][] = [
    [2.2, 0.0, 0.004],
    [0.95, 0.01, 0.0],
    [-0.2, -0.01, 0.006],
    [3.5, 0.0, 0.002],
    [-1.4, 0.01, 0.003],
  ];
  return (
    <group {...props}>
      {leaves.map(([a, dz, z], i) => (
        <mesh key={i} geometry={leafGeo} material={leafMat} rotation={[0, 0, a]} position={[0, 0, z + dz]} castShadow receiveShadow />
      ))}
      <Pinecone position={[-0.05, -0.07, 0.035]} rotation={[0.2, 0.3, 2.4]} length={0.13} radius={0.04} />
      <Pinecone position={[0.07, -0.06, 0.03]} rotation={[0.1, -0.2, -2.2]} length={0.11} radius={0.034} />
      {[
        [0.0, 0.012, 0.05],
        [0.04, -0.018, 0.048],
        [-0.035, -0.022, 0.046],
        [0.012, -0.045, 0.045],
      ].map((p, i) => (
        <mesh key={i} geometry={berryGeo} material={berryMat} position={p as [number, number, number]} castShadow />
      ))}
    </group>
  );
}
