// bake.js — 烘焙模拟：闭式写不出来的物理（碰撞、堆积）在 setup 里按固定步长跑一遍存成表，每帧按 t 查表插值
// 表只由 (seed, dt, t1, stride, init, step) 决定；查表不改表，所以拖动、倒放、乱序取帧都一致
import { mulberry32 } from './rng.js';

const now = () => (globalThis.performance ? performance.now() : Date.now());

/**
 * 跑一遍模拟并存表。
 * init(rng) → 初始状态（Float32Array 或 number[]，扁平，长度 = 每帧的数值个数）
 * step(state, dt, rng, t) 原地推进一步：state 是 Float64Array（双精度积分，存表时转 Float32），t 是这一步开始的时刻
 * rng 是 rng.js 的 mulberry32(seed)，init 与 step 共用这一条序列；除它之外不许有别的随机源
 * 步数 steps = ceil(t1 / dt)；每 stride 步存一帧（stride 默认 1），不够整除时多跑几步补齐，
 * 所以存 count = ceil(steps / stride) + 1 帧，第 j 帧是时刻 j·stride·dt 的状态，最后一帧不早于 t1
 */
export function bake({ seed, dt, t1, init, step, stride = 1 }) {
  if (!(dt > 0) || !(t1 >= 0)) throw new Error(`bake: bad dt ${dt} / t1 ${t1}`);
  if (!Number.isInteger(stride) || stride < 1) throw new Error(`bake: bad stride ${stride}`);
  const t0 = now();
  const rng = mulberry32(seed | 0);
  const state = Float64Array.from(init(rng));
  const size = state.length;
  const steps = Math.ceil(t1 / dt - 1e-9);   // 去掉 2.5 / (1/240) = 600.0000001 这种浮点尾巴
  const count = Math.ceil(steps / stride) + 1;
  const data = new Float32Array(count * size);
  data.set(state, 0);
  for (let j = 1, k = 0; j < count; j++) {
    for (let s = 0; s < stride; s++, k++) step(state, dt, rng, k * dt);
    data.set(state, j * size);
  }
  return { data, size, count, dt, t1, stride, steps: (count - 1) * stride, frameDt: dt * stride, bakeMs: now() - t0 };
}

// t → 相邻两帧的下标与权重；t 钳在 [0, t1]
function locate(table, t) {
  const tt = Math.min(Math.max(+t || 0, 0), table.t1);
  let x = tt / table.frameDt;
  const r = Math.round(x); if (Math.abs(x - r) < 1e-6) x = r;   // j·frameDt 除回来可能差一丝，吸到节点上
  const a = Math.min(Math.floor(x), table.count - 1);
  const b = Math.min(a + 1, table.count - 1);
  return [a, b, b === a ? 0 : x - a];
}

/** 把时刻 t 的整帧状态写进 out（Float32Array，长度 ≥ size），不分配内存；落在存储帧上时逐位等于存的值 */
export function sampleInto(table, t, out) {
  return sampleRange(table, t, 0, table.size, out);
}

/** 只取一段：第 offset 起的 n 个数写进 out[0..n)，比如一颗珠子的 [x, y, z]；每帧逐个物体取时用它 */
export function sampleRange(table, t, offset, n, out) {
  const { data, size } = table, [a, b, w] = locate(table, t), ia = a * size + offset, ib = b * size + offset;
  if (w === 0) for (let i = 0; i < n; i++) out[i] = data[ia + i];
  else for (let i = 0; i < n; i++) out[i] = data[ia + i] + (data[ib + i] - data[ia + i]) * w;
  return out;
}

/** 分配一块新的 Float32Array 返回时刻 t 的状态；每帧都取的地方用 sampleInto / sampleRange */
export const sampleBake = (table, t) => sampleInto(table, t, new Float32Array(table.size));
