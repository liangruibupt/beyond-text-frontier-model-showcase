// studio.js — 直播间影棚（3D 背景）：桌 + 转台（上面放商品）+ 背后虚化的环形补光灯光斑 + 「有集直播」霓虹招牌。
// 浅景深、转台转动。全部程序建模，没有素材。画面只由（变体, t）决定：update(t) 把转台转到 t，reset() = 转回 0。
// 商品模型沿用 04 的 product.js（只读引用，和 08 一样）；Node 测试里没有渲染器 / canvas 时退回纯色、不建环境贴图。
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildProduct } from '../../04-year-review/js/models/product.js';
import { clay } from '../../04-year-review/js/models/clay.js';
import { ORANGE } from '../items.js';

const HAS_DOC = typeof document !== 'undefined';
const TURN_HZ = 0.12;   // 转台每秒转的圈数（慢转，像带货展示）

/** 发光材质（霓虹招牌、灯斑） */
const glow = (c, k = 1) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: k, roughness: 0.5, toneMapped: false });

export function build(ctx, item) {
  const { scene, renderer } = ctx;
  const tint = item.sceneTint ?? '#20202a';
  scene.background = new THREE.Color(tint).multiplyScalar(0.5);

  const root = new THREE.Group();
  scene.add(root);

  // ── 灯光 ──
  const key = new THREE.DirectionalLight('#fff4e8', 2.2); key.position.set(1.4, 2.4, 1.8); key.castShadow = true;
  Object.assign(key.shadow.camera, { left: -1.5, right: 1.5, top: 1.5, bottom: -1.5, near: 0.3, far: 10 });
  key.shadow.mapSize.set(1024, 1024);
  const fill = new THREE.HemisphereLight('#bcd0ff', '#141018', 0.7);
  const rim = new THREE.PointLight(item.accent, 2.0, 6, 2); rim.position.set(-1.2, 1.4, -1.0);
  scene.add(key, fill, rim);

  // 环境反射（PMREM）：没有渲染器（Node 测试）就跳过
  if (renderer) {
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
  }

  // ── 桌面 + 转台 ──
  const deskMat = clay({ color: '#2a2630', roughness: 0.6, clearcoat: 0.2 });
  const desk = new THREE.Mesh(new RoundedBoxGeometry(2.4, 0.12, 1.2, 3, 0.03), deskMat);
  desk.position.set(0, -0.06, 0); desk.receiveShadow = true; root.add(desk);

  const turntable = new THREE.Group(); turntable.position.set(0, 0, 0); root.add(turntable);
  const platMat = clay({ color: '#3a3442', roughness: 0.4, clearcoat: 0.4 });
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.46, 0.05, 48), platMat);
  plate.position.y = 0.025; plate.receiveShadow = plate.castShadow = true; turntable.add(plate);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.43, 0.012, 10, 64).rotateX(Math.PI / 2), glow(item.accent, 1.4));
  ring.position.y = 0.052; turntable.add(ring);

  // ── 商品：放在转台中心，缩放到约 0.5 高，立在盘面上 ──
  const product = buildProduct({ kind: item.model, colors: item.colors });
  const pbox = new THREE.Box3().setFromObject(product);
  const psize = pbox.getSize(new THREE.Vector3());
  const s = 0.5 / Math.max(psize.y, 1e-3);
  product.scale.setScalar(s);
  product.position.y = 0.05;        // 盘面上
  turntable.add(product);

  // ── 背后虚化的环形补光灯光斑（bokeh）：一圈小发光片，离相机远、靠浅景深化开 ──
  const bokeh = new THREE.Group(); bokeh.position.set(0, 0.9, -1.8); root.add(bokeh);
  const bmat = glow('#ffe6c0', 0.9);
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const d = new THREE.Mesh(new THREE.CircleGeometry(0.06 + 0.03 * ((i * 7) % 3), 20), i % 2 ? bmat : glow(item.accent, 0.8));
    d.position.set(Math.cos(a) * (0.7 + 0.1 * (i % 3)), Math.sin(a) * 0.5, -0.1 * (i % 4));
    bokeh.add(d);
  }

  // ── 「有集直播」霓虹招牌：背景墙上的发光字牌。有 document 时用 CanvasTexture 画出字，读得出是招牌；
  //     Node 测试没有 canvas 时退回一块纯发光板（不报错）。 ──
  const sign = new THREE.Group(); sign.position.set(0.0, 1.3, -1.5); root.add(sign);
  let signTex = null;
  if (HAS_DOC) {
    const scv = document.createElement('canvas'); scv.width = 512; scv.height = 160;
    const sg = scv.getContext('2d');
    sg.fillStyle = '#140f1a'; sg.fillRect(0, 0, 512, 160);
    sg.font = '900 96px "Noto Sans SC", sans-serif'; sg.textAlign = 'center'; sg.textBaseline = 'middle';
    sg.shadowColor = ORANGE; sg.shadowBlur = 28; sg.fillStyle = '#ffd9a0'; sg.fillText('有集直播', 256, 84);
    sg.shadowBlur = 0; sg.strokeStyle = ORANGE; sg.lineWidth = 4; sg.strokeText('有集直播', 256, 84);
    signTex = new THREE.CanvasTexture(scv); signTex.colorSpace = THREE.SRGBColorSpace;
  }
  const signMat = signTex
    ? new THREE.MeshBasicMaterial({ map: signTex, toneMapped: false })
    : glow(ORANGE, 1.2);
  const signBoard = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.34), signMat);
  sign.add(signBoard);
  // 招牌外框光管
  const frame = new THREE.Mesh(new RoundedBoxGeometry(1.18, 0.42, 0.03, 2, 0.02), glow(item.accent, 1.6));
  frame.position.z = -0.03; sign.add(frame);

  const subjectBox = new THREE.Box3(new THREE.Vector3(-0.35, 0, -0.35), new THREE.Vector3(0.35, 0.6, 0.35));
  const subjectCenter = new THREE.Vector3(0, 0.3, 0);

  const api = {
    root, turntable, product, subjectBox, subjectCenter,
    // 泛光阈值抬到 0.9：toneMapped:false 的高强度自发光（灯斑、招牌）仍然炸开发光，而 overlay 的 UI 白字（toneMapped 后≈0.8）不被泛光糊成白团
    post: { aperture: 1.3, maxBlur: 0.014, focus: 'target', bloom: { strength: 0.5, radius: 0.6, threshold: 0.9 }, vignette: 0.3, grain: 0.03 },
    reset() { turntable.rotation.y = 0; },
    update(t) { turntable.rotation.y = t * TURN_HZ * Math.PI * 2; },
    dispose() {
      scene.remove(root, key, fill, rim);
      root.traverse(o => { o.geometry?.dispose?.(); if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose?.()); });
      signTex?.dispose?.();
      if (scene.environment) { scene.environment.dispose?.(); scene.environment = null; }
    },
  };
  return api;
}
