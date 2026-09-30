// score.js — 配乐与音效（纯数据，浏览器与 Node 测试共用）：score(v, built) → { notes, reverb }，由 factory/engine/audio.js 合成
// 第一阶段只做一层铺底 + 命中点上的音效，让带配音的成片不是无声的；完整编曲是第二阶段的事
// 80 bpm，一拍 0.75 秒：音效的时刻从剪辑表的 hits 取（每个都在拍子上），珍珠的一串水滴按烘好的落底时刻排
import { BAR } from '../meta.js';
import { releaseAt } from './pearls.js';
import { mtof } from '../../factory/engine/audio.js';
import { shotAt } from '../../factory/engine/timeline.js';

export const BEAT = BAR / 4;
export const TONIC = 65;                                  // F4：F 大调，轻快
export const LOGO = [0, 4, 7];                            // 品牌动机：主和弦的 1、3、5，落在 hits.logo 的第 0、½、1 拍

export function score(v, built) {
  const H = built.hits, dur = built.duration, notes = [];
  const n = (t, voice, m, d, vol, p = {}, bus = 'music', pan = 0) => notes.push({ t, voice, f: mtof(m), d, v: vol, p, bus, pan });
  // 铺底：F、C、Dm、Bb 四个和弦，每小节换一个
  const CH = [[53, 60, 65, 69], [48, 55, 64, 67], [50, 57, 62, 65], [46, 53, 62, 65]];
  for (let b = 0; b * BAR < dur - 0.2; b++) for (const m of CH[b % 4]) n(b * BAR, 'pad', m, Math.min(BAR + 0.4, dur - b * BAR), 0.22, { a: 0.5, r: 0.8, cut: 2.2, air: 0.1 });
  // 珍珠：每颗落底一声 plink（15 秒版的 pearls 镜头里），越往后越密
  const pe = built.entries.find(e => e.shot === 'pearls');
  if (pe) for (let i = 0; i < 60; i += 3) { const t = pe.start + releaseAt(i) + 0.19 - pe.from; if (t < pe.end) n(t, 'plink', TONIC + 12 + ((i * 5) % 12), 0.12, 0.25, { up: 1.3 }, 'sfx', ((i % 7) - 3) / 6); }
  if (H.land != null) n(H.land, 'pluck', TONIC - 12, 1.6, 0.55, { t60: 2.2, bright: 0.3 });
  if (H.bloom != null) { n(H.bloom - 0.75, 'noise', 72, 0.9, 0.35, { type: 'bandpass', q: 1.2, sweep: 4, a: 0.6, r: 0.2 }, 'sfx'); n(H.bloom, 'bell', TONIC + 12, 1.8, 0.4, { bright: 0.5 }); }
  if (H.clink != null) { n(H.clink, 'bell', 91, 0.9, 0.45, { ratios: [1, 2.76, 5.4, 8.93], bright: 0.9 }, 'sfx', 0.2); n(H.clink, 'click', 84, 0.05, 0.5, {}, 'sfx', 0.2); }
  if (H.drip != null) n(H.drip, 'plink', TONIC + 19, 0.2, 0.35, { up: 1.6 }, 'sfx', -0.2);
  if (H.punch != null) { n(H.punch, 'click', 60, 0.06, 0.8, {}, 'sfx'); n(H.punch, 'noise', 60, 0.25, 0.4, { type: 'lowpass', q: 0.7, a: 0.005, r: 0.2 }, 'sfx'); }
  if (H.logo != null) LOGO.forEach((d, i) => n(H.logo + i * BEAT * 0.5, 'bell', TONIC + 12 + d, i === 2 ? 2.2 : 0.9, 0.5, { bright: 0.6 }));
  // 片尾的 end 镜头里铺底收掉
  const e = shotAt(built, 'end');
  if (e) n(e.start, 'pluck', TONIC - 12, dur - e.start, 0.4, { t60: 3, bright: 0.25 });
  return { notes, reverb: { decay: 2.4, music: 0.35, sfx: 0.2 } };
}
