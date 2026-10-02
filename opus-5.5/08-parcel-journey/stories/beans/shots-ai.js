// stories/beans/shots-ai.js — 咖啡豆 AI 变体的镜头函数：画面来自 LTX 片段（world-ai 的 cue），
// 字幕 / 片尾卡仍走和代码版完全相同的 layersFor。相机只是占位（底图是铺满画面的四边形，不吃透视 / 景深），
// 真正决定画哪一帧的是 ctx.world.cue(name, lt)。叠化、闪白、颗粒、暗角照常由后期处理。
import { layersFor } from '../../captions.js';
import { FOV } from './meta.js';

const text = (ctx, s) => layersFor(ctx.variant, s);
// 固定的占位机位：底图是正交铺满的四边形，位姿不影响成像；给一个合法的 free 机位让引擎的求值链路照常走
const CAM = { type: 'free', position: [0, 0, 1], target: [0, 0, 0], offset: [0, 0], fov: FOV };

// AI 底图不要引擎再叠景深 / 泛光（画面自带）；轻微颗粒 + 暗角由 world-ai 的 AI_POST 给默认值
const AI = {};

function shot(ctx, s, lt = s.lt) {
  ctx.world.cue(s.name, lt);           // 记下该画哪一段的第几秒（film.render 据此 blit）
  return { camera: CAM, text: text(ctx, s), post: AI };
}

export const SHOTS_AI = {
  roast(ctx, s) { return shot(ctx, s); },
  cool(ctx, s) { return shot(ctx, s); },
  bag(ctx, s) { return shot(ctx, s); },
  night(ctx, s) { return shot(ctx, s); },
  alley(ctx, s) { return shot(ctx, s); },
  // 手冲：和代码版一致，画面在 lt ≥ 2.0 后停住（6 秒版价签要停满），片尾卡照常入场
  pour(ctx, s) { return shot(ctx, s, Math.min(s.lt, 2.0)); },
};
