// crowd.js — 「货到人」仓库里约 48 台 AGV 的路径规划（在 setup 里跑一次、存表，镜头按 t 查表）
// 仓库是 16 × 10 的网格。带时空预约表的协同 A*（cooperative A*）：按优先级逐台规划，同一时刻不占同一格，
// 也不对穿同一条边。时间步 0.25 s，规划满 3.5 s（镜头本地）。目标那台固定在 2.5 s（成片 4.0 s）停到拣货台。
// 规划不出来就换种子重试。结果是每台每步所在的格子（Int16Array，逐字节确定）。镜头里按 t 在相邻两格之间缓动插值，转向用最短角。
// 不用 bake.js（没有积分），直接存数组表。随机只用 factory/engine/rng.js。
import { mulberry32, rand } from '../../factory/engine/rng.js';
import { clamp, smooth } from '../../factory/engine/ease.js';

export const GRID_W = 16, GRID_H = 10;         // 格子数（x × z）
export const STEP = 0.25;                      // 时间步（秒）
export const HORIZON = 3.5;                    // 规划时长（镜头本地秒）
export const STEPS = Math.round(HORIZON / STEP) + 1;   // 存储帧数（含 t=0）
export const PICK = { x: 15, z: 5 };           // 拣货台（网格最右一列中段）
export const PICK_T = 2.5;                     // 目标 AGV 到拣货台的镜头本地时刻（成片 4.0 s）
export const COUNT = 48;                       // AGV 数

const KEY = (x, z) => z * GRID_W + x;          // 格子编号
const inside = (x, z) => x >= 0 && x < GRID_W && z >= 0 && z < GRID_H;
// 四邻 + 原地（等待）；原地让一台 AGV 停下避让
const MOVES = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]];

/** 曼哈顿距离（启发式） */
const manhattan = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.z - b.z);

/**
 * 单台 AGV 的时空 A*：从 start 在时刻 0 出发，到 goal；最晚在 arriveStep 之前到（到了就停在那里）。
 * reserved 是时空预约表：reserved.cell[t] 是 Set(格子编号)，reserved.edge[t] 是 Set("from->to") —— t 步从 from 走到 to。
 * 返回每一步的 {x, z}（长度 STEPS），占不下就返回 null。
 */
function planOne(start, goal, { reserved, arriveStep, exact = false, rng }) {
  // 节点 = (x, z, step)。open 用简单的数组优先队列（规模小，确定）
  // exact：必须恰好在 arriveStep 到达（目标 AGV，踩着成片 4.0 s 到拣货台）；否则在 arriveStep 之后到即可
  const startKey = `${start.x},${start.z},0`;
  const open = [{ x: start.x, z: start.z, step: 0, g: 0, f: manhattan(start, goal), key: startKey }];
  const came = new Map();                       // key → 上一节点的 {x, z, step}
  const bestG = new Map([[startKey, 0]]);
  const cellBlocked = (x, z, t) => reserved.cell[t]?.has(KEY(x, z));
  const edgeBlocked = (fx, fz, tx, tz, t) => reserved.edge[t]?.has(`${KEY(fx, fz)}>${KEY(tx, tz)}`) || reserved.edge[t]?.has(`${KEY(tx, tz)}>${KEY(fx, fz)}`);
  // exact 时，提前到了目标也不能停下占着拣货台（会挡住自己或改变时刻）——只在恰好 arriveStep 处收下
  const arrived = (x, z, step) => x === goal.x && z === goal.z && (exact ? step === arriveStep : step >= arriveStep);

  let guard = 0;
  while (open.length) {
    if (++guard > 300000) return null;
    // 取 f 最小（并列时 step 大的优先：尽量往前推进；再并列按 key 定序，保证确定）
    let bi = 0;
    for (let i = 1; i < open.length; i++) {
      const a = open[i], b = open[bi];
      if (a.f < b.f || (a.f === b.f && (a.step > b.step || (a.step === b.step && a.key < b.key)))) bi = i;
    }
    const cur = open.splice(bi, 1)[0];

    if (arrived(cur.x, cur.z, cur.step)) {
      // 回溯，并把到达后剩余的步数都停在 goal
      const path = new Array(STEPS);
      let node = cur;
      for (let s = cur.step; s >= 0; s--) { path[s] = { x: node.x, z: node.z }; node = came.get(`${node.x},${node.z},${s}`) ?? node; }
      for (let s = cur.step + 1; s < STEPS; s++) path[s] = { x: goal.x, z: goal.z };
      return path;
    }
    if (cur.step >= STEPS - 1) continue;         // 没时间了

    // 候选移动：随机打乱邻居顺序（按种子，确定）让各台走法不同
    const order = shuffle([0, 1, 2, 3, 4], rng);
    for (const mi of order) {
      const [dx, dz] = MOVES[mi], nx = cur.x + dx, nz = cur.z + dz, ns = cur.step + 1;
      if (!inside(nx, nz)) continue;
      if (cellBlocked(nx, nz, ns)) continue;               // 下一时刻那格被占
      if (edgeBlocked(cur.x, cur.z, nx, nz, ns)) continue; // 对穿同一条边
      const stepCost = dx || dz ? 1 : 0.6;                 // 原地等待也有代价（别白等），但比走便宜，鼓励让行
      const ng = cur.g + stepCost, nk = `${nx},${nz},${ns}`;
      if (ng < (bestG.get(nk) ?? Infinity)) {
        bestG.set(nk, ng);
        came.set(nk, { x: cur.x, z: cur.z, step: cur.step });
        open.push({ x: nx, z: nz, step: ns, g: ng, f: ng + manhattan({ x: nx, z: nz }, goal), key: nk });
      }
    }
  }
  return null;
}

/** Fisher–Yates，用传进来的 rng（确定） */
function shuffle(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/**
 * 非目标 AGV 的贪心时空步进（总能走满 STEPS，除非某一步五个方向全被占——那才算这台失败、换种子）。
 * 每步在没被预约（格子 + 边）的候选里挑：优先朝目标推进、再按种子微扰打破并列，鼓励转向而不是空等。
 * 这样只有目标 AGV 的「恰好 2.5 s 到」这一个硬约束会逼得换种子，拥堵不会让整个种子作废。
 */
function walkOne(start, goal, { reserved, rng }) {
  const path = [{ x: start.x, z: start.z }];
  const free = (x, z, t, fx, fz) => inside(x, z) && !reserved.cell[t]?.has(KEY(x, z))
    && !(reserved.edge[t]?.has(`${KEY(fx, fz)}>${KEY(x, z)}`) || reserved.edge[t]?.has(`${KEY(x, z)}>${KEY(fx, fz)}`));
  for (let s = 1; s < STEPS; s++) {
    const cur = path[s - 1];
    const cand = [];
    for (let mi = 0; mi < MOVES.length; mi++) {
      const [dx, dz] = MOVES[mi], nx = cur.x + dx, nz = cur.z + dz;
      if (!free(nx, nz, s, cur.x, cur.z)) continue;
      const toward = manhattan({ x: nx, z: nz }, goal), wait = dx || dz ? 0 : 1;   // 空等略加代价，倾向移动
      cand.push({ nx, nz, cost: toward + wait * 0.4 + rand(reserved.salt ^ (s * 131 + mi), nx * 97 + nz) * 0.3 });
    }
    if (!cand.length) return null;                              // 五向全堵：换种子
    cand.sort((a, b) => a.cost - b.cost || a.nx - b.nx || a.nz - b.nz);
    path.push({ x: cand[0].nx, z: cand[0].nz });
  }
  return path;
}

/** AGV 的起点和终点（按种子铺在网格上，确定）。第 0 台是目标 AGV：终点 = 拣货台 */
function endpoints(seed) {
  const pts = [], used = new Set();
  const pick = (salt, avoid) => {
    for (let k = 0; k < 400; k++) {
      const x = Math.floor(rand(seed ^ salt, k * 2) * GRID_W), z = Math.floor(rand(seed ^ salt, k * 2 + 1) * GRID_H), key = KEY(x, z);
      if (!used.has(key) && !(avoid && x === PICK.x && z === PICK.z)) { used.add(key); return { x, z }; }
    }
    return null;
  };
  // 目标 AGV：从拣货台左侧出发，距离比 arriveStep（10 步）少几步，留出让行 / 绕行的余量，正好 2.5 s 到
  const start0 = { x: PICK.x - 8, z: PICK.z - 2 };
  used.add(KEY(start0.x, start0.z)); used.add(KEY(PICK.x, PICK.z));
  pts.push({ start: start0, goal: { x: PICK.x, z: PICK.z }, target: true });
  for (let i = 1; i < COUNT; i++) {
    const s = pick(0x1234 + i, true), g = pick(0x9abc + i, true);
    if (!s || !g) return null;
    pts.push({ start: s, goal: g, target: false });
  }
  return pts;
}

/** 把一条路径登记进时空预约表（格子 + 边） */
function reserve(reserved, path) {
  for (let t = 0; t < STEPS; t++) {
    (reserved.cell[t] ??= new Set()).add(KEY(path[t].x, path[t].z));
    if (t > 0) (reserved.edge[t] ??= new Set()).add(`${KEY(path[t - 1].x, path[t - 1].z)}>${KEY(path[t].x, path[t].z)}`);
  }
}

/**
 * 规划整群 AGV。按优先级（目标 AGV 第一，其余按序）逐台规划，登记进预约表，后面的台让着前面的。
 * 规划不出来（某台占不下）就换下一个种子重试，最多 tries 次。返回：
 *   { cells: Int16Array(COUNT*STEPS*2)（每台每步 [x, z]）, seed, planMs, maxWait, tries }
 * cells 逐字节确定（同一 seed 两次规划一致）。
 */
export function planCrowd({ seed = 1, tries = 24 } = {}) {
  const t0 = nowMs();
  let used = seed, lastErr = 'no attempt';
  for (let attempt = 0; attempt < tries; attempt++, used = (used * 1103515245 + 12345) >>> 0) {
    const rng = mulberry32(used ^ 0xa5a5a5a5), pts = endpoints(used);
    if (!pts) { lastErr = 'no free endpoints'; continue; }
    const reserved = { cell: {}, edge: {}, salt: used ^ 0x51ed270b };
    const paths = [];
    let ok = true;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const path = p.target
        ? planOne(p.start, p.goal, { reserved, arriveStep: Math.round(PICK_T / STEP), exact: true, rng })
        : walkOne(p.start, p.goal, { reserved, rng });
      if (!path) { ok = false; lastErr = `agv ${i} unplannable`; break; }
      // 目标 AGV 必须恰好在 PICK_T 到达拣货台
      if (p.target) {
        const want = Math.round(PICK_T / STEP);
        if (path[want].x !== PICK.x || path[want].z !== PICK.z) { ok = false; lastErr = 'target off schedule'; break; }
      }
      reserve(reserved, path);
      paths.push(path);
    }
    if (!ok) continue;

    // 存成 Int16Array，顺带算最大等待步数（原地不动的最长连续步数）
    const cells = new Int16Array(COUNT * STEPS * 2);
    let maxWait = 0;
    for (let i = 0; i < COUNT; i++) {
      let wait = 0;
      for (let s = 0; s < STEPS; s++) {
        const c = paths[i][s], o = (i * STEPS + s) * 2;
        cells[o] = c.x; cells[o + 1] = c.z;
        if (s > 0 && paths[i][s].x === paths[i][s - 1].x && paths[i][s].z === paths[i][s - 1].z) { wait++; maxWait = Math.max(maxWait, wait); } else wait = 0;
      }
    }
    return { cells, seed: used, planMs: nowMs() - t0, maxWait, tries: attempt + 1 };
  }
  throw new Error(`crowd: unplannable after ${tries} seeds (${lastErr})`);
}

const nowMs = () => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());

// ── 取样：按镜头本地时间 t 取第 i 台的世界位置和朝向（相邻两格之间缓动插值；朝向最短角） ──
/** 格子中心 → 世界坐标 x/z（仓库铺在 warehouse 工位周围，一格 cell 米） */
export function cellToWorld(gx, gz, origin, cell) {
  return [origin[0] + (gx - (GRID_W - 1) / 2) * cell, origin[2] + (gz - (GRID_H - 1) / 2) * cell];
}

/** t（镜头本地秒）时第 i 台在网格坐标系里的插值位置 {x, z} 和朝向 heading（弧度，atan2(dz, dx)），不分配大对象 */
export function agvAt(cells, i, t, out = { x: 0, z: 0, heading: 0, moving: 0 }) {
  const f = clamp(t / STEP, 0, STEPS - 1), s0 = Math.floor(f), s1 = Math.min(STEPS - 1, s0 + 1), k = smooth(f - s0);
  const o0 = (i * STEPS + s0) * 2, o1 = (i * STEPS + s1) * 2;
  const x0 = cells[o0], z0 = cells[o0 + 1], x1 = cells[o1], z1 = cells[o1 + 1];
  out.x = x0 + (x1 - x0) * k; out.z = z0 + (z1 - z0) * k;
  const dx = x1 - x0, dz = z1 - z0;
  out.moving = dx || dz ? 1 : 0;
  if (dx || dz) out.heading = Math.atan2(dz, dx);
  return out;
}
