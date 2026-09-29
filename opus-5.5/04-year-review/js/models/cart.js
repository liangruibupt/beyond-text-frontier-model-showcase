// cart.js — top 镜头的购物车：细管焊成的铁丝篮（上下两圈、竖丝、篮底格子）、四条腿和下层托架、推手和彩色握把、四个轮子
// 长边沿 x，推手在 +x；原点在地面、篮子正下方。所有管子合成一个几何体
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { clay } from './clay.js';

/** 上圈、下圈（篮底）的高度和范围 · 轮子半径 · 商品落进篮子时的落点（篮底上方） */
export const CART = { top: { y: 0.82, x: [-0.4, 0.4], z: 0.28 }, bottom: { y: 0.42, x: [-0.3, 0.36], z: 0.22 }, wheel: 0.06, handle: [0.52, 0.95], seat: [0.03, 0.435, 0] };

const Y = new THREE.Vector3(0, 1, 0);
/** a → b 的一根管子（六棱柱，半径 r） */
function rod(a, b, r) {
  const A = new THREE.Vector3(...a), d = new THREE.Vector3(...b).sub(A), g = new THREE.CylinderGeometry(r, r, d.length(), 6, 1);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(Y, d.clone().normalize()));
  return g.translate(...A.addScaledVector(d, 0.5).toArray());
}
const lerp = (a, b, k) => a + (b - a) * k;
/** 高 y 处的一圈（x、z 范围）的四个角，按顺序 */
const ring = (y, [x0, x1], z) => [[x0, y, -z], [x1, y, -z], [x1, y, z], [x0, y, z]];

export function buildCart(pal) {
  const { top: T, bottom: B } = CART, rods = [];
  const loop = (pts, r) => pts.forEach((p, i) => rods.push(rod(p, pts[(i + 1) % pts.length], r)));
  loop(ring(T.y, T.x, T.z), 0.016);
  loop(ring(B.y, B.x, B.z), 0.013);
  const mid = k => ring(lerp(B.y, T.y, k), [lerp(B.x[0], T.x[0], k), lerp(B.x[1], T.x[1], k)], lerp(B.z, T.z, k));
  loop(mid(0.5), 0.009);
  // 竖丝：长边每边 7 根，两头每头 4 根，都从下圈连到上圈
  for (let i = 0; i <= 6; i++) for (const s of [-1, 1]) rods.push(rod([lerp(B.x[0], B.x[1], i / 6), B.y, s * B.z], [lerp(T.x[0], T.x[1], i / 6), T.y, s * T.z], 0.007));
  for (let i = 1; i <= 4; i++) for (const e of [0, 1]) rods.push(rod([B.x[e], B.y, lerp(-B.z, B.z, i / 5)], [T.x[e], T.y, lerp(-T.z, T.z, i / 5)], 0.007));
  // 篮底格子
  for (let i = 1; i <= 3; i++) rods.push(rod([B.x[0], B.y, lerp(-B.z, B.z, i / 4)], [B.x[1], B.y, lerp(-B.z, B.z, i / 4)], 0.007));
  for (let i = 1; i <= 5; i++) rods.push(rod([lerp(B.x[0], B.x[1], i / 6), B.y, -B.z], [lerp(B.x[0], B.x[1], i / 6), B.y, B.z], 0.007));
  // 腿、下层托架、推手
  const foot = CART.wheel + 0.02, rack = 0.15;
  for (const x of B.x) for (const s of [-1, 1]) rods.push(rod([x, B.y, s * B.z], [x, foot, s * B.z], 0.014));
  loop(ring(rack, B.x, B.z), 0.012);
  const [hx, hy] = CART.handle;
  for (const s of [-1, 1]) rods.push(rod([T.x[1], T.y, s * T.z], [hx, hy, s * T.z], 0.015));

  const wire = new THREE.Mesh(mergeGeometries(rods), clay({ color: pal.ink, metalness: 0.3, roughness: 0.35 }));
  const grip = new THREE.Mesh(rod([hx, hy, -T.z - 0.03], [hx, hy, T.z + 0.03], 0.03), clay({ color: pal.lit }));
  const tire = clay({ color: '#2b2730', roughness: 0.7 }), wheelGeo = new THREE.CylinderGeometry(CART.wheel, CART.wheel, 0.035, 20).rotateX(Math.PI / 2);
  const root = new THREE.Group();
  root.add(wire, grip);
  for (const x of B.x) for (const s of [-1, 1]) { const w = new THREE.Mesh(wheelGeo, tire); w.position.set(x, CART.wheel, s * B.z); root.add(w); }
  root.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return root;
}
