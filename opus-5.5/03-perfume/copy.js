// copy.js — 文案：字体、界面用语、价格、配音台词与时段（纯数据）
// 配音里的数字一律写成汉字 / 英文单词：Kokoro 直接读阿拉伯数字不稳定
import { SKUS } from './skus.js';
import { sayNum } from '../factory/engine/say.js';

export const FONTS = {
  zh: { display: { family: 'Noto Serif SC', weight: 600 }, body: { family: 'Noto Serif SC', weight: 500 } },
  en: { display: { family: 'Cormorant Garamond', weight: 600 }, body: { family: 'Cormorant Garamond', weight: 500 } },
  num: { family: 'Noto Sans SC', weight: 700, fallback: 'sans-serif' },
};
export const T = {
  zh: { sub: '闻境 · WENJING', tagline: '闻香 · 入境', edp: '50 ml · 浓香水', tiers: ['前调', '中调', '后调'], cta: '点击购买', currency: 'CNY' },
  en: { sub: 'WENJING', tagline: 'Breathe in. Step in.', edp: '50 ml · Eau de Parfum', tiers: ['TOP', 'HEART', 'BASE'], cta: 'Shop now', currency: 'USD' },
};
export const money = (n, lang) => (lang === 'zh' ? `¥${n}` : `$${n}`);

/** 0–99 999 → 读法（引擎的 say.js；从这里再导出，台词和测试照旧从 copy.js 取） */
export { sayNum };

// ── 配音 ──
// 声音必须是已部署的 Kokoro（aws-is-how/.../Kokoro/README.md）里有的：zh 只有 zm_*；en 有 am_*（美）/ bm_*（英）。没有 bf_*/af_*/zf_*
export const VOICE = { zh: 'zm_yunxi', en: 'am_michael' };            // 试听（node factory/vo.mjs 03-perfume --audition）后选定
export const AUDITION = { zh: ['zm_yunjian', 'zm_yunxi', 'zm_yunxia', 'zm_yunyang'], en: ['am_michael', 'am_fenrir', 'bm_george', 'bm_fable'] };
export const SPEED = { zh: 1, en: 1 };
// 时段（成片秒）：[开始, 最长]；每句在成片最后 0.3 秒的淡出之前念完
export const SLOTS = { 15: { hero: [4.6, 2.8], notes: [7.7, 2.6], end: [12.3, 2.4] }, 6: { one: [1.1, 3.7] } };

const END = {
  zh: { none: (k, d) => `闻境${k.name.zh}，闻香入境。`, 1111: (k, d) => `双十一，到手${d}元。`, launch: k => `闻境新品，${k.name.zh}首发。` },
  en: { none: k => `Wenjing ${k.name.en}. Breathe in.`, 1111: (k, d) => `Just ${d} dollars.`, launch: k => `New from Wenjing: ${k.name.en}.` },
};
const ONE = {
  zh: { none: k => `闻境${k.name.zh}，${k.image.zh}。`, 1111: (k, d) => `闻境${k.name.zh}，双十一到手${d}元。`, launch: k => `闻境新品，${k.name.zh}首发。` },
  en: { none: k => `Wenjing ${k.name.en}. ${k.image.en}.`, 1111: (k, d) => `Wenjing ${k.name.en}, now ${d} dollars.`, launch: k => `New from Wenjing: ${k.name.en}.` },
};

/** 变体 → 配音台词 [{ id, text, voice, speed, at, max }]；同一 id 在所有变体里文字相同 */
export function voLines(v) {
  if (v.vo === 'off') return [];
  const k = SKUS[v.sku], L = v.lang, d = sayNum(k.deal[T[L].currency], L), voice = k.voice?.[L] ?? VOICE[L];
  const line = (slot, key, text) => { const [at, max] = SLOTS[v.cut][slot]; return { id: `${v.sku}_${L}_${v.cut}_${key}`, text, voice, speed: SPEED[L], at, max }; };
  if (v.cut === 6) return [line('one', `one_${v.promo}`, ONE[L][v.promo](k, d))];
  const [n0, n1, n2] = k.notes[L];
  return [
    line('hero', 'hero', L === 'zh' ? `${k.image.zh}。` : `${k.image.en}.`),
    line('notes', 'notes', L === 'zh' ? `${n0}、${n1}、${n2}。` : `${n0}, ${n1}, ${n2}.`),
    line('end', `end_${v.promo}`, END[L][v.promo](k, d)),
  ];
}
