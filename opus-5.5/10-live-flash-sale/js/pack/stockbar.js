// pack/stockbar.js — 库存条（可复用组件）：纯函数 (localT, params) → 条宽 / 仅剩件数 / 已抢光印章
// 宽度 = 缓入曲线从 37% 到 0；「仅剩 N 件」取整；「已抢光」印章做放大 → 砸下 → 轻抖。闭式，可乱序取样。
import { clamp, easeIn } from '../../../factory/engine/ease.js';

/**
 * params: { from=0.37, startCount=24, dur=2, soldAt=1.5, drainTo=1.5 }
 *   15 秒版 stock 本地 0 起：库存从 37% 往 0 掉，12.0「已抢光」（soldAt 1.5，成片 12.0）。drainTo = 掉空用时。
 * 返回 { width: 0..from, left: 整数件数, soldout: {scale,shake,alpha}|null }
 */
export function stockbar(lt, params = {}) {
  const { from = 0.37, startCount = 24, soldAt = 1.5, drainTo = 1.5 } = params;
  const k = easeIn(clamp(lt / Math.max(drainTo, 1e-6)));      // 0→1 掉空
  const width = from * (1 - k);
  const left = Math.max(0, Math.round(startCount * (1 - k)));
  let soldout = null;
  const sd = lt - soldAt;
  if (sd >= 0) {
    const grow = clamp(sd / 0.1);                              // 0.1 s 砸到最大
    const over = sd < 0.1 ? 1.3 - 0.3 * grow : 1;             // 砸下的过冲
    const shake = sd < 0.4 ? Math.exp(-10 * sd) * Math.sin(40 * sd) * 0.02 : 0;
    soldout = { scale: (0.4 + 0.6 * grow) * over, shake, alpha: 1 };
  }
  return { width, left, soldout };
}
