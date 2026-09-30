// score.js — 配乐与音效（纯数据，浏览器与 Node 测试共用）：score(v, built) → { notes, reverb }，由 factory/engine/audio.js 合成
// F 大调，80 bpm，一拍 0.75 秒、一小节 3 秒；和弦按成片的小节走 F · C · Dm · B♭（I–V–vi–IV），15 / 6 秒共用
// 四层：铺底（pad）、低音拨弦、卡林巴旋律（五声音阶、十六分音符网格）、轻打击（click / 噪声）；外加跟镜头事件走的音效
// 所有乐音都落在十六分音符网格上；珍珠的水滴跟着烘好的落底时刻走（音效，不算乐音）；每个 hit 上都有一个乐音起音
import { BAR } from '../meta.js';
import { releaseAt } from './pearls.js';
import { mtof } from '../../factory/engine/audio.js';
import { shotAt } from '../../factory/engine/timeline.js';

export const BEAT = BAR / 4, STEP = BEAT / 4;
export const TONIC = 65;                                  // F4
export const LOGO = [0, 4, 7];                            // 品牌动机：主和弦的 1、3、5，落在 hits.logo 的第 0、½、1 拍
// 每小节的和弦：根音（MIDI）+ 铺底的四个音
export const CHORDS = [
  { root: 41, pad: [53, 60, 65, 69] },                    // F
  { root: 36, pad: [48, 55, 64, 67] },                    // C
  { root: 38, pad: [50, 57, 62, 65] },                    // Dm
  { root: 34, pad: [46, 53, 62, 65] },                    // B♭
];
const PENTA = [0, 2, 4, 7, 9];                            // F 大调五声：F G A C D
const deg = k => TONIC + 12 * Math.floor(k / 5) + PENTA[((k % 5) + 5) % 5];
// 卡林巴的一小节乐句（十六分音符位置, 五声级数），按和弦换一套；每句最后一个音留给下一小节
const PHRASE = [
  [[0, 5], [3, 7], [6, 6], [8, 5], [10, 7], [12, 8]],
  [[0, 4], [3, 6], [6, 5], [8, 4], [11, 6], [14, 7]],
  [[0, 3], [3, 5], [6, 4], [8, 3], [10, 5], [12, 4]],
  [[0, 3], [2, 4], [4, 5], [8, 6], [11, 7], [13, 5]],
];

export function score(v, built) {
  const H = built.hits, dur = built.duration, notes = [];
  const n = (t, voice, m, d, vol, p = {}, bus = 'music', pan = 0) => {
    if (t < 0 || t >= dur - 0.05) return;
    notes.push({ t, voice, f: mtof(m), d: Math.min(d, dur - t), v: vol, p, bus, pan });
  };
  const endShot = shotAt(built, 'end'), tail = endShot ? endShot.start : dur;       // 片尾：旋律和打击收掉，只留铺底和 logo
  const bars = Math.ceil(dur / BAR - 1e-9);
  for (let b = 0; b < bars; b++) {
    const t0 = b * BAR, C = CHORDS[b % 4];
    for (const m of C.pad) n(t0, 'pad', m, Math.min(BAR + 0.4, dur - t0), 0.2, { a: b ? 0.3 : 0.6, r: 0.9, cut: 2.4, air: 0.08 });
    // 低音：第 1、3 拍根音，第 4 拍后半拍五度（片尾只留第 1 拍）
    for (const [beat, m, d] of [[0, C.root, 1.4], [2, C.root, 1.0], [3.5, C.root + 7, 0.4]]) {
      const t = t0 + beat * BEAT; if (t < tail || beat === 0) n(t, 'pluck', m, d, 0.5, { t60: 1.4, bright: 0.2 });
    }
    // 卡林巴旋律：第一小节只进一半（开场留给珍珠的水滴），片尾不进
    PHRASE[b % 4].forEach(([k, g], i) => {
      const t = t0 + k * STEP;
      if (t >= tail || (b === 0 && k < 8)) return;
      n(t, 'pluck', deg(g), 0.9, 0.34, { t60: 1.1, bright: 0.65 }, 'music', ((i % 3) - 1) * 0.25);
    });
    // 轻打击：每拍一个 click（高），第 2、4 拍加一点刷子；从第二小节开始，片尾不进
    if (b >= 1) for (let s = 0; s < 16; s += 2) {
      const t = t0 + s * STEP; if (t >= tail) break;
      n(t, 'click', s % 4 === 0 ? 88 : 96, 0.03, s % 4 === 0 ? 0.28 : 0.14, {}, 'music', s % 8 < 4 ? -0.3 : 0.3);
      if (s === 4 || s === 12) n(t, 'noise', 84, 0.12, 0.16, { type: 'highpass', q: 0.7, a: 0.003, r: 0.1 }, 'music', 0.1);
    }
  }
  // ── 跟镜头事件走的音效 ──
  const pe = built.entries.find(e => e.shot === 'pearls');
  if (pe) for (let i = 0; i < 60; i += 3) {
    const t = pe.start + releaseAt(i) + 0.19 - pe.from;
    if (t >= pe.start && t < pe.end) n(t, 'plink', TONIC + 12 + ((i * 5) % 12), 0.12, 0.22, { up: 1.3 }, 'sfx', ((i % 7) - 3) / 6);
  }
  if (H.land != null) n(H.land, 'bell', deg(5), 1.4, 0.35, { bright: 0.4 });                       // 珍珠落底：一声亮的主音
  if (H.bloom != null) {
    n(H.bloom - BEAT, 'noise', 72, 0.9, 0.3, { type: 'bandpass', q: 1.2, sweep: 4, a: 0.6, r: 0.2 }, 'sfx');   // 奶冲下去的呼声
    n(H.bloom, 'bell', deg(7), 1.8, 0.38, { bright: 0.5 });
  }
  if (H.clink != null) { n(H.clink, 'bell', 91, 0.9, 0.42, { ratios: [1, 2.76, 5.4, 8.93], bright: 0.9 }, 'sfx', 0.2); n(H.clink, 'click', 84, 0.05, 0.45, {}, 'sfx', 0.2); n(H.clink, 'bell', deg(8), 1.2, 0.3, { bright: 0.7 }); }
  if (H.hero != null) n(H.hero, 'pad', deg(10), 2.6, 0.18, { a: 0.4, r: 1.2, cut: 3, air: 0.2 });   // hero：高八度的一层亮铺底
  if (H.drip != null) { n(H.drip, 'plink', TONIC + 19, 0.2, 0.32, { up: 1.6 }, 'sfx', -0.2); n(H.drip, 'bell', deg(9), 1.0, 0.25, { bright: 0.6 }, 'music', -0.2); }
  if (H.punch != null) {
    n(H.punch, 'click', 60, 0.06, 0.75, {}, 'sfx'); n(H.punch, 'noise', 60, 0.25, 0.38, { type: 'lowpass', q: 0.7, a: 0.005, r: 0.2 }, 'sfx');
    n(H.punch, 'pluck', CHORDS[Math.floor(H.punch / BAR) % 4].root - 12, 1.2, 0.6, { t60: 1.6, bright: 0.15 });   // 刺破：低音重拍
  }
  if (H.logo != null) LOGO.forEach((d, i) => n(H.logo + i * BEAT * 0.5, 'bell', TONIC + 12 + d, i === 2 ? 2.2 : 0.9, 0.48, { bright: 0.6 }));
  if (endShot) n(endShot.start, 'pluck', TONIC - 12, dur - endShot.start, 0.36, { t60: 3, bright: 0.25 });
  notes.sort((a, b) => a.t - b.t || (a.f - b.f));
  return { notes, reverb: { decay: 2.4, music: 0.35, sfx: 0.2 } };
}
