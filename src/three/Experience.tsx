import { Environment, Lightformer } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { captureMode, QUALITY } from '../config';
import { MrsClaus } from '../santa/MrsClaus';
import { Book } from './book/Book';
import { CameraRig } from './CameraRig';
import { Effects } from './Effects';
import { Lights } from './Lights';
import { Desk } from './props/Desk';
import { RevealDirector } from './RevealDirector';
import { Fireplace } from './room/Fireplace';
import { Room } from './room/Room';
import { setMaxAnisotropy } from './tex/canvas';
import { runtime } from './runtime';
import { useBook } from '../store';

export function Experience() {
  return (
    <Canvas
      className="scene"
      shadows="percentage"
      dpr={QUALITY.dpr}
      camera={{ fov: 40, near: 0.1, far: 60, position: [1.5, 4.4, 10.5] }}
      gl={{ antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: captureMode }}
      onCreated={({ gl, scene }) => {
        setMaxAnisotropy(gl.capabilities.getMaxAnisotropy());
        if (captureMode) Object.assign(window, { __santa: { runtime, store: useBook, scene } });
      }}
    >
      <color attach="background" args={['#0b0604']} />
      <fog attach="fog" args={['#0d0705', 13, 32]} />
      <Lights />
      <Environment resolution={256} frames={1} environmentIntensity={0.7}>
        <Lightformer form="rect" intensity={3} color="#ff9a4a" position={[-4, -0.5, -5]} scale={[4, 3, 1]} />
        <Lightformer form="rect" intensity={1.1} color="#ffe2b8" position={[0, 6, 1]} rotation-x={Math.PI / 2} scale={[10, 5, 1]} />
        <Lightformer form="rect" intensity={0.8} color="#7f9cff" position={[6, 2, -4]} rotation-y={-Math.PI / 3} scale={[3, 4, 1]} />
        <Lightformer form="ring" intensity={1.4} color="#ffb070" position={[2, 3, 5]} scale={1.5} />
      </Environment>
      <Room />
      <Fireplace />
      <Desk>
        <Book />
      </Desk>
      <MrsClaus />
      <CameraRig />
      <RevealDirector />
      <Effects />
    </Canvas>
  );
}
