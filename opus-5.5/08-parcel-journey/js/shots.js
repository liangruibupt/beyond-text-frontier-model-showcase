// shots.js — 七个镜头：世界只看故事时间（storyT = 镜头在 15 秒版里的起点 + 镜头本地秒），所以 6 秒版从中段切入、
// 跳着看、顺序播放都是同一帧。机位写在 meta.js 的 RIG：每个镜头先对准自己的主体（hold），末尾 move 窗口交接到下一个镜头
// 的 hold，一镜到底；主体在画面里的位置跟构图表的 anchor 走（setViewOffset），给字幕和片尾卡让位。
import { poseFor, FOV, storyT, rowsFor } from '../meta.js';
import { layersFor } from '../captions.js';

const text = (ctx, s) => layersFor(ctx.variant, s);

/** 摆世界 + 出机位意图。lt 可以被 door 镜头停住 */
function frame(ctx, s, lt = s.lt) {
  const p = poseFor(s.name, lt, rowsFor(ctx.ar ?? ctx.variant?.ar));
  ctx.world.update({ t: storyT(s.name, lt), focus: p.target });
  return { type: 'free', position: p.position, target: p.target, offset: p.offset, fov: FOV };
}

export const SHOTS = {
  order(ctx, s) { return { camera: frame(ctx, s), text: text(ctx, s), post: { aperture: 0.5, maxBlur: 0.01 } }; },
  robots(ctx, s) { return { camera: frame(ctx, s), text: text(ctx, s), post: { aperture: 0.6, maxBlur: 0.012 } }; },   // 前景 AGV 掠过时虚化
  pack(ctx, s) { return { camera: frame(ctx, s), text: text(ctx, s), post: { aperture: 0.55, maxBlur: 0.01 } }; },
  sort(ctx, s) { return { camera: frame(ctx, s), text: text(ctx, s), post: { aperture: 0.5, maxBlur: 0.01 } }; },
  truck(ctx, s) { return { camera: frame(ctx, s), text: text(ctx, s), post: { aperture: 0.4, maxBlur: 0.009 } }; },
  lastmile(ctx, s) { return { camera: frame(ctx, s), text: text(ctx, s), post: { aperture: 0.45, maxBlur: 0.01 } }; },
  /** 门口：敲门、门开暖光，lt ≥ 2 之后画面停住（6 秒版 door 要播 3.5 s），片尾卡 / 价签照常入场 */
  door(ctx, s) {
    return { camera: frame(ctx, s, Math.min(s.lt, 2.0)), text: text(ctx, s), post: { exposure: 1.02, aperture: 0.5, maxBlur: 0.01, bloom: { strength: 0.3, threshold: 0.8 } } };
  },
};
