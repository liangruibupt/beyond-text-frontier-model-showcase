// copy.js — 文案：字体、界面上的字（小组件、时钟、日期）、字幕、片尾活动、价格格式（纯数据）
import { THEMES, PRICE } from './themes.js';
import { sayNum } from '../factory/engine/say.js';

export const FONTS = {
  zh: { display: { family: 'Noto Sans SC', weight: 700, fallback: 'sans-serif' }, body: { family: 'Noto Sans SC', weight: 500, fallback: 'sans-serif' } },
  en: { display: { family: 'Inter', weight: 700, fallback: 'sans-serif' }, body: { family: 'Inter', weight: 500, fallback: 'sans-serif' } },
  clock: { family: 'Inter', weight: 600, fallback: 'sans-serif' },
};
export const money = (n, lang) => (lang === 'zh' ? `¥${n}` : `$${n}`);
export const CURRENCY = { zh: 'CNY', en: 'USD' };

// 屏幕上的日期：双11 版停在 11 月 11 日（星期三），其余停在 9 月 29 日（星期二）；时钟 09:41，lens 镜头里翻到 09:42
export const CLOCK = { hour: '09', from: '41', to: '42' };
const DAY = {
  zh: { d929: { date: '9月29日 星期二', week: '星期二', day: '29', event: '新品发布' }, d1111: { date: '11月11日 星期三', week: '星期三', day: '11', event: '双11 开抢' } },
  en: { d929: { date: 'Tuesday, September 29', week: 'TUESDAY', day: '29', event: 'Launch' }, d1111: { date: 'Wednesday, November 11', week: 'WEDNESDAY', day: '11', event: 'Double 11' } },
};
const WIDGET = {
  zh: { city: '上海', temp: '22°', cond: '晴', range: '最高 26° 最低 17°', time: '10:00' },
  en: { city: 'Shanghai', temp: '22°', cond: 'Sunny', range: 'H:26°  L:17°', time: '10:00' },
};
export const SONG = { title: 'Glass Tide', artist: 'Mira Lane', at: '1:12', left: '-2:03' };

/** 这一变体屏幕上要画的全部字（界面画在画布上，字体同样要经引擎加载） */
export const screenText = v => ({ ...WIDGET[v.lang], ...DAY[v.lang][v.promo === '1111' ? 'd1111' : 'd929'] });

export const CAPTIONS = {
  zh: { wall: '光，有了形状', lens: '会流动的玻璃', flow: '融合，分开，像水一样', sweep: '每一处，都透着光' },
  en: { wall: 'Light, given shape', lens: 'Glass that flows', flow: 'Merging and parting, like water', sweep: 'Every corner, lit through' },
};

export const T = {
  zh: { logo: '琉光', brand: k => `液态玻璃主题 · ${k.name.zh}`, tagline: '让屏幕，流动起来', cta: '立即下载' },
  en: { logo: 'LIUGUANG', brand: k => `Liquid glass theme · ${k.name.en}`, tagline: 'Let your screen flow', cta: 'Get the theme' },
};
export const PROMO_T = {
  zh: { ribbon: '双11 限时价', deal: '到手价', was: '日常价', launch: '新主题上线', gift: '首发送全套小组件' },
  en: { ribbon: 'Double 11 deal', deal: 'Now', was: 'Was', launch: 'New theme', gift: 'Free widget pack at launch' },
};
export const priceOf = lang => ({ deal: money(PRICE.deal[CURRENCY[lang]], lang), was: money(PRICE.price[CURRENCY[lang]], lang) });
export const themeOf = v => THEMES[v.theme];

// ── 配音 ──
// 声音必须是已部署的 Kokoro 里有的：zh 只有 zm_*；en 有 am_*（美）/ bm_*（英）。没有 bf_*/af_*/zf_*（与 03 相同）
export const VOICE = { zh: 'zm_yunxi', en: 'am_michael' };            // 试听（node factory/vo.mjs 11-liquid-glass --audition）后再定
export const AUDITION = { zh: ['zm_yunjian', 'zm_yunxi', 'zm_yunxia', 'zm_yunyang'], en: ['am_michael', 'am_fenrir', 'bm_george', 'bm_fable'] };
export const SPEED = { zh: 1, en: 1 };
// 时段（成片秒）：[开始, 最长]。15 秒：透镜滑过时钟时报品牌，两滴相融时说「流动」，片尾一句；6 秒一句念完。每句在最后 0.3 秒的淡出之前念完
export const SLOTS = { 15: { hero: [3.3, 2.6], flow: [6.4, 2.8], end: [12.3, 2.4] }, 6: { one: [0.5, 4.6] } };

const dollars = (n, d) => `${d} dollar${n === 1 ? '' : 's'}`;
const HERO = { zh: '琉光，液态玻璃主题。', en: 'Liquid glass, for your screen.' };
const FLOW = { zh: '每一滴光，都会流动。', en: 'Every drop of light, in motion.' };
// 英文里双11 念作 Double Eleven
const END = {
  zh: { none: k => `琉光${k.name.zh}，让屏幕流动起来。`, 1111: (k, d) => `双十一，到手${d}元。`, launch: k => `琉光新主题，${k.name.zh}上线。` },
  en: { none: k => `Liuguang ${k.name.en}. Let your screen flow.`, 1111: (k, d, n) => `Double Eleven: just ${dollars(n, d)}.`, launch: k => `New from Liuguang: ${k.name.en}.` },
};
const ONE = {
  zh: { none: k => `琉光${k.name.zh}，会流动的玻璃。`, 1111: (k, d) => `琉光${k.name.zh}，双十一到手${d}元。`, launch: k => `琉光新主题，${k.name.zh}，现已上线。` },
  en: { none: k => `Liuguang ${k.name.en}: glass that flows.`, 1111: (k, d, n) => `Liuguang ${k.name.en}, Double Eleven, just ${dollars(n, d)}.`, launch: k => `New from Liuguang: ${k.name.en}. Out now.` },
};

/** 变体 → 配音台词 [{ id, text, voice, speed, at, max }]；同一 id 在所有变体里文字相同（前两句三款主题共用一条录音） */
export function voLines(v) {
  if (v.vo === 'off') return [];
  const k = THEMES[v.theme], L = v.lang, n = PRICE.deal[CURRENCY[L]], d = sayNum(n, L), voice = VOICE[L];
  const line = (slot, id, text) => { const [at, max] = SLOTS[v.cut][slot]; return { id: `${L}_${v.cut}_${id}`, text, voice, speed: SPEED[L], at, max }; };
  if (v.cut === 6) return [line('one', `one_${v.theme}_${v.promo}`, ONE[L][v.promo](k, d, n))];
  const end = v.promo === '1111' ? 'end_1111' : `end_${v.theme}_${v.promo}`;   // 双11 那句不提主题名：三款共用
  return [line('hero', 'hero', HERO[L]), line('flow', 'flow', FLOW[L]), line('end', end, END[L][v.promo](k, d, n))];
}
