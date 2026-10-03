// stories/headset/score.js — 电竞耳机「赛前送达」的配乐（128 bpm，夜城快切 · 卡点）：合成 pluck 的 off-beat 分解和弦 +
// 低频脉冲底 + 跟镜头事件走的音效（断音、下单 UI、料箱提升、路线连通、溅水、电梯叮、戴上）；片尾用有集的三音动机收尾（和另两条线相同）。
import { mtof } from '../../../factory/engine/audio.js';

const BEAT = 60 / 128, BAR = 4 * BEAT;
const KEY = 57;                                  // A（主音），和包裹旅程同调
const SCALE = [0, 2, 3, 5, 7, 10];               // A 小调五声 + 一个音
const deg = k => KEY + 12 * Math.floor(k / SCALE.length) + SCALE[((k % SCALE.length) + SCALE.length) % SCALE.length];
const LOGO = [0, 3, 7];                           // 片尾三音动机（相对主音）

export function score(v, built) {
  const H = built.hits, dur = built.duration, notes = [];
  const n = (t, voice, m, d, vol, p = {}, bus = 'music', pan = 0) => { if (t < 0 || t >= dur - 0.05) return; notes.push({ t, voice, f: mtof(m), d: Math.min(d, dur - t), v: vol, p, bus, pan }); };
  // ── 底：每小节一层 pad + 四分脉冲（夜城的心跳），下单（order）之后节拍更密 ──
  const bars = Math.ceil(dur / BAR - 1e-9);
  const driveIn = (H.order ?? 2.5);
  for (let b = 0; b < bars; b++) {
    const t0 = b * BAR, hot = t0 >= driveIn - BAR;
    for (const m of [0, 7, 10]) n(t0, 'pad', KEY - 12 + m, Math.min(BAR + 0.3, dur - t0), hot ? 0.11 : 0.07, { a: 0.4, r: 0.7, cut: hot ? 2.4 : 1.6, air: 0.2 });
    // 低频脉冲：每拍一下，下单后加力
    for (let q = 0; q < 4; q++) { const t = t0 + q * BEAT; n(t, 'noise', 56, 0.16, hot ? 0.16 : 0.1, { type: 'lowpass', q: 0.8, a: 0.005, r: 0.12 }, 'music', 0); }
    // off-beat pluck 分解和弦（卡点感）：下单后进来，往上走
    if (t0 >= driveIn - 1e-9) for (let q = 1; q < 8; q += 2) { const t = t0 + q * BEAT / 2; n(t, 'bell', deg(2 + ((q + b) % 4)), BEAT * 0.9, 0.2, { bright: 0.6, ratios: [1, 2, 3.01] }, 'music', ((q % 4) - 1.5) / 4); }
  }
  // ── 跟镜头事件走的音效（sfx 总线）+ 命中点上的一个乐音 ──
  const hit = (t, k, d = 0.9, vol = 0.3) => { if (t != null) n(t, 'bell', deg(k), d, vol, { bright: 0.6, ratios: [1, 2, 3.01] }, 'sfx', 0); };
  // 断音 mute：噼啪一声 + 下滑扫频（像线路断了），乐音低沉
  if (H.mute != null) { for (const [dt, p] of [[0, 0], [0.05, 0.2], [0.11, -0.15]]) n(H.mute + dt, 'click', 88, 0.03, 0.4, {}, 'sfx', p); n(H.mute, 'noise', 70, 0.5, 0.3, { type: 'bandpass', q: 1.2, sweep: -5, a: 0.005, r: 0.3 }, 'sfx', 0); hit(H.mute, 0, 1.0, 0.26); }
  // 下单 order：UI click + 上扬扫频
  if (H.order != null) { n(H.order, 'click', 94, 0.05, 0.5, {}, 'sfx', 0); n(H.order, 'noise', 72, 0.5, 0.3, { type: 'bandpass', q: 1.2, sweep: 5, a: 0.01, r: 0.2 }, 'sfx', 0); hit(H.order, 2, 0.8, 0.26); }
  // 料箱出塔 lift：机械提升的「嗡—咔」
  if (H.lift != null) { n(H.lift, 'noise', 60, 0.6, 0.26, { type: 'lowpass', q: 0.9, a: 0.1, r: 0.4 }, 'sfx', 0.1); n(H.lift + 0.4, 'click', 72, 0.05, 0.4, {}, 'sfx', 0.1); hit(H.lift, 4, 0.9, 0.28); }
  // 路线连通 connect：一声清脆的 tick（像导航接通）
  if (H.connect != null) { n(H.connect, 'click', 100, 0.04, 0.45, {}, 'sfx', 0.2); n(H.connect, 'bell', 97, 0.4, 0.3, { ratios: [1, 2.76, 5.4], bright: 0.9 }, 'sfx', 0.2); hit(H.connect, 6, 0.9, 0.28); }
  // 溅水 splash：轮胎划开积水的「唰」
  if (H.splash != null) { n(H.splash, 'noise', 96, 0.5, 0.3, { type: 'highpass', q: 0.7, sweep: -2, a: 0.01, r: 0.4 }, 'sfx', -0.1); hit(H.splash, 5, 0.8, 0.24); }
  // 电梯叮 ding：清脆的到达铃
  if (H.ding != null) { n(H.ding, 'bell', KEY + 24, 1.0, 0.4, { ratios: [1, 2.01, 3.0], bright: 0.9 }, 'sfx', 0); hit(H.ding, 7, 1.0, 0.26); }
  // 戴上 wear：耳机扣上头的「咔」
  if (H.wear != null) { n(H.wear, 'click', 64, 0.06, 0.5, {}, 'sfx', 0); }
  // 品牌动机 logo：三音
  if (H.logo != null) LOGO.forEach((d, i) => n(H.logo + i * BEAT * 0.5, 'bell', KEY + 12 + d, i === 2 ? 1.6 : 0.7, 0.42, { bright: 0.6, ratios: [1, 2, 3] }, 'sfx', 0));

  notes.sort((a, b) => a.t - b.t || a.f - b.f);
  return { notes, reverb: { decay: 1.8, music: 0.28, sfx: 0.18 } };
}
