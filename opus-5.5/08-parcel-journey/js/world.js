// world.js — 一镜到底的世界：八个工位沿对角线依次摆开（手机 → 仓库 → 打包台 → 分拣线 → 月台 → 公路 → 街区 → 门口）
// v2 画质重做：倒角圆边（RoundedBox）、车削 / 拉伸件、程序画布贴图、PMREM 环境反射、高棚灯 + 假体积光柱 + 接触阴影、
// 真实比例的 Kiva 式 AGV / 打包线 / 交叉带分拣 / 厢式货车 / 正常比例快递员。贴地的写实运镜在 meta.js。
// 三段地面接成一整条：帐篷（夜里的露营）→ 仓库（水泥地 + 后墙货架 + 高窗）→ 室外（草地 / 马路 / 人行道 / 街边房子 / 路灯 / 树 + 天幕）。
// 全部程序建模，三件商品共用一套部件，靠换颜色和排列区别。所有状态都是故事时间 t 的闭式（AGV 群走规划好的表），
// 所以 update(t) 本身就是复位：reset() = 摆回 t=0；dispose() 释放资源。贴图在 build 一次性建好、不随帧变（Node 测试里没有 canvas 时退回纯色）。
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { clay } from '../../04-year-review/js/models/clay.js';
import { buildProduct } from '../../04-year-review/js/models/product.js';
import { clamp, lerp, ss, easeInOut, easeOut } from '../../factory/engine/ease.js';
import { STATIONS, EV, LANE, lane, S_OF, MOTION, STORY0, NATURAL } from '../meta.js';
import { agvAt, cellToWorld, GRID_W, GRID_H, PICK, COUNT, STEPS, STEP } from './crowd.js';
import { mulberry32, seedOf } from '../../factory/engine/rng.js';
import * as TX from './textures.js';

const CELL = 0.1;                               // 仓库网格一格的世界尺寸（米）
const ORANGE = '#f0820f';                       // 有集橙
const TH = LANE.theta;                          // 沿对角线摆放的件绕 y 转的角（本地 +x = 沿路往前，+z = 朝相机）

// 故事时间 t 里某个镜头的本地秒（夹在镜头的天然时长里）
const localT = (name, t) => clamp(t - STORY0[name], 0, NATURAL[name]);

const mat = (c, o = {}) => clay({ color: c, clearcoat: 0, roughness: 0.7, ...o });   // 默认不要 04 黏土那层清漆（玩具感的来源之一），要亮面的件自己写 clearcoat
const glow = (c, k = 1) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: k, roughness: 0.6 });
/** 给材质贴上程序贴图（Node 里 tex 为 null 就退回纯色，不报错）。可同时当粗糙度图用。 */
const withTex = (m, tex, { rough = false } = {}) => { if (tex) { m.map = tex; m.color.set('#ffffff');   // 贴图本身已带底色：再乘一次同色会把颜色平方（纸箱变橙块的原因）
    if (rough) m.roughnessMap = tex; m.needsUpdate = true; } return m; };
const box = (w, h, d, m, at = [0, 0, 0]) => { const g = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); g.position.set(...at); g.castShadow = g.receiveShadow = true; return g; };
/** 倒角方块（RoundedBox）：真实物件的圆边。r 自动夹在最小半边长内。 */
const rbox = (w, h, d, m, at = [0, 0, 0], r = 0.01) => { const rr = Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3); const g = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, Math.max(0.002, rr)), m); g.position.set(...at); g.castShadow = g.receiveShadow = true; return g; };
const cyl = (r0, r1, h, m, at = [0, 0, 0], seg = 10) => { const g = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, seg), m); g.position.set(...at); g.castShadow = g.receiveShadow = true; return g; };
/** 车削件：绕 y 轴旋成的回转体（轮胎、滚筒、杯、灯罩）。pts 是 [r, y] 轮廓点。 */
const lathe = (pts, m, at = [0, 0, 0], seg = 16) => { const g = new THREE.Mesh(new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg), m); g.position.set(...at); g.castShadow = g.receiveShadow = true; return g; };
/** 拉伸件：2D 轮廓（[x,y] 点）沿 z 拉伸 depth（货架立柱、门框线脚、路牌）。 */
const extrude = (poly, depth, m, at = [0, 0, 0]) => { const sh = new THREE.Shape(poly.map(([x, y]) => new THREE.Vector2(x, y))); const g = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 1 }), m); g.position.set(...at); g.castShadow = g.receiveShadow = true; return g; };
/** 接触阴影：物件底下一块朝上的柔和暗斑贴片（便宜地伪造 AO / 软阴影） */
const contactShadow = (r, m, at = [0, 0, 0]) => { const g = new THREE.Mesh(new THREE.CircleGeometry(r, 20), m); g.rotation.x = -Math.PI / 2; g.position.set(at[0], (at[1] || 0) + 0.002, at[2]); return g; };
/** 沿对角线的一块地：s∈[s0,s1]、q∈[q0,q1]，顶面在 y */
function laneSlab(s0, s1, q0, q1, m, y = 0, th = 0.02) {
  const g = new THREE.Mesh(new THREE.BoxGeometry(s1 - s0, th, q1 - q0), m);
  g.position.set(...lane((s0 + s1) / 2, (q0 + q1) / 2, y - th / 2)); g.rotation.y = TH; g.receiveShadow = true; return g;
}
/** 放到 lane 坐标 (s, q) 上、沿路摆的组 */
function laneGroup(s, q, y = 0) { const g = new THREE.Group(); g.position.set(...lane(s, q, y)); g.rotation.y = TH; return g; }
/** 把一个工位组摆到它的世界坐标、沿路转好 */
function atStation(k) { const g = new THREE.Group(); g.position.set(...STATIONS[k]); g.rotation.y = TH; return g; }

// ── 写实部件 ──
/** 一台 Kiva 式 AGV：倒角矮方底盘（激光雷达顶盖 + 状态灯带）顶着一个「货架 pod」（四面布格子收纳箱） */
function buildAgv(m) {
  const g = new THREE.Group();
  const chassis = rbox(0.082, 0.03, 0.092, m.agv, [0, 0.018, 0], 0.012); g.add(chassis);
  g.add(box(0.086, 0.004, 0.096, m.band, [0, 0.033, 0]));                             // 状态灯带
  g.add(cyl(0.012, 0.012, 0.008, m.dark, [0, 0.038, 0.028], 10));                      // 激光雷达顶盖
  // 货架 pod：真 Kiva 的货架比机器人高好几倍——四根深色立柱 + 四层隔板 + 每层四面都插着布收纳箱（贯穿的长箱一次露出前后 / 左右两面）
  const pod = new THREE.Group(); pod.position.y = 0.036;
  const PW = 0.084, PH = 0.17, rows = 4, rh = PH / rows, bins = [];
  pod.add(box(PW - 0.012, PH - 0.01, PW - 0.012, m.dark, [0, PH / 2, 0]));             // 内芯（箱缝里露出的暗部）
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) pod.add(box(0.005, PH, 0.005, m.rack, [x * PW / 2, PH / 2, z * PW / 2]));
  for (let r = 0; r <= rows; r++) pod.add(box(PW + 0.002, 0.003, PW + 0.002, m.rack, [0, r * rh, 0]));
  for (let r = 0; r < rows; r++) for (const sx of [-0.021, 0.021]) {
    const k = (r * 3 + (sx > 0 ? 1 : 0)) % 4, y = r * rh + rh / 2 + 0.001;
    const a = rbox(0.038, rh - 0.006, PW - 0.004, m.rackBox[k], [sx, y, 0], 0.003); pod.add(a); bins.push(a);
    const b = rbox(PW - 0.004, rh - 0.006, 0.038, m.rackBox[(k + 2) % 4], [0, y, sx], 0.003); pod.add(b); bins.push(b);
  }
  pod.userData.bins = bins;
  g.add(pod); g.userData.pod = pod;
  return g;
}
/** 一只纸箱（商品的包裹）：盖子四片，可按角度折起；面单藏着，命中点弹出 */
export function buildParcel(size, m) {
  const [w, h, d] = size, g = new THREE.Group();
  g.add(box(w, h, d, m.box, [0, h / 2, 0]));
  const t = 0.006;
  // 盖片沿箱口的四条边往外摊平（rotation 0 = 敞开）；closeParcel 把它们翻过来盖上：先两片长的，再两片短的（短的垫高一点叠在上面）
  const flap = (sx, sz, px, pz, axis) => {
    const piv = new THREE.Group(); piv.position.set(px, h + (axis === 'z' ? t * 1.2 : 0), pz);
    piv.add(box(sx, t, sz, m.box, [axis === 'x' ? Math.sign(px) * sx / 2 : 0, 0, axis === 'z' ? Math.sign(pz) * sz / 2 : 0]));
    g.add(piv); return piv;
  };
  g.userData.flaps = [flap(w / 2, d, -w / 2, 0, 'x'), flap(w / 2, d, w / 2, 0, 'x'), flap(w, d / 2, 0, -d / 2, 'z'), flap(w, d / 2, 0, d / 2, 'z')];
  const tape = box(w * 1.004, 0.004, d * 0.16, m.tape, [0, h + t * 2.2, 0]); g.add(tape); g.userData.tape = tape;   // 封箱胶带
  const label = box(w * 0.5, 0.004, d * 0.4, m.label, [0, h + t * 2.4, d * 0.2]); label.visible = false;
  g.add(label); g.userData.label = label;
  closeParcel(g, 1);
  return g;
}
/** 盖片合上的程度 k（0 = 敞开、略微竖起；1 = 全盖上）；四片错开先后，胶带在全盖上以后才有 */
export function closeParcel(g, k, stagger = 0) {
  const [a, b, c, d] = g.userData.flaps, open = 0.38;                            // 敞开时也竖起 0.38·π，像刚折好的箱子
  const at = i => (stagger ? easeInOut(clamp((k - i * stagger) / (1 - 3 * stagger))) : k);
  const ang = i => Math.PI * (open + (1 - open) * at(i));
  a.rotation.set(0, 0, -ang(0)); b.rotation.set(0, 0, ang(1));
  c.rotation.set(ang(2), 0, 0); d.rotation.set(-ang(3), 0, 0);
  g.userData.tape.visible = k >= 1;
}
/** 正常比例的快递员：圆润低模（倒角身躯 + 头 + 头盔 + 工服 + 手套），两腿两臂各绕肩 / 胯转，手里可以抱一只小箱。
 *  总高约 0.46（之后在世界里再 scale 0.78 到比门矮一截）。保留 userData.limbs / carry 给 updateCourier。 */
export function buildCourier(m) {
  const g = new THREE.Group();
  g.add(rbox(0.082, 0.15, 0.056, m.courier, [0, 0.235, 0], 0.022));                   // 躯干（工服）
  g.add(box(0.088, 0.02, 0.06, m.labelOrange, [0, 0.19, 0]));                          // 腰线反光带
  g.add(rbox(0.052, 0.056, 0.052, m.skin, [0, 0.338, 0], 0.02));                       // 头
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.034, 14, 10, 0, Math.PI * 2, 0, Math.PI / 1.7), m.helmet); helmet.position.set(0, 0.352, 0); helmet.castShadow = true; g.add(helmet);
  g.add(box(0.036, 0.01, 0.012, m.helmet, [0, 0.34, 0.03]));                           // 帽檐
  const limb = (w, h, mm, x, y, hand) => {                                             // 圆柱肢体 + 末端一个小球（手 / 脚）
    const piv = new THREE.Group(); piv.position.set(x, y, 0);
    piv.add(cyl(w, w * 0.85, h, mm, [0, -h / 2, 0], 8));
    const e = new THREE.Mesh(new THREE.SphereGeometry(w * 1.05, 8, 6), hand); e.position.y = -h; e.castShadow = true; piv.add(e);
    g.add(piv); return piv;
  };
  const legL = limb(0.02, 0.17, m.dark, -0.022, 0.17, m.dark), legR = limb(0.02, 0.17, m.dark, 0.022, 0.17, m.dark);
  const armL = limb(0.015, 0.13, m.courier, -0.052, 0.3, m.glove), armR = limb(0.015, 0.13, m.courier, 0.052, 0.3, m.glove);
  const carry = rbox(0.085, 0.075, 0.075, m.box, [0, 0.235, 0.07], 0.008); g.add(carry);
  g.userData.limbs = { legL, legR, armL, armR }; g.userData.carry = carry;
  return g;
}
/** 电动三轮：车头（含前灯 / 车把 / 挡风）+ 座 + 后面的橙色货厢（厢里的小箱随交接显示），车削轮胎带轮毂 */
function buildTrike(m) {
  const g = new THREE.Group();
  g.add(rbox(0.17, 0.13, 0.16, m.agv, [-0.06, 0.11, 0], 0.015));                        // 货厢
  g.add(box(0.055, 0.012, 0.055, m.labelOrange, [-0.06, 0.178, 0.03]));                 // 厢上的有集标
  g.add(rbox(0.11, 0.035, 0.055, m.dark, [0.07, 0.075, 0], 0.012));                     // 车身 / 座
  g.add(rbox(0.05, 0.055, 0.05, m.dark, [0.12, 0.085, 0], 0.012));                      // 车头壳
  g.add(cyl(0.012, 0.012, 0.1, m.dark, [0.13, 0.13, 0], 8));                            // 车把立柱
  g.add(box(0.012, 0.012, 0.09, m.dark, [0.14, 0.175, 0]));                             // 车把
  g.add(cyl(0.014, 0.014, 0.01, m.bulb, [0.155, 0.09, 0], 10));                         // 前灯
  const wheel = (x, z, r) => { const w = new THREE.Group(); w.position.set(x, r, z); const t = cyl(r, r, 0.022, m.tyre, [0, 0, 0], 20); t.rotation.x = Math.PI / 2; w.add(t); w.add(cyl(r * 0.5, r * 0.5, 0.024, m.chrome, [0, 0, 0], 12)); w.children[1].rotation.x = Math.PI / 2; g.add(w); return w; };
  wheel(0.13, 0, 0.04); wheel(-0.1, 0.075, 0.038); wheel(-0.1, -0.075, 0.038);
  const cargo = rbox(0.09, 0.085, 0.09, m.box, [-0.06, 0.14, 0], 0.008); g.add(cargo);  // 厢里的小箱：上车时在，下车抱走
  g.userData.cargo = cargo;
  return g;
}
/** 一棵阔叶树：微弯的锥形树干 + 两根分叉 + 五六团起伏的树冠（二十面体按位置做确定性起伏，接缝不裂），两种叶色 */
const blobGeo = (r, seed) => {
  const g = new THREE.IcosahedronGeometry(r, 2), p = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const n = Math.sin(v.x * 61 + seed) * Math.sin(v.y * 53 + seed * 1.7) * Math.sin(v.z * 47 + seed * 0.3); v.multiplyScalar(1 + 0.16 * n); p.setXYZ(i, v.x, v.y, v.z); }
  g.computeVertexNormals(); return g;
};
const tree = (m, h) => {
  const g = new THREE.Group(), R = mulberry32(Math.floor(h * 1e5));
  g.add(cyl(0.007, 0.013, h * 0.5, m.trunk, [0, h * 0.25, 0], 8));
  for (const sx of [-1, 1]) { const b = cyl(0.004, 0.006, h * 0.22, m.trunk, [sx * h * 0.05, h * 0.5, 0], 6); b.rotation.z = -sx * 0.6; g.add(b); }
  const n = 5 + Math.floor(R() * 2);
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2 + R(), rr = h * (0.15 + R() * 0.07), d = k === 0 ? 0 : h * 0.13;
    const c = new THREE.Mesh(blobGeo(rr, k * 3.1 + h * 40), R() < 0.5 ? m.leaf : m.leaf2);
    c.position.set(Math.cos(a) * d, h * (0.68 + (k === 0 ? 0.12 : R() * 0.1)), Math.sin(a) * d); c.castShadow = c.receiveShadow = true; g.add(c);
  }
  return g;
};

/** 建整座世界。plan 由 crowd 规划好。返回世界句柄（build/update/reset/dispose 约定见 factory/README） */
export function build(ctx, item, plan) {
  const { scene } = ctx;
  const S = item.street, R = mulberry32(seedOf(`08-world-${item.id}`));
  const M = {
    agv: mat(ORANGE, { roughness: 0.45, metalness: 0.1, clearcoat: 0.2 }), shelf: mat('#5b6b7a', { roughness: 0.7 }), rack: mat('#55606c', { roughness: 0.8, metalness: 0.3 }),
    rackBox: [withTex(mat('#c79a5e', { roughness: 0.9 }), TX.fabric('#c79a5e')), withTex(mat('#b5854b', { roughness: 0.9 }), TX.fabric('#b5854b')), withTex(mat('#d8b27a', { roughness: 0.9 }), TX.fabric('#d8b27a')), withTex(mat('#8fa3b5', { roughness: 0.9 }), TX.fabric('#8fa3b5'))],
    concrete: withTex(mat('#8f949a', { roughness: 0.95, clearcoat: 0 }), TX.concrete('#8f949a'), { rough: true }),
    gridFloor: withTex(mat('#7f868d', { roughness: 0.9, clearcoat: 0 }), TX.qrFloor('#8b9198')), lineY: mat('#f2c230', { roughness: 0.85, emissive: '#5a4300', emissiveIntensity: 0.1 }),
    wallIn: withTex(mat('#7f8a96', { roughness: 0.92 }), TX.concrete('#7f8a96'), { rough: true }), band: mat(ORANGE, { roughness: 0.7 }),
    belt: mat('#2d343d', { roughness: 0.7 }), roller: mat('#7a838d', { metalness: 0.6, roughness: 0.35 }), steel: mat('#9aa3ad', { metalness: 0.7, roughness: 0.35 }),
    box: withTex(mat('#c79a5e', { roughness: 0.9, clearcoat: 0 }), TX.cardboard('#b8946c'), { rough: false }), tape: mat('#d9b98a', { roughness: 0.4, clearcoat: 0.3 }),
    label: withTex(mat('#f5f0e8', { roughness: 0.6 }), TX.waybill()), labelOrange: mat(ORANGE),
    truck: mat('#eee8dc', { roughness: 0.4, metalness: 0.2, clearcoat: 0.4 }), tyre: withTex(mat('#20242a', { roughness: 0.9 }), TX.asphalt('#20242a')), chrome: mat('#c8ccd2', { metalness: 0.95, roughness: 0.15 }),
    courier: mat(S.trim, { roughness: 0.7 }), helmet: mat(ORANGE, { roughness: 0.3, clearcoat: 0.5 }), skin: mat('#e6b98f', { roughness: 0.6, clearcoat: 0 }), glove: mat('#2b3038', { roughness: 0.8 }), dark: mat('#2b3038', { roughness: 0.6 }),
    wall: withTex(mat(S.wall, { roughness: 0.9 }), TX.brick(S.wall), { rough: false }), door: withTex(mat(S.door, { roughness: 0.6 }), TX.wood(S.door)), ground: item.scene !== 'suburb' ? withTex(mat(S.ground, { roughness: 0.95, clearcoat: 0 }), TX.concrete(S.ground), { rough: true }) : withTex(mat('#55693f', { roughness: 1, clearcoat: 0 }), TX.grass('#55693f'), { rough: true }),
    porch: withTex(mat(S.porch, { roughness: 0.8 }), TX.wood(S.porch)), trim: mat(S.trim, { roughness: 0.6 }),
    road: withTex(mat('#3a3e45', { roughness: 0.95, clearcoat: 0 }), TX.asphalt(), { rough: true }), walk: withTex(mat('#c9c2b6', { roughness: 0.95, clearcoat: 0 }), TX.concrete('#c9c2b6'), { rough: true }), dash: mat('#ece6d8', { roughness: 0.8 }),
    desk: withTex(mat('#9a7350', { roughness: 0.6 }), TX.wood()), homeWall: mat('#d9cdb8', { roughness: 0.95 }), mug: mat('#f4efe6', { roughness: 0.3, clearcoat: 0.4 }), pot: mat('#c4673c', { roughness: 0.6 }), leaf: withTex(mat('#4a7a3c', { roughness: 0.9 }), TX.grass('#4a7a3c')), leaf2: withTex(mat('#5f8e45', { roughness: 0.9 }), TX.grass('#5f8e45')), trunk: withTex(mat('#6b4a2e', { roughness: 0.9 }), TX.wood('#6b4a2e')),
    tent: withTex(mat('#e07a2e', { roughness: 0.8, emissive: '#ff8a3a', emissiveIntensity: 0.18 }), TX.ripstop('#e07a2e')), tentDark: mat('#3a2a22', { roughness: 0.85 }),
    grass: withTex(mat('#3f5233', { roughness: 1, clearcoat: 0 }), TX.grass(), { rough: true }), pole: mat('#2a2d33', { roughness: 0.5, metalness: 0.4 }),
    phone: mat('#1b1f26', { roughness: 0.3, metalness: 0.5, clearcoat: 0.6 }), screen: glow('#f3f6fa', 0.5), hi: glow('#f2b233', 0.6), binHi: withTex(mat('#f0a020', { roughness: 0.85, emissive: '#f08a10', emissiveIntensity: 0.35 }), TX.fabric('#f0a020')),
    roof: withTex(mat('#8a4b3a', { roughness: 0.9 }), TX.brick('#8a4b3a', '#6b3a2c')), roofCity: mat('#5d6670', { roughness: 0.8 }), livery: withTex(mat('#ffffff', { roughness: 0.45, clearcoat: 0.3 }), TX.truckLivery()), glass: new THREE.MeshPhysicalMaterial({ color: '#1c2632', roughness: 0.08, metalness: 0.2, clearcoat: 1 }), trim2: mat('#f3efe6', { roughness: 0.6 }), roofIn: mat('#3a4048', { roughness: 0.8, metalness: 0.3 }),
    win: glow('#ffcf80', 1.2), winNight: glow('#22345e', 0.6), bulb: glow('#ffe2a8', 2.0), highbay: glow('#f4f8ff', 1.4), scan: glow('#ff3b3b', 1.4),
    shadow: new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.28, depthWrite: false }),
    vol: new THREE.MeshBasicMaterial({ color: '#eaf2ff', transparent: true, opacity: 0.06, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false, toneMapped: false }),
  };
  M.label.map && (M.label.map.repeat.set(1, 1));
  const root = new THREE.Group(); scene.add(root);
  const parts = {}, nightGlows = [];                        // nightGlows：天亮时熄掉的窗 / 路灯

  // ═════ 地面：书桌 → 仓库 → 室外，三段接成一整条 ═════
  const S_IN = 0.95, S_OUT = 6.35;                          // 书桌 / 仓库、仓库 / 室外的分界（lane s）
  root.add(laneSlab(-3, S_IN, -1.6, 3, M.grass));
  root.add(laneSlab(S_IN, S_OUT, -1.6, 3, M.concrete));
  root.add(laneSlab(S_OUT, 16, -2.4, 3, M.ground));
  // 夜里的露营地：帐篷在手机旁边（§二 shot 1），一盏小营地灯透出暖光，一块防潮垫，几样小物
  {
    // 圆顶帐篷：半球外帐（ripstop 布纹，里头有灯，透出一点暖光）+ 两根交叉弧形帐杆 + 正面拉链门（深色、半掀开）+ 地钉拉绳
    const tent = laneGroup(-0.3, -0.55);
    const R0 = 0.3, dome = new THREE.Mesh(new THREE.SphereGeometry(R0, 40, 16, 0, Math.PI * 2, 0, Math.PI / 2), M.tent);
    dome.scale.set(1.25, 1.0, 1.0); dome.castShadow = dome.receiveShadow = true; tent.add(dome);
    const door = new THREE.Mesh(new THREE.SphereGeometry(R0 * 1.004, 20, 10, Math.PI / 2 - 0.42, 0.84, Math.PI * 0.2, Math.PI * 0.3), M.tentDark);
    door.scale.copy(dome.scale); tent.add(door);
    const inner = new THREE.Mesh(new THREE.SphereGeometry(R0 * 1.006, 20, 10, Math.PI / 2 - 0.3, 0.6, Math.PI * 0.3, Math.PI * 0.2), glow('#ffb45a', 1.1));
    inner.scale.copy(dome.scale); tent.add(inner);                                       // 门缝里漏出的帐内暖光
    for (const a of [Math.PI / 4, -Math.PI / 4]) {
      const pole = new THREE.Mesh(new THREE.TorusGeometry(R0 * 1.01, 0.0035, 6, 48, Math.PI), M.pole);
      pole.rotation.y = a; pole.scale.set(1.25, 1, 1); tent.add(pole);
    }
    for (const [x, z] of [[-0.5, 0.32], [0.5, 0.32], [-0.5, -0.32], [0.5, -0.32]]) {     // 拉绳 + 地钉
      const p0 = new THREE.Vector3(x * 0.55, 0.2, z * 0.6), p1 = new THREE.Vector3(x, 0.002, z);
      const L = p0.distanceTo(p1), rope = cyl(0.0012, 0.0012, L, mat('#d8d2c4', { roughness: 0.8 }), [0, 0, 0], 4);
      rope.position.copy(p0).lerp(p1, 0.5); rope.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), p1.clone().sub(p0).normalize()); tent.add(rope);
    }
    const tentLight = new THREE.PointLight('#ffb060', 0.5, 0.9, 1.6); tentLight.position.set(0, 0.12, 0); tent.add(tentLight);
    tent.add(contactShadow(0.42, M.shadow, [0, 0, 0]));
    root.add(tent);
    // 营地灯（暖光源）+ 防潮垫 + 保温杯
    const camp = laneGroup(0.0, 0.0); camp.position.set(...STATIONS.phone);
    const lamp = new THREE.Group(); lamp.position.set(0.34, 0.0, -0.26);
    lamp.add(cyl(0.03, 0.034, 0.016, M.dark, [0, 0.008, 0], 12));
    lamp.add(lathe([[0, 0], [0.03, 0], [0.034, 0.02], [0.03, 0.075], [0.012, 0.085]], M.bulb, [0, 0.016, 0], 14));   // 灯罩透暖光
    lamp.add(cyl(0.004, 0.004, 0.03, M.dark, [0, 0.088, 0], 6)); camp.add(lamp);
    const campLight = new THREE.PointLight('#ffcf8a', 0.9, 1.2, 1.6); campLight.position.set(0.34, 0.1, -0.26); camp.add(campLight);
    nightGlows.push({ m: M.bulb, k: 2.0 });                                              // 天不亮，这里只是和路灯同一个熄灭钩子（夜里恒亮）
    camp.add(box(0.6, 0.008, 0.4, mat('#355a4a', { roughness: 0.95 }), [0, 0.004, 0.18]));  // 防潮垫
    camp.add(cyl(0.03, 0.026, 0.07, M.mug, [-0.3, 0.035, 0.2], 14));                      // 保温杯
    camp.add(contactShadow(0.1, M.shadow, [0.34, 0, -0.26]));
    root.add(camp);
  }
  // 仓库：后墙（橙色腰线 + 高窗）+ 墙前一排高货架 + 地上的黄色安全线
  {
    const wall = laneGroup((S_IN + S_OUT) / 2, -1.3); const L = S_OUT - S_IN;
    wall.add(box(L, 1.6, 0.06, M.wallIn, [0, 0.8, 0])); wall.add(box(L, 0.05, 0.065, M.band, [0, 0.28, 0.002]));
    for (let x = -L / 2 + 0.3; x < L / 2 - 0.2; x += 0.45) wall.add(box(0.3, 0.12, 0.01, M.winNight, [x, 0.62, 0.035]));
    root.add(wall);
    // 屋顶：深色钢屋面 + 一排排工字钢梁，挡住仓库上方的天（贴地机位往上看时不再露出夜空）
    root.add(laneSlab(S_IN - 0.05, S_OUT - 0.5, -1.35, 0.95, M.roofIn, 0.74, 0.02));
    for (let s = S_IN + 0.1; s < S_OUT - 0.5; s += 0.35) root.add(laneSlab(s, s + 0.03, -1.3, 0.92, M.rack, 0.7, 0.04));
    for (let s = S_IN + 0.15; s < S_OUT - 0.2; s += 0.2) {
      const r = laneGroup(s, -1.08);
      r.add(extrude([[-0.08, 0], [0.08, 0], [0.08, 0.42], [-0.08, 0.42]], 0.14, M.rack, [0, 0, -0.07]));   // 拉伸的货架立柱
      for (let k = 0; k < 3; k++) if (R() < 0.8) r.add(rbox(0.12, 0.08, 0.1, M.rackBox[Math.floor(R() * 4)], [0, 0.07 + k * 0.13, 0.01], 0.008));
      root.add(r);
    }
    for (const q of [-0.86, 0.86]) root.add(laneSlab(S_IN + 0.05, S_OUT - 0.05, q - 0.012, q + 0.012, M.lineY, 0.003, 0.006));
  }
  // 室外：马路（中线虚线）+ 人行道 + 街边房子（窗里亮着灯）+ 树 + 路灯 + 天幕
  {
    root.add(laneSlab(S_OUT - 0.3, 16, -0.22, 0.3, M.road, 0.004, 0.012));
    root.add(laneSlab(S_OUT + 1.2, 16, -0.44, -0.22, M.walk, 0.012, 0.024));
    root.add(laneSlab(S_OUT + 1.2, 16, -0.235, -0.205, M.walk, 0.03, 0.03));              // 路缘石（人行道边缘抬高）
    for (let s = S_OUT; s < 16; s += 0.32) root.add(laneSlab(s, s + 0.16, 0.035, 0.05, M.dash, 0.011, 0.002));
    root.add(cyl(0.05, 0.05, 0.006, M.dark, lane(S_OUT + 2.4, 0.12, 0.012), 16));          // 井盖
    { const sign = laneGroup(S_OUT + 3.0, -0.5); sign.add(cyl(0.006, 0.006, 0.34, M.steel, [0, 0.17, 0], 6)); sign.add(box(0.1, 0.1, 0.006, M.labelOrange, [0, 0.3, 0])); root.add(sign); }   // 路牌
    const city = item.scene === 'city';
    // 街边房子：门口那栋居中在门上（宽 0.7），两边各排一串，互不重叠
    const house = (c, hw, hh, nearDoor) => {
      const g = laneGroup(c, nearDoor ? -0.99 : -0.95);                                  // 门口那栋的正面贴着门廊的门框
      const tint = new THREE.Color(S.wall).offsetHSL((R() - 0.5) * 0.06, 0, nearDoor ? 0 : (R() - 0.5) * 0.12);
      g.add(box(hw, hh, 0.7, mat(`#${tint.getHexString()}`, { roughness: 0.85 }), [0, hh / 2, 0]));
      if (!city) { const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, hw + 0.04, 3, 1), M.roof); roof.rotation.z = Math.PI / 2; roof.rotation.x = Math.PI / 6; roof.scale.set(1, 1, 0.55); roof.position.y = hh + 0.06; roof.castShadow = true; g.add(roof); }
      else g.add(box(hw + 0.02, 0.03, 0.72, M.roofCity, [0, hh + 0.015, 0]));
      const rows = Math.max(1, Math.floor((hh - 0.12) / 0.16));
      for (let r = 0; r < rows; r++) for (let x = -hw / 2 + 0.11; x < hw / 2 - 0.08; x += 0.17) {
        if (nearDoor && r === 0 && Math.abs(x) < 0.2) continue;                         // 门的位置不开窗
        g.add(box(0.08, 0.08, 0.01, R() < 0.6 ? M.win : M.winNight, [x, 0.14 + r * 0.16, 0.355]));
        g.add(box(0.096, 0.096, 0.008, M.trim2, [x, 0.14 + r * 0.16, 0.351])); g.add(box(0.1, 0.008, 0.02, M.trim2, [x, 0.096 + r * 0.16, 0.36]));   // 窗框 + 窗台
        g.add(box(0.004, 0.08, 0.004, M.trim2, [x, 0.14 + r * 0.16, 0.361])); g.add(box(0.08, 0.004, 0.004, M.trim2, [x, 0.14 + r * 0.16, 0.361]));   // 十字窗棂
      }
      root.add(g);
    };
    const row = (s0, s1) => {
      for (let s = s0; s < s1 - 0.3;) {
        const w = Math.min(0.45 + R() * 0.35, s1 - s), h = city ? 0.55 + R() * 0.45 : 0.34 + R() * 0.2;
        house(s + w / 2, w, h, false);
        if (!city && R() < 0.5 && s + w + 0.1 < s1) { const t = tree(M, 0.3 + R() * 0.12); t.position.set(...lane(s + w + 0.04, -0.66)); root.add(t); }
        s += w + 0.08;
      }
    };
    row(S_OUT + 1.3, S_OF.door - 0.43);
    house(S_OF.door, 0.7, city ? 0.62 : 0.42, true);
    row(S_OF.door + 0.43, 15.5);
    nightGlows.push({ m: M.win, k: 1.2 }, { m: M.winNight, k: 0.6 });
    // 路这边（朝相机）不种树：贴地机位离路很近，树一进前景就挡住三轮车和字幕。照样抽随机数，后面的件位置不动
    for (let s = S_OUT + 0.4; s < 15.5; s += 0.5 + R() * 0.4) { R(); R(); }   // 路这边的树离路远一点、矮一点，不挡车
    for (let s = S_OUT + 0.9; s < 15.5; s += 1.15) {
      const p = laneGroup(s, -0.33); p.add(cyl(0.008, 0.01, 0.42, M.dark, [0, 0.21, 0], 6)); p.add(box(0.012, 0.012, 0.09, M.dark, [0, 0.42, 0.045]));   // 路灯立在人行道上，灯头伸向路面
      p.add(box(0.035, 0.018, 0.035, M.bulb, [0, 0.41, 0.09])); root.add(p);
    }
    nightGlows.push({ m: M.bulb, k: 2.0 });
  }
  // 天幕：室外段后面一整块竖着的渐变板（夜里深蓝 → 黎明橙粉），只有从仓库出来以后的镜头看得到
  const skyGeo = new THREE.PlaneGeometry(11, 3.2, 1, 8);
  skyGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(skyGeo.attributes.position.count * 3), 3));
  const sky = new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, toneMapped: false }));
  sky.position.set(...lane(11.4, -2.0, 1.4)); sky.rotation.y = TH; root.add(sky);

  // ═════ 工位 ═════
  // ── 1 手机：书桌上一部手机，屏幕上是商品和「立即下单」橙按钮 ──
  {
    const g = atStation('phone');
    g.add(rbox(0.44, 0.016, 0.22, M.phone, [0, 0.008, 0], 0.02));                        // 机身（倒角）
    { const tx = TX.phoneUI(), m = new THREE.MeshStandardMaterial({ color: tx ? '#ffffff' : '#26303d', map: tx, emissive: '#ffffff', emissiveMap: tx, emissiveIntensity: tx ? 0.55 : 0.2, roughness: 0.15 });
      const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.18), m); scr.rotation.x = -Math.PI / 2; scr.position.set(0, 0.0165, 0); g.add(scr); }   // 屏幕（深色商品页，贴在机身顶面）
    const prod = buildProduct({ kind: item.model, colors: item.colors }); prod.scale.setScalar(0.16); prod.position.set(0.05, 0.02, 0); g.add(prod);
    const btn = rbox(0.05, 0.008, 0.15, M.agv, [-0.15, 0.022, 0], 0.004); g.add(btn);    // 「立即下单」橙按钮
    const check = cyl(0.022, 0.022, 0.006, M.screen, [-0.15, 0.027, 0], 16); g.add(check);  // 下单成功的对勾圈
    root.add(g); parts.phone = { g, btn, check };
  }
  // ── 2 仓库：二维码导航地面 + 48 台 Kiva AGV + 拣货工作站（补光灯 + 屏幕 + 机械臂）+ 高棚灯 ──
  {
    const g = atStation('warehouse');
    const floor = box(GRID_W * CELL + 0.12, 0.006, GRID_H * CELL + 0.12, M.gridFloor, [0, 0.003, 0]);
    floor.receiveShadow = true; g.add(floor);
    for (let i = 0; i <= GRID_W; i++) g.add(box(0.003, 0.002, GRID_H * CELL, M.lineY, [(i - GRID_W / 2) * CELL, 0.0066, 0]));
    for (let j = 0; j <= GRID_H; j++) g.add(box(GRID_W * CELL, 0.002, 0.003, M.lineY, [0, 0.0066, (j - GRID_H / 2) * CELL]));
    const [px, pz] = cellToWorld(PICK.x, PICK.z, [0, 0, 0], CELL);
    // 拣货工作站：机身 + 面单台 + 补光灯条 + 屏幕
    g.add(rbox(0.16, 0.13, 0.22, M.steel, [px + 0.14, 0.065, pz], 0.012));
    g.add(box(0.11, 0.008, 0.07, M.label, [px + 0.14, 0.134, pz + 0.05]));
    g.add(box(0.1, 0.07, 0.006, M.screen, [px + 0.14, 0.17, pz - 0.1]));                   // 屏幕
    g.add(cyl(0.004, 0.004, 0.1, M.steel, [px + 0.14, 0.14, pz - 0.11], 6));
    g.add(box(0.12, 0.012, 0.02, M.bulb, [px + 0.14, 0.24, pz + 0.02]));                   // 补光灯条
    g.add(box(0.028, 0.08, 0.028, M.steel, [px + 0.26, 0.04, pz]));                        // 防撞柱（黄黑）
    const armBase = new THREE.Group(); armBase.position.set(px + 0.14, 0.13, pz);
    armBase.add(rbox(0.034, 0.17, 0.034, M.agv, [0, 0.085, 0], 0.01));
    armBase.add(cyl(0.03, 0.028, 0.02, M.dark, [0, 0.001, 0], 10)); g.add(armBase);
    const agvs = [];
    for (let i = 0; i < COUNT; i++) { const a = buildAgv(M); g.add(a); agvs.push(a); }
    for (const b of agvs[0].userData.pod.userData.bins) b.material = M.binHi;                                      // 目标那台的货架 pod 高亮
    // 高棚灯：一排挂在高处的灯具（灯箱 + 发光面）。不画假体积光柱——加色锥在画面里读成一排白色半透明金字塔
    for (let s = -0.5; s <= 0.5; s += 0.5) for (const q of [-0.3, 0.3]) {
      g.add(box(0.14, 0.03, 0.1, M.steel, [s, 0.62, q]));
      g.add(box(0.12, 0.006, 0.08, M.highbay, [s, 0.603, q]));
    }
    root.add(g); parts.warehouse = { g, agvs, armBase };
  }
  // ── 3 打包台：辊筒台（车削滚筒）+ 立箱机 + 封箱胶带机 + 贴标机 + 一摞平纸板。纸箱折起 / 封胶 / 贴单的动画在 updatePack ──
  {
    const g = atStation('pack');
    g.add(rbox(0.82, 0.06, 0.44, M.steel, [0, 0.06, 0], 0.012));                         // 台面
    for (let x = -0.36; x <= 0.36; x += 0.06) { const r = lathe([[0, -0.2], [0.012, -0.2], [0.012, 0.2], [0, 0.2]], M.roller, [x, 0.095, 0], 10); r.rotation.z = Math.PI / 2; g.add(r); }   // 车削滚筒
    for (const [x, z] of [[-0.38, -0.19], [0.38, -0.19], [-0.38, 0.19], [0.38, 0.19]]) g.add(rbox(0.03, 0.07, 0.03, M.dark, [x, 0.035, z], 0.006));   // 支腿
    // 立箱机（吐平纸板立成箱）：机身 + 出料口
    const erector = new THREE.Group(); erector.position.set(-0.58, 0, 0);
    erector.add(rbox(0.22, 0.26, 0.4, M.steel, [0, 0.13, 0], 0.012)); erector.add(box(0.02, 0.1, 0.3, M.dark, [0.11, 0.14, 0])); g.add(erector);
    for (let k = 0; k < 6; k++) g.add(box(0.3, 0.008, 0.26, M.box, [-0.56, 0.008 + k * 0.009, -0.05 + (k % 2) * 0.006]));   // 一摞平纸板
    // 封箱胶带机（龙门）+ 贴标机（吐面单）
    const sealer = new THREE.Group(); sealer.position.set(0.22, 0, 0);
    sealer.add(box(0.02, 0.24, 0.02, M.steel, [0, 0.12, -0.2]), box(0.02, 0.24, 0.02, M.steel, [0, 0.12, 0.2]), box(0.02, 0.03, 0.42, M.steel, [0, 0.24, 0]));
    sealer.add(cyl(0.03, 0.03, 0.04, M.tape, [0, 0.2, -0.16], 12)); g.add(sealer);
    const applicator = new THREE.Group(); applicator.position.set(0.0, 0, -0.3);
    applicator.add(rbox(0.2, 0.22, 0.14, M.steel, [0, 0.11, 0], 0.012)); applicator.add(box(0.12, 0.02, 0.01, M.label, [0, 0.17, 0.072])); g.add(applicator);
    // 工业细节：立箱机顶上的有集橙面板 + 操作屏立杆、黄黑警示条；输送线两侧护栏；封箱机头（橙色机头 + 胶带卷）；
    // 身后两托盘码好的纸箱，让打包区像真的在一个忙着的库里
    erector.add(box(0.224, 0.03, 0.404, M.band, [0, 0.245, 0]));
    erector.add(cyl(0.006, 0.006, 0.16, M.steel, [-0.06, 0.34, 0.16], 6)); erector.add(rbox(0.1, 0.07, 0.012, M.dark, [-0.06, 0.43, 0.16], 0.004)); erector.add(box(0.085, 0.055, 0.002, M.screen, [-0.06, 0.43, 0.167]));
    for (let k = 0; k < 6; k++) erector.add(box(0.03, 0.02, 0.002, k % 2 ? M.dark : M.lineY, [-0.09 + k * 0.03, 0.03, 0.201]));
    for (const z of [-0.2, 0.2]) { g.add(box(0.84, 0.012, 0.012, M.steel, [0, 0.14, z])); for (let x = -0.38; x <= 0.38; x += 0.19) g.add(box(0.008, 0.04, 0.008, M.steel, [x, 0.12, z])); }
    sealer.add(rbox(0.12, 0.06, 0.3, M.band, [0, 0.22, 0], 0.01)); sealer.add(cyl(0.035, 0.035, 0.03, M.tape, [0.0, 0.22, 0.17], 16).rotateX(Math.PI / 2));
    for (const [px, pz] of [[-0.2, -0.62], [0.32, -0.66]]) {
      const pal = new THREE.Group(); pal.position.set(px, 0, pz); pal.rotation.y = (R() - 0.5) * 0.2;
      pal.add(box(0.36, 0.03, 0.3, M.desk, [0, 0.015, 0]));
      for (let ly = 0; ly < 3; ly++) for (let ix = 0; ix < 3; ix++) for (let iz = 0; iz < 2; iz++) if (ly < 2 || R() < 0.6) pal.add(rbox(0.11, 0.09, 0.14, M.box, [-0.12 + ix * 0.12, 0.08 + ly * 0.095, -0.072 + iz * 0.145], 0.004));
      pal.add(box(0.37, 0.006, 0.006, M.tape, [0, 0.27, 0.15]));
      g.add(pal);
    }
    const parcel = buildParcel(item.box, M); parcel.position.set(0, 0.11, 0); g.add(parcel);
    const prod = buildProduct({ kind: item.model, colors: item.colors }); prod.scale.setScalar(0.12); prod.position.set(0, 0.11, 0); g.add(prod);
    g.add(contactShadow(0.26, M.shadow, [0, 0.09, 0]));
    root.add(g); parts.pack = { g, parcel, prod };
  }
  // ── 4 分拣线：交叉带（一节节小皮带车）+ 扫码龙门（红色激光扫线）+ 摆轮 + 朝相机一侧的道口滑槽 + 笼车 ──
  {
    const g = atStation('sorter');
    g.add(rbox(1.4, 0.06, 0.18, M.belt, [0, 0.07, 0], 0.01));
    for (const z of [-0.095, 0.095]) g.add(box(1.4, 0.03, 0.012, M.steel, [0, 0.11, z]));
    for (let cx = -0.63; cx <= 0.63; cx += 0.18) g.add(rbox(0.16, 0.012, 0.16, M.dark, [cx, 0.102, 0], 0.004));   // 交叉带小车面
    for (let x = -0.65; x <= 0.65; x += 0.26) g.add(rbox(0.03, 0.07, 0.17, M.dark, [x, 0.035, 0], 0.006));
    // 扫码龙门 + 红色激光扫线
    const arch = new THREE.Group(); arch.position.set(-0.15, 0, 0);
    arch.add(extrude([[-0.015, 0], [0.015, 0], [0.015, 0.26], [-0.015, 0.26]], 0.03, M.steel, [0, 0, -0.125]), extrude([[-0.015, 0], [0.015, 0], [0.015, 0.26], [-0.015, 0.26]], 0.03, M.steel, [0, 0, 0.095]), box(0.03, 0.03, 0.28, M.steel, [0, 0.27, 0]));
    arch.add(box(0.012, 0.004, 0.22, M.scan, [0.02, 0.252, 0])); g.add(arch);             // 红光扫线
    const divert = rbox(0.12, 0.02, 0.15, M.agv, [0.12, 0.108, 0], 0.004); g.add(divert); // 摆轮
    const chute = box(0.17, 0.025, 0.38, M.steel, [0.22, 0.06, 0.26]); chute.rotation.x = 0.18; g.add(chute);
    const cageG = new THREE.Group(); cageG.position.set(0.22, 0, 0.5);                      // 笼车：框 + 网格 + 脚轮
    // 笼车：钢丝网——底板 + 竖杆 + 三道横杆，三面围着、朝分拣线一面敞开；里头已经有几只箱子
    cageG.add(box(0.18, 0.006, 0.16, M.steel, [0, 0.022, 0]));
    for (let x = -0.09; x <= 0.091; x += 0.03) for (const z of [-0.08, 0.08]) cageG.add(box(0.0025, 0.2, 0.0025, M.steel, [x, 0.12, z]));
    for (let z = -0.08; z <= 0.081; z += 0.032) cageG.add(box(0.0025, 0.2, 0.0025, M.steel, [-0.09, 0.12, z]));
    for (const y of [0.06, 0.14, 0.22]) { for (const z of [-0.08, 0.08]) cageG.add(box(0.18, 0.003, 0.003, M.steel, [0, y, z])); cageG.add(box(0.003, 0.003, 0.16, M.steel, [-0.09, y, 0])); }
    for (const [bx, by, bz, bw] of [[-0.03, 0.06, -0.02, 0.09], [0.04, 0.055, 0.03, 0.07], [-0.02, 0.12, 0.02, 0.08]]) cageG.add(rbox(bw, bw * 0.75, bw * 0.9, M.box, [bx, by, bz], 0.003));
    for (const [cx, cz] of [[-0.07, -0.06], [0.07, -0.06], [-0.07, 0.06], [0.07, 0.06]]) { const w = cyl(0.012, 0.012, 0.01, M.dark, [cx, 0.01, cz], 8); w.rotation.x = Math.PI / 2; cageG.add(w); }
    g.add(cageG);
    const boxes = [];
    for (let i = 0; i < 6; i++) { const b = buildParcel(item.box, M); b.scale.setScalar(0.62); boxes.push(b); g.add(b); }
    boxes[2].userData.label.visible = true;
    root.add(g); parts.sort = { g, divert, boxes };
  }
  // ── 5 月台 + 厢式货车（后视镜、车灯、轮毂；车头朝前，沿路开走） ──
  {
    root.add(laneSlab(S_OUT - 0.35, S_OUT + 0.15, -0.45, 0.45, M.concrete, 0.12, 0.12));   // 月台
    // 月台门（卷帘门洞：门框 + 升起的卷帘 + 门内暗光）
    const dock = laneGroup(S_OUT - 0.42, -0.42); dock.position.y = 0;
    dock.add(extrude([[-0.02, 0], [0.02, 0], [0.02, 0.5], [-0.02, 0.5]], 0.04, M.steel, [-0.26, 0.12, -0.02]), extrude([[-0.02, 0], [0.02, 0], [0.02, 0.5], [-0.02, 0.5]], 0.04, M.steel, [0.26, 0.12, -0.02]), box(0.56, 0.04, 0.06, M.steel, [0, 0.62, 0]));
    dock.add(box(0.48, 0.14, 0.02, M.rack, [0, 0.55, 0]));                                  // 升起的卷帘
    dock.add(box(0.48, 0.3, 0.01, glow('#141a24', 0.3), [0, 0.27, -0.04]));                 // 门内暗
    root.add(dock);
    const truck = new THREE.Group(); truck.rotation.y = TH;
    const body = new THREE.Group(); body.scale.setScalar(1.5); truck.add(body);
    body.add(rbox(0.3, 0.17, 0.18, M.truck, [0, 0.145, 0], 0.01));                        // 厢体
        body.add(rbox(0.1, 0.11, 0.182, M.truck, [0.2, 0.08, 0], 0.012));                     // 驾驶室
    for (const sz of [1, -1]) { const lv = new THREE.Mesh(new THREE.PlaneGeometry(0.29, 0.16), M.livery); lv.position.set(0, 0.145, sz * 0.0905); if (sz < 0) lv.rotation.y = Math.PI; body.add(lv); }   // 厢侧涂装（贴花，贴平）
    body.add(box(0.3, 0.012, 0.17, M.dark, [0, 0.052, 0]));                               // 底盘大梁
    body.add(box(0.012, 0.02, 0.18, M.dark, [-0.153, 0.055, 0]));                         // 后保险杠
    body.add(box(0.006, 0.03, 0.12, M.dark, [0.252, 0.06, 0]));                           // 进气格栅
    for (const sz of [1, -1]) body.add(box(0.06, 0.045, 0.002, M.glass, [0.21, 0.105, sz * 0.0915]));   // 驾驶室侧窗
    body.add(box(0.006, 0.05, 0.14, glow('#aee0ff', 0.25), [0.252, 0.1, 0]));             // 风挡
    body.add(box(0.01, 0.025, 0.035, M.bulb, [0.253, 0.055, 0.065]), box(0.01, 0.025, 0.035, M.bulb, [0.253, 0.055, -0.065]));   // 前灯
    body.add(box(0.012, 0.03, 0.006, M.dark, [0.235, 0.11, 0.098]), box(0.012, 0.03, 0.006, M.dark, [0.235, 0.11, -0.098]));     // 后视镜
    const doorL = new THREE.Group(), doorR = new THREE.Group(); doorL.position.set(-0.152, 0, 0.09); doorR.position.set(-0.152, 0, -0.09);
    doorL.add(box(0.008, 0.16, 0.09, M.rack, [0, 0.145, -0.045])); doorR.add(box(0.008, 0.16, 0.09, M.rack, [0, 0.145, 0.045]));
    body.add(doorL, doorR);
    for (const [dx, dz] of [[0.2, 0.092], [0.2, -0.092], [-0.08, 0.092], [-0.08, -0.092]]) { const w = new THREE.Group(); w.position.set(dx, 0.04, dz); const t = cyl(0.04, 0.04, 0.032, M.tyre, [0, 0, 0], 24); t.rotation.x = Math.PI / 2; w.add(t); const hub = cyl(0.022, 0.022, 0.034, M.chrome, [0, 0, 0], 16); hub.rotation.x = Math.PI / 2; w.add(hub); body.add(w); }
    root.add(truck); parts.truck = { truck, doorL, doorR };
  }
  // ── 7 + 8 三轮车、快递员、木门廊（门开出暖光，按 item 换配色） ──
  {
    const porch = atStation('door');
    porch.add(rbox(0.52, 0.03, 0.24, M.porch, [0, 0.015, 0.04], 0.008));                 // 木门廊地台
    for (let px = -0.22; px <= 0.22; px += 0.07) porch.add(box(0.055, 0.004, 0.22, M.porch, [px, 0.031, 0.05]));   // 板缝
    porch.add(rbox(0.3, 0.012, 0.1, mat('#b0533a', { roughness: 0.9 }), [0, 0.036, 0.09], 0.004));   // 门垫
    // 门框线脚（拉伸件）
    porch.add(extrude([[-0.02, 0], [0.02, 0], [0.02, 0.4], [-0.02, 0.4]], 0.03, M.trim, [-0.14, 0.0, -0.09]), extrude([[-0.02, 0], [0.02, 0], [0.02, 0.4], [-0.02, 0.4]], 0.03, M.trim, [0.14, 0.0, -0.09]), extrude([[-0.16, 0], [0.16, 0], [0.16, 0.025], [-0.16, 0.025]], 0.03, M.trim, [0, 0.4, -0.09]));
    const doorPivot = new THREE.Group(); doorPivot.position.set(-0.11, 0, -0.055);
    doorPivot.add(rbox(0.22, 0.36, 0.022, M.door, [0.11, 0.18, 0], 0.006));              // 门扇（倒角 + 木纹）
    doorPivot.add(box(0.08, 0.14, 0.004, mat(`#${new THREE.Color(S.door).offsetHSL(0, 0, 0.08).getHexString()}`, { roughness: 0.6 }), [0.11, 0.24, 0.012]));   // 门板凹框
    doorPivot.add(cyl(0.012, 0.012, 0.03, M.chrome, [0.2, 0.17, 0.02], 10)); doorPivot.children[2].rotation.z = Math.PI / 2;   // 把手
    porch.add(doorPivot);
    const inside = box(0.22, 0.34, 0.01, glow('#ffc978', 0.0), [0, 0.17, -0.07]); porch.add(inside);
    porch.add(box(0.045, 0.035, 0.035, M.bulb, [0.18, 0.38, -0.05]));                     // 门灯
    const warm = new THREE.PointLight('#ffcf8a', 0, 1.4, 1.5); warm.position.set(0, 0.22, 0.08); porch.add(warm);
    const parcel = buildParcel(item.box, M); parcel.scale.setScalar(0.45); parcel.position.set(0.16, 0.03, 0.07); parcel.userData.label.visible = true; porch.add(parcel);
    porch.add(contactShadow(0.1, M.shadow, [0.16, 0.03, 0.07]));
    root.add(porch);
    const trike = buildTrike(M); trike.rotation.y = TH; root.add(trike);
    const courier = buildCourier(M); courier.scale.setScalar(0.78); root.add(courier);   // 比门矮一截
    parts.door = { porch, doorPivot, inside, warm, parcel, courier, trike };
  }

  // ═════ 灯光：主平行光跟着取景点走（阴影贴图只盖眼前一块，够清楚）；屋里冷白、出门是夜蓝、到门口是黎明橙 ═════
  const key = new THREE.DirectionalLight('#e6eeff', 2.4);
  key.castShadow = true;
  Object.assign(key.shadow.camera, { left: -2.2, right: 2.2, top: 2.2, bottom: -2.2, near: 0.5, far: 20 });
  key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.01;
  const amb = new THREE.HemisphereLight('#e8eeff', '#4a4f57', 0.9);
  scene.add(key, key.target, amb);
  scene.background = new THREE.Color('#1a2340');

  // 环境反射：用 RoomEnvironment 经 PMREM 预积分出一张环境贴图，给金属 / 清漆件打上柔和的间接光和反射。
  // 要真实的 WebGL 渲染器（Node 测试里 ctx.renderer 没有 compile / 不是真渲染器，就跳过——材质退回只有直接光）。
  let env = null, pmrem = null;
  try {
    if (ctx.renderer && typeof ctx.renderer.compile === 'function' && typeof THREE.PMREMGenerator === 'function') {
      pmrem = new THREE.PMREMGenerator(ctx.renderer);
      env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      scene.environment = env;
      scene.environmentIntensity != null && (scene.environmentIntensity = 0.6);
    }
  } catch { env = null; }                                    // 没有可用的渲染器时静默退回

  const handle = {
    root, parts, M, plan, item, scene, key, amb,
    env, pmrem,
    post: { exposure: 1.0, vignette: 0.3, grain: 0.02, bloom: { strength: 0.3, threshold: 0.82 }, saturation: 1.08 },
    /** 按故事时间摆好所有会动的件（闭式；AGV 走规划表）。s = { t: 故事时间, focus?: 取景点（世界坐标） } */
    update(s) {
      const t = s.t;
      updateOrder(parts.phone, localT('order', t));
      updateAgvs(parts.warehouse, plan.cells, localT('robots', t));
      updatePack(parts.pack, localT('pack', t));
      updateSort(parts.sort, localT('sort', t));
      updateTruck(parts.truck, localT('truck', t)); parts.truck.truck.visible = t < STORY0.lastmile + 0.5;   // 开走以后就不再出现
      updateCourier(parts.door, t);
      updateLight(this, t, s.focus ?? STATIONS.phone, sky, nightGlows);
    },
    reset() { this.update({ t: 0 }); },
    dispose() {
      root.traverse(o => { o.geometry?.dispose?.(); if (Array.isArray(o.material)) o.material.forEach(m => m.dispose?.()); else o.material?.dispose?.(); });
      scene.remove(key, key.target, amb, root);
      scene.environment = null; env?.dispose?.(); pmrem?.dispose?.(); TX.disposeTextures();
    },
  };
  handle.reset();
  return handle;
}

// ── 各工位的闭式动画（参数都是镜头本地秒） ──
function updateOrder(phone, lt) {
  const press = ss(EV.tap - 0.1, EV.tap + 0.05, lt);
  phone.btn.scale.setScalar(1 - 0.25 * press * (1 - press) * 4);
  phone.check.visible = lt >= EV.tap;
  phone.check.scale.setScalar(Math.max(1e-3, easeOut(ss(EV.tap, EV.tap + 0.3, lt))));
}
/** 每台车每一步「停着时」该朝哪：沿用它上一次走的方向，没走过就用它第一次要走的方向（停着的车不会乱转） */
function restHeadings(cells) {
  const H = new Float32Array(COUNT * STEPS);
  for (let i = 0; i < COUNT; i++) {
    const dir = s => { const a = (i * STEPS + s) * 2, b = (i * STEPS + s + 1) * 2, dx = cells[b] - cells[a], dz = cells[b + 1] - cells[a + 1]; return dx || dz ? Math.atan2(dz, dx) : null; };
    let h = null;
    for (let s = 0; s < STEPS - 1 && h === null; s++) h = dir(s);
    h ??= 0;
    for (let s = 0; s < STEPS; s++) { H[i * STEPS + s] = h; const d = s < STEPS - 1 ? dir(s) : null; if (d !== null) h = d; }
  }
  return H;
}
function updateAgvs(wh, cells, lt) {
  const o = { x: 0, z: 0, heading: 0, moving: 0 }, s0 = Math.min(STEPS - 1, Math.floor(clamp(lt / STEP, 0, STEPS - 1)));
  wh.rest ??= restHeadings(cells);
  for (let i = 0; i < COUNT; i++) {
    o.heading = wh.rest[i * STEPS + s0];                                       // 停着的车：用它自己的朝向（agvAt 只在走的时候改）
    agvAt(cells, i, lt, o);
    const [wx, wz] = cellToWorld(o.x, o.z, [0, 0, 0], CELL);
    const a = wh.agvs[i];
    a.position.set(wx, 0, wz);
    a.rotation.y = -o.heading;
    a.userData.pod.position.y = 0.036 + 0.002 * o.moving * Math.abs(Math.sin(lt * 8 + i));
  }
  wh.armBase.rotation.z = 0.9 * easeInOut(ss(EV.pick - 0.3, EV.pick + 0.4, lt));
}
function updatePack(pack, lt) {
  // 0.15–1.1 s 商品落进箱子、四片盖错开合上，1.1–1.3 s 胶带封上，1.5 s 面单弹出
  closeParcel(pack.parcel, clamp((lt - 0.35) / 0.75), 0.15);
  const tape = pack.parcel.userData.tape; tape.visible = lt >= 1.1; tape.scale.x = Math.max(1e-3, easeOut(ss(1.1, 1.3, lt)));
  pack.prod.visible = lt < 0.9;
  pack.prod.position.y = 0.11 + 0.12 * (1 - easeInOut(ss(0.0, 0.4, lt)));   // 从上面放进去
  const lab = pack.parcel.userData.label; lab.visible = lt >= EV.label;
  lab.scale.setScalar(Math.max(1e-3, easeOut(ss(EV.label, EV.label + 0.3, lt))));
}
function updateSort(sort, lt) {
  sort.boxes.forEach((b, i) => {
    const base = -0.65 + i * 0.2 + lt * 0.2;
    if (i === 2) {
      const k = easeInOut(ss(EV.divert, EV.divert + 0.6, lt)), x0 = Math.min(base, 0.12);
      b.position.set(x0 + 0.1 * k, 0.1 - 0.05 * k, 0.32 * k);
    } else b.position.set(base, 0.1, 0);
    b.visible = b.position.x < 0.68;
  });
  sort.divert.rotation.y = 0.6 * easeInOut(ss(EV.divert - 0.1, EV.divert + 0.3, lt)) * (1 - ss(EV.divert + 0.6, EV.divert + 1.0, lt));
}
function updateTruck(tr, lt) {
  const close = easeInOut(ss(0.0, 0.4, lt));
  tr.doorL.rotation.y = -1.4 * (1 - close); tr.doorR.rotation.y = 1.4 * (1 - close);   // 开场车门开着（刚装完货），0.4 s 关上
  tr.truck.position.set(...lane(MOTION.truck(lt), -0.08, 0));
}
/** 三轮车、快递员、门口，全看故事时间：truck 段停在公路工位等着交接；lastmile 骑到门口，1.4 s 后下车抱箱走上门廊；
 *  door 本地 0（成片 13.0）放下箱子敲门，0.4–1.4 s 门开、暖光亮 */
function updateCourier(d, t) {
  const lm = localT('lastmile', t), dl = localT('door', t), sTrike = MOTION.trike(lm);
  d.trike.position.set(...lane(sTrike, 0.2, 0));
  const c = d.courier, { legL, legR, armL, armR } = c.userData.limbs;
  const walk = ss(1.4, 2.0, lm), riding = walk <= 0;
  const from = lane(sTrike + 0.03, 0.2, 0.0), to = lane(S_OF.door - 0.02, -0.47, 0.03);
  if (riding) { c.position.set(from[0], 0.05, from[2]); c.rotation.y = TH + Math.PI / 2; }         // 本地 +z 是脸：骑车时朝前（沿路）
  else {
    const k = easeInOut(walk); c.position.set(lerp(from[0], to[0], k), lerp(0.05, 0.03, Math.min(1, k * 3)), lerp(from[2], to[2], k));
    c.rotation.y = TH + Math.PI / 2 + Math.PI / 2 * Math.min(1, walk * 2.5);              // 转身朝门（背对相机）
  }
  const sw = riding ? 0 : Math.sin(walk * 18) * (1 - ss(0.85, 1.0, walk)) * 0.6;
  legL.rotation.x = riding ? -1.2 : sw; legR.rotation.x = riding ? -1.2 : -sw;
  const knock = dl > 0 && dl < 0.45 ? Math.abs(Math.sin(dl * Math.PI * 4.4)) : 0;            // 敲两下
  armL.rotation.x = riding ? -0.9 : -0.6 * (1 - ss(0, 0.1, dl)); armR.rotation.x = riding ? -0.9 : (dl > 0 ? -1.5 - 0.35 * knock : -0.6);
  const placed = t >= STORY0.door;
  c.userData.carry.visible = !riding && !placed;
  d.trike.userData.cargo.visible = riding;                                                      // 厢里的小箱：上车时在，下车抱走
  d.parcel.visible = placed;
  const open = easeInOut(ss(0.4, 1.4, dl));
  d.doorPivot.rotation.y = open * 1.25;
  d.inside.material.emissiveIntensity = 0.9 * open;                     // 门里暖光：亮但不过曝（之前整扇门口被 bloom 冲白）
  d.warm.intensity = 0.9 * open;
}
const C = (h) => new THREE.Color(h);
const SKY = { nightTop: C('#0b1430'), nightLow: C('#24356a'), dawnTop: C('#6f97d3'), dawnLow: C('#ffb27a'), midLow: C('#d77a7a') };
const tmpA = new THREE.Color(), tmpB = new THREE.Color();
function updateLight(w, t, focus, sky, glows) {
  // out：从仓库出到室外（8.6–9.4 s 平滑过渡）；dawn：室外的夜 → 黎明（9.6–13.4 s）
  const out = ss(8.6, 9.4, t), dawn = ss(9.6, 13.4, t);
  const kIn = C('#e8efff'), kNight = C('#8ea6e0'), kDawn = C('#ffb87a');
  // camp：开场露营地是夜里（月光冷蓝、环境光很暗，只靠营地灯和帐篷透光），进仓库前过渡到室内冷白
  const camp = 1 - ss(STORY0.robots - 0.35, STORY0.robots + 0.15, t);
  w.key.color.copy(kIn).lerp(kNight, out).lerp(kDawn, dawn).lerp(C('#7d94d6'), camp);
  w.key.intensity = lerp(lerp(lerp(3.0, 1.1, out), 2.9, dawn), 0.7, camp);
  w.amb.color.copy(C('#e8eeff')).lerp(C('#56679a'), out).lerp(C('#ffd9bf'), dawn).lerp(C('#4a5c8f'), camp);
  w.amb.groundColor.copy(C('#4a4f57')).lerp(C('#1d2333'), out).lerp(C('#6a4a3a'), dawn).lerp(C('#141a14'), camp);
  w.amb.intensity = lerp(lerp(lerp(0.42, 0.45, out), 0.6, dawn), 0.35, camp);
  // 主光从侧后方斜打（机位在 +x +z，光从 +x −z 来：有明暗面和朝镜头的影子，不再是正面平光），黎明时更低、更暖
  const lowK = lerp(1, 0.55, dawn);
  w.key.position.set(focus[0] + 3.2, 4.6 * lowK + 1.0, focus[2] - 2.6);
  w.key.target.position.set(focus[0], 0, focus[2]); w.key.target.updateMatrixWorld();
  // 天幕渐变：底色先变粉紫再变橙，顶色从深蓝到浅蓝
  const top = tmpA.copy(SKY.nightTop).lerp(SKY.dawnTop, dawn);
  const low = tmpB.copy(SKY.nightLow).lerp(SKY.midLow, ss(0, 0.55, dawn)).lerp(SKY.dawnLow, ss(0.45, 1, dawn));
  const pos = sky.geometry.attributes.position, col = sky.geometry.attributes.color, H = 3.2;
  for (let i = 0; i < pos.count; i++) { const k = clamp((pos.getY(i) + H / 2) / H); const c = tmpLow.copy(low).lerp(top, Math.pow(k, 0.7)); col.setXYZ(i, c.r, c.g, c.b); }
  col.needsUpdate = true;
  w.scene.background.copy(low).lerp(C('#30353c'), (1 - camp) * (1 - out));   // 仓库里看不到天：远处是昏暗的库内
  for (const g of glows) g.m.emissiveIntensity = g.k * (1 - 0.85 * dawn);
}
const tmpLow = new THREE.Color();
