// pie.js — top 镜头：品类的环形饼块从地面下依次扫上来（按订单占比，最大的一块居中朝右前方），最大的一块滑出来，
// 最常买的那件商品在它上面弹出来，划一道弧落进购物车；购物车先从画外滚进来，接住商品时晃两下
// 每帧的状态都是 lt 的闭式函数；饼块在地面以下的部分被裁掉
import * as THREE from 'three';
import { EV } from '../meta.js';
import { ITEMS } from '../catalog.js';
import { clay } from './models/clay.js';
import { buildProduct } from './models/product.js';
import { buildCart, CART } from './models/cart.js';
import { clamp, easeInOut, easeOut, lerp, ss } from '../../factory/engine/ease.js';

/** 内外半径 · 厚 · 倒角 · 块与块的缝 · 最大一块的中线方向（从 +z 往 +x 量的角）· 滑出的距离 */
export const PIE = { r: [0.42, 1.0], h: 0.24, bevel: 0.03, gap: 0.04, mid: Math.PI / 6, slide: 0.22 };
export const SWEEP = 0.35;                                            // 一块扫上来用的秒数
/** 商品：缩放 · 弹出的时段 · 飞行的弧高 · 朝向（绕竖轴；0 是正面朝 +z，和篮子对齐，镜头也差不多在正前方） */
export const PRODUCT = { scale: 0.7, pop: [0.95, 1.2], hop: 0.42, yaw: 0 };
/** 购物车：停在 x · 从 x 滚进来 · 滚进来的时段 */
export const CART_AT = { x: 2.0, from: 5.5, roll: [0.4, 1.1] };
/** k 块里第 i 块开始扫上来的时刻：第一块在 EV.sweep[0]，最后一块在 EV.sweep[1] 扫完 */
export const sweepAt = (i, k) => EV.sweep[0] + ((EV.sweep[1] - EV.sweep[0] - SWEEP) * i) / Math.max(1, k - 1);

/** 占比（大到小）→ 每块的起止角（弧度）：最大的一块居中在 PIE.mid，其余顺着往后排 */
export function sliceAngles(shares) {
  const tot = shares.reduce((a, b) => a + b, 0);
  let a = PIE.mid - (Math.PI * shares[0]) / tot;
  return shares.map(s => { const a0 = a; a += (2 * Math.PI * s) / tot; return [a0, a]; });
}
/** 角 θ、半径 r 的地面点：x = r·sinθ，z = r·cosθ */
export const onFloor = (th, r) => [Math.sin(th) * r, Math.cos(th) * r];

/** 一块环形饼块：挤出、四周倒圆角，底面在 y = 0、顶面在 y = PIE.h。窄的块倒角跟着变小，不会自交 */
function sliceGeometry([a0, a1]) {
  const [r0, r1] = PIE.r, g = PIE.gap / 2, b = Math.min(PIE.bevel, 0.25 * ((a1 - a0) * r0 - PIE.gap)), pts = [];
  const arc = (r, from, to) => {
    const n = Math.max(4, Math.ceil(Math.abs(to - from) * 40));
    for (let i = 0; i <= n; i++) { const [x, z] = onFloor(from + ((to - from) * i) / n, r); pts.push(new THREE.Vector2(x, -z)); }   // 形状的 y 转过去是 −z
  };
  arc(r1, a0 + g / r1, a1 - g / r1);
  arc(r0, a1 - g / r0, a0 + g / r0);
  const geo = new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth: PIE.h - 2 * b, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelOffset: -b, bevelSegments: 3, curveSegments: 1 });
  return geo.translate(0, 0, b).rotateX(-Math.PI / 2);
}

const easeOutBack = k => { k = clamp(k); const c = 1.70158; return 1 + (c + 1) * (k - 1) ** 3 + c * (k - 1) ** 2; };

/** categories：statsOf 的品类（多到少），item：最常买的那件。返回 { root, slices, pose(lt) } */
export function buildTop({ categories, item, pal }) {
  const root = new THREE.Group(), floorClip = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), k = categories.length;
  const slices = sliceAngles(categories.map(c => c.share)).map((ang, i) => {
    const mat = i === 0 ? clay({ color: pal.lit, emissive: pal.lit, emissiveIntensity: 0 }) : clay({ color: pal.pie[(i - 1) % pal.pie.length] });
    Object.assign(mat, { clippingPlanes: [floorClip], clipShadows: true });
    const mesh = new THREE.Mesh(sliceGeometry(ang), mat);
    mesh.castShadow = mesh.receiveShadow = true;
    root.add(mesh);
    return { mesh, angles: ang, mid: (ang[0] + ang[1]) / 2 };
  });
  const cart = buildCart(pal), product = buildProduct(ITEMS[item]);
  product.scale.setScalar(PRODUCT.scale);
  root.add(cart, product);
  const seat = new THREE.Vector3(), rz = new THREE.Euler();

  return {
    root, slices, cart, product,
    pose(lt) {
      const out = PIE.slide * easeInOut((lt - EV.slide[0]) / (EV.slide[1] - EV.slide[0]));
      slices.forEach((s, i) => {
        const up = easeOut((lt - sweepAt(i, k)) / SWEEP), d = i === 0 ? out : 0, [x, z] = onFloor(s.mid, d);
        s.mesh.position.set(x, -(PIE.h + 0.02) * (1 - up), z);
      });
      slices[0].mesh.material.emissiveIntensity = 0.35 * ss(EV.slide[0], EV.slide[1], lt);

      const dt = lt - EV.cart, jig = dt > 0 ? 0.05 * Math.exp(-5 * dt) * Math.sin(2 * Math.PI * 3 * dt) : 0;
      cart.position.set(lerp(CART_AT.from, CART_AT.x, easeOut(inv(CART_AT.roll, lt))), 0, 0);
      cart.rotation.z = jig;

      // 商品：在滑出的那块上弹出来 → 一道弧飞进篮子（落点按停好的购物车算）→ 在篮子里弹两下，跟着车晃
      product.visible = lt >= PRODUCT.pop[0];
      const [ax, az] = onFloor(slices[0].mid, (PIE.r[0] + PIE.r[1]) / 2 + out), A = [ax, PIE.h, az];
      const B = [CART_AT.x + CART.seat[0], CART.seat[1], CART.seat[2]];
      if (lt < PRODUCT.pop[1]) {
        product.position.set(...A); product.rotation.set(0, PRODUCT.yaw, 0);
        product.scale.setScalar(PRODUCT.scale * Math.max(1e-4, easeOutBack(inv(PRODUCT.pop, lt))));
      } else if (lt < EV.cart) {
        const t = inv([PRODUCT.pop[1], EV.cart], lt);
        product.position.set(lerp(A[0], B[0], t), lerp(A[1], B[1], t) + PRODUCT.hop * 4 * t * (1 - t), lerp(A[2], B[2], t));
        product.rotation.set(0, PRODUCT.yaw + 2 * Math.PI * t, 0); product.scale.setScalar(PRODUCT.scale);
      } else {
        const bounce = 0.07 * Math.exp(-7 * dt) * Math.abs(Math.sin((Math.PI * dt) / 0.15));
        seat.set(CART.seat[0], CART.seat[1] + bounce, CART.seat[2]).applyEuler(rz.set(0, 0, jig)).add(cart.position);
        product.position.copy(seat); product.rotation.set(0, PRODUCT.yaw, jig, 'ZYX'); product.scale.setScalar(PRODUCT.scale);
      }
    },
  };
}
const inv = ([a, b], x) => clamp((x - a) / (b - a));
