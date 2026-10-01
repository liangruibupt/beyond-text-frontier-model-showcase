// sims.js — 每款要烘的布料：setup 时按款烘好，镜头按镜头本地时间取（clothAt）
// sims.js — 每款要烘的布料：setup 时按款烘好，镜头按镜头本地时间取（clothAt）
// 烘焙用 32 × 32 的控制网格（40 × 40 两段要 4 秒多，超过 setup 的预算）；渲染时 scarf.js 把它细分 3 倍、插值成曲面
// 敦煌：drape（方巾先沿对角线对折成三角，折边横在颈后；两只手把两端从肩外侧带到胸前放下 → 披肩）。飞天的飘带是闭式的（ribbon.js）
// 其余款做到对应镜头时在这里加
import { bakeCloth } from '../../factory/engine/cloth.js';
import { SCARF, BUST } from '../meta.js';
import { BUST_COLLIDERS } from './bust.js';
import { ss, lerp } from '../../factory/engine/ease.js';

export const N = SCARF.n;
const S = SCARF.size, R2 = Math.SQRT2;
/** 握住 (i, j) 周围 2 × 2 个顶点，跟着 hand(t) 平移（一个点会把相邻的边拉长）；rest 是布的静止位置函数 */
const grip = (i0, j0, hand, rest, until) => [[0, 0], [1, 0], [0, 1], [1, 1]].map(([di, dj]) => {
  const i = Math.min(i0 + di, N - 1) - (i0 === N - 1 ? di : 0), j = Math.min(j0 + dj, N - 1) - (j0 === N - 1 ? dj : 0), r = rest(i, j), h0 = hand(0);
  return { i, j, until, pos: t => { const h = hand(t); return [r[0] + h[0] - h0[0], r[1] + h[1] - h0[1], r[2] + h[2] - h0[2]]; } };
});

/** 敦煌 drape：沿对角线 A(0,0)–C(N-1,N-1) 对折成三角（上面一层抬高 4 mm，折痕由弯曲约束记住），折边沿 x 横在颈后 10 cm；
 *  A、C 两端被带着从肩外侧绕到胸前、往下放，1.9 秒松手；三角的尖垂在背后 */
export const DH_DRAPE = { y0: BUST.top + 0.1, z0: 0.03, release: 1.9 };   // 折边落在颈上（z0 太靠后，布会从背后整块滑下去）
function dhDrape() {
  const { y0, z0, release } = DH_DRAPE;
  const rest = (i, j) => {
    // 折边是反对角线 u + v = 1：和三角剖分的对角线（clothIndex 的 k+nx → k+1）同向，折痕上没有被撕开的三角（沿 u = v 折会出锯齿）
    // a 沿折边（-1..1），b 离折边的距离；b < 0 的一半翻到上面（抬高 4 mm）。折边 = 颈上那条线，三角的尖往后
    const u = i / (N - 1), v = j / (N - 1), a = u - v, b = 1 - u - v, top = b < 0 ? 1 : 0;
    return [(a / R2) * S, y0 + top * 0.004, z0 - (Math.abs(b) / R2) * S];
  };
  const end = sx => t => { const k = ss(0.15, 1.6, t), a = rest(sx < 0 ? 0 : N - 1, sx < 0 ? N - 1 : 0); return [lerp(a[0], sx * 0.1, k), lerp(a[1], 1.12, k) + 0.12 * Math.sin(Math.PI * k), lerp(a[2], 0.15, k)]; };
  return bakeCloth({
    nx: N, ny: N, rest, t1: 3.0, seed: 12, damping: 2.2, bend: 0.15, friction: 0.3, thickness: 0.005,
    pins: [...grip(0, N - 1, end(-1), rest, release), ...grip(N - 1, 0, end(1), rest, release)],
    colliders: [...BUST_COLLIDERS, { type: 'ground', y: 0 }],
  });
}

export const SIMS = { dunhuang: { drape: dhDrape }, songjin: {}, qinghua: {}, yunhe: {} };   // 飞天的飘带改成闭式（ribbon.js）：模拟里怎么握都不像飘带
export function bakeFor(scarf) { return Object.fromEntries(Object.entries(SIMS[scarf]).map(([k, f]) => [k, f()])); }
