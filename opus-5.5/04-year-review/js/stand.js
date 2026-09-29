// stand.js — 1111 片尾：推荐的商品（story.pick）立在一个矮转台上慢慢转，转台边上一圈亮边。转角是 lt 的闭式函数
import * as THREE from 'three';
import { ITEMS } from '../catalog.js';
import { clay } from './models/clay.js';
import { buildProduct, rounded } from './models/product.js';

/** 转台半径、高 · 商品的起始朝向和每秒转的弧度 */
export const STAND = { r: 0.62, h: 0.1, yaw: -0.9, spin: 0.65 };

export function buildStand({ item, pal }) {
  const { r, h } = STAND, root = new THREE.Group();
  const P = [[0, 0], [r - 0.02, 0], [r, 0.02], [r, h - 0.02], [r - 0.02, h], [0, h]];
  const table = new THREE.Mesh(new THREE.LatheGeometry(rounded(P, 0.01, 3), 72), clay({ color: pal.base }));
  const rim = new THREE.Mesh(new THREE.TorusGeometry(r + 0.004, 0.012, 8, 96).rotateX(Math.PI / 2), clay({ color: pal.lit, emissive: pal.lit, emissiveIntensity: 0.8 }));
  rim.position.y = h / 2;
  const product = buildProduct(ITEMS[item]);
  product.position.y = h;
  table.castShadow = table.receiveShadow = true;
  root.add(table, rim, product);
  return { root, product, pose(lt) { product.rotation.y = STAND.yaw + STAND.spin * lt; } };
}
