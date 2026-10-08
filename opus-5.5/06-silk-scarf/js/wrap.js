// wrap.js — 青花「从瓷上来」：丝巾沿高度对折成两层（0.45 m 高、绕一圈 0.9 m），像一圈衣领贴在梅瓶上，然后顺瓶身往下滑，在瓶足堆成一圈褶子（闭式，不走布料模拟）
// 布料模拟试过：从瓶口上方落下只会搭成帐篷；裹在瓶上松开，PBD 的布筒两头顶着站住、不往下塌（见 sims.js 的记录）
//   每一行（沿高度离折边 σ 米）在时刻 t 的高度 h = top(t) − σ：
//     h > 0：贴着瓶面，平均半径 = 瓶在 h 处的半径 + gap；
//     h ≤ 0：多出来的长度 e = −h 堆在案上——平均半径往外慢慢扩、高度上一折一折起伏（手风琴褶）
//   周长：布一圈是 0.9 m，比瓶身大（瓶最粗处半径 0.14，周长 0.88）——多出来的长度变成沿高度方向的竖褶（半径方向的波纹），
//   波纹振幅按"这一行的曲线长度 = 0.9 m"二分求出，顶点再按弧长均匀分布：布面不拉伸，褶子多少由瓶身粗细自然决定
// 只由 (t, i, j) 决定：拖动、倒放、乱序取帧都一致
import { SCARF, VASE } from '../meta.js';
import { ss } from '../../factory/engine/ease.js';

const S = SCARF.size, H = S / 2, TAU = Math.PI * 2;
export const QH_SLIP = { top0: 0.33, drop: 0.21, t0: 0.6, t1: 2.9, gap: 0.006, layer: 0.003, folds: 9, seam: 0.03, pleat: 0.025 };   // top0 = 折边起始高度：要在瓶肩下面（0.36 以上瓶在收口，贴着收口走会把竖向的边拉长到 2 倍）

/** 瓶在高度 h（从案面算）处的半径；口以上取口沿半径 */
export function vaseR(h, V = VASE) {
  const p = V.profile;
  if (h <= 0) return p[0][1];
  for (let q = 0; q + 1 < p.length; q++) if (h <= p[q + 1][0]) return p[q][1] + (p[q + 1][1] - p[q][1]) * (h - p[q][0]) / (p[q + 1][0] - p[q][0] || 1);
  return p[p.length - 1][1];
}

const M = 192, span = TAU * (1 - QH_SLIP.seam / S);                       // 两条边之间留一道小缝
/** 半径曲线 r(a) = rm + A·(1 + sin(k·a + φ(a)))/2（只往外鼓：不会进瓶里）的长度表（M 段的累计弧长） */
function curve(rm, A, ph) {
  const k = QH_SLIP.folds, r = new Float64Array(M + 1), L = new Float64Array(M + 1);
  for (let q = 0; q <= M; q++) { const a = (q / M) * span; r[q] = rm + A * (1 + Math.sin(k * a + ph + 0.8 * Math.sin(3 * a + ph))) / 2; }
  for (let q = 1; q <= M; q++) { const a0 = ((q - 1) / M) * span, a1 = (q / M) * span; L[q] = L[q - 1] + Math.hypot(r[q] * Math.cos(a1) - r[q - 1] * Math.cos(a0), r[q] * Math.sin(a1) - r[q - 1] * Math.sin(a0)); }
  return { r, L };
}
const cache = new Map();
/** rm 下让一圈曲线长度正好 = S 的波纹（二分 A）；rm 已经够大时 A = 0。按 0.5 mm × 相位缓存 */
function fluted(rm, ph) {
  const key = Math.round(rm * 2000) + ':' + Math.round(ph * 20);
  let c = cache.get(key);
  if (c) return c;
  let lo = 0, hi = 0.25;
  if (curve(rm, 0, ph).L[M] >= S) hi = 0;
  else for (let it = 0; it < 30; it++) { const mid = (lo + hi) / 2; (curve(rm, mid, ph).L[M] < S ? (lo = mid) : (hi = mid)); }
  c = curve(rm, hi, ph); cache.set(key, c);
  return c;
}

/** n × n 控制网格（i 绕一圈，j 沿高度：0 → n/2 外层从下摆到折边，n/2 → n−1 内层从折边回到下摆）在时刻 t 写进 pos */
export function slipInto(pos, n, t, V = VASE, P = QH_SLIP) {
  const top = P.top0 - P.drop * ss(P.t0, P.t1, t), half = (n - 1) / 2;
  for (let j = 0; j < n; j++) {
    const outer = j <= half, sigma = (outer ? (half - j) / half : (j - half) / half) * H;   // 离折边的距离
    const h = top - sigma, e = Math.max(0, -h), lay = outer ? P.layer : 0;
    let rm, y;
    if (h > 0) { rm = vaseR(h, V) + P.gap + lay; y = V.table + h; }
    else {                                                                 // 堆在瓶足：手风琴褶——沿高度一上一下折（每折 pleat 米高），同时慢慢往外（每米弧长外移 0.3 米）；|d/de| = 1，不拉伸
      const out = 0.3, up = Math.sqrt(1 - out * out), z = (e * up) % (2 * P.pleat), tri = z < P.pleat ? z : 2 * P.pleat - z;
      rm = vaseR(0, V) + P.gap + 0.006 + e * out + lay;
      y = V.table + 0.003 + lay + tri;
    }
    const ph = 0.7 * Math.sin(9 * h) + (h < 0 ? 4 * e : 0), C = fluted(Math.min(rm, S / TAU - 0.001), ph), rmf = rm - Math.min(rm, S / TAU - 0.001);
    for (let i = 0; i < n; i++) {
      // 按弧长找角度：这一行第 i 个顶点在曲线长度 i/(n−1)·S 处
      const want = (i / (n - 1)) * C.L[M];
      let q = 1; while (q < M && C.L[q] < want) q++;
      const f = (want - C.L[q - 1]) / (C.L[q] - C.L[q - 1] || 1), a = ((q - 1 + f) / M) * span + 0.6, r = C.r[q - 1] + (C.r[q] - C.r[q - 1]) * f + rmf;
      const k = (j * n + i) * 3;
      pos[k] = V.x + Math.cos(a) * r; pos[k + 1] = y; pos[k + 2] = V.z + Math.sin(a) * r;
    }
  }
}
