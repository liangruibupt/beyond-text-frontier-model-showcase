// captions.js — 每个镜头的字幕图层（引擎在后期之后叠上去，不进玻璃折射）和这一变体要加载的字体
// 片尾卡的三种活动：none（标语 + 下载按钮）、launch（新主题上线 + 首发赠品 + 按钮）、1111（双11 价签：到手价、划掉的日常价）
import { FONTS, CAPTIONS, T, PROMO_T, CLOCK, SONG, screenText, priceOf, themeOf } from './copy.js';

export const RED = '#e1251b';
const alignOf = ar => (ar === '16x9' ? 'left' : 'center');

function endLayers(v, k, base) {
  const L = v.lang, F = FONTS[L], P = PROMO_T[L], $ = priceOf(L), [ctaFill, ctaInk] = k.cta;
  const pill = (id, zone, text, t0, fill, ink) => ({ ...base, id, zone, text, font: F.display, size: 0.04, tracking: L === 'zh' ? 0.08 : 0.02, maxLines: 1, in: [t0, t0 + 0.5], box: { fill, color: ink, pad: 0.55, radius: 0.5 }, shadow: null });
  const head = [
    { ...base, id: 'logo', zone: 'logo', text: T[L].logo, font: F.display, size: 0.1, tracking: L === 'zh' ? 0.3 : 0.16, maxLines: 1, in: [0.45, 0.95] },
    { ...base, id: 'brand', zone: 'brand', text: T[L].brand(k), font: F.body, size: 0.036, tracking: 0.04, maxLines: 1, in: [0.7, 1.2] },
  ];
  if (v.promo === '1111') return [...head,
    { ...pill('ribbon', 'line1', P.ribbon, 1.0, RED, '#ffffff'), box: { fill: RED, color: '#ffffff', pad: 0.45, radius: 0.15 } },
    { ...base, id: 'price', zone: 'line2', text: `${P.deal} ${$.deal}`, font: F.display, size: 0.085, lineHeight: 1.1, maxLines: 1, in: [1.2, 1.6], pop: true },
    { ...base, id: 'was', zone: 'line3', text: `${P.was} ${$.was}`, font: F.body, size: 0.038, maxLines: 1, in: [1.5, 1.9], strike: true, alpha: 0.8 },
  ];
  if (v.promo === 'launch') return [...head,
    pill('ribbon', 'line1', P.launch, 1.0, ctaFill, ctaInk),
    { ...base, id: 'gift', zone: 'line2', text: P.gift, font: F.body, size: 0.044, maxLines: 1, in: [1.2, 1.7] },
    pill('cta', 'line3', T[L].cta, 1.5, ctaFill, ctaInk),
  ];
  return [...head,
    { ...base, id: 'tagline', zone: 'tag', text: T[L].tagline, font: F.display, size: 0.05, tracking: L === 'zh' ? 0.12 : 0, maxLines: 1, in: [1.0, 1.5] },
    pill('cta', 'cta', T[L].cta, 1.4, ctaFill, ctaInk),
  ];
}

/** 镜头 s（name、from）的字幕图层；6 秒版只在片尾出字，前两段一闪而过，靠配音 */
export function layersFor(v, s) {
  const k = themeOf(v), L = v.lang;
  const base = { lang: L, align: 'center', valign: 'middle', color: k.ink, shadow: { color: k.shadow, blur: 0.4 } };
  if (s.name === 'end') return endLayers(v, k, base);
  if (v.cut === 6 && s.name !== 'end') return [];
  return [{ ...base, id: 'cap', zone: 'cap', text: CAPTIONS[L][s.name], font: FONTS[L].display, size: 0.05, tracking: L === 'zh' ? 0.12 : 0, maxLines: 2, align: alignOf(v.ar), in: [s.from + 0.3, s.from + 0.8], out: [s.dur - 0.35, s.dur - 0.05] }];
}

/** 这一变体要画的每种字体及其全部字符：字幕、片尾卡，加上画在屏幕上的时钟、日期和小组件 */
export function fontsFor(v) {
  const k = themeOf(v), L = v.lang, F = FONTS[L], P = PROMO_T[L], $ = priceOf(L), S = screenText(v);
  const screen = Object.values(S).join('');
  const byFont = new Map();
  const add = (f, s) => { const key = `${f.weight} ${f.family}`; byFont.set(key, { ...f, text: (byFont.get(key)?.text ?? '') + s }); };
  add(F.display, Object.values(CAPTIONS[L]).join('') + T[L].logo + T[L].tagline + T[L].cta + P.ribbon + P.launch + `${P.deal} ${$.deal}` + screen);
  add(F.body, T[L].brand(k) + P.gift + `${P.was} ${$.was}` + screen);
  add(FONTS.en.display, SONG.title); add(FONTS.en.body, SONG.artist);   // 音乐小组件的歌名、歌手中文版也用 Inter
  add(FONTS.clock, `${CLOCK.hour}:${CLOCK.from}${CLOCK.to}0123456789` + S.temp + S.day + S.time + SONG.at + SONG.left);   // 时钟、气温、日期数字、歌曲进度
  return [...byFont.values()].map(f => ({ ...f, text: [...new Set(f.text)].join('') }));
}
