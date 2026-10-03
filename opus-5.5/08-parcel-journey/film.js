// film.js — 08 有集次日达：把数据（轴、剪辑表、构图、字体）、世界和镜头交给引擎（见 factory/README.md 的成片约定）
// 分镜 v2：每件商品一条故事线。营地灯（和还没重做的耳机）走一镜到底的包裹旅程（js/），咖啡豆走 stories/beans/
// 咖啡豆和营地灯各有一条 AI 变体（item = beans-ai / lantern-ai）：画面改用 LTX 生成的实拍片段当底图（js/world-ai.js +
// factory/engine/video.js），字幕 / 价签 / 片尾卡 / 配音 / 配乐仍由现有引擎合成。代码版不受影响。
// vo.mjs 会在 Node 里 import 这个文件，所以顶层不能碰 window / document
import { META } from './meta.js';
import { ITEMS, isAiItem, isBeans, isHeadset } from './items.js';
import { LAYOUTS } from './layouts.js';
import { fontsFor } from './captions.js';
import { voLines, AUDITION } from './copy.js';
import { build as buildWorld } from './js/world.js';
import { SHOTS } from './js/shots.js';
import { score as parcelScore } from './js/score.js';
import { build as buildBeans } from './stories/beans/world.js';
import { build as buildAi } from './js/world-ai.js';
import { SHOTS as BEANS_SHOTS } from './stories/beans/shots.js';
import { SHOTS_AI } from './js/shots-ai.js';
import { score as beansScore } from './stories/beans/score.js';
import { build as buildHeadset } from './stories/headset/world.js';
import { SHOTS as HEADSET_SHOTS } from './stories/headset/shots.js';
import { score as headsetScore } from './stories/headset/score.js';
import { planCrowd } from './js/crowd.js';
import { seedOf } from '../factory/engine/rng.js';

export default {
  ...META,
  layouts: LAYOUTS,
  fonts: fontsFor,
  async setup(ctx) {
    const item = ITEMS[ctx.variant.item];
    // AI 变体：不建 3D 场景，预载 LTX 片段的帧序列当底图
    if (isAiItem(item.id)) {
      ctx.world = buildAi(ctx, item);
      await ctx.world.load();                              // 拉清单 + 预载帧图，出片前就位
      ctx.postDefaults = ctx.world.post ?? {};
      ctx.subjects = {};
      return;
    }
    if (item.id === 'beans') { ctx.world = buildBeans(ctx, item); ctx.postDefaults = ctx.world.post ?? {}; ctx.subjects = {}; return; }
    if (item.id === 'headset') { ctx.world = buildHeadset(ctx, item); ctx.postDefaults = ctx.world.post ?? {}; ctx.subjects = {}; return; }
    // 换商品要重跑机器人路径规划（目标货架跟着商品换）；种子由商品决定，确定
    const plan = planCrowd({ seed: seedOf(`08-${item.id}`) });
    ctx.world = buildWorld(ctx, item, plan);
    // scene.environment 由世界建（PMREM 环境反射）；没有可用渲染器时世界里会退回 null
    ctx.postDefaults = ctx.world.post ?? {};
    ctx.subjects = { plan };                                  // 规划统计放这里，测试和 README 用
  },
  /** 每次求值镜头前复位所有逐帧可变的状态：跳着看和顺序播放得到同一帧 */
  reset(ctx) { ctx.world.reset(); },
  /**
   * 自定义成像钩子。引擎只要发现 film.render 存在就对所有变体调用它，所以这里要自己分流：
   * - AI 世界（有 drawInto）：把当前镜头对应的 LTX 帧画进 sceneRT；之后照常走后期（叠化 / 闪白 / 颗粒 / 暗角）。
   * - 其余变体：复刻引擎默认的 3D 成像（renderer.render(scene, camera) → sceneRT）。
   */
  render(ctx, target) {
    if (ctx.world?.drawInto) { ctx.world.drawInto(target); return; }
    const { renderer, scene, camera } = ctx;
    renderer.setRenderTarget(target); renderer.clear(); renderer.render(scene, camera);
  },
  // 代码版与 AI 版用同名镜头，按当前世界分流：AI 世界（有 cue）走 shots-ai（cue 片段 + 同样的字幕），否则走代码版 3D 镜头。
  shots: shotDispatch({ ...SHOTS, ...BEANS_SHOTS, ...HEADSET_SHOTS }),
  score: (v, built) => (isBeans(v.item) ? beansScore : isHeadset(v.item) ? headsetScore : parcelScore)(v, built),
  voLines,
  audition: AUDITION,
};

/** 镜头分流表：同名镜头按 ctx.world 是否是 AI 世界选 3D 或 AI 实现 */
function shotDispatch(code) {
  const out = {};
  for (const [name, fn] of Object.entries(code)) {
    out[name] = (ctx, s) => (ctx.world?.cue ? SHOTS_AI[name](ctx, s) : fn(ctx, s));
  }
  return out;
}
