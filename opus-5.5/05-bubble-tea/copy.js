// copy.js — 文案：字体、界面用语、价格、配音台词与时段（纯数据）
// 配音里的数字一律写成汉字 / 英文单词：Kokoro 直接读阿拉伯数字不稳定
import { FLAVORS } from './flavors.js';
import { sayNum } from '../factory/engine/say.js';

export const FONTS = {
  zh: { display: { family: 'Noto Sans SC', weight: 900, fallback: 'sans-serif' }, body: { family: 'Noto Sans SC', weight: 500, fallback: 'sans-serif' } },
  en: { display: { family: 'Fredoka', weight: 700, fallback: 'sans-serif' }, body: { family: 'Fredoka', weight: 500, fallback: 'sans-serif' } },
  brand: { family: 'Fredoka', weight: 700, fallback: 'sans-serif' },
  num: { family: 'Noto Sans SC', weight: 900, fallback: 'sans-serif' },
};
export const T = {
  zh: { brand: '啵茶', sub: '啵茶 · BOCHA', tagline: '啵一口，就上瘾', cta: '立即下单', currency: 'CNY', dot: ' · ' },
  en: { brand: 'BOCHA', sub: 'BOCHA', tagline: "One sip, and you're hooked", cta: 'Order now', currency: 'USD', dot: ' · ' },
};
export const money = (n, lang) => (lang === 'zh' ? `¥${n}` : `$${n}`);
export { sayNum };

// ── 配音 ──
// 用户定的音色（2026-09-30）：中文 zf_xiaoyi，英文 af_heart。已部署的 kokoro-tts:live 装着 Kokoro-82M 的全部音色
export const VOICE = { zh: 'zf_xiaoyi', en: 'af_heart' };
export const AUDITION = { zh: ['zf_xiaoyi'], en: ['af_heart'] };
export const SPEED = { zh: 1, en: 1 };
// 时段（成片秒）：[开始, 最长]；每句在成片最后 0.3 秒的淡出之前念完
export const SLOTS = { 15: { hook: [0.4, 2.3], hero: [6.3, 2.4], end: [12.3, 2.3] }, 6: { one: [1.9, 3.4] } };

// 双11：画面写 "Double 11"，配音念 "Double Eleven"，不用 "11.11" / "Eleven-eleven"
const END = {
  zh: { none: () => '啵一口，就上瘾。', 1111: (k, d) => `双十一，到手${d}元。`, launch: k => `啵茶新品，${k.name.zh}首发。` },
  en: { none: () => "One sip, and you're hooked.", 1111: (k, d) => `Double Eleven: just ${d} dollars.`, launch: k => `New from Bocha: ${k.name.en}.` },
};
const ONE = {
  zh: { none: k => `啵茶${k.name.zh}，啵一口就上瘾。`, 1111: (k, d) => `啵茶${k.name.zh}，双十一到手${d}元。`, launch: k => `啵茶新品，${k.name.zh}首发。` },
  en: { none: k => `Bocha ${k.name.en}. One sip, and you're hooked.`, 1111: (k, d) => `Bocha ${k.name.en}, Double Eleven, ${d} dollars.`, launch: k => `New from Bocha: ${k.name.en}.` },
};

/** 变体 → 配音台词 [{ id, text, voice, speed, at, max }]；同一 id 在所有变体里文字相同 */
export function voLines(v) {
  if (v.vo === 'off') return [];
  const k = FLAVORS[v.flavor], L = v.lang, d = sayNum(k.deal[T[L].currency], L), voice = VOICE[L];
  const line = (slot, key, text) => { const [at, max] = SLOTS[v.cut][slot]; return { id: `${v.flavor}_${L}_${v.cut}_${key}`, text, voice, speed: SPEED[L], at, max }; };
  if (v.cut === 6) return [line('one', `one_${v.promo}`, ONE[L][v.promo](k, d))];
  return [
    line('hook', 'hook', L === 'zh' ? `${k.image.zh}。` : `${k.image.en}.`),
    line('hero', 'hero', L === 'zh' ? `啵茶${k.name.zh}。` : `Bocha ${k.name.en}.`),
    line('end', `end_${v.promo}`, END[L][v.promo](k, d)),
  ];
}
