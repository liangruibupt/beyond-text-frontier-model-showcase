// pack/chrome.js — 直播间外框（可复用组件）：纯函数 (t, params) → 外框状态
// 在线人数 = 起点 + 按 t 的缓动增量（取整显示）；点赞心形用 drift 闭式漂起。
// 没有逐帧随机、没有 Date.now：同一 t 两次调用结果相同，可乱序取样。
import { clamp, easeOut } from '../../../factory/engine/ease.js';
import { drift } from '../../../factory/engine/particles.js';
import { seedOf } from '../../../factory/engine/rng.js';

/**
 * params: { dur, from=128000, to=136000, hearts=10, seed='chrome', liveAt=0.5 }
 * 返回 { viewers, live, hearts: [{x,y,phase,fade}] }
 *  - viewers：在线人数（整数），从 from 缓升到 to
 *  - live：LIVE 标是否点亮（t >= liveAt）
 *  - hearts：右下往上飘的点赞心形，画面比例坐标（x,y∈[0,1]），drift 闭式
 */
export function chrome(t, params = {}) {
  const { dur = 15, from = 128000, to = 136000, hearts = 10, seed = 'chrome', liveAt = 0.5 } = params;
  const k = easeOut(clamp(t / Math.max(dur, 1e-6)));
  const viewers = Math.round(from + (to - from) * k);
  const sd = seedOf(seed);
  const out = [];
  // 心形在画面右下角一条竖带里升起（x 0.9–0.98，y 从 1 往上到 0.55）；drift 的主轴是 y（向上）
  const box = [0.9, 0.55, 0, 0.98, 1.0, 0];
  for (let i = 0; i < hearts; i++) {
    const d = drift(sd, i, t, box, { vel: [0, -0.16, 0], sway: 0.015, swayHz: 0.5 });
    out.push({ x: d[0], y: d[1], phase: d[3], fade: d[4] });
  }
  return { viewers, live: t >= liveAt, hearts: out };
}
