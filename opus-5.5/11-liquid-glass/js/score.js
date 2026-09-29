// score.js — 配乐与音效（纯数据，浏览器与 Node 测试共用）：score(v, built) → { notes, reverb }，由 factory/engine/audio.js 合成
// 三款主题共用一份编曲（按各自的主音移调，音色的亮度和混响不同），15 秒和 6 秒各写一版（6 秒不是截短的 15 秒）
// 利底亚调式（主音之上 0 2 4 #4 5 6 7 级：升四级给出玻璃一样的亮），玻璃钟、马林巴、卡林巴、柔和的铺底；音效是水滴、翻页的咔哒、玻璃幕扫过的气流
// 一小节 3 秒、四拍（80 bpm）：命中点（小组件落位、分钟翻页、两滴相融、玻璃幕扫过中线、品牌动机）都在拍上；配乐的起音都在十六分音符的格子上
import { BEAT, EV } from '../meta.js';
import { SWEEP } from './motion.js';
import { shotAt } from '../../factory/engine/timeline.js';
import { mtof } from '../../factory/engine/audio.js';

export const STEP = BEAT / 4;                             // 十六分音符 0.1875 秒
export const LOGO = [4, 11, 12];                          // 品牌动机：三度、七度，再落到八度（导音解决到主音）；落在第 0、½、1 拍，最后一个音延长

// ── 各主题的音色 ──
// tonic 主音（MIDI）；glass 玻璃钟的分音与亮度；reverb 混响；bed 整段的空气声（滤波噪声）
export const THEMES = {
  iris: { tonic: 64, glass: { ratios: [1, 2.76, 5.4, 8.93], bright: 0.75 }, reverb: { decay: 3.4, music: 0.45, sfx: 0.3 },     // E 利底亚：清冷的蓝紫
    bed: { type: 'bandpass', f: 1400, q: 0.45, a: 0.8, r: 1.4, wander: 0.7, v: 0.26 } },
  dawn: { tonic: 65, glass: { ratios: [1, 2.76, 5.4], bright: 0.5 }, reverb: { decay: 3.8, music: 0.5, sfx: 0.3 },                // F 利底亚：暖一些、圆一些
    bed: { type: 'bandpass', f: 900, q: 0.5, a: 0.8, r: 1.4, wander: 0.6, v: 0.28 } },
  mint: { tonic: 62, glass: { ratios: [1, 2.76, 5.4, 8.93], bright: 0.9 }, reverb: { decay: 3, music: 0.4, sfx: 0.28 },           // D 利底亚：更脆、更短
    bed: { type: 'bandpass', f: 1800, q: 0.4, a: 0.8, r: 1.4, wander: 0.8, v: 0.24 } },
};
const PAD = { a: 1, r: 1.2, cut: 2.6, air: 0.35 }, LOW = { t60: 3.2, bright: 0.25 }, KAL = { t60: 1, bright: 0.55 }, MAR = { ratios: [1, 3.93, 9.2], bright: 0.3 };

/** 一组音（主音 T 之上的半音数）：rows = [[拍, 音程, 时值（拍）, 力度], …]，拍从 t0 算起 */
const voices = T => (voice, t0, rows, p = {}, bus = 'music') => rows.map(([b, k, d, v]) => ({ t: t0 + b * BEAT, voice, f: mtof(T + k), d: d * BEAT, v, bus, p }));

// 用到的和弦（主音之上）：I = 0 4 7，II = 2 #4 6（利底亚的二级大三和弦），vi = 9 0 4，V = 7 11 14
function m15(T, c) {
  const s = voices(T);
  return [
    // 0–3 主屏：I 的铺底从雾里升起；三块小组件落位的 0.75 / 1.5 / 2.25，玻璃钟一个比一个高（五度、七度、九度），低音跟着一步步上来
    ...s('pad', 0, [[0, -12, 4, 0.8], [0, -5, 4, 0.6], [0, 4, 4, 0.35]], { ...PAD, a: 1.2 }),
    ...s('bell', 0, [[1, 7, 2.5, 0.45], [2, 11, 2.5, 0.45], [3, 14, 2.5, 0.5]], c.glass),
    ...s('pluck', 0, [[1, -12, 2, 0.28], [2, -5, 2, 0.26], [3, 0, 2, 0.28]], LOW),
    // 3–4.5 透镜：低音主音进来，马林巴八分音符轻轻地走
    ...s('pluck', 3, [[0, -24, 4, 0.5], [0, -12, 3, 0.3]], LOW),
    ...s('bell', 3, [[0, 0, 1, 0.3], [0.5, 7, 1, 0.22], [1, 4, 1, 0.26], [1.5, 7, 1, 0.22]], MAR),
    ...s('pad', 3, [[0, -12, 2, 0.7], [0, -5, 2, 0.5], [0, 4, 2, 0.3]], PAD),
    // 4.5 分钟翻页：和声走到 II（升四级亮起来），玻璃钟高八度的 #4 闪一下；马林巴往下走回来
    ...s('pad', 4.5, [[0, -10, 2, 0.7], [0, -3, 2, 0.5], [0, 6, 2, 0.35]], { ...PAD, a: 0.15 }),
    ...s('bell', 4.5, [[0, 18, 2.4, 0.45], [0.5, 14, 1.6, 0.22]], c.glass),
    ...s('pluck', 4.5, [[0, -10, 3, 0.45]], LOW),
    ...s('bell', 4.5, [[0.5, 9, 1, 0.22], [1, 6, 1, 0.24], [1.5, 2, 1, 0.22]], MAR),
    // 6–7.5 两滴玻璃：vi 的铺底；卡林巴两路相向，高处往下、低处往上，7.5 汇到同一个五度上
    ...s('pad', 6, [[0, -3, 2, 0.65], [0, 4, 2, 0.45], [0, 12, 2, 0.3]], { ...PAD, a: 0.4 }),
    ...s('pluck', 6, [[0, 19, 1, 0.3], [0.5, -5, 1, 0.3], [1, 16, 1, 0.3], [1.25, -1, 1, 0.3], [1.5, 14, 1, 0.32], [1.75, 2, 1, 0.32]], KAL),
    // 7.5 相融：低音主音、玻璃钟五度（加高八度），铺底回到 Imaj7；8.25 起两滴拉开，音也分开往两头走
    ...s('pluck', 7.5, [[0, -12, 4, 0.5], [0, 7, 3, 0.35]], LOW),
    ...s('bell', 7.5, [[0, 7, 3, 0.5], [0, 19, 2, 0.22]], c.glass),
    ...s('pad', 7.5, [[0, -12, 2, 0.75], [0, -5, 2, 0.55], [0, 4, 2, 0.35], [0, 11, 2, 0.25]], { ...PAD, a: 0.15 }),
    ...s('pluck', 7.5, [[1, 11, 1.5, 0.24], [1, 2, 1.5, 0.24], [1.5, 14, 1, 0.2], [1.5, -1, 1, 0.2]], KAL),
    // 9–10.5 玻璃幕：铺底停在 V 上，一口气流往上走，扫进 10.5
    ...s('pad', 9, [[0, -5, 2, 0.65], [0, -1, 2, 0.45], [0, 2, 2, 0.35]], { ...PAD, a: 0.6 }),
    { t: 9, voice: 'noise', f: 420, d: 1.5, v: 0.4, bus: 'music', p: { type: 'bandpass', q: 1.1, sweep: 7, a: 1.3, r: 0.05 } },
    ...s('bell', 9, [[0.5, 14, 1.5, 0.2], [1.5, 11, 1.5, 0.18]], c.glass),
    // 10.5 扫过中线：玻璃钟往下撒四个音，像霜结在玻璃上；铺底挂在 II 上等着回家
    ...s('bell', 10.5, [[0, 19, 2, 0.38], [0.25, 18, 2, 0.3], [0.5, 14, 2, 0.26], [0.75, 11, 2, 0.24]], c.glass),
    ...s('pad', 10.5, [[0, -10, 2, 0.6], [0, -3, 2, 0.45], [0, 6, 2, 0.3]], { ...PAD, a: 0.3, r: 0.8 }),
    ...s('pluck', 10.5, [[0, -10, 2, 0.4]], LOW),
    // 12.0 片尾：品牌动机（共用），Imaj9 的铺底和低音主音收住
    ...s('pad', 12, [[0, -12, 4, 0.8], [0, -5, 4, 0.6], [0, 4, 4, 0.35], [0, 11, 4, 0.22], [0, 14, 4, 0.18]], { ...PAD, a: 0.4, r: 0.8 }),
    ...s('pluck', 12, [[0, -24, 5, 0.5], [0, -12, 5, 0.3]], LOW),
  ];
}

function m6(T, c) {
  const s = voices(T);
  return [
    // 0 开门就是透镜：I 的铺底、低音主音、马林巴两下
    ...s('pad', 0, [[0, -12, 1, 0.8], [0, -5, 1, 0.6], [0, 4, 1, 0.35]], { ...PAD, a: 0.4 }),
    ...s('pluck', 0, [[0, -24, 2, 0.45]], LOW),
    ...s('bell', 0, [[0, 0, 1, 0.3], [0.5, 7, 1, 0.24]], MAR),
    // 0.75 分钟翻页：II，玻璃钟高八度的 #4
    ...s('pad', 0.75, [[0, -10, 1.2, 0.7], [0, -3, 1.2, 0.5], [0, 6, 1.2, 0.35]], { ...PAD, a: 0.15 }),
    ...s('bell', 0.75, [[0, 18, 2, 0.45]], c.glass),
    ...s('pluck', 0.75, [[0, -10, 2, 0.45]], LOW),
    // 1.5 两滴玻璃：vi，卡林巴两路相向，比 15 秒版急
    ...s('pad', 1.5, [[0, -3, 1, 0.65], [0, 4, 1, 0.45], [0, 12, 1, 0.3]], { ...PAD, a: 0.2 }),
    ...s('pluck', 1.5, [[0, 16, 1, 0.3], [0.25, -1, 1, 0.3], [0.5, 14, 1, 0.32], [0.75, 2, 1, 0.32]], KAL),
    // 2.25 相融：低音主音、玻璃钟五度，铺底 Imaj7
    ...s('pluck', 2.25, [[0, -12, 2, 0.5], [0, 7, 2, 0.35]], LOW),
    ...s('bell', 2.25, [[0, 7, 1.5, 0.5], [0, 19, 1, 0.22]], c.glass),
    ...s('pad', 2.25, [[0, -12, 1, 0.75], [0, -5, 1, 0.55], [0, 4, 1, 0.35], [0, 11, 1, 0.25]], { ...PAD, a: 0.1 }),
    // 3.0 片尾：品牌动机（共用），Imaj9 收住
    ...s('pad', 3, [[0, -12, 4, 0.8], [0, -5, 4, 0.6], [0, 4, 4, 0.35], [0, 11, 4, 0.22], [0, 14, 4, 0.18]], { ...PAD, a: 0.4, r: 0.8 }),
    ...s('pluck', 3, [[0, -24, 5, 0.5], [0, -12, 5, 0.3]], LOW),
  ];
}

// ── 共用 ──
/** 品牌动机：拨弦 + 高八度的玻璃钟，走 sfx 母线（配音压低的是 music 母线，片尾的配音盖不住它） */
export function logo(tonic, t, glass) {
  const rows = LOGO.map((k, i) => [i * 0.5, k, i === LOGO.length - 1 ? 4 : 1.5, i === LOGO.length - 1 ? 0.8 : 0.65]), s = voices(tonic);
  return [...s('pluck', t, rows, { t60: 2.5, bright: 0.45 }, 'sfx'), ...s('bell', t, rows.map(([b, k, d, v]) => [b, k + 12, d, v * 0.5]), glass, 'sfx')];
}

/** 画面上的声音：小组件落位的水滴、分钟翻页的咔哒、两滴相融、玻璃幕扫过、转场、整段的空气声；时刻都从剪辑表算 */
export function sfx(built, T, bed) {
  const out = [], at = (e, lt) => e.start + lt - e.from, add = (t, voice, f, d, v, p = {}, pan = 0) => out.push({ t, voice, f, d, v, pan, bus: 'sfx', p });
  const inside = (e, lt) => lt >= e.from - 1e-9 && lt < e.dur - 1e-9;
  const { f, v, ...p } = bed;
  add(0, 'noise', f, built.duration, v, p);
  const wall = shotAt(built, 'wall');
  if (wall) EV.pops.forEach((lt, i) => {                                         // 小组件落位：一声向上滑的水滴，一块比一块高
    if (inside(wall, lt)) add(at(wall, lt), 'plink', mtof(T + 12 + [0, 4, 7][i]), 0.3, 0.45, { up: 1.5 }, [-0.3, 0.3, 0][i]);
  });
  const lens = shotAt(built, 'lens');
  if (lens && inside(lens, EV.tick)) add(at(lens, EV.tick), 'click', 2800, 0.05, 0.35, {}, 0.15);   // 分钟翻页
  const flow = shotAt(built, 'flow');
  if (flow && inside(flow, EV.merge)) {                                          // 两滴相融：一声低一些、滑得更多的水滴，两下晃动的回声
    const t = at(flow, EV.merge);
    add(t, 'plink', mtof(T + 7), 0.5, 0.55, { up: 1.8 });
    [[0.16, 1.26, 0.3, -0.25], [0.34, 1.12, 0.18, 0.25]].forEach(([dt, k, vv, pan]) => add(t + dt, 'plink', mtof(T + 7) * k, 0.3, vv, { up: 1.4 }, pan));
  }
  const sweep = shotAt(built, 'sweep');
  if (sweep) {                                                                   // 玻璃幕从上往下扫：一口气流，峰值正好在前沿过中线的那一拍，频率往下走
    const t0 = SWEEP.t[0], r = SWEEP.t[1] - EV.sweep;
    add(at(sweep, t0), 'noise', 3200, SWEEP.t[1] - t0, 0.55, { type: 'bandpass', q: 0.7, sweep: 0.3, a: EV.sweep - t0, r });
  }
  built.entries.forEach((e, i) => {                                              // 每个叠化一声气流，峰值在转场中点
    if (e.transition.type === 'cut') return;
    const mid = e.start + e.transition.dur / 2;
    add(mid - 0.4, 'noise', 450, 0.65, 0.4, { type: 'bandpass', q: 0.8, sweep: 5, a: 0.4, r: 0.25 }, i % 2 ? 0.25 : -0.25);
  });
  return out;
}

export function score(v, built) {
  const c = THEMES[v.theme], arrange = { 15: m15, 6: m6 }[v.cut];
  if (!c) throw new Error(`score: no theme ${v.theme}`);
  if (!arrange) throw new Error(`score: no arrangement for the ${v.cut} s cut`);
  const notes = [...arrange(c.tonic, c), ...logo(c.tonic, built.hits.logo, c.glass), ...sfx(built, c.tonic, c.bed)].sort((a, b) => a.t - b.t);
  return { notes, reverb: c.reverb };
}
