// promos.js — 片尾卡的三种预设：none（标语 + 立即抢）、1111（双11 价签）、launch（新品首发）
// 价格 / 文案从商品、语言表里取；图层放在 end 镜头的 line1–line3 三个区（照 03 的 promoLayers）
// 1:1 双11 价签照 03：到手价 0.075、划掉的日常价 0.038、「双11 狂欢价」丝带 0.042（分镜 §C），停够 2.5 秒以上
import { ITEMS, RED } from './items.js';
import { T, FONTS, money } from './copy.js';

export const PROMO_T = {
  zh: { ribbon: '双11 狂欢价', deal: '到手价', was: '日常价', launch: '新品首发', gift: '直播间专享' },
  en: { ribbon: 'Double 11 Deal', deal: 'Now', was: 'Was', launch: 'New Arrival', gift: 'Live-room only' },
};

/** a = 入场起点（镜头本地秒），pal = { ink, soft, accent, cta, ctaInk } 商品配色，zs = 区名后缀（AI 16:9 用左半的 _l 区） */
export function promoLayers(v, { a = 0, align = 'center', pal, zs = '' }) {
  const it = ITEMS[v.item], L = v.lang, P = PROMO_T[L], F = FONTS[L], cur = T[L].currency;
  const base = { lang: L, align, valign: 'middle', color: pal.ink, shadow: { color: pal.shadow, blur: 0.35 } };
  const pill = (id, zone, text, t0, fill, ink) => ({ ...base, id, zone: zone + zs, text, font: FONTS.num, size: 0.042, tracking: 0.04, in: [t0, t0 + 0.5], box: { fill, color: ink, pad: 0.5, radius: 0.5 }, shadow: null });
  if (v.promo === '1111') return [
    { ...pill('ribbon', 'line1', P.ribbon, a, RED, '#ffffff'), size: 0.042, box: { fill: RED, color: '#ffffff', pad: 0.45, radius: 0.15 } },
    { ...base, id: 'price', zone: `line2${zs}`, text: `${P.deal} ${money(it.deal[cur], L)}`, font: FONTS.num, size: 0.075, lineHeight: 1.1, in: [a + 0.3, a + 0.7], pop: true },
    { ...base, id: 'was', zone: `line3${zs}`, text: `${P.was} ${money(it.price[cur], L)}`, font: FONTS.num, size: 0.038, in: [a + 0.6, a + 1.0], strike: true, color: pal.soft },
  ];
  if (v.promo === 'launch') return [
    pill('ribbon', 'line1', P.launch, a, pal.accent, pal.ctaInk),
    { ...base, id: 'gift', zone: `line2${zs}`, text: P.gift, font: F.body, size: 0.046, tracking: 0.03, in: [a + 0.3, a + 0.8] },
    pill('cta', 'line3', T[L].cta, a + 0.6, pal.cta, pal.ctaInk),
  ];
  return [
    { ...base, id: 'tagline', zone: `line1${zs}`, text: T[L].tagline, font: F.display, size: 0.046, tracking: L === 'zh' ? 0.12 : 0.02, maxLines: 2, in: [a, a + 0.6] },
    pill('cta', 'line2', T[L].cta, a + 0.5, pal.cta, pal.ctaInk),
  ];
}
