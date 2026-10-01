// captions.js — 各镜头的字幕图层（纯数据）：文字、字体、区、字号（画面短边比例）、入场 / 退场（镜头本地秒）
// 入场时段相对 s.from（这一条剪辑里镜头的起始本地时间），所以 6 秒版从中段切入的镜头字幕照样完整入场
import { CUTS } from './meta.js';
import { FLAVORS } from './flavors.js';
import { T, FONTS } from './copy.js';
import { promoLayers } from './promos.js';
import { STYLES } from './styles.js';

/** 竖排：每个字一行（标点去掉），放进一条窄高的区里 */
const vert = s => [...s.replace(/[，。、,.]/g, '')].join('\n');

/** s = { name, from, dur, row } → 图层数组 */
export function layersFor(v, s) {
  const k = FLAVORS[v.flavor], L = v.lang, S = STYLES[v.flavor], C = S.caption, F = S.fonts[L], pal = k.palette, a = s.from ?? 0, align = s.row?.align ?? 'center';
  const zt = x => (L === 'zh' ? Math.max(0.06, C.tracking) : Math.min(C.tracking, 0.08)) * x;   // 中文按风格加字距；英文字距收着
  const base = { lang: L, align, valign: 'top', color: pal.ink, shadow: C.glow ? { color: C.glow, blur: 0.5 } : null };
  const sticker = C.box === 'sticker' ? { box: { fill: C.sticker, color: C.stickerInk, pad: 0.5, radius: 0.35 }, pop: true } : {};
  const fade = C.fadeOut && s.dur ? { out: [a + s.dur - 0.6, a + s.dur - 0.15] } : {};   // 芋泥：每句字幕在镜头末尾淡出（片尾卡不淡）
  const up = C.vertical && L === 'zh' && s.row?.zones?.hookV1;                           // 茉莉：16:9 中文竖排，从右往左两列
  switch (s.name) {
    case 'pearls': {
      if (up) {
        const [c1, c2] = k.image.zh.split('，');
        const col = (id, zone, text, t0) => ({ ...base, id, zone, text: vert(text), font: F.display, size: 0.056, tracking: 0, lineHeight: 1.18, maxLines: 8, align: 'center', in: [a + t0, a + t0 + 0.6] });
        return [col('hook', 'hookV1', c1, 0.35), col('hook2', 'hookV2', c2, 0.75)];
      }
      return [{ ...base, ...sticker, ...fade, id: 'hook', zone: 'hook', text: k.image[L], font: F.display, size: L === 'zh' ? 0.056 : 0.05, tracking: zt(1), lineHeight: 1.3, maxLines: 2, in: [a + 0.35, a + 0.95] }];
    }
    case 'hero': return [
      up
        ? { ...base, id: 'title', zone: 'titleV', text: vert(k.name.zh), font: F.display, size: 0.08, tracking: 0, lineHeight: 1.12, maxLines: 6, align: 'center', in: [a + 0.3, a + 1.1] }
        : { ...base, ...sticker, ...fade, id: 'title', zone: 'title', text: k.name[L], font: F.display, size: L === 'zh' ? 0.085 : 0.07, tracking: zt(1.2), lineHeight: 1.15, maxLines: 2, in: [a + 0.3, a + 0.9] },
      { ...base, ...fade, id: 'sub', zone: up ? 'subV' : 'sub', lang: 'en', text: 'BOCHA', font: S.fonts.brand, size: 0.04, tracking: 0.3, color: pal.soft, maxLines: 1, in: [a + 0.6, a + 1.2] },
    ];
    case 'straw': return [
      { ...base, ...sticker, ...fade, id: 'parts', zone: 'parts', text: k.parts[L].join(T[L].dot), font: F.body, size: L === 'zh' ? 0.046 : 0.042, tracking: zt(0.6), lineHeight: 1.3, maxLines: 2, in: [a + 0.9, a + 1.4] },
    ];
    case 'end': return [
      { ...base, id: 'logo', zone: 'logo', lang: 'zh', text: '啵茶', font: S.fonts.zh.display, size: 0.1, tracking: 0.2, lineHeight: 1.05, maxLines: 1, in: [a, a + 0.5], ...(C.box === 'sticker' ? { pop: true } : {}) },
      { ...base, id: 'brand', zone: 'brand', lang: 'en', text: 'BOCHA', font: S.fonts.brand, size: 0.036, tracking: 0.45, color: pal.soft, maxLines: 1, in: [a + 0.2, a + 0.7] },
      ...promoLayers(v, { a: a + 0.3, align, pal, fonts: S.fonts, glow: base.shadow }),
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
