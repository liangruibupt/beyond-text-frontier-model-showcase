// pearls.js — 珍珠落进空杯、弹开、堆在杯底：闭式写不出来（珠子互相碰），在 setup 里用 factory/engine/bake.js 烘成表，镜头每帧按 t 查
// 状态按珠子排：每颗 6 个数 [x, y, z, vx, vy, vz]（杯子本地坐标，米）。约束法（位置投影 + 速度反弹），固定步长 1/240 秒
// 杯壁是截锥：半径 r(y) = r0 + k·y；珠心离轴不能超过 r(y) - R·slant（沿法线留一个珠子半径）
import { bake, sampleRange } from '../../factory/engine/bake.js';
import { CUP, PEARL } from '../meta.js';

export const SIM = { seed: 11, dt: 1 / 240, t1: 2.5, stride: 2, g: 9.81, restitution: 0.32, friction: 0.35, air: 0.4, iters: 4, contact: 0.06, release: [0.35, 1.3] };
const K = (CUP.rTop - CUP.rBottom) / CUP.height, SLANT = Math.sqrt(1 + K * K);
const RIN = y => CUP.rBottom - CUP.wall * SLANT + K * y;               // 内壁 y 处的半径
const FLOOR = CUP.base;
const SPAWN = CUP.height + 0.03;                                       // 勺口在杯口上方 3 cm：pearls 镜头框的是杯子下半截，珠子从画面上方进来
/** 第 i 颗珠子松开的时刻：按序号均匀排在 release 区间里，最后一颗落到杯底正好赶上 EV.land 的命中点 */
export const releaseAt = (i, n = PEARL.count, P = SIM) => P.release[0] + ((P.release[1] - P.release[0]) * i) / Math.max(n - 1, 1);

/**
 * 初始状态：珠子等在勺口的小圆盘里（松开之前不动），带一点随机的水平速度。
 * 只用传进来的 rng（bake 的 mulberry32(seed)），所以两次烘焙逐字节相同
 */
export function initPearls(rng, n = PEARL.count) {
  const s = new Float64Array(n * 6);
  for (let i = 0; i < n; i++) {
    const a = rng() * Math.PI * 2, r = Math.sqrt(rng()) * 0.01;
    s.set([Math.cos(a) * r, SPAWN + rng() * 0.004, Math.sin(a) * r, (rng() - 0.5) * 0.06, -0.3 - rng() * 0.2, (rng() - 0.5) * 0.06], i * 6);
  }
  return s;
}

/** 一步：没松开的不动；重力 + 空气阻尼 → 积分 → 若干次（珠对珠 + 杯底 + 杯壁）位置投影；反弹只削法向速度，接触时再加一点阻尼让堆停下 */
export function stepPearls(s, dt, n = s.length / 6, P = SIM, t = 0) {
  const R = PEARL.r, R2 = 4 * R * R, damp = Math.exp(-P.air * dt), live = i => t >= releaseAt(i, n, P);
  for (let i = 0; i < n; i++) {
    if (!live(i)) continue;
    const o = i * 6;
    s[o + 4] -= P.g * dt;
    s[o + 3] *= damp; s[o + 4] *= damp; s[o + 5] *= damp;
    s[o] += s[o + 3] * dt; s[o + 1] += s[o + 4] * dt; s[o + 2] += s[o + 5] * dt;
  }
  const touch = new Uint8Array(n);
  for (let it = 0; it < P.iters; it++) {
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      if (!live(i) || !live(j)) continue;
      const a = i * 6, b = j * 6, dx = s[b] - s[a], dy = s[b + 1] - s[a + 1], dz = s[b + 2] - s[a + 2], d2 = dx * dx + dy * dy + dz * dz;
      if (d2 >= R2 || d2 < 1e-14) continue;
      touch[i] = touch[j] = 1;
      const d = Math.sqrt(d2), push = (2 * R - d) / 2, nx = dx / d, ny = dy / d, nz = dz / d;
      s[a] -= nx * push; s[a + 1] -= ny * push; s[a + 2] -= nz * push;
      s[b] += nx * push; s[b + 1] += ny * push; s[b + 2] += nz * push;
      const vn = (s[b + 3] - s[a + 3]) * nx + (s[b + 4] - s[a + 4]) * ny + (s[b + 5] - s[a + 5]) * nz;
      if (vn < 0) {                                                    // 相向：法向速度按恢复系数交换一部分
        const j2 = (-(1 + P.restitution) * vn) / 2;
        s[a + 3] -= j2 * nx; s[a + 4] -= j2 * ny; s[a + 5] -= j2 * nz;
        s[b + 3] += j2 * nx; s[b + 4] += j2 * ny; s[b + 5] += j2 * nz;
      }
    }
    for (let i = 0; i < n; i++) {
      if (!live(i)) continue;
      const o = i * 6;
      if (s[o + 1] < FLOOR + R) {                                     // 杯底
        s[o + 1] = FLOOR + R; touch[i] = 1;
        if (s[o + 4] < 0) s[o + 4] *= -P.restitution;
        s[o + 3] *= 1 - P.friction; s[o + 5] *= 1 - P.friction;
      }
      const rr = Math.hypot(s[o], s[o + 2]), lim = RIN(s[o + 1]) - R * SLANT;
      if (rr > lim && rr > 1e-9) {                                    // 杯壁（截锥）：拉回壁内，削掉朝外的速度
        const ux = s[o] / rr, uz = s[o + 2] / rr, nx = ux / SLANT, ny = -K / SLANT, nz = uz / SLANT;
        s[o] = ux * lim; s[o + 2] = uz * lim; touch[i] = 1;
        const vn = s[o + 3] * nx + s[o + 4] * ny + s[o + 5] * nz;
        if (vn > 0) { const j2 = (1 + P.restitution) * vn; s[o + 3] -= j2 * nx; s[o + 4] -= j2 * ny; s[o + 5] -= j2 * nz; }
      }
    }
  }
  for (let i = 0; i < n; i++) if (touch[i]) { const o = i * 6; s[o + 3] *= 1 - P.contact; s[o + 4] *= 1 - P.contact; s[o + 5] *= 1 - P.contact; }
}

/** 烘焙：在 setup 里调一次；换口味不用重烘（和口味无关），但场景重建时 setup 会再跑，所以要快 */
export function bakePearls(P = SIM, n = PEARL.count) {
  return bake({ seed: P.seed, dt: P.dt, t1: P.t1, stride: P.stride, init: rng => initPearls(rng, n), step: (s, dt, rng, t) => stepPearls(s, dt, n, P, t) });
}

/** 第 i 颗珠子在 t 秒的位置写进 out[0..3)（不分配内存） */
export const pearlAt = (table, t, i, out) => sampleRange(table, t, i * 6, 3, out);

/** 珠子是不是都在杯子里、落到了杯底附近（测试和 check 用） */
export function settled(table, t = SIM.t1, n = PEARL.count) {
  const q = [0, 0, 0], R = PEARL.r, bad = [];
  let top = 0;
  for (let i = 0; i < n; i++) {
    pearlAt(table, t, i, q);
    const rr = Math.hypot(q[0], q[2]);
    if (q[1] < FLOOR + R - 1e-4 || rr > RIN(q[1]) - R * SLANT + 1e-4) bad.push(i);
    top = Math.max(top, q[1]);
  }
  return { bad, top };
}
