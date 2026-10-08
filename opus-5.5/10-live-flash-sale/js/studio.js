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

/** 预先模糊的软圆盘贴图（径向渐变，中心亮边缘透明）：当 bokeh / 灯牌辉光的精灵贴图，不靠真实景深就是柔的 */
function makeSoftDisc() {
  const n = 128, cv = document.createElement('canvas'); cv.width = cv.height = n;
  const g = cv.getContext('2d');
  const grd = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
  grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.35, 'rgba(255,255,255,0.75)');
  grd.addColorStop(0.7, 'rgba(255,255,255,0.2)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, n, n);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}

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

  // ── 背后的环形补光灯光斑（bokeh）：预先模糊的柔光精灵（径向渐变贴图，加色混合），不靠真实景深就有虚焦感 ──
  // 关掉 DoF 后，背景的「浅景深」感全靠这些软精灵 + 柔和背板来营造，UI 则保持清晰。
  const softTex = HAS_DOC ? makeSoftDisc() : null;
  const softMat = c => new THREE.SpriteMaterial({ map: softTex, color: c, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, depthTest: true, toneMapped: false });
  const bokeh = new THREE.Group(); bokeh.position.set(0, 0.95, -1.9); root.add(bokeh);
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2, warm = i % 2 === 0;
    const col = new THREE.Color(warm ? '#ffe6c0' : item.accent).multiplyScalar(1.4);   // > 泛光阈值 → 发光
    const m = softMat(col);
    const spr = softTex ? new THREE.Sprite(m) : new THREE.Mesh(new THREE.CircleGeometry(0.14, 16), glow(warm ? '#ffe6c0' : item.accent, 1.4));
    const r = 0.75 + 0.12 * (i % 3), sz = 0.18 + 0.1 * ((i * 7) % 3);
    spr.position.set(Math.cos(a) * r * 1.3, Math.sin(a) * r * 0.7, -0.12 * (i % 4));
    if (spr.scale) spr.scale.setScalar(sz * 2.2);
    bokeh.add(spr);
  }

  // ── 「有集直播」霓虹招牌：CanvasTexture 画出字（读得出是招牌）；背后垫一圈柔光让它像亮着的灯牌。 ──
  const sign = new THREE.Group(); sign.position.set(0.0, 1.12, -1.6); root.add(sign);
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
  const signMat = signTex ? new THREE.MeshBasicMaterial({ map: signTex, toneMapped: false }) : glow(ORANGE, 1.2);
  const signBoard = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.34), signMat);
  sign.add(signBoard);
  const frame = new THREE.Mesh(new RoundedBoxGeometry(1.18, 0.42, 0.03, 2, 0.02), glow(item.accent, 1.6));
  frame.position.z = -0.03; sign.add(frame);
  if (softTex) { const halo = new THREE.Sprite(softMat(new THREE.Color(ORANGE).multiplyScalar(1.15))); halo.scale.set(1.35, 0.5, 1); halo.position.z = -0.06; sign.add(halo); }

  const subjectBox = new THREE.Box3(new THREE.Vector3(-0.35, 0, -0.35), new THREE.Vector3(0.35, 0.6, 0.35));
  const subjectCenter = new THREE.Vector3(0, 0.3, 0);

  const api = {
    root, turntable, product, subjectBox, subjectCenter,
    // DoF 关掉（aperture 0）：plane-at-focus 仍不够清晰，所以这片不用真实景深——背景的虚焦感靠预先模糊的
    // bokeh 软精灵营造。泛光阈值抬到 1.1：UI 用 toneMapped:false 的实色（白≈1.0 < 1.1）永不发光糊团，
    // 只有自发光强度 >1.1 的 bokeh / 招牌 / 灯环炸开发光。颗粒压低，免得糊掉 3.4% 的弹幕字。
    post: { aperture: 0, maxBlur: 0, focus: 'target', bloom: { strength: 0.6, radius: 0.6, threshold: 1.1 }, vignette: 0.3, grain: 0.015 },
    reset() { turntable.rotation.y = 0; },
    update(t) { turntable.rotation.y = t * TURN_HZ * Math.PI * 2; },
    dispose() {
      scene.remove(root, key, fill, rim);
      root.traverse(o => { o.geometry?.dispose?.(); if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose?.()); });
      signTex?.dispose?.(); softTex?.dispose?.();
      if (scene.environment) { scene.environment.dispose?.(); scene.environment = null; }
    },
  };
  return api;
}
