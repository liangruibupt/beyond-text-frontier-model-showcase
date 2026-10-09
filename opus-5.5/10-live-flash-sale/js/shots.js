// shots.js — 六个镜头：对准转台上的商品（fit 取景），返回取景 + 还留在文字层里的字幕。
// 直播间的图形包装（弹幕、外框、倒计时、弹窗、红包、库存、印章）都画在相机前的 overlay 里，由 film.render 统一重绘
// （见 film.js）——那里相机已 posed，平面能放到景深焦距、天然清晰、与自身文字对齐。镜头函数这里只管取景和少数文字层。
import { layersFor } from '../captions.js';

/** 公共取景：fit 到影棚主体盒，各镜头的 anchor/size 由构图行决定（引擎按比例取） */
function frame(ctx, dir = [0.12, 0.2, 1]) {
  const T = ctx.THREE;
  const box = ctx.world?.subjectBox ?? new T.Box3(new T.Vector3(-0.35, 0, -0.35), new T.Vector3(0.35, 0.6, 0.35));
  return { box, dir, fov: 34 };
}

export const SHOTS = {
  room(ctx, s) { return { camera: frame(ctx), text: layersFor(ctx.variant, s) }; },
  count(ctx, s) { return { camera: frame(ctx), text: layersFor(ctx.variant, s) }; },
  cart(ctx, s) { return { camera: frame(ctx, [0.1, 0.16, 1]), text: layersFor(ctx.variant, s) }; },
  rain(ctx, s) { return { camera: frame(ctx), text: layersFor(ctx.variant, s) }; },
  stock(ctx, s) { return { camera: frame(ctx, [0.1, 0.16, 1]), text: layersFor(ctx.variant, s) }; },
  end(ctx, s) { return { camera: frame(ctx, [0, 0.16, 1]), text: layersFor(ctx.variant, s) }; },
};
