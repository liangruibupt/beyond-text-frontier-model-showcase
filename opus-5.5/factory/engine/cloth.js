// cloth.js — 布料：一张 nx × ny 的方格布，在 setup 里用 bake.js 按固定步长烘成表，每帧按 t 取顶点
// 解法是位置型（PBD / Verlet）：每步先积分（重力 + 风 + 阻尼），再迭代几遍约束（结构、剪切、弯曲三种距离约束），
// 然后把顶点推出碰撞体（球、胶囊、竖直圆柱、地面）。固定点（pins）按脚本函数 pos(t) 摆放，可以动（提起、扇动）。
// 只用 bake 给的 rng（风的阵风相位），所以表只由参数决定：拖动、倒放、乱序取帧都一致。
// 坐标是米，y 向上；布的第 i 列第 j 行的顶点下标是 j * nx + i，初始时铺在 rest(i, j) 给的位置上
import { bake, sampleInto } from './bake.js';

/**
 * 布料参数（未写的取默认）：
 *   nx, ny        网格顶点数（默认 32 × 32）
 *   size          [宽, 高]（米），只在没给 rest 时用：布铺在 xz 平面，中心在 origin
 *   origin        [x, y, z]（默认 [0, 1, 0]）
 *   rest(i, j)    → [x, y, z] 初始位置（给了就不用 size / origin）
 *   gravity       默认 -9.8
 *   damping       每秒速度保留比例的对数（默认 1.2：每秒衰减到 e^-1.2）
 *   iterations    每个子步的约束迭代次数（默认 2：小步长比多迭代收敛得好）；strain 结构边允许的最大伸长（默认 0.02）
 *   stretch       结构/剪切约束的刚度 0..1（默认 1）；bend 弯曲约束刚度（默认 0.15，丝绸软）
 *   wind(x, y, z, t, out)  → 把风速 [vx, vy, vz]（米/秒）写进 out；drag 风对布的拖拽系数（默认 1.5，按法向投影）
 *   pins          [{ i, j, pos: t => [x, y, z], until? }]：固定点；until 之后松开（自由下落）
 *   colliders     [{ type: 'sphere', c, r } | { type: 'capsule', a, b, r } | { type: 'cylinder', c, r, y0, y1 }（实心，带顶面和底面） | { type: 'ground', y }]
 *                 c / a / b 是 [x, y, z]；也可以是函数 t => [x, y, z]（会动的碰撞体）
 *   thickness     碰撞体外再留的厚度（默认 0.004）；friction 贴住碰撞体时切向速度保留的比例（默认 0.6）
 *   dt, t1, stride, seed   传给 bake（默认 1/1200、2、20、1：每 1/60 秒存一帧）
 */
export function bakeCloth(o) {
  const nx = o.nx ?? 32, ny = o.ny ?? 32, n = nx * ny;
  const [W, H] = o.size ?? [0.7, 0.7], [ox, oy, oz] = o.origin ?? [0, 1, 0];
  const rest = o.rest ?? ((i, j) => [ox + (i / (nx - 1) - 0.5) * W, oy, oz + (j / (ny - 1) - 0.5) * H]);
  const g = o.gravity ?? -9.8, damp = o.damping ?? 1.2, iters = o.iterations ?? 2, limit = 1 + (o.strain ?? 0.02);
  const kS = o.stretch ?? 1, kB = o.bend ?? 0.15, drag = o.drag ?? 1.5, th = o.thickness ?? 0.004, fr = o.friction ?? 0.6;
  const pins = (o.pins ?? []).map(p => ({ ...p, k: p.j * nx + p.i }));
  const cols = o.colliders ?? [];
  const idx = (i, j) => j * nx + i;

  // 约束：[a, b, 静止长度, 刚度]；按静止位置算长度
  const R = new Float64Array(n * 3);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) R.set(rest(i, j), idx(i, j) * 3);
  const len = (a, b) => Math.hypot(R[3 * a] - R[3 * b], R[3 * a + 1] - R[3 * b + 1], R[3 * a + 2] - R[3 * b + 2]);
  const C = [];
  const link = (a, b, k) => C.push(a, b, len(a, b), k);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const a = idx(i, j);
    if (i + 1 < nx) link(a, idx(i + 1, j), kS);
    if (j + 1 < ny) link(a, idx(i, j + 1), kS);
    if (i + 1 < nx && j + 1 < ny) { link(a, idx(i + 1, j + 1), kS * 0.7); link(idx(i + 1, j), idx(i, j + 1), kS * 0.7); }
    if (i + 2 < nx) link(a, idx(i + 2, j), kB);
    if (j + 2 < ny) link(a, idx(i, j + 2), kB);
  }
  const CON = Float64Array.from(C), nc = CON.length / 4;

  // 顶点法向（风的投影用）：中心差分
  const N = new Float64Array(n * 3), w3 = [0, 0, 0];
  function normals(P) {
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const l = idx(Math.max(i - 1, 0), j), r = idx(Math.min(i + 1, nx - 1), j), d = idx(i, Math.max(j - 1, 0)), u = idx(i, Math.min(j + 1, ny - 1));
      const ax = P[3 * r] - P[3 * l], ay = P[3 * r + 1] - P[3 * l + 1], az = P[3 * r + 2] - P[3 * l + 2];
      const bx = P[3 * u] - P[3 * d], by = P[3 * u + 1] - P[3 * d + 1], bz = P[3 * u + 2] - P[3 * d + 2];
      let cx = ay * bz - az * by, cy = az * bx - ax * bz, cz = ax * by - ay * bx; const m = Math.hypot(cx, cy, cz) || 1;
      const k = idx(i, j) * 3; N[k] = cx / m; N[k + 1] = cy / m; N[k + 2] = cz / m;
    }
  }
  const at = (v, t) => (typeof v === 'function' ? v(t) : v);
  // 把点 p（下标 k）推出所有碰撞体；推出去时按 friction 削掉一部分本步的切向位移（用上一步位置 Q 近似）
  function collide(P, Q, k, t) {
    for (const c of cols) {
      let x = P[k], y = P[k + 1], z = P[k + 2], nx_ = 0, ny_ = 0, nz_ = 0, d = 0;
      if (c.type === 'ground') { if (y >= c.y + th) continue; nx_ = 0; ny_ = 1; nz_ = 0; d = c.y + th - y; }
      else {
        let cx, cy, cz, r = c.r + th;
        if (c.type === 'sphere') [cx, cy, cz] = at(c.c, t);
        else if (c.type === 'cylinder') {                               // 实心竖直圆柱：从离得最近的面推出去（顶面、底面或侧面）
          const cc = at(c.c, t), y0 = c.y0 - th, y1 = c.y1 + th; if (y < y0 || y > y1) continue;
          const dx = x - cc[0], dz = z - cc[2], m = Math.sqrt(dx * dx + dz * dz); if (m >= r) continue;
          const side = r - m, up = y1 - y, down = y - y0;
          if (up <= side && up <= down) { nx_ = 0; ny_ = 1; nz_ = 0; d = up; }
          else if (down <= side) { nx_ = 0; ny_ = -1; nz_ = 0; d = down; }
          else { if (m < 1e-9) { nx_ = 1; nz_ = 0; } else { nx_ = dx / m; nz_ = dz / m; } ny_ = 0; d = side; }
          cx = null;
        }
        else { const A = at(c.a, t), B = at(c.b, t), ex = B[0] - A[0], ey = B[1] - A[1], ez = B[2] - A[2];
          const s = Math.min(Math.max(((x - A[0]) * ex + (y - A[1]) * ey + (z - A[2]) * ez) / (ex * ex + ey * ey + ez * ez || 1), 0), 1);
          cx = A[0] + ex * s; cy = A[1] + ey * s; cz = A[2] + ez * s; }
        if (cx !== null) {
          const dx = x - cx, dy = y - cy, dz = z - cz, m2 = dx * dx + dy * dy + dz * dz;
          if (m2 >= r * r) continue;
          const m = Math.sqrt(m2);
          if (m < 1e-9) { nx_ = 0; ny_ = 1; nz_ = 0; } else { nx_ = dx / m; ny_ = dy / m; nz_ = dz / m; }
          d = r - m;
        }
      }
      P[k] += nx_ * d; P[k + 1] += ny_ * d; P[k + 2] += nz_ * d;
      // 摩擦：本步位移的切向部分留 fr
      const vx = P[k] - Q[k], vy = P[k + 1] - Q[k + 1], vz = P[k + 2] - Q[k + 2], vn = vx * nx_ + vy * ny_ + vz * nz_;
      const tx = vx - vn * nx_, ty = vy - vn * ny_, tz = vz - vn * nz_;
      P[k] -= tx * (1 - fr); P[k + 1] -= ty * (1 - fr); P[k + 2] -= tz * (1 - fr);
    }
  }
  const pinned = (p, t) => p.until == null || t < p.until;

  // 状态 = [位置 n*3 | 上一步位置 n*3]；表里每帧存整个状态（取样时只用前一半）
  const init = () => { const s = new Float64Array(n * 6); s.set(R, 0); s.set(R, n * 3); return s; };
  let gust = null;
  const pq = new Map();
  const step = (S, dt, rng, t) => {
    if (!gust) gust = [rng(), rng(), rng()];                         // 阵风相位：只取一次，由 seed 定
    const P = S.subarray(0, n * 3), Q = S.subarray(n * 3), keep = Math.exp(-damp * dt);
    if (o.wind) normals(P);
    for (let k = 0; k < n * 3; k += 3) {
      let ax = 0, ay = g, az = 0;
      if (o.wind) {
        o.wind(P[k], P[k + 1], P[k + 2], t, w3, gust);
        const vx = (P[k] - Q[k]) / dt, vy = (P[k + 1] - Q[k + 1]) / dt, vz = (P[k + 2] - Q[k + 2]) / dt;
        const rel = (w3[0] - vx) * N[k] + (w3[1] - vy) * N[k + 1] + (w3[2] - vz) * N[k + 2];
        ax += drag * rel * N[k]; ay += drag * rel * N[k + 1]; az += drag * rel * N[k + 2];
      }
      const x = P[k], y = P[k + 1], z = P[k + 2];
      P[k] += (x - Q[k]) * keep + ax * dt * dt; P[k + 1] += (y - Q[k + 1]) * keep + ay * dt * dt; P[k + 2] += (z - Q[k + 2]) * keep + az * dt * dt;
      Q[k] = x; Q[k + 1] = y; Q[k + 2] = z;
    }
    const tn = t + dt;
    for (const p of pins) if (pinned(p, tn)) pq.set(p, p.pos(tn));      // 固定点的位置每步只求一次
    for (let it = 0; it < iters; it++) {
      for (let c = 0; c < nc; c++) {
        const a = CON[4 * c] * 3, b = CON[4 * c + 1] * 3, L = CON[4 * c + 2], k = CON[4 * c + 3];
        const dx = P[b] - P[a], dy = P[b + 1] - P[a + 1], dz = P[b + 2] - P[a + 2], m = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (m < 1e-12) continue;
        const f = (0.5 * k * (m - L)) / m;
        P[a] += dx * f; P[a + 1] += dy * f; P[a + 2] += dz * f; P[b] -= dx * f; P[b + 1] -= dy * f; P[b + 2] -= dz * f;
      }
      for (const p of pins) if (pinned(p, tn)) P.set(pq.get(p), p.k * 3);
      if (cols.length && (it % 3 === 2 || it === iters - 1)) for (let k = 0; k < n * 3; k += 3) collide(P, Q, k, tn);   // 碰撞放在迭代里：推出去以后约束还能再松一松
    }
    // 限拉伸（Provot）：结构边比静止长 limit 以上的，直接拉回到 limit；丝绸几乎不伸长，靠这一步保证
    for (let it = 0; it < 2; it++) for (let c = 0; c < nc; c++) {
      if (CON[4 * c + 3] < 0.99) continue;
      const a = CON[4 * c] * 3, b = CON[4 * c + 1] * 3, L = CON[4 * c + 2] * limit;
      const dx = P[b] - P[a], dy = P[b + 1] - P[a + 1], dz = P[b + 2] - P[a + 2], m = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (m <= L) continue;
      const f = (0.5 * (m - L)) / m;
      P[a] += dx * f; P[a + 1] += dy * f; P[a + 2] += dz * f; P[b] -= dx * f; P[b + 1] -= dy * f; P[b + 2] -= dz * f;
    }
    if (cols.length) for (let k = 0; k < n * 3; k += 3) collide(P, Q, k, tn);
    for (const p of pins) if (pinned(p, tn)) P.set(pq.get(p), p.k * 3);
  };
  // 开头先把固定点放到 pos(0)
  const init0 = rng => { const s = init(rng); for (const p of pins) if (pinned(p, 0)) { const q = p.pos(0); s.set(q, p.k * 3); s.set(q, n * 3 + p.k * 3); } return s; };
  const table = bake({ seed: o.seed ?? 1, dt: o.dt ?? 1 / 1200, t1: o.t1 ?? 2, stride: o.stride ?? 20, init: init0, step });
  return { table, nx, ny, n, constraints: CON, rest: R };
}

/** 时刻 t 的顶点位置写进 out（Float32Array，长度 ≥ n*3）；scratch 是长度 ≥ table.size 的 Float32Array（可复用） */
export function clothAt(cloth, t, out, scratch = new Float32Array(cloth.table.size)) {
  sampleInto(cloth.table, t, scratch);
  out.set(scratch.subarray(0, cloth.n * 3));
  return out;
}

/** 方格布的三角形下标（两三角一格），给 BufferGeometry.setIndex 用 */
export function clothIndex(nx, ny) {
  const a = [];
  for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) { const k = j * nx + i; a.push(k, k + nx, k + 1, k + 1, k + nx, k + nx + 1); }
  return a;
}

/** 最大拉伸：所有结构约束里 当前长度 / 静止长度 - 1 的最大值（测试与自检用） */
export function maxStretch(cloth, P) {
  const C = cloth.constraints; let m = 0;
  for (let c = 0; c < C.length; c += 4) {
    if (C[c + 3] < 0.99) continue;                                    // 只看结构约束（刚度 1）
    const a = C[c] * 3, b = C[c + 1] * 3, L = C[c + 2];
    m = Math.max(m, Math.hypot(P[b] - P[a], P[b + 1] - P[a + 1], P[b + 2] - P[a + 2]) / L - 1);
  }
  return m;
}
