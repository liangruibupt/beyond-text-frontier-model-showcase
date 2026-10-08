// pack/danmaku.js — 弹幕（可复用组件）：纯函数 (t, params) → 当前在屏的弹幕条，车道内绝不重叠。
// 做法（闭式、无碰撞）：每条车道是一条「传送带」，位置只由单调函数 P(t)=∫v 决定；车道里每条评论钉在固定的
// 传送带偏移 k·spacing 上（spacing ≥ 该车道最宽评论 + 间隙）。于是同车道相邻两条的间距恒等于 spacing，与 t、
// 与速度怎么变都无关 —— 包括 stock 段整条车道一起提速（P(t) 对所有评论是同一个函数，相对间距不变）。
// 屏上 x = 1 + laneStart_k − P(t)（右进左出）；x∈[-maxW-gap, 1] 时可见。
import { clamp } from '../../../factory/engine/ease.js';

const LANES = 3;
const FONT = 0.034;                 // 弹幕字号（画面高比例），和 overlay 的 drawDanmaku 一致
const PAD = FONT * 0.55 * 2;         // 胶囊左右衬边（画面高比例；x 轴按画面宽，近似用高比例足够保守）
const GAP = 0.03;                    // 相邻评论的最小间隙（画面宽比例，≥2%）

/** 评论宽度估计（画面宽比例）：CJK 字≈1.0 em、拉丁≈0.58 em、数字/符号≈0.5 em，乘字号；偏宽，保证真实胶囊更窄。
 *  字号是画面高比例；换算到画面宽比例要除以宽高比 aspect=W/H。 */
function widthFrac(text, aspect = 16 / 9) {
  let em = 0;
  for (const ch of text) em += ch.codePointAt(0) >= 0x2e80 ? 1.0 : /[A-Za-z]/.test(ch) ? 0.58 : 0.5;
  return (em * FONT + PAD) / aspect;
}

/** 传送带已走过的距离（画面宽比例）：t 之前匀速 baseV；stockFrom 之后斜率 ×speedup（连续、单调递增）。
 *  导出以便测试「stock 段整条车道一起提速」这一性质。 */
export function conveyor(t, { baseV = 0.1, speedup = 1.8, stockFrom = Infinity } = {}) {
  return baseV * t + baseV * (speedup - 1) * Math.max(0, t - stockFrom);
}

/**
 * params: { lines, dur, seed='danmaku', yTop=0.08, yBot=0.4, baseV=0.1, speedup=1.8, stockFrom=Infinity, aspect=16/9 }
 *   baseV：传送带基础速度（画面宽/秒）。stock 段整条车道提速（P(t) 对 t>stockFrom 斜率×speedup，连续单调）。
 * 返回 [{ i, text, lane, x, y, w, alpha }]（w = 胶囊宽，画面宽比例，overlay 照它画 → 测试与渲染一致）
 */
export function danmaku(t, params = {}) {
  const { lines = [], yTop = 0.08, yBot = 0.4, baseV = 0.1, speedup = 1.8, stockFrom = Infinity, aspect = 16 / 9 } = params;
  if (!lines.length) return [];
  const P = conveyor(t, { baseV, speedup, stockFrom });
  const out = [];
  for (let lane = 0; lane < LANES; lane++) {
    // 这条车道的评论序列（从 lines 里按车道错开取，循环）
    const laneLines = [];
    for (let j = 0; j < lines.length; j++) laneLines.push(lines[(lane * 5 + j) % lines.length]);
    // spacing = 车道里最宽评论 + 间隙（保证任何两条都不重叠）
    const spacing = Math.max(...laneLines.map(s => widthFrac(s, aspect))) + GAP;
    const y = yTop + (yBot - yTop) * ((lane + 0.5) / LANES);
    const phase = (lane / LANES) * spacing;               // 各车道错峰，避免同一瞬间整齐排满
    const Pl = P + phase;
    const kMin = Math.floor((Pl - 1) / spacing) - 1, kMax = Math.ceil((Pl + 0.6) / spacing) + 1;
    for (let k = kMin; k <= kMax; k++) {
      const text = laneLines[((k % laneLines.length) + laneLines.length) % laneLines.length];
      const wv = widthFrac(text, aspect);
      const x = 1 + k * spacing - Pl;                      // 胶囊左边缘的 x（画面宽比例）
      if (x > 1.02 || x + wv < -0.02) continue;            // 还没进 / 已完全出
      const alpha = clamp(Math.min((1.04 - x) / 0.08, (x + wv + 0.02) / 0.1), 0, 1);
      out.push({ i: lane * 1000 + ((k % 997) + 997) % 997, text, lane, x, y, w: wv, alpha });
    }
  }
  return out;
}
