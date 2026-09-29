// promos.js — 片尾卡的三种预设：none（标语 + 查看报告）、launch（年度报告上线 + 分享券）、1111（为你推荐的商品和双11 价签）
// 都是模板，不是模型写的；1111 的商品是模型挑的（story.pick），名字和价格从商品目录取。图层放在 end 镜头的 line1–line4 四个区
import { ITEMS } from './catalog.js';
import { T, FONTS, PROMO_T, money } from './copy.js';

export const RED = '#e1251b';
export const MODEL_MIN = 0.85;                                       // 模型决定的字最多缩到设计字号的 85%，再长就算放不下（story.js 的 check）

/** a = 入场起点（镜头本地秒），pal = 顾客的配色，story = 这位顾客的文案 */
export function promoLayers(v, { a = 0, align = 'center', pal, story }) {
  const L = v.lang, P = PROMO_T[L], F = FONTS[L], cur = T[L].currency;
  const base = { lang: L, align, valign: 'middle', color: pal.ink, shadow: { color: pal.shadow, blur: 0.35 } };
  const pill = (id, zone, text, t0, fill, ink) => ({ ...base, id, zone, text, font: F.display, size: 0.04, tracking: L === 'zh' ? 0.08 : 0.02, maxLines: 1, in: [t0, t0 + 0.5], box: { fill, color: ink, pad: 0.55, radius: 0.5 }, shadow: null });
  if (v.promo === '1111') {
    const it = ITEMS[story.pick];
    return [
      { ...pill('ribbon', 'line1', P.pick, a, RED, '#ffffff'), box: { fill: RED, color: '#ffffff', pad: 0.45, radius: 0.15 } },
      { ...base, id: 'pick', zone: 'line2', text: it.name[L], font: F.display, size: 0.056, min: MODEL_MIN * 0.056, maxLines: 1, tracking: L === 'zh' ? 0.08 : 0, in: [a + 0.2, a + 0.6], story: 'pick' },
      { ...base, id: 'price', zone: 'line3', text: `${P.deal} ${money(it.deal[cur], L)}`, font: F.display, size: 0.075, lineHeight: 1.1, maxLines: 1, color: RED, in: [a + 0.4, a + 0.8], pop: true },
      { ...base, id: 'was', zone: 'line4', text: `${P.was} ${money(it.price[cur], L)}`, font: F.body, size: 0.036, maxLines: 1, in: [a + 0.7, a + 1.1], strike: true, color: pal.soft },
    ];
  }
  if (v.promo === 'launch') return [
    pill('ribbon', 'line1', P.launch, a, pal.accent, pal.ctaInk),
    { ...base, id: 'coupon', zone: 'line2', text: P.coupon, font: F.display, size: 0.05, maxLines: 1, tracking: L === 'zh' ? 0.06 : 0, in: [a + 0.3, a + 0.8] },
    pill('cta', 'line3', P.cta, a + 0.6, pal.cta, pal.ctaInk),
  ];
  return [
    { ...base, id: 'tagline', zone: 'line1', text: T[L].tagline, font: F.display, size: 0.05, maxLines: 1, tracking: L === 'zh' ? 0.12 : 0, in: [a, a + 0.6] },
    pill('cta', 'line2', T[L].cta, a + 0.5, pal.cta, pal.ctaInk),
  ];
}
