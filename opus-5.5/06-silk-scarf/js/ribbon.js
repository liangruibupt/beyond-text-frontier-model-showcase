// ribbon.js — 敦煌「飞天」的飘带（闭式，不走布料模拟）：手捏住方巾的一个角，整块沿对角线拖在手后面（1.27 m 长的菱形），像飞天的飘带
//   沿对角线的坐标 a（0 = 手里那个角，1 = 对角）：这一点在 τ = t − a·L/速度 时刻的手的位置上，整条顺着手走过的螺旋拖在后面
//   横向 b（垂直对角线，|b| ≤ 宽度的一半，两头尖、中间最宽 0.64 m）：截面弯成一段弧（曲率从手边往尾慢慢变小），整条沿长拧转，再叠一道从手往尾跑的波
//   (a, b) 是方巾平面坐标转 45°：长度、宽度都和平铺时一样，不拉伸
// 只由 (t, i, j) 决定：拖动、倒放、乱序取帧都一致。为什么不用模拟：握一角布缩成一条、卷成带子再飞拉伸 20–37%，都不像飘带
import { SCARF } from '../meta.js';

const S = SCARF.size, L = S * Math.SQRT2;
/** r 螺旋半径，w 角速度，rise 每秒上升；kappa 截面曲率（1/m，手边 → 尾）；twist 沿长拧转（弧度）；wave 横波振幅（m） */
export const RIBBON = { r: 0.42, w: 1.6, rise: 0.34, y0: 0.95, z0: -0.2, kappa: [3, 1.2], twist: 0.6, wave: 0.03, layers: 10, relax: 40 };   // layers：横向每层 10 个对角格（≈ 20 cm 宽的带子）；v6 样张整块方巾展开像一面旗，不像飘带

/** 手（螺旋）在 τ 时刻的位置与速度 */
export function handAt(tau, R = RIBBON) {
  const c = Math.cos(R.w * tau), s = Math.sin(R.w * tau);
  return { p: [c * R.r, R.y0 + R.rise * tau, s * R.r + R.z0], v: [-s * R.r * R.w, R.rise, c * R.r * R.w] };
}
const norm = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/** n × n 控制网格在时刻 t 的位置写进 pos（角 (0, 0) 在手里） */
export function ribbonInto(pos, n, t, R = RIBBON) {
  const speed = Math.hypot(R.r * R.w, R.rise), lag = L / speed, E = S / (n - 1) / Math.SQRT2;
  const frames = [];                                                         // 每条对角线（i + j = d）一个截面坐标系
  for (let d = 0; d <= 2 * (n - 1); d++) {
    const a = d / (2 * (n - 1)), tau = t - a * lag, { p, v } = handAt(tau, R), T = norm(v);
    // 宽度方向取螺旋的副法线（垂直于"弯向轴心"的方向）：横向偏移不在弯曲平面里，内外沿一样长；放在弯曲平面里时外沿被拉长到 2 倍
    const radial = [Math.cos(R.w * tau), 0, Math.sin(R.w * tau)];
    let side = norm(cross(T, radial)), nrm = cross(side, T);
    const psi = R.twist * Math.sin(1.7 * t - 4 * a) * a, cp = Math.cos(psi), sp = Math.sin(psi);   // 沿长的拧转只做小幅摆动（拧到弯曲平面里也会拉长）
    [side, nrm] = [side.map((x, k) => x * cp + nrm[k] * sp), nrm.map((x, k) => -side[k] * sp + x * cp)];
    frames.push({ p, side, nrm, kappa: R.kappa[0] + (R.kappa[1] - R.kappa[0]) * a, wave: R.wave * a * Math.sin(8 * a - 6.5 * t), a });
  }
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const F = frames[i + j], k = (j * n + i) * 3;
    // 横向先像手风琴一样折成一条带子（真丝巾当飘带用就是这么折的）；每层沿法线错开一点，不穿插、不闪
    // 带宽取对角线格距的整数倍（R.layers 格），折线正好落在控制点上：落在格子中间时插值会把折边插成锯齿（v7 样张）
    const q = (i - j) / R.layers + 0.5, layer = Math.floor(q), r = q - layer, b = ((layer & 1) ? 1 - r : r) - 0.5, band = R.layers * E;
    const bb = b * band, phi = bb * F.kappa, sa = F.kappa > 1e-6 ? Math.sin(phi) / F.kappa : bb, sb = F.kappa > 1e-6 ? (1 - Math.cos(phi)) / F.kappa : 0;
    const w = sb + F.wave * Math.sin(bb * 6 + 3 * F.a) + layer * 0.0018;
    for (let q2 = 0; q2 < 3; q2++) pos[k + q2] = F.p[q2] + F.side[q2] * sa - F.nrm[q2] * w;
  }
  inextensible(pos, n, R.relax);
}

/** 不可伸长修正：边（横、竖、两条对角线）比平铺长时，两端按固定顺序往一起拉（Gauss–Seidel），手里那个角不动。只缩不撑：短了的边是褶皱，留着
 *  每帧只由输入决定（固定顺序、固定次数），所以拖动 / 倒放一致 */
function inextensible(pos, n, iters = 40) {
  const E = SCARF.size / (n - 1), D = E * Math.SQRT2, edges = [];
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const k = j * n + i;
    if (i + 1 < n) edges.push(k, k + 1, E);
    if (j + 1 < n) edges.push(k, k + n, E);
    if (i + 1 < n && j + 1 < n) edges.push(k, k + n + 1, D, k + 1, k + n, D);
  }
  for (let it = 0; it < iters; it++) for (let e = 0; e < edges.length; e += 3) {
    const a = edges[e] * 3, b = edges[e + 1] * 3, r = edges[e + 2];
    const dx = pos[b] - pos[a], dy = pos[b + 1] - pos[a + 1], dz = pos[b + 2] - pos[a + 2], l = Math.hypot(dx, dy, dz);
    if (l <= r) continue;
    const wa = a === 0 ? 0 : 1, wb = b === 0 ? 0 : 1, c = (l - r) / l / (wa + wb);
    pos[a] += dx * c * wa; pos[a + 1] += dy * c * wa; pos[a + 2] += dz * c * wa;
    pos[b] -= dx * c * wb; pos[b + 1] -= dy * c * wb; pos[b + 2] -= dz * c * wb;
  }
}
