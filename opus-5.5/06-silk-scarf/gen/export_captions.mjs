import { SCARVES } from '../scarves.js';
import { voLines } from '../copy.js';
import fs from 'node:fs';
const out = {};
for (const [scarf, k] of Object.entries(SCARVES)) {
  out[scarf] = {
    name: k.name, caps: k.caps, hook: k.hook,
    palette: { ink: k.palette.ink, accent: k.palette.accent, cta: k.palette.cta, ctaInk: k.palette.ctaInk },
    deal: k.deal, price: k.price,
    vo15_zh: voLines({ scarf, lang: 'zh', cut: 15, promo: 'none', vo: 'on' }),
  };
}
fs.writeFileSync(new URL('./captions.json', import.meta.url), JSON.stringify(out, null, 2));
console.log('captions.json written; scarves:', Object.keys(out).join(','));
