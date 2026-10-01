// film.js — 08 一个包裹的旅程：把数据（轴、剪辑表、构图、字体）、一镜到底的世界和七个镜头交给引擎（见 factory/README.md 的成片约定）
// vo.mjs 会在 Node 里 import 这个文件，所以顶层不能碰 window / document
import { META } from './meta.js';
import { ITEMS } from './items.js';
import { LAYOUTS } from './layouts.js';
import { fontsFor } from './captions.js';
import { voLines, AUDITION } from './copy.js';
import { build as buildWorld } from './js/world.js';
import { SHOTS } from './js/shots.js';
import { score } from './js/score.js';
import { planCrowd } from './js/crowd.js';
import { seedOf } from '../factory/engine/rng.js';

export default {
  ...META,
  layouts: LAYOUTS,
  fonts: fontsFor,
  async setup(ctx) {
    const item = ITEMS[ctx.variant.item];
    // 换商品要重跑机器人路径规划（目标货架跟着商品换）；种子由商品决定，确定
    const plan = planCrowd({ seed: seedOf(`08-${item.id}`) });
    ctx.world = buildWorld(ctx, item, plan);
    // scene.environment 由世界建（PMREM 环境反射）；没有可用渲染器时世界里会退回 null
    ctx.postDefaults = ctx.world.post ?? {};
    ctx.subjects = { plan };                                  // 规划统计放这里，测试和 README 用
  },
  /** 每次求值镜头前复位所有逐帧可变的状态：跳着看和顺序播放得到同一帧 */
  reset(ctx) { ctx.world.reset(); },
  shots: SHOTS,
  score,
  voLines,
  audition: AUDITION,
};
