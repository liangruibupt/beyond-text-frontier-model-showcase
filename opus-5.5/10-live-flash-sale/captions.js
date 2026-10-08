// captions.js — 各镜头的字幕 / 文字层（纯数据 + 少量取值）：文字、字体、区、字号（画面短边比例）、入场 / 退场
// 入场时段相对 s.from，所以 6 秒版从中段切入的镜头字幕照样完整入场。图形（弹窗底板 / 印章底）在 overlay，
// 文字（商品名、价格、仅剩 N 件、已抢光、已领券、片尾卡）在这里走引擎文字层（清晰、在后期之后叠上）。
import { CUTS } from './meta.js';
import { ITEMS, RED, ORANGE, GOLD } from './items.js';
import { T, FONTS, money } from './copy.js';
import { promoLayers } from './promos.js';

const INK = '#ffffff', DARKINK = '#2b2016';
const SH = { color: 'rgba(0,0,0,0.55)', blur: 0.5 };

// 镜头说明字幕（§B 字幕列）
const CAP = {
  room: { zh: '今晚最后一波', en: 'Last drop tonight' },
  rain: { zh: '红包雨来了', en: 'Red envelope rain' },
};

/** 商品配色（片尾卡 promoLayers 用）：米白卡上的深墨字 + 商品主色作强调 */
function pal(item) {
  return { ink: DARKINK, soft: '#9a8d78', shadow: 'rgba(0,0,0,0.18)', accent: item.accent, cta: ORANGE, ctaInk: '#ffffff' };
}

/** 直播间外框文字：左上「有集直播」+ 在线人数、LIVE 标（整片常驻；放在 chrome 的 room/live 区） */
function chromeText(v, s) {
  const L = v.lang, F = FONTS[L], Tl = T[L];
  const a = s.from ?? 0;
  // 在线人数随成片时间上涨（取 chrome 组件的同一算法：这里简化为固定展示，真正跳动在 overlay 的心形 + 这里的文字）
  return [
    { id: 'room', zone: 'room', lang: 'zh', text: Tl.live, font: FONTS.num, size: 0.028, color: INK, shadow: SH, maxLines: 1, align: 'left', valign: 'middle', in: [a, a + 0.3] },
  ];
}

/** s = { name, from, dur, row, stockLeft? } → 图层数组 */
export function layersFor(v, s) {
  const L = v.lang, F = FONTS[L], Tl = T[L], it = ITEMS[v.item], a = s.from ?? 0, cur = Tl.currency;
  const base = { lang: L, valign: 'middle', color: INK, shadow: SH };
  const cap = (text, align = 'center') => [{ ...base, id: 'cap', zone: 'cap', text, font: F.display, size: L === 'zh' ? 0.05 : 0.046, tracking: L === 'zh' ? 0.06 : 0.01, lineHeight: 1.3, maxLines: 2, align, valign: 'top', in: [a + 0.3, a + 0.9], box: { fill: 'rgba(18,22,30,0.6)', color: INK, pad: 0.5, radius: 0.35 } }];
  const live = chromeText(v, s);
  switch (s.name) {
    case 'room': return [...live, ...cap(CAP.room[L])];
    case 'count': return [...live,
      { ...base, id: 'link', zone: 'link', text: Tl.link, font: F.display, size: 0.07, tracking: 0.02, maxLines: 1, align: 'center', color: GOLD, shadow: { color: RED, blur: 0.5 }, pop: true, in: [a + 2.0, a + 2.2] },
    ];
    case 'cart': {
      const align = v.ar === '16x9' ? 'left' : 'center';
      return [...live,
        { ...base, id: 'cartName', zone: 'cartName', text: it.name[L], font: F.display, size: 0.04, maxLines: 1, align, color: DARKINK, shadow: null, in: [a + 0.2, a + 0.6] },
        { ...base, id: 'cartPrice', zone: 'cartPrice', text: `${Tl.deal} ${money(it.deal[cur], L)}`, font: FONTS.num, size: 0.07, lineHeight: 1.05, maxLines: 1, align, color: RED, shadow: null, pop: true, in: [a + 0.3, a + 0.7] },
        { ...base, id: 'cartWas', zone: 'cartWas', text: `${Tl.was} ${money(it.price[cur], L)}`, font: FONTS.num, size: 0.034, maxLines: 1, align, color: '#9a8d78', shadow: null, strike: true, in: [a + 0.5, a + 0.9] },
        { ...base, id: 'cartCta', zone: 'cartCta', text: Tl.cta, font: F.display, size: 0.034, maxLines: 1, align: 'center', color: '#ffffff', shadow: null, box: { fill: ORANGE, color: '#ffffff', pad: 0.5, radius: 0.4 }, in: [a + 0.6, a + 1.0] },
      ];
    }
    case 'rain': return [...live, ...cap(CAP.rain[L]),
      { ...base, id: 'coupon', zone: 'coupon', text: Tl.couponed, font: FONTS.num, size: 0.034, maxLines: 1, align: 'center', color: '#ffffff', shadow: null, box: { fill: RED, color: '#ffffff', pad: 0.4, radius: 0.2 }, in: [a + 2.0, a + 2.2], pop: true },
    ];
    case 'stock': {
      const n = s.stockLeft ?? 9;
      return [...live,
        { ...base, id: 'only', zone: 'only', text: Tl.only(n), font: FONTS.num, size: 0.04, maxLines: 1, align: 'center', color: GOLD, shadow: SH, in: [a + 0.2, a + 0.5] },
        { ...base, id: 'soldout', zone: 'soldout', text: Tl.soldout, font: F.display, size: 0.09, tracking: L === 'zh' ? 0.1 : 0.04, maxLines: 1, align: 'center', color: '#ffffff', shadow: { color: RED, blur: 0.4 }, box: { fill: RED, color: '#ffffff', pad: 0.45, radius: 0.12 }, pop: true, in: [a + 1.5, a + 1.7] },
      ];
    }
    case 'end': return endCard(v, a);
    default: return live;
  }
}

function endCard(v, a) {
  const L = v.lang, it = ITEMS[v.item], P = pal(it), align = 'center';
  const base = { lang: L, align, valign: 'middle', color: DARKINK, shadow: { color: P.shadow, blur: 0.3 } };
  return [
    { ...base, id: 'card', zone: 'card', text: '', font: FONTS[L].display, size: 0.04, shadow: null, panel: { fill: '#fbf5ea', alpha: 0.95, radius: 0.08, shadow: 'rgba(0,0,0,0.35)' }, in: [a + 0.0, a + 0.4] },
    { ...base, id: 'logo', zone: 'logo', lang: 'zh', text: '有集', font: FONTS.zh.display, size: 0.1, tracking: 0.2, color: DARKINK, lineHeight: 1.05, maxLines: 1, in: [a + 0.2, a + 0.7] },
    { ...base, id: 'brand', zone: 'brand', lang: 'en', text: 'Youji', font: FONTS.brand, size: 0.036, tracking: 0.4, color: '#8a7a66', shadow: null, maxLines: 1, in: [a + 0.4, a + 0.9] },
    ...promoLayers(v, { a: a + 0.5, align, pal: { ...P, shadow: P.shadow } }),
  ];
}

/** 变体用到的每种字体及其全部字符：页面在第一帧前按这些字符加载字体子集 */
export function fontsFor(v) {
  const m = new Map();
  for (const e of CUTS[v.cut].shots) for (const Lr of layersFor(v, { name: e.shot, from: e.from ?? 0, dur: e.dur, stockLeft: 24 })) {
    if (!Lr.text) continue;
    const key = `${Lr.font.family}|${Lr.font.weight ?? 400}`;
    m.set(key, (m.get(key) ?? '') + Lr.text);
  }
  // 弹幕 / 倒计时 / 在线人数等 overlay 文字直接用 canvas 画，不走字体子集，但为稳妥把常用字加进 Noto 900 / 500
  return [...m].map(([key, text]) => { const [family, weight] = key.split('|'); return { family, weight: +weight, text: [...new Set(text.replace(/\s/g, ''))].join('') }; });
}

export { CAP };
