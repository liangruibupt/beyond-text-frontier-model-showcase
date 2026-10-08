// captions.js — 各镜头的字幕图层（纯数据）：文字、字体、区、字号（画面短边比例）、入场 / 退场（镜头本地秒）
// 入场时段相对 s.from（这一条剪辑里镜头的起始本地时间），所以 6 秒版从中段切入的镜头字幕照样完整入场
import { cutOf } from '../factory/engine/timeline.js';
import { META } from './meta.js';
import { SCARVES } from './scarves.js';
import { FONTS } from './copy.js';
import { KIND } from './layouts.js';
import { promoLayers } from './promos.js';

/** s = { name, from, dur, row } → 图层数组 */
export function layersFor(v, s) {
  const k = SCARVES[v.scarf], L = v.lang, F = FONTS[L], pal = k.palette, a = s.from ?? 0, align = s.row?.align ?? 'center';
  const base = { lang: L, align, valign: 'top', color: pal.ink, shadow: { color: pal.shadow, blur: 0.45 } };
  const zt = L === 'zh' ? 0.14 : 0.02, cap = k.caps[s.name]?.[L];
  switch (KIND[s.name]) {
    case 'open': return [{ ...base, id: 'cap', zone: 'cap', text: cap, font: F.display, size: L === 'zh' ? 0.07 : 0.06, tracking: zt, lineHeight: 1.25, maxLines: 2, in: [a + 0.35, a + 1.05] }];
    case 'line': return cap ? [{ ...base, id: 'cap', zone: 'cap', text: cap, font: F.body, size: L === 'zh' ? 0.044 : 0.046, tracking: zt * 0.7, lineHeight: 1.25, maxLines: 2, in: [a + 0.3, a + 0.9] }] : [];
    case 'title': return [
      { ...base, id: 'title', zone: 'title', text: k.name[L], font: F.display, size: L === 'zh' ? 0.085 : 0.075, tracking: zt * 1.2, lineHeight: 1.15, maxLines: 2, in: [a + 0.1, a + 0.6] },
      { ...base, id: 'sub', zone: 'sub', lang: 'en', text: 'JINSHI', font: FONTS.brand, size: 0.042, tracking: 0.4, color: pal.ink, shadow: { color: pal.shadow, blur: 0.25 }, maxLines: 1, in: [a + 0.3, a + 0.7] },
    ];
    case 'end': return [
      { ...base, id: 'logo', zone: 'logo', lang: 'zh', text: '锦时', font: FONTS.zh.display, size: 0.1, tracking: 0.3, lineHeight: 1.05, maxLines: 1, in: [a, a + 0.5] },
      { ...base, id: 'brand', zone: 'brand', lang: 'en', text: 'JINSHI', font: FONTS.brand, size: 0.036, tracking: 0.45, color: pal.soft, maxLines: 1, in: [a + 0.2, a + 0.7] },
      ...promoLayers(v, { a: a + 0.3, align, pal, glow: base.shadow }),
    ];
    default: return [];
  }
}

/** 变体用到的每种字体及其全部字符：页面在第一帧前按这些字符加载字体子集 */
export function fontsFor(v) {
  const m = new Map();
  for (const e of cutOf(META, v).shots) for (const L of layersFor(v, { name: e.shot, from: e.from ?? 0, dur: e.dur })) {
    const key = `${L.font.family}|${L.font.weight ?? 400}`;
    m.set(key, (m.get(key) ?? '') + L.text);
  }
  return [...m].map(([key, text]) => { const [family, weight] = key.split('|'); return { family, weight: +weight, text: [...new Set(text.replace(/\s/g, ''))].join('') }; });
}
