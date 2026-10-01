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

// ── 占位：平铺（u 越大越往下转）或叠好的丝巾 ──
const flatShot = (ctx, s, y = 0.9) => {
  const { scarf } = ctx.subjects; scarf.flat([0, y, 0], 0.3 * s.u); scarf.commit();
  return { camera: fit(box([-0.48, y - 0.05, -0.48], [0.48, y + 0.05, 0.48]), s, [55, 50], [-15, 10], { fov: 32 }), text: text(ctx, s) };
};
const foldShot = (ctx, s) => {
  const { scarf } = ctx.subjects; foldInto(scarf.positions, scarf.n, s.u, { y0: 0.9 }); scarf.commit();
  return { camera: fit(box([-0.48, 0.85, -0.48], [0.48, 1.1, 0.48]), s, [40, 35], [-10, 5], { fov: 32 }), text: text(ctx, s) };
};
const placeholders = Object.fromEntries(['sj_warp', 'sj_weave', 'sj_lift', 'qh_paint', 'qh_bloom', 'qh_slip', 'qh_pool', 'qh_hero', 'yh_dusk', 'yh_crane', 'yh_glide', 'yh_land', 'yh_hero'].map(id => [id, flatShot]));
placeholders.sj_fold = foldShot;
placeholders.sj_box = foldShot;

export const SHOTS = {
  ...placeholders,
  ...dunhuang,
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
