// stories/headset/meta.js — 电竞耳机「赛前送达」的骨架（纯数据，浏览器与 Node 测试共用）：
// 镜头、剪辑表、命中点、各镜头的机位。分镜 v2 §三：128 bpm，快切卡点，每段 1–2.5 秒；命中点落在 0.5 秒网格（和全片测试网格一致）。
// 世界是七个分开摆的小布景（彼此隔 24 米，互不入画），每个镜头有自己的机位，镜头之间硬切 / 闪白，不是一镜到底。
// 尺度是真实的米：耳机约 0.2 米、料箱 0.4 米、电梯轿厢约 2 米、夜城地图是一块 4×3 米的发光沙盘。

export const SHOTS = ['defeat', 'order', 'cube', 'route', 'ride', 'lift', 'victory'];
// 镜头内部事件（镜头本地秒 → 成片秒，见下方 STORY0）：断音 mute（defeat 1.0）、下单 order（order 0.5 = 成片 2.5）、
// 料箱出塔 lift（cube 1.5 = 5.0）、路线连通 connect（route 1.0 = 7.0）、溅水 splash（ride 1.0 = 9.5）、
// 叮 ding（lift 1.5 = 12.5）、戴上 wear（victory 0.0 = 13.0）、品牌动机 logo（victory 0.5 = 13.5）
export const EV = { mute: 1.0, order: 0.5, lift: 1.5, connect: 1.0, splash: 1.0, ding: 1.5, wear: 0.0, logo: 0.5 };
const flash = (d = 0.2) => ({ type: 'flash', dur: d });

export const CUTS = {
  15: {
    shots: [
      { shot: 'defeat', dur: 2.0 }, { shot: 'order', dur: 1.5, transition: flash() }, { shot: 'cube', dur: 2.5, transition: flash() },
      { shot: 'route', dur: 2.5, transition: flash() }, { shot: 'ride', dur: 2.5, transition: flash() },
      { shot: 'lift', dur: 2.0, transition: flash() }, { shot: 'victory', dur: 2.0, transition: flash() },
    ],
    hits: { mute: 1.0, order: 2.5, lift: 5.0, connect: 7.0, splash: 9.5, ding: 12.5, wear: 13.0, logo: 13.5 }, cover: 5.0,
  },
  // 6 秒版（1:1 双11）：order（下单 + 倒计时）→ lift（楼层跳到 23，叮）→ victory（价签 3 秒）；入场各落在自己的主体上
  6: {
    shots: [
      { shot: 'order', dur: 1.5, from: 0.0 },                                   // 0.0–1.5 下单，0.5 下单命中
      { shot: 'lift', dur: 1.5, from: 0.5, transition: flash() },               // 1.5–3.0 楼层跳动，2.5 叮
      { shot: 'victory', dur: 3.0, transition: flash() },                       // 3.0–6.0 戴上 + 价签停 3 秒
    ],
    hits: { order: 0.5, ding: 2.5, wear: 3.0, logo: 3.5 }, cover: 5.0,
  },
};
// 各镜头的天然时长（15 秒版）与故事时间：世界只看故事时间，6 秒版从中段切入落在同一帧
export const NATURAL = Object.fromEntries(CUTS[15].shots.map(e => [e.shot, e.dur]));
export const STORY0 = (() => { let t = 0; const o = {}; for (const e of CUTS[15].shots) { o[e.shot] = t; t += e.dur; } return o; })();
export const storyT = (name, lt) => STORY0[name] + lt;

// 七个布景的原点（米）：沿 x 每 24 米一个
export const SETS = Object.fromEntries(SHOTS.map((n, i) => [n, [i * 24, 0, 0]]));
export const FOV = 38;

const sm = (a, b, x) => { const k = Math.min(1, Math.max(0, (x - a) / (b - a))); return k * k * (3 - 2 * k); };
const L = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);
const at = (name, p) => [SETS[name][0] + p[0], SETS[name][1] + p[1], SETS[name][2] + p[2]];
// 机位：每个镜头一段推 / 移（from → to，整段 smoothstep），看点也跟着微移。全是布景本地坐标。
// 夜景快切，机位紧、低、略带角度；每个镜头一开场就对准主体（hold），6 秒版从中段切入也落在主体上。
export const RIG = {
  defeat: { from: [0.42, 0.46, 0.82], to: [0.3, 0.42, 0.6], look0: [0, 0.42, 0], look1: [0.02, 0.42, 0.02] },      // 桌面：显示器 + 耳机特写，低机位略偏右
  order: { from: [0.26, 0.44, 0.56], to: [0.2, 0.42, 0.46], look0: [0, 0.4, 0], look1: [0, 0.4, 0.01] },          // 手机屏正面近推
  cube: { from: [1.9, 1.7, 2.3], to: [1.4, 1.5, 1.8], look0: [0, 1.1, 0], look1: [0, 1.2, 0] },                   // 立体仓储塔：俯侧，缓缓推近看料箱提上来
  route: { from: [0.0, 2.6, 2.2], to: [0.0, 2.3, 1.7], look0: [0, 0, -0.1], look1: [0.1, 0, -0.1] },              // 夜城地图：高机位俯瞰整块沙盘
  ride: { from: [1.1, 0.34, 1.5], to: [0.4, 0.3, 1.1], look0: [0, 0.3, 0], look1: [-0.2, 0.28, -0.1] },           // 雨后街道：贴地低机位，车从右掠过
  lift: { from: [0.2, 1.5, 1.7], to: [0.1, 1.45, 1.3], look0: [0, 1.4, 0], look1: [0, 1.5, 0] },                  // 电梯：正对门和楼层数字
  victory: { from: [0.36, 0.5, 0.84], to: [0.26, 0.46, 0.64], look0: [0, 0.44, 0], look1: [0.02, 0.46, 0.02] },   // 玩家戴上耳机 + 屏幕 VICTORY
};
export const rowsFor = () => ({});
/** 镜头本地秒 lt → free 机位。offset 按构图表的 anchor（主体在画面里的位置） */
export function poseFor(name, lt, rows = {}) {
  const r = RIG[name], k = sm(0, NATURAL[name], lt), row = rows[name];
  const offset = row?.anchor ? [0.5 - row.anchor[0], 0.5 - row.anchor[1]] : [0, 0];
  return { position: at(name, L(r.from, r.to, k)), target: at(name, L(r.look0, r.look1, k)), offset };
}
