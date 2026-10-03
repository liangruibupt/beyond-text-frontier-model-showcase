// stories/headset/shots.js — 电竞耳机的七个镜头：世界只看故事时间，机位见 meta.js 的 RIG（每镜一段推 / 移，镜头之间硬切 / 闪白）。
// 夜城霓虹靠 bloom，微距特写（defeat / order / victory）景深开大；路线地图和雨夜收一点光圈。
import { poseFor, FOV, storyT } from './meta.js';
import { rowsFor } from '../../meta.js';
import { layersFor } from '../../captions.js';

const text = (ctx, s) => layersFor(ctx.variant, s);
function frame(ctx, s, lt = s.lt) {
  const p = poseFor(s.name, lt, rowsFor(ctx.ar ?? ctx.variant?.ar));
  ctx.world.update({ t: storyT(s.name, lt), focus: p.target });
  return { type: 'free', position: p.position, target: p.target, offset: p.offset, fov: FOV };
}
export const SHOTS = {
  defeat(ctx, s) { return { camera: frame(ctx, s), text: text(ctx, s), post: { aperture: 0.7, maxBlur: 0.013, bloom: { strength: 0.5, threshold: 0.7 } } }; },
  order(ctx, s) { return { camera: frame(ctx, s), text: text(ctx, s), post: { aperture: 0.8, maxBlur: 0.013, bloom: { strength: 0.45, threshold: 0.72 } } }; },
  cube(ctx, s) { return { camera: frame(ctx, s), text: text(ctx, s), post: { aperture: 0.45, maxBlur: 0.011, bloom: { strength: 0.55, threshold: 0.7 } } }; },
  route(ctx, s) { return { camera: frame(ctx, s), text: text(ctx, s), post: { aperture: 0.4, maxBlur: 0.01, bloom: { strength: 0.6, threshold: 0.68 } } }; },
  ride(ctx, s) { return { camera: frame(ctx, s), text: text(ctx, s), post: { aperture: 0.55, maxBlur: 0.012, bloom: { strength: 0.5, threshold: 0.7 } } }; },
  lift(ctx, s) { return { camera: frame(ctx, s), text: text(ctx, s), post: { aperture: 0.55, maxBlur: 0.011, bloom: { strength: 0.45, threshold: 0.74 } } }; },
  /** 胜利：13.0 戴上，之后画面停住（6 秒版 victory 要播 3 s），片尾卡 / 价签照常入场 */
  victory(ctx, s) { return { camera: frame(ctx, s, Math.min(s.lt, 1.5)), text: text(ctx, s), post: { aperture: 0.7, maxBlur: 0.013, bloom: { strength: 0.6, threshold: 0.68 } } }; },
};
