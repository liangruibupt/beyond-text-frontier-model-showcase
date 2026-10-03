// captions.js — 各镜头的字幕图层（纯数据）：文字、字体、区、字号（画面短边比例）、入场 / 退场（镜头本地秒）
// 入场时段相对 s.from，所以 6 秒版从中段切入的镜头字幕照样完整入场。字幕按分镜 §B：robots / sort / lastmile 有句子，door 是品牌 + 活动
import { cutFor } from './meta.js';
import { ITEMS, isAiItem } from './items.js';
import { T, FONTS } from './copy.js';
import { promoLayers } from './promos.js';

// 画面上的三句字幕（§B），zh / en；door 的品牌字在片尾卡里
const CAP = {
  robots: { zh: '几十台机器人，只为找到这一件', en: 'Dozens of robots, finding the one for you' },
  sort: { zh: '秒级分拣，路线自动规划', en: 'Sorted in seconds, routed automatically' },
  lastmile: { zh: '最后一公里，送到门口', en: 'The last mile, right to your door' },
  // 瑰夏咖啡豆（分镜 v2 §四）
  roast: { zh: '今天早上 7 点，刚出炉', en: 'Roasted at 7 this morning' },
  bag: { zh: '当天烘焙，当天发出', en: 'Roasted today, shipped today' },
  alley: { zh: '明天一早，到你门口', en: 'At your door by morning' },
};

const INK = '#f4efe6', SOFT = '#d8c6a8';       // 仓库 / 夜色里的浅字

/** s = { name, from, dur, row } → 图层数组 */
export function layersFor(v, s) {
  const L = v.lang, F = FONTS[L], a = s.from ?? 0, align = s.row?.align ?? 'center';
  const base = { lang: L, align, valign: 'top', color: INK, shadow: { color: 'rgba(0,0,0,0.55)', blur: 0.5 } };
  const cap = (text) => [{ ...base, id: 'cap', zone: 'cap', text, font: F.display, size: L === 'zh' ? 0.05 : 0.046, tracking: L === 'zh' ? 0.06 : 0.01, lineHeight: 1.3, maxLines: 2, in: [a + 0.3, a + 0.9], box: { fill: 'rgba(18,22,30,0.62)', color: INK, pad: 0.55, radius: 0.35 } }];   // 半透明深色底条：浅色水泥地、黎明的天上都看得清
  switch (s.name) {
    case 'robots': return cap(CAP.robots[L]);
    case 'sort': return cap(CAP.sort[L]);
    case 'lastmile': return cap(CAP.lastmile[L]);
    case 'roast': return cap(CAP.roast[L]);
    case 'bag': return cap(CAP.bag[L]);
    case 'alley': return cap(CAP.alley[L]);
    case 'pour': return endCard(v, base, F, a + (v.cut === 15 ? 0.6 : 0), align);   // 15 秒版片尾卡晚 0.6 s 入场，先看一眼注水；6 秒版价签要停满 3 秒
    case 'door': return endCard(v, base, F, a, align);
    default: return [];                                        // order / pack / truck / cool / night：无字幕
  }
}
function endCard(v, base, F, a, align) {
  const layers = [
      { ...base, id: 'card', zone: 'card', text: '', font: F.display, size: 0.04, shadow: null, panel: { fill: '#fbf5ea', alpha: 0.93, radius: 0.08, shadow: 'rgba(0,0,0,0.35)' }, in: [a + 0.0, a + 0.4] },
      { ...base, id: 'logo', zone: 'logo', lang: 'zh', text: '有集', font: FONTS.zh.display, size: 0.1, tracking: 0.2, color: '#2b2016', shadow: { color: 'rgba(0,0,0,0.2)', blur: 0.3 }, lineHeight: 1.05, maxLines: 1, in: [a + 0.2, a + 0.7] },
      { ...base, id: 'brand', zone: 'brand', lang: 'en', text: 'Youji', font: FONTS.brand, size: 0.036, tracking: 0.4, color: '#8a7a66', shadow: null, maxLines: 1, in: [a + 0.4, a + 0.9] },
      ...promoLayers(v, { a: a + 0.5, align }),
  ];
  // AI 画面变体：实拍底图的主体占画面大半，片尾卡收成紧凑的一块（layouts.js 的 ai_* 区：16:9 左侧三分之一、1:1 底部三分之一），
  // 底板稍透一点，让后面的画面透出来；logo 字号跟着缩。图层 id 不变，只换区。
  if (!isAiItem(v.item)) return layers;
  return layers.map(L => ({
    ...L, zone: `ai_${L.zone}`,
    ...(L.id === 'card' ? { panel: { ...L.panel, alpha: 0.86 } } : {}),
    ...(L.id === 'logo' ? { size: 0.08 } : {}),
  }));
}

/** 变体用到的每种字体及其全部字符：页面在第一帧前按这些字符加载字体子集 */
export function fontsFor(v) {
  const m = new Map();
  for (const e of cutFor(v).shots) for (const Lr of layersFor(v, { name: e.shot, from: e.from ?? 0, dur: e.dur })) {
    const key = `${Lr.font.family}|${Lr.font.weight ?? 400}`;
    m.set(key, (m.get(key) ?? '') + Lr.text);
  }
  return [...m].map(([key, text]) => { const [family, weight] = key.split('|'); return { family, weight: +weight, text: [...new Set(text.replace(/\s/g, ''))].join('') }; });
}

export { CAP };
