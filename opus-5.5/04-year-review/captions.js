// captions.js — 各镜头的字幕图层（纯数据）：文字、字体、区、字号（画面短边比例）、入场 / 退场（镜头本地秒）
// 模型写的字（stories/<user>.json）填好数再上屏；这些图层带 story 字段（文案里的哪一项），story.js 的 check 用同样的图层查放不放得下
// 入场时段相对 s.from（这一条剪辑里镜头的起始本地时间）或镜头里的事件（EV），6 秒版从中段切入的镜头字幕照样完整入场
import { CUTS, EV } from './meta.js';
import { USERS } from './users.js';
import { storyOf } from './facts.js';
import { T, FONTS, valuesFor } from './copy.js';
import { promoLayers, MODEL_MIN } from './promos.js';
import { fill } from '../factory/engine/story.js';
import { easeOut } from '../factory/engine/ease.js';

const field = (story, key) => key.split('.').reduce((x, k) => x?.[k], story);
/** count 的大数字从 0 滚到订单数，EV.land 落定；不给 lt（排版、测试）就是最终值。滚动中的值不比最终值宽，字号不会跳 */
export const rolled = (n, lt) => (lt === undefined ? n : Math.round(n * easeOut(lt / EV.land)));

/** s = { name, from, dur, row, lt? } → 图层数组；story 默认是这位顾客入库的文案（缺了或过期了就报错），check 传候选稿 */
export function layersFor(v, s, story = storyOf(v.user)) {
  const L = v.lang, F = FONTS[L], pal = USERS[v.user].palette, a = s.from ?? 0, align = s.row?.align ?? 'center', V = valuesFor(v.user, L).screen;
  const base = { lang: L, align, valign: 'top', color: pal.ink, shadow: { color: pal.shadow, blur: 0.4 } };
  /** 模型写的一行：填好数，不许缩到设计字号的 85% 以下 */
  const said = (id, zone, key, size, o) => ({ ...base, id, zone, text: fill(field(story, key)[L], V), font: F.display, size, min: MODEL_MIN * size, lineHeight: 1.3, maxLines: 2, story: key, ...o });
  switch (s.name) {
    case 'open': return [
      { ...base, id: 'name', zone: 'name', text: T[L].of(V.name, V.year), font: F.display, size: 0.085, maxLines: 1, tracking: L === 'zh' ? 0.06 : 0, in: [a + 0.4, a + 1.0] },
      { ...base, id: 'sub', zone: 'sub', text: T[L].sub, font: F.body, size: 0.04, maxLines: 1, tracking: L === 'zh' ? 0.3 : 0.08, color: pal.soft, in: [a + 0.7, a + 1.3] },
    ];
    case 'count': return [
      { ...base, id: 'num', zone: 'num', text: String(rolled(V.orders, s.lt)), font: FONTS.num, size: 0.17, lineHeight: 1, maxLines: 1, color: pal.accent, in: [a, a + 0.25] },
      said('line', 'line', 'captions.count', 0.05, { in: [a + 0.7, a + 1.2] }),
    ];
    case 'months': return [
      said('line', 'line', 'captions.months', 0.05, { in: [EV.peak - 0.3, EV.peak + 0.2] }),
    ];
    case 'top': {
      const t0 = Math.max(a + 0.15, EV.slide[0]);
      return [said('line', 'line', 'captions.top', 0.05, { in: [t0, t0 + 0.45] })];
    }
    case 'title': return [
      { ...base, id: 'label', zone: 'label', text: T[L].label, font: F.body, size: 0.036, maxLines: 1, tracking: L === 'zh' ? 0.4 : 0.1, color: pal.soft, in: [a + 0.3, a + 0.7] },
      said('title', 'title', 'title', L === 'zh' ? 0.1 : 0.08, { lineHeight: 1.1, maxLines: L === 'zh' ? 1 : 2, tracking: L === 'zh' ? 0.08 : 0, in: [a + EV.medal + 0.2, a + EV.medal + 0.7] }),
    ];
    case 'end': return [
      { ...base, id: 'logo', zone: 'logo', lang: 'zh', text: '有集', font: FONTS.zh.display, size: 0.11, tracking: 0.25, lineHeight: 1.05, maxLines: 1, in: [a, a + 0.5] },
      { ...base, id: 'brand', zone: 'brand', lang: 'en', text: 'YOUJI', font: FONTS.en.display, size: 0.034, tracking: 0.55, maxLines: 1, color: pal.soft, in: [a + 0.2, a + 0.7] },
      ...promoLayers(v, { a: a + 0.3, align, pal, story }),
    ];
    default: return [];
  }
}

/** 变体用到的每种字体及其全部字符：页面在第一帧前按这些字符加载字体子集；滚动的数字那一种总带上 0–9 */
export function fontsFor(v) {
  const m = new Map(), key = f => `${f.family}|${f.weight ?? 400}`;
  m.set(key(FONTS.num), '0123456789');
  for (const e of CUTS[v.cut].shots) for (const L of layersFor(v, { name: e.shot, from: e.from ?? 0, dur: e.dur })) m.set(key(L.font), (m.get(key(L.font)) ?? '') + L.text);
  return [...m].map(([k, text]) => {
    const [family, weight] = k.split('|');
    return { family, weight: +weight, fallback: 'sans-serif', text: [...new Set(text.replace(/\s/g, ''))].join('') };
  });
}
