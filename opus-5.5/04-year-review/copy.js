// copy.js — 文案：字体、界面用语、价格、占位符的取值、配音模板与时段（纯数据）
// 模型写的字在 stories/<user>.json；这里是代码的那一半：品牌、标签、促销，以及填进占位符的数
// 配音里的数字一律写成汉字 / 英文单词（say.js）：Kokoro 直接读阿拉伯数字不稳定
import { USERS } from './users.js';
import { ITEMS } from './catalog.js';
import { statsFor, storyOf } from './facts.js';
import { sayNum, sayYear, sayMonth, MONTHS } from '../factory/engine/say.js';
import { fill } from '../factory/engine/story.js';

// 滚动的数字用 Inter 800（两种语言都是），字符子集总带上 0–9（captions.js 的 fontsFor）；价签跟着语言的标题字体走，中文价签有汉字
export const FONTS = {
  zh: { display: { family: 'Noto Sans SC', weight: 900, fallback: 'sans-serif' }, body: { family: 'Noto Sans SC', weight: 500, fallback: 'sans-serif' } },
  en: { display: { family: 'Inter', weight: 800, fallback: 'sans-serif' }, body: { family: 'Inter', weight: 500, fallback: 'sans-serif' } },
  num: { family: 'Inter', weight: 800, fallback: 'sans-serif' },
};
export const T = {
  zh: { of: (name, year) => `${name}的 ${year}`, sub: '有集年度购物报告', label: '年度称号', tagline: '记得你的每一次喜欢', cta: '查看完整报告', currency: 'CNY' },
  en: { of: (name, year) => `${name}'s ${year}`, sub: 'Your year on Youji', label: 'Your title of the year', tagline: 'Every like, remembered', cta: 'See your year', currency: 'USD' },
};
export const PROMO_T = {
  zh: { pick: '双11 为你推荐', deal: '到手价', was: '日常价', launch: '年度报告上线', coupon: '分享得 5 元券', cta: '查看我的' },
  en: { pick: 'Double 11 pick for you', deal: 'Now', was: 'Was', launch: 'Your Year in Review is here', coupon: 'Share it for a $5 coupon', cta: 'See yours' },
};
export const money = (n, lang) => (lang === 'zh' ? `¥${n}` : `$${n}`);

/**
 * 占位符的取值。screen 上屏：146、11月 / November、商品简称；spoken 配音：一百四十六、十一月、二零二六。
 * pick、deal 是推荐的商品和它的双11 到手价（配音模板用）
 */
export function valuesFor(u, lang, story) {
  const s = statsFor(u), name = USERS[u].name[lang], top = ITEMS[s.top.item].name[lang], m = s.busiest.month;
  const screen = { name, year: s.year, orders: s.orders, month: MONTHS[lang][m - 1], monthOrders: s.busiest.orders, top, repeat: s.top.repeat };
  const spoken = { name, year: sayYear(s.year, lang), orders: sayNum(s.orders, lang), month: sayMonth(m, lang), monthOrders: sayNum(s.busiest.orders, lang), top, repeat: sayNum(s.top.repeat, lang) };
  const it = story && ITEMS[story.pick];
  if (it) Object.assign(spoken, { pick: it.one[lang], deal: sayNum(it.deal[T[lang].currency], lang) });
  return { screen, spoken };
}

// ── 配音 ──
export const VOICE = { zh: 'zm_yunxi', en: 'bf_emma' };               // 03 的声音，先用着；试听（node factory/vo.mjs 04-year-review --audition）后再定
export const AUDITION = { zh: ['zf_xiaoxiao', 'zf_xiaoyi', 'zm_yunjian', 'zm_yunxi'], en: ['af_heart', 'bf_emma', 'am_michael', 'bm_george'] };
export const SPEED = { zh: 1, en: 1 };
// 时段（成片秒）：[开始, 最长]。intro 可以念进 months 的开头（最高的柱子 6.0 秒才亮），top 在 title 的闪白（10.5）之前念完，
// end 从 title 的最后一拍开始；每句在成片最后 0.3 秒的淡出之前念完
export const SLOTS = { 15: { intro: [0.3, 4.6], top: [7.55, 2.9], end: [11.9, 2.8] }, 6: { one: [0.5, 5.1] } };

// 模板（代码写的）：15 秒版片尾一句，6 秒版全片一句。15 秒版的双11 只念价格（商品名在卡片上），6 秒版念商品名；
// 推荐的商品不一定买过，所以说"为你挑的"，不说"你爱的"
export const END = {
  zh: { none: '有集，记得你的每一次喜欢。', launch: '有集年度报告，现已上线。', 1111: '双十一，到手{deal}元。' },
  en: { none: 'Youji. Every like, remembered.', launch: 'Your Youji Year in Review is here.', 1111: 'Double Eleven: just {deal} dollars.' },
};
export const ONE = {
  zh: { none: '{name}，你的这一年，有集都记得。', launch: '{name}，你的有集年度报告已上线。', 1111: '{name}，为你挑的{pick}，双十一到手{deal}元。' },
  en: { none: '{name}, Youji remembers your year.', launch: '{name}, your Youji Year in Review is here.', 1111: '{name}, your Double Eleven pick: {pick}, just {deal} dollars.' },
};

/** 变体 → 配音台词 [{ id, text, voice, speed, at, max }]；id 是 用户_语言_剪辑_句，同一 id 在所有变体里文字相同 */
export function voLines(v, story = storyOf(v.user)) {
  if (v.vo === 'off') return [];
  const L = v.lang, P = valuesFor(v.user, L, story).spoken, voice = USERS[v.user].voice?.[L] ?? VOICE[L];
  const line = (slot, key, text) => { const [at, max] = SLOTS[v.cut][slot]; return { id: `${v.user}_${L}_${v.cut}_${key}`, text, voice, speed: SPEED[L], at, max }; };
  if (v.cut === 6) return [line('one', `one_${v.promo}`, fill(ONE[L][v.promo], P))];
  return [
    line('intro', 'intro', fill(story.vo.intro[L], P)),
    line('top', 'top', fill(story.vo.top[L], P)),
    line('end', `end_${v.promo}`, fill(END[L][v.promo], P)),
  ];
}
