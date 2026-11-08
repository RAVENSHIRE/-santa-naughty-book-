import { useFrame } from '@react-three/fiber';
import { useMemo } from 'react';
import * as THREE from 'three';
import { QUALITY } from '../../config';
import { palette } from '../../theme';
import { CEIL_Y, FLOOR_Y, WALL_Z, WIN } from '../layout';
import { makeVelvet } from '../materials';
import { createCanvas, get2d, toTexture } from '../tex/canvas';
import { makeSnowMaterial } from './fire';
import { floorCanvas, nightCanvas, plasterCanvas } from './textures';

function rugTexture() {
  const c = createCanvas(512, 512);
  const g = get2d(c);
  g.fillStyle = '#4a0d10';
  g.fillRect(0, 0, 512, 512);
  g.strokeStyle = '#b08a3e';
  g.lineWidth = 10;
  g.strokeRect(26, 26, 460, 460);
  g.strokeStyle = '#1f3a24';
  g.lineWidth = 18;
  g.strokeRect(50, 50, 412, 412);
  g.strokeStyle = '#b08a3e';
  g.lineWidth = 4;
  g.strokeRect(70, 70, 372, 372);
  g.fillStyle = 'rgba(176,138,62,0.55)';
  for (let i = 0; i < 4; i++) {
    g.save();
    g.translate(256, 256);
    g.rotate((i * Math.PI) / 2);
    g.beginPath();
    g.moveTo(0, -150);
    g.quadraticCurveTo(60, -90, 0, -30);
    g.quadraticCurveTo(-60, -90, 0, -150);
    g.fill();
    g.restore();
  }
  return toTexture(c);
}

function curtainGeometry(w: number, h: number) {
  const g = new THREE.PlaneGeometry(w, h, 48, 8);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const bunch = 1 - (y + h / 2) / h; // unten stärker gerafft
    pos.setZ(i, Math.sin((x / w) * Math.PI * 9) * 0.09 * (0.6 + bunch * 0.5));
  }
  g.computeVertexNormals();
  return g;
}

export function Room() {
  const tex = useMemo(() => {
    const plaster = toTexture(plasterCanvas(), { repeat: [7, 3] });
    const floor = toTexture(floorCanvas(), { repeat: [5, 4] });
    const night = toTexture(nightCanvas());
    return { plaster, floor, night, rug: rugTexture() };
  }, []);

  const wallGeo = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(-14, FLOOR_Y);
    s.lineTo(14, FLOOR_Y);
    s.lineTo(14, CEIL_Y);
    s.lineTo(-14, CEIL_Y);
    s.closePath();
    const hole = new THREE.Path();
    hole.moveTo(WIN.x - WIN.w / 2, WIN.y0);
    hole.lineTo(WIN.x - WIN.w / 2, WIN.y1);
    hole.lineTo(WIN.x + WIN.w / 2, WIN.y1);
    hole.lineTo(WIN.x + WIN.w / 2, WIN.y0);
    hole.closePath();
    s.holes.push(hole);
    const g = new THREE.ShapeGeometry(s);
    const pos = g.attributes.position;
    const uv = g.attributes.uv;
    for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) + 14) / 28, (pos.getY(i) - FLOOR_Y) / (CEIL_Y - FLOOR_Y));
    return g;
  }, []);

  const wallMat = useMemo(() => new THREE.MeshStandardMaterial({ map: tex.plaster, color: '#c7a07c', roughness: 0.95 }), [tex]);
  const trimMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#d6c8ad', roughness: 0.7 }), []);

  return (
    <group>
      <mesh geometry={wallGeo} material={wallMat} position={[0, 0, WALL_Z]} receiveShadow />
      {/* Täferung unten */}
      <mesh position={[0, FLOOR_Y + 1.1, WALL_Z + 0.04]} receiveShadow>
        <boxGeometry args={[28, 2.2, 0.08]} />
        <meshStandardMaterial color="#5b3a24" roughness={0.75} />
      </mesh>
      <mesh position={[0, FLOOR_Y + 2.22, WALL_Z + 0.08]}>
        <boxGeometry args={[28, 0.08, 0.12]} />
        <meshStandardMaterial color="#3a2416" roughness={0.6} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, FLOOR_Y, 0]} receiveShadow>
        <planeGeometry args={[30, 26]} />
        <meshStandardMaterial map={tex.floor} color="#a07c5c" roughness={0.6} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, FLOOR_Y + 0.012, 0.5]} receiveShadow>
        <planeGeometry args={[10, 6.5]} />
        <meshStandardMaterial map={tex.rug} roughness={1} />
      </mesh>
      <mesh position={[-12, 3, -1]} rotation-y={Math.PI / 2} material={wallMat}>
        <planeGeometry args={[26, 12]} />
      </mesh>
      <mesh position={[12, 3, -1]} rotation-y={-Math.PI / 2} material={wallMat}>
        <planeGeometry args={[26, 12]} />
      </mesh>
      <Window night={tex.night} trim={trimMat} />
    </group>
  );
}

function Window({ night, trim }: { night: THREE.Texture; trim: THREE.Material }) {
  const cx = WIN.x;
  const cy = (WIN.y0 + WIN.y1) / 2;
  const h = WIN.y1 - WIN.y0;
  const snow = useMemo(() => {
    const count = QUALITY.snow;
    const box = {
      min: new THREE.Vector3(cx - WIN.w / 2 - 0.4, WIN.y0 - 0.5, WALL_Z - 2.3),
      max: new THREE.Vector3(cx + WIN.w / 2 + 0.4, WIN.y1 + 0.5, WALL_Z - 0.25),
    };
    const pos = new Float32Array(count * 3);
    const seeds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = THREE.MathUtils.lerp(box.min.x, box.max.x, Math.random());
      pos[i * 3 + 1] = THREE.MathUtils.lerp(box.min.y, box.max.y, Math.random());
      pos[i * 3 + 2] = THREE.MathUtils.lerp(box.min.z, box.max.z, Math.random());
      seeds[i] = Math.random();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
    return { geo: g, mat: makeSnowMaterial(box) };
  }, [cx]);

  const curtain = useMemo(() => curtainGeometry(1.5, h + 1.6), [h]);
  const curtainMat = useMemo(() => {
    const m = makeVelvet(palette.velvet);
    m.side = THREE.DoubleSide;
    return m;
  }, []);

  useFrame(({ clock, gl }) => {
    snow.mat.uniforms.uTime.value = clock.elapsedTime;
    snow.mat.uniforms.uPixel.value = gl.domElement.height / 900;
  });

  const t = 0.16;
  return (
    <group>
      <mesh position={[cx, cy, WALL_Z - 2.6]}>
        <planeGeometry args={[WIN.w + 3.2, h + 3]} />
        <meshBasicMaterial map={night} toneMapped={false} color="#9fb3c4" />
      </mesh>
      <points geometry={snow.geo} material={snow.mat} frustumCulled={false} />
      {/* Rahmen */}
      <mesh position={[cx, WIN.y1 + t / 2, WALL_Z + 0.02]} material={trim}>
        <boxGeometry args={[WIN.w + 2 * t, t, 0.32]} />
      </mesh>
      <mesh position={[cx, WIN.y0 - t / 2, WALL_Z + 0.1]} material={trim} receiveShadow>
        <boxGeometry args={[WIN.w + 0.5, t, 0.5]} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[cx + s * (WIN.w / 2 + t / 2), cy, WALL_Z + 0.02]} material={trim}>
          <boxGeometry args={[t, h, 0.32]} />
        </mesh>
      ))}
      {/* Sprossen */}
      <mesh position={[cx, cy, WALL_Z - 0.08]} material={trim}>
        <boxGeometry args={[0.07, h, 0.08]} />
      </mesh>
      {[1 / 3, 2 / 3].map((f) => (
        <mesh key={f} position={[cx, WIN.y0 + h * f, WALL_Z - 0.08]} material={trim}>
          <boxGeometry args={[WIN.w, 0.07, 0.08]} />
        </mesh>
      ))}
      <mesh position={[cx, cy, WALL_Z - 0.1]}>
        <planeGeometry args={[WIN.w, h]} />
        <meshPhysicalMaterial color="#a9c6d6" transparent opacity={0.1} roughness={0.05} metalness={0} depthWrite={false} />
      </mesh>
      {/* Vorhänge aus rotem Samt */}
      {[-1, 1].map((s) => (
        <mesh
          key={`c${s}`}
          geometry={curtain}
          material={curtainMat}
          position={[cx + s * (WIN.w / 2 + 0.55), cy + 0.3, WALL_Z + 0.35]}
          castShadow
          receiveShadow
        />
      ))}
      <mesh position={[cx, WIN.y1 + 1.0, WALL_Z + 0.35]} rotation-z={Math.PI / 2}>
        <cylinderGeometry args={[0.04, 0.04, WIN.w + 3.2, 10]} />
        <meshStandardMaterial color="#b8923e" metalness={1} roughness={0.35} />
      </mesh>
    </group>
  );
}
