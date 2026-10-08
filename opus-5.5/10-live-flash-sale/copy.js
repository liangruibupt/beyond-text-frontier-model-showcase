// copy.js — 文案：字体、界面用语、价格、配音台词与时段（纯数据，浏览器与 Node 测试共用）
// 配音里的数字一律写成汉字 / 英文单词（say.js）：Kokoro 直接读阿拉伯数字不稳定。
// 主播音色（分镜 §I 第 3 条，用户已批）：中文 zf_xiaoyi、英文 af_heart——年轻、有冲劲的直播腔。
import { ITEMS } from './items.js';
import { sayNum } from '../factory/engine/say.js';

export const FONTS = {
  zh: { display: { family: 'Noto Sans SC', weight: 900, fallback: 'sans-serif' }, body: { family: 'Noto Sans SC', weight: 500, fallback: 'sans-serif' } },
  en: { display: { family: 'Fredoka', weight: 700, fallback: 'sans-serif' }, body: { family: 'Fredoka', weight: 500, fallback: 'sans-serif' } },
  brand: { family: 'Fredoka', weight: 700, fallback: 'sans-serif' },     // 有集 Youji 的拉丁 logo
  num: { family: 'Noto Sans SC', weight: 900, fallback: 'sans-serif' },  // 价签 / 弹窗 / 库存 / 倒计时上的数字
};

export const T = {
  zh: { brand: '有集', live: '有集直播', liveTag: 'LIVE', tagline: '有集直播，天天有好价', cta: '立即抢', deal: '直播间秒杀价', cartDeal: '秒杀价', was: '日常价', link: '上链接！', soldout: '已抢光', couponed: '已领券', only: n => `仅剩 ${n} 件`, viewers: '在线', currency: 'CNY' },
  en: { brand: 'Youji', live: 'Youji Live', liveTag: 'LIVE', tagline: 'Youji Live, deals daily.', cta: 'Grab it', deal: 'Flash price', cartDeal: 'Flash', was: 'Was', link: 'Link is live!', soldout: 'SOLD OUT', couponed: 'Coupon got', only: n => `Only ${n} left`, viewers: 'watching', currency: 'USD' },
};
export const money = (n, lang) => (lang === 'zh' ? `¥${n}` : `$${n}`);
export { sayNum };

/** 在线人数展示：中文 12.8万人在看 / 英文 128K watching（取 chrome 组件给的整数，确定） */
export function viewersText(n, lang) {
  if (lang === 'zh') return `${(n / 10000).toFixed(1)}万人在看`;
  return `${(n / 1000).toFixed(0)}K watching`;
}

/** overlay 要画的全部短文案（随变体），一次性打包：overlay.draw(state, txt) 用 */
export function overlayText(v, viewers) {
  const it = ITEMS[v.item], L = v.lang, Tl = T[L], cur = Tl.currency;
  return {
    lang: L, live: Tl.live, viewers: viewersText(viewers, L), link: Tl.link,
    name: it.name[L], deal: Tl.cartDeal, priceStr: money(it.deal[cur], L), was: Tl.was, wasStr: money(it.price[cur], L), cta: Tl.cta,
    only: Tl.only(0), onlyFn: Tl.only, soldout: Tl.soldout, couponed: Tl.couponed,
  };
}

// ── 弹幕（手写的虚构评论，每条 4–10 个字，不用真实昵称、不用 emoji）──
// §E：弹幕是手写虚构评论。两种语言各一组，chrome/danmaku 组件按 rng 排车道与出现时间。
export const DANMAKU = {
  zh: ['这也太便宜了', '蹲一个秒杀', '求补货', '手慢无啊', '已拍已拍', '主播再降点', '抢到了！', '没抢到…', '链接在哪', '冲冲冲', '质量真的好', '回购第三次了', '划算到哭', '赶紧上库存'],
  en: ['way too cheap', 'waiting for the drop', 'restock please', 'blink and gone', 'ordered already', 'drop it lower', 'got one!', 'missed it…', 'where is the link', 'go go go', 'quality is real', 'my third buy', 'such a steal', 'more stock pls'],
};

// ── 配音（分镜 §E，主播口吻）──
// 倒计时数字只给音效、不让配音念（Kokoro 停顿对不准每一拍）；配音只喊落在 4.5 的「上链接」。
export const VOICE = { zh: 'zf_xiaoyi', en: 'af_heart' };
export const AUDITION = { zh: ['zf_xiaoyi'], en: ['af_heart'] };
export const SPEED = { zh: 1, en: 1 };

// §E 时段（成片秒）：[开始, 最长]。句子都在 14.7 s（6 秒版 5.7 s）前念完。
// 偏离 §E 两处（为留原分镜文案、又让 speechSec 的保守估计放得下，且仍在下一句 / 下一动作之前念完）：
//  - hook max 2.1 → 2.6：下一句 link 在 4.5，room 镜到 2.5，富余足够；
//  - price max 1.8 → 2.8：price 在 5.6 起，下一句 stock 在 10.6、cart 镜到 7.5，富余足够。
export const SLOTS = {
  15: { hook: [0.3, 2.6], link: [4.5, 0.9], price: [5.6, 2.8], stock: [10.6, 1.6], end: [12.8, 2.0] },
  6: { one: [2.3, 3.4] },
};

// 15 秒版的四句主播词（§E），同一 id 文字在所有变体里相同（hook / link / stock / end 不随商品变；price 随商品 + 价格变）
const HOOK = { zh: '家人们，今晚最后一波福利！', en: 'Last deal of the night, everyone!' };
const LINK = { zh: '上链接！', en: 'Link is live!' };
const STOCK = { zh: '只剩最后几件了！', en: 'Almost sold out!' };
// 价格句：换商品名和价格；数字用 sayNum 转成汉字 / 英文单词。英文价是美元。
const PRICE = {
  zh: (it, d) => `${it.name.zh}，秒杀${sayNum(d, 'zh')}！`,
  en: (it, d) => `${it.one.en}, just ${sayNum(d, 'en')} dollars!`,
};
// 片尾句：none 收尾、launch 新品（§E）。launch 只有英文片用（16:9 en）。
const END = {
  zh: { none: '有集直播，天天有好价。', launch: '有集直播，天天有好价。', 1111: '有集直播，天天有好价。' },
  en: { none: 'Youji Live, deals daily.', launch: 'New on Youji Live.', 1111: 'New on Youji Live.' },
};
// 6 秒版的一句（§E one_1111）：画面写 "Double 11"，配音念 "Double Eleven"；数字用 sayNum
const ONE_1111 = {
  zh: (it, d) => `${it.name.zh}双十一，到手${sayNum(d, 'zh')}！`,
  en: (it, d) => `${it.one.en}, Double Eleven, just ${sayNum(d, 'en')} dollars!`,
};

/** 变体 → 配音台词 [{ id, text, voice, speed, at, max }]；vo off → []。同一 id 在所有变体里文字相同 */
export function voLines(v) {
  if (v.vo === 'off') return [];
  const it = ITEMS[v.item], L = v.lang, voice = VOICE[L], d = it.deal[T[L].currency];
  const line = (slot, key, text) => { const [at, max] = SLOTS[v.cut][slot]; return { id: `${v.item}_${L}_${v.cut}_${key}`, text, voice, speed: SPEED[L], at, max }; };
  if (v.cut === 6) return [line('one', `one_${v.promo}`, ONE_1111[L](it, d))];
  return [
    line('hook', 'hook', HOOK[L]),
    line('link', 'link', LINK[L]),
    line('price', 'price', PRICE[L](it, d)),
    line('stock', 'stock', STOCK[L]),
    line('end', `end_${v.promo}`, END[L][v.promo]),
  ];
}
