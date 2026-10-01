// captions.js — 各镜头的字幕图层（纯数据）：文字、字体、区、字号（画面短边比例）、入场 / 退场（镜头本地秒）
// 入场时段相对 s.from，所以 6 秒版从中段切入的镜头字幕照样完整入场。字幕按分镜 §B：robots / sort / lastmile 有句子，door 是品牌 + 活动
import { CUTS } from './meta.js';
import { ITEMS } from './items.js';
import { T, FONTS } from './copy.js';
import { promoLayers } from './promos.js';

// 画面上的三句字幕（§B），zh / en；door 的品牌字在片尾卡里
const CAP = {
  robots: { zh: '几十台机器人，只为找到这一件', en: 'Dozens of robots, finding the one for you' },
  sort: { zh: '秒级分拣，路线自动规划', en: 'Sorted in seconds, routed automatically' },
  lastmile: { zh: '最后一公里，送到门口', en: 'The last mile, right to your door' },
};

const INK = '#f4efe6', SOFT = '#d8c6a8';       // 仓库 / 夜色里的浅字

/** s = { name, from, dur, row } → 图层数组 */
export function layersFor(v, s) {
  const L = v.lang, F = FONTS[L], a = s.from ?? 0, align = s.row?.align ?? 'center';
  const base = { lang: L, align, valign: 'top', color: INK, shadow: { color: 'rgba(0,0,0,0.55)', blur: 0.5 } };
  const cap = (text) => [{ ...base, id: 'cap', zone: 'cap', text, font: F.display, size: L === 'zh' ? 0.05 : 0.046, tracking: L === 'zh' ? 0.06 : 0.01, lineHeight: 1.3, maxLines: 2, in: [a + 0.3, a + 0.9] }];
  switch (s.name) {
    case 'robots': return cap(CAP.robots[L]);
    case 'sort': return cap(CAP.sort[L]);
    case 'lastmile': return cap(CAP.lastmile[L]);
    case 'door': return [
      { ...base, id: 'card', zone: 'card', text: '', font: F.display, size: 0.04, shadow: null, panel: { fill: '#fbf5ea', alpha: 0.93, radius: 0.08, shadow: 'rgba(0,0,0,0.35)' }, in: [a + 0.0, a + 0.4] },
      { ...base, id: 'logo', zone: 'logo', lang: 'zh', text: '有集', font: FONTS.zh.display, size: 0.1, tracking: 0.2, color: '#2b2016', shadow: { color: 'rgba(0,0,0,0.2)', blur: 0.3 }, lineHeight: 1.05, maxLines: 1, in: [a + 0.2, a + 0.7] },
      { ...base, id: 'brand', zone: 'brand', lang: 'en', text: 'Youji', font: FONTS.brand, size: 0.036, tracking: 0.4, color: '#8a7a66', shadow: null, maxLines: 1, in: [a + 0.4, a + 0.9] },
      ...promoLayers(v, { a: a + 0.5, align }),
    ];
    default: return [];                                        // order / pack / truck：无字幕
  }
}

/** 变体用到的每种字体及其全部字符：页面在第一帧前按这些字符加载字体子集 */
export function fontsFor(v) {
  const m = new Map();
  for (const e of CUTS[v.cut].shots) for (const Lr of layersFor(v, { name: e.shot, from: e.from ?? 0, dur: e.dur })) {
    const key = `${Lr.font.family}|${Lr.font.weight ?? 400}`;
    m.set(key, (m.get(key) ?? '') + Lr.text);
  }
  return [...m].map(([key, text]) => { const [family, weight] = key.split('|'); return { family, weight: +weight, text: [...new Set(text.replace(/\s/g, ''))].join('') }; });
}

export { CAP };
