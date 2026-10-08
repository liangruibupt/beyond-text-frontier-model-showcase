// pack/state.js — 把六个组件的纯函数在成片时间 t 上聚合成「图形层该画什么」的纯数据对象。
// overlay.js 按这个对象重绘，determinism 测试也用它：同一 (variant, t) 必得同一对象，与求值顺序无关。
// 这里不碰 canvas / three，只做数学，所以 Node 里可直接比对。
import { chrome } from './chrome.js';
import { danmaku } from './danmaku.js';
import { countdown } from './countdown.js';
import { cart } from './cart.js';
import { envelopes } from './envelopes.js';
import { stockbar } from './stockbar.js';
import { DANMAKU } from '../../copy.js';
import { CUTS, STORY0, NATURAL } from '../../meta.js';

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const ASPECT = { '16x9': 16 / 9, '1x1': 1, '9x16': 9 / 16 };

/**
 * packState(variant, t)：t 是成片秒。返回 { shot, chrome, danmaku, countdown?, cart?, envelopes?, stockbar? }
 * 按剪辑表定位 t 落在哪个镜头，再给出该镜头要画的组件状态。常驻的 chrome / danmaku 一直有。
 */
export function packState(v, t) {
  const cut = v.cut, edit = CUTS[cut];
  // 找到 t 所在的镜头（成片时间）
  let acc = 0, cur = null, from = 0;
  for (const e of edit.shots) { if (t >= acc - 1e-9 && t < acc + e.dur + 1e-9) { cur = e; from = acc; break; } acc += e.dur; }
  const dur = edit.shots.reduce((s, e) => s + e.dur, 0);
  if (!cur) { cur = edit.shots[edit.shots.length - 1]; from = dur - cur.dur; }
  const lt = (cur.from ?? 0) + (t - from);         // 镜头本地时间

  const out = { shot: cur.shot, lt, t };
  // 常驻外框 + 弹幕（end 镜头淡出，不画）；弹幕用传送带模型，stockFrom 之后整条车道提速（相对间距不变 → 不重叠）
  const fade = cur.shot === 'end';
  const stockFrom = cut === 15 ? STORY0.stock : Infinity;   // 15 秒版 stock 镜头的成片起点；6 秒版无 stock
  out.chrome = chrome(t, { dur, liveAt: cut === 15 ? 0.5 : -1, fade });
  out.danmaku = fade ? [] : danmaku(t, { lines: DANMAKU[v.lang], stockFrom, aspect: ASPECT[v.ar] ?? 16 / 9 });

  if (cur.shot === 'count') out.countdown = countdown(lt, { beats: [0.5, 1.0, 1.5], digits: ['3', '2', '1'], linkAt: 2.0 });
  if (cur.shot === 'cart') out.cart = cart(lt, { riseAt: 0, tapAt: 1.5 });
  if (cur.shot === 'rain') {
    const openAt = cut === 15 ? 2.0 : 0.5, denseAt = cut === 15 ? 0.5 : 0.0;
    out.envelopes = envelopes(lt, { dur: cut === 15 ? 3 : 1, denseAt, openAt });
  }
  if (cur.shot === 'stock') out.stockbar = stockbar(lt, { from: 0.37, startCount: 24, soldAt: 1.5, drainTo: 1.5 });
  return out;
}

export { CUTS, STORY0, NATURAL };
