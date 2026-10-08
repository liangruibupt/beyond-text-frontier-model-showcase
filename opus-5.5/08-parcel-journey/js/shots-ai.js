// js/shots-ai.js — AI 画面变体的镜头函数：画面来自 LTX 片段（world-ai 的 cue），字幕 / 片尾卡仍走和代码版完全相同的 layersFor。
// 相机只是占位（底图是铺满画面的四边形，不吃透视 / 景深），真正决定画哪一帧的是 ctx.world.cue(name, lt)。
// 叠化、闪白、颗粒、暗角照常由后期处理。镜头名覆盖两条故事线：咖啡豆（roast…pour）和包裹旅程（order…door）。
import { layersFor } from '../captions.js';

const CAM = { type: 'free', position: [0, 0, 1], target: [0, 0, 0], offset: [0, 0], fov: 35 };
const AI = {};   // AI 底图不要引擎再叠景深 / 泛光（画面自带）；颗粒 + 暗角由 world-ai 的 AI_POST 给默认值

function shot(ctx, s, lt = s.lt) {
  ctx.world.cue(s.name, lt);
  return { camera: CAM, text: layersFor(ctx.variant, s), post: AI };
}
const plain = (ctx, s) => shot(ctx, s);

export const SHOTS_AI = {
  roast: plain, cool: plain, bag: plain, night: plain, alley: plain,
  // 手冲：和代码版一致，画面在 lt ≥ 2.0 后停住（6 秒版价签要停满），片尾卡照常入场
  pour(ctx, s) { return shot(ctx, s, Math.min(s.lt, 2.0)); },
  order: plain, robots: plain, pack: plain, sort: plain, truck: plain, lastmile: plain,
  // 门口：片段 89 帧（3.7 s），6 秒版要播 3.5 s，不用停帧；钳在 3.4 s 以防越界
  door(ctx, s) { return shot(ctx, s, Math.min(s.lt, 3.4)); },
  // 胜利（headset-ai 逐镜 AI）：片段 89 帧（3.7 s），6 秒版 victory 播 3 s；钳在 3.6 s 以防越界
  victory(ctx, s) { return shot(ctx, s, Math.min(s.lt, 3.6)); },
};
