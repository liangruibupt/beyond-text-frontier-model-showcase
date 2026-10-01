// shots.js — 21 个镜头（四款各五个 + 共用片尾）：每个镜头只由镜头本地时间 s.lt 决定丝巾的形状、相机、字幕与后期
// 敦煌五个镜头做完整；宋锦 / 青花 / 云鹤先是占位（平铺或叠好的丝巾 + 字幕），做到时逐个替换
import * as THREE from 'three';
import { layersFor } from '../captions.js';
import { BUST, SCARF } from '../meta.js';
import { clothAt } from '../../factory/engine/cloth.js';
import { foldInto } from './fold.js';
import { DH_HAND } from './sims.js';
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
const fromSim = (ctx, name, t) => { const { scarf, sims } = ctx.subjects; clothAt(sims[name], t, scarf.positions); scarf.commit(); };
const BUST_BOX = box([-0.26, BUST.base + 0.05, -0.2], [0.26, BUST.top + 0.06, 0.2]);

// ── 敦煌「飞天」 ──
const dunhuang = {
  /** 石台上叠着的丝巾，1.5 秒一阵风把它掀起来（这一段只是 fly 开头之前的预备：叠放 → 被风掀起一角） */
  dh_cave(ctx, s) {
    const { scarf, world } = ctx.subjects, P = world.props.plinth;
    const lift = ss(1.2, 2.25, s.lt);
    foldInto(scarf.positions, scarf.n, 1 - 0.55 * lift, { c: [P.c[0] + 0.05, 0, P.c[2] + 0.11], y0: P.top + 0.004 });
    scarf.commit();
    return { camera: fit(box([P.c[0] - 0.3, P.top - 0.12, P.c[2] - 0.25], [P.c[0] + 0.3, P.top + 0.18, P.c[2] + 0.3]), s, [30, 22], [-22, -12], { fov: 32 }), text: text(ctx, s), post: { aperture: 0.25, maxBlur: 0.006 } };
  },
  /** 飘带般盘旋上升：烘好的 fly 表；相机仰着追，荷兰角 8° */
  dh_fly(ctx, s) {
    fromSim(ctx, 'fly', s.lt);
    const h = DH_HAND(s.lt), B = scarfBox(ctx.subjects.scarf).expandByScalar(0.05);
    return { camera: fit(B, s, [-6, 6], [-30 + h[0] * 20, 20], { fov: 34, up: [Math.sin(8 * D), Math.cos(8 * D), 0] }), text: text(ctx, s) };
  },
  /** 仰拍：丝巾在藻井下铺开（平铺、慢慢转），镜头从斜着仰到正对 */
  dh_ceiling(ctx, s) {
    const { scarf } = ctx.subjects;
    scarf.flat([0, 1.9, -0.1], lerp(-0.5, 0, easeInOut(s.u)));
    for (let k = 1; k < scarf.positions.length; k += 3) { const x = scarf.positions[k - 1], z = scarf.positions[k + 1]; scarf.positions[k] += 0.02 * Math.sin(x * 9 + s.lt * 2.2) * Math.cos(z * 7 - s.lt * 1.7); }   // 轻轻起伏
    scarf.commit();
    return { camera: fit(box([-0.48, 1.86, -0.58], [0.48, 1.94, 0.38]), s, [-62, -88], [0, 0], { fov: 36, scale: lerp(0.9, 1, s.u) }), text: text(ctx, s) };
  },
  /** 落人台肩：烘好的 drape 表 */
  dh_drape(ctx, s) {
    fromSim(ctx, 'drape', s.lt);
    ctx.subjects.bust.visible = true;
    return { camera: fit(BUST_BOX, s, [12, 8], [-26, -14], { fov: 30 }), text: text(ctx, s) };
  },
  /** 环绕：垂定的最后一帧，相机绕人台 40° */
  dh_hero(ctx, s) {
    fromSim(ctx, 'drape', 3);
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
  /** 片尾：叠好的丝巾放在礼盒里（盒子在 film.js 建），慢慢转 */
  end(ctx, s) {
    const { scarf, giftBox } = ctx.subjects;
    foldInto(scarf.positions, scarf.n, 1, { c: [0.1125, 0, 0.2325], y0: 0.92 }); scarf.commit();
    giftBox.visible = true; giftBox.rotation.y = scarf.mesh.rotation.y = lerp(-0.25, 0.2, easeInOut(s.u));
    return { camera: fit(box([-0.22, 0.86, -0.18], [0.22, 0.98, 0.18]), s, [32, 28], [12, 4], { fov: 28 }), text: text(ctx, s) };
  },
};
export { SCARF };
