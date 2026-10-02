// worlds.js — 四款丝巾各一个场景（setup 时按 scarf 建一个）：背景、地面、光、反射环境、后期
// worlds.js — 四款丝巾各一个场景（setup 时按 scarf 建一个）：背景、地面、光、反射环境、后期
// 每个场景返回 { env, post, props, update(s), reset(), dispose() }；props 是镜头要用的东西（人台、石台、瓷瓶……）
// 目前：dunhuang 洞窟做完整；其余三款先是同一套中性影棚（占位），各自的镜头做到时再替换
import * as THREE from 'three';
import { sweep, dotTexture, softSprites, driftField, puffAtlas, keyLight } from '../../05-bubble-tea/js/worlds/common.js';
import { BUST, VASE } from '../meta.js';
import { BUST_COLLIDERS, CHEST } from './bust.js';
import { patternTexture, vaseTexture } from './scarf.js';

/** 人台：躯干 + 肩 + 颈，碰撞体和网格同一组尺寸（布料的 colliders 从这里取） */
export function bust(color = '#e9e2d6') {
  const g = new THREE.Group(), m = new THREE.MeshPhysicalMaterial({ color, roughness: 0.7, sheen: 0.3 });
  const { shoulder: sh, neck, base } = BUST, chest = CHEST;
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(sh * 0.78, sh * 0.62, chest - base, 48), m); torso.position.y = (chest + base) / 2; torso.scale.z = 0.62;
  const cap = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, sh * 2 - 0.11, 8, 24), m); cap.rotation.z = Math.PI / 2; cap.position.y = chest; cap.scale.set(1, 1, 0.7);
  const nk = new THREE.Mesh(new THREE.CylinderGeometry(neck, neck * 1.15, 0.12, 32), m); nk.position.y = chest + 0.06;
  const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, base, 16), new THREE.MeshStandardMaterial({ color: '#2a2420', metalness: 0.6, roughness: 0.4 })); stand.position.y = base / 2;
  for (const x of [torso, cap, nk]) { x.castShadow = true; x.receiveShadow = true; }
  g.add(torso, cap, nk, stand);
  return { group: g, colliders: BUST_COLLIDERS, chest };
}

// 宋锦：夜里的织房。深靛的墙，木织机（两根卷轴 + 两侧立柱），丝巾平绷在机上（y = LOOM.y，经线沿 z），
// 金色经线排在丝巾下面（没织到的部分露出来）；一道横贯的暖光（"光梭"）沿 z 推过去，织到哪里亮到哪里
export const LOOM = { y: 0.92, z0: -0.45, z1: 0.45 };
function songjin(ctx, k) {
  const { scene } = ctx, { y, z0, z1 } = LOOM, wood = new THREE.MeshStandardMaterial({ color: '#5a3a24', roughness: 0.7 });
  scene.background = new THREE.Color('#0d1222'); scene.fog = new THREE.Fog('#101628', 2, 7);
  const wall = new THREE.Mesh(sweep(['#1c2440', '#0b0f1c'], { width: 6, floor: 2.4, R: 0.8, wall: 3, z0: -1.6 }), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, side: THREE.DoubleSide }));
  wall.receiveShadow = true;
  const loom = new THREE.Group();
  const beam = z => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.18, 32), wood); m.rotation.z = Math.PI / 2; m.position.set(0, y - 0.03, z); m.castShadow = m.receiveShadow = true; loom.add(m); };
  beam(z0 - 0.06); beam(z1 + 0.06);
  for (const x of [-0.56, 0.56]) for (const z of [z0 - 0.06, z1 + 0.06]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.05, y + 0.02, 0.05), wood); p.position.set(x, (y - 0.04) / 2, z); p.castShadow = p.receiveShadow = true; loom.add(p); }
  for (const x of [-0.56, 0.56]) { const r = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, z1 - z0 + 0.2), wood); r.position.set(x, y - 0.06, 0); r.castShadow = true; loom.add(r); }
  // 经线：一张金线条纹的薄片，略低于丝巾（2 mm），没织到的地方露出来
  const wc = typeof document !== 'undefined' ? document.createElement('canvas') : null; let warpTex = null;   // Node 测试：没有 canvas，经线用纯色
  if (wc) {
    wc.width = 512; wc.height = 8; const g = wc.getContext('2d'); g.clearRect(0, 0, 512, 8);
    for (let i = 0; i < 512; i += 4) { g.fillStyle = i % 16 ? '#c9a24a' : '#e8c878'; g.fillRect(i, 0, 1.4, 8); }
    warpTex = new THREE.CanvasTexture(wc); warpTex.colorSpace = THREE.SRGBColorSpace; warpTex.anisotropy = 8;
  }
  const warp = new THREE.Mesh(new THREE.PlaneGeometry(0.9, z1 - z0 + 0.12), new THREE.MeshStandardMaterial({ map: warpTex, color: warpTex ? '#ffffff' : '#c9a24a', transparent: true, alphaTest: 0.3, metalness: 0.5, roughness: 0.35, side: THREE.DoubleSide }));
  warp.rotation.x = -Math.PI / 2; warp.position.set(0, y - 0.002, 0); warp.receiveShadow = true; loom.add(warp);
  // 光梭：一根横贯的发光细棒 + 一盏跟着走的暖点光
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 1.0, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd98a').multiplyScalar(4), toneMapped: false }));
  bar.rotation.z = Math.PI / 2;
  const glow = new THREE.PointLight('#ffcf7a', 0.7, 0.6, 2);   // 第一版 1.6 把整片机面照白、光晕压住了纹样
  loom.add(bar, glow);
  const key = keyLight('#ffe6c2', 2.2, [-1.2, 2.4, 1.2], { radius: 3, size: 1.0 });
  const rim = new THREE.DirectionalLight('#8aa4ff', 1.2); rim.position.set(1.4, 1.4, -1.8);
  scene.add(wall, loom, key, key.target, rim, new THREE.HemisphereLight('#4a5a88', '#120e0a', 0.6));
  const dust = driftField({
    geometry: new THREE.PlaneGeometry(1, 1), count: 50, seed: 62, fade: 'alpha',
    material: softSprites({ map: dotTexture(), color: '#ffe2a8', opacity: 0.4, additive: true, twinkle: 0.4 }),
    box: [-1.2, 0.4, -1.0, 1.2, 2.0, 0.8], vel: [0.008, 0.005, 0], sway: 0.02, swayHz: 0.15, size: [0.005, 0.012], spin: 0,
  });
  scene.add(dust.mesh);
  /** 光梭位置：r = 已织比例（0 在 z0 边），on = 亮度 0..1 */
  const shuttle = (r, on) => { const z = z0 + (z1 - z0) * r; bar.position.set(0, y + 0.006, z); glow.position.set(0, y + 0.08, z); bar.visible = on > 0.01; glow.intensity = 0.3 * on; bar.material.color.set('#ffd98a').multiplyScalar(1.1 * on + 0.001); };   // 用户：光梭再暗些（2.2 / 0.7 时仍盖住纹样）
  return {
    env: { base: '#0a0d18', strip: '#ffe0b0', k: 2, fill(add, B) { add(3, 6, [-10, 6, 5], B('#ffd8a0', 2.5)); add(6, 2, [6, 3, -8], B('#8aa0ff', 1)); } },
    post: { exposure: 1.1, vignette: 0.34, grain: 0.012, saturation: 1.05, lift: [0.004, 0.006, 0.014], gain: [1.02, 0.99, 0.96], bloom: { strength: 0.18, threshold: 0.88, radius: 0.4 } },
    props: { loom: { ...LOOM, group: loom }, shuttle },
    update(s) { dust.update(s.t); dust.mesh.material.uniforms.uTime.value = s.t; loom.visible = s.name === 'sj_warp' || s.name === 'sj_weave' || s.name === 'sj_lift'; },
    reset() { shuttle(0, 0); }, dispose() { warpTex?.dispose(); },
  };
}

// 青花：白瓷影棚。冷白的无缝背景（底部一抹淡青），一张浅色木案，案上一只梅瓶（车床旋出来的轮廓，白釉，尺寸见 meta.js 的 VASE）；
// 瓶身的青花是同一张缠枝莲纹理（qh_paint 里逐笔画出），丝巾在瓶口上方松开、裹着瓶身滑下去落在案上
function qinghua(ctx, k) {
  const { scene } = ctx, T = VASE.table;
  scene.background = new THREE.Color('#e9eef4'); scene.fog = new THREE.Fog('#e9eef4', 2.5, 7);
  const wall = new THREE.Mesh(sweep(['#f4f7fa', '#d6e0ea'], { width: 6, floor: 2.4, R: 0.9, wall: 3, z0: -1.6 }), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, side: THREE.DoubleSide }));
  wall.receiveShadow = true;
  const table = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.04, 0.9), new THREE.MeshStandardMaterial({ color: '#e4d8c6', roughness: 0.6 }));
  table.position.set(0, T - 0.02, 0); table.castShadow = table.receiveShadow = true;
  const legs = new THREE.Group();
  for (const x of [-0.74, 0.74]) for (const z of [-0.38, 0.38]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.04, T - 0.04, 0.04), table.material); l.position.set(x, (T - 0.04) / 2, z); l.castShadow = true; legs.add(l); }
  // 梅瓶：轮廓旋成 LatheGeometry；uv 的 v 沿轮廓（0 足、1 口），u 绕一圈——纹理只取方巾中间一圈（见 vaseUV），瓶身看到的是缠枝
  const pts = VASE.profile.map(([y, r]) => new THREE.Vector2(r, y));
  const geo = new THREE.LatheGeometry(pts, 96);
  { const p = geo.attributes.position, uv = geo.attributes.uv; for (let q = 0; q < p.count; q++) uv.setY(q, p.getY(q) / VASE.h); uv.needsUpdate = true; }   // v = 高度 / 瓶高（Lathe 默认按轮廓弧长，口沿、云肩的环带会错位）
  geo.computeVertexNormals();
  const pat = vaseTexture(), porcelain = new THREE.MeshPhysicalMaterial({ color: '#ffffff', map: pat.texture, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05, sheen: 0, side: THREE.DoubleSide });
  const vase = new THREE.Mesh(geo, porcelain); vase.position.set(VASE.x, T, VASE.z); vase.castShadow = vase.receiveShadow = true;
  const key = keyLight('#ffffff', 2.4, [-1.3, 2.4, 1.3], { radius: 4, size: 1.0 });
  const rim = new THREE.DirectionalLight('#cfe0ff', 1.0); rim.position.set(1.4, 1.6, -1.6);
  const fill = new THREE.DirectionalLight('#fff4e8', 0.5); fill.position.set(1.5, 1.0, 1.5);
  scene.add(wall, table, legs, vase, key, key.target, rim, fill, new THREE.HemisphereLight('#ffffff', '#b8c4d4', 0.7));
  return {
    env: { base: '#dfe6ee', strip: '#ffffff', k: 2.5, fill(add, B) { add(3, 6, [-10, 6, 5], B('#ffffff', 3)); add(6, 2, [6, 3, -8], B('#d8e6ff', 1.2)); } },
    post: { exposure: 1.0, vignette: 0.22, grain: 0.01, saturation: 1.0, lift: [0.004, 0.006, 0.01], gain: [0.99, 1.0, 1.02], bloom: { strength: 0.12, threshold: 0.92, radius: 0.4 } },
    props: { vase: { ...VASE, mesh: vase, setReveal: r => { vase.userData.reveal = r; pat.setReveal(r); } }, table },
    update(s) { vase.visible = table.visible = legs.visible = s.name !== 'end'; },   // 片尾只留礼盒（梅瓶会挡住它）
    reset() { vase.userData.reveal = 1; pat.setReveal(1); vase.rotation.y = 0; }, dispose() { pat.texture.dispose(); },
  };
}

const WORLDS = {
  songjin,
  qinghua,
  // 敦煌：烛光洞窟。土黄的窟壁（弯成穹顶的背景），石台，侧面一盏暖烛光，空气里浮着尘；头顶一方藻井（ceiling 镜头仰拍）
  dunhuang(ctx, k) {
    const { scene } = ctx;
    scene.background = new THREE.Color('#1b0f08'); scene.fog = new THREE.Fog('#24140a', 1.6, 6);
    const wall = new THREE.Mesh(sweep(['#6a4628', '#2e1b0e'], { width: 5, floor: 2, R: 0.8, wall: 3, z0: -1.4 }), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, side: THREE.DoubleSide }));
    wall.receiveShadow = true;
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.9, 0.5), new THREE.MeshStandardMaterial({ color: '#7a6048', roughness: 0.9 }));
    plinth.position.set(-0.6, 0.45, -0.3); plinth.castShadow = plinth.receiveShadow = true;
    // 藻井：画成和丝巾同一套纹样的天花（大一圈、更暗），丝巾在它下面铺开时纹样对上
    const ceilTex = patternTexture({ pattern: k.pattern }, 1024).texture;
    const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6), new THREE.MeshStandardMaterial({ map: ceilTex, color: '#8a7a68', roughness: 0.95 }));
    ceiling.rotation.x = Math.PI / 2; ceiling.position.set(0, 2.5, -0.1);
    const key = keyLight('#ffb062', 2.8, [-1.4, 2.2, 1.0], { radius: 3, size: 1.2 });
    const rim = new THREE.DirectionalLight('#ffd49a', 1.6); rim.position.set(1.4, 1.6, -1.8);           // 侧逆光：丝的光泽
    const up = new THREE.SpotLight('#ffc27a', 2.2, 1.6, 1.25, 1, 1.2); up.position.set(0, 1.95, 0.3); up.target.position.set(0, 2.5, -0.1);   // 往上照藻井和仰拍的丝巾：角度开大、边缘全软，不出亮斑；放在人台头顶以上
    scene.add(wall, plinth, ceiling, key, key.target, rim, up, up.target, new THREE.HemisphereLight('#6a4a30', '#160c06', 0.7));
    const dust = driftField({
      geometry: new THREE.PlaneGeometry(1, 1), count: 60, seed: 61, fade: 'alpha',
      material: softSprites({ map: dotTexture(), color: '#ffd9a0', opacity: 0.5, additive: true, twinkle: 0.4 }),
      box: [-1.2, 0.2, -1.0, 1.2, 2.2, 0.6], vel: [0.01, 0.006, 0], sway: 0.02, swayHz: 0.15, size: [0.006, 0.014], spin: 0,
    });
    scene.add(dust.mesh);
    return {
      env: { base: '#120a05', strip: '#ffd2a0', k: 2, fill(add, B) { add(3, 6, [-10, 6, 5], B('#ffb060', 3)); add(6, 2, [6, 3, -8], B('#ffcf8a', 1)); } },
      post: { exposure: 1.12, vignette: 0.32, grain: 0.015, saturation: 1.08, lift: [0.014, 0.008, 0.002], gain: [1.03, 0.98, 0.9], bloom: { strength: 0.2, threshold: 0.82, radius: 0.5 } },
      props: { plinth: { top: 0.9, c: [-0.6, 0.9, -0.3], mesh: plinth }, ceiling: { y: 2.5 } },
      update(s) { dust.update(s.t); dust.mesh.material.uniforms.uTime.value = s.t; plinth.visible = s.name === 'dh_cave'; },   // 石台只在开场：之后的镜头里它会挡人台、割画面
      reset() {}, dispose() { ceilTex.dispose(); },
    };
  },
};
// 占位影棚（songjin / qinghua / yunhe 的场景做到时替换）
function studio(ctx, k) {
  const { scene } = ctx;
  scene.background = new THREE.Color(k.palette.ink === '#1f2a44' || k.palette.ink === '#16295a' ? '#e8e4dc' : '#241820');
  const wall = new THREE.Mesh(sweep(['#d8d2c6', '#b8b0a2'], { width: 5, floor: 2, R: 0.8, wall: 3, z0: -1.4 }), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, side: THREE.DoubleSide }));
  wall.receiveShadow = true;
  const key = keyLight('#fff4e6', 2.2, [-1.2, 2.4, 1.4], { radius: 3, size: 1.2 });
  scene.add(wall, key, key.target, new THREE.HemisphereLight('#ffffff', '#806a5a', 0.6));
  return { env: {}, post: { exposure: 1, vignette: 0.2 }, props: {}, update() {}, reset() {}, dispose() {} };
}

export function buildWorld(ctx, scarf, k) { return (WORLDS[scarf] ?? (c => studio(c, k)))(ctx, k); }
