// digits.js — 十个数字的笔画字体（纯函数，页面与 Node 测试共用），以及 open 镜头的方块沿年份笔画的排布
// 字形在单位框里：宽 W、高 1，y 向上；每个数字是几笔，每笔由直线（折线，拐角倒圆）和椭圆弧接成，笔与笔不相交
// 排布：每一笔左右各一条道（离中线 lane），一年的每一天一块方块，按道的长度按比例分，沿道等距；
// 天的顺序就是书写顺序：数字从左到右、笔按顺序、两条道并排往前，所以按天翻面时年份一笔一笔写出来
// 不依赖画布的字体栅格化。2020–2039 年的每一年都排得下且互不重叠（test/digits.test.mjs）；
// 带两个 1 的年份（2041）笔画太短、方块太密，要先改字形或方块尺寸

export const W = 0.62;
const R = Math.PI / 180, STEP = 0.004;                                 // 加密折线的步长（单位框）

/** 椭圆弧：圆心、半径、起止角（度，从起到止，逆时针为正） */
const arc = (cx, cy, rx, ry, a0, a1) => ({ arc: [cx, cy, rx, ry, a0, a1] });
/** 折线：拐角按半径 r 倒圆；接在上一段后面时，起点就是上一段的终点 */
const poly = (pts, r = 0) => ({ poly: pts, r });
/** 把一个字的每一笔绕字框中心转 180°，并倒过书写顺序（9 由 6 得来） */
const turned = strokes => strokes.map(s => ({ ...s, turn: true }));

const SIX = [{ pieces: [arc(0.31, 0.3, 0.29, 0.68, 62, 180), arc(0.31, 0.3, 0.29, 0.29, 180, 478)] }];
export const DIGITS = {
  0: [{ pieces: [arc(0.31, 0.5, 0.31, 0.5, 90, 450)], closed: true }],
  1: [{ pieces: [poly([[0.04, 0.7], [0.38, 1], [0.38, 0]], 0.13)] }],
  2: [{ pieces: [arc(0.31, 0.69, 0.29, 0.29, 160, -48), poly([[0.03, 0], [0.62, 0]], 0.13)] }],
  // 3 和 5 的两处尖角（上下两个弯在中间相接、竖笔接进下面的弯）写成分开的两笔，中间留缝：尖角处两边的方块会撞上
  3: [
    { pieces: [arc(0.3, 0.79, 0.25, 0.2, 165, -90), poly([[0.2, 0.59]])] },
    { pieces: [poly([[0.2, 0.47], [0.3, 0.47]]), arc(0.3, 0.235, 0.31, 0.235, 90, -150)] },
  ],
  4: [
    { pieces: [poly([[0.36, 1], [0.02, 0.32], [0.62, 0.32]], 0.13)] },
    { pieces: [poly([[0.47, 0.66], [0.47, 0.44]])] },
    { pieces: [poly([[0.47, 0.2], [0.47, 0]])] },
  ],
  5: [
    { pieces: [poly([[0.58, 1], [0.08, 1], [0.06, 0.6]], 0.13)] },
    { pieces: [arc(0.31, 0.29, 0.31, 0.29, 105, -150)] },
  ],
  6: SIX,
  7: [{ pieces: [poly([[0, 1], [0.62, 1], [0.2, 0]], 0.13)] }],
  8: [
    { pieces: [arc(0.31, 0.8, 0.24, 0.2, 270, 630)], closed: true },
    { pieces: [arc(0.31, 0.25, 0.31, 0.25, 90, 450)], closed: true },
  ],
  9: turned(SIX),
};

// ── 几何 ──
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]], len = v => Math.hypot(v[0], v[1]), norm = v => { const l = len(v); return [v[0] / l, v[1] / l]; };

function arcPts([cx, cy, rx, ry, a0, a1]) {
  const n = Math.max(2, Math.ceil((Math.abs(a1 - a0) * R * Math.max(rx, ry)) / STEP)), out = [];
  for (let i = 0; i <= n; i++) { const a = (a0 + ((a1 - a0) * i) / n) * R; out.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]); }
  return out;
}
function linePts(a, b) {
  const n = Math.max(1, Math.ceil(len(sub(b, a)) / STEP)), out = [];
  for (let i = 0; i <= n; i++) out.push([a[0] + ((b[0] - a[0]) * i) / n, a[1] + ((b[1] - a[1]) * i) / n]);
  return out;
}
/** 折线 → 加密的点；每个中间拐点换成与两边相切、半径 r 的圆弧 */
function polyPts(pts, r) {
  const out = [];
  let from = pts[0];
  for (let i = 1; i < pts.length; i++) {
    const B = pts[i], C = pts[i + 1];
    if (!C || !r) { out.push(...linePts(from, B)); from = B; continue; }
    const u = norm(sub(B, from)), v = norm(sub(C, B)), cos = Math.max(-1, Math.min(1, u[0] * v[0] + u[1] * v[1]));
    const phi = Math.acos(cos), t = Math.min(r * Math.tan(phi / 2), len(sub(B, from)) * 0.49, len(sub(C, B)) * 0.49), rr = t / Math.tan(phi / 2);
    const P = [B[0] - u[0] * t, B[1] - u[1] * t], Q = [B[0] + v[0] * t, B[1] + v[1] * t], turn = Math.sign(u[0] * v[1] - u[1] * v[0]) || 1;
    const c = [P[0] - u[1] * rr * turn, P[1] + u[0] * rr * turn], a0 = Math.atan2(P[1] - c[1], P[0] - c[0]);
    let a1 = Math.atan2(Q[1] - c[1], Q[0] - c[0]);
    if (turn > 0) while (a1 < a0) a1 += 2 * Math.PI; else while (a1 > a0) a1 -= 2 * Math.PI;
    out.push(...linePts(from, P), ...arcPts([c[0], c[1], rr, rr, a0 / R, a1 / R]));
    from = Q;
  }
  return out;
}

/** 一笔 → 加密的中线点（单位框） */
export function strokePts(stroke) {
  let pts = [];
  for (const p of stroke.pieces) {
    const q = p.arc ? arcPts(p.arc) : polyPts(pts.length ? [pts[pts.length - 1], ...p.poly] : p.poly, p.r);
    pts.push(...(pts.length ? q.slice(1) : q));
  }
  if (stroke.turn) pts = pts.map(([x, y]) => [W - x, 1 - y]).reverse();
  return pts;
}

/** 折线的累计弧长 */
const cumulative = pts => pts.reduce((acc, p, i) => (acc.push(i ? acc[i - 1] + len(sub(p, pts[i - 1])) : 0), acc), []);
/** 在弧长 s 处的点、切向角、在折线上的比例 */
function at(pts, cum, s) {
  let i = 1;
  while (i < pts.length - 1 && cum[i] < s) i++;
  const k = (s - cum[i - 1]) / (cum[i] - cum[i - 1] || 1), a = pts[i - 1], b = pts[i];
  return { p: [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k], angle: Math.atan2(b[1] - a[1], b[0] - a[0]), u: (i - 1 + k) / (pts.length - 1) };
}
/** 离中线 d 的平行道（点的法向取前后两点的方向） */
function offset(pts, d) {
  return pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], t = norm(sub(b, a));
    return [p[0] - t[1] * d, p[1] + t[0] * d];
  });
}
/** 把 n 按权重分成整数，和正好是 n（最大余数法） */
function apportion(n, weights) {
  const tot = weights.reduce((a, b) => a + b, 0), raw = weights.map(w => (n * w) / tot), out = raw.map(Math.floor);
  const order = raw.map((x, i) => [x - Math.floor(x), i]).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  const left = n - out.reduce((a, b) => a + b, 0);
  for (let k = 0; k < left; k++) out[order[k][1]]++;
  return out;
}

/**
 * 年份的方块排布（场景单位）：n 块，按天的顺序 [{ x, y, angle, digit }]；angle 是所在道的切向（弧度）
 * 尺寸见 WALL；四个字整体水平居中于 x = 0
 */
export const WALL = { tile: 0.05, height: 1.42, gap: 0.4, lane: 0.04, y0: 0.24 };   // 方块边长、字高、字距、道离中线、字框底边（场景单位）
export function layoutYear(year, n, { height, gap, lane, y0 } = WALL) {
  const chars = String(year).split(''), d = lane / height, x0 = -(chars.length * W * height + (chars.length - 1) * gap) / 2;
  // 每一笔两条道；道按字、笔、道的顺序排好
  const lanes = [];
  chars.forEach((c, ci) => DIGITS[c].forEach((st, si) => {
    const mid = strokePts(st);
    for (const side of [1, -1]) { const pts = offset(mid, side * d), cum = cumulative(pts); lanes.push({ ci, si, closed: !!st.closed, pts, cum, L: cum[cum.length - 1] }); }
  }));
  const counts = apportion(n, lanes.map(l => l.L)), tiles = [];
  // 同一笔的两条道按中线比例 u 合并排序：两条道并排往前写
  for (let i = 0; i < lanes.length; i += 2) {
    const pair = [lanes[i], lanes[i + 1]].flatMap((l, j) => {
      const m = counts[i + j], sp = l.L / m;
      return Array.from({ length: m }, (_, k) => ({ ...at(l.pts, l.cum, l.closed ? (k + 0.5) * sp : m === 1 ? l.L / 2 : (k * l.L) / (m - 1)), ci: l.ci }));
    }).sort((a, b) => a.u - b.u);
    for (const t of pair) tiles.push({ x: x0 + t.ci * (W * height + gap) + t.p[0] * height, y: y0 + t.p[1] * height, angle: t.angle, digit: t.ci });
  }
  return tiles;
}

/**
 * 一行小字（months 的月份）的圆点排布：每一笔一条道，就在中线上，沿道等距，间距约 step 个直径（短笔也不密过 1.1 个）；
 * 闭合的笔绕一圈；和同一个字里已经排下的点挨得太近（8 的腰）就不再排。字高 height；字按墨迹的宽度紧排，
 * 相邻两字最近的圆点中心隔 gap（1 很窄，用字框排的话 10、11 里的字距和两个标签的间距差不多，连成一串）。
 * 整体按墨迹水平居中于 x，字框底边在 y0。返回 [{ x, y }]；任意两点的中心距不小于 1.1 个直径（test/digits.test.mjs）
 */
export const LABEL_GAP = 1.1;
export function layoutLabel(str, { height, dot, x = 0, y0 = 0, gap = 0.3 * height, step = 1.25 }) {
  const glyphs = String(str).split('').map(c => {
    const mine = [];
    for (const st of DIGITS[c]) {
      const pts = strokePts(st), cum = cumulative(pts), L = cum[cum.length - 1], len = L * height;
      const n = Math.min(Math.round(len / (step * dot)), Math.floor(len / (LABEL_GAP * dot))), m = st.closed ? Math.max(3, n) : n + 1;
      for (let k = 0; k < m; k++) {
        const a = at(pts, cum, st.closed ? (k * L) / m : m === 1 ? L / 2 : (k * L) / (m - 1));
        const p = { x: a.p[0] * height, y: y0 + a.p[1] * height };
        if (!mine.some(q => Math.hypot(q.x - p.x, q.y - p.y) < LABEL_GAP * dot)) mine.push(p);
      }
    }
    const xs = mine.map(p => p.x);
    return { dots: mine, lo: Math.min(...xs), hi: Math.max(...xs) };
  });
  let cursor = 0;
  const out = glyphs.flatMap(g => { const dx = cursor - g.lo; cursor += g.hi - g.lo + gap; return g.dots.map(p => ({ x: p.x + dx, y: p.y })); });
  const shift = x - (cursor - gap) / 2;
  return out.map(p => ({ x: p.x + shift, y: p.y }));
}
