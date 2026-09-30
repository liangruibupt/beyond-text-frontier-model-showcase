// refract-shape.js — 分层折射用的容器形状：形状描述、JS 参考求交（与着色器同一算法，Node 里可测）、每种形状的 GLSL 片段
// 一个形状描述 = { kind, outer, cavity, liquid }：三个凸实体（外形、内腔、液体），坐标在容器本地（原点在底面中心，y 向上，米）。
//   kind 'prism'：凸棱柱。实体 = { planes: [[nx, nz, d], …]（内部满足 nx·x + nz·z ≤ d，法线按角度 0, 2π/N, … 均匀排开）, y: [y0, y1] }
//   kind 'frustum'：截锥（竖直轴）。实体 = { r: [y0 处半径, y1 处半径], y: [y0, y1] }；两个半径都要 > 0（锥顶不在高度范围里）
// 求交的约定（着色器和 JS 一样）：
//   enter(p, d, S) → { t0, t1, n }：从外面沿 d 射向实体的入口 / 出口距离，打不中时 t0 ≥ t1；n 是入口外法线。初值 t0 = -1、t1 = 1（米），n = +y
//   exit(p, d, S) → { t, n }：从实体内部沿 d 走到出口的距离（≥ 0，最多 1 米），n 是出口外法线
// 数值上和着色器一样用单精度的阈值（1e-5 / 1e-6）；JS 用双精度算，结果在 1e-6 米内一致

const SOLIDS = ['outer', 'cavity', 'liquid'];
const U = { outer: 'uOut', cavity: 'uCav', liquid: 'uLiq' };

// ── 凸棱柱 ──
function prismEnter(p, d, S) {
  let t0 = -1, t1 = 1, n = [0, 1, 0];
  for (const [nx, nz, off] of S.planes) {
    const dn = nx * d[0] + nz * d[2], h = off - nx * p[0] - nz * p[2];
    if (Math.abs(dn) < 1e-6) { if (h < 0) return { t0: 1, t1: 0, n }; continue; }
    const s = h / dn;
    if (dn < 0) { if (s > t0) { t0 = s; n = [nx, 0, nz]; } } else t1 = Math.min(t1, s);
  }
  const [y0, y1] = S.y;
  if (Math.abs(d[1]) < 1e-6) { if (p[1] < y0 || p[1] > y1) return { t0: 1, t1: 0, n }; }
  else {
    const a = (y0 - p[1]) / d[1], b = (y1 - p[1]) / d[1];
    if (Math.min(a, b) > t0) { t0 = Math.min(a, b); n = [0, -Math.sign(d[1]), 0]; }
    t1 = Math.min(t1, Math.max(a, b));
  }
  return { t0, t1, n };
}
function prismExit(p, d, S) {
  let t = 1, n = [0, 1, 0];
  for (const [nx, nz, off] of S.planes) {
    const dn = nx * d[0] + nz * d[2];
    if (dn > 1e-5) { const s = (off - nx * p[0] - nz * p[2]) / dn; if (s < t) { t = s; n = [nx, 0, nz]; } }
  }
  if (Math.abs(d[1]) > 1e-5) { const s = ((d[1] > 0 ? S.y[1] : S.y[0]) - p[1]) / d[1]; if (s < t) { t = s; n = [0, Math.sign(d[1]), 0]; } }
  return { t: Math.max(t, 0), n };
}

// ── 截锥：侧面 x² + z² = (a + k·y)²，k = (r1 - r0) / (y1 - y0)，a = r0 - k·y0 ──
const BIG = 1e9;
/** 光线在侧面约束（锥的正确那一支里）内的区间 [lo, hi]；打不中时 lo > hi。高度范围由调用方再裁 */
function coneSpan(p, d, S) {
  const [r0, r1] = S.r, [y0, y1] = S.y, k = (r1 - r0) / (y1 - y0), a = r0 - k * y0, r = a + k * p[1];
  const A = d[0] * d[0] + d[2] * d[2] - k * k * d[1] * d[1], B = 2 * (p[0] * d[0] + p[2] * d[2] - k * d[1] * r), C = p[0] * p[0] + p[2] * p[2] - r * r;
  if (Math.abs(A) < 1e-9) {                                           // 平行于一条母线：约束是线性的
    if (Math.abs(B) < 1e-12) return C <= 0 ? [-BIG, BIG] : [1, 0];
    const s = -C / B;
    return B > 0 ? [-BIG, s] : [s, BIG];
  }
  const D = B * B - 4 * A * C;
  if (D < 0) return A > 0 ? [1, 0] : [-BIG, BIG];
  const q = Math.sqrt(D), s0 = (-B - q) / (2 * A), s1 = (-B + q) / (2 * A);
  if (A > 0) return [s0, s1];
  // A < 0（光线比母线陡）：侧面内是 t ≤ lo 和 t ≥ hi 两段，各在一支锥上；留下正确那一支（a + k·y > 0）上的一段
  const lo = Math.min(s0, s1), hi = Math.max(s0, s1);
  return a + k * (p[1] + d[1] * (lo - 1)) > 0 ? [-BIG, lo] : [hi, BIG];
}
/** 侧面上 q 点的外法线 */
function coneNormal(q, S) {
  const [r0, r1] = S.r, [y0, y1] = S.y, k = (r1 - r0) / (y1 - y0), v = [q[0], -k * (r0 + k * (q[1] - y0)), q[2]], l = Math.hypot(...v);
  return v.map(x => x / l);
}
const along = (p, d, t) => [p[0] + d[0] * t, p[1] + d[1] * t, p[2] + d[2] * t];
function frustumEnter(p, d, S) {
  const c = coneSpan(p, d, S);
  let t0 = -1, t1 = 1, n = [0, 1, 0];
  if (c[0] > t0) { t0 = c[0]; n = coneNormal(along(p, d, t0), S); }
  t1 = Math.min(t1, c[1]);
  const [y0, y1] = S.y;
  if (Math.abs(d[1]) < 1e-6) { if (p[1] < y0 || p[1] > y1) return { t0: 1, t1: 0, n }; }
  else {
    const a = (y0 - p[1]) / d[1], b = (y1 - p[1]) / d[1];
    if (Math.min(a, b) > t0) { t0 = Math.min(a, b); n = [0, -Math.sign(d[1]), 0]; }
    t1 = Math.min(t1, Math.max(a, b));
  }
  return { t0, t1, n };
}
function frustumExit(p, d, S) {
  const c = coneSpan(p, d, S);
  let t = 1, n = [0, 1, 0];
  if (c[1] < t) { t = c[1]; n = coneNormal(along(p, d, t), S); }
  if (Math.abs(d[1]) > 1e-5) { const s = ((d[1] > 0 ? S.y[1] : S.y[0]) - p[1]) / d[1]; if (s < t) { t = s; n = [0, Math.sign(d[1]), 0]; } }
  return { t: Math.max(t, 0), n };
}

const f = x => x.toFixed(6);
// 凸棱柱的 GLSL（N 个半平面）。N = 8 时逐字节就是 03 原来 glass.js 里的 PRISM 段
const prismDecl = N => /* glsl */`
uniform vec3 uOut[${N}], uCav[${N}], uLiq[${N}]; uniform vec2 uOutY, uCavY, uLiqY;
// 从凸棱柱内部 p 沿 d 走到出口：返回距离，n 为出口外法线
float exitP(vec3 p, vec3 d, vec3 P[${N}], vec2 Y, out vec3 n) {
  float t = 1.0; n = vec3(0.0, 1.0, 0.0);
  for (int i = 0; i < ${N}; i++) {
    float dn = P[i].x * d.x + P[i].y * d.z;
    if (dn > 1e-5) { float s = (P[i].z - P[i].x * p.x - P[i].y * p.z) / dn; if (s < t) { t = s; n = vec3(P[i].x, 0.0, P[i].y); } }
  }
  if (abs(d.y) > 1e-5) { float s = ((d.y > 0.0 ? Y.y : Y.x) - p.y) / d.y; if (s < t) { t = s; n = vec3(0.0, sign(d.y), 0.0); } }
  return max(t, 0.0);
}
// 从外面 p 沿 d 射向凸棱柱：返回（入口, 出口）距离，打不中时 x ≥ y；n 为入口外法线
vec2 enterP(vec3 p, vec3 d, vec3 P[${N}], vec2 Y, out vec3 n) {
  float t0 = -1.0, t1 = 1.0; n = vec3(0.0, 1.0, 0.0);
  for (int i = 0; i < ${N}; i++) {
    float dn = P[i].x * d.x + P[i].y * d.z, h = P[i].z - P[i].x * p.x - P[i].y * p.z;
    if (abs(dn) < 1e-6) { if (h < 0.0) return vec2(1.0, 0.0); continue; }
    float s = h / dn;
    if (dn < 0.0) { if (s > t0) { t0 = s; n = vec3(P[i].x, 0.0, P[i].y); } } else t1 = min(t1, s);
  }
  if (abs(d.y) < 1e-6) { if (p.y < Y.x || p.y > Y.y) return vec2(1.0, 0.0); }
  else {
    float a = (Y.x - p.y) / d.y, b = (Y.y - p.y) / d.y;
    if (min(a, b) > t0) { t0 = min(a, b); n = vec3(0.0, -sign(d.y), 0.0); }
    t1 = min(t1, max(a, b));
  }
  return vec2(t0, t1);
}
`;
const FRUSTUM_DECL = /* glsl */`
uniform vec4 uOut, uCav, uLiq;                                          // 截锥：(y0 处半径, y1 处半径, y0, y1)
// 侧面 x² + z² = (a + k·y)² 约束下光线 p + t·d 的区间（锥的正确那一支）；打不中时 x > y。高度范围由调用方再裁
vec2 coneSpan(vec3 p, vec3 d, vec4 F) {
  float k = (F.y - F.x) / (F.w - F.z), a = F.x - k * F.z, r = a + k * p.y;
  float A = d.x * d.x + d.z * d.z - k * k * d.y * d.y, B = 2.0 * (p.x * d.x + p.z * d.z - k * d.y * r), C = p.x * p.x + p.z * p.z - r * r;
  if (abs(A) < 1e-9) {
    if (abs(B) < 1e-12) return C <= 0.0 ? vec2(-1e9, 1e9) : vec2(1.0, 0.0);
    float s = -C / B;
    return B > 0.0 ? vec2(-1e9, s) : vec2(s, 1e9);
  }
  float D = B * B - 4.0 * A * C;
  if (D < 0.0) return A > 0.0 ? vec2(1.0, 0.0) : vec2(-1e9, 1e9);
  float q = sqrt(D), s0 = (-B - q) / (2.0 * A), s1 = (-B + q) / (2.0 * A);
  if (A > 0.0) return vec2(s0, s1);
  float lo = min(s0, s1), hi = max(s0, s1);                             // 比母线陡：两段各在一支锥上，留正确那一支
  return a + k * (p.y + d.y * (lo - 1.0)) > 0.0 ? vec2(-1e9, lo) : vec2(hi, 1e9);
}
vec3 coneN(vec3 q, vec4 F) { float k = (F.y - F.x) / (F.w - F.z); return normalize(vec3(q.x, -k * (F.x + k * (q.y - F.z)), q.z)); }
// 从截锥内部 p 沿 d 走到出口：返回距离，n 为出口外法线
float exitP(vec3 p, vec3 d, vec4 F, out vec3 n) {
  vec2 c = coneSpan(p, d, F);
  float t = 1.0; n = vec3(0.0, 1.0, 0.0);
  if (c.y < t) { t = c.y; n = coneN(p + d * t, F); }
  if (abs(d.y) > 1e-5) { float s = ((d.y > 0.0 ? F.w : F.z) - p.y) / d.y; if (s < t) { t = s; n = vec3(0.0, sign(d.y), 0.0); } }
  return max(t, 0.0);
}
// 从外面 p 沿 d 射向截锥：返回（入口, 出口）距离，打不中时 x ≥ y；n 为入口外法线
vec2 enterP(vec3 p, vec3 d, vec4 F, out vec3 n) {
  vec2 c = coneSpan(p, d, F);
  float t0 = -1.0, t1 = 1.0; n = vec3(0.0, 1.0, 0.0);
  if (c.x > t0) { t0 = c.x; n = coneN(p + d * t0, F); }
  t1 = min(t1, c.y);
  if (abs(d.y) < 1e-6) { if (p.y < F.z || p.y > F.w) return vec2(1.0, 0.0); }
  else {
    float a = (F.z - p.y) / d.y, b = (F.w - p.y) / d.y;
    if (min(a, b) > t0) { t0 = min(a, b); n = vec3(0.0, -sign(d.y), 0.0); }
    t1 = min(t1, max(a, b));
  }
  return vec2(t0, t1);
}
`;

/**
 * 每种形状的实现。glsl：
 *   decl 着色器里的 uniform 声明 + enterP / exitP；sig / pass 一个实体作为函数参数时的声明和实参（through() 用）；
 *   arg(u) 调用处传实体 u 的实参；top(u) 实体 u 顶面 y 的表达式；fid 面编号函数（焦散按走过的面分路）；faces 面编号的个数（组合编号的进位）
 */
export const KINDS = {
  prism: {
    enter: prismEnter, exit: prismExit,
    validate(S) {
      const N = S.outer.planes.length;
      for (const k of SOLIDS) if (S[k].planes.length !== N) throw new Error(`refract: prism ${k} has ${S[k].planes.length} planes, outer has ${N}`);
      const ang = S.outer.planes.map(([x, z]) => ((Math.atan2(z, x) / ((2 * Math.PI) / N)) % N + N) % N).sort((a, b) => a - b);
      ang.forEach((a, i) => { if (Math.abs(a - i) > 1e-6) throw new Error('refract: prism plane normals must be evenly spaced at angles 0, 2π/N, …'); });
    },
    glsl(S) {
      const N = S.outer.planes.length, step = f((2 * Math.PI) / N);
      return {
        decl: prismDecl(N), sig: `vec3 P[${N}], vec2 Y`, pass: 'P, Y', arg: u => `${u}, ${u}Y`, top: u => `${u}Y.y`, faces: N + 2,
        fid: `float fid(vec3 n) { return n.y > 0.5 ? ${N}.0 : n.y < -0.5 ? ${N + 1}.0 : floor(mod(atan(n.z, n.x) / ${step} + ${N}.5, ${N}.0)); }`,
      };
    },
    uniforms(S, THREE) {
      const out = {};
      for (const k of SOLIDS) {
        out[U[k]] = { value: S[k].planes.map(([nx, nz, d]) => new THREE.Vector3(nx, nz, d)) };
        out[`${U[k]}Y`] = { value: new THREE.Vector2(...S[k].y) };
      }
      return out;
    },
    bounds(S) {                                                        // 相邻半平面的交点围成的多边形
      const P = [...S.outer.planes].sort((a, b) => Math.atan2(a[1], a[0]) - Math.atan2(b[1], b[0])), xs = [], zs = [];
      P.forEach(([a1, b1, c1], i) => {
        const [a2, b2, c2] = P[(i + 1) % P.length], det = a1 * b2 - a2 * b1;
        xs.push((c1 * b2 - c2 * b1) / det); zs.push((a1 * c2 - a2 * c1) / det);
      });
      return [[Math.min(...xs), S.outer.y[0], Math.min(...zs)], [Math.max(...xs), S.outer.y[1], Math.max(...zs)]];
    },
  },
  frustum: {
    enter: frustumEnter, exit: frustumExit,
    validate(S) {
      for (const k of SOLIDS) {
        const { r, y } = S[k];
        if (!(r[0] > 0 && r[1] > 0 && y[1] > y[0])) throw new Error(`refract: frustum ${k} needs r0, r1 > 0 and y1 > y0`);
      }
    },
    glsl() {
      return {
        decl: FRUSTUM_DECL, sig: 'vec4 F', pass: 'F', arg: u => u, top: u => `${u}.w`, faces: 3,
        fid: 'float fid(vec3 n) { return n.y > 0.5 ? 1.0 : n.y < -0.5 ? 2.0 : 0.0; }',
      };
    },
    uniforms(S, THREE) {
      return Object.fromEntries(SOLIDS.map(k => [U[k], { value: new THREE.Vector4(S[k].r[0], S[k].r[1], S[k].y[0], S[k].y[1]) }]));
    },
    bounds(S) { const R = Math.max(...S.outer.r); return [[-R, S.outer.y[0], -R], [R, S.outer.y[1], R]]; },
  },
};

export function kindOf(shape) {
  const K = KINDS[shape?.kind];
  if (!K) throw new Error(`refract: unknown shape kind ${shape?.kind} (expected ${Object.keys(KINDS).join(' | ')})`);
  for (const k of SOLIDS) if (!shape[k]) throw new Error(`refract: shape is missing its ${k} solid`);
  K.validate(shape);
  return K;
}
/** JS 参考求交：solid 是 'outer' | 'cavity' | 'liquid' */
export const enter = (shape, solid, p, d) => kindOf(shape).enter(p, d, shape[solid]);
export const exit = (shape, solid, p, d) => kindOf(shape).exit(p, d, shape[solid]);
/** 外形的包围盒 [[x0, y0, z0], [x1, y1, z1]]（焦散网格对准它） */
export const boundsOf = shape => kindOf(shape).bounds(shape);

/** 凸棱柱：三个实体原样给出（03 的 bottle.js 算好的 SHAPE） */
export const prismShape = ({ outer, cavity, liquid }) => ({ kind: 'prism', outer, cavity, liquid });

/**
 * 薄壁截锥杯：底半径 rBottom、口半径 rTop（外壁）、高 height、壁厚 wall（垂直于壁量）、杯底厚 base、液面高 fill、液体离壁的间隙 gap。
 * open（默认）内腔通到杯口；否则留一层 wall 厚的顶
 */
export function frustumShape({ rBottom, rTop, height, wall, base = wall, fill, gap = 0.0003, open = true }) {
  const k = (rTop - rBottom) / height, slant = Math.sqrt(1 + k * k), at = y => rBottom + k * y;      // 外壁 y 处半径
  const solid = (inset, y0, y1) => ({ r: [at(y0) - inset * slant, at(y1) - inset * slant], y: [y0, y1] });
  if (!(fill > base + gap && fill <= height)) throw new Error('refract: frustum fill must sit between the cup base and its rim');
  return {
    kind: 'frustum',
    outer: { r: [rBottom, rTop], y: [0, height] },
    cavity: solid(wall, base, open ? height : height - wall),
    liquid: solid(wall + gap, base + gap, fill),
  };
}
