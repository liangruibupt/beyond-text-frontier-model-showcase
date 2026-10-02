// stories/beans/score.js — 咖啡豆的配乐（96 bpm，暖、慢）：木质 pluck 的分解和弦 + 柔和 pad；
// 音效跟镜头事件走：一爆噼啪、豆子倾泻沙沙、热封与盖章、发车、递到门口、注水；片尾三音动机和另外两条线相同（同一个品牌）
import { mtof } from '../../../factory/engine/audio.js';

const BEAT = 60 / 96, BAR = 4 * BEAT;
const KEY = 55;                                  // G
const CHORDS = [[0, 4, 7, 11], [-3, 0, 4, 7], [2, 5, 9, 12], [-5, -1, 2, 7]];   // Gmaj7 – Em7 – Am7 – D（低一个八度起）
const LOGO = [0, 3, 7];

export function score(v, built) {
  const H = built.hits, dur = built.duration, notes = [];
  const n = (t, voice, m, d, vol, p = {}, bus = 'music', pan = 0) => { if (t < 0 || t >= dur - 0.05) return; notes.push({ t, voice, f: mtof(m), d: Math.min(d, dur - t), v: vol, p, bus, pan }); };
  const bars = Math.ceil(dur / BAR - 1e-9);
  for (let b = 0; b < bars; b++) {
    const t0 = b * BAR, ch = CHORDS[b % CHORDS.length];
    for (const m of ch.slice(0, 3)) n(t0, 'pad', KEY - 12 + m, Math.min(BAR + 0.5, dur - t0), 0.08, { a: 0.9, r: 1.0, cut: 1.6, air: 0.25 });
    for (let q = 0; q < 8; q++) { const t = t0 + q * BEAT / 2; if (q % 2 && q !== 3) continue; n(t, 'bell', KEY + ch[q % 4], BEAT * 1.6, 0.13, { bright: 0.35, ratios: [1, 2, 4.01] }, 'music', ((q % 4) - 1.5) / 4); }
  }
  const hit = (t, m, d = 1.0, vol = 0.26) => { if (t != null) n(t, 'bell', KEY + m, d, vol, { bright: 0.5, ratios: [1, 2, 3.01] }, 'sfx', 0); };
  // 一爆 crack：几声干脆的噼啪
  if (H.crack != null) { for (const [dt, p] of [[0, 0], [0.07, 0.2], [0.16, -0.15], [0.21, 0.1]]) n(H.crack + dt, 'click', 96, 0.03, 0.42, {}, 'sfx', p); hit(H.crack, 7, 1.0, 0.24); }
  // 倾倒 tip：豆子落盘的沙沙声
  if (H.tip != null) { n(H.tip, 'noise', 88, 1.6, 0.26, { type: 'bandpass', q: 0.9, a: 0.05, r: 0.8 }, 'sfx', -0.2); hit(H.tip, 9, 1.0, 0.22); }
  // 盖章 stamp：一声闷的「咚」
  if (H.stamp != null) { n(H.stamp, 'click', 60, 0.08, 0.55, {}, 'sfx', 0.1); n(H.stamp, 'noise', 70, 0.15, 0.2, { type: 'lowpass', q: 0.8, a: 0.002, r: 0.1 }, 'sfx', 0); hit(H.stamp, 11, 0.9, 0.24); }
  // 出发 depart：远处车声
  if (H.depart != null) { n(H.depart, 'noise', 50, 1.6, 0.22, { type: 'lowpass', q: 0.8, a: 0.2, r: 1.0 }, 'sfx', 0); hit(H.depart, 12, 1.2, 0.22); }
  // 递到 handoff：纸箱放上石阶
  if (H.handoff != null) { n(H.handoff, 'click', 64, 0.06, 0.45, {}, 'sfx', 0); hit(H.handoff, 14, 1.0, 0.24); }
  // 注水 pour：细细的水声
  if (H.pour != null) { n(H.pour, 'noise', 100, 1.4, 0.18, { type: 'highpass', q: 0.6, a: 0.1, r: 0.6 }, 'sfx', 0.1); hit(H.pour, 7, 1.0, 0.22); }
  if (H.logo != null) LOGO.forEach((d, i) => n(H.logo + i * 0.25, 'bell', 57 + 12 + d, i === 2 ? 1.6 : 0.7, 0.42, { bright: 0.6, ratios: [1, 2, 3] }, 'sfx', 0));
  notes.sort((a, b) => a.t - b.t || a.f - b.f);
  return { notes, reverb: { decay: 2.6, music: 0.36, sfx: 0.2 } };
}
