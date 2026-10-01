// timeline.js — 剪辑表：[{ shot, dur, from, transition }] → 任意时刻 t 在哪个镜头、镜头本地时间、转场状态
// 转场属于"切入"的那一条；叠化时上一镜头继续往后播（lt 超过自身时长），闪白从 1 线性衰减到 0
import { clamp, smooth } from './ease.js';

const TYPES = ['cut', 'flash', 'dissolve'];

/** 变体 v 用的剪辑表：成片写了 cutFor(v) 就按它取（比如每款产品一套分镜），否则 cuts[v.cut]。m = film 或 META */
export function cutOf(m, v) {
  const c = m.cutFor ? m.cutFor(v) : m.cuts?.[v.cut];
  if (!c) throw new Error(`cut: no edit list for cut ${v.cut}`);
  return c;
}

export function buildCut(cut) {
  if (!cut?.shots?.length) throw new Error('cut: empty edit list');
  let start = 0;
  const entries = cut.shots.map((e, i) => {
    if (!(e.dur > 0)) throw new Error(`cut: entry ${i} (${e.shot}) needs dur > 0`);
    const transition = e.transition ?? { type: 'cut' };
    if (!TYPES.includes(transition.type)) throw new Error(`cut: entry ${i} has unknown transition ${transition.type}`);
    if (transition.type !== 'cut' && !(transition.dur > 0 && transition.dur <= e.dur)) throw new Error(`cut: entry ${i} transition is longer than the entry`);
    const from = e.from ?? 0, out = { shot: e.shot, start, end: start + e.dur, from, dur: from + e.dur, transition };
    start += e.dur;
    return out;
  });
  return { entries, duration: start, hits: { ...(cut.hits ?? {}) }, cover: cut.cover ?? 0 };
}

const local = (e, t) => { const lt = e.from + (t - e.start); return { shot: e.shot, lt, dur: e.dur, u: clamp(lt / e.dur) }; };

export function resolve(built, t) {
  const { entries, duration } = built;
  t = clamp(t, 0, duration);
  let index = entries.findIndex(e => t < e.end - 1e-9);
  if (index < 0) index = entries.length - 1;
  const e = entries[index], into = t - e.start, tr = e.transition;
  let flash = 0, prev = null;
  if (tr.type === 'flash' && into < tr.dur) flash = 1 - into / tr.dur;
  if (tr.type === 'dissolve' && index > 0 && into < tr.dur) prev = { ...local(entries[index - 1], t), k: smooth(into / tr.dur) };
  return { index, ...local(e, t), start: e.start, end: e.end, flash, prev };
}

export const shotAt = (built, name) => built.entries.find(e => e.shot === name);
