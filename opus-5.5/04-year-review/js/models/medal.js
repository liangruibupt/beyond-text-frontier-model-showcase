// medal.js — title 和片尾的奖牌：一枚带凸边的圆牌（车床成形，正反面各一颗五角星），后面两条 V 字绶带
// 原点在牌子底边（立在地上），正面朝 +z
import * as THREE from 'three';
import { clay } from './clay.js';
import { rounded } from './product.js';

/** 牌子半径 · 中心高 · 星的外、内半径和厚 · 绶带宽、厚、下端（藏在牌子后面）和上端 */
export const MEDAL = { r: 0.5, y: 0.5, star: [0.24, 0.1, 0.02], ribbon: { w: 0.2, d: 0.012, from: [0.06, 0.82], to: [0.32, 1.78] } };

/** 牌身：轮廓从背面中心经凸边到正面中心（车床绕 y 轴），再转到绕 z 轴 */
function discGeometry() {
  const P = [[0, -0.035], [0.36, -0.035], [0.4, -0.05], [0.46, -0.05], [0.5, -0.02], [0.5, 0.02], [0.46, 0.05], [0.4, 0.05], [0.36, 0.035], [0, 0.035]];
  return new THREE.LatheGeometry(rounded(P, 0.012, 4), 72).rotateX(Math.PI / 2).translate(0, MEDAL.y, 0);
}
function starGeometry() {
  const [R, r, d] = MEDAL.star, pts = [];
  for (let i = 0; i < 10; i++) { const a = (Math.PI * i) / 5, k = i % 2 ? r : R; pts.push(new THREE.Vector2(k * Math.sin(a), k * Math.cos(a))); }
  return new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth: d - 0.008, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.006, bevelOffset: -0.006, bevelSegments: 2 });
}
/** 一条绶带：从 (x0, y0) 到 (x1, y1) 的扁带，上端剪一个浅三角口 */
function ribbonGeometry([x0, y0], [x1, y1]) {
  const { w, d } = MEDAL.ribbon, dir = new THREE.Vector2(x1 - x0, y1 - y0).normalize(), n = new THREE.Vector2(-dir.y, dir.x).multiplyScalar(w / 2);
  const a = new THREE.Vector2(x0, y0), b = new THREE.Vector2(x1, y1), notch = b.clone().addScaledVector(dir, -0.07);
  const shape = new THREE.Shape([a.clone().sub(n), b.clone().sub(n), notch, b.clone().add(n), a.clone().add(n)]);
  return new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: false });
}

export function buildMedalModel(pal) {
  const root = new THREE.Group(), mesh = (g, m, z = 0) => { const o = new THREE.Mesh(g, m); o.position.z = z; o.castShadow = true; root.add(o); return o; };
  const gold = clay({ color: pal.lit, emissive: pal.lit, emissiveIntensity: 0.25, metalness: 0.3, roughness: 0.35, clearcoat: 0.6 });
  mesh(discGeometry(), gold);
  const star = starGeometry().translate(0, MEDAL.y, 0), starMat = clay({ color: pal.ctaInk });
  mesh(star, starMat, 0.035 - 0.004);
  mesh(star.clone().rotateY(Math.PI), starMat, -0.035 + 0.004);
  const { from: [fx, fy], to: [tx, ty], d } = MEDAL.ribbon;
  mesh(ribbonGeometry([-fx, fy], [-tx, ty]), clay({ color: pal.accent, roughness: 0.7, side: THREE.DoubleSide }), -0.075 - d);
  mesh(ribbonGeometry([fx, fy], [tx, ty]), clay({ color: pal.ink, roughness: 0.7, side: THREE.DoubleSide }), -0.1 - d);
  return { root, gold };
}
