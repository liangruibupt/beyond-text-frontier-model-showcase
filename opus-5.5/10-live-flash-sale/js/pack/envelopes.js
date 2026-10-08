// pack/envelopes.js — 红包雨（可复用组件）：纯函数 (localT, params) → 红包 + 拆开的大红包 + 金币
// 约 40 个红包用 drift 下落 + 绕轴翻转；拆开的那一个走预设路径，金币是闭式抛物线。闭式，可乱序取样。
import { rand, seedOf } from '../../../factory/engine/rng.js';
import { clamp } from '../../../factory/engine/ease.js';
import { drift } from '../../../factory/engine/particles.js';

/**
 * params: { count=40, dur=3, seed='rain', denseAt=0.5, openAt=2.0, coins=14, openTarget=[0.5,0.52] }
 *   15 秒版 rain 本地 0 起：8.0 密集（denseAt 0.5），9.5 拆红包（openAt 2.0，成片 9.5）。
 *   6 秒版用 rain from 1.5、dur 1.0：拆红包在成片 2.0（本地 0.5）。
 * 返回 { envelopes:[{x,y,spin,alpha}], big:{x,y,open}|null, coins:[{x,y,alpha}] }
 */
export function envelopes(lt, params = {}) {
  const { count = 40, dur = 3, seed = 'rain', denseAt = 0.5, openAt = 2.0, coins = 14, openTarget = [0.5, 0.52] } = params;
  const sd = seedOf(seed);
  const dense = clamp((lt - denseAt) / 0.6);                 // denseAt 后 0.6 s 内由稀转密
  const box = [0.08, -0.1, 0, 0.92, 1.1, 0];                 // 从画面上方飘落（y 向下，向下运动用 +y vel）
  const envs = [];
  const n = Math.round(count * (0.35 + 0.65 * dense));
  for (let i = 0; i < n; i++) {
    const d = drift(sd, i, lt, box, { vel: [0, 0.55 * (0.8 + 0.4 * rand(sd, i)), 0], sway: 0.03, swayHz: 0.6 });
    const spin = d[3] * Math.PI * 2 + lt * (2 + 3 * rand(sd, i * 2 + 7));
    envs.push({ x: d[0], y: d[1], spin, alpha: d[4] });
  }
  // 拆开的大红包：openAt 前从上方落到 openTarget，openAt 起 0.5 s 内拆开
  let big = null; const cs = [];
  const fall = clamp((lt - (openAt - 0.8)) / 0.8);
  if (fall > 0) {
    const bx = openTarget[0], by = -0.2 + (openTarget[1] + 0.2) * fall;
    const openK = clamp((lt - openAt) / 0.5);
    big = { x: bx, y: by, open: openK };
    if (openK > 0) {
      for (let i = 0; i < coins; i++) {
        const a = (i / coins) * Math.PI * 2 + rand(sd, i + 100) * 0.5;
        const sp = 0.5 + 0.4 * rand(sd, i + 200);              // 初速（画面比例 / 秒）
        const ct = lt - openAt;                                // 金币自拆开时刻起的时间
        const vx = Math.cos(a) * sp, vy = -Math.abs(Math.sin(a)) * sp - 0.5;   // 向外、整体向上炸
        const cx = bx + vx * ct;
        const cy = openTarget[1] + vy * ct + 0.5 * 2.6 * ct * ct;              // 重力把金币拉下（y 向下）
        const calpha = clamp(1 - ct / 0.9);
        if (calpha > 0) cs.push({ x: cx, y: cy, alpha: calpha });
      }
    }
  }
  return { envelopes: envs, big, coins: cs };
}
