// copy.js — 文案：字体、界面用语、价格、配音台词与时段（纯数据）
// 配音里的数字一律写成汉字 / 英文单词：Kokoro 直接读阿拉伯数字不稳定
import { SCARVES, sayNum } from './scarves.js';
import { BOARDS } from './meta.js';

export const FONTS = {
  zh: { display: { family: 'Noto Serif SC', weight: 900, fallback: 'serif' }, body: { family: 'Noto Serif SC', weight: 600, fallback: 'serif' } },
  en: { display: { family: 'Cormorant Garamond', weight: 600, fallback: 'serif' }, body: { family: 'Cormorant Garamond', weight: 600, fallback: 'serif' } },
  brand: { family: 'Cormorant Garamond', weight: 600, fallback: 'serif' },
  num: { family: 'Noto Serif SC', weight: 900, fallback: 'serif' },
};
export const T = {
  zh: { brand: '锦时', sub: '锦时 · JINSHI', tagline: '把纹样戴在身上', cta: '立即选购', currency: 'CNY', dot: ' · ' },
  en: { brand: 'JINSHI', sub: 'JINSHI', tagline: 'Heritage you can wear', cta: 'Shop now', currency: 'USD', dot: ' · ' },
};
export const money = (n, lang) => (lang === 'zh' ? `¥${n}` : `$${n}`);
export { sayNum };

// ── 配音 ──
// 声音（2026-10-01 草案建议，待用户定）：中文 zf_xiaoxiao，英文 bf_emma（英式）
export const VOICE = { zh: 'zf_xiaoxiao', en: 'bf_emma' };
export const AUDITION = { zh: ['zf_xiaoxiao'], en: ['bf_emma'] };
export const SPEED = { zh: 1, en: 1 };
// 时段（成片秒）：[开始, 最长]。hook 在开头；hero 跟着各款「落定」的那一拍（hits 里最后一个产品命中点 + 0.1）；end 在片尾卡
export function slots(scarf, cut) {
  if (cut === 6) return { one: [1.9, 3.4] };
  const h = BOARDS[scarf][15].hits, at = { dunhuang: h.land, songjin: h.fold, qinghua: h.gleam, yunhe: h.land }[scarf] - 1.4;
  return { hook: [0.4, 2.6], hero: [at, 2.4], end: [12.3, 2.3] };
}

// 双11：画面写 "Double 11"，配音念 "Double Eleven"
const END = {
  zh: { none: () => '锦时，把纹样戴在身上。', 1111: (k, d) => `双十一，到手${d}元。`, launch: k => `锦时新品，${k.name.say.zh}。` },
  en: { none: () => 'Jinshi. Heritage you can wear.', 1111: (k, d) => `Double Eleven: just ${d} dollars.`, launch: k => `New from Jinshi: ${k.name.say.en}.` },
};
const ONE = {
  zh: { none: k => `锦时${k.name.say.zh}，把纹样戴在身上。`, 1111: (k, d) => `锦时${k.name.say.zh}，双十一到手${d}元。`, launch: k => `锦时新品，${k.name.say.zh}。` },
  en: { none: k => `Jinshi ${k.name.say.en}. Heritage you can wear.`, 1111: (k, d) => `${k.name.say.en}, Double Eleven, ${d} dollars.`, launch: k => `New from Jinshi: ${k.name.say.en}.` },
};
const HERO = { zh: k => `${k.name.say.zh}，桑蚕丝方巾。`, en: k => `${k.name.say.en}, a mulberry silk square.` };

/** 变体 → 配音台词 [{ id, text, voice, speed, at, max }]；同一 id 在所有变体里文字相同 */
export function voLines(v) {
  if (v.vo === 'off') return [];
  const k = SCARVES[v.scarf], L = v.lang, d = sayNum(k.deal[T[L].currency], L), voice = VOICE[L], S = slots(v.scarf, v.cut);
  const line = (slot, key, text) => { const [at, max] = S[slot]; return { id: `${v.scarf}_${L}_${v.cut}_${key}`, text, voice, speed: SPEED[L], at, max }; };
  if (v.cut === 6) return [line('one', `one_${v.promo}`, ONE[L][v.promo](k, d))];
  return [line('hook', 'hook', k.hook[L]), line('hero', 'hero', HERO[L](k)), line('end', `end_${v.promo}`, END[L][v.promo](k, d))];
}
