// promos.js — 片尾卡的三种预设（照 03 / 05 的 promoLayers）：none（标语 + 下单）、1111（双11 价签）、launch（新品首发）
// 价格从 items.js（即 04 目录）取，整数。图层放在 door 镜头的 line1–line3；画面写 "Double 11"，不用 "11.11"
import { ITEMS } from './items.js';
import { T, FONTS, money } from './copy.js';

export const PROMO_T = {
  zh: { ribbon: '双11 狂欢价', deal: '到手价', was: '日常价', launch: '新品首发', gift: '次日达 全场包邮' },
  en: { ribbon: 'Double 11 Deal', deal: 'Now', was: 'Was', launch: 'New Arrival', gift: 'Free next-day shipping' },
};
export const RED = '#e1251b';
export const ORANGE = '#f0820f';          // 有集橙

// 片尾配色（门口暖光下的卡片）：墨色文字、暖灰副色、橙色按钮
const PAL = { ink: '#2b2016', soft: '#8a7a66', accent: ORANGE, cta: ORANGE, ctaInk: '#ffffff', shadow: 'rgba(0,0,0,0.25)' };

/** a = 入场起点（镜头本地秒），align 跟构图行走 */
export function promoLayers(v, { a = 0, align = 'center', pal = PAL, fonts = FONTS, glow = { color: pal.shadow, blur: 0.35 } } = {}) {
  const it = ITEMS[v.item], L = v.lang, P = PROMO_T[L], F = fonts[L], cur = T[L].currency;
  const base = { lang: L, align, valign: 'middle', color: pal.ink, shadow: glow };
  const pill = (id, zone, text, t0, fill, ink) => ({ ...base, id, zone, text, font: F.display, size: 0.04, tracking: L === 'zh' ? 0.08 : 0.02, maxLines: 1, in: [t0, t0 + 0.5], box: { fill, color: ink, pad: 0.55, radius: 0.5 }, shadow: null });
  if (v.promo === '1111') return [
    { ...pill('ribbon', 'line1', P.ribbon, a, RED, '#ffffff'), size: 0.042, box: { fill: RED, color: '#ffffff', pad: 0.45, radius: 0.15 } },
    { ...base, id: 'price', zone: 'line2', text: `${P.deal} ${money(it.deal[cur], L)}`, font: FONTS.num, size: 0.075, lineHeight: 1.1, maxLines: 1, color: RED, in: [a + 0.3, a + 0.7], pop: true },
    { ...base, id: 'was', zone: 'line3', text: `${P.was} ${money(it.price[cur], L)}`, font: FONTS.num, size: 0.038, maxLines: 1, in: [a + 0.6, a + 1.0], strike: true, color: pal.soft },
  ];
  if (v.promo === 'launch') return [
    pill('ribbon', 'line1', P.launch, a, pal.accent, pal.ctaInk),
    { ...base, id: 'gift', zone: 'line2', text: P.gift, font: F.body, size: 0.046, tracking: L === 'zh' ? 0.06 : 0.01, maxLines: 1, in: [a + 0.3, a + 0.8] },
    pill('cta', 'line3', T[L].cta, a + 0.6, pal.cta, pal.ctaInk),
  ];
  return [
    { ...base, id: 'tagline', zone: 'line1', text: T[L].tagline, font: F.display, size: 0.048, tracking: L === 'zh' ? 0.1 : 0.01, maxLines: 2, in: [a, a + 0.6] },
    pill('cta', 'line2', T[L].cta, a + 0.5, pal.cta, pal.ctaInk),
  ];
}
