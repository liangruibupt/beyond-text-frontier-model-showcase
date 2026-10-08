// constellation.js — 订单星座布局：把"全国海量订单奔向仓库"做成抽象散点 + 弧线，不画任何地理边界
// 所有输出只由入参（含 seed）决定：同一入参两次调用逐值相同，可按 t 乱序/倒序取样（配合 scrub 与叠化）
// 随机只来自 rng.js；本模块绝不调用 Math.random / Date.now / performance.now
import { rand, hashU32 } from './rng.js';

// ——— 内部小工具 ———

// 第 i 个节点的第 c 路随机数：把 (i, channel) 混进序号，使不同用途的随机互不相关
const r2 = (seed, i, c) => rand(seed, (i * 8 + c) >>> 0);

// 一维钳制到 [0,1]
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

/**
 * 星座节点布局 → 归一化坐标 [{x, y, w}]（x,y ∈ [0,1]，w 是权重/亮度 ∈ (0,1]）。
 * mode:
 *   'spread'   均匀铺满（抖动网格，近泊松盘）—— national
 *   'clusters' 聚成 `clusters` 个团簇 —— megacity（默认 3 团）
 *   'rings'    内外两环 —— crossborder（内环 60%，外环 40%）
 * aspect = W/H，用来把布局拉成画面比例（坐标仍归一化，布局不被压扁）。
 */
export function layoutNodes({ seed, count, mode = 'spread', clusters = 3, aspect = 16 / 9 }) {
  if (!Number.isInteger(count) || count < 1) throw new Error(`layoutNodes: bad count ${count}`);
  const s = seed >>> 0;
  const nodes = [];
  const ax = aspect >= 1 ? 1 : aspect;        // 横向可用幅度
  const ay = aspect >= 1 ? 1 / aspect : 1;    // 纵向可用幅度

  if (mode === 'clusters') {
    const C = Math.max(1, clusters | 0);
    const centers = [];
    for (let k = 0; k < C; k++) {
      centers.push([0.2 + 0.6 * r2(s, 1000 + k, 0), 0.25 + 0.5 * r2(s, 1000 + k, 1)]);
    }
    for (let i = 0; i < count; i++) {
      const k = Math.floor(r2(s, i, 2) * C) % C;
      const [cx, cy] = centers[k];
      const dr = 0.12 * (r2(s, i, 3) + r2(s, i, 4) - 1); // 两路均匀差近似高斯
      const da = r2(s, i, 5) * Math.PI * 2;
      nodes.push({
        x: clamp01(cx + Math.cos(da) * dr * ax * 2),
        y: clamp01(cy + Math.sin(da) * dr * ay * 2),
        w: 0.4 + 0.6 * r2(s, i, 6),
      });
    }
  } else if (mode === 'rings') {
    for (let i = 0; i < count; i++) {
      const inner = r2(s, i, 2) < 0.6;
      const base = inner ? 0.18 : 0.40;
      const spread = inner ? 0.06 : 0.07;
      const rr = base + spread * (r2(s, i, 3) - 0.5) * 2;
      const a = r2(s, i, 4) * Math.PI * 2;
      nodes.push({
        x: clamp01(0.5 + Math.cos(a) * rr * ax),
        y: clamp01(0.5 + Math.sin(a) * rr),
        w: (inner ? 0.5 : 0.35) + 0.5 * r2(s, i, 6),
      });
    }
  } else { // 'spread'
    const cols = Math.max(1, Math.round(Math.sqrt(count * aspect)));
    const rows = Math.max(1, Math.ceil(count / cols));
    for (let i = 0; i < count; i++) {
      const gx = i % cols, gy = Math.floor(i / cols);
      const jx = (r2(s, i, 2) - 0.5) * 0.9;
      const jy = (r2(s, i, 3) - 0.5) * 0.9;
      nodes.push({
        x: clamp01(0.06 + 0.88 * ((gx + 0.5 + jx) / cols)),
        y: clamp01(0.10 + 0.80 * ((gy + 0.5 + jy) / rows)),
        w: 0.4 + 0.6 * r2(s, i, 6),
      });
    }
  }
  return nodes;
}

/**
 * 仓库汇聚点 → [{x, y}]。贪心最远点采样挑 k 个（确定性），再向画面中心轻微拉拢。
 */
export function layoutHubs({ seed, nodes, k = 8 }) {
  const K = Math.max(1, Math.min(k | 0, nodes.length));
  if (nodes.length === 0) return [];
  const s = (seed >>> 0) ^ 0x51ed270b;
  const picked = [];
  const first = hashU32(s) % nodes.length;
  picked.push(first);
  const dist2 = (a, b) => {
    const dx = nodes[a].x - nodes[b].x, dy = nodes[a].y - nodes[b].y;
    return dx * dx + dy * dy;
  };
  while (picked.length < K) {
    let best = -1, bestD = -1;
    for (let i = 0; i < nodes.length; i++) {
      if (picked.includes(i)) continue;
      let dmin = Infinity;
      for (const p of picked) dmin = Math.min(dmin, dist2(i, p));
      if (dmin > bestD) { bestD = dmin; best = i; }
    }
    if (best < 0) break;
    picked.push(best);
  }
  return picked.map((i) => ({
    x: nodes[i].x * 0.75 + 0.5 * 0.25,
    y: nodes[i].y * 0.75 + 0.5 * 0.25,
  }));
}

/**
 * 一条弧线在参数 u ∈ [0,1] 处的点（二次贝塞尔），控制点在弦中点沿法线抬高 `lift`。
 * u=0 → from，u=1 → to（端点精确命中）。dir=+1/-1 控制拱向。
 */
export function arcPath(from, to, u, lift = 0.18, dir = 1) {
  const uu = clamp01(u);
  const mx = (from.x + to.x) / 2;
  const my = (from.y + to.y) / 2;
  const dx = to.x - from.x, dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1e-6;
  const nx = -dy / len, ny = dx / len;
  const cx = mx + nx * lift * len * dir;
  const cy = my + ny * lift * len * dir - lift * 0.5;
  const w = 1 - uu;
  return {
    x: w * w * from.x + 2 * w * uu * cx + uu * uu * to.x,
    y: w * w * from.y + 2 * w * uu * cy + uu * uu * to.y,
  };
}

/**
 * 为 n 条弧线分配 (起点, 终点, 起飞时刻, 时长)。固定种子 → 相同调度；纯数据可乱序/倒序采样。
 * reverse=true 弧线反向（仓库→节点，物流发货款）。
 */
export function arcSchedule({ seed, nodeCount, hubCount, n, t0 = 0, t1 = 3, durMin = 0.5, durMax = 1.1, reverse = false }) {
  if (!Number.isInteger(n) || n < 0) throw new Error(`arcSchedule: bad n ${n}`);
  if (nodeCount < 1 || hubCount < 1) throw new Error('arcSchedule: need nodes and hubs');
  const s = (seed >>> 0) ^ 0x27d4eb2f;
  const span = Math.max(1e-6, t1 - t0);
  const arcs = new Array(n);
  for (let i = 0; i < n; i++) {
    const node = Math.floor(r2(s, i, 0) * nodeCount) % nodeCount;
    const hub = Math.floor(r2(s, i, 1) * hubCount) % hubCount;
    const q = r2(s, i, 2);
    const launch = t0 + span * (q * q);        // 平方分布：点亮波纹集中在前段
    const dur = durMin + (durMax - durMin) * r2(s, i, 3);
    const lift = 0.12 + 0.14 * r2(s, i, 4);
    const dir = r2(s, i, 5) < 0.5 ? 1 : -1;
    arcs[i] = reverse
      ? { from: hub, to: node, fromHub: true, launch, dur, lift, dir }
      : { from: node, to: hub, fromHub: false, launch, dur, lift, dir };
  }
  return { arcs, reverse, t0, t1 };
}

/** 第 i 条弧线在时刻 t 的进度 u ∈ [0,1]（钳制）。纯函数，可乱序取样。 */
export function progressAt(sched, i, t) {
  const a = sched.arcs[i];
  if (!a) return 0;
  const u = (t - a.launch) / a.dur;
  return u < 0 ? 0 : u > 1 ? 1 : u;
}

/** 在时刻 t 飞行中的弧线下标集合（0<u<1），每帧只更新活跃实例。 */
export function activeArcs(sched, t) {
  const out = [];
  for (let i = 0; i < sched.arcs.length; i++) {
    const u = progressAt(sched, i, t);
    if (u > 0 && u < 1) out.push(i);
  }
  return out;
}
