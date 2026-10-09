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
  zh: { brand: '星潮', sub: '星潮 · STARTIDE', tagline: '峰值即巅峰', cta: '立即下单', gmv: '成交额', dot: ' · ' },
  en: { brand: 'STARTIDE', sub: 'STARTIDE', tagline: 'Peak means the summit', cta: 'Order now', gmv: 'GMV', dot: ' · ' },
};

// 每镜头字幕（zh/en）—— 脚手架阶段先放批准的台词
export const CAP = {
  countdown: { zh: '零点将至', en: 'Midnight approaches' },
  ignite: { zh: '全国订单，瞬时点亮', en: 'Orders light up nationwide' },
  arcs: { zh: '每秒百万笔', en: 'Millions per second' },
  gmv: { zh: '成交额', en: 'GMV' },
};

// 里程碑爆屏句（按 theme 变化）
export const MILE = {
  national: { zh: t => `十亿成交额 · ${t}`, en: t => `Ten billion GMV · ${t}` },
  megacity: { zh: () => '单城破亿', en: () => 'One city past a hundred million' },
  crossborder: { zh: () => '六十八国同时下单', en: () => 'Sixty-eight countries at once' },
  logistics: { zh: () => '每分钟两百四十万单已发出', en: () => '2.4M parcels per minute' },
};

// ── 配音 ──
// 建议音色（待用户定；可先 --audition）：中文 zf_xiaoxiao，英文 bf_emma
export const VOICE = { zh: 'zf_xiaoxiao', en: 'bf_emma' };
export const AUDITION = { zh: ['zf_xiaoxiao'], en: ['bf_emma'] };
export const SPEED = { zh: 1, en: 1 };
// 时段（成片秒）：[开始, 最长]
export const SLOTS = { 15: { hook: [0.4, 2.3], hero: [5.5, 2.6], end: [12.3, 2.4] }, 6: { one: [1.7, 3.6] } };

const END = {
  zh: { none: () => '星潮双十一，峰值即巅峰。', 1111: () => '星潮双十一，峰值即巅峰。', launch: () => '星潮大屏，全新上线。' },
  en: { none: () => 'STARTIDE Double Eleven — peak means the summit.', 1111: () => 'STARTIDE Double Eleven — peak means the summit.', launch: () => 'STARTIDE war-room, newly launched.' },
};
const ONE = {
  zh: () => '星潮双十一，成交额破十亿只用一分三十六秒。',
  en: () => 'STARTIDE Double Eleven — ten billion in one minute thirty-six.',
};
const HERO = {
  zh: { national: '每秒百万订单，奔向仓库。', megacity: '核心都市圈，单城破亿。', crossborder: '六十八国订单，同时奔向仓库。', logistics: '每分钟两百四十万单，已经发出。' },
  en: { national: 'A million orders a second, racing to the warehouse.', megacity: 'The megacities — one city past a hundred million.', crossborder: 'Sixty-eight countries, all racing to the warehouse.', logistics: 'Two point four million parcels a minute, already shipped.' },
};

/** 变体 → 配音台词 [{ id, text, voice, speed, at, max }]；同一 id 在所有变体里文字相同 */
export function voLines(v) {
  if (v.vo === 'off') return [];
  const L = v.lang, voice = VOICE[L];
  const line = (slot, key, text) => { const [at, max] = SLOTS[v.cut][slot]; return { id: `${v.theme}_${L}_${v.cut}_${key}`, text, voice, speed: SPEED[L], at, max }; };
  if (v.cut === 6) return [line('one', `one_${v.promo}`, ONE[L]())];
  return [
    line('hook', 'hook', L === 'zh' ? '零点已到，全国点亮。' : 'Midnight strikes, the nation lights up.'),
    line('hero', 'hero', HERO[L][v.theme]),
    line('end', `end_${v.promo}`, END[L][v.promo]()),
  ];
}

export { sayNum };
