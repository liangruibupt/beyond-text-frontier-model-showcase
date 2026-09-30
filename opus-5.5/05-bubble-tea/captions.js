// captions.js — 各镜头的字幕图层（纯数据）：文字、字体、区、字号（画面短边比例）、入场 / 退场（镜头本地秒）
// 入场时段相对 s.from（这一条剪辑里镜头的起始本地时间），所以 6 秒版从中段切入的镜头字幕照样完整入场
import { CUTS } from './meta.js';
import { FLAVORS } from './flavors.js';
import { T, FONTS } from './copy.js';
import { promoLayers } from './promos.js';

/** s = { name, from, dur, row } → 图层数组 */
export function layersFor(v, s) {
  const k = FLAVORS[v.flavor], L = v.lang, F = FONTS[L], pal = k.palette, a = s.from ?? 0, align = s.row?.align ?? 'center';
  const base = { lang: L, align, valign: 'top', color: pal.ink, shadow: { color: pal.shadow, blur: 0.4 } };
  switch (s.name) {
    case 'pearls': return [
      { ...base, id: 'hook', zone: 'hook', text: k.image[L], font: F.display, size: L === 'zh' ? 0.056 : 0.05, tracking: L === 'zh' ? 0.06 : 0, lineHeight: 1.3, maxLines: 2, in: [a + 0.35, a + 0.95] },
    ];
    case 'hero': return [
      { ...base, id: 'title', zone: 'title', text: k.name[L], font: F.display, size: L === 'zh' ? 0.085 : 0.07, tracking: L === 'zh' ? 0.1 : 0, lineHeight: 1.15, maxLines: 2, in: [a + 0.3, a + 0.9] },
      { ...base, id: 'sub', zone: 'sub', lang: 'en', text: 'BOCHA', font: FONTS.brand, size: 0.04, tracking: 0.3, color: pal.soft, maxLines: 1, in: [a + 0.6, a + 1.2] },
    ];
    case 'straw': return [
      { ...base, id: 'parts', zone: 'parts', text: k.parts[L].join(T[L].dot), font: F.body, size: L === 'zh' ? 0.046 : 0.042, tracking: L === 'zh' ? 0.06 : 0, lineHeight: 1.3, maxLines: 2, in: [a + 0.9, a + 1.4] },
    ];
    case 'end': return [
      { ...base, id: 'logo', zone: 'logo', lang: 'zh', text: '啵茶', font: FONTS.zh.display, size: 0.1, tracking: 0.2, lineHeight: 1.05, maxLines: 1, in: [a, a + 0.5] },
      { ...base, id: 'brand', zone: 'brand', lang: 'en', text: 'BOCHA', font: FONTS.brand, size: 0.036, tracking: 0.45, color: pal.soft, maxLines: 1, in: [a + 0.2, a + 0.7] },
      ...promoLayers(v, { a: a + 0.3, align, pal }),
    ];
    default: return [];
  }
}

/** 变体用到的每种字体及其全部字符：页面在第一帧前按这些字符加载字体子集 */
export function fontsFor(v) {
  const m = new Map();
  for (const e of CUTS[v.cut].shots) for (const L of layersFor(v, { name: e.shot, from: e.from ?? 0, dur: e.dur })) {
    const key = `${L.font.family}|${L.font.weight ?? 400}`;
    m.set(key, (m.get(key) ?? '') + L.text);
  }
  return [...m].map(([key, text]) => { const [family, weight] = key.split('|'); return { family, weight: +weight, text: [...new Set(text.replace(/\s/g, ''))].join('') }; });
}
