// world.js — 一镜到底的世界：八个低多边形工位沿对角线依次摆开（手机 → 仓库 → 打包台 → 分拣线 → 月台 → 公路 → 街区 → 门口）
// 三段地面接成一整条：书桌（夜里的家）→ 仓库（浅水泥地 + 后墙货架 + 高窗）→ 室外（草地 / 马路 / 人行道 / 街边房子 / 路灯 / 树 + 天幕）。
// 全部程序建模，三件商品共用一套部件，靠换颜色和排列区别。所有状态都是故事时间 t 的闭式（AGV 群走规划好的表），
// 所以 update(t) 本身就是复位：reset() = 摆回 t=0；dispose() 释放资源。
import * as THREE from 'three';
import { clay } from '../../04-year-review/js/models/clay.js';
import { buildProduct } from '../../04-year-review/js/models/product.js';
import { clamp, lerp, ss, easeInOut, easeOut } from '../../factory/engine/ease.js';
import { STATIONS, EV, LANE, lane, S_OF, MOTION, STORY0, NATURAL } from '../meta.js';
import { agvAt, cellToWorld, GRID_W, GRID_H, PICK, COUNT, STEPS, STEP } from './crowd.js';
import { mulberry32, seedOf } from '../../factory/engine/rng.js';

const CELL = 0.1;                               // 仓库网格一格的世界尺寸（米）
const ORANGE = '#f0820f';                       // 有集橙
const TH = LANE.theta;                          // 沿对角线摆放的件绕 y 转的角（本地 +x = 沿路往前，+z = 朝相机）

// 故事时间 t 里某个镜头的本地秒（夹在镜头的天然时长里）
const localT = (name, t) => clamp(t - STORY0[name], 0, NATURAL[name]);

const mat = (c, o = {}) => clay({ color: c, ...o });
const glow = (c, k = 1) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: k, roughness: 0.6 });
const box = (w, h, d, m, at = [0, 0, 0]) => { const g = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); g.position.set(...at); g.castShadow = g.receiveShadow = true; return g; };
const cyl = (r0, r1, h, m, at = [0, 0, 0], seg = 10) => { const g = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, seg), m); g.position.set(...at); g.castShadow = g.receiveShadow = true; return g; };
/** 沿对角线的一块地：s∈[s0,s1]、q∈[q0,q1]，顶面在 y */
function laneSlab(s0, s1, q0, q1, m, y = 0, th = 0.02) {
  const g = new THREE.Mesh(new THREE.BoxGeometry(s1 - s0, th, q1 - q0), m);
  g.position.set(...lane((s0 + s1) / 2, (q0 + q1) / 2, y - th / 2)); g.rotation.y = TH; g.receiveShadow = true; return g;
}
/** 放到 lane 坐标 (s, q) 上、沿路摆的组 */
function laneGroup(s, q, y = 0) { const g = new THREE.Group(); g.position.set(...lane(s, q, y)); g.rotation.y = TH; return g; }
/** 把一个工位组摆到它的世界坐标、沿路转好 */
function atStation(k) { const g = new THREE.Group(); g.position.set(...STATIONS[k]); g.rotation.y = TH; return g; }

// ── 低多边形部件 ──
/** 一台 AGV：橙色矮方块，顶上托一个货架 */
function buildAgv(m) {
  const g = new THREE.Group();
  g.add(box(0.075, 0.025, 0.085, m.agv, [0, 0.016, 0]));
  g.add(box(0.064, 0.07, 0.074, m.shelf, [0, 0.07, 0]));
  return g;
}
/** 一只纸箱（商品的包裹）：盖子四片，可按角度折起；面单藏着，命中点弹出 */
function buildParcel(size, m) {
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
function closeParcel(g, k, stagger = 0) {
  const [a, b, c, d] = g.userData.flaps, open = 0.38;                            // 敞开时也竖起 0.38·π，像刚折好的箱子
  const at = i => (stagger ? easeInOut(clamp((k - i * stagger) / (1 - 3 * stagger))) : k);
  const ang = i => Math.PI * (open + (1 - open) * at(i));
  a.rotation.set(0, 0, -ang(0)); b.rotation.set(0, 0, ang(1));
  c.rotation.set(ang(2), 0, 0); d.rotation.set(-ang(3), 0, 0);
  g.userData.tape.visible = k >= 1;
}
/** 低多边形快递员：身子 + 头盔 + 两腿两臂（各绕肩 / 胯转），手里可以抱一只小箱 */
function buildCourier(m) {
  const g = new THREE.Group();
  g.add(box(0.07, 0.12, 0.05, m.courier, [0, 0.2, 0]));
  g.add(box(0.05, 0.05, 0.05, m.skin, [0, 0.29, 0]));
  g.add(box(0.058, 0.025, 0.058, m.helmet, [0, 0.322, 0]));
  const limb = (w, h, mm, x, y) => { const piv = new THREE.Group(); piv.position.set(x, y, 0); piv.add(box(w, h, 0.03, mm, [0, -h / 2, 0])); g.add(piv); return piv; };
  const legL = limb(0.026, 0.14, m.dark, -0.018, 0.14), legR = limb(0.026, 0.14, m.dark, 0.018, 0.14);
  const armL = limb(0.02, 0.1, m.courier, -0.046, 0.255), armR = limb(0.02, 0.1, m.courier, 0.046, 0.255);
  const carry = box(0.08, 0.07, 0.07, m.box, [0, 0.19, 0.06]); g.add(carry);
  g.userData.limbs = { legL, legR, armL, armR }; g.userData.carry = carry;
  return g;
}
/** 电动三轮：车头 + 座 + 后面的橙色货厢（厢里的小箱随交接显示） */
function buildTrike(m) {
  const g = new THREE.Group();
  g.add(box(0.16, 0.11, 0.15, m.agv, [-0.06, 0.1, 0]));                               // 货厢
  g.add(box(0.05, 0.012, 0.05, m.label, [-0.06, 0.158, 0.03]));                         // 厢上的有集标
  g.add(box(0.1, 0.03, 0.05, m.dark, [0.07, 0.07, 0]));                                 // 车身
  g.add(box(0.012, 0.09, 0.012, m.dark, [0.13, 0.11, 0]));                              // 车把立柱
  g.add(box(0.012, 0.012, 0.08, m.dark, [0.13, 0.155, 0]));
  for (const [x, z] of [[0.13, 0], [-0.1, 0.07], [-0.1, -0.07]]) { const w = cyl(0.035, 0.035, 0.022, m.tyre, [x, 0.035, z], 12); w.rotation.x = Math.PI / 2; g.add(w); }
  return g;
}
const tree = (m, h) => { const g = new THREE.Group(); g.add(cyl(0.012, 0.016, h * 0.4, m.trunk, [0, h * 0.2, 0], 6)); const c = new THREE.Mesh(new THREE.ConeGeometry(h * 0.28, h * 0.75, 7), m.leaf); c.position.y = h * 0.62; c.castShadow = true; g.add(c); return g; };

/** 建整座世界。plan 由 crowd 规划好。返回世界句柄（build/update/reset/dispose 约定见 factory/README） */
export function build(ctx, item, plan) {
  const { scene } = ctx;
  const S = item.street, R = mulberry32(seedOf(`08-world-${item.id}`));
  const M = {
    agv: mat(ORANGE), shelf: mat('#5b6b7a'), rack: mat('#55606c', { roughness: 0.8 }), rackBox: [mat('#c79a5e'), mat('#b5854b'), mat('#d8b27a'), mat('#8fa3b5')],
    concrete: mat('#b3b8bd', { roughness: 0.95, clearcoat: 0 }), gridFloor: mat('#9ca3aa', { roughness: 0.95, clearcoat: 0 }), lineY: mat('#f2c230', { roughness: 0.9 }),
    wallIn: mat('#7f8a96', { roughness: 0.9 }), band: mat(ORANGE, { roughness: 0.8 }),
    belt: mat('#2d343d'), roller: mat('#7a838d', { metalness: 0.3 }), steel: mat('#9aa3ad', { metalness: 0.4, roughness: 0.4 }),
    box: mat('#c79a5e', { roughness: 0.85, clearcoat: 0.1 }), tape: mat('#d9b98a', { roughness: 0.5 }), label: mat(ORANGE), truck: mat('#eee8dc'), tyre: mat('#20242a'),
    courier: mat(S.trim), helmet: mat(ORANGE), skin: mat('#e6b98f'), dark: mat('#2b3038'),
    wall: mat(S.wall), door: mat(S.door), ground: mat(S.ground, { roughness: 0.95, clearcoat: 0 }), porch: mat(S.porch), trim: mat(S.trim),
    road: mat('#3a3e45', { roughness: 0.95, clearcoat: 0 }), walk: mat('#c9c2b6', { roughness: 0.95, clearcoat: 0 }), dash: mat('#ece6d8'),
    desk: mat('#9a7350', { roughness: 0.8 }), homeWall: mat('#d9cdb8', { roughness: 0.9 }), mug: mat('#f4efe6'), pot: mat('#c4673c'), leaf: mat('#4f8a4b'), trunk: mat('#6b4a2e'),
    phone: mat('#1b1f26'), screen: glow('#f3f6fa', 0.45), hi: glow('#f2b233', 0.5),
    roof: mat('#8a4b3a'), roofCity: mat('#5d6670'),
    win: glow('#ffcf80', 1.2), winNight: glow('#22345e', 0.6), bulb: glow('#ffe2a8', 2.0), scan: glow('#ff3b3b', 1.4),
  };
  const root = new THREE.Group(); scene.add(root);
  const parts = {}, nightGlows = [];                        // nightGlows：天亮时熄掉的窗 / 路灯

  // ═════ 地面：书桌 → 仓库 → 室外，三段接成一整条 ═════
  const S_IN = 0.95, S_OUT = 6.35;                          // 书桌 / 仓库、仓库 / 室外的分界（lane s）
  root.add(laneSlab(-3, S_IN, -1.6, 3, M.desk));
  root.add(laneSlab(S_IN, S_OUT, -1.6, 3, M.concrete));
  root.add(laneSlab(S_OUT, 16, -2.4, 3, M.ground));
  // 家里：书桌后面的墙 + 夜色的窗 + 一幅画
  {
    const w = laneGroup(-0.2, -0.75); w.add(box(2.6, 0.75, 0.05, M.homeWall, [0, 0.375, 0]));
    w.add(box(0.5, 0.32, 0.01, M.winNight, [-0.35, 0.42, 0.03])); nightGlows.push({ m: M.winNight, k: 0.6 });
    w.add(box(0.56, 0.02, 0.03, M.desk, [-0.35, 0.25, 0.035]));
    w.add(box(0.24, 0.18, 0.012, mat('#f0820f'), [0.42, 0.44, 0.03])); w.add(box(0.2, 0.14, 0.014, mat('#2f6f9a'), [0.42, 0.44, 0.035]));
    root.add(w);
    // 书桌上的杯子、盆栽、笔记本（散在手机周围，不挡手机）
    const d = laneGroup(0, 0); d.position.set(...STATIONS.phone);
    d.add(cyl(0.05, 0.045, 0.1, M.mug, [0.36, 0.05, -0.28], 14));
    d.add(cyl(0.06, 0.05, 0.08, M.pot, [-0.42, 0.04, -0.36], 8)); const pl = new THREE.Mesh(new THREE.IcosahedronGeometry(0.08, 0), M.leaf); pl.position.set(-0.42, 0.14, -0.36); pl.castShadow = true; d.add(pl);
    d.add(box(0.26, 0.015, 0.2, mat('#e9e2d2'), [-0.4, 0.008, 0.22])); d.add(box(0.012, 0.012, 0.18, mat('#2f6f9a'), [-0.3, 0.02, 0.22]));
    root.add(d);
  }
  // 仓库：后墙（橙色腰线 + 高窗）+ 墙前一排高货架 + 地上的黄色安全线
  {
    const wall = laneGroup((S_IN + S_OUT) / 2, -1.3); const L = S_OUT - S_IN;
    wall.add(box(L, 0.8, 0.06, M.wallIn, [0, 0.4, 0])); wall.add(box(L, 0.05, 0.065, M.band, [0, 0.28, 0.002]));
    for (let x = -L / 2 + 0.3; x < L / 2 - 0.2; x += 0.45) wall.add(box(0.3, 0.12, 0.01, M.winNight, [x, 0.62, 0.035]));
    root.add(wall);
    for (let s = S_IN + 0.15; s < S_OUT - 0.2; s += 0.2) {
      const r = laneGroup(s, -1.08); r.add(box(0.16, 0.42, 0.14, M.rack, [0, 0.21, 0]));
      for (let k = 0; k < 3; k++) if (R() < 0.8) r.add(box(0.12, 0.08, 0.1, M.rackBox[Math.floor(R() * 4)], [0, 0.07 + k * 0.13, 0.01]));
      root.add(r);
    }
    for (const q of [-0.86, 0.86]) root.add(laneSlab(S_IN + 0.05, S_OUT - 0.05, q - 0.012, q + 0.012, M.lineY, 0.003, 0.006));
  }
  // 室外：马路（中线虚线）+ 人行道 + 街边房子（窗里亮着灯）+ 树 + 路灯 + 天幕
  {
    root.add(laneSlab(S_OUT - 0.3, 16, -0.22, 0.3, M.road, 0.004, 0.012));
    root.add(laneSlab(S_OUT + 1.2, 16, -0.44, -0.22, M.walk, 0.012, 0.024));
    for (let s = S_OUT; s < 16; s += 0.32) root.add(laneSlab(s, s + 0.16, 0.035, 0.05, M.dash, 0.011, 0.002));
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
    for (let s = S_OUT + 0.4; s < 15.5; s += 0.5 + R() * 0.4) { const t = tree(M, 0.22 + R() * 0.12); t.position.set(...lane(s, 0.95 + R() * 0.6)); root.add(t); }   // 路这边的树离路远一点、矮一点，不挡车
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
    g.add(box(0.44, 0.014, 0.22, M.phone, [0, 0.007, 0]));
    g.add(box(0.42, 0.004, 0.2, M.screen, [0, 0.016, 0]));
    const prod = buildProduct({ kind: item.model, colors: item.colors }); prod.scale.setScalar(0.16); prod.position.set(0.05, 0.018, 0); g.add(prod);
    const btn = box(0.05, 0.006, 0.15, M.agv, [-0.15, 0.02, 0]); g.add(btn);
    const check = box(0.04, 0.008, 0.04, M.screen, [-0.15, 0.025, 0]); g.add(check);
    root.add(g); parts.phone = { g, btn, check };
  }
  // ── 2 仓库：网格地面 + 48 台 AGV + 拣货台和机械臂 ──
  {
    const g = atStation('warehouse');
    g.add(box(GRID_W * CELL + 0.1, 0.006, GRID_H * CELL + 0.1, M.gridFloor, [0, 0.003, 0]));
    for (let i = 0; i <= GRID_W; i++) g.add(box(0.004, 0.002, GRID_H * CELL, M.concrete, [(i - GRID_W / 2) * CELL, 0.0065, 0]));
    for (let j = 0; j <= GRID_H; j++) g.add(box(GRID_W * CELL, 0.002, 0.004, M.concrete, [0, 0.0065, (j - GRID_H / 2) * CELL]));
    const [px, pz] = cellToWorld(PICK.x, PICK.z, [0, 0, 0], CELL);
    g.add(box(0.14, 0.12, 0.2, M.steel, [px + 0.13, 0.06, pz]));
    g.add(box(0.1, 0.008, 0.06, M.label, [px + 0.13, 0.124, pz + 0.05]));
    const armBase = new THREE.Group(); armBase.position.set(px + 0.13, 0.12, pz);
    armBase.add(box(0.03, 0.16, 0.03, M.agv, [0, 0.08, 0])); g.add(armBase);
    const agvs = [];
    for (let i = 0; i < COUNT; i++) { const a = buildAgv(M); g.add(a); agvs.push(a); }
    agvs[0].children[1].material = M.hi;                                                   // 目标那台的货架高亮
    root.add(g); parts.warehouse = { g, agvs, armBase };
  }
  // ── 3 打包台：辊筒台 + 纸箱自动折起 + 面单打印机 + 一摞平纸板 ──
  {
    const g = atStation('pack');
    g.add(box(0.8, 0.06, 0.42, M.belt, [0, 0.06, 0]));
    for (let x = -0.36; x <= 0.36; x += 0.06) { const r = cyl(0.012, 0.012, 0.4, M.roller, [x, 0.095, 0], 8); r.rotation.x = Math.PI / 2; g.add(r); }
    for (const [x, z] of [[-0.37, -0.18], [0.37, -0.18], [-0.37, 0.18], [0.37, 0.18]]) g.add(box(0.03, 0.06, 0.03, M.dark, [x, 0.03, z]));
    const printer = new THREE.Group(); printer.position.set(0.0, 0, -0.3);
    printer.add(box(0.2, 0.22, 0.12, M.steel, [0, 0.11, 0])); printer.add(box(0.12, 0.02, 0.01, M.label, [0, 0.17, 0.062])); g.add(printer);
    for (let k = 0; k < 6; k++) g.add(box(0.3, 0.008, 0.26, M.box, [-0.58, 0.004 + k * 0.009, -0.05 + (k % 2) * 0.006]));
    const parcel = buildParcel(item.box, M); parcel.position.set(0, 0.11, 0); g.add(parcel);
    const prod = buildProduct({ kind: item.model, colors: item.colors }); prod.scale.setScalar(0.12); prod.position.set(0, 0.11, 0); g.add(prod);
    root.add(g); parts.pack = { g, parcel, prod };
  }
  // ── 4 分拣线：长传送带 + 扫描门（红光）+ 摆轮 + 朝相机一侧的道口滑槽 ──
  {
    const g = atStation('sorter');
    g.add(box(1.4, 0.06, 0.16, M.belt, [0, 0.07, 0]));
    for (const z of [-0.09, 0.09]) g.add(box(1.4, 0.03, 0.012, M.steel, [0, 0.11, z]));
    for (let x = -0.65; x <= 0.65; x += 0.26) g.add(box(0.03, 0.07, 0.17, M.dark, [x, 0.035, 0]));
    const arch = new THREE.Group(); arch.position.set(-0.15, 0, 0);
    arch.add(box(0.03, 0.26, 0.03, M.steel, [0, 0.13, -0.11]), box(0.03, 0.26, 0.03, M.steel, [0, 0.13, 0.11]), box(0.03, 0.03, 0.25, M.steel, [0, 0.26, 0]));
    arch.add(box(0.01, 0.006, 0.2, M.scan, [0.016, 0.245, 0])); g.add(arch);
    const divert = box(0.12, 0.02, 0.15, M.agv, [0.12, 0.105, 0]); g.add(divert);
    const chute = box(0.16, 0.025, 0.36, M.steel, [0.22, 0.06, 0.25]); chute.rotation.x = 0.18; g.add(chute);
    g.add(box(0.18, 0.12, 0.16, M.rack, [0.22, 0.06, 0.5]));                               // 道口的笼车
    const boxes = [];
    for (let i = 0; i < 6; i++) { const b = buildParcel(item.box, M); b.scale.setScalar(0.62); boxes.push(b); g.add(b); }
    boxes[2].userData.label.visible = true;
    root.add(g); parts.sort = { g, divert, boxes };
  }
  // ── 5 月台 + 卡车（车头朝前，沿路开走） ──
  {
    root.add(laneSlab(S_OUT - 0.35, S_OUT + 0.15, -0.45, 0.45, M.concrete, 0.12, 0.12));   // 月台
    const truck = new THREE.Group(); truck.rotation.y = TH;
    const body = new THREE.Group(); body.scale.setScalar(1.5); truck.add(body);
    body.add(box(0.3, 0.17, 0.18, M.truck, [0, 0.145, 0]));
    body.add(box(0.302, 0.03, 0.182, M.band, [0, 0.1, 0]));
    body.add(box(0.12, 0.13, 0.17, M.label, [0.22, 0.105, 0]));
    body.add(box(0.01, 0.06, 0.15, glow('#1e2a3c', 0.3), [0.281, 0.13, 0]));
    body.add(box(0.008, 0.02, 0.03, M.bulb, [0.282, 0.07, 0.06]), box(0.008, 0.02, 0.03, M.bulb, [0.282, 0.07, -0.06]));
    const doorL = new THREE.Group(), doorR = new THREE.Group(); doorL.position.set(-0.152, 0, 0.09); doorR.position.set(-0.152, 0, -0.09);
    doorL.add(box(0.008, 0.16, 0.09, M.rack, [0, 0.145, -0.045])); doorR.add(box(0.008, 0.16, 0.09, M.rack, [0, 0.145, 0.045]));
    body.add(doorL, doorR);
    for (const [dx, dz] of [[0.2, 0.09], [0.2, -0.09], [-0.08, 0.09], [-0.08, -0.09]]) { const w = cyl(0.038, 0.038, 0.03, M.tyre, [dx, 0.038, dz], 12); w.rotation.x = Math.PI / 2; body.add(w); }
    root.add(truck); parts.truck = { truck, doorL, doorR };
  }
  // ── 7 + 8 三轮车、快递员、门口（按 item 换配色） ──
  {
    const porch = atStation('door');
    porch.add(box(0.5, 0.03, 0.22, M.porch, [0, 0.015, 0.04]));                           // 门廊地台
    porch.add(box(0.3, 0.012, 0.1, mat('#b0533a'), [0, 0.036, 0.09]));                    // 门垫
    porch.add(box(0.26, 0.38, 0.03, M.trim, [0, 0.19, -0.075]));                           // 门框
    const doorPivot = new THREE.Group(); doorPivot.position.set(-0.11, 0, -0.055);
    doorPivot.add(box(0.22, 0.34, 0.025, M.door, [0.11, 0.17, 0]), box(0.02, 0.02, 0.02, M.trim, [0.19, 0.17, 0.02])); porch.add(doorPivot);
    const inside = box(0.22, 0.34, 0.01, glow('#ffc978', 0.0), [0, 0.17, -0.07]); porch.add(inside);
    porch.add(box(0.04, 0.03, 0.03, M.bulb, [0.18, 0.36, -0.05]));                       // 门灯
    const warm = new THREE.PointLight('#ffcf8a', 0, 1.4, 1.5); warm.position.set(0, 0.22, 0.08); porch.add(warm);
    const parcel = buildParcel(item.box, M); parcel.scale.setScalar(0.45); parcel.position.set(0.16, 0.03, 0.07); parcel.userData.label.visible = true; porch.add(parcel);
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

  const handle = {
    root, parts, M, plan, item, scene, key, amb,
    env: null,
    post: { exposure: 1.0, vignette: 0.28, grain: 0.02, bloom: { strength: 0.3, threshold: 0.82 }, saturation: 1.08 },
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
    a.children[1].position.y = 0.07 + 0.01 * o.moving * Math.abs(Math.sin(lt * 8 + i));
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
  d.trike.children[1].visible = riding;                                                      // 厢上的面单小箱：上车时在，下车抱走
  d.parcel.visible = placed;
  const open = easeInOut(ss(0.4, 1.4, dl));
  d.doorPivot.rotation.y = open * 1.25;
  d.inside.material.emissiveIntensity = 1.4 * open;
  d.warm.intensity = 1.6 * open;
}
const C = (h) => new THREE.Color(h);
const SKY = { nightTop: C('#0b1430'), nightLow: C('#24356a'), dawnTop: C('#6f97d3'), dawnLow: C('#ffb27a'), midLow: C('#d77a7a') };
const tmpA = new THREE.Color(), tmpB = new THREE.Color();
function updateLight(w, t, focus, sky, glows) {
  // out：从仓库出到室外（8.6–9.4 s 平滑过渡）；dawn：室外的夜 → 黎明（9.6–13.4 s）
  const out = ss(8.6, 9.4, t), dawn = ss(9.6, 13.4, t);
  const kIn = C('#e8efff'), kNight = C('#8ea6e0'), kDawn = C('#ffb87a');
  w.key.color.copy(kIn).lerp(kNight, out).lerp(kDawn, dawn);
  w.key.intensity = lerp(lerp(2.4, 1.1, out), 2.7, dawn);
  w.amb.color.copy(C('#e8eeff')).lerp(C('#56679a'), out).lerp(C('#ffd9bf'), dawn);
  w.amb.groundColor.copy(C('#4a4f57')).lerp(C('#1d2333'), out).lerp(C('#6a4a3a'), dawn);
  w.amb.intensity = lerp(lerp(0.95, 0.6, out), 0.9, dawn);
  // 主光从侧后方斜打（黎明时更低、更暖），阴影跟着取景点
  const lowK = lerp(1, 0.55, dawn);
  w.key.position.set(focus[0] + 2.5, 5.5 * lowK + 1.2, focus[2] + 3.2);
  w.key.target.position.set(focus[0], 0, focus[2]); w.key.target.updateMatrixWorld();
  // 天幕渐变：底色先变粉紫再变橙，顶色从深蓝到浅蓝
  const top = tmpA.copy(SKY.nightTop).lerp(SKY.dawnTop, dawn);
  const low = tmpB.copy(SKY.nightLow).lerp(SKY.midLow, ss(0, 0.55, dawn)).lerp(SKY.dawnLow, ss(0.45, 1, dawn));
  const pos = sky.geometry.attributes.position, col = sky.geometry.attributes.color, H = 3.2;
  for (let i = 0; i < pos.count; i++) { const k = clamp((pos.getY(i) + H / 2) / H); const c = tmpLow.copy(low).lerp(top, Math.pow(k, 0.7)); col.setXYZ(i, c.r, c.g, c.b); }
  col.needsUpdate = true;
  w.scene.background.copy(low);
  for (const g of glows) g.m.emissiveIntensity = g.k * (1 - 0.85 * dawn);
}
const tmpLow = new THREE.Color();
