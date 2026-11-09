import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { sfx } from '../../audio';
import { QUALITY, slowmo } from '../../config';
import { loadFonts } from '../../fonts';
import { STRINGS } from '../../i18n';
import { useSanta } from '../../santa/santaStore';
import { useBook } from '../../store';
import { palette } from '../../theme';
import { makeFurMaterial, makeFurMesh, makeVelvet } from '../materials';
import { Brooch } from '../props/Holly';
import { runtime } from '../runtime';
import { createCanvas, get2d, toTexture } from '../tex/canvas';
import { drawCoverFront, velvetCanvas } from '../tex/coverArt';
import { CH, CW, drawEndpaper, parchmentBase, PH, PW, type PageData } from '../tex/pageArt';
import {
  BLOCK_T,
  COVER_T,
  createCoverGeometry,
  createLeaf,
  createLeafGeometry,
  disposeLeaf,
  easeInOut,
  H,
  HC,
  LEAF_D,
  poseLeaf,
  smooth,
  W,
  WC,
  type LeafRig,
} from './geometry';
import { PageTextureManager } from './pageTextures';
import { RevealStamp } from './RevealStamp';

interface Tween {
  t: number;
  from: number;
  to: number;
  start: number;
  dur: number;
  dir: number;
  sounded: boolean;
}

function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

/** Pelzkante entlang der drei freien Deckelkanten */
function furTrimGeometry() {
  const r = 0.07;
  const x0 = 0.08;
  const top = HC / 2;
  const bot = -HC / 2;
  const right = WC;
  const v = (x: number, y: number) => new THREE.Vector3(x, y, 0);
  const path = new THREE.CurvePath<THREE.Vector3>();
  path.add(new THREE.LineCurve3(v(x0, top), v(right - r, top)));
  path.add(new THREE.QuadraticBezierCurve3(v(right - r, top), v(right, top), v(right, top - r)));
  path.add(new THREE.LineCurve3(v(right, top - r), v(right, bot + r)));
  path.add(new THREE.QuadraticBezierCurve3(v(right, bot + r), v(right, bot), v(right - r, bot)));
  path.add(new THREE.LineCurve3(v(right - r, bot), v(x0, bot)));
  return new THREE.TubeGeometry(path, 360, 0.024, 10, false);
}

const transparentZone = () => new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false });

export function Book() {
  const guests = useBook((s) => s.guests);
  const event = useBook((s) => s.event);
  const locale = useBook((s) => s.locale);
  const [fontsReady, setFontsReady] = useState(false);

  const bookGroup = useRef<THREE.Group>(null);
  const leavesGroup = useRef<THREE.Group>(null);
  const frontCover = useRef<THREE.Group>(null);
  const spine = useRef<THREE.Mesh>(null);
  const rightBlock = useRef<THREE.Mesh>(null);
  const leftBlock = useRef<THREE.Mesh>(null);

  const leaves = useRef<LeafRig[]>([]);
  const cover = useRef<Tween>({ t: 0, from: 0, to: 0, start: 0, dur: 1.35, dir: 1, sounded: true });
  const prevPage = useRef(-1);
  const lastSound = useRef(-1);
  const readyRef = useRef(false);
  const coverReady = useRef(false);
  const fontsRef = useRef(false);

  const L = guests.length + 1;
  const pageData = useMemo<PageData>(() => ({ event, guests, s: STRINGS[locale] }), [event, guests, locale]);
  const data = useDebounced(pageData, 160);
  const dataRef = useRef(data);
  dataRef.current = data;

  useEffect(() => {
    let alive = true;
    loadFonts().then(() => {
      if (!alive) return;
      fontsRef.current = true;
      setFontsReady(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  const res = useMemo(() => {
    const tw = Math.round(PW * QUALITY.texScale);
    const th = Math.round(PH * QUALITY.texScale);
    const blankRight = toTexture(parchmentBase(tw, th, 'right'));
    const blankLeft = toTexture(parchmentBase(tw, th, 'left'));
    const edgeGold = new THREE.MeshStandardMaterial({ color: '#d9b45e', metalness: 1, roughness: 0.36 });
    const paperTop = new THREE.MeshStandardMaterial({ color: '#efe2c4', roughness: 0.95 });
    const velvetTex = toTexture(velvetCanvas(512));
    const velvetEdge = makeVelvet(palette.velvet);
    const velvetBack = makeVelvet(undefined, velvetTex);
    const frontOuter = makeVelvet(undefined, velvetTex);
    const frontInner = new THREE.MeshStandardMaterial({ color: '#16301f', roughness: 0.9 });
    const backInner = new THREE.MeshStandardMaterial({ color: '#16301f', roughness: 0.9 });
    const furGeo = furTrimGeometry();
    const furMat = makeFurMaterial({ length: 0.032, density: [780, 28], shells: QUALITY.furShells, droop: 0.12 });
    return {
      leafGeo: createLeafGeometry(),
      coverGeo: createCoverGeometry(),
      spineGeo: new THREE.BoxGeometry(COVER_T, HC, 1).translate(-COVER_T / 2, 0, 0.5),
      blockGeoR: new THREE.BoxGeometry(1, 1, 1).translate(0.5, 0, 0.5),
      blockGeoL: new THREE.BoxGeometry(1, 1, 1).translate(-0.5, 0, 0.5),
      blockMats: [edgeGold, edgeGold, edgeGold, edgeGold, paperTop, paperTop],
      edgeGold,
      blankRight,
      blankLeft,
      velvetEdge,
      velvetBack,
      frontOuter,
      frontInner,
      backInner,
      frontFur: makeFurMesh(furGeo, furMat, QUALITY.furShells),
      backFur: makeFurMesh(furGeo, furMat, QUALITY.furShells),
      zoneMat: transparentZone(),
      zoneGeo: new THREE.PlaneGeometry(WC + 0.12, HC + 0.5),
      pageMgr: new PageTextureManager(QUALITY.texScale, { right: blankRight, left: blankLeft }),
    };
  }, []);

  // Buchdeckel-Texturen (abhängig von Eventname & Sprache)
  useEffect(() => {
    if (!fontsReady) return;
    const id = setTimeout(
      () => {
        const sc = QUALITY.texScale;
        const mk = (w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void, srgb = true) => {
          const c = createCanvas(w, h);
          const ctx = get2d(c);
          ctx.scale(c.width / CW, c.height / CH);
          draw(ctx);
          return toTexture(c, { srgb });
        };
        const s = STRINGS[locale];
        const cd = { event, s };
        const pd: PageData = { event, guests: [], s };
        const color = mk(CW * sc, CH * sc, (ctx) => drawCoverFront(ctx, 'color', cd));
        const mr = mk((CW * sc) / 2, (CH * sc) / 2, (ctx) => drawCoverFront(ctx, 'mr', cd), false);
        const sheen = mk((CW * sc) / 2, (CH * sc) / 2, (ctx) => drawCoverFront(ctx, 'sheen', cd));
        const inner = mk(CW * sc * 0.75, CH * sc * 0.75, (ctx) => drawEndpaper(ctx, 'front', pd));
        const innerBack = mk(CW * sc * 0.75, CH * sc * 0.75, (ctx) => drawEndpaper(ctx, 'back', pd));

        const m = res.frontOuter;
        const old = [m.map, m.roughnessMap, m.sheenColorMap, res.frontInner.map, res.backInner.map];
        m.map = color;
        m.roughnessMap = mr;
        m.metalnessMap = mr;
        m.sheenColorMap = sheen;
        m.color.set('#ffffff');
        m.metalness = 1;
        m.roughness = 1;
        m.needsUpdate = true;
        res.frontInner.map = inner;
        res.frontInner.color.set('#ffffff');
        res.frontInner.needsUpdate = true;
        res.backInner.map = innerBack;
        res.backInner.color.set('#ffffff');
        res.backInner.needsUpdate = true;
        for (const t of old) if (t && t !== res.velvetBack.map) t.dispose();
        coverReady.current = true;
      },
      coverReady.current ? 300 : 0,
    );
    return () => clearTimeout(id);
  }, [fontsReady, event, locale, res]);

  // Blätter an Anzahl der Gäste anpassen
  useEffect(() => {
    const group = leavesGroup.current;
    if (!group) return;
    const arr = leaves.current;
    const page = useBook.getState().page;
    while (arr.length < L) {
      const i = arr.length;
      const lf = createLeaf(res.leafGeo, res.edgeGold, res.blankRight, res.blankLeft, page >= i + 2);
      arr.push(lf);
      group.add(lf.mesh);
    }
    while (arr.length > L) {
      const lf = arr.pop()!;
      group.remove(lf.mesh);
      disposeLeaf(lf);
    }
  }, [L, res]);

  useEffect(
    () => () => {
      for (const l of leaves.current) {
        l.mesh.removeFromParent();
        disposeLeaf(l);
      }
      leaves.current = [];
    },
    [],
  );

  useEffect(() => {
    runtime.book = bookGroup.current;
    return () => {
      runtime.book = null;
    };
  }, []);

  const schedule = (page: number, now: number) => {
    const items: { tw: Tween; target: number; isCover: boolean }[] = [];
    const cTarget = page >= 1 ? 1 : 0;
    if (cover.current.to !== cTarget) items.push({ tw: cover.current, target: cTarget, isCover: true });
    leaves.current.forEach((l, i) => {
      const target = page >= i + 2 ? 1 : 0;
      if (l.to !== target) items.push({ tw: l, target, isCover: false });
    });
    if (!items.length) return;
    if (items[0].target === 0) items.reverse();
    const nLeaves = items.filter((x) => !x.isCover).length;
    const stagger = nLeaves > 1 ? Math.min(0.16, 1.1 / nLeaves) : 0;
    const leafDur = nLeaves > 2 ? 0.8 : 1.05;
    let t = now;
    for (const it of items) {
      const tw = it.tw;
      tw.from = tw.t;
      tw.to = it.target;
      tw.dir = it.target > tw.t ? 1 : -1;
      tw.dur = (it.isCover ? 1.35 : leafDur) * slowmo;
      tw.start = t;
      tw.sounded = false;
      t += (it.isCover ? (it.target === 1 ? 0.55 : 0.3) : stagger) * slowmo;
    }
  };

  const rightBelow = useRef<number[]>([]);
  const leftBelow = useRef<number[]>([]);

  useFrame((state) => {
    const now = state.clock.elapsedTime;
    const st = useBook.getState();
    const arr = leaves.current;

    if (prevPage.current === -1) prevPage.current = st.page;
    else if (st.page !== prevPage.current) {
      schedule(st.page, now);
      prevPage.current = st.page;
    }

    let moving = false;
    const step = (tw: Tween, isCover: boolean) => {
      if (tw.t === tw.to && tw.sounded) return;
      moving = true;
      if (now < tw.start) return;
      if (!tw.sounded) {
        tw.sounded = true;
        if (isCover) {
          if (tw.to === 1) sfx.openBook();
          else sfx.flip();
        } else if (now - lastSound.current > 0.09) {
          lastSound.current = now;
          sfx.flip();
        }
      }
      const u = Math.min(1, (now - tw.start) / tw.dur);
      tw.t = u >= 1 ? tw.to : tw.from + (tw.to - tw.from) * easeInOut(u);
    };
    step(cover.current, true);
    for (const l of arr) step(l, false);

    // Stapelhöhen: rechts schrumpft der Block, solange das umblätternde Blatt ihn noch verdeckt,
    // links wächst er erst, wenn das Blatt dort schon darüberliegt.
    const n = arr.length;
    let sumOut = 0;
    let sumIn = 0;
    for (const l of arr) {
      sumOut += smooth(Math.min(1, l.t * 2));
      sumIn += smooth(Math.max(0, l.t * 2 - 1));
    }
    const hL = n ? (BLOCK_T * sumIn) / n : 0;
    const hR = n ? BLOCK_T * (1 - sumOut / n) : BLOCK_T;
    const rb = rightBelow.current;
    const lb = leftBelow.current;
    let acc = 0;
    for (let i = n - 1; i >= 0; i--) {
      rb[i] = acc;
      acc += 1 - arr[i].t;
    }
    const rightTop = hR + acc * LEAF_D;
    acc = 0;
    for (let i = 0; i < n; i++) {
      lb[i] = acc;
      acc += arr[i].t;
    }
    for (let i = 0; i < n; i++) {
      const l = arr[i];
      const zR = hR + rb[i] * LEAF_D + LEAF_D / 2;
      const zL = hL + lb[i] * LEAF_D + LEAF_D / 2;
      l.mesh.position.z = zR + (zL - zR) * l.t;
      poseLeaf(l);
    }
    if (rightBlock.current) {
      rightBlock.current.scale.z = Math.max(hR, 1e-4);
      rightBlock.current.visible = hR > 1e-3;
    }
    if (leftBlock.current) {
      leftBlock.current.scale.z = Math.max(hL, 1e-4);
      leftBlock.current.visible = hL > 1e-3;
    }

    const ct = cover.current.t;
    if (frontCover.current) {
      const zClosed = rightTop + COVER_T / 2 + 0.0015;
      const zOpen = -COVER_T / 2;
      frontCover.current.position.z = zClosed + (zOpen - zClosed) * smooth(ct);
      frontCover.current.rotation.y = -Math.PI * ct;
      if (spine.current) spine.current.scale.z = Math.max(frontCover.current.position.z + COVER_T / 2 + COVER_T, COVER_T);
    }
    if (bookGroup.current) bookGroup.current.position.x = -(WC / 2) * (1 - smooth(ct));
    runtime.rightTopZ = rightTop;
    runtime.coverT = ct;

    // Seitentexturen
    if (fontsRef.current) {
      const budget = readyRef.current ? (moving ? 1 : 2) : 6;
      const pending = res.pageMgr.update(st.page, arr, dataRef.current, budget);
      if (!readyRef.current && pending === 0 && coverReady.current) {
        readyRef.current = true;
        st.setReady();
      }
    }
  });

  const onZone = (side: 'left' | 'right') => (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.delta > 8) return;
    if (useSanta.getState().mode === 'santa') return;
    sfx.unlock();
    const st = useBook.getState();
    if (st.reveal.phase === 'suspense' || st.reveal.phase === 'slam') return;
    if (side === 'right') st.next();
    else st.prev();
  };
  const hover = (on: boolean) => () => {
    document.body.style.cursor = on && useSanta.getState().mode === 'book' ? 'pointer' : '';
  };

  return (
    <group ref={bookGroup}>
      <group position={[0, 0, -COVER_T / 2]}>
        <mesh geometry={res.coverGeo} material={[res.velvetEdge, res.backInner, res.velvetBack]} castShadow receiveShadow />
        <primitive object={res.backFur} />
      </group>
      <mesh ref={spine} geometry={res.spineGeo} material={res.velvetEdge} position={[0, 0, -COVER_T]} castShadow />
      <mesh
        ref={rightBlock}
        geometry={res.blockGeoR}
        material={res.blockMats}
        position={[0.004, 0, 0]}
        scale={[W - 0.008, H - 0.012, BLOCK_T]}
        castShadow
        receiveShadow
      />
      <mesh
        ref={leftBlock}
        geometry={res.blockGeoL}
        material={res.blockMats}
        position={[-0.004, 0, 0]}
        scale={[W - 0.008, H - 0.012, 0.0001]}
        castShadow
        receiveShadow
      />
      <group ref={leavesGroup} />
      <group ref={frontCover}>
        <mesh geometry={res.coverGeo} material={[res.velvetEdge, res.frontOuter, res.frontInner]} castShadow receiveShadow />
        <primitive object={res.frontFur} />
        <Brooch position={[WC * 0.83, -HC * 0.385, COVER_T / 2 + 0.014]} rotation={[0, 0, 0.4]} scale={1.2} />
      </group>
      <RevealStamp />
      <mesh
        geometry={res.zoneGeo}
        material={res.zoneMat}
        position={[WC / 2, 0, 0.13]}
        onClick={onZone('right')}
        onPointerOver={hover(true)}
        onPointerOut={hover(false)}
      />
      <mesh
        geometry={res.zoneGeo}
        material={res.zoneMat}
        position={[-WC / 2, 0, 0.13]}
        onClick={onZone('left')}
        onPointerOver={hover(true)}
        onPointerOut={hover(false)}
      />
    </group>
  );
}
