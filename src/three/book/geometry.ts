import * as THREE from 'three';

// Masse des Buchs (Buch-Koordinaten: Buchebene = XY, +Z zeigt zum Leser, Bund bei x = 0)
export const W = 1.28;
export const H = 1.71;
export const SEG = 24;
export const SEG_W = W / SEG;
export const LEAF_D = 0.0045;
export const BLOCK_T = 0.075;
export const COVER_T = 0.032;
export const MX = 0.05;
export const MY = 0.04;
export const WC = W + MX;
export const HC = H + 2 * MY;

/** Fasst die 6 Box-Gruppen zu 3 zusammen: 0 = Kanten, 1 = Vorderseite (+z), 2 = Rückseite (-z) */
function regroup(g: THREE.BoxGeometry) {
  const gr = g.groups.map((x) => ({ ...x }));
  g.clearGroups();
  g.addGroup(gr[0].start, gr[0].count + gr[1].count + gr[2].count + gr[3].count, 0);
  g.addGroup(gr[4].start, gr[4].count, 1);
  g.addGroup(gr[5].start, gr[5].count, 2);
}

/** Seitengeometrie mit Skinning-Gewichten für die Biegung beim Umblättern */
export function createLeafGeometry(): THREE.BoxGeometry {
  const g = new THREE.BoxGeometry(W, H, LEAF_D, SEG, 2, 1);
  g.translate(W / 2, 0, 0);
  const pos = g.attributes.position;
  const v = new THREE.Vector3();
  const skinIndex: number[] = [];
  const skinWeight: number[] = [];
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    let idx = Math.floor(v.x / SEG_W + 1e-6);
    let w = Math.min(1, Math.max(0, v.x / SEG_W - idx));
    if (idx >= SEG) {
      idx = SEG - 1;
      w = 1;
    }
    if (idx < 0) {
      idx = 0;
      w = 0;
    }
    skinIndex.push(idx, idx + 1, 0, 0);
    skinWeight.push(1 - w, w, 0, 0);
  }
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndex, 4));
  g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeight, 4));
  regroup(g);
  return g;
}

/** Starrer Buchdeckel (Scharnier bei x = 0) */
export function createCoverGeometry(): THREE.BoxGeometry {
  const g = new THREE.BoxGeometry(WC, HC, COVER_T, 1, 1, 1);
  g.translate(WC / 2, 0, 0);
  regroup(g);
  return g;
}

export interface LeafRig {
  mesh: THREE.SkinnedMesh;
  bones: THREE.Bone[];
  front: THREE.MeshStandardMaterial;
  back: THREE.MeshStandardMaterial;
  /** 0 = rechts liegend, 1 = umgeblättert (links) */
  t: number;
  from: number;
  to: number;
  start: number;
  dur: number;
  dir: number;
  sounded: boolean;
  frontKey: string;
  backKey: string;
}

export function createLeaf(
  geometry: THREE.BufferGeometry,
  edge: THREE.Material,
  blankFront: THREE.Texture,
  blankBack: THREE.Texture,
  turned: boolean,
): LeafRig {
  const bones: THREE.Bone[] = [];
  for (let i = 0; i <= SEG; i++) {
    const b = new THREE.Bone();
    b.position.x = i === 0 ? 0 : SEG_W;
    if (i > 0) bones[i - 1].add(b);
    bones.push(b);
  }
  const skeleton = new THREE.Skeleton(bones);
  const paper = { roughness: 0.93, metalness: 0 };
  const front = new THREE.MeshStandardMaterial({ ...paper, map: blankFront });
  const back = new THREE.MeshStandardMaterial({ ...paper, map: blankBack });
  const mesh = new THREE.SkinnedMesh(geometry, [edge, front, back]);
  mesh.add(bones[0]);
  mesh.bind(skeleton);
  mesh.frustumCulled = false;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  const t = turned ? 1 : 0;
  return { mesh, bones, front, back, t, from: t, to: t, start: 0, dur: 1, dir: 1, sounded: true, frontKey: '', backKey: '' };
}

export function disposeLeaf(l: LeafRig) {
  l.front.dispose();
  l.back.dispose();
  l.mesh.skeleton.dispose();
}

// Biegeprofile
export const CURL = 1.05;
export const GUTTER = 0.055;
export const GUTTER_BONES = 3;
export const curlWeights = (() => {
  const w: number[] = [0];
  let sum = 0;
  for (let i = 1; i <= SEG; i++) {
    const v = Math.sin((Math.PI * i) / (SEG + 1)) ** 1.5;
    w.push(v);
    sum += v;
  }
  return w.map((v) => v / sum);
})();
export const foldWeights = (() => {
  const w: number[] = [];
  for (let i = 0; i <= SEG; i++) w.push(i > SEG * 0.45 ? ((i - SEG * 0.45) / (SEG * 0.55)) * 0.022 : 0);
  return w;
})();

export const easeInOut = (u: number) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
export const smooth = (u: number) => u * u * (3 - 2 * u);

/** Setzt die Knochen eines Blatts für den Fortschritt t (0..1) */
export function poseLeaf(l: LeafRig) {
  const t = l.t;
  const s = Math.cos(Math.PI * t);
  const bend = Math.sin(Math.PI * t);
  const curl = bend * CURL * l.dir;
  const bones = l.bones;
  bones[0].rotation.y = -Math.PI * t - GUTTER * s;
  bones[0].rotation.x = 0;
  for (let i = 1; i < bones.length; i++) {
    let r = curl * curlWeights[i];
    if (i <= GUTTER_BONES) r += (GUTTER * s) / GUTTER_BONES;
    bones[i].rotation.y = r;
    bones[i].rotation.x = bend * foldWeights[i] * l.dir;
  }
}
