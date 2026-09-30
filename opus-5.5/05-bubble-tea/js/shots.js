// shots.js — 六个镜头：每个镜头只由镜头本地时间 s.lt 决定杯子的姿态、相机意图、字幕与后期
// 框取对象、仰角、方位角都写在 meta.js 的 VIEW 表里（layouts 测试也用它），这里只管随时间怎么动
import * as THREE from 'three';
import { VIEW, BOX, EV, viewDir } from '../meta.js';
import { layersFor } from '../captions.js';
import { SIM } from './pearls.js';
import { lerp, easeInOut, ss, clamp } from '../../factory/engine/ease.js';

const box3 = ([a, b]) => new THREE.Box3(new THREE.Vector3(...a), new THREE.Vector3(...b));
const BOXES = Object.fromEntries(Object.entries(BOX).map(([k, b]) => [k, box3(b)]));

/** 按 VIEW 表框取；方位角随镜头进度 u 从起值缓动到止值 */
function fit(name, s, extra = {}) {
  const V = VIEW[name];
  return { type: 'fit', box: BOXES[V.box], dir: viewDir(V.pitch, lerp(V.yaw[0], V.yaw[1], easeInOut(s.u))), fov: V.fov, ...extra };
}
const text = (ctx, s) => layersFor(ctx.variant, s);
const DONE = { pearlsT: SIM.t1, iceT: 5 };                             // 后面几个镜头里：珍珠已堆好、冰块早已沉稳

export const SHOTS = {
  /** 珍珠落进空杯：烘好的表直接按镜头本地时间取；1.5 秒最后一颗落底 */
  pearls(ctx, s) {
    ctx.subjects.cup.pose({ pearlsT: s.lt, fill: 0, lid: false });
    return { camera: fit('pearls', s, { scale: lerp(1.06, 1, easeInOut(s.u)) }), text: text(ctx, s), post: { aperture: 0.35, maxBlur: 0.008 } };
  },
  /** 注茶、冲奶：茶汤从杯底涨到满杯，0.75 秒奶花在茶里绽开（tea.js 的奶纹由 cup.posed.fill 推进） */
  pour(ctx, s) {
    const fill = easeInOut(ss(0.0, 2.0, s.lt));
    ctx.subjects.cup.pose({ ...DONE, fill, iceT: -1, lid: false });
    ctx.subjects.milk?.(ss(EV.bloom - 0.35, 2.2, s.lt));                // 奶在 bloom 命中点前后冲进来，前沿一路往下
    return { camera: fit('pour', s), text: text(ctx, s) };
  },
  /** 三块冰落进满杯，0.75 秒第二块撞上第一块 */
  ice(ctx, s) {
    ctx.subjects.cup.pose({ pearlsT: SIM.t1, iceT: s.lt - (EV.clink - 0.3), lid: false });
    return { camera: fit('ice', s), text: text(ctx, s) };
  },
  /** 整杯环绕：封好的杯子，杯壁慢慢凝出水珠，1.5 秒一颗滑下来 */
  hero(ctx, s) {
    ctx.subjects.cup.pose({ ...DONE, dewT: 0.6 + s.lt });
    return { camera: fit('hero', s), text: text(ctx, s) };
  },
  /** 吸管从上方压下，封膜凹下去，0.75 秒刺破；吸管插到底，搅动珍珠 */
  straw(ctx, s) {
    const lt = s.lt, press = easeInOut(ss(0.1, EV.punch, lt)), punch = lt - EV.punch, sd = punch >= 0 ? ss(0, 1.1, punch) : clamp(press);
    ctx.subjects.cup.pose({ ...DONE, dewT: 3.6 + lt, press, punch: punch >= 0 ? punch : -1, straw: sd, nudge: punch >= 0 ? punch - 0.5 : -1 });
    return { camera: fit('straw', s), text: text(ctx, s) };
  },
  /** 片尾：杯子插着吸管，缓慢转动 */
  end(ctx, s) {
    ctx.subjects.cup.pose({ ...DONE, dewT: 6, punch: 3, straw: 1 });
    ctx.subjects.cup.root.rotation.y = lerp(-0.2, 0.25, easeInOut(s.u));
    return { camera: fit('end', s), text: text(ctx, s) };
  },
};
