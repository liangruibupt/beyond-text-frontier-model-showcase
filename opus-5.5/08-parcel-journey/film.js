// film.js — 08 有集次日达：把数据（轴、剪辑表、构图、字体）、世界和镜头交给引擎（见 factory/README.md 的成片约定）
// 分镜 v2：每件商品一条故事线。营地灯（和还没重做的耳机）走一镜到底的包裹旅程（js/），咖啡豆走 stories/beans/
// vo.mjs 会在 Node 里 import 这个文件，所以顶层不能碰 window / document
import { META } from './meta.js';
import { ITEMS } from './items.js';
import { LAYOUTS } from './layouts.js';
import { fontsFor } from './captions.js';
import { voLines, AUDITION } from './copy.js';
import { build as buildWorld } from './js/world.js';
import { SHOTS } from './js/shots.js';
import { score as parcelScore } from './js/score.js';
import { planCrowd } from './js/crowd.js';
import { build as buildBeans } from './stories/beans/world.js';
import { SHOTS as BEANS_SHOTS } from './stories/beans/shots.js';
import { score as beansScore } from './stories/beans/score.js';
import { seedOf } from '../factory/engine/rng.js';

export default {
  ...META,
  layouts: LAYOUTS,
  fonts: fontsFor,
  async setup(ctx) {
    const item = ITEMS[ctx.variant.item];
    if (item.id === 'beans') { ctx.world = buildBeans(ctx, item); ctx.postDefaults = ctx.world.post ?? {}; ctx.subjects = {}; return; }
    // 换商品要重跑机器人路径规划（目标货架跟着商品换）；种子由商品决定，确定
    const plan = planCrowd({ seed: seedOf(`08-${item.id}`) });
    ctx.world = buildWorld(ctx, item, plan);
    // scene.environment 由世界建（PMREM 环境反射）；没有可用渲染器时世界里会退回 null
    ctx.postDefaults = ctx.world.post ?? {};
    ctx.subjects = { plan };                                  // 规划统计放这里，测试和 README 用
  },
  /** 每次求值镜头前复位所有逐帧可变的状态：跳着看和顺序播放得到同一帧 */
  reset(ctx) { ctx.world.reset(); },
  shots: { ...SHOTS, ...BEANS_SHOTS },
  score: (v, built) => (v.item === 'beans' ? beansScore : parcelScore)(v, built),
  voLines,
  audition: AUDITION,
};
