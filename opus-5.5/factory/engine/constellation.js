// constellation.js — 订单星座布局：把"全国海量订单奔向仓库"做成抽象散点 + 弧线，不画任何地理边界
// 所有输出只由入参（含 seed）决定：同一入参两次调用逐值相同，可按 t 乱序/倒序取样（配合 scrub 与叠化）
// 随机只来自 rng.js；本模块绝不调用 Math.random / Date.now / performance.now
import { rand, hashU32 } from './rng.js';

// ——— 内部小工具 ———

// 第 i 个节点的第 c 路随机数：把 (i, channel) 混进序号，使不同用途的随机互不相关
const r2 = (seed, i, c) => rand(seed, (i * 8 + c) >>> 0);

// 一维钳制到 [0,1]
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

// ——— 地理映射（经纬度 → 归一化画面坐标，等距柱状投影；不画任何国界线） ———

// 北上广深四城经纬度（lon, lat）
export const CITIES_BJSHGZSZ = [
  { name: '北京', lon: 116.41, lat: 39.90 },
  { name: '上海', lon: 121.47, lat: 31.23 },
  { name: '广州', lon: 113.26, lat: 23.13 },
  { name: '深圳', lon: 114.06, lat: 22.54 },
];

/**
 * 经纬度 → 归一化坐标 [0,1]。等距柱状投影：lon∈[-180,180]→x，lat∈[90,-90]→y。
 * 可传 bbox {lonMin,lonMax,latMin,latMax} 把一小片区域放大铺满画面（四城用）。
 */
export function lonLatToXY(lon, lat, bbox) {
  if (bbox) {
    const { lonMin, lonMax, latMin, latMax } = bbox;
    const x = (lon - lonMin) / Math.max(1e-6, lonMax - lonMin);
    const y = (latMax - lat) / Math.max(1e-6, latMax - latMin);
    return { x: clamp01(x), y: clamp01(y) };
  }
  return { x: clamp01((lon + 180) / 360), y: clamp01((90 - lat) / 180) };
}

/** 北上广深四城 → 归一化坐标（取四城包围盒并放大居中，使四城在画面里散得开）。 */
export function cityCenters(aspect = 16 / 9, pad = 0.16) {
  const lons = CITIES_BJSHGZSZ.map((c) => c.lon);
  const lats = CITIES_BJSHGZSZ.map((c) => c.lat);
  const bbox = {
    lonMin: Math.min(...lons), lonMax: Math.max(...lons),
    latMin: Math.min(...lats), latMax: Math.max(...lats),
  };
  // 用包围盒把四城映射到 [pad,1-pad] 的居中方框，保留相对位置
  return CITIES_BJSHGZSZ.map((c) => {
    const p = lonLatToXY(c.lon, c.lat, bbox);
    return {
      name: c.name,
      x: pad + (1 - 2 * pad) * p.x,
      y: pad + (1 - 2 * pad) * p.y,
    };
  });
}

/**
 * 粗糙大陆掩膜（7 个大陆用椭圆块近似，等距柱状投影下的归一化坐标 [0,1]）。
 * 只判断"是否在陆地"，绝不画任何国界线/海岸线 → 彻底规避问题地图送审。
 * scale 放大每块椭圆的半径（>1 让点阵世界地图铺得更满）。
 */
const CONTINENT_BLOBS = [
  // [cx, cy, rx, ry]  归一化中心与半径（等距柱状投影经验值）
  [0.30, 0.30, 0.095, 0.085], // 北美
  [0.33, 0.62, 0.055, 0.120], // 南美
  [0.49, 0.30, 0.060, 0.075], // 欧洲
  [0.56, 0.58, 0.075, 0.130], // 非洲
  [0.70, 0.36, 0.150, 0.110], // 亚洲
  [0.82, 0.72, 0.055, 0.045], // 澳洲
  [0.16, 0.33, 0.045, 0.040], // 阿拉斯加/西北美补块
];

export function inLandMask(x, y, scale = 1) {
  for (const [cx, cy, rx, ry] of CONTINENT_BLOBS) {
    const dx = (x - cx) / (rx * scale);
    const dy = (y - cy) / (ry * scale);
    if (dx * dx + dy * dy <= 1) return true;
  }
  return false;
}

/**
 * 星座节点布局 → 归一化坐标 [{x, y, w, c?}]（x,y ∈ [0,1]，w 是权重/亮度 ∈ (0,1]，c 是团簇下标）。
 * mode:
 *   'spread'   均匀铺满（抖动网格，近泊松盘）—— national
 *   'clusters' 聚成若干团簇 —— megacity（可传 centers 用真实城市坐标，否则随机 `clusters` 团）
 *   'rings'    内外两环 —— crossborder 的备选
 *   'worldmap' 点阵世界地图（从大陆掩膜拒绝采样，不画任何国界线）—— crossborder 默认
 * aspect = W/H，用来把布局拉成画面比例（坐标仍归一化，布局不被压扁）。
 * centers   外部指定团簇中心 [{x,y,name?}]（clusters 模式用，如北上广深四城）。
 * tightness clusters 团簇半径（默认 0.12）。
 * mapScale  worldmap 大陆椭圆放大系数（默认 1.35，>1 让点阵铺得更满/更大）。
 */
export function layoutNodes({ seed, count, mode = 'spread', clusters = 3, aspect = 16 / 9, centers = null, tightness = 0.12, mapScale = 1.35 }) {
  if (!Number.isInteger(count) || count < 1) throw new Error(`layoutNodes: bad count ${count}`);
  const s = seed >>> 0;
  const nodes = [];
  const ax = aspect >= 1 ? 1 : aspect;        // 横向可用幅度
  const ay = aspect >= 1 ? 1 / aspect : 1;    // 纵向可用幅度

  if (mode === 'worldmap') {
    // 从大陆掩膜拒绝采样：在 [0.04,0.96]x[0.08,0.92] 内撒点，只保留落在陆地椭圆内的
    // mapScale 放大椭圆 → 点阵世界地图更大、铺满更多画面
    let i = 0, guard = 0;
    const maxGuard = count * 400;
    while (nodes.length < count && guard < maxGuard) {
      const px = 0.04 + 0.92 * r2(s, i, 0);
      const py = 0.08 + 0.84 * r2(s, i, 1);
      guard++; i++;
      if (!inLandMask(px, py, mapScale)) continue;
      nodes.push({ x: px, y: py, w: 0.4 + 0.6 * r2(s, i, 6) });
    }
    return nodes;
  }

  if (mode === 'clusters') {
    const ext = Array.isArray(centers) && centers.length > 0;
    const C = ext ? centers.length : Math.max(1, clusters | 0);
    const ctr = [];
    for (let k = 0; k < C; k++) {
      if (ext) ctr.push([centers[k].x, centers[k].y]);
      else ctr.push([0.2 + 0.6 * r2(s, 1000 + k, 0), 0.25 + 0.5 * r2(s, 1000 + k, 1)]);
    }
    for (let i = 0; i < count; i++) {
      const k = Math.floor(r2(s, i, 2) * C) % C;
      const [cx, cy] = ctr[k];
      const dr = tightness * (r2(s, i, 3) + r2(s, i, 4) - 1); // 两路均匀差近似高斯
      const da = r2(s, i, 5) * Math.PI * 2;
      nodes.push({
        x: clamp01(cx + Math.cos(da) * dr * ax * 2),
        y: clamp01(cy + Math.sin(da) * dr * ay * 2),
        w: 0.4 + 0.6 * r2(s, i, 6),
        c: k,
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
