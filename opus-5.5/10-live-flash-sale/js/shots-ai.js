// js/shots-ai.js — AI 变体的镜头函数：画面来自 LTX 片段（world-ai 的 cue），字幕 / 片尾卡仍走和代码版完全相同的 layersFor。
// 相机只是占位（底图是铺满画面的四边形，不吃透视 / 景深）；真正决定画哪一帧的是 ctx.world.cue(name, lt)。
// 叠化、闪白、颗粒、暗角照常由后期处理。图形包状态（packState）在 film.js 的镜头包装里已算好。
import { layersFor } from '../captions.js';

const CAM = { type: 'free', position: [0, 0, 1], target: [0, 0, 0], offset: [0, 0], fov: 35 };

function shot(ctx, s) {
  ctx.world.cue(s.name, s.lt);
  return { camera: CAM, text: layersFor(ctx.variant, s), post: {} };
}

export const SHOTS_AI = { room: shot, count: shot, cart: shot, rain: shot, stock: shot, end: shot };
