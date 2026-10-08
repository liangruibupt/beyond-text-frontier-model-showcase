// shots.js — 六个镜头：都对准转台上的商品（fit 取景），把图形层按组件纯函数的输出重绘，字幕走 captions。
// 镜头本地时间 s.lt / 成片时间 s.t；chrome / danmaku 常驻，按成片时间算（跨镜头连续）。overlay 每帧重绘（确定，只看 t）。
import { chrome } from './pack/chrome.js';
import { danmaku } from './pack/danmaku.js';
import { countdown } from './pack/countdown.js';
import { cart } from './pack/cart.js';
import { envelopes } from './pack/envelopes.js';
import { stockbar } from './pack/stockbar.js';
import { layersFor } from '../captions.js';
import { DANMAKU } from '../copy.js';

/** 公共取景：fit 到影棚主体盒，anchor/size 从构图行取（兜底 fit） */
function frame(ctx, s) {
  const box = ctx.world?.subjectBox ?? new ctx.THREE.Box3(new ctx.THREE.Vector3(-0.35, 0, -0.35), new ctx.THREE.Vector3(0.35, 0.6, 0.35));
  return { box, dir: [0.15, 0.22, 1], fov: 34 };
}

/** 画常驻外框（chrome 心形 + danmaku）到 overlay。cut 决定弹幕滚动的参照时长。 */
function paintChrome(ctx, s, { stock = false } = {}) {
  const ov = ctx.world?.overlay; if (!ov) return;
  const v = ctx.variant, filmT = s.t, dur = ctx.built?.duration ?? 15;
  const ch = chrome(filmT, { dur, liveAt: v.cut === 15 ? 0.5 : -1 });
  const dm = danmaku(filmT, { lines: DANMAKU[v.lang], dur, stock });
  ov.draw.drawDanmaku(dm);
  ov.draw.drawHearts(ch.hearts);
}

/** 组装 overlay：清屏 → 背景常驻（弹幕 / 心形）→ 本镜图形。返回给 render 用。 */
function begin(ctx) { ctx.world?.overlay?.draw.clear(); }
function commit(ctx) { const ov = ctx.world?.overlay; if (ov) { ov.attach(ctx.camera); ov.draw.commit(); } }

export const SHOTS = {
  // 1 room 0–2.5：推近直播间，商品转，外框 / 弹幕出现，在线人数跳。只有常驻外框 + 字幕。
  room(ctx, s) {
    begin(ctx); paintChrome(ctx, s); commit(ctx);
    return { camera: frame(ctx, s), text: layersFor(ctx.variant, s) };
  },
  // 2 count 2.5–5.0：中央大号倒计时 3/2/1，每个砸下带冲击波；上链接炸开。15 秒版本地拍点 0.5/1.0/1.5，link 2.0。
  count(ctx, s) {
    begin(ctx); paintChrome(ctx, s);
    const cd = countdown(s.lt, { beats: [0.5, 1.0, 1.5], digits: ['3', '2', '1'], linkAt: 2.0 });
    ctx.world?.overlay?.draw.drawCountdown(cd);
    commit(ctx);
    return { camera: frame(ctx, s), text: layersFor(ctx.variant, s) };
  },
  // 3 cart 5.0–7.5：购物车弹窗从底部弹上，6.5 点击水波纹 + 角标 +1。文字（名/价/原价/按钮）走文字层。
  cart(ctx, s) {
    begin(ctx); paintChrome(ctx, s);
    const c = cart(s.lt, { riseAt: 0, tapAt: 1.5 });
    ctx.world?.overlay?.draw.drawCartBoard(c, ctx.world?.rows?.cart ?? {});
    commit(ctx);
    return { camera: { ...frame(ctx, s) }, text: layersFor(ctx.variant, s) };
  },
  // 4 rain 7.5–10.5：红包雨，8.0 密集，9.5 拆红包 + 金币 + 「已领券」。字幕「红包雨来了」。
  rain(ctx, s) {
    begin(ctx); paintChrome(ctx, s);
    // 15 秒版 rain 本地 0 起，密集 0.5、拆 2.0；6 秒版 rain from 1.5、dur 1.0，拆在本地 0.5（成片 2.0）
    const openAt = ctx.variant.cut === 15 ? 2.0 : 0.5, denseAt = ctx.variant.cut === 15 ? 0.5 : 0.0;
    const e = envelopes(s.lt, { dur: ctx.variant.cut === 15 ? 3 : 1, denseAt, openAt });
    ctx.world?.overlay?.draw.drawEnvelopes(e);
    commit(ctx);
    return { camera: frame(ctx, s), text: layersFor(ctx.variant, s) };
  },
  // 5 stock 10.5–12.5：库存条 37%→0，仅剩 N 件往下跳，弹幕加速，12.0「已抢光」印章。
  stock(ctx, s) {
    begin(ctx); paintChrome(ctx, s, { stock: true });
    const sb = stockbar(s.lt, { from: 0.37, startCount: 24, soldAt: 1.5, drainTo: 1.5 });
    ctx.world?.overlay?.draw.drawStockbar(sb);
    commit(ctx);
    return { camera: frame(ctx, s), text: layersFor(ctx.variant, { ...s, stockLeft: sb.left }) };
  },
  // 6 end 12.5–15：商品回中心，片尾卡（叠化切入），外框 / 弹幕变淡。
  end(ctx, s) {
    begin(ctx);
    // 外框淡出：末尾不再画弹幕 / 心形（叠化已经让上一镜继续播，这里收束）
    commit(ctx);
    return { camera: { ...frame(ctx, s), dir: [0, 0.18, 1] }, text: layersFor(ctx.variant, s) };
  },
};
