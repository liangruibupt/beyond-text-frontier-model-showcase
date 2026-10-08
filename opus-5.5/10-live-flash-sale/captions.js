// captions.js — 还留在引擎文字层里的字幕 / 片尾卡（纯数据）：镜头说明字幕（room / rain）、已领券章、片尾卡。
// 其余直播间文字（有集直播信息、倒计时数字、上链接、商品名 / 价格、仅剩 N 件、已抢光、弹幕）都画在相机前的 overlay，
// 和各自的底板同在一套画布坐标里，天然对齐、清晰（见 js/overlay.js、js/pack/state.js）。
import { CUTS } from './meta.js';
import { ITEMS, RED, ORANGE, isAiItem } from './items.js';
import { T, FONTS } from './copy.js';
import { promoLayers } from './promos.js';

const INK = '#ffffff';
const SH = { color: 'rgba(0,0,0,0.55)', blur: 0.5 };
const DARKINK = '#2b2016';

const CAP = {
  room: { zh: '今晚最后一波', en: 'Last drop tonight' },
  rain: { zh: '红包雨来了', en: 'Red envelope rain' },
};

function pal(item) {
  return { ink: DARKINK, soft: '#9a8d78', shadow: 'rgba(0,0,0,0.18)', accent: item.accent, cta: ORANGE, ctaInk: '#ffffff' };
}

/** s = { name, from, dur } → 图层数组 */
export function layersFor(v, s) {
  const L = v.lang, F = FONTS[L], Tl = T[L], a = s.from ?? 0;
  const base = { lang: L, valign: 'top', color: INK, shadow: SH };
  const cap = text => [{ ...base, id: 'cap', zone: 'cap', text, font: F.display, size: L === 'zh' ? 0.05 : 0.046, tracking: L === 'zh' ? 0.06 : 0.01, lineHeight: 1.3, maxLines: 2, align: 'center', in: [a + 0.3, a + 0.9], box: { fill: 'rgba(18,22,30,0.6)', color: INK, pad: 0.5, radius: 0.35 } }];
  switch (s.name) {
    case 'room': return cap(CAP.room[L]);
    case 'rain': return [...cap(CAP.rain[L]),
      { lang: L, valign: 'middle', id: 'coupon', zone: 'coupon', text: Tl.couponed, font: FONTS.num, size: 0.034, maxLines: 1, align: 'center', color: '#ffffff', shadow: null, box: { fill: RED, color: '#ffffff', pad: 0.4, radius: 0.2 }, in: [a + 2.0, a + 2.2], pop: true },
    ];
    case 'end': return endCard(v, a);
    default: return [];   // count / cart / stock 的文字都在 overlay
  }
}

function endCard(v, a) {
  const L = v.lang, it = ITEMS[v.item], P = pal(it), align = 'center';
  // AI 变体 16:9：LTX 的 end 画面左半是负空间、商品在右 → 片尾卡用左半的 *_l 区（layouts.js）
  const zs = isAiItem(v.item) && v.ar === '16x9' ? '_l' : '';
  const base = { lang: L, align, valign: 'middle', color: DARKINK, shadow: { color: P.shadow, blur: 0.3 } };
  return [
    { ...base, id: 'card', zone: `card${zs}`, text: '', font: FONTS[L].display, size: 0.04, shadow: null, panel: { fill: '#fbf5ea', alpha: 0.95, radius: 0.08, shadow: 'rgba(0,0,0,0.35)' }, in: [a + 0.0, a + 0.4] },
    { ...base, id: 'logo', zone: `logo${zs}`, lang: 'zh', text: '有集', font: FONTS.zh.display, size: 0.1, tracking: 0.2, color: DARKINK, lineHeight: 1.05, maxLines: 1, in: [a + 0.2, a + 0.7] },
    { ...base, id: 'brand', zone: `brand${zs}`, lang: 'en', text: 'Youji', font: FONTS.brand, size: 0.036, tracking: 0.4, color: '#8a7a66', shadow: null, maxLines: 1, in: [a + 0.4, a + 0.9] },
    ...promoLayers(v, { a: a + 0.5, align, pal: { ...P, shadow: P.shadow }, zs }),
  ];
}

/** 变体用到的每种字体及其全部字符：页面在第一帧前按这些字符加载字体子集。
 *  overlay 的文字（有集直播、倒计时、价格、弹幕…）直接用 canvas 画，这里也把它们的字体 + 常用字加进来，
 *  确保 document.fonts 在第一帧前就把 Noto Sans SC 900 / Fredoka 700 加载好（否则 canvas 退回系统字体 → 看不清）。 */
export function fontsFor(v) {
  const m = new Map();
  const add = (family, weight, text) => { const key = `${family}|${weight}`; m.set(key, (m.get(key) ?? '') + text); };
  for (const e of CUTS[v.cut].shots) for (const Lr of layersFor(v, { name: e.shot, from: e.from ?? 0, dur: e.dur })) {
    if (!Lr.text) continue;
    add(Lr.font.family, Lr.font.weight ?? 400, Lr.text);
  }
  // overlay 要用到的字体 + 字符（直播间信息、弹幕、数字、价格、按钮、印章）
  const Tl = T[v.lang], it = ITEMS[v.item];
  const overlayZh = `有集直播秒杀价立即抢仅剩件已抢光已领券万人在看日常价${it.name.zh}`;
  const overlayDigits = '0123456789¥$,.KLIVE+';
  const overlayEn = `${Tl.live}${Tl.cta}${Tl.soldout}${Tl.couponed}${Tl.link}watchingFlashWasOnlyleft${it.name.en}${it.one.en}`;
  add('Noto Sans SC', 900, overlayZh + overlayDigits + '上链接！');
  add('Noto Sans SC', 500, overlayZh);
  add('Fredoka', 700, overlayEn + overlayDigits);
  return [...m].map(([key, text]) => { const [family, weight] = key.split('|'); return { family, weight: +weight, text: [...new Set(text.replace(/\s/g, ''))].join('') }; });
}

export { CAP };
