// copy.js — 文案：字体、界面用语、里程碑/配音台词与时段（纯数据）
// 配音里的数字一律写成汉字 / 英文单词：Kokoro 直接读阿拉伯数字不稳定。画面写 "Double 11"，配音念 "Double Eleven"
import { THEMES } from './themes.js';
import { sayNum } from '../factory/engine/say.js';

export const FONTS = {
  zh: { display: { family: 'Noto Sans SC', weight: 900, fallback: 'sans-serif' }, body: { family: 'Noto Sans SC', weight: 500, fallback: 'sans-serif' } },
  en: { display: { family: 'Oswald', weight: 700, fallback: 'sans-serif' }, body: { family: 'Oswald', weight: 500, fallback: 'sans-serif' } },
  brand: { family: 'Oswald', weight: 700, fallback: 'sans-serif' },
  num: { family: 'Oswald', weight: 700, fallback: 'monospace' },   // 计数器等宽数字避免抖动
};

export const T = {
  zh: { brand: '星潮', sub: '星潮 · STARTIDE', tagline: '峰值，由你点亮', cta: '立即下单', gmv: '成交额', dot: ' · ' },
  en: { brand: 'STARTIDE', sub: 'STARTIDE', tagline: 'Light up the peak', cta: 'Order now', gmv: 'GMV', dot: ' · ' },
};

// 每镜头字幕（zh/en）。ignite / arcs / gmv 按主题取（Opus 5.5 复审：原文案四主题共用，跨境写「全国」、物流写「成交额」）
const CAP_THEME = {
  ignite: {
    national: { zh: '全国订单，瞬时点亮', en: 'Orders light up nationwide' },
    megacity: { zh: '四城同时点亮', en: 'Four cities light up at once' },
    crossborder: { zh: '全球订单，瞬时点亮', en: 'Orders light up worldwide' },
    logistics: { zh: '零点发车', en: 'Trucks roll at midnight' },
  },
  arcs: {
    national: { zh: '每秒十万笔，奔向八大仓', en: 'A hundred thousand a second' },
    megacity: { zh: '北上广深，订单对冲', en: 'Four cities, one surge' },
    crossborder: { zh: '跨越时区，奔向七大仓', en: 'Across time zones, to seven hubs' },
    logistics: { zh: '从仓到家，一路点亮', en: 'Warehouse to door, all lit' },
  },
  gmv: {
    national: { zh: '全国成交额', en: 'National GMV' },
    megacity: { zh: '单城成交额', en: 'One-city GMV' },
    crossborder: { zh: '同时下单国家', en: 'Countries ordering' },
    logistics: { zh: '每分钟发出', en: 'Shipped per minute' },
  },
};
export const CAP = {
  countdown: { zh: '零点将至', en: 'Midnight approaches' },
};
/** 字幕文字：主题化的键按 theme 取，其余共用 */
export const capText = (key, theme, L) => (CAP_THEME[key] ? CAP_THEME[key][theme][L] : CAP[key][L]);

// 里程碑爆屏句（按 theme 变化）
export const MILE = {
  national: { zh: t => `十亿成交额 · ${t}`, en: t => `Ten billion GMV · ${t}` },
  megacity: { zh: () => '单城破亿 · 1分36秒', en: () => 'One city past ¥100M · 1:36' },
  crossborder: { zh: () => '六十八国同时下单', en: () => 'Sixty-eight countries at once' },
  logistics: { zh: () => '每分钟两百四十万单已发出', en: () => '2.4M parcels per minute' },
};

// ── 配音 ──
// 建议音色（待用户定；可先 --audition）：中文 zf_xiaoxiao，英文 bf_emma
export const VOICE = { zh: 'zf_xiaoxiao', en: 'bf_emma' };
export const AUDITION = { zh: ['zf_xiaoxiao'], en: ['bf_emma'] };
export const SPEED = { zh: 1, en: 1 };
// 时段（成片秒）：[开始, 最长]。hook 从 0.4 挪到 2.25（倒计时归零 = 点亮那一拍，原先画面还在倒数就喊「零点已到」）
export const SLOTS = { 15: { hook: [2.3, 2.2], hero: [5.5, 2.6], end: [12.3, 2.4] }, 6: { one: [1.7, 3.6] } };

const HOOK = {
  zh: { national: '零点！全国点亮。', megacity: '零点！四城点亮。', crossborder: '零点！全球点亮。', logistics: '零点，发车。' },
  en: { national: 'Midnight. Lights on.', megacity: 'Midnight. Four cities on.', crossborder: 'Midnight. The world lights up.', logistics: 'Midnight. Trucks roll.' },
};
const END = {
  zh: { none: () => '星潮双十一，峰值由你点亮。', 1111: () => '星潮双十一，峰值由你点亮。', launch: () => '星潮新品，零点首发。' },
  en: { none: () => 'STARTIDE. Light up the peak.', 1111: () => 'STARTIDE. Light up the peak.', launch: () => 'STARTIDE. New at midnight.' },
};
// 6 秒版一句：按主题对齐 MILE（原先四主题都念「破十亿」）
const ONE = {
  zh: { national: '十亿成交，一分三十六秒。', megacity: '单城破亿，一分三十六秒。', crossborder: '六十八国，同时下单。', logistics: '每分钟，两百四十万单。' },
  en: { national: 'Ten billion in ninety-six seconds.', megacity: 'One city past a hundred million.', crossborder: 'Sixty-eight countries. One midnight.', logistics: 'Two point four million a minute.' },
};
// hero：数字自洽（每秒十万笔 × 96 秒 × 约百元 ≈ 十亿；原「每秒百万」折出客单价十元）
const HERO = {
  zh: { national: '每秒十万笔，奔向八大仓。', megacity: '四座城，同时破亿。', crossborder: '六十八国，同时下单。', logistics: '每分钟，两百四十万单发出。' },
  en: { national: 'A hundred thousand a second.', megacity: 'Four cities. Each past a hundred million.', crossborder: 'Sixty-eight countries. One midnight.', logistics: 'Two point four million a minute. Shipped.' },
};

/** 变体 → 配音台词 [{ id, text, voice, speed, at, max }]；同一 id 在所有变体里文字相同 */
export function voLines(v) {
  if (v.vo === 'off') return [];
  const L = v.lang, voice = VOICE[L];
  const line = (slot, key, text) => { const [at, max] = SLOTS[v.cut][slot]; return { id: `${v.theme}_${L}_${v.cut}_${key}`, text, voice, speed: SPEED[L], at, max }; };
  if (v.cut === 6) return [line('one', `one_${v.promo}`, ONE[L][v.theme])];
  return [
    line('hook', 'hook', HOOK[L][v.theme]),
    line('hero', 'hero', HERO[L][v.theme]),
    line('end', `end_${v.promo}`, END[L][v.promo]()),
  ];
}

export { sayNum };
