// shots.js — 21 个镜头（四款各五个 + 共用片尾）：每个镜头只由镜头本地时间 s.lt 决定丝巾的形状、相机、字幕与后期
// shots.js — 21 个镜头（四款各五个 + 共用片尾）：每个镜头只由镜头本地时间 s.lt 决定丝巾的形状、相机、字幕与后期
// 敦煌五个镜头做完整；宋锦 / 青花 / 云鹤先是占位（平铺或叠好的丝巾 + 字幕），做到时逐个替换
import * as THREE from 'three';
import { layersFor } from '../captions.js';
import { BUST, SCARF } from '../meta.js';
import { clothAt } from '../../factory/engine/cloth.js';
import { foldInto } from './fold.js';
import { ribbonInto } from './ribbon.js';
import { smoothFold } from './sims.js';
import { lerp, easeInOut, ss } from '../../factory/engine/ease.js';

const D = Math.PI / 180;
const dirOf = (pitch, yaw) => [Math.sin(yaw * D) * Math.cos(pitch * D), Math.sin(pitch * D), Math.cos(yaw * D) * Math.cos(pitch * D)];
const box = (a, b) => new THREE.Box3(new THREE.Vector3(...a), new THREE.Vector3(...b));
/** 框住一个盒子：pitch / yaw（度）随 u 从 a 缓到 b */
const fit = (B, s, [p0, p1], [y0, y1], { fov = 30, scale = 1, up = [0, 1, 0] } = {}) => {
  const e = easeInOut(s.u);
  return { type: 'fit', box: B, dir: dirOf(lerp(p0, p1, e), lerp(y0, y1, e)), up, fov, scale };
};
const text = (ctx, s) => layersFor(ctx.variant, s);
/** 丝巾网格的包围盒（当前顶点）：fly 这种整块在动的镜头直接框它 */
function scarfBox(sc) { sc.mesh.geometry.computeBoundingBox(); return sc.mesh.geometry.boundingBox.clone(); }
const fromSim = (ctx, name, t, post) => { const { scarf, sims } = ctx.subjects; clothAt(sims[name], t, scarf.positions); post?.(scarf.positions, scarf.n); scarf.commit(); };
const BUST_BOX = box([-0.26, BUST.base + 0.05, -0.2], [0.26, BUST.top + 0.06, 0.2]);

// ── 敦煌「飞天」 ──
const dunhuang = {
  /** 石台上叠着的丝巾：近景；1.2 秒起风，叠好的最上一层慢慢翻开、掀起来（折叠进度往回走） */
  dh_cave(ctx, s) {
    const { scarf, world } = ctx.subjects, P = world.props.plinth;
    const lift = easeInOut(ss(1.0, 2.25, s.lt));
    const c = [P.c[0] + 0.11, 0, P.c[2] + 0.12];
    foldInto(scarf.positions, scarf.n, 1 - 0.34 * lift, { c, y0: P.top + 0.004 });
    // 风：掀起来的那一层边缘轻轻起伏（只动离石台高的顶点）
    for (let k = 1; k < scarf.positions.length; k += 3) { const h = scarf.positions[k] - P.top; if (h > 0.01) scarf.positions[k] += 0.012 * lift * Math.sin(scarf.positions[k - 1] * 30 + s.lt * 7); }
    scarf.commit();
    const B = box([c[0] - 0.3, P.top - 0.02, c[2] - 0.5], [c[0] + 0.05, P.top + 0.2, c[2] + 0.05]);
    return { camera: fit(B, s, [34, 26], [-28, -16], { fov: 30, scale: lerp(1.0, 1.08, s.u) }), text: text(ctx, s), post: { aperture: 0.25, maxBlur: 0.006 } };
  },
  /** 飘带般盘旋上升：闭式飘带（ribbon.js），丝巾沿手走过的螺旋拖在后面、截面卷成弧、沿长拧转；相机仰着跟，荷兰角 8° */
  dh_fly(ctx, s) {
    const { scarf } = ctx.subjects;
    ribbonInto(scarf.positions, scarf.n, s.lt); scarf.commit();
    const B = scarfBox(scarf).expandByScalar(0.08);
    return { camera: fit(B, s, [-2, 10], [-24, 18], { fov: 34, up: [Math.sin(8 * D), Math.cos(8 * D), 0] }), text: text(ctx, s) };
  },
  /** 仰拍：丝巾在藻井下 30 cm 铺开（平铺，从斜着慢慢转到和藻井对齐），镜头从斜着仰到正对；藻井在它后面露出一圈 */
  dh_ceiling(ctx, s) {
    const { scarf, world } = ctx.subjects, y = world.props.ceiling.y - 0.3, e = easeInOut(s.u);
    scarf.flat([0, y, -0.1], lerp(-0.6, 0, e));
    for (let k = 1; k < scarf.positions.length; k += 3) { const x = scarf.positions[k - 1], z = scarf.positions[k + 1]; scarf.positions[k] += 0.018 * (1 - e * 0.7) * Math.sin(x * 9 + s.lt * 2.2) * Math.cos(z * 7 - s.lt * 1.7); }   // 轻轻起伏，对齐时渐平
    scarf.commit();
    return { camera: fit(box([-0.62, y - 0.02, -0.72], [0.62, y + 0.32, 0.52]), s, [-58, -86], [0, 0], { fov: 38, scale: lerp(0.92, 1, e) }), text: text(ctx, s) };
  },
  /** 落人台肩：烘好的 drape 表（颈后折边去波纹） */
  dh_drape(ctx, s) {
    fromSim(ctx, 'drape', s.lt, smoothFold);
    ctx.subjects.bust.visible = true;
    return { camera: fit(BUST_BOX, s, [12, 8], [-26, -14], { fov: 30 }), text: text(ctx, s) };
  },
  /** 环绕：垂定的最后一帧，相机绕人台 40° */
  dh_hero(ctx, s) {
    fromSim(ctx, 'drape', 3, smoothFold);
    ctx.subjects.bust.visible = true;
    return { camera: fit(BUST_BOX, s, [8, 10], [-14, 26], { fov: 28 }), text: text(ctx, s) };
  },
};

// ── 宋锦「织」 ──
// 时间线（15 s 剪辑）：warp 0–3（光梭从远边织起，织到 45%）→ weave 3–5.25（织完，光梭熄）→ lift 5.25–8.25 → fold 8.25–10.5 → box 10.5–12
// reveal 是 lt 的函数，各镜头自己算，不依赖上一个镜头；6 s 剪辑从 weave 的 0.75 起
const SJ_R = { warp: [0.0, 0.45], weave: [0.45, 1] };
const sjWeave = (ctx, s, [r0, r1], { lead = 0.25, tail = 0.5 } = {}) => {
  const { scarf, world } = ctx.subjects, L = world.props.loom;
  const r = lerp(r0, r1, ss(lead, s.dur - tail, s.lt));
  scarf.flat([0, L.y, 0]); scarf.commit(); scarf.setReveal(r);
  world.props.shuttle(r, r < 1 ? 1 : 1 - ss(s.dur - tail, s.dur - tail + 0.35, s.lt));
  return r;
};
const songjin = {
  /** 开场：夜里的织机，只有金色经线；光梭亮起，从远边一行行把八达晕织出来。低角度贴着机面，慢慢推近 */
  sj_warp(ctx, s) {
    const r = sjWeave(ctx, s, SJ_R.warp, { lead: 0.6, tail: 0 }), L = ctx.subjects.world.props.loom;
    const zf = L.z0 + (L.z1 - L.z0) * r;
    return { camera: fit(box([-0.42, L.y - 0.02, zf - 0.35], [0.42, L.y + 0.06, zf + 0.15]), s, [22, 28], [-34, -20], { fov: 30, scale: lerp(1.0, 1.1, s.u) }), text: text(ctx, s), post: { aperture: 0.2, maxBlur: 0.005 } };
  },
  /** 织成：相机升到机面正上方偏后，光梭推到近边、织完熄灭，整幅纹样亮出来 */
  sj_weave(ctx, s) {
    sjWeave(ctx, s, SJ_R.weave, { lead: 0, tail: 0.6 });
    const L = ctx.subjects.world.props.loom;
    return { camera: fit(box([-0.47, L.y - 0.02, -0.47], [0.47, L.y + 0.02, 0.47]), s, [48, 66], [-18, -4], { fov: 32 }), text: text(ctx, s) };
  },
  /** 提起离机：远边两角被提起，丝巾从机面上揭起来，挂成一幅；相机跟着抬起 */
  sj_lift(ctx, s) {
    fromSim(ctx, 'lift', s.lt);
    const B = scarfBox(ctx.subjects.scarf).expandByScalar(0.06);
    return { camera: fit(B, s, [14, 4], [-26, -10], { fov: 32 }), text: text(ctx, s) };
  },
  /** 空中三折：挂着的一幅落平（转成水平），在空中对折、再对折、再对折，叠成一方；暗背景里只有它 */
  sj_fold(ctx, s) {
    const { scarf } = ctx.subjects, u = ss(0.2, s.dur - 0.15, s.lt), y = 1.25;
    foldInto(scarf.positions, scarf.n, u, { y0: y, c: [0, 0, 0] });
    // 叠的时候整块慢慢转、轻轻起伏（还在空中）
    const rot = lerp(0.5, 0.05, easeInOut(s.u)), cs = Math.cos(rot), sn = Math.sin(rot), P = scarf.positions;
    for (let k = 0; k < P.length; k += 3) { const x = P[k], z = P[k + 2]; P[k] = x * cs - z * sn; P[k + 2] = x * sn + z * cs; P[k + 1] += 0.012 * Math.sin(2.2 * s.lt + x * 4); }
    scarf.commit();
    const B = scarfBox(scarf).expandByScalar(0.05);   // 跟着叠起来的那一方取景（固定框时开头出画、后来缩到角上）
    return { camera: fit(B, s, [42, 52], [-14, 6], { fov: 30 }), text: text(ctx, s) };
  },
  /** 落盒合盖：叠好的一方落进礼盒，盖子合上 */
  sj_box(ctx, s) {
    const { scarf, giftBox } = ctx.subjects, G = giftBox.userData, drop = easeInOut(ss(0, 0.6, s.lt));
    foldInto(scarf.positions, scarf.n, 1, { c: [0.1125, 0, 0.2325], y0: lerp(G.floor + 0.25, G.floor, drop) });
    scarf.commit();
    giftBox.visible = true; G.closeLid?.(ss(0.55, 1.3, s.lt));
    giftBox.rotation.y = scarf.mesh.rotation.y = -0.3;
    return { camera: fit(box([-0.2, G.floor - 0.05, -0.32], [0.2, G.floor + 0.2, 0.3]), s, [34, 40], [-20, -12], { fov: 28 }), text: text(ctx, s) };
  },
};

// ── 青花「瓷」 ──
// 时间线（15 s）：paint 0–3（一支看不见的笔在梅瓶上画出缠枝，主枝画到 70%）→ bloom 3–4.5（画完，钴蓝晕开、瓶转半圈）
// → slip 4.5–8.25（瓶上的青花褪成素白，丝巾在瓶口上方显出、落下、裹着瓶身滑到案上）→ pool 8.25–10.5（下摆堆在案面的褶子，微距）
// → hero 10.5–12（相机升到正上方俯看：瓶口、一圈丝巾）
const qhVase = (ctx, r, spin = 0) => {
  const V = ctx.subjects.world.props.vase, { scarf } = ctx.subjects; V.setReveal(r); V.mesh.rotation.y = spin;
  scarf.flat([0, -1, 0]); scarf.mesh.visible = false;   // 藏起来也要写一遍顶点：否则它停在上一个镜头的形状，帧就依赖于播放顺序
  return V;
};
const VASE_BOX = (V, pad = 0.04) => box([V.x - 0.15 - pad, V.table - 0.01, V.z - 0.15 - pad], [V.x + 0.15 + pad, V.table + V.h + pad, V.z + 0.15 + pad]);
const qinghua = {
  /** 开场：素白的梅瓶，缠枝从瓶肩开始一笔笔画出来；镜头贴近瓶身、从侧面慢慢绕 */
  qh_paint(ctx, s) {
    const V = qhVase(ctx, lerp(0.02, 0.7, ss(0.3, s.dur, s.lt)), -0.3 + 0.25 * s.u);
    const B = box([V.x - 0.14, V.table + 0.14, V.z - 0.14], [V.x + 0.14, V.table + 0.38, V.z + 0.14]);
    return { camera: fit(B, s, [8, 12], [-30, -16], { fov: 28 }), text: text(ctx, s), post: { aperture: 0.2, maxBlur: 0.005 } };
  },
  /** 缠枝不断：画完，瓶转半圈，相机拉开见全瓶 */
  qh_bloom(ctx, s) {
    const V = qhVase(ctx, lerp(0.7, 1, ss(0, 0.8, s.lt)), -0.05 + 1.2 * easeInOut(s.u));
    return { camera: fit(VASE_BOX(V), s, [14, 10], [-14, 4], { fov: 30, scale: lerp(1.1, 1, easeInOut(s.u)) }), text: text(ctx, s) };
  },
  /** 从瓷上来，落在身上：瓶上的青花 0.5 秒里褪成素白，丝巾同时在瓶口上方显出，落下、裹着瓶身滑到案上 */
  qh_slip(ctx, s) {
    const V = qhVase(ctx, 1, 1.15), fade = ss(0, 0.5, s.lt);
    V.setReveal(1 - fade);
    fromSim(ctx, 'slip', Math.min(s.lt, 3)); ctx.subjects.scarf.mesh.visible = true;
    const B = VASE_BOX(V, 0.3).union(scarfBox(ctx.subjects.scarf));
    return { camera: fit(B, s, [18, 22], [-20, -8], { fov: 30 }), text: text(ctx, s) };
  },
  /** 褶子微距：下摆在案面上的一角，浅景深，镜头横移 */
  qh_pool(ctx, s) {
    const V = qhVase(ctx, 0, 1.15); fromSim(ctx, 'slip', 3); ctx.subjects.scarf.mesh.visible = true;
    const x0 = lerp(-0.34, -0.22, s.u), B = box([x0 - 0.12, V.table, 0.12], [x0 + 0.12, V.table + 0.12, 0.34]);
    return { camera: fit(B, s, [20, 16], [-38, -26], { fov: 26 }), text: text(ctx, s), post: { aperture: 0.6, maxBlur: 0.012 } };
  },
  /** 升起俯看：从斜上方升到正上方，瓶口居中，一圈青花丝巾铺开 */
  qh_hero(ctx, s) {
    const V = qhVase(ctx, 0, 1.15); fromSim(ctx, 'slip', 3); ctx.subjects.scarf.mesh.visible = true;
    const B = scarfBox(ctx.subjects.scarf).expandByScalar(0.03);
    return { camera: fit(B, s, [58, 84], [-10, 0], { fov: 30, up: [0, 0, -1] }), text: text(ctx, s) };
  },
};

// ── 占位：平铺（u 越大越往下转）或叠好的丝巾 ──
const flatShot = (ctx, s, y = 0.9) => {
  const { scarf } = ctx.subjects; scarf.flat([0, y, 0], 0.3 * s.u); scarf.commit();
  return { camera: fit(box([-0.48, y - 0.05, -0.48], [0.48, y + 0.05, 0.48]), s, [55, 50], [-15, 10], { fov: 32 }), text: text(ctx, s) };
};
const placeholders = Object.fromEntries(['yh_dusk', 'yh_crane', 'yh_glide', 'yh_land', 'yh_hero'].map(id => [id, flatShot]));

export const SHOTS = {
  ...placeholders,
  ...dunhuang,
  ...songjin,
  ...qinghua,
  /** 片尾：叠好的丝巾（22.5 × 43.5 cm）摆在礼盒里，盒盖靠在后面；整组慢慢转 */
  end(ctx, s) {
    const { scarf, giftBox } = ctx.subjects, G = giftBox.userData;
    foldInto(scarf.positions, scarf.n, 1, { c: [0.1125, 0, 0.2325], y0: G.floor });   // 叠好后在 x ∈ [-0.225, 0]、z ∈ [-0.45, 0]：平移到盒子中心
    scarf.commit();
    giftBox.visible = true; giftBox.rotation.y = scarf.mesh.rotation.y = lerp(-0.35, -0.1, easeInOut(s.u));
    return { camera: fit(box([-0.2, G.floor - 0.05, -0.3], [0.2, G.floor + 0.2, 0.3]), s, [36, 30], [18, 8], { fov: 28 }), text: text(ctx, s) };
  },
};
export { SCARF };
