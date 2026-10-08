import { SCARVES } from '../scarves.js';
import { voLines, T } from '../copy.js';
import fs from 'node:fs';
const out = {};
for (const [scarf, k] of Object.entries(SCARVES)) {
  const capEn = {}; for (const [sid, c] of Object.entries(k.caps)) capEn[sid] = c;
  out[scarf] = {
    name: k.name, caps: k.caps, hook: k.hook,
    palette: { ink: k.palette.ink, accent: k.palette.accent, cta: k.palette.cta, ctaInk: k.palette.ctaInk, soft: k.palette.soft },
    deal: k.deal, price: k.price,
    tagline: { zh: T.zh.tagline, en: T.en.tagline }, cta: { zh: T.zh.cta, en: T.en.cta },
    // 三组 gallery 变体的配音台词
    vo: {
      '15_zh_none': voLines({ scarf, lang: 'zh', cut: 15, promo: 'none', vo: 'on' }),
      '15_en_launch': voLines({ scarf, lang: 'en', cut: 15, promo: 'launch', vo: 'on' }),
      '6_zh_1111': voLines({ scarf, lang: 'zh', cut: 6, promo: '1111', vo: 'on' }),
    },
  };
}
fs.writeFileSync(new URL('./captions.json', import.meta.url), JSON.stringify(out, null, 2));
console.log('captions.json: 3 variant groups x', Object.keys(out).length, 'scarves');
