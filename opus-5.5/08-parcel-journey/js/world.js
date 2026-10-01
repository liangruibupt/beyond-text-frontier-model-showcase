// world.js — 一镜到底的世界：八个低多边形工位沿对角线依次摆开（手机 → 仓库 → 打包台 → 分拣线 → 月台 → 公路 → 街区 → 门口）
// 全部程序建模，三件商品共用一套部件，靠换颜色和排列区别。随时间动的东西都是闭式（纯 (variant, t)），只有 AGV 群走规划好的表。
// update(s) 按成片时间 s.t 摆好会动的件；reset() 复位所有被 update 改过的状态（叠化 / 拖动都求同一帧）；dispose() 释放资源。
import * as THREE from 'three';
import { clay } from '../../04-year-review/js/models/clay.js';
import { buildProduct } from '../../04-year-review/js/models/product.js';
import { clamp, lerp, ss, easeInOut, easeOut, easeIn } from '../../factory/engine/ease.js';
import { STATIONS, EV } from '../meta.js';
import { planCrowd, agvAt, cellToWorld, GRID_W, GRID_H, PICK, COUNT, STEPS } from './crowd.js';

const CELL = 0.1;                               // 仓库网格一格的世界尺寸（米）
const ORANGE = '#f0820f';                       // 有集橙

// 成片时间里每段的区间（和剪辑表一致，闭式里按 t 判断在哪一段，取镜头本地时间）
const SEG = { order: [0, 1.5], robots: [1.5, 5.0], pack: [5.0, 7.0], sort: [7.0, 9.0], truck: [9.0, 11.0], lastmile: [11.0, 13.0], door: [13.0, 15.0] };
const localT = (name, t) => clamp(t - SEG[name][0], 0, SEG[name][1] - SEG[name][0]);

const mat = (c, o = {}) => clay({ color: c, ...o });
const box = (w, h, d, m, at = [0, 0, 0]) => { const g = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); g.position.set(...at); g.castShadow = g.receiveShadow = true; return g; };
const plate = (w, d, m, at = [0, 0, 0]) => { const g = new THREE.Mesh(new THREE.BoxGeometry(w, 0.02, d), m); g.position.set(...at); g.receiveShadow = true; return g; };

// ── 低多边形部件 ──
/** 一台 AGV：橙色矮方块 + 四个小轮，顶上托一片货架板 */
function buildAgv(m) {
  const g = new THREE.Group();
  g.add(box(0.07, 0.03, 0.09, m.agv, [0, 0.02, 0]));
  const shelf = box(0.06, 0.06, 0.08, m.shelf, [0, 0.07, 0]); g.add(shelf);
  return g;
}
/** 货架（仓库背景，静态几排） */
function shelfRow(m, n) {
  const g = new THREE.Group();
  for (let i = 0; i < n; i++) { const s = box(0.08, 0.16, 0.08, m.rack, [i * 0.14, 0.08, 0]); g.add(s); }
  return g;
}
/** 一只纸箱（商品的包裹）：盖子分四片，可按角度折起 */
function buildParcel(size, m) {
  const [w, h, d] = size, g = new THREE.Group();
  g.add(box(w, h, d, m.box, [0, h / 2, 0]));                                   // 箱体
  const flapM = m.box, t = 0.006;
  const flap = (sx, sz, px, pz, axis) => {
    const piv = new THREE.Group(); piv.position.set(px, h, pz);
    const f = box(sx, t, sz, flapM, [axis === 'x' ? Math.sign(px) * sx / 2 : 0, 0, axis === 'z' ? Math.sign(pz) * sz / 2 : 0]);
    piv.add(f); g.add(piv); return piv;
  };
  g.userData.flaps = [
    flap(w / 2, d, -w / 2, 0, 'x'), flap(w / 2, d, w / 2, 0, 'x'),
    flap(w, d / 2, 0, -d / 2, 'z'), flap(w, d / 2, 0, d / 2, 'z'),
  ];
  // 橙色面单（贴在箱顶，初始藏在箱内，label 命中点弹出）
  const label = box(w * 0.5, 0.004, d * 0.4, m.label, [0, h + 0.002, 0]); label.visible = false;
  g.add(label); g.userData.label = label;
  return g;
}
/** 低多边形快递员：身子 + 头 + 两条腿两条臂（走路是摆臂摆腿的周期函数） */
function buildCourier(m) {
  const g = new THREE.Group();
  g.add(box(0.07, 0.14, 0.05, m.courier, [0, 0.2, 0]));                        // 身子
  g.add(box(0.05, 0.05, 0.05, m.skin, [0, 0.3, 0]));                           // 头
  const legL = box(0.025, 0.12, 0.03, m.dark, [-0.02, 0.06, 0]), legR = box(0.025, 0.12, 0.03, m.dark, [0.02, 0.06, 0]);
  const armL = box(0.02, 0.1, 0.025, m.courier, [-0.045, 0.22, 0]), armR = box(0.02, 0.1, 0.025, m.courier, [0.045, 0.22, 0]);
  for (const [p, y] of [[legL, 0.12], [legR, 0.12], [armL, 0.27], [armR, 0.27]]) p.geometry.translate(0, -y / 100 * 0, 0);
  g.add(legL, legR, armL, armR);
  g.userData.limbs = { legL, legR, armL, armR };
  return g;
}

/** 建整座世界。cells 由 crowd 规划好。返回世界句柄（build/update/reset/dispose 约定见 factory/README） */
export function build(ctx, item, plan) {
  const { scene } = ctx;
  const S = item.street;
  const M = {
    agv: mat(ORANGE), shelf: mat('#5b6b7a'), rack: mat('#44515e', { roughness: 0.8 }),
    floor: mat('#39414b', { roughness: 0.9 }), belt: mat('#2d343d'), roller: mat('#565e68', { metalness: 0.3 }),
    box: mat('#c79a5e', { roughness: 0.85 }), label: mat(ORANGE), truck: mat('#e8e2d6'), tyre: mat('#20242a'),
    courier: mat(S.trim), skin: mat('#e6b98f'), dark: mat('#2b3038'),
    wall: mat(S.wall), door: mat(S.door), ground: mat(S.ground), porch: mat(S.porch), trim: mat(S.trim),
    phone: mat('#1b1f26'), screen: mat('#eef2f6', { emissive: '#dfe8ef', emissiveIntensity: 0.3 }), tableWood: mat('#6b4a2e', { roughness: 0.8 }),
    road: mat('#30343b', { roughness: 0.95 }), hi: mat('#f2b233', { emissive: '#f2b233', emissiveIntensity: 0.4 }),
  };
  const root = new THREE.Group(); scene.add(root);
  const parts = {};
  const prodSpec = { kind: item.model, colors: item.colors };    // buildProduct 按 catalog 条目的 kind/colors 建模

  // 整条对角线的地台（深蓝灰）
  const deck = plate(13, 9, M.floor, [5.0, -0.02, -2.9]); root.add(deck);

  // ── 工位 1 手机（桌上一部手机） ──
  {
    const g = new THREE.Group(); g.position.set(...STATIONS.phone);
    g.add(plate(0.9, 0.7, M.tableWood, [0, 0, 0]));
    const phone = box(0.22, 0.012, 0.44, M.phone, [0, 0.02, 0]);
    const screen = box(0.2, 0.004, 0.42, M.screen, [0, 0.028, 0]); g.add(phone, screen);
    const prod = buildProduct(prodSpec); prod.scale.setScalar(0.18); prod.position.set(0, 0.03, 0.08); g.add(prod);   // 屏幕上的小商品
    const btn = box(0.14, 0.006, 0.05, M.agv, [0, 0.03, -0.14]); g.add(btn);                                       // 「立即下单」橙按钮
    const check = box(0.05, 0.006, 0.05, M.screen, [0, 0.034, -0.14]); check.visible = false; g.add(check);
    root.add(g); parts.phone = { g, btn, check };
  }

  // ── 工位 2 仓库（AGV 群 + 背景货架 + 拣货台） ──
  {
    const g = new THREE.Group(); g.position.set(...STATIONS.warehouse);
    g.add(plate(GRID_W * CELL + 0.2, GRID_H * CELL + 0.2, M.floor, [0, 0.001, 0]));
    for (let r = 0; r < 3; r++) { const row = shelfRow(M, 5); row.position.set(-GRID_W * CELL / 2 + 0.1, 0, -GRID_H * CELL / 2 - 0.14 + r * -0.0); row.position.z = GRID_H * CELL / 2 + 0.05; g.add(row); }
    // 拣货台（最右一列中段）+ 机械臂
    const [px, pz] = cellToWorld(PICK.x, PICK.z, [0, 0, 0], CELL);
    const station = box(0.14, 0.1, 0.14, M.rack, [px + 0.08, 0.05, pz]); g.add(station);
    const armBase = new THREE.Group(); armBase.position.set(px + 0.08, 0.1, pz);
    const arm = box(0.03, 0.14, 0.03, M.shelf, [0, 0.07, 0]); armBase.add(arm); g.add(armBase);
    // 48 台 AGV（实例由规划表驱动）
    const agvs = [];
    for (let i = 0; i < COUNT; i++) { const a = buildAgv(M); g.add(a); agvs.push(a); }
    const hiShelf = agvs[0].children[1]; hiShelf.material = M.hi;                                                  // 目标那台的货架高亮
    root.add(g); parts.warehouse = { g, agvs, armBase, arm, pick: [px, pz] };
  }

  // ── 工位 3 打包台（纸箱自动折起 + 面单） ──
  {
    const g = new THREE.Group(); g.position.set(...STATIONS.pack);
    g.add(plate(0.6, 0.5, M.rack, [0, 0.08, 0]));
    const parcel = buildParcel(item.box, M); parcel.position.set(0, 0.09, 0); g.add(parcel);
    const prod = buildProduct(prodSpec); prod.scale.setScalar(0.12); prod.position.set(0, 0.09, 0); g.add(prod);
    root.add(g); parts.pack = { g, parcel, prod };
  }

  // ── 工位 4 分拣线（传送带 + 一排箱子 + 摆轮） ──
  {
    const g = new THREE.Group(); g.position.set(...STATIONS.sorter);
    const belt = box(0.7, 0.04, 0.12, M.belt, [0, 0.08, 0]); g.add(belt);
    const divert = box(0.14, 0.04, 0.1, M.roller, [0.1, 0.1, 0]); g.add(divert);                                 // 摆轮
    const chute = box(0.12, 0.03, 0.2, M.rack, [0.18, 0.08, 0.14]); g.add(chute);                                 // 右边的道口
    const boxes = [];
    for (let i = 0; i < 5; i++) { const b = buildParcel(item.box, M); b.scale.setScalar(0.8); boxes.push(b); g.add(b); }
    boxes[2].userData.label.visible = true;                                                                        // 我们那只贴了橙面单
    root.add(g); parts.sort = { g, belt, divert, chute, boxes };
  }

  // ── 工位 5 月台 + 卡车 ──
  {
    const g = new THREE.Group(); g.position.set(...STATIONS.dock);
    g.add(box(0.3, 0.12, 0.3, M.rack, [-0.1, 0.06, 0]));                                                           // 月台
    const truck = new THREE.Group();
    truck.add(box(0.3, 0.16, 0.18, M.truck, [0, 0.14, 0]));                                                        // 车厢
    truck.add(box(0.14, 0.12, 0.18, M.truck, [0.22, 0.1, 0]));                                                     // 车头
    const doorL = box(0.01, 0.16, 0.09, M.rack, [-0.15, 0.14, -0.045]), doorR = box(0.01, 0.16, 0.09, M.rack, [-0.15, 0.14, 0.045]);
    truck.add(doorL, doorR);
    for (const [dx, dz] of [[0.18, 0.1], [0.18, -0.1], [-0.08, 0.1], [-0.08, -0.1]]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.03, 12).rotateX(Math.PI / 2), M.tyre); w.position.set(dx, 0.04, dz); w.castShadow = true; truck.add(w); }
    truck.position.set(0.1, 0, 0); truck.traverse(o => { if (o.isMesh) o.castShadow = true; });
    g.add(truck);
    const road = plate(1.2, 0.3, M.road, [0.6, 0.0, 0]); g.add(road);
    root.add(g); parts.truck = { g, truck, doorL, doorR };
  }

  // ── 工位 6 公路（接着月台往门口去的路） ──
  {
    const g = new THREE.Group(); g.position.set(...STATIONS.road);
    g.add(plate(1.4, 0.26, M.road, [0, 0, 0]));
    root.add(g); parts.road = { g };
  }

  // ── 工位 7 + 8 街区与门口（按 item 换配色）：门廊、墙、门、三轮车、快递员 ── 
  {
    const g = new THREE.Group(); g.position.set(...STATIONS.street);
    g.add(plate(1.0, 0.6, M.ground, [0.4, 0, -0.1]));
    // 门廊（共用模型，换配色）
    const porch = new THREE.Group(); porch.position.set(...STATIONS.door.map((v, i) => v - STATIONS.street[i]));
    porch.add(box(0.5, 0.4, 0.08, M.wall, [0, 0.2, -0.1]));                                                        // 墙
    const doorPivot = new THREE.Group(); doorPivot.position.set(-0.1, 0, -0.06);
    const door = box(0.18, 0.34, 0.03, M.door, [0.09, 0.17, 0]); doorPivot.add(door); porch.add(doorPivot);        // 门（绕左边框开）
    porch.add(box(0.5, 0.04, 0.3, M.porch, [0, 0.01, 0.08]));                                                      // 门廊地台
    const warm = new THREE.PointLight('#ffd79a', 0, 1.2); warm.position.set(-0.05, 0.3, 0.0); porch.add(warm);     // 门内暖光（开门时亮）
    const parcel = buildParcel(item.box, M); parcel.position.set(0.0, 0.04, 0.12); parcel.userData.label.visible = true; porch.add(parcel);
    g.add(porch);
    // 电动三轮 + 快递员
    const trike = new THREE.Group();
    trike.add(box(0.14, 0.1, 0.12, M.trim, [0, 0.09, 0]));
    trike.add(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.03, 12).rotateX(Math.PI / 2), M.tyre).translateY(0.05));
    trike.position.set(0.5, 0, 0.1);
    const courier = buildCourier(M); courier.position.set(0.35, 0, 0.12);
    g.add(trike, courier);
    root.add(g); parts.door = { g, porch, doorPivot, warm, parcel, courier, trike };
  }

  // ── 灯光：仓库冷光 + 一盏主平行光（天色随时间变暖，update 里改） ──
  const key = new THREE.DirectionalLight('#cfe0ff', 2.2);
  key.position.set(STATIONS.dock[0] + 4, 6, STATIONS.dock[2] + 5); key.castShadow = true;
  Object.assign(key.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 1, far: 30 });
  key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0005;
  const amb = new THREE.HemisphereLight('#dfe8ff', '#1a1d22', 0.6);
  scene.add(key, key.target, amb);
  key.target.position.set(STATIONS.dock[0], 0, STATIONS.dock[2]);

  scene.background = new THREE.Color('#141922');

  const handle = {
    root, parts, M, plan, item, scene,
    env: null,
    post: { exposure: 1.0, vignette: 0.3, grain: 0.02, bloom: { strength: 0.3, threshold: 0.78 }, saturation: 1.08 },
    key, amb,
    /** 按成片时间摆好所有会动的件（闭式；AGV 走规划表）。s = { t, lt, u, name } */
    update(s) {
      const t = s.t;
      updateAgvs(parts.warehouse, plan.cells, localT('robots', t), t);
      updatePack(parts.pack, localT('pack', t));
      updateSort(parts.sort, localT('sort', t), item.box);
      updateTruck(parts.truck, localT('truck', t));
      updateDoor(parts.door, localT('door', t));
      updateSky(this, t);
    },
    reset() {
      // 复位所有 update 会改的状态（叠化 / 拖动求同一帧）；AGV 恢复到规划表 lt=0 的位置
      updateAgvs(parts.warehouse, plan.cells, 0, 0);
      parts.warehouse.armBase.rotation.z = 0;
      parts.phone.check.visible = false; parts.phone.check.scale.setScalar(0); parts.phone.btn.scale.setScalar(1);
      parts.pack.parcel.userData.flaps.forEach(f => f.rotation.set(0, 0, 0));
      parts.pack.parcel.userData.label.visible = false; parts.pack.parcel.userData.label.scale.setScalar(1); parts.pack.prod.visible = true;
      parts.sort.divert.rotation.y = 0; parts.sort.boxes.forEach(b => { b.position.set(0, 0, 0); b.visible = true; });
      parts.truck.truck.position.x = 0.1; parts.truck.doorL.rotation.y = 0; parts.truck.doorR.rotation.y = 0;
      parts.door.doorPivot.rotation.y = 0; parts.door.warm.intensity = 0; parts.door.trike.position.x = 0.5;
      parts.door.courier.position.x = 0.35;
      const { legL, legR, armL, armR } = parts.door.courier.userData.limbs; legL.rotation.x = legR.rotation.x = armL.rotation.x = armR.rotation.x = 0;
      this.key.color.set('#cfe0ff'); this.key.intensity = 2.2; this.amb.intensity = 0.6; this.amb.color.set('#dfe8ff');
      scene.background.set('#141922');
    },
    dispose() {
      root.traverse(o => { o.geometry?.dispose?.(); if (Array.isArray(o.material)) o.material.forEach(m => m.dispose?.()); else o.material?.dispose?.(); });
      scene.remove(key, key.target, amb, root);
    },
  };
  // order 镜头的按钮弹对勾也在 update 里：顺手在这里挂
  const baseUpdate = handle.update.bind(handle);
  handle.update = (s) => { baseUpdate(s); updateOrder(parts.phone, localT('order', s.t)); };
  return handle;
}

// ── 各工位的闭式动画 ──
function updateOrder(phone, lt) {
  const press = ss(EV.tap - 0.1, EV.tap + 0.05, lt);                           // 1.0 s 点下
  phone.btn.scale.setScalar(1 - 0.25 * press * (1 - press) * 4);
  phone.check.visible = lt >= EV.tap;
  phone.check.scale.setScalar(easeOut(ss(EV.tap, EV.tap + 0.3, lt)));
}
function updateAgvs(wh, cells, lt, t) {
  const o = { x: 0, z: 0, heading: 0, moving: 0 };
  for (let i = 0; i < COUNT; i++) {
    agvAt(cells, i, lt, o);
    const [wx, wz] = cellToWorld(o.x, o.z, [0, 0, 0], CELL);
    const a = wh.agvs[i];
    a.position.set(wx, 0, wz);
    a.rotation.y = -o.heading;                                                 // 朝向（网格 x 对应世界 x）
    a.children[1].position.y = 0.07 + 0.012 * o.moving * Math.abs(Math.sin(lt * 8 + i));   // 走时货架轻微弹动
  }
  // 机械臂在 pick 命中点（robots 本地 2.5 s）转下来取货
  wh.armBase.rotation.z = -0.9 * easeInOut(ss(EV.pick - 0.3, EV.pick + 0.4, lt));
}
function updatePack(pack, lt) {
  // 六片（这里四片盖）绕折痕错开折起，EV.label(1.5) 面单打出
  const flaps = pack.parcel.userData.flaps;
  flaps.forEach((f, i) => {
    const k = easeInOut(ss(0.2 + i * 0.18, 1.0 + i * 0.18, lt));
    const sign = i < 2 ? (i === 0 ? 1 : -1) : (i === 2 ? 1 : -1);
    if (i < 2) f.rotation.z = sign * (Math.PI / 2) * k; else f.rotation.x = sign * (Math.PI / 2) * k;
  });
  pack.prod.visible = lt < 0.9;                                                // 商品被盖进箱子
  const lab = pack.parcel.userData.label; lab.visible = lt >= EV.label;
  lab.scale.setScalar(easeOut(ss(EV.label, EV.label + 0.3, lt)));
}
function updateSort(sort, lt, size) {
  const w = size[0] * 0.8;
  sort.boxes.forEach((b, i) => {
    const base = -0.3 + i * 0.14 + lt * 0.18;                                   // 匀速流过
    if (i === 2) {
      // 我们那只：divert(1.0) 后沿弧线被拨进右道口
      const k = ss(EV.divert, EV.divert + 0.6, lt);
      b.position.set(0.1 + 0.08 * k, 0.0, 0.14 * easeInOut(k));
      b.position.x += (1 - ss(0, EV.divert, lt)) * (base - 0.1);
    } else b.position.set(base, 0, 0);
    b.visible = b.position.x < 0.42;
  });
  sort.divert.rotation.y = 0.6 * easeInOut(ss(EV.divert - 0.1, EV.divert + 0.3, lt)) * (1 - ss(EV.divert + 0.6, EV.divert + 1.0, lt));
}
function updateTruck(truck, lt) {
  const close = easeInOut(ss(0.0, 0.4, lt));
  truck.doorL.rotation.y = -close * 1.2; truck.doorR.rotation.y = close * 1.2;
  truck.truck.position.x = 0.1 + easeIn(ss(EV.depart, 2.0, lt)) * 3.5;          // 0.5 s 发车，开出画面
}
function updateDoor(door, lt) {
  // 快递员走到门口放下箱子，敲门两下，门开出暖光（door 本地 0 的那一拍敲门 = 成片 13.0）
  const walk = ss(0, 1.0, lt);
  door.courier.position.x = lerp(0.35, 0.08, easeInOut(walk));
  const { legL, legR, armL, armR } = door.courier.userData.limbs, sw = Math.sin(lt * 10) * (1 - walk) * 0.6;
  legL.rotation.x = sw; legR.rotation.x = -sw; armL.rotation.x = -sw; armR.rotation.x = sw;
  const open = easeInOut(ss(0.4, 1.6, lt));
  door.doorPivot.rotation.y = -open * 1.3;
  door.warm.intensity = open * 1.4;
  door.trike.position.x = 0.5;
}
function updateSky(w, t) {
  // 出了月台（9.0 s）以后，天色从深夜蓝过渡到黎明橙；仓库里是冷光
  const dawn = ss(9.0, 14.0, t);
  w.key.color.setRGB(lerp(0.81, 1.0, dawn), lerp(0.88, 0.82, dawn), lerp(1.0, 0.62, dawn));
  w.key.intensity = lerp(2.2, 2.8, dawn);
  w.amb.intensity = lerp(0.6, 0.82, dawn);
  w.amb.color.setRGB(lerp(0.87, 1.0, dawn), lerp(0.91, 0.9, dawn), lerp(1.0, 0.85, dawn));
  // 深夜蓝 (#141922) → 黎明橙 (#e8976a)
  w.scene.background.setRGB(lerp(0.078, 0.91, dawn), lerp(0.098, 0.59, dawn), lerp(0.133, 0.42, dawn));
}
