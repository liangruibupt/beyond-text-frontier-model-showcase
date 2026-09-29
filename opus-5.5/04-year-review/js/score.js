// score.js — 配乐与音效（纯数据，浏览器与 Node 测试共用）：score(v, built) → { notes, reverb }，由 factory/engine/audio.js 合成
// D 大调、80 bpm、一小节 3 秒；命中点（包裹落地、柱子峰值、进购物车、奖牌、品牌动机）都在 0.75 秒的拍子上
// 按镜头写：每个镜头的声音用镜头本地时间 lt 写，再按剪辑表摆进成片（place），所以 15 秒和 6 秒两个剪辑、
// 从 from 开始的镜头都用同一份。铺底这类长音在镜头从中间开始时从镜头起点接上，不会整句丢掉
// 数据驱动的部分：open 的琶音按翻到的日子有没有订单决定力度；months 的每根柱子升起时弹一个音，
// 音高是那个月订单数在五声音阶上的位置，所以每位顾客的旋律都不同；count 的咔哒跟着滚动数字的缓动
import { EV, SHOTS } from '../meta.js';
import { statsFor } from '../facts.js';
import { riseAt } from './chart.js';
import { flipStart, FLIP } from './wall.js';
import { CONTACTS } from './medal.js';
import { PRODUCT } from './pie.js';
import { daysInYear } from '../stats.js';
import { mtof } from '../../factory/engine/audio.js';

export const BEAT = 0.75, STEP = BEAT / 4;                // 一拍 0.75 秒，十六分音符 0.1875 秒
export const TONIC = 62;                                  // D4
export const PENTA = [0, 2, 4, 7, 9];                     // D 宫调五声：D E F# A B
/** 五声音阶的第 n 级（0 = D4，5 = D5，10 = D6） */
export const penta = n => TONIC + 12 * Math.floor(n / 5) + PENTA[((n % 5) + 5) % 5];
export const LOGO = [2, 7, 12];                           // 品牌动机：E4 A4 D5，落在第 0、¼、½ 拍
export const RANGE = 10;                                  // months 旋律的音域：最少的月份 D4，最多的月份 D6
export const REVERB = { decay: 2.6, music: 0.35, sfx: 0.2 };

const K = {
  pluck: { t60: 1.8, bright: 0.45 }, soft: { t60: 1.3, bright: 0.3 }, low: { t60: 3, bright: 0.22 },
  pad: { a: 0.8, r: 1, cut: 2.5, air: 0.15 }, bell: { bright: 0.55 }, spark: { bright: 0.8 },
};
/** 一个音：lt 镜头本地秒，m MIDI 音高，d 秒 */
const n = (lt, voice, m, d, v, p = {}, bus = 'music', pan = 0) => ({ lt, voice, f: mtof(m), d, v, p, bus, pan });
const fx = (lt, voice, f, d, v, p = {}, pan = 0) => ({ lt, voice, f, d, v, p, bus: 'sfx', pan });
const chord = (lt, ms, d, v, p = K.pad) => ms.map((m, i) => n(lt, 'pad', m, d, v * (1 - 0.15 * i), p));

/** months 的旋律：每个月的订单数 → 五声音阶的级数（最少 0，最多 RANGE），线性映射后取整 */
export function monthDegrees(months) {
  const lo = Math.min(...months), hi = Math.max(...months);
  return months.map(m => (hi === lo ? RANGE / 2 : Math.round(((m - lo) / (hi - lo)) * RANGE)));
}

/** count 的咔哒：滚动数字（easeOut）每走过十二分之一响一下，最后一下就是落定；越往后越稀 */
export const CLICKS = 12;
export const clickAt = j => EV.land * (1 - Math.cbrt(1 - j / CLICKS));

// ── 各镜头的声音（lt 是镜头本地秒）──
const SOUND = {
  /** open：方块按天翻面，拨弦琶音一个十六分音符一个音往上走，音高跟着翻到一年里的哪儿；翻到的日子里下单的越多，这个音越响 */
  open(st) {
    const N = daysInYear(st.year), on = new Set(st.days), out = [];
    out.push(n(0, 'pluck', 38, 3, 0.4, K.low), n(0, 'pluck', 50, 2.5, 0.25, K.low));
    for (let k = 1; k * STEP < EV.flip[1] + 1e-9; k++) {
      const lt = k * STEP, a = lt - STEP, frac = Math.min(1, Math.max(0, (lt - EV.flip[0]) / (EV.flip[1] - EV.flip[0])));
      const days = [...Array(N).keys()].filter(d => flipStart(d, N) >= a && flipStart(d, N) < lt), share = days.length ? days.filter(d => on.has(d)).length / days.length : 0;
      out.push(n(lt, 'pluck', penta(Math.round(frac * 9)), 1.2, 0.2 + 0.35 * share, K.pluck, 'music', -0.4 + 0.8 * frac));
    }
    out.push(fx(EV.flip[0], 'noise', 5200, EV.flip[1] - EV.flip[0] + FLIP, 0.18, { type: 'bandpass', q: 0.8, a: 0.3, r: 0.4, wander: 0.4 }));   // 一片方块翻动的沙沙声
    return out;
  },
  /** count：包裹起跳一声气流；数字滚动时咔哒越来越稀，落定（EV.land）钟声、低音、D 大三和弦的拨弦，包裹落进堆里一声闷响 */
  count() {
    const out = [fx(0, 'noise', 500, 0.5, 0.35, { type: 'bandpass', q: 1, sweep: 4, a: 0.2, r: 0.2 })];
    for (let j = 1; j < CLICKS; j++) out.push(fx(clickAt(j), 'click', 1800 + 1400 * (j / CLICKS), 0.04, 0.22 + 0.1 * (j / CLICKS), {}, j % 2 ? 0.15 : -0.15));
    const L = EV.land;
    out.push(
      n(L, 'bell', 74, 2.4, 0.55, K.bell), n(L, 'bell', 81, 1.4, 0.2, K.bell),
      n(L, 'pluck', 38, 3, 0.55, K.low), n(L, 'pluck', 50, 2.5, 0.3, K.low),
      n(L, 'pluck', 62, 1.5, 0.3, K.pluck), n(L, 'pluck', 66, 1.5, 0.28, K.pluck), n(L, 'pluck', 69, 1.5, 0.26, K.pluck),
      fx(L, 'noise', 180, 0.35, 0.5, { type: 'lowpass', q: 0.7, a: 0.005, r: 0.3 }),
      n(L + 2 * STEP, 'pluck', 69, 1.2, 0.22, K.soft), n(L + 4 * STEP, 'pluck', 74, 1.2, 0.2, K.soft), n(L + 6 * STEP, 'pluck', 78, 1.2, 0.18, K.soft),
    );
    return out;
  },
  /** months：铺底进来（D 大三和弦）；每根柱子升起时弹那个月的音（按订单数），最多的一根在 EV.peak 亮起：钟声落在 D6 */
  months(st) {
    const deg = monthDegrees(st.months), max = Math.max(...st.months), out = chord(0, [50, 57, 62, 66], 3, 0.8, { ...K.pad, a: 0.6 });
    out.push(n(0, 'pluck', 38, 3, 0.45, K.low));
    st.months.forEach((m, i) => out.push(n(riseAt(i), 'pluck', penta(deg[i]), 1.2, 0.25 + 0.25 * (m / max), K.pluck, 'music', -0.6 + (1.2 * i) / 11)));
    out.push(n(EV.peak, 'bell', penta(RANGE), 2.2, 0.5, K.bell), n(EV.peak, 'bell', 81, 1.6, 0.25, K.bell), n(EV.peak, 'pluck', 38, 2.5, 0.45, K.low), n(EV.peak, 'pluck', 50, 2, 0.3, K.low));
    return out;
  },
  /** top：Bm → G 的铺底，八分音符轻轻的脉动（配音在这里）；饼块扫上来一阵气流，商品弹出、飞弧、落进购物车（EV.cart） */
  top() {
    const out = [...chord(0, [47, 54, 59, 62], 1.5, 0.75), ...chord(1.5, [43, 55, 59, 62], 1.5, 0.75), n(0, 'pluck', 35, 2, 0.4, K.low), n(1.5, 'pluck', 43, 2, 0.45, K.low)];
    const pulse = [[59, 66], [62, 66], [59, 67], [62, 67]];
    for (let k = 0; k < 8; k++) out.push(n(k * 2 * STEP, 'pluck', pulse[Math.floor(k / 2)][k % 2], 0.8, 0.14, K.soft, 'music', k % 2 ? 0.2 : -0.2));
    out.push(
      fx(EV.sweep[0], 'noise', 300, EV.sweep[1] - EV.sweep[0], 0.3, { type: 'bandpass', q: 0.9, sweep: 3, a: 0.4, r: 0.2 }),
      fx(EV.slide[0], 'click', 900, 0.08, 0.2),
      fx(PRODUCT.pop[0], 'plink', mtof(79), 0.3, 0.4, { up: 1.5 }),
      fx(PRODUCT.pop[1], 'noise', 900, EV.cart - PRODUCT.pop[1] + 0.05, 0.45, { type: 'bandpass', q: 1.2, sweep: 3, a: 0.2, r: 0.08 }, 0.3),
      fx(EV.cart, 'click', 2600, 0.05, 0.4, {}, 0.35), fx(EV.cart, 'plink', mtof(83), 0.3, 0.35, { up: 1.3 }, 0.35),
      n(EV.cart, 'bell', 83, 1.8, 0.4, K.bell), n(EV.cart, 'pluck', 67, 1.2, 0.3, K.pluck), n(EV.cart, 'pluck', 71, 1.2, 0.28, K.pluck),
    );
    return out;
  },
  /** title：闪白一声钟的和弦（A 大三和弦，属和弦等着回家），奖牌落地、弹两下，星星闪的时候几个高音 */
  title() {
    const out = [...[69, 73, 76].map((m, i) => n(0, 'bell', m, 2, 0.4 - 0.05 * i, K.bell)), n(0, 'pluck', 45, 2, 0.45, K.low), ...chord(0, [45, 57, 62, 64], 1.5, 0.7, { ...K.pad, a: 0.3 })];
    CONTACTS.forEach((t, i) => {
      out.push(fx(t, 'noise', 220, 0.25, [0.45, 0.2, 0.1][i], { type: 'lowpass', q: 0.7, a: 0.004, r: 0.2 }));
      out.push(fx(t, 'bell', 1900, 0.5, [0.35, 0.18, 0.1][i], { ratios: [1, 2.4, 4.1], bright: 0.6 }, 0.1));
    });
    [[2, 81], [3, 85], [4, 88], [5, 85]].forEach(([k, m], i) => out.push(n(k * STEP, 'bell', m, 1, 0.16, K.spark, 'music', [-0.4, 0.3, -0.2, 0.4][i])));
    return out;
  },
  /** end：D add9 的铺底和低音 D 收住；品牌动机在 sfx 母线上（配音压不住它） */
  end() {
    return [...chord(0, [50, 57, 64, 66], 3, 0.8, { ...K.pad, a: 0.4, r: 0.8 }), n(0, 'pluck', 38, 4, 0.55, K.low), n(0, 'pluck', 50, 4, 0.3, K.low), ...logo(0)];
  },
};

/** 品牌动机：拨弦 + 高八度的钟声，走 sfx 母线；t 是镜头本地秒 */
export function logo(t) {
  return LOGO.flatMap((k, i) => {
    const last = i === LOGO.length - 1, lt = t + i * STEP * 2;
    return [n(lt, 'pluck', TONIC + k, last ? 3 : 1.2, last ? 0.8 : 0.65, { t60: 2.5, bright: 0.45 }, 'sfx'), n(lt, 'bell', TONIC + k + 12, last ? 3 : 1.2, last ? 0.4 : 0.32, { bright: 0.5 }, 'sfx')];
  });
}

/** 把一个镜头的声音按剪辑表摆进成片：只要镜头 [from, from + dur) 里起音的；铺底、噪声这种长音在 from 之前起、还没完的，从镜头起点接上 */
export function place(e, events) {
  const out = [];
  for (const { lt, ...ev } of events) {
    if (lt >= e.from - 1e-9 && lt < e.dur - 1e-9) out.push({ ...ev, t: e.start + lt - e.from });
    else if (lt < e.from && (ev.voice === 'pad' || ev.voice === 'noise') && lt + ev.d > e.from + 0.3) out.push({ ...ev, t: e.start, d: lt + ev.d - e.from });
  }
  return out;
}

/** 整段的环境声和转场：一层很轻的底噪（vo: off 时成片也不是静音），每个闪白、叠化一声气流，峰值在转场中点 */
function bed(built) {
  const out = [{ t: 0, voice: 'noise', f: 700, d: built.duration, v: 0.22, bus: 'sfx', pan: 0, p: { type: 'bandpass', q: 0.5, a: 0.8, r: 1, wander: 0.6 } }];
  built.entries.forEach((e, i) => {
    if (e.transition.type === 'cut') return;
    out.push({ t: Math.max(0, e.start + e.transition.dur / 2 - 0.4), voice: 'noise', f: 450, d: 0.65, v: 0.4, bus: 'sfx', pan: i % 2 ? 0.25 : -0.25, p: { type: 'bandpass', q: 0.8, sweep: 5, a: 0.4, r: 0.25 } });
  });
  return out;
}

export function score(v, built) {
  const st = statsFor(v.user), notes = [];
  for (const e of built.entries) {
    if (!SOUND[e.shot]) throw new Error(`score: no sound for shot ${e.shot} (expected ${SHOTS.join(' | ')})`);
    notes.push(...place(e, SOUND[e.shot](st, v)));
  }
  notes.push(...bed(built));
  return { notes: notes.filter(x => x.t < built.duration - 1e-9).sort((a, b) => a.t - b.t || a.f - b.f), reverb: REVERB };
}
