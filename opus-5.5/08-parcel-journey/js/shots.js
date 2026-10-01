// shots.js — 七个镜头：每个镜头只由镜头本地时间 s.lt 决定世界的状态（world.update）、相机意图（free，一镜到底）、字幕与后期
// 机位首尾相接写在 meta.js 的 RIG 表里（poseFor）；这里每个镜头按进度 u 在自己的 a→b 之间缓动插值，相邻镜头接得上
import { poseFor, FOV } from '../meta.js';
import { layersFor } from '../captions.js';
import { easeInOut, clamp } from '../../factory/engine/ease.js';

const text = (ctx, s) => layersFor(ctx.variant, s);

/** free 机位意图：按镜头进度 u（缓动）在 RIG 的 a→b 之间插值；长焦（fov≈10）等距方向 */
function cam(name, s) {
  const p = poseFor(name, easeInOut(s.u));
  return { type: 'free', position: p.position, target: p.target, fov: FOV };
}

export const SHOTS = {
  order(ctx, s) { ctx.world.update(s); return { camera: cam('order', s), text: text(ctx, s), post: { aperture: 0.25, maxBlur: 0.006 } }; },
  robots(ctx, s) { ctx.world.update(s); return { camera: cam('robots', s), text: text(ctx, s) }; },
  pack(ctx, s) { ctx.world.update(s); return { camera: cam('pack', s), text: text(ctx, s), post: { aperture: 0.2, maxBlur: 0.005 } }; },
  sort(ctx, s) { ctx.world.update(s); return { camera: cam('sort', s), text: text(ctx, s) }; },
  truck(ctx, s) { ctx.world.update(s); return { camera: cam('truck', s), text: text(ctx, s) }; },
  lastmile(ctx, s) { ctx.world.update(s); return { camera: cam('lastmile', s), text: text(ctx, s) }; },
  /** 门口：敲门、门开暖光，lt ≥ 2 之后片尾卡 / 价签停住（6 秒版 door 要播 3.5 s，所以到 2 s 以后画面不再变） */
  door(ctx, s) {
    const cap = Math.min(s.lt, 2.0), held = { ...s, lt: cap, t: s.t - (s.lt - cap), u: clamp(cap / s.dur) };
    ctx.world.update(held);
    return { camera: cam('door', held), text: text(ctx, s), post: { exposure: 1.05, bloom: { strength: 0.34, threshold: 0.7 } } };
  },
};
