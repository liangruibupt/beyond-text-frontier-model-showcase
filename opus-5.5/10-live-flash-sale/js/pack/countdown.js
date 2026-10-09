// pack/countdown.js — 倒计时（可复用组件）：纯函数 (localT, params) → 当前该画的数字与冲击波
// 每个数字在自己的拍点上「放大 → 回弹 → 淡出」；冲击波圆环按 t 从拍点扩散。
// 闭式：同一 t 两次相同，可乱序取样。
import { clamp } from '../../../factory/engine/ease.js';

/** 弹性回弹：0→过冲→1，再在尾段淡出 */
function punch(dt, hold = 0.5) {
  if (dt < 0) return null;
  const grow = clamp(dt / 0.12);                                  // 0.12 s 内砸到最大
  const over = 1 + 0.35 * Math.exp(-6 * dt) * Math.sin(16 * dt);  // 阻尼回弹
  const scale = (0.3 + 0.7 * grow) * over;
  const alpha = clamp(1 - Math.max(0, dt - hold) / 0.3);          // hold 之后 0.3 s 淡出
  return { scale, alpha, dt };
}

/**
 * params: { beats=[0.5,1.0,1.5], digits=['3','2','1'], linkAt=2.0, dur=2.5 }
 *   beats 是每个数字的拍点（镜头本地秒）。15 秒版 count 从本地 0 起，拍点 0.5/1.0/1.5，上链接 2.0；
 *   6 秒版 count 从本地 0.5 起（from），同一组本地拍点。
 * 返回 { digit: {char,scale,alpha} | null, shock: {r,alpha} | null, linkBurst: 0..1 }
 */
export function countdown(lt, params = {}) {
  const { beats = [0.5, 1.0, 1.5], digits = ['3', '2', '1'], linkAt = 2.0 } = params;
  let digit = null, shock = null;
  for (let i = 0; i < beats.length; i++) {
    const p = punch(lt - beats[i], 0.42);
    if (p && p.alpha > 0) {
      digit = { char: digits[i], scale: p.scale, alpha: p.alpha };
      const sr = clamp((lt - beats[i]) / 0.5);
      if (sr > 0 && sr < 1) shock = { r: 0.1 + 0.5 * sr, alpha: (1 - sr) * 0.6 };
    }
  }
  // 上链接炸开：linkAt 起 0.4 s 的一次冲击（给文字层的 pop 配一个 overlay 闪光环）
  const lb = clamp((lt - linkAt) / 0.4);
  const linkBurst = lb > 0 && lb < 1 ? Math.sin(Math.PI * lb) : 0;
  return { digit, shock, linkBurst };
}
