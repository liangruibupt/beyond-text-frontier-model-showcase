// glass.js — 闻境瓶的玻璃与液体：分层折射 + 地面焦散，由共享的 factory/engine/refract.js 实现，这里只给瓶子自己的数据
// 四遍画进同一张 HDR 目标：世界（第 0 层）→ 液体（第 1 层）→ 玻璃（第 2 层）→ 挡在瓶子前面的喷雾（第 3 层）。
//   形状：bottle.js 导出的 SHAPE（凸八角棱柱：外形、内腔、液体三个实体）；瓶颈当作薄壁管；颈圈 + 喷头 + 瓶盖在焦散里是一根挡光的圆柱；
//   液面涟漪（焦散的液面法线）用 bottle.js 的 RIPPLE，涟漪的时刻取 bottle.posed.ripple。
//   比尔–朗伯吸收、菲涅耳分光、三色色散、磨砂 logo 模糊、焦散网格都在 refract.js 里（说明见 factory/README.md 的「分层折射」）
import { createRefraction, prismShape, LAYER as L } from '../../factory/engine/refract.js';
import { SHAPE, GLASS as G, RIPPLE } from './bottle.js';
import { DIMS } from '../meta.js';

// 玻璃折射率、液体折射率、玻璃吸收（1/米，略偏绿的高白料）、三色折射率差、磨砂模糊半径（画面高度的比例）、磨砂处混入的漫反射、
// 焦散网格分辨率、焦散亮度倍数、四个界面的总透过率、光路出了画面时取的糊开的世界（四分之一分辨率的第几级 mip）
export const OPTICS = { glassIor: 1.5, liquidIor: 1.36, glassAbsorb: [1.6, 0.5, 1.2], dispersion: 0.012, frostBlur: 0.012, frostDiffuse: 0.4, causticGrid: 256, causticGain: 1, interfaces: 0.85, lowLod: 3.5 };
export const LAYER = { liquid: L.liquid, glass: L.glass, over: L.over };
const CAP_R = 0.019;                                                  // 颈圈 + 喷头 + 瓶盖挡光的圆柱半径（瓶盖半宽 18 毫米）

/** 换上折射材质、加焦散和影子替身，返回 { render(target) }：film.render 每帧调用 */
export function createGlass(ctx, bottle, sku) {
  const { glass, liquid } = bottle.parts;
  return createRefraction(ctx, {
    name: 'wenjing', shape: prismShape(SHAPE), optics: OPTICS,
    root: bottle.root, glass, liquid, liquidAbsorb: sku.liquid.absorb,
    neck: { wall: G.wall },
    occluder: { y: [DIMS.body, DIMS.body + DIMS.collar + DIMS.cap], r: CAP_R },
    ripple: RIPPLE, age: () => bottle.posed?.ripple ?? 0,
    aim: [[-DIMS.w / 2, 0, -DIMS.d / 2], [DIMS.w / 2, DIMS.body, DIMS.d / 2]],
  });
}
