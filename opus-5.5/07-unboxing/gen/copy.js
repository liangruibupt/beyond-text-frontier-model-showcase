// copy.js — 07 文案：配音台词与时段（纯数据）。数字念成汉字/英文单词（Kokoro 读阿拉伯数字不稳）。
import { ITEMS } from './items.js';

export const VOICE = { zh: 'zm_yunxi', en: 'bf_emma' };
export const SPEED = { zh: 1, en: 1 };
export const T = {
  zh: { tagline: '开物，为开启而生。', cta: '立即选购' },
  en: { tagline: 'KAIWU. Made for the open.', cta: 'Shop now' },
};

// 整数念法（价格都是整数）
const ZH = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
export function sayNum(n, lang) {
  if (lang !== 'zh') return String(n);
  const units = ['', '十', '百', '千'], groups = ['', '万', '亿'];
  if (n === 0) return '零';
  let s = '', g = 0;
  while (n > 0) {
    let part = n % 10000, chunk = '', u = 0, zero = false, buf = '';
    while (part > 0) {
      const d = part % 10;
      if (d === 0) { zero = true; } else { buf = ZH[d] + units[u] + (zero ? '' : '') + buf; zero = false; }
      part = Math.floor(part / 10); u++;
    }
    s = buf + groups[g] + s; n = Math.floor(n / 10000); g++;
  }
  return s.replace(/^一十/, '十');
}

// 时段（成片秒）[开始, 最长]
export function slots(cut) {
  if (cut === 6) return { one: [1.9, 3.4] };
  return { hook: [0.4, 2.6], hero: [7.6, 2.4], end: [12.3, 2.3] };
}

const money = (n, lang) => (lang === 'zh' ? `${sayNum(n, 'zh')}元` : `${n} dollars`);
const END = {
  zh: { none: () => '开物，为开启而生。', 1111: (k, d) => `双十一，到手${money(d, 'zh')}。`, launch: k => `开物新品，${k.name.say.zh}。` },
  en: { none: () => 'KAIWU. Made for the open.', 1111: (k, d) => `Double Eleven: just ${money(d, 'en')}.`, launch: k => `New from KAIWU: ${k.name.say.en}.` },
};
const ONE = {
  zh: { none: k => `开物${k.name.say.zh}，为开启而生。`, 1111: (k, d) => `开物${k.name.say.zh}，双十一到手${money(d, 'zh')}。`, launch: k => `开物新品，${k.name.say.zh}。` },
  en: { none: k => `KAIWU ${k.name.say.en}. Made for the open.`, 1111: (k, d) => `${k.name.say.en}, Double Eleven, ${money(d, 'en')}.`, launch: k => `New from KAIWU: ${k.name.say.en}.` },
};

export function voLines(v) {
  if (v.vo === 'off') return [];
  const k = ITEMS[v.item], L = v.lang, cur = L === 'zh' ? 'CNY' : 'USD', d = k.deal[cur], voice = VOICE[L], S = slots(v.cut);
  const line = (slot, key, text) => { const [at, max] = S[slot]; return { id: `${v.item}_${L}_${v.cut}_${key}`, text, voice, speed: SPEED[L], at, max }; };
  if (v.cut === 6) return [line('one', `one_${v.promo}`, ONE[L][v.promo](k, d))];
  return [line('hook', 'hook', k.hook[L]), line('hero', 'hero', k.hero[L]), line('end', `end_${v.promo}`, END[L][v.promo](k, d))];
}
