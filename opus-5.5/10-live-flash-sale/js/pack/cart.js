// pack/cart.js — 购物车弹窗（可复用组件）：纯函数 (localT, params) → 弹窗 / 水波纹 / 角标状态
// 弹簧缓动的解析解从底部弹上来；点击水波纹按 t 扩散；角标 +1 回弹。闭式，可乱序取样。
import { clamp } from '../../../factory/engine/ease.js';

/** 欠阻尼弹簧的解析解：从 0 到 1，带一点过冲（omega 固有角频率，zeta 阻尼比） */
export function spring(dt, { omega = 14, zeta = 0.55 } = {}) {
  if (dt <= 0) return 0;
  const wd = omega * Math.sqrt(1 - zeta * zeta);
  return 1 - Math.exp(-zeta * omega * dt) * (Math.cos(wd * dt) + (zeta * omega / wd) * Math.sin(wd * dt));
}

/**
 * params: { riseAt=0, tapAt=1.5, dur=2.5 }
 *   15 秒版 cart 从本地 0 起：5.0 弹窗落定（riseAt=0），6.5 点击（tapAt=1.5，成片 6.5）。
 * 返回 { rise: 0..1（含过冲）, y: 弹窗底边抬升比例, ripple: {r,alpha}|null, badge: {scale,plus}|null, tapped }
 */
export function cart(lt, params = {}) {
  const { riseAt = 0, tapAt = 1.5 } = params;
  const rise = spring(lt - riseAt);
  const y = clamp(rise, 0, 1.1);
  let ripple = null;
  const rd = lt - tapAt;
  if (rd >= 0 && rd < 0.6) ripple = { r: 0.02 + 0.14 * clamp(rd / 0.6), alpha: (1 - clamp(rd / 0.6)) * 0.8 };
  let badge = null;
  if (rd >= 0) { const b = spring(rd, { omega: 20, zeta: 0.4 }); badge = { scale: 0.6 + 0.4 * clamp(b, 0, 1.4), plus: rd < 0.9 }; }
  return { rise, y, ripple, badge, tapped: rd >= 0 };
}
