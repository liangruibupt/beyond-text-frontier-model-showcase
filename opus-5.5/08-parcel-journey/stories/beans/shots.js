// stories/beans/shots.js — 咖啡豆的六个镜头：世界只看故事时间，机位见 meta.js 的 RIG（每镜慢推，镜头之间叠化）
import { poseFor, FOV, storyT } from './meta.js';
import { rowsFor } from '../../meta.js';
import { layersFor } from '../../captions.js';

const text = (ctx, s) => layersFor(ctx.variant, s);
function frame(ctx, s, lt = s.lt) {
  const p = poseFor(s.name, lt, rowsFor(ctx.ar ?? ctx.variant?.ar));
  ctx.world.update({ t: storyT(s.name, lt), focus: p.target });
  return { type: 'free', position: p.position, target: p.target, offset: p.offset, fov: FOV };
}
// 微距镜头景深开得大（咖啡豆、豆袋、手冲），夜景地图和老街收一点
export const SHOTS = {
  roast(ctx, s) { return { camera: frame(ctx, s), text: text(ctx, s), post: { aperture: 0.9, maxBlur: 0.014 } }; },
  cool(ctx, s) { return { camera: frame(ctx, s), text: text(ctx, s), post: { aperture: 1.0, maxBlur: 0.016 } }; },
  bag(ctx, s) { return { camera: frame(ctx, s), text: text(ctx, s), post: { aperture: 1.0, maxBlur: 0.016 } }; },
  night(ctx, s) { return { camera: frame(ctx, s), text: text(ctx, s), post: { aperture: 0.5, maxBlur: 0.012, bloom: { strength: 0.45, threshold: 0.75 } } }; },
  alley(ctx, s) { return { camera: frame(ctx, s), text: text(ctx, s), post: { aperture: 0.4, maxBlur: 0.01 } }; },
  /** 手冲：注水、闷蒸，lt ≥ 2.0 之后画面停住（6 秒版 pour 要播 3 s），片尾卡 / 价签照常入场 */
  pour(ctx, s) { return { camera: frame(ctx, s, Math.min(s.lt, 2.0)), text: text(ctx, s), post: { aperture: 0.9, maxBlur: 0.014, bloom: { strength: 0.3, threshold: 0.8 } } }; },
};
