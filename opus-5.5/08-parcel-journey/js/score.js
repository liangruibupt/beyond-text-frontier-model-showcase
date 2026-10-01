// score.js — 配乐与音效（纯数据）：score(v, built) → { notes, reverb }，由 factory/engine/audio.js 合成
// 120 bpm，一拍 0.5 秒、一小节 2 秒；命中点都落在 0.5 秒网格上。安静的底 + 跟镜头事件走的音效 + 命中点上的乐音
// 一个品牌的物流片：冷调电子底噪（pad），主旋律在 truck 发车（9.5）进来；UI 咔哒、机器人马达脉冲、折纸板、分拣 tick、刹车脚步、敲门三音动机
import { mtof } from '../../factory/engine/audio.js';

export const BAR = 2.0, BEAT = 0.5, STEP = 0.25;
const KEY = 57;                                 // A（主音）
const SCALE = [0, 2, 3, 5, 7, 10];              // 小调五声 + 一个音
const deg = k => KEY + 12 * Math.floor(k / SCALE.length) + SCALE[((k % SCALE.length) + SCALE.length) % SCALE.length];
const LOGO = [0, 3, 7];                          // 片尾三音动机（相对主音）

export function score(v, built) {
  const H = built.hits, dur = built.duration, notes = [];
  const n = (t, voice, m, d, vol, p = {}, bus = 'music', pan = 0) => {
    if (t < 0 || t >= dur - 0.05) return;
    notes.push({ t, voice, f: mtof(m), d: Math.min(d, dur - t), v: vol, p, bus, pan });
  };
  // ── 安静的底：每小节一层 pad，主旋律进来之前压低 ──
  const bars = Math.ceil(dur / BAR - 1e-9);
  const mainIn = (H.depart ?? 9.5);              // 发车后主旋律进来（15 秒版）；6 秒版没有 depart，就一直是底
  for (let b = 0; b < bars; b++) {
    const t0 = b * BAR, warm = t0 >= mainIn - BAR;
    for (const m of [0, 7, 12]) n(t0, 'pad', KEY - 12 + m, Math.min(BAR + 0.4, dur - t0), warm ? 0.12 : 0.07, { a: 0.6, r: 0.8, cut: warm ? 2.2 : 1.4, air: 0.2 });
    // 低频马达脉冲（robots 段跟拍子）：在仓库那几拍，每拍一下
    if (t0 >= 1.5 && t0 < 5.0) for (let q = 0; q < 4; q++) { const t = t0 + q * BEAT; n(t, 'noise', 60, 0.2, 0.14, { type: 'lowpass', q: 0.7, a: 0.01, r: 0.15 }, 'music', 0); }
    // 主旋律：发车后每拍一个五声音，往上走
    if (t0 >= mainIn - 1e-9) for (let q = 0; q < 4; q += 2) { const t = t0 + q * BEAT; n(t, 'bell', deg(2 + q / 2 + (b % 2) * 3), BEAT * 1.5, 0.22, { bright: 0.5, ratios: [1, 2, 3.01] }, 'music', ((q % 4) - 2) / 4); }
  }

  // ── 跟镜头事件走的音效（sfx 总线，不被压低）+ 命中点上的一个乐音 ──
  const hit = (t, k, d = 1.0, vol = 0.3) => { if (t != null) n(t, 'bell', deg(k), d, vol, { bright: 0.55, ratios: [1, 2, 3.01] }, 'sfx', 0); };
  // 下单 tap：UI click + 上扬扫频
  if (H.tap != null) { n(H.tap, 'click', 92, 0.05, 0.5, {}, 'sfx', 0); n(H.tap, 'noise', 70, 0.5, 0.3, { type: 'bandpass', q: 1.2, sweep: 5, a: 0.01, r: 0.2 }, 'sfx', 0); hit(H.tap, 2, 0.8, 0.26); }
  // 取货 pick（4.0）
  if (H.pick != null) { n(H.pick, 'click', 78, 0.05, 0.4, {}, 'sfx', 0.1); hit(H.pick, 4, 1.0, 0.3); }
  // 贴面单 label（6.5）：盖章
  if (H.label != null) { n(H.label, 'click', 66, 0.08, 0.55, {}, 'sfx', -0.1); n(H.label, 'noise', 90, 0.12, 0.25, { type: 'highpass', q: 0.8, a: 0.002, r: 0.1 }, 'sfx', 0); hit(H.label, 5, 0.9, 0.26); }
  // 拨进道口 divert（8.0）：tick
  if (H.divert != null) { n(H.divert, 'click', 100, 0.04, 0.45, {}, 'sfx', 0.2); n(H.divert, 'bell', 95, 0.4, 0.3, { ratios: [1, 2.76, 5.4], bright: 0.9 }, 'sfx', 0.2); hit(H.divert, 6, 0.9, 0.28); }
  // 发车 depart（9.5）：引擎声由近及远
  if (H.depart != null) { n(H.depart, 'noise', 55, 1.6, 0.34, { type: 'lowpass', q: 0.9, a: 0.05, r: 1.2 }, 'sfx', 0); hit(H.depart, 7, 1.2, 0.32); }
  // 敲门 knock（13.0）：两声 click
  if (H.knock != null) { n(H.knock, 'click', 58, 0.06, 0.6, {}, 'sfx', 0); n(H.knock + 0.25, 'click', 58, 0.06, 0.6, {}, 'sfx', 0); }
  // 品牌动机 logo（13.5）：三音
  if (H.logo != null) LOGO.forEach((d, i) => n(H.logo + i * BEAT * 0.5, 'bell', KEY + 12 + d, i === 2 ? 1.6 : 0.7, 0.42, { bright: 0.6, ratios: [1, 2, 3] }, 'sfx', 0));

  notes.sort((a, b) => a.t - b.t || a.f - b.f);
  return { notes, reverb: { decay: 2.0, music: 0.3, sfx: 0.18 } };
}
