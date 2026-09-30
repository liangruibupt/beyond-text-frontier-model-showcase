// score.js — 配乐与音效（纯数据，浏览器与 Node 测试共用）：score(v, built) → { notes, reverb }，由 factory/engine/audio.js 合成
// 80 bpm，一拍 0.75 秒、一小节 3 秒（剪辑表、命中点四款共用）；每款口味一套自己的编曲（styles.js 的风格）：
//   brownsugar  lo-fi 爵士：Fmaj7–Dm7–Gm7–C7（ii–V 味），拨弦钢琴的七和弦分解、行走低音、摇摆的刷子（后半拍晚一点）
//   jasmine     清晨茶席：D 宫五声，古筝（拨弦、亮、长余音）的扫弦和轮指，长笛吹长音，没有鼓，只在拍头轻一声木鱼
//   strawberry  泡泡糖流行：C 大调 I–V–vi–IV，八分音符的低音跳、每拍的拍手、十六分的钢片琴琶音（双倍的密度）
//   taro        梦幻合成：A♭ 大调 Imaj9–IVmaj9 两个和弦来回，宽铺底长起音，钢片琴稀疏的高音，没有鼓，一口带气声的长音像雾
// 乐音都落在十六分音符网格上（lo-fi 的摇摆除外：它按三连音的后一个点，测试单独检查）；每个 hit 上都有一个乐音起音；
// 跟镜头走的音效（珍珠的水滴、奶的呼声、冰块碰撞、刺破）四款共用，放 sfx 总线
import { BAR } from '../meta.js';
import { releaseAt } from './pearls.js';
import { mtof } from '../../factory/engine/audio.js';
import { shotAt } from '../../factory/engine/timeline.js';

export const BEAT = BAR / 4, STEP = BEAT / 4, SWING = BEAT / 3;

// 每种风格：key（主音 MIDI）、每小节的和弦（根音 + 铺底音，相对主音的半音）、音阶（旋律用）、logo 动机（相对主音）
export const ARR = {
  brownsugar: { key: 65, chords: [[0, [4, 7, 11, 14]], [-3, [0, 3, 7, 10]], [2, [3, 7, 10, 14]], [-5, [4, 7, 10, 14]]], scale: [0, 2, 3, 5, 7, 9, 10], logo: [0, 4, 11], reverb: { decay: 1.8, music: 0.3, sfx: 0.15 } },
  jasmine: { key: 62, chords: [[0, [0, 7, 12, 16]], [-5, [0, 7, 12, 14]], [-3, [0, 7, 12, 15]], [2, [0, 5, 12, 14]]], scale: [0, 2, 4, 7, 9], logo: [0, 7, 12], reverb: { decay: 3.2, music: 0.45, sfx: 0.25 } },
  strawberry: { key: 60, chords: [[0, [0, 4, 7, 12]], [7, [-5, 0, 4, 7]], [9, [-3, 0, 4, 7]], [5, [0, 4, 9, 12]]], scale: [0, 2, 4, 5, 7, 9, 11], logo: [0, 4, 7], reverb: { decay: 1.4, music: 0.2, sfx: 0.12 } },
  taro: { key: 68, chords: [[0, [4, 7, 11, 14]], [0, [4, 7, 11, 14]], [5, [4, 7, 11, 14]], [5, [4, 7, 11, 14]]], scale: [0, 2, 4, 7, 9, 11], logo: [0, 7, 14], reverb: { decay: 4.0, music: 0.55, sfx: 0.3 } },
};
export const STYLE_IDS = Object.keys(ARR);
/** 音阶的第 k 级（可以是负数）：主音 + 八度 */
export const degOf = (A, k) => A.key + 12 * Math.floor(k / A.scale.length) + A.scale[((k % A.scale.length) + A.scale.length) % A.scale.length];

// ── 各风格每小节的旋律（十六分位置, 音阶级数, 时值拍） ──
const MEL = {
  brownsugar: [[[2, 4, 0.5], [6, 6, 0.4], [10, 5, 0.9]], [[0, 3, 0.5], [3, 5, 0.3], [8, 7, 1.2]], [[2, 6, 0.4], [6, 5, 0.4], [9, 4, 0.9]], [[0, 2, 0.5], [4, 4, 0.5], [12, 3, 1]]],
  jasmine: [[[0, 5, 1.5], [8, 7, 1.2]], [[0, 6, 2.5]], [[0, 4, 1], [4, 5, 1], [8, 6, 1.5]], [[0, 7, 1], [6, 5, 2]]],
  strawberry: [[[0, 7, 0.4], [2, 9, 0.4], [4, 11, 0.4], [6, 9, 0.4], [8, 7, 0.8], [12, 4, 0.8]], [[0, 6, 0.4], [2, 8, 0.4], [4, 10, 0.8], [8, 8, 0.4], [10, 6, 0.4], [12, 5, 0.8]],
    [[0, 5, 0.4], [2, 7, 0.4], [4, 9, 0.8], [8, 7, 0.4], [10, 9, 0.4], [12, 11, 0.8]], [[0, 8, 0.4], [4, 7, 0.4], [6, 6, 0.4], [8, 5, 1.2], [14, 7, 0.4]]],
  taro: [[[0, 9, 2.5]], [[8, 11, 1.8]], [[0, 10, 2.5]], [[4, 8, 1.5], [12, 7, 1]]],
};

export function score(v, built) {
  const A = ARR[v.flavor] ?? ARR.brownsugar, style = ARR[v.flavor] ? v.flavor : 'brownsugar';
  const H = built.hits, dur = built.duration, notes = [];
  const n = (t, voice, m, d, vol, p = {}, bus = 'music', pan = 0) => {
    if (t < 0 || t >= dur - 0.05) return;
    notes.push({ t, voice, f: mtof(m), d: Math.min(d, dur - t), v: vol, p, bus, pan });
  };
  const endShot = shotAt(built, 'end'), tail = endShot ? endShot.start : dur;       // 片尾：旋律和打击收掉，只留铺底和 logo
  const bars = Math.ceil(dur / BAR - 1e-9), K = A.key;
  for (let b = 0; b < bars; b++) {
    const t0 = b * BAR, [rootOff, padOff] = A.chords[b % 4], root = K - 24 + rootOff, live = t => t < tail;
    const mel = MEL[style][b % 4], first = b === 0;
    if (style === 'brownsugar') {
      for (const m of padOff) n(t0, 'pad', K - 12 + rootOff + m, Math.min(BAR + 0.3, dur - t0), 0.12, { a: 0.4, r: 0.7, cut: 1.6 });
      // 钢琴：拍 1 和拍 3 的后半拍（摇摆）扫一下七和弦
      for (const [beat, swing] of [[0, false], [1, true], [2.5, false]]) {
        const t = t0 + beat * BEAT + (swing ? 2 * SWING - BEAT / 2 : 0); if (!live(t) && beat) continue;
        padOff.forEach((m, i) => n(t + i * 0.012 * 0, 'pluck', K - 12 + rootOff + m, 1.0, 0.24, { t60: 1.0, bright: 0.25 }, 'music', (i - 1.5) * 0.15));
      }
      // 行走低音：每拍一个音（根、三、五、经过音）
      [0, 4, 7, rootOff > 0 ? -1 : 1].forEach((d, i) => { const t = t0 + i * BEAT; if (live(t) || !i) n(t, 'pluck', root + d, 0.7, 0.55, { t60: 0.9, bright: 0.15 }); });
      // 刷子：每拍的第 1、三连音第 3 个点
      if (!first) for (let q = 0; q < 4; q++) for (const off of [0, 2 * SWING]) { const t = t0 + q * BEAT + off; if (live(t)) n(t, 'noise', 88, 0.1, off ? 0.12 : 0.18, { type: 'highpass', q: 0.6, a: 0.004, r: 0.08 }, 'music', off ? 0.3 : -0.2); }
      if (!first) for (const [k, g, d] of mel) { const t = t0 + k * STEP; if (live(t)) n(t, 'pluck', degOf(A, g), d * BEAT, 0.3, { t60: 1.3, bright: 0.4 }); }
    } else if (style === 'jasmine') {
      for (const m of padOff) n(t0, 'flute', K - 12 + rootOff + m, Math.min(BAR, dur - t0), 0.05, { a: 0.8, r: 1, breath: 0.25 });
      // 古筝：拍头从低往高扫五个音（刮奏），第 3 拍一个低音
      if (live(t0) || first) padOff.concat([padOff[3] + 5]).forEach((m, i) => n(t0 + i * STEP * 0.25 * 0, 'pluck', K - 12 + rootOff + m, 2.4, 0.3 - i * 0.03, { t60: 2.6, bright: 0.75 }, 'music', -0.4 + i * 0.2));
      if (live(t0 + 2 * BEAT)) n(t0 + 2 * BEAT, 'pluck', root + 12, 2, 0.38, { t60: 2.4, bright: 0.5 });
      if (!first) for (const [k, g, d] of mel) { const t = t0 + k * STEP; if (live(t)) n(t, 'flute', degOf(A, g), d * BEAT, 0.55, { a: 0.09, r: 0.3, breath: 0.35 }); }
      if (!first && live(t0)) n(t0, 'bell', K + 12, 0.12, 0.2, { ratios: [1, 2.3, 4.1], bright: 0.3 }, 'music', 0.3);   // 木鱼似的轻一声
    } else if (style === 'strawberry') {
      for (const m of padOff) n(t0, 'pad', K + rootOff + m - 12, Math.min(BAR, dur - t0), 0.1, { a: 0.05, r: 0.3, cut: 3.5 });
      for (let e = 0; e < 8; e++) { const t = t0 + e * STEP * 2; if (live(t) || !e) n(t, 'pluck', root + 12 + (e % 2 ? 12 : 0), 0.3, 0.5, { t60: 0.4, bright: 0.35 }); }   // 八分跳八度的低音
      if (!first) for (let q = 0; q < 4; q++) {
        const t = t0 + q * BEAT; if (!live(t)) break;
        n(t, 'click', q % 2 ? 90 : 70, 0.04, q % 2 ? 0.5 : 0.42, {}, 'music', 0);                                       // 拍 1、3 低 / 2、4 高（拍手）
        if (q % 2) n(t, 'noise', 80, 0.12, 0.3, { type: 'bandpass', q: 1.2, a: 0.002, r: 0.1 }, 'music', 0.1);
        for (let s = 0; s < 4; s++) n(t + s * STEP, 'bell', K + 12 + padOff[s % 4] + rootOff, 0.25, 0.16, { bright: 0.9 }, 'music', s % 2 ? 0.35 : -0.35);   // 十六分钢片琴
      }
      for (const [k, g, d] of mel) { const t = t0 + k * STEP; if (live(t) && !(first && k < 8)) n(t, 'pluck', degOf(A, g), d * BEAT, 0.34, { t60: 0.7, bright: 0.8 }); }
    } else {
      for (const m of padOff) n(t0, 'pad', K - 12 + rootOff + m, Math.min(BAR + 1.2, dur - t0), 0.22, { a: 1.4, r: 1.8, cut: 2.8, air: 0.3 });
      n(t0, 'pad', root + 12, Math.min(BAR + 1, dur - t0), 0.2, { a: 1, r: 1.5, cut: 1.5 });
      for (const [k, g, d] of mel) { const t = t0 + k * STEP; if (live(t) || first) n(t, 'bell', degOf(A, g), d * BEAT + 1, 0.32, { bright: 0.4, ratios: [1, 2, 3.01, 4.2] }, 'music', ((k % 8) - 4) / 8); }
      if (live(t0 + 2 * BEAT)) n(t0 + 2 * BEAT, 'flute', K + 12 + padOff[1] + rootOff, BAR * 0.6, 0.18, { a: 0.9, r: 0.8, breath: 0.9 }, 'music', 0);   // 一口带气声的长音，像雾
    }
  }
  // ── 跟镜头事件走的音效（四款共用）+ 命中点上的一个乐音 ──
  const hitNote = (t, g, d = 1.2, vol = 0.34) => n(t, style === 'jasmine' ? 'pluck' : 'bell', degOf(A, g), d, vol, style === 'jasmine' ? { t60: 2, bright: 0.8 } : { bright: 0.55 });
  const pe = built.entries.find(e => e.shot === 'pearls');
  if (pe) for (let i = 0; i < 60; i += 3) {
    const t = pe.start + releaseAt(i) + 0.19 - pe.from;
    if (t >= pe.start && t < pe.end) n(t, 'plink', K + 12 + ((i * 5) % 12), 0.12, 0.22, { up: 1.3 }, 'sfx', ((i % 7) - 3) / 6);
  }
  if (H.land != null) hitNote(H.land, A.scale.length);
  if (H.bloom != null) { n(H.bloom - BEAT, 'noise', 72, 0.9, 0.3, { type: 'bandpass', q: 1.2, sweep: 4, a: 0.6, r: 0.2 }, 'sfx'); hitNote(H.bloom, A.scale.length + 2, 1.8, 0.36); }
  if (H.clink != null) { n(H.clink, 'bell', 91, 0.9, 0.42, { ratios: [1, 2.76, 5.4, 8.93], bright: 0.9 }, 'sfx', 0.2); n(H.clink, 'click', 84, 0.05, 0.45, {}, 'sfx', 0.2); hitNote(H.clink, A.scale.length + 4, 1, 0.28); }
  if (H.hero != null) n(H.hero, 'pad', degOf(A, 2 * A.scale.length), 2.6, 0.16, { a: 0.4, r: 1.2, cut: 3, air: 0.2 });
  if (H.drip != null) { n(H.drip, 'plink', K + 19, 0.2, 0.32, { up: 1.6 }, 'sfx', -0.2); hitNote(H.drip, A.scale.length + 3, 1, 0.24); }
  if (H.punch != null) {
    n(H.punch, 'click', 60, 0.06, 0.75, {}, 'sfx'); n(H.punch, 'noise', 60, 0.25, 0.38, { type: 'lowpass', q: 0.7, a: 0.005, r: 0.2 }, 'sfx');
    n(H.punch, 'pluck', K - 24 + A.chords[Math.floor(H.punch / BAR) % 4][0], 1.2, 0.6, { t60: 1.6, bright: 0.15 });
  }
  if (H.logo != null) A.logo.forEach((d, i) => n(H.logo + i * BEAT * 0.5, 'bell', K + 12 + d, i === 2 ? 2.2 : 0.9, 0.46, { bright: 0.6 }));
  if (endShot) n(endShot.start, 'pluck', K - 12, dur - endShot.start, 0.36, { t60: 3, bright: 0.25 });
  notes.sort((a, b) => a.t - b.t || (a.f - b.f));
  return { notes, reverb: A.reverb };
}
