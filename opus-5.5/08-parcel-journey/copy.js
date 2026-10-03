// copy.js — 文案：字体、界面用语、价格、配音台词与时段（纯数据，浏览器与 Node 测试共用）
// 配音里的数字一律写成汉字 / 英文单词：Kokoro 直接读阿拉伯数字不稳定。音色沿用 04 有集：中文 zm_yunjian，英文 am_michael
import { ITEMS, baseItem, isBeans } from './items.js';
import { sayNum } from '../factory/engine/say.js';

export const FONTS = {
  zh: { display: { family: 'Noto Sans SC', weight: 900, fallback: 'sans-serif' }, body: { family: 'Noto Sans SC', weight: 500, fallback: 'sans-serif' } },
  en: { display: { family: 'Fredoka', weight: 700, fallback: 'sans-serif' }, body: { family: 'Fredoka', weight: 500, fallback: 'sans-serif' } },
  brand: { family: 'Fredoka', weight: 700, fallback: 'sans-serif' },     // 有集 Youji 的拉丁 logo
  num: { family: 'Noto Sans SC', weight: 900, fallback: 'sans-serif' },  // 价签上的数字
};

export const T = {
  zh: { brand: '有集', sub: '有集 · Youji', tagline: '有集，次次都次日达', cta: '立即下单', currency: 'CNY', dot: ' · ', nextday: '次日达' },
  en: { brand: 'Youji', sub: 'Youji', tagline: 'Youji. Tomorrow, every time.', cta: 'Order now', currency: 'USD', dot: ' · ', nextday: 'Next Day' },
};
export const money = (n, lang) => (lang === 'zh' ? `¥${n}` : `$${n}`);
export { sayNum };

// ── 配音 ──
// 音色沿用 04 有集：中文 zm_yunjian，英文 am_michael（同一品牌听起来是同一个人）
export const VOICE = { zh: 'zm_yunjian', en: 'am_michael' };
export const AUDITION = { zh: ['zm_yunjian'], en: ['am_michael'] };
export const SPEED = { zh: 1, en: 1 };

// §E 时段（成片秒）：[开始, 最长]；句子都在 14.7 s 前念完，6 秒版在 5.7 s 前
export const SLOTS = {
  15: { hook: [0.3, 1.7], robots: [2.0, 2.6], route: [7.0, 2.4], door: [10.8, 2.0], end: [12.9, 1.8] },   // 片尾句提前 0.3 s 起念：品牌句在 1.5 s 里放不下
  6: { one: [2.0, 3.6] },
};

// 15 秒版四句旁白（§E），同一 id 文字在所有变体里相同（不随商品 / 促销变）
const NARR = {
  zh: { hook: '你点下单的那一秒，', robots: '几十台机器人就动了起来。', route: '打包、分拣，连夜出发，', door: '天一亮，就到你家门口。' },
  en: { hook: 'The second you tap order,', robots: 'dozens of robots get moving.', route: 'Packed, sorted, out overnight,', door: 'and at your door by sunrise.' },
};
// 片尾句：none 收尾、launch 新品（§E）；只有 one_1111（6 秒）里的商品名和价格随商品变
const END = {
  zh: { none: () => '有集，次次都次日达。', launch: () => '有集次日达，上新了。', 1111: () => '有集，次次都次日达。' },
  en: { none: () => 'Youji. Tomorrow, every time.', launch: () => 'Youji Next Day is here.', 1111: () => 'Youji. Tomorrow, every time.' },
};
// 画面写 "Double 11"，配音念 "Double Eleven"。数字用 sayNum 转成汉字 / 英文单词
const ONE = {
  zh: (it, d) => `双十一，${it.one.zh}${sayNum(d, 'zh')}元，明天就到。`,
  en: (it, d) => `Double Eleven: ${it.one.en}, ${sayNum(d, 'en')} dollars, here tomorrow.`,
};

/** 变体 → 配音台词 [{ id, text, voice, speed, at, max }]；vo off → []。同一 id 在所有变体里文字相同 */
export function voLines(v) {
  if (v.vo === 'off') return [];
  const it = ITEMS[v.item], L = v.lang, voice = VOICE[L], d = it.deal[T[L].currency];
  if (isBeans(v.item)) return beansLines(v, it, d, L, voice);
  const line = (slot, key, text) => { const [at, max] = SLOTS[v.cut][slot]; return { id: `${baseItem(v.item)}_${L}_${v.cut}_${key}`, text, voice, speed: SPEED[L], at, max }; };   // lantern-ai 复用 lantern_* 配音
  if (v.cut === 6) return [line('one', `one_${v.promo}`, ONE[L](it, d))];
  return [
    line('hook', 'hook', NARR[L].hook),
    line('robots', 'robots', NARR[L].robots),
    line('route', 'route', NARR[L].route),
    line('door', 'door', NARR[L].door),
    line('end', `end_${v.promo}`, END[L][v.promo](it, d)),
  ];
}

// ── 瑰夏咖啡豆（分镜 v2 §四）：三句旁白 + 片尾（同上）；6 秒版同一句双十一 ──
export const BEANS_SLOTS = {
  15: { roast: [0.4, 2.6], sealed: [5.3, 2.4], cup: [10.2, 2.4], end: [12.9, 1.8] },
  6: { one: [2.0, 3.6] },
};
const BEANS_NARR = {
  zh: { roast: '今天早上，刚烘好的瑰夏，', sealed: '当天封袋，当天发出，', cup: '明天一早，就在你的杯里。' },
  en: { roast: 'Geisha, roasted this morning,', sealed: 'sealed and shipped the same day,', cup: 'and in your cup tomorrow.' },
};
function beansLines(v, it, d, L, voice) {
  const base = baseItem(v.item);   // beans-ai 复用 beans_* 的配音文件，不另生成
  const line = (slot, key, text) => { const [at, max] = BEANS_SLOTS[v.cut][slot]; return { id: `${base}_${L}_${v.cut}_${key}`, text, voice, speed: SPEED[L], at, max }; };
  if (v.cut === 6) return [line('one', `one_${v.promo}`, ONE[L](it, d))];
  return [
    line('roast', 'b_roast', BEANS_NARR[L].roast),
    line('sealed', 'b_sealed', BEANS_NARR[L].sealed),
    line('cup', 'b_cup', BEANS_NARR[L].cup),
    line('end', `end_${v.promo}`, END[L][v.promo](it, d)),
  ];
}
