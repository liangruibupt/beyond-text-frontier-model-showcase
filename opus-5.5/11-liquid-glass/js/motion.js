// motion.js — 每个镜头的「屏幕状态」：取景（推近）、小组件落位、时钟翻页、四层玻璃的形状（纯函数，浏览器与 Node 测试共用）
// 坐标见 layouts.js 的 UI：屏幕坐标，y 向下，单位是画面高度。玻璃的形状是带圆角的盒子（kind 0）或下沿起伏的玻璃幕（kind 1），
// glass.js 把同一层的形状按平滑并集（smooth min）合成一个距离场：两滴玻璃靠近时自然长出液桥、融成一滴
import { EV } from '../meta.js';
import { clamp, lerp, ss, easeInOut, easeOut } from '../../factory/engine/ease.js';

export const MAX_SHAPES = 6;
const TAU = Math.PI * 2;

// ── 弹簧：果冻般的落位 ──
// 从 0 长到 1：前 rise 秒按四分之一正弦长上去（末端斜率不为零），过冲之后阻尼振荡回到 1；第一次到 1 的时刻正好是 rise
export const POP = { rise: 0.35, hz: 2.2, decay: 0.14 };
export function pop(tau, { rise, hz, decay } = POP) {
  if (tau <= 0) return 0;
  if (tau < rise) return Math.sin((Math.PI / 2) * (tau / rise));
  const w = TAU * hz, a = Math.PI / (2 * rise * w), x = tau - rise;
  return 1 + a * Math.exp(-x / decay) * Math.sin(w * x);
}
/** 阻尼晃动：冲击之后 amp 起，按 hz 振荡、decay 秒衰减到 1/e */
export const wobble = (tau, amp, hz = 3, decay = 0.25) => (tau <= 0 ? 0 : amp * Math.exp(-tau / decay) * Math.sin(TAU * hz * tau));

// ── 形状 ──
/** 带圆角的盒子。stretch = 沿 dir（弧度）方向拉长 s 倍、垂直方向压成 1/s（面积不变），用来表现速度和果冻晃动 */
export function rbox(c, hw, hh, r, { stretch = 1, dir = 0, mag = 1 } = {}) {
  const co = Math.cos(dir), si = Math.sin(dir), a = 1 / stretch, b = stretch;   // 局部坐标 = R · diag(1/s, s) · Rᵀ · (p − c)
  const m00 = a * co * co + b * si * si, m01 = (a - b) * co * si, m11 = a * si * si + b * co * co;
  return { kind: 0, c, h: [hw, hh], r: Math.min(r, hw, hh), m: [m00, m01, m01, m11], ds: Math.min(stretch, 1 / stretch), mag };
}
/** 从上往下盖住屏幕的玻璃幕：下沿在 edge，沿 x 起伏（振幅 amp、波长 len、相位 phase） */
export const sheet = (edge, amp, len, phase) => ({ kind: 1, c: [0, edge], h: [amp, TAU / len], r: phase, m: [1, 0, 0, 1], ds: 1, mag: 1 });

/** 距离场（Node 测试用；glass.js 的着色器逐行对应）：负数在玻璃里 */
export function sdShape(s, p) {
  if (s.kind === 1) {
    const [amp, k] = s.h, y = s.c[1] + amp * Math.sin(k * p[0] + s.r), slope = amp * k * Math.cos(k * p[0] + s.r);
    return (p[1] - y) / Math.sqrt(1 + slope * slope);
  }
  const dx = p[0] - s.c[0], dy = p[1] - s.c[1], [m00, m01, m10, m11] = s.m;
  const qx = m00 * dx + m10 * dy, qy = m01 * dx + m11 * dy;
  const ax = Math.abs(qx) - s.h[0] + s.r, ay = Math.abs(qy) - s.h[1] + s.r;
  return (Math.hypot(Math.max(ax, 0), Math.max(ay, 0)) + Math.min(Math.max(ax, ay), 0) - s.r) * s.ds;
}
export function smin(a, b, k) {
  if (k <= 0) return Math.min(a, b);
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}
export const sdLayer = (layer, p) => layer.shapes.reduce((d, s) => smin(d, sdShape(s, p), layer.k), 1e9);

// ── 时钟的几何 ──
// em：各字符的字宽（字号的倍数）。浏览器里由 ui.js 按真实字体量出，Node 里用这组偏宽的估值
export const EM_GUESS = { digit: 0.64, colon: 0.3, cap: 0.73 };
/** 时钟的包围盒与分钟两位数的横向范围（屏幕坐标） */
export function clockBox(ui, em = EM_GUESS) {
  const { x, y, size, align } = ui.clock, w = size * (4 * em.digit + em.colon);
  const x0 = align === 'center' ? x - w / 2 : x, top = y - size * em.cap;
  return { x0, x1: x0 + w, top, bottom: y, cy: (top + y) / 2, min0: x0 + size * (2 * em.digit + em.colon), min1: x0 + w, cap: size * em.cap };
}
const rectC = r => [r[0] + r[2] / 2, r[1] + r[3] / 2];

// ── 每个镜头 ──
// 返回 { view: { f 注视点, z 缩放 }, widgets: { id: { g 形状长到几成, a 内容不透明度 } }, clock: { a, blur, rise, flip },
//        layers: { lens, sheet, card }（各是形状数组） }
const home = a => ({ f: [a / 2, 0.5], z: 1 });
const allOn = ui => Object.fromEntries(Object.keys(ui.widgets).map(id => [id, { g: 1, a: 1 }]));
export const FLOW = { z: 1.16, r: 0.085 };
export const LENS = { z: 1.45, pad: [0.05, 0.04] };

function wall(ui, a, lt) {
  const widgets = {};
  Object.keys(ui.widgets).forEach((id, i) => {
    const T = EV.pops[Math.min(i, EV.pops.length - 1)];
    widgets[id] = { g: pop(lt - (T - POP.rise)), a: ss(T - 0.05, T + 0.3, lt) };
  });
  const z = lerp(1.04, 1, easeOut(lt / 3));
  return { view: { f: [a / 2, 0.5], z }, widgets, clock: { a: ss(0.05, 0.7, lt), blur: 1 - ss(0, 0.8, lt), rise: 1 - easeOut(lt / 0.9), flip: 0 }, layers: {} };
}

/** 胶囊形透镜滑过时钟：1.35 秒前滑到分钟上方（带一点过冲），1.5 秒分钟在玻璃下翻页，2.1 秒起继续往右滑出去 */
function lens(ui, a, lt, em) {
  const cb = clockBox(ui, em), hh = cb.cap / 2 + LENS.pad[1], hw = (cb.min1 - cb.min0) / 2 + LENS.pad[0];
  const xs = cb.x0 - hw - 0.12, xm = (cb.min0 + cb.min1) / 2, xe = cb.x1 + hw + 0.35;
  const xAt = t => (t < 2.1 ? lerp(xs, xm, pop(t, { rise: 1.2, hz: 1.4, decay: 0.2 })) : lerp(xm, xe, Math.pow(clamp((t - 2.1) / 0.9), 2.2)));
  const x = xAt(lt), v = (xAt(lt + 1e-3) - xAt(lt - 1e-3)) / 2e-3;
  const stretch = 1 + clamp(Math.abs(v) * 0.09, 0, 0.22) + wobble(lt - 1.2, 0.05, 2.6, 0.3);
  const k = easeInOut(lt / 1.6), f0 = home(a).f, zMax = Math.min(LENS.z, (0.92 * a) / (cb.x1 - cb.x0 + 0.1));   // 推近时整个时钟留在画面里
  return {
    view: { f: [lerp(f0[0], (cb.x0 + cb.x1) / 2, k), lerp(f0[1], cb.cy, k)], z: lerp(1, zMax, k) },
    widgets: allOn(ui), clock: { a: 1, blur: 0, rise: 0, flip: clamp((lt - EV.tick + 0.1) / 0.4) },
    layers: { lens: [rbox([x, cb.cy], hw, hh, hh, { stretch, dir: 0, mag: 1.08 })] },
  };
}

/** 两滴玻璃分别滑过两块小组件，1.5 秒在两者之间相融（融合后变大一些、果冻般晃动），2.0 秒起上下拉开，液桥拉细、断开 */
export function flowPoints(ui) {
  const ids = Object.keys(ui.widgets), A = ui.widgets[ids[0]], B = ui.widgets[ids.at(-1)];
  const ca = rectC(A), cb = rectC(B), m = [(ca[0] + cb[0]) / 2, (A[1] + A[3] + B[1]) / 2];
  const from = [[A[0] - 0.12, A[1] + 0.02], [B[0] + B[2] + 0.1, B[1] + B[3] - 0.02]], d = [from[1][0] - from[0][0], from[1][1] - from[0][1]], n = Math.hypot(...d);
  return { m, from, axis: [d[0] / n, d[1] / n], centre: [(A[0] + B[0] + B[2]) / 2, (A[1] + B[1] + B[3]) / 2] };   // axis：两滴相向而来的方向
}
export const APART = { t: 2.0, dur: 1.0, dy: 0.34 };
// 两滴的圆心间距（半径的倍数）：1.5 秒刚碰上时还隔着 1.4 个半径，中间是一道液桥（花生形）；之后慢慢并拢到 0.5，拉开前也没完全融成一个圆
export const GAP = { touch: 1.4, close: 0.5 };
/** 第 i 滴（0 从左上来、1 从右下来）在 lt 的中心。相向而来时越来越快（像被表面张力吸过去），正好在 1.5 秒撞上，撞上后果冻晃动 */
export function dropAt(P, i, lt) {
  const came = clamp(lt / EV.merge) ** 2, apart = easeInOut(clamp((lt - APART.t) / APART.dur));
  const [x0, y0] = P.from[i], s = i ? 1 : -1, [ux, uy] = P.axis;
  const g = (FLOW.r / 2) * lerp(GAP.touch, GAP.close, easeInOut(clamp((lt - EV.merge) / (APART.t - EV.merge))));
  return [lerp(x0, P.m[0] + s * g * ux, came), lerp(y0, P.m[1] + s * g * uy, came) + s * APART.dy * apart];
}
function flow(ui, a, lt) {
  const P = flowPoints(ui), R = FLOW.r, shapes = [], e = 1e-3;
  const jig = wobble(lt - EV.merge, 0.16, 3.2, 0.28);
  const grow = 1 + 0.28 * ss(EV.merge - 0.25, EV.merge + 0.1, lt) * (1 - ss(APART.t, APART.t + 0.6, lt));
  for (const i of [0, 1]) {
    const p = dropAt(P, i, lt), p1 = dropAt(P, i, lt + e), v = [(p1[0] - p[0]) / e, (p1[1] - p[1]) / e], speed = Math.hypot(...v);
    const stretch = (1 + clamp(speed * 0.18, 0, 0.3)) * (1 + jig), dir = speed > 1e-3 ? Math.atan2(v[1], v[0]) : Math.PI / 2;
    shapes.push(rbox(p, R * grow, R * grow, R * grow, { stretch, dir, mag: 1.12 }));
  }
  const f0 = home(a).f, k = easeInOut(lt / 3);
  return { view: { f: [lerp(f0[0], P.centre[0], 0.35 + 0.15 * k), lerp(f0[1], P.centre[1], 0.35 + 0.15 * k)], z: lerp(1.1, FLOW.z, k) }, widgets: allOn(ui), clock: { a: 1, blur: 0, rise: 0, flip: 1 }, layers: { lens: shapes }, k: { lens: 0.07 } };
}

/** 磨砂玻璃幕从上往下扫过整屏：1.5 秒前沿扫过中线，快的时候下沿起伏更大，2.7 秒整屏盖住 */
export const SWEEP = { from: -0.1, to: 1.1, t: [0.3, 2.7] };
export const sweepEdge = lt => lerp(SWEEP.from, SWEEP.to, easeInOut(clamp((lt - SWEEP.t[0]) / (SWEEP.t[1] - SWEEP.t[0]))));
function sweep(ui, a, lt, em) {
  const y = sweepEdge(lt), v = (sweepEdge(lt + 1e-3) - sweepEdge(lt - 1e-3)) / 2e-3, amp = 0.008 + 0.022 * clamp(v / 1.2);
  const P = flowPoints(ui), f1 = [lerp(a / 2, P.centre[0], 0.5), lerp(0.5, P.centre[1], 0.5)], k = easeInOut(lt / 1.4);
  return {
    view: { f: [lerp(f1[0], a / 2, k), lerp(f1[1], 0.5, k)], z: lerp(FLOW.z, 1, k) },
    widgets: allOn(ui), clock: { a: 1, blur: 0, rise: 0, flip: 1 },
    layers: { sheet: y > -0.05 ? [sheet(y, amp, 0.75, lt * 2.4)] : [] },
  };
}

/** 片尾：整屏磨砂，中间一滴玻璃长成卡片（0.6 秒落定），字幕叠在卡上 */
function end(ui, a, lt) {
  const [x, y, w, h] = ui.card, g = pop(lt - (EV.card - POP.rise)), gx = pop(lt - (EV.card - POP.rise) - 0.04);
  const card = g > 0 ? [rbox([x + w / 2, y + h / 2], Math.max(1e-3, (w / 2) * gx), Math.max(1e-3, (h / 2) * g), 0.07)] : [];
  return { view: home(a), widgets: allOn(ui), clock: { a: 1, blur: 0, rise: 0, flip: 1 }, layers: { sheet: [sheet(SWEEP.to, 0.01, 0.75, 0)], card } };
}

/** 小组件的磨砂玻璃：g 从 0 长到 1（带过冲），先是一滴圆的，再摊成圆角卡，圆角收到 WIDGET_R */
export const WIDGET_R = 0.05;
export function widgetShapes(ui, widgets) {
  return Object.entries(ui.widgets).flatMap(([id, [x, y, w, h]]) => {
    const g = widgets[id]?.g ?? 0;
    if (g <= 1e-3) return [];
    const m = Math.min(w, h) / 2, e = clamp(g), hw = lerp(m, w / 2, e * e) * g, hh = lerp(m, h / 2, e) * g;   // 先圆，再横向摊开；过冲按 g 整体放大
    return [rbox([x + w / 2, y + h / 2], hw, hh, lerp(m, WIDGET_R, clamp(g)))];
  });
}

export const STATES = { wall, lens, flow, sweep, end };
/** 镜头 name 在本地秒 lt 的屏幕状态；ui = UI[ar]，a = 宽高比，em = 时钟字宽 */
export function stateAt(name, ui, a, lt, em = EM_GUESS) {
  const F = STATES[name](ui, a, lt, em);
  F.layers.widgets = widgetShapes(ui, F.widgets);
  return F;
}
