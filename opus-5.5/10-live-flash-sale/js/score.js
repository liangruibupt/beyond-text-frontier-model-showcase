// score.js — 配乐与音效（纯数据）：score(v, built) → { notes, reverb }，由 factory/engine/audio.js 合成
// 120 bpm，一拍 0.5 秒、一小节 2 秒；命中点都落在 0.5 秒网格上。热闹紧张的抢购感：
// 鼓点 + 贝斯底 + 人声嘈杂底噪；每个命中点一个主音效（§B），其余压低。音色用 audio.js 现有的 click/bell/plink/pluck/noise/pad。
import { mtof } from '../../factory/engine/audio.js';

export const BAR = 2.0, BEAT = 0.5;
const KEY = 45;                                  // A1 低贝斯
const SCALE = [0, 3, 5, 7, 10];                  // 小调五声
const deg = k => KEY + 24 + 12 * Math.floor(k / SCALE.length) + SCALE[((k % SCALE.length) + SCALE.length) % SCALE.length];

export function score(v, built) {
  const H = built.hits ?? {}, dur = built.duration, notes = [];
  const n = (t, voice, m, d, vol, p = {}, bus = 'music', pan = 0) => {
    if (t == null || t < 0 || t >= dur - 0.03) return;
    notes.push({ t, voice, f: mtof(m), d: Math.min(d, dur - t), v: vol, p, bus, pan });
  };
  // ── 底：每拍一个低贝斯脉冲（紧张感）+ 每小节一层 pad，人声嘈杂底噪用柔和 bandpass noise 垫着 ──
  const beats = Math.floor(dur / BEAT);
  for (let i = 0; i < beats; i++) {
    const t = i * BEAT;
    n(t, 'pluck', KEY, 0.22, i % 2 ? 0.16 : 0.22, { t60: 0.3, bright: 0.35 }, 'music', 0);   // 鼓点感的低拨
  }
  const bars = Math.ceil(dur / BAR - 1e-9);
  for (let b = 0; b < bars; b++) {
    const t0 = b * BAR;
    n(t0, 'pad', KEY + 12, Math.min(BAR + 0.3, dur - t0), 0.08, { a: 0.4, r: 0.6, cut: 2.0, air: 0.25 }, 'music', 0);   // air 当嘈杂底噪
  }

  // ── 命中点上的音效（sfx 总线，不被配音压低）——§B 每点一个主音效 ──
  const click = (t, vol = 0.5, pan = 0, m = 90) => n(t, 'click', m, 0.05, vol, {}, 'sfx', pan);
  const bell = (t, k, d = 0.9, vol = 0.3) => n(t, 'bell', deg(k), d, vol, { bright: 0.6, ratios: [1, 2, 3.01] }, 'sfx', 0);

  // LIVE 标亮起（0.5）
  if (H.live != null) { bell(H.live, 2, 0.6, 0.26); }
  // 倒计时数字 3/2/1：每个一声 click + bell（§B）
  for (const [k, key] of [[2, 'n3'], [1, 'n2'], [0, 'n1']]) if (H[key] != null) { click(H[key], 0.55, 0, 84); bell(H[key], 4 + k, 0.5, 0.3); }
  // 上链接（link）：noise 扫频 + 大鼓
  if (H.link != null) { n(H.link, 'noise', 80, 0.5, 0.34, { type: 'bandpass', q: 1.1, sweep: 5, a: 0.01, r: 0.2 }, 'sfx', 0); click(H.link, 0.6, 0, 60); bell(H.link, 7, 0.9, 0.3); }
  // 弹窗落定（cart）：pluck
  if (H.cart != null) { n(H.cart, 'pluck', deg(5), 0.5, 0.4, { t60: 0.4, bright: 0.6 }, 'sfx', 0); }
  // 点击按钮（tap）：click + 水波
  if (H.tap != null) { click(H.tap, 0.55, 0, 96); n(H.tap, 'plink', 700, 0.3, 0.3, { up: 1.4 }, 'sfx', 0); }
  // 红包雨（rain）：连串 plink
  if (H.rain != null) for (let i = 0; i < 6; i++) n(H.rain + i * 0.12, 'plink', 520 + i * 90, 0.25, 0.22, { up: 1.5 }, 'sfx', ((i % 3) - 1) * 0.4);
  // 拆红包（open）：金币 bell
  if (H.open != null) { n(H.open, 'bell', mtofHz(1200), 0.8, 0.34, { ratios: [1, 2.3, 4.1], bright: 1 }, 'sfx', 0); n(H.open, 'noise', 120, 0.2, 0.2, { type: 'highpass', q: 0.8, a: 0.002, r: 0.15 }, 'sfx', 0); }
  // 已抢光（soldout）：低音 pluck + noise 冲击
  if (H.soldout != null) { n(H.soldout, 'pluck', KEY - 5, 0.6, 0.5, { t60: 0.5, bright: 0.3 }, 'sfx', 0); n(H.soldout, 'noise', 70, 0.5, 0.34, { type: 'lowpass', q: 0.9, a: 0.01, r: 0.4 }, 'sfx', 0); }
  // 库存越刷越快的 tick（stock 段，10.5–12.0）：加速的 click 滴答
  if (H.soldout != null) { const t0 = H.soldout - 1.5; for (let i = 0, t = t0; t < H.soldout - 0.05; i++) { click(t, 0.3, 0.2, 110); t += 0.22 - Math.min(0.14, i * 0.015); } }
  // 片尾品牌三音动机（logo）
  if (H.logo != null) [0, 4, 7].forEach((d, i) => n(H.logo + i * BEAT * 0.5, 'bell', KEY + 24 + d, i === 2 ? 1.4 : 0.6, 0.42, { bright: 0.6, ratios: [1, 2, 3] }, 'sfx', 0));

  notes.sort((a, b) => a.t - b.t || a.f - b.f);
  return { notes, reverb: { decay: 1.8, music: 0.28, sfx: 0.18 } };
}

// 直接给出频率的音符（金币的高亮音），mtof 期望 midi；这里包一层把 Hz 当"已是频率"
function mtofHz(hz) { return 69 + 12 * Math.log2(hz / 440); }
