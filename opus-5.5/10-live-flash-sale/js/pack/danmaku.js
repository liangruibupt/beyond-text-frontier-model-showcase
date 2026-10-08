// pack/danmaku.js — 弹幕（可复用组件）：纯函数 (t, params) → 当前在屏的弹幕条
// 每条评论 i 由 rng 定好车道、出现时间和速度；x = 1 − (t − t0)·v（从右往左）。
// 库存段把速度乘 1.8（stock=true）。弹幕带限定在画面上方 40%（lanes 落在 y∈[yTop,yBot]）。
// 闭式：同一 t 两次相同，可乱序取样，没有逐帧随机。
import { rand, seedOf } from '../../../factory/engine/rng.js';
import { clamp } from '../../../factory/engine/ease.js';

/**
 * params: { lines: string[], dur, lanes=4, seed='danmaku', yTop=0.1, yBot=0.4,
 *           baseV=0.28, span=11, stock=false, speedup=1.8, stockFrom=null }
 * 返回在屏的弹幕 [{ i, text, lane, x, y, alpha }]（x∈画面比例，右进左出）
 *  - 每条在 t0 从 x=1 进入，按速度 v 左移，x<-0.6 时移出（给长句留余量）
 *  - stock=true 时速度整体乘 speedup（§G：stock 段弹幕加速）
 */
export function danmaku(t, params = {}) {
  const { lines = [], dur = 15, lanes = 4, seed = 'danmaku', yTop = 0.1, yBot = 0.4, baseV = 0.28, span = 11, stock = false, speedup = 1.8, count = 28 } = params;
  if (!lines.length) return [];
  const sd = seedOf(seed), out = [];
  const mult = stock ? speedup : 1;
  for (let i = 0; i < count; i++) {
    const lane = Math.floor(rand(sd, i * 5 + 1) * lanes);
    const t0 = rand(sd, i * 5 + 2) * span;                 // 在 0..span 秒间陆续出现（滚动循环）
    const v = (baseV * (0.75 + 0.5 * rand(sd, i * 5 + 3))) * mult;
    const text = lines[(i + Math.floor(rand(sd, i * 5 + 4) * lines.length)) % lines.length];
    const x = 1 - (t - t0) * v;
    if (x > 1.02 || x < -0.6) continue;                    // 还没进 / 已出
    const y = yTop + (yBot - yTop) * ((lane + 0.5) / lanes);
    const alpha = clamp(Math.min((1.02 - x) / 0.08, (x + 0.6) / 0.12), 0, 1);   // 进出各淡一下
    out.push({ i, text, lane, x, y, alpha });
  }
  return out;
}
