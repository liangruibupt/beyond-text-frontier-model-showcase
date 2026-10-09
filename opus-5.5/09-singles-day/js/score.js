// score.js — 双11 大屏的配乐与音效（纯数据）：score(v, built) → { notes, reverb }，由 factory/engine/audio.js 合成
// 80 bpm，一拍 0.75s。零点氛围：低音脉冲渐强 → 归零 whoosh + 和弦铺底 → 主旋律铃 → 计数器滴答 → 里程碑重音 → 片尾三音动机
// 音符走 music / sfx 两条母线；sfx 不被配音压低。各 theme 的主音随配色微调，其余结构共用
import { mtof } from '../../factory/engine/audio.js';

// 每款主题的调性主音（MIDI）与铺底和弦（相对主音半音）
const KEY = { national: 57, megacity: 60, crossborder: 55, logistics: 53 };     // A3 / C4 / G3 / F3
const PAD_CHORD = [0, 7, 12, 16];                                                // 根-五-八-十度，开阔

export function score(v, built) {
  const H = built.hits, dur = built.duration, key = KEY[v.theme] ?? 57, notes = [];
  const n = (t, voice, f, d, vol, p = {}, bus = 'music', pan = 0) => {
    if (t < 0 || t >= dur - 0.03) return;
    notes.push({ t, voice, f, d: Math.min(d, dur - t), v: vol, p, bus, pan });
  };
  const deg = (semi) => mtof(key + semi);

  // 1 倒计时：低音脉冲每 0.75 一下，渐强到归零
  for (let k = 0; k < 3; k++) {
    const t = (H.tick ?? 0.75) * 0 + 0.75 * k;
    n(t, 'plink', mtof(key - 12), 0.3, 0.4 + 0.18 * k, { a: 0.005, r: 0.25 }, 'sfx');
  }
  // 2 归零点亮：whoosh（噪声）+ 和弦铺底进场
  n(H.zero ?? 2.25, 'noise', 2000, 0.9, 0.5, { a: 0.01, r: 0.7 }, 'sfx');
  for (const s of PAD_CHORD) n(H.ignite ?? 2.25, 'pad', deg(s), dur - (H.ignite ?? 2.25) - 0.2, 0.3, { a: 0.4, r: 1.2 });
  n(H.launch ?? 3.0, 'bell', deg(12), 1.2, 0.4, { bright: 0.6 }, 'sfx');

  // 3 弧线：主旋律铃，密度峰值落拍 + 一次仓库脉冲
  const mel = [0, 7, 12, 7, 9, 12];
  for (let i = 0; i < mel.length; i++) n((H.ignite ?? 2.25) + 3.0 + i * 0.5, 'bell', deg(mel[i]), 0.6, 0.3, { bright: 0.5 });
  n(H.peak ?? 6.0, 'bell', deg(19), 1.0, 0.5, { bright: 0.7 }, 'sfx');
  n(H.pulse ?? 7.5, 'plink', deg(12), 0.4, 0.35, {}, 'sfx');

  // 4 GMV：计数器滴答随加速升调（8.25 → 11.25）
  for (let k = 0; k < 10; k++) {
    const t = (H.gmv ?? 8.25) + k * 0.28;
    n(t, 'click', deg(12 + k), 0.1, 0.22, {}, 'sfx');
  }

  // 5 里程碑爆屏：一记重音
  n(H.burst ?? 11.25, 'noise', 1200, 0.5, 0.6, { a: 0.002, r: 0.4 }, 'sfx');
  n(H.burst ?? 11.25, 'pad', deg(0), 1.5, 0.45, { a: 0.02, r: 1.3 });

  // 6 片尾：三音品牌动机
  const motive = [0, 7, 12];
  for (let i = 0; i < motive.length; i++) n((H.logo ?? 12.0) + i * 0.3, 'bell', deg(motive[i]), 1.2, 0.4, { bright: 0.6 }, 'sfx');

  const reverb = { decay: 2.4, music: 0.35, sfx: 0.2 };
  return { notes, reverb };
}
