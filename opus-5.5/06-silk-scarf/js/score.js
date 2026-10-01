// score.js — 配乐与音效（纯数据，浏览器与 Node 测试共用）：score(v, built) → { notes, reverb }，由 factory/engine/audio.js 合成
// 80 bpm，一小节 3 秒（四拍，一拍 0.75 秒）。四款各一套编配：
//   dunhuang 琵琶（亮的拨弦轮指）+ 手鼓（低的滤波噪声），D 羽调（五声）
//   songjin  古琴（低、长余音的拨弦）+ 箫（气声长笛），无鼓，G 宫调
//   qinghua  钢片琴（钟）+ 弦乐铺底（慢起的 pad），E 大调五声
//   yunhe    合成器铺底（带气声）+ 笙（几支长笛叠成和音），B♭ 大调
// 每个命中点：一声风的呼声（滤波噪声扫上去）+ 一个乐音；片尾 logo 三音动机四款共用
import { mtof } from '../../factory/engine/audio.js';
import { shotAt } from '../../factory/engine/timeline.js';
import { BAR } from '../meta.js';

const BEAT = BAR / 4, STEP = BEAT / 4;
const PENTA = [0, 2, 4, 7, 9];
export const ARR = {
  dunhuang: { key: 62, scale: [0, 3, 5, 7, 10], chords: [[0, [0, 7, 10, 15]], [-2, [0, 7, 12, 14]], [3, [0, 4, 7, 12]], [-5, [0, 7, 10, 12]]], reverb: { decay: 2.6, music: 0.4, sfx: 0.2 } },
  songjin: { key: 55, scale: PENTA, chords: [[0, [0, 7, 12, 16]], [-3, [0, 7, 12, 15]], [5, [0, 7, 12, 14]], [-5, [0, 7, 12, 16]]], reverb: { decay: 3.4, music: 0.5, sfx: 0.25 } },
  qinghua: { key: 64, scale: PENTA, chords: [[0, [0, 4, 7, 11]], [-3, [0, 3, 7, 10]], [5, [0, 4, 7, 14]], [-5, [0, 4, 7, 10]]], reverb: { decay: 3.0, music: 0.45, sfx: 0.22 } },
  yunhe: { key: 58, scale: PENTA, chords: [[0, [4, 7, 11, 14]], [5, [4, 7, 11, 14]], [-3, [3, 7, 10, 14]], [2, [4, 7, 11, 14]]], reverb: { decay: 4.2, music: 0.55, sfx: 0.3 } },
};
// 旋律：每小节 [十六分位置, 音阶级数, 拍数]
const MEL = {
  dunhuang: [[[0, 4, 0.5], [2, 5, 0.5], [4, 7, 1], [10, 6, 0.5], [12, 5, 1]], [[0, 4, 1.5], [8, 3, 0.5], [10, 2, 1.5]], [[0, 5, 0.5], [2, 7, 0.5], [4, 8, 1.5], [12, 7, 1]], [[0, 6, 1], [4, 5, 0.5], [8, 4, 2]]],
  songjin: [[[0, 5, 2], [8, 6, 1.5]], [[0, 7, 2.5]], [[0, 6, 1], [6, 5, 1], [10, 4, 1.5]], [[0, 5, 3]]],
  qinghua: [[[0, 7, 0.5], [2, 9, 0.5], [4, 8, 1], [8, 7, 0.5], [12, 5, 1]], [[0, 6, 1], [4, 7, 1], [8, 9, 1.5]], [[0, 8, 0.5], [4, 7, 0.5], [6, 6, 1], [10, 5, 1.5]], [[0, 7, 2.5]]],
  yunhe: [[[0, 7, 3]], [[4, 9, 2]], [[0, 8, 2.5]], [[8, 7, 2]]],
};
const degOf = (A, g) => A.key + 12 * Math.floor(g / A.scale.length) + A.scale[((g % A.scale.length) + A.scale.length) % A.scale.length];
const PRODUCT_HITS = new Set(['land', 'fold', 'lid', 'settle', 'align']);   // 产品落定的那几拍：低音 + 和音，更重一点

export function score(v, built) {
  const style = ARR[v.scarf] ? v.scarf : 'dunhuang', A = ARR[style], H = built.hits, dur = built.duration, notes = [];
  const n = (t, voice, m, d, vol, p = {}, bus = 'music', pan = 0) => {
    if (t < 0 || t >= dur - 0.05) return;
    notes.push({ t, voice, f: mtof(m), d: Math.min(d, dur - t), v: vol, p, bus, pan });
  };
  const endShot = shotAt(built, 'end'), tail = endShot ? endShot.start : dur, K = A.key;
  const bars = Math.ceil(dur / BAR - 1e-9);
  for (let b = 0; b < bars; b++) {
    const t0 = b * BAR, [ro, chord] = A.chords[b % 4], root = K - 24 + ro, live = t => t < tail, first = b === 0, mel = MEL[style][b % 4];
    if (style === 'dunhuang') {
      for (const m of chord) n(t0, 'pad', K - 12 + ro + m, Math.min(BAR + 0.4, dur - t0), 0.08, { a: 0.6, r: 1, cut: 1.8 });
      n(t0, 'pluck', root, 2.2, 0.5, { t60: 2, bright: 0.2 });
      if (!first) for (let q = 0; q < 4; q++) { const t = t0 + q * BEAT; if (!live(t)) break; n(t, 'noise', q % 2 ? 62 : 50, 0.18, q % 2 ? 0.2 : 0.32, { type: 'lowpass', q: 1.4, a: 0.003, r: 0.15 }, 'music', q % 2 ? 0.2 : -0.1); }   // 手鼓
      for (const [k, g, d] of mel) { const t = t0 + k * STEP; if (!live(t)) continue; for (let r = 0; r < 3; r++) n(t + r * 0.045, 'pluck', degOf(A, g), d * BEAT, 0.3 - r * 0.07, { t60: 1.1, bright: 0.85 }, 'music', 0.15); }   // 琵琶轮指
    } else if (style === 'songjin') {
      n(t0, 'pluck', root + 12, 3.2, 0.52, { t60: 3.4, bright: 0.2 });
      if (live(t0 + 2 * BEAT)) n(t0 + 2 * BEAT, 'pluck', root + 19, 2.2, 0.3, { t60: 3, bright: 0.25 }, 'music', -0.2);
      for (const [k, g, d] of mel) { const t = t0 + k * STEP; if (live(t) && !first) n(t, 'flute', degOf(A, g), d * BEAT, 0.5, { a: 0.12, r: 0.4, breath: 0.45 }); }   // 箫
    } else if (style === 'qinghua') {
      for (const m of chord) n(t0, 'pad', K - 12 + ro + m, Math.min(BAR + 0.8, dur - t0), 0.14, { a: 1.1, r: 1.4, cut: 2.4 });   // 弦乐铺底
      n(t0, 'pluck', root + 12, 1.6, 0.36, { t60: 1.4, bright: 0.3 });
      for (const [k, g, d] of mel) { const t = t0 + k * STEP; if (live(t)) n(t, 'bell', degOf(A, g), d * BEAT + 0.6, 0.3, { bright: 0.7 }, 'music', ((k % 8) - 4) / 10); }   // 钢片琴
    } else {
      for (const m of chord) n(t0, 'pad', K - 12 + ro + m, Math.min(BAR + 1.4, dur - t0), 0.2, { a: 1.5, r: 2, cut: 2.6, air: 0.35 });
      if (live(t0 + BEAT)) for (const m of chord.slice(1)) n(t0 + BEAT, 'flute', K + ro + m, BAR * 0.7, 0.12, { a: 0.6, r: 0.8, breath: 0.6 }, 'music', (m - 9) / 20);   // 笙：几支一起吹的和音
      for (const [k, g, d] of mel) { const t = t0 + k * STEP; if (live(t) && !first) n(t, 'bell', degOf(A, g), d * BEAT + 1.2, 0.24, { bright: 0.35, ratios: [1, 2, 3.01, 4.2] }); }
    }
  }
  // 命中点：风声 + 乐音；产品落定的几拍加低音
  for (const [name, t] of Object.entries(H)) {
    if (name === 'logo') continue;
    n(t - BEAT, 'noise', 70, BEAT + 0.3, 0.22, { type: 'bandpass', q: 0.9, sweep: 3, a: BEAT * 0.8, r: 0.3 }, 'sfx', -0.2);
    n(t, style === 'songjin' ? 'pluck' : 'bell', degOf(A, A.scale.length * 2), 1.4, 0.32, style === 'songjin' ? { t60: 2.6, bright: 0.6 } : { bright: 0.5 });
    if (PRODUCT_HITS.has(name)) n(t, 'pluck', K - 24 + A.chords[Math.floor(t / BAR) % 4][0], 1.6, 0.55, { t60: 1.8, bright: 0.15 });
  }
  if (H.logo != null) [0, 7, 12].forEach((d, i) => n(H.logo + i * BEAT * 0.5, 'bell', K + 12 + d, i === 2 ? 2.2 : 0.9, 0.44, { bright: 0.6 }));
  if (endShot) n(endShot.start, 'pluck', K - 12, dur - endShot.start, 0.34, { t60: 3, bright: 0.25 });
  notes.sort((a, b) => a.t - b.t || a.f - b.f);
  return { notes, reverb: A.reverb };
}
