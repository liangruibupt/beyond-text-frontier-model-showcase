// grade.js — post.js 的调色（曝光 → 色调映射 → 饱和度 → gain / lift / gamma → sRGB）：着色器用的 GLSL 和 JS 的同一份写在一起
// 色调映射两种（后期参数 tone）：agx（默认，电影感，浅色会压灰、去饱和）；neutral（Khronos PBR Neutral，
// 为电商商品图做的，0.76 以下的颜色原样保留，浅色的品牌色、粉彩背景不走样）
// ungrade 反过来解：要在画面上显示成某个设计稿颜色，场景里该放什么线性色。背景这类按设计稿给的颜色用它，
// 过了后期正好显示成设计的颜色。暗角、颗粒、泛光不算在内

// AgX 取自 three 0.170 的 tonemapping_pars_fragment。列主序，和 GLSL 的 mat3(vec3 列, …) 一致
export const AGX = {
  S2R: [[0.6274, 0.0691, 0.0164], [0.3293, 0.9195, 0.0880], [0.0433, 0.0113, 0.8956]],
  R2S: [[1.6605, -0.1246, -0.0182], [-0.5876, 1.1329, -0.1006], [-0.0728, -0.0083, 1.1187]],
  INSET: [[0.856627153315983, 0.137318972929847, 0.11189821299995], [0.0951212405381588, 0.761241990602591, 0.0767994186031903], [0.0482516061458583, 0.101439036467562, 0.811302368396859]],
  OUTSET: [[1.1271005818144368, -0.1413297634984383, -0.14132976349843826], [-0.11060664309660323, 1.157823702216272, -0.11060664309660294], [-0.016493938717834573, -0.016493938717834257, 1.2519364065950405]],
};
export const TONES = { agx: 0, neutral: 1 };
const NEUTRAL = { start: 0.8 - 0.04, desat: 0.15 };
/** 着色器里的两个色调映射（线性 sRGB 进出），post.js 的调色着色器直接嵌进去；下面的 JS 逐行对应 */
export const TONE_GLSL = /* glsl */`
${Object.entries(AGX).map(([k, M]) => `const mat3 ${k} = mat3(${M.map(c => `vec3(${c.join(', ')})`).join(', ')});`).join('\n')}
vec3 agx(vec3 c) {
  c = INSET * (S2R * c);
  c = clamp((log2(max(c, 1e-10)) + 12.47393) / 16.5, 0.0, 1.0);
  vec3 x2 = c * c, x4 = x2 * x2;
  c = 15.5 * x4 * x2 - 40.14 * x4 * c + 31.96 * x4 - 6.868 * x2 * c + 0.4298 * x2 + 0.1191 * c - 0.00232;
  return clamp(R2S * pow(max(OUTSET * c, 0.0), vec3(2.2)), 0.0, 1.0);
}
vec3 neutral(vec3 c) {
  float x = min(c.r, min(c.g, c.b)), offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
  c -= offset;
  float peak = max(c.r, max(c.g, c.b));
  if (peak < ${NEUTRAL.start}) return c;
  float d = 1.0 - ${NEUTRAL.start}, newPeak = 1.0 - d * d / (peak + d - ${NEUTRAL.start});
  c *= newPeak / peak;
  return mix(c, vec3(newPeak), 1.0 - 1.0 / (${NEUTRAL.desat} * (peak - newPeak) + 1.0));
}`;

const mul = (M, v) => [0, 1, 2].map(i => M[0][i] * v[0] + M[1][i] * v[1] + M[2][i] * v[2]);
const sat = x => Math.min(1, Math.max(0, x));
export const toSrgb = c => (c < 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);
export const fromSrgb = c => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));

/** AgX：线性 sRGB 进，线性 sRGB 出（0–1） */
export function agx(c) {
  c = mul(AGX.INSET, mul(AGX.S2R, c)).map(x => sat((Math.log2(Math.max(x, 1e-10)) + 12.47393) / 16.5));
  c = c.map(x => { const x2 = x * x, x4 = x2 * x2; return 15.5 * x4 * x2 - 40.14 * x4 * x + 31.96 * x4 - 6.868 * x2 * x + 0.4298 * x2 + 0.1191 * x - 0.00232; });
  return mul(AGX.R2S, mul(AGX.OUTSET, c).map(x => Math.pow(Math.max(x, 0), 2.2))).map(sat);
}

/** PBR Neutral：线性 sRGB 进出 */
export function neutral(c) {
  const x = Math.min(...c), offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
  c = c.map(v => v - offset);
  const peak = Math.max(...c);
  if (peak < NEUTRAL.start) return c;
  const d = 1 - NEUTRAL.start, newPeak = 1 - (d * d) / (peak + d - NEUTRAL.start), g = 1 - 1 / (NEUTRAL.desat * (peak - newPeak) + 1);
  return c.map(v => v * (newPeak / peak) * (1 - g) + newPeak * g);
}
/** 后期参数的 tone → 着色器里的编号；写错了直接报错 */
export function toneOf(P) {
  const k = TONES[P.tone ?? 'agx'];
  if (k === undefined) throw new Error(`post: unknown tone "${P.tone}" (expected ${Object.keys(TONES).join(' | ')})`);
  return k;
}

/** 场景里的线性色 → 画面上的 sRGB（0–1）；P 是后期参数（mergePost 的结果） */
export function grade(lin, P) {
  const e = lin.map(x => x * P.exposure);
  let c = toneOf(P) === TONES.neutral ? neutral(e) : agx(e);
  const l = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  c = c.map(x => l + (x - l) * P.saturation);
  return c.map((x, i) => toSrgb(sat(Math.pow(Math.max(x * P.gain[i] + P.lift[i] * (1 - x), 0), 1 / P.gamma[i]))));
}

/** 3×3 线性方程组 A x = b（克莱姆法则） */
function solve3(A, b) {
  const det = M => M[0][0] * (M[1][1] * M[2][2] - M[1][2] * M[2][1]) - M[0][1] * (M[1][0] * M[2][2] - M[1][2] * M[2][0]) + M[0][2] * (M[1][0] * M[2][1] - M[1][1] * M[2][0]);
  const D = det(A);
  return [0, 1, 2].map(j => det(A.map((row, i) => row.map((v, k) => (k === j ? b[i] : v)))) / D);
}

/**
 * 画面上的 sRGB（0–1）→ 场景里的线性色：在对数空间里做阻尼的高斯-牛顿（Levenberg–Marquardt），
 * 三个通道一起解（neutral 近黑处的偏移、AgX 的色域压缩都会让通道互相牵连）。
 * 显示不出的颜色（纯白、AgX 色域外的饱和色）得到最接近的一个，亮度停在 MAX 以内
 */
const MAX = 64, MIN = 1e-6;
export function ungrade(srgb, P) {
  const t = srgb.map(fromSrgb), f = y => grade(y.map(Math.exp), P).map(fromSrgb);
  const err = y => f(y).reduce((a, v, i) => a + (v - t[i]) ** 2, 0), fit = y => y.map(v => Math.min(Math.log(MAX), Math.max(Math.log(MIN), v)));
  // 起点：每个通道按比例修正几轮。它能从夹到 0 的平台里出来（比例带着 ε），高斯-牛顿在那里导数为零
  let x = [...t];
  for (let k = 0; k < 40; k++) { const g = grade(x, P).map(fromSrgb); x = x.map((v, i) => Math.min(MAX, Math.max(MIN, v * Math.min(2, Math.max(0.5, Math.sqrt((t[i] + 1e-4) / (g[i] + 1e-4))))))); }
  let y = fit(x.map(Math.log)), e = err(y), lambda = 1e-3;
  for (let k = 0; k < 100 && e > 1e-14; k++) {
    const f0 = f(y), r = f0.map((v, i) => t[i] - v), h = 1e-5;
    const J = [0, 1, 2].map(j => { const z = [...y]; z[j] += h; return f(z).map((v, i) => (v - f0[i]) / h); });   // J[j][i] = ∂f_i / ∂y_j
    const JtJ = [0, 1, 2].map(a => [0, 1, 2].map(b => J[a].reduce((s2, v, i) => s2 + v * J[b][i], 0)));
    const Jtr = [0, 1, 2].map(a => J[a].reduce((s2, v, i) => s2 + v * r[i], 0));
    for (let tries = 0; tries < 12; tries++) {
      const step = solve3(JtJ.map((row, a) => row.map((v, b) => v + (a === b ? lambda * (v + 1e-9) : 0))), Jtr);
      const z = fit(y.map((v, j) => v + (Number.isFinite(step[j]) ? Math.max(-0.5, Math.min(0.5, step[j])) : 0))), ez = err(z);   // 一步最多乘除 e^0.5：别跳进夹到 0 或 1 的平台（那里导数为零，出不来）
      if (ez < e) { y = z; e = ez; lambda = Math.max(lambda / 4, 1e-9); break; }
      lambda *= 8;
    }
  }
  return y.map(Math.exp);
}
