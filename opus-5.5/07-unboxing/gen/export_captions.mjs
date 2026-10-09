import { ITEMS } from './items.js';
import { voLines, T } from './copy.js';
import fs from 'node:fs';
const out = {};
for (const [item, k] of Object.entries(ITEMS)) {
  out[item] = {
    name: k.name, caps: k.caps, hook: k.hook,
    palette: { ink: k.palette.ink, accent: k.palette.accent, cta: k.palette.cta, ctaInk: k.palette.ctaInk, soft: k.palette.soft },
    deal: k.deal, price: k.price,
    tagline: { zh: T.zh.tagline, en: T.en.tagline }, cta: { zh: T.zh.cta, en: T.en.cta },
    vo: {
      '15_zh_none': voLines({ item, lang: 'zh', cut: 15, promo: 'none', vo: 'on' }),
      '15_en_launch': voLines({ item, lang: 'en', cut: 15, promo: 'launch', vo: 'on' }),
      '6_zh_1111': voLines({ item, lang: 'zh', cut: 6, promo: '1111', vo: 'on' }),
    },
  };
}
fs.writeFileSync(new URL('./captions.json', import.meta.url), JSON.stringify(out, null, 2));
console.log('captions.json: 3 groups x', Object.keys(out).length, 'items');
