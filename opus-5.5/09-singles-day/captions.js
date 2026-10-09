// captions.js — 各镜头字幕图层（纯数据）：文字、字体、区、字号（画面短边比例）、入场（镜头本地秒）
// 入场相对 s.from，所以 6 秒版从中段切入的镜头字幕照样完整入场。脚手架阶段：批准的台词 + 片尾卡
import { CUTS } from './meta.js';
import { THEMES } from './themes.js';
import { CAP, MILE, T, FONTS } from './copy.js';
import { promoLayers } from './promos.js';

/** s = { name, from, dur, row } → 图层数组 */
export function layersFor(v, s) {
  const th = THEMES[v.theme], L = v.lang, pal = th.pal, a = s.from ?? 0, align = s.row?.align ?? 'center';
  const F = FONTS[L];
  const base = { lang: L, align, valign: 'top', color: pal.ink, shadow: { color: pal.glow, blur: 0.5 } };
  const cap = (zone, key, size = L === 'zh' ? 0.055 : 0.05) =>
    ({ ...base, id: 'cap', zone, text: CAP[key][L], font: F.display, size, tracking: L === 'zh' ? 0.08 : 0.02, lineHeight: 1.3, maxLines: 2, in: [a + 0.35, a + 0.95] });

  switch (s.name) {
    case 'countdown': return [cap('cap', 'countdown')];
    case 'ignite': return [cap('cap', 'ignite')];
    case 'arcs': return [cap('cap', 'arcs')];
    case 'gmv': return [cap('cap', 'gmv')];
    case 'milestone': return [
      { ...base, valign: 'middle', id: 'mile', zone: 'mile', text: MILE[v.theme][L](L === 'zh' ? th.milestoneTime : th.milestoneTimeEn), font: F.display, size: L === 'zh' ? 0.07 : 0.058, tracking: L === 'zh' ? 0.06 : 0.01, lineHeight: 1.1, maxLines: 2, in: [a + 0.0, a + 0.25], pop: true },
    ];
    case 'end': return [
      { ...base, valign: 'middle', id: 'logo', zone: 'logo', lang: 'zh', text: '星潮', font: FONTS.zh.display, size: 0.1, tracking: 0.2, lineHeight: 1.05, maxLines: 1, in: [a, a + 0.5] },
      { ...base, valign: 'middle', id: 'brand', zone: 'brand', lang: 'en', text: 'STARTIDE', font: FONTS.brand, size: 0.036, tracking: 0.45, color: pal.soft, maxLines: 1, in: [a + 0.2, a + 0.7] },
      ...promoLayers(v, { a: a + 0.3, align, pal, fonts: FONTS, glow: base.shadow }),
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
