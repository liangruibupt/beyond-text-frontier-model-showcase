// stories/beans/meta.js — 瑰夏咖啡豆「今天烘的豆，明天在你杯里」的骨架（纯数据，浏览器与 Node 测试共用）：
// 镜头、剪辑表、命中点、各镜头的机位。分镜 v2 §四：96 bpm，慢推 + 叠化，每段 2.5 秒；命中点落在 0.5 秒网格（和全片的测试网格一致）。
// 世界是六个分开摆的小布景（彼此隔 20 米，互不入画），每个镜头有自己的机位，镜头之间叠化，不是一镜到底。
// 尺度是真实的米：咖啡豆约 1.2 厘米，烘豆机滚筒直径约 0.5 米，手冲壶约 0.2 米。

export const SHOTS = ['roast', 'cool', 'bag', 'night', 'alley', 'pour'];
// 镜头内部事件（镜头本地秒）：一爆 crack（roast 2.0）、倾倒 tip（cool 0.5 = 成片 3.0）、盖章 stamp（bag 1.5 = 6.5）、
// 出发 depart（night 0.5 = 8.0）、递到 handoff（alley 1.0 = 11.0）、注水 pour（pour 0.5 = 13.0）、品牌动机 logo（pour 1.0 = 13.5）
export const EV = { crack: 2.0, tip: 0.5, stamp: 1.5, depart: 0.5, handoff: 1.0, pour: 0.5, logo: 1.0, card: 0.6 };
const dz = (d = 0.4) => ({ type: 'dissolve', dur: d });

export const CUTS = {
  15: {
    shots: [
      { shot: 'roast', dur: 2.5 }, { shot: 'cool', dur: 2.5, transition: dz() }, { shot: 'bag', dur: 2.5, transition: dz() },
      { shot: 'night', dur: 2.5, transition: dz(0.5) }, { shot: 'alley', dur: 2.5, transition: dz(0.5) }, { shot: 'pour', dur: 2.5, transition: dz() },
    ],
    hits: { crack: 2.0, tip: 3.0, stamp: 6.5, depart: 8.0, handoff: 11.0, pour: 13.0, logo: 13.5 }, cover: 3.8,
  },
  6: {
    shots: [
      { shot: 'roast', dur: 1.5, from: 1.0 },                                    // 1.0 一爆
      { shot: 'bag', dur: 1.5, from: 1.0, transition: dz(0.3) },                 // 2.0 盖章
      { shot: 'pour', dur: 3.0, transition: dz(0.3) },                           // 3.5 注水，4.0 品牌，价签 3.0–6.0
    ],
    hits: { crack: 1.0, stamp: 2.0, pour: 3.5, logo: 4.0 }, cover: 5.0,
  },
};
// 各镜头的天然时长（15 秒版）与故事时间：世界只看故事时间，6 秒版从中段切入落在同一帧
export const NATURAL = Object.fromEntries(CUTS[15].shots.map(e => [e.shot, e.dur]));
export const STORY0 = (() => { let t = 0; const o = {}; for (const e of CUTS[15].shots) { o[e.shot] = t; t += e.dur; } return o; })();
export const storyT = (name, lt) => STORY0[name] + lt;

// 六个布景的原点（米）：沿 x 每 20 米一个
export const SETS = Object.fromEntries(SHOTS.map((n, i) => [n, [i * 20, 0, 0]]));
export const FOV = 30;

const sm = (a, b, x) => { const k = Math.min(1, Math.max(0, (x - a) / (b - a))); return k * k * (3 - 2 * k); };
const L = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);
const at = (name, p) => [SETS[name][0] + p[0], SETS[name][1] + p[1], SETS[name][2] + p[2]];
// 机位：每个镜头一段慢推（from → to，整段 smoothstep），看点也跟着微移。全是布景本地坐标
export const RIG = {
  roast: { from: [0.55, 0.72, 1.55], to: [0.3, 0.64, 1.1], look0: [0, 0.56, 0.12], look1: [0.02, 0.56, 0.16] },        // 烘豆机正面观察窗，略偏右的 3/4
  cool: { from: [0.45, 1.25, 0.95], to: [0.3, 1.05, 0.7], look0: [-0.12, 0.6, 0], look1: [-0.08, 0.6, 0] },               // 冷却盘斜俯拍
  bag: { from: [0.42, 0.44, 0.62], to: [0.3, 0.4, 0.48], look0: [0, 0.2, 0], look1: [0, 0.18, 0.02] },                  // 工作台上的牛皮纸袋
  night: { from: [-1.9, 0.6, 1.7], to: [-0.8, 0.5, 1.05], look0: [-0.3, 0, 0.35], look1: [0.7, 0.05, -0.25] },                 // 暖色夜景地图，缓缓推近
  alley: { from: [2.5, 1.45, 6.3], to: [1.9, 1.35, 5.4], look0: [0, 0.9, 0], look1: [0, 0.92, 0] },                  // 老街木格门，前景早餐摊蒸汽
  pour: { from: [0.0, 0.42, 0.72], to: [0.0, 0.38, 0.56], look0: [0.0, 0.18, 0], look1: [0.0, 0.16, 0] },               // 手冲台
};
export const rowsFor = () => ({});
/** 镜头本地秒 lt → free 机位。offset 按构图表的 anchor（主体在画面里的位置） */
export function poseFor(name, lt, rows = {}) {
  const r = RIG[name], k = sm(0, NATURAL[name], lt), row = rows[name];
  const offset = row?.anchor ? [0.5 - row.anchor[0], 0.5 - row.anchor[1]] : [0, 0];
  return { position: at(name, L(r.from, r.to, k)), target: at(name, L(r.look0, r.look1, k)), offset };
}
