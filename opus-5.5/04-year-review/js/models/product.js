// product.js — 有集的五种商品外形（程序建模，没有素材）：立袋 pouch、盒 box、软包 pack、罐 can、瓶 bottle
// 原点在底面中心，正面朝 +z，高 0.6–0.9，宽不过 0.85；颜色取 catalog.js 的 [主体, 标签, 点缀]
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { ParametricGeometry } from 'three/addons/geometries/ParametricGeometry.js';
import { clay } from './clay.js';

/** 折线（轮廓，r 向外、y 向上，从底到顶）的每个中间拐点换成二次贝塞尔圆角，圆角两边各不超过边长一半 */
export function rounded(pts, r, n = 6) {
  const out = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const [a, b, c] = [pts[i - 1], pts[i], pts[i + 1]], da = Math.hypot(a[0] - b[0], a[1] - b[1]), dc = Math.hypot(c[0] - b[0], c[1] - b[1]);
    const P = [0, 1].map(k => b[k] + ((a[k] - b[k]) * Math.min(r, da / 2)) / da), Q = [0, 1].map(k => b[k] + ((c[k] - b[k]) * Math.min(r, dc / 2)) / dc);
    for (let j = 0; j <= n; j++) { const t = j / n; out.push([0, 1].map(k => (1 - t) ** 2 * P[k] + 2 * (1 - t) * t * b[k] + t * t * Q[k])); }
  }
  out.push(pts[pts.length - 1]);
  return out.map(([x, y]) => new THREE.Vector2(x, y));
}
const lathe = (pts, r, seg = 48) => new THREE.LatheGeometry(rounded(pts, r), seg);
/** 竖直的圆柱面，没有顶和底：标签、色带 */
const band = (radius, y0, y1) => new THREE.CylinderGeometry(radius, radius, y1 - y0, 48, 1, true).translate(0, (y0 + y1) / 2, 0);
/** 朝 +z 的圆片 */
const disc = (r, t = 0.012) => new THREE.CylinderGeometry(r, r, t, 32).rotateX(Math.PI / 2);
const rbox = (w, h, d, r, seg = 2) => new RoundedBoxGeometry(w, h, d, seg, r);

function mesh(geo, mat, at = [0, 0, 0]) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(...at); m.castShadow = true;
  return m;
}

// ── 立袋：横截面是超椭圆（p = 3，方中带圆），底部撑开的折边最厚，往上收成扁平的封口 ──
const POUCH = { h: 0.85, a: 0.3, b: 0.15, p: 3 };
const sgnPow = (x, e) => Math.sign(x) * Math.abs(x) ** e;
/** 高度比例 v 处的半宽、半厚 */
const pouchAB = v => [POUCH.a - 0.03 * Math.max(0, 1 - v / 0.12) ** 2, 0.006 + POUCH.b * Math.cos((Math.PI / 2) * v ** 1.2) ** 1.5];
/** 袋身在 v ∈ [v0, v1] 的一段，向外偏 d；接缝在背面正中 */
function pouchSkin(v0, v1, d = 0) {
  return new ParametricGeometry((u, s, out) => {
    const v = v0 + (v1 - v0) * s, [a, b] = pouchAB(v), th = Math.PI + 2 * Math.PI * u, e = 2 / POUCH.p;
    out.set((a + d) * sgnPow(Math.sin(th), e), POUCH.h * v, (b + d) * sgnPow(Math.cos(th), e));
  }, 64, Math.max(4, Math.round(40 * (v1 - v0))));
}
function pouchBottom() {
  const [a, b] = pouchAB(0), e = 2 / POUCH.p, pts = [];
  for (let i = 0; i < 64; i++) { const th = (2 * Math.PI * i) / 64; pts.push(new THREE.Vector2(a * sgnPow(Math.sin(th), e), b * sgnPow(Math.cos(th), e))); }
  return new THREE.ShapeGeometry(new THREE.Shape(pts)).rotateX(Math.PI / 2);   // 形状的 (x, y) → (x, 0, y)，法线朝下
}

// ── 软包：圆角盒子往外鼓，像一包纸巾、一包纸尿裤；标签是绕一圈的腰封 ──
const PACK = { w: 0.8, h: 0.6, d: 0.42 };
/** 按软包的半尺寸往外鼓（前后鼓得多，左右鼓得少）；腰封用同一个函数，贴着袋身 */
function bulge(geo) {
  const P = geo.attributes.position, hx = PACK.w / 2, hy = PACK.h / 2, hz = PACK.d / 2;
  for (let i = 0; i < P.count; i++) {
    const x = P.getX(i), y = P.getY(i), z = P.getZ(i), f = q => Math.max(0, 1 - q * q);
    P.setXYZ(i, x * (1 + 0.04 * f(y / hy) * f(z / hz)), y, z * (1 + 0.12 * f(x / hx) * f(y / hy)));
  }
  return geo.translate(0, hy, 0);
}

const BUILD = {
  pouch(M) {
    return [
      mesh(pouchSkin(0, 1), M.main), mesh(pouchBottom(), M.main),
      mesh(pouchSkin(0.28, 0.62, 0.004), M.label), mesh(pouchSkin(0.66, 0.71, 0.004), M.accent),
      mesh(rbox(0.62, 0.07, 0.03, 0.01), M.seal, [0, POUCH.h, 0]),
    ];
  },
  box(M) {
    return [
      mesh(rbox(0.62, 0.86, 0.3, 0.035, 3), M.main, [0, 0.43, 0]),
      mesh(rbox(0.63, 0.07, 0.31, 0.02), M.accent, [0, 0.72, 0]),
      ...[1, -1].flatMap(side => [
        mesh(rbox(0.5, 0.4, 0.012, 0.005), M.label, [0, 0.38, side * 0.15]),
        mesh(disc(0.06).rotateY(side > 0 ? 0 : Math.PI), M.accent, [0, 0.46, side * 0.157]),
        mesh(rbox(0.3, 0.035, 0.01, 0.004), M.main, [0, 0.32, side * 0.157]),
      ]),
    ];
  },
  pack(M) {
    const r = 0.12;
    return [
      mesh(bulge(rbox(PACK.w, PACK.h, PACK.d, r, 4)), M.main),
      mesh(bulge(rbox(PACK.w + 0.01, 0.28, PACK.d + 0.01, r, 4)), M.label),
      mesh(disc(0.08), M.accent, [0, PACK.h / 2, (PACK.d / 2 + 0.005) * 1.12 + 0.004]),
    ];
  },
  can(M) {
    return [
      mesh(lathe([[0, 0], [0.26, 0], [0.3, 0.05], [0.3, 0.72], [0.26, 0.77], [0, 0.77]], 0.02), M.main),
      mesh(new THREE.TorusGeometry(0.255, 0.012, 8, 48).rotateX(Math.PI / 2), M.metal, [0, 0.78, 0]),
      mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.01, 48), M.metal, [0, 0.772, 0]),
      mesh(band(0.302, 0.2, 0.6), M.label), mesh(band(0.304, 0.62, 0.66), M.accent),
    ];
  },
  bottle(M) {
    return [
      mesh(lathe([[0, 0], [0.2, 0], [0.24, 0.03], [0.24, 0.46], [0.2, 0.56], [0.12, 0.64], [0.095, 0.68], [0.095, 0.78], [0, 0.78]], 0.03), M.main),
      mesh(lathe([[0, 0.77], [0.105, 0.77], [0.108, 0.86], [0.09, 0.88], [0, 0.88]], 0.015, 32), M.accent),
      mesh(band(0.242, 0.14, 0.42), M.label),
    ];
  },
};
export const KIND_NAMES = Object.keys(BUILD);

/** item 是 catalog.js 的一条；返回商品的 Group（原点在底面中心），材质按件新建 */
export function buildProduct(item) {
  const [main, label, accent] = item.colors;
  const M = {
    main: clay({ color: main }), label: clay({ color: label, roughness: 0.6 }), accent: clay({ color: accent }),
    seal: clay({ color: new THREE.Color(main).lerp(new THREE.Color('#000000'), 0.15) }),
    metal: new THREE.MeshPhysicalMaterial({ color: '#c9ccd1', metalness: 0.8, roughness: 0.28 }),
  };
  const g = new THREE.Group();
  g.add(...BUILD[item.kind](M));
  return g;
}
