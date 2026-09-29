// story.js — Level 3：交给 factory/story.mjs 的 STORY（见 factory/README.md 的「文案（story.js）」）
// 模型按一位顾客的统计写字：年度称号、三句统计字幕、两句配音、双11 推荐哪件商品。数全由代码填进 {占位符}
// check 用成片自己的图层（captions.js）和配音时段（copy.js）查：占位符、有没有自己写数字、称号的格式、
// 三种比例里放不放得下、念不念得完、推荐的是不是目录里的商品。错误原样发回给模型，所以写成它能照着改的话
import { USER_IDS } from './users.js';
import { CATS, ITEMS } from './catalog.js';
import { factsOf } from './facts.js';
import { META } from './meta.js';
import { LAYOUTS } from './layouts.js';
import { layersFor } from './captions.js';
import { valuesFor, SLOTS, END, ONE, T } from './copy.js';
import { ASPECTS, MIN_TEXT } from '../factory/engine/variant.js';
import { prepareLayer, layout, approxMeasure } from '../factory/engine/text.js';
import { fill, slotErrors, writtenNumbers, speechSec } from '../factory/engine/story.js';
import { MAX_RATE } from '../factory/vo.mjs';

const LANGS = META.axes.lang;
/** 模型写的字段和各自的占位符（required 每个正好一次，optional 最多一次） */
export const FIELDS = {
  title: {},
  'captions.count': {},                                              // 大数字就在上面，字幕只作注释，不再写一遍
  'captions.months': { required: ['month', 'monthOrders'] },
  'captions.top': { required: ['top', 'repeat'] },
  'vo.intro': { required: ['name', 'orders'], optional: ['year'] },
  'vo.top': { required: ['top', 'repeat'] },
};
/** 上屏的字段在哪个镜头（那个镜头里带同名 story 字段的图层）；pick 的商品名在 1111 片尾卡上 */
const SHOT = { 'captions.count': 'count', 'captions.months': 'months', 'captions.top': 'top', title: 'title', pick: 'end' };
/** 配音字段对应的时段（copy.js 的 SLOTS[15]） */
const SLOT = { 'vo.intro': 'intro', 'vo.top': 'top' };

const get = (o, key) => key.split('.').reduce((x, k) => x?.[k], o);
const put = (key, val) => key.split('.').reduceRight((x, k) => ({ [k]: x }), val);
const variant = (id, lang, ar, promo = 'none') => ({ user: id, lang, ar, cut: 15, promo, vo: 'on' });

/** 字段 key 在 ar 里的图层，按候选稿排好：[{ P, r }]；P.min 是这一层允许的最小字号 */
function laid(id, lang, ar, key, story, { full = false } = {}) {
  const [W, H] = ASPECTS[ar], shot = SHOT[key], row = LAYOUTS[ar][shot];
  const v = variant(id, lang, ar, key === 'pick' ? '1111' : 'none');
  return layersFor(v, { name: shot, from: 0, row }, story).filter(l => l.story === key).map(l => {
    const P = prepareLayer(l, { lt: 99, zones: row.zones, W, H, minFrac: MIN_TEXT[ar] });
    if (full) P.min = P.size;                                     // 预算按设计字号算，给 85% 的底线留出余地
    return { P, r: layout(approxMeasure, P) };
  });
}
const fits = (...a) => laid(...a).every(x => !x.r.overflow);

/** 放不下时，模型自己的字（占位符以外）从末尾删几个才放得下：给模型的"删掉约 N 个字" */
function overBy(id, lang, ar, key, story) {
  const parts = get(story, key)[lang].split(/(\{\w+\})/), total = parts.filter((_, i) => i % 2 === 0).join('').length;   // 偶数位是模型的字，奇数位是占位符
  for (let k = 1; k < total; k++) {
    const p = [...parts];
    for (let i = p.length - 1, left = k; i >= 0 && left > 0; i -= 2) { const c = Math.min(left, p[i].length); p[i] = p[i].slice(0, p[i].length - c); left -= c; }
    if (fits(id, lang, ar, key, put(key, { [lang]: p.join('') }))) return k;
  }
  return total;
}

/**
 * 字数预算（写进提示词）：这位顾客的数填进去之后，模型自己的字最多几个，三种比例都按设计字号放得下。
 * 中文数汉字，英文数字母和空格
 */
export function budgets(id) {
  const out = {};
  for (const key of Object.keys(SHOT).filter(k => k !== 'pick')) for (const lang of LANGS) {
    const slots = (FIELDS[key].required ?? []).map(p => `{${p}}`).join(' ');
    const filler = n => (lang === 'zh' ? '字'.repeat(n) : Array.from({ length: n }, (_, i) => ((i + 1) % 6 ? 'e' : ' ')).join(''));
    let n = 0;
    while (n < 80 && Object.keys(ASPECTS).every(ar => fits(id, lang, ar, key, put(key, { [lang]: `${filler(n + 1)} ${slots}`.trim() }), { full: true }))) n++;
    out[`${key}.${lang}`] = n;
  }
  for (const [key, slot] of Object.entries(SLOT)) for (const lang of LANGS) {
    const { spoken } = valuesFor(id, lang), used = (FIELDS[key].required ?? []).map(p => spoken[p]).join(' ');
    const left = SLOTS[15][slot][1] - 0.3 - speechSec(used, lang);      // 按设计时段（不算 MAX_RATE 的余量）留两个停顿
    out[`${key}.${lang}`] = Math.max(0, Math.floor(left * (lang === 'zh' ? 4.8 : 4)));
  }
  return out;
}

/** 候选稿的全部问题；空数组 = 通过 */
export function check(id, story) {
  const errs = [];
  if (!story || typeof story !== 'object') return ['the story must be an object'];
  for (const key of Object.keys(FIELDS)) for (const lang of LANGS) {
    const s = get(story, key)?.[lang];
    if (typeof s !== 'string' || !s.trim()) errs.push(`${key}.${lang} is missing or empty`);
  }
  if (typeof story.pick !== 'string' || !ITEMS[story.pick]) errs.push(`pick must be a catalogue id (one of ${Object.keys(ITEMS).join(', ')}), got ${JSON.stringify(story.pick)}`);
  if (typeof story.why !== 'string' || !story.why.trim()) errs.push('why is missing or empty');
  if (errs.length) return errs;

  // 1 占位符 · 2 模型自己写的数字
  const slotted = new Set();
  for (const [key, spec] of Object.entries(FIELDS)) for (const lang of LANGS) {
    const s = get(story, key)[lang], e = slotErrors(`${key}.${lang}`, s, spec);
    if (e.length) { errs.push(...e); slotted.add(key); }
    const nums = writtenNumbers(s, lang);
    if (nums.length) errs.push(`${key}.${lang} writes numbers itself (${nums.map(x => `"${x}"`).join(', ')}); numbers only go in through placeholders${lang === 'en' ? ', so also avoid words like "one" or "dozen" in phrases' : ', so also avoid characters like 两, 十, 百 and 千'}`);
  }
  // 3 称号
  const { zh, en } = story.title;
  if (!/^[㐀-鿿]{2,6}$/.test(zh)) errs.push(`title.zh must be 2–6 Chinese characters with no punctuation, got "${zh}"`);
  if (!/^[A-Za-z]+(?:[-'][A-Za-z]+)*(?: [A-Za-z]+(?:[-'][A-Za-z]+)*)*$/.test(en)) errs.push(`title.en must be words only, no punctuation, got "${en}"`);
  else if (en.split(' ').length > 4) errs.push(`title.en must be at most 4 words, got ${en.split(' ').length}`);

  // 4 放不放得下：三种比例，不许溢出，不许缩到设计字号的 85% 以下
  for (const key of Object.keys(SHOT)) {
    if (slotted.has(key)) continue;
    for (const lang of LANGS) {
      const bad = Object.keys(ASPECTS).filter(ar => !fits(id, lang, ar, key, story));
      if (!bad.length) continue;
      if (key === 'pick') { errs.push(`pick ${story.pick}: its ${lang} name "${ITEMS[story.pick].one[lang]}" does not fit the 11.11 end card in ${bad.join(', ')}; pick an item with a shorter name`); continue; }
      const k = Math.max(...bad.map(ar => overBy(id, lang, ar, key, story)));
      errs.push(`${key}.${lang} is too long for its caption zone in ${bad.join(', ')} (the ${SHOT[key]} shot): cut about ${k} ${lang === 'zh' ? 'characters' : 'letters'}`);
    }
  }
  // 5 念不念得完：填好数的配音按 speechSec 估时长。speechSec 比 Kokoro 实测偏长（03 的中文片段长 5–29%），
  // vo.mjs 放不下还会提速到 MAX_RATE 倍，所以估计值到时段的 MAX_RATE 倍都算念得完；真正的时长由 vo.mjs 量
  const sayErr = (label, text, lang, slot) => {
    const sec = speechSec(text, lang), max = slot * MAX_RATE;
    if (sec > max) errs.push(`${label} would take about ${sec.toFixed(1)} s to say ("${text}"), over its ${slot} s slot: cut about ${Math.ceil((sec - max) * (lang === 'zh' ? 4.8 : 4))} ${lang === 'zh' ? 'characters' : 'syllables'}`);
  };
  for (const lang of LANGS) {
    const { spoken } = valuesFor(id, lang, story);
    for (const [key, slot] of Object.entries(SLOT)) if (!slotted.has(key)) sayErr(`${key}.${lang}`, fill(get(story, key)[lang], spoken), lang, SLOTS[15][slot][1]);
    // 念推荐商品的两句模板（代码写的）：6 秒版念商品名，名字太长、价格太长就念不完
    sayErr(`pick ${story.pick}: the ${lang} 11.11 end line`, fill(END[lang][1111], spoken), lang, SLOTS[15].end[1]);
    sayErr(`pick ${story.pick}: the ${lang} 6-second 11.11 line`, fill(ONE[lang][1111], spoken), lang, SLOTS[6].one[1]);
  }
  return errs;
}

const bilingual = d => ({ type: 'object', additionalProperties: false, required: ['zh', 'en'], description: d, properties: { zh: { type: 'string' }, en: { type: 'string' } } });
const SCHEMA = {
  type: 'object', additionalProperties: false, required: ['title', 'captions', 'vo', 'pick', 'why'],
  properties: {
    title: bilingual('The customer\'s title of the year, no placeholders'),
    captions: {
      type: 'object', additionalProperties: false, required: ['count', 'months', 'top'],
      properties: { count: bilingual('Caption under the rolling order count, no placeholders'), months: bilingual('Caption over the monthly bars: {month} {monthOrders}'), top: bilingual('Caption when the favourite lands in the cart: {top} {repeat}') },
    },
    vo: {
      type: 'object', additionalProperties: false, required: ['intro', 'top'],
      properties: { intro: bilingual('Narration over the opening: {name} {orders}, optionally {year}'), top: bilingual('Narration over the favourite: {top} {repeat}') },
    },
    pick: { type: 'string', enum: Object.keys(ITEMS), description: 'Catalogue id of the one item to recommend on 11.11' },
    why: { type: 'string', description: 'One sentence for the reviewer: why this pick and this title (not shown or spoken)' },
  },
};

const SYSTEM = `You write the words for 有集 Youji's year-in-review videos. Youji is a fictional Chinese shopping app; every December each customer gets a 15-second film of their year, in Chinese and in English.

Code has already computed every number from the customer's orders. You write only words. Wherever a number, month or product name belongs, you write a {placeholder} and code fills it in. Never write a number yourself, not as digits and not as words: a hallucinated statistic must not reach the screen.

Voice: warm, playful and specific to this person, like a friend who noticed what they bought. Short lines that read at a glance. The Chinese is written as native Chinese copy and the English as native English copy; neither is a translation of the other. No emoji, no exclamation marks in a row, no hashtags. The names are fictional; don't assume anyone's gender (use 你 / you).

The title of the year is a light persona grounded in the data, e.g. someone who orders coffee before 9 am, or who orders at 2 am. Use the background facts (time of day, weekends, streaks, spend) to find it, but don't put those numbers anywhere.

Hand the story back by calling the write_story tool. If it comes back with problems, fix every one and call the tool again with the whole story.`;

function prompt(id) {
  const f = factsOf(id), B = budgets(id), shown = LANGS.map(l => [l, valuesFor(id, l).screen]), said = LANGS.map(l => [l, valuesFor(id, l).spoken]);
  const vals = rows => rows.map(([l, v]) => `  ${l}: ${Object.entries(v).map(([k, x]) => `{${k}} = ${x}`).join(' · ')}`).join('\n');
  const cats = Object.entries(CATS).map(([c, n]) => `  ${c} ${n.zh} / ${n.en}: ${Object.entries(ITEMS).filter(([, it]) => it.cat === c).map(([i, it]) => `${i} ${it.name.zh} / ${it.name.en} (¥${it.price.CNY}, 11.11 ¥${it.deal.CNY})`).join('; ')}`).join('\n');
  const bud = k => `zh ≤ ${B[`${k}.zh`]} characters, en ≤ ${B[`${k}.en`]} letters`;
  return `Customer: ${id}. Their year, computed from their orders (the colour facts are background, never on screen):

${JSON.stringify(f, null, 2)}

What the placeholders become. On screen:
${vals(shown)}
In the narration (numbers spelt out for the voice):
${vals(said)}

Fields to write (each in zh and en):
- title: the title of the year, no placeholders. zh 2–6 characters, no punctuation; en at most 4 words, no punctuation. It sits under the label "${T.zh.label}" / "${T.en.label}".
- captions.count: shown under the big rolling number of orders, e.g. "orders this year". No placeholders: the number is right above it, so don't repeat it. Budget: ${bud('captions.count')}.
- captions.months: shown over the twelve monthly bars as the busiest bar lights up. Must contain {month} and {monthOrders} once each. Budget: ${bud('captions.months')}.
- captions.top: shown as the favourite product flies into the cart. Must contain {top} and {repeat} once each ({repeat} = re-buys after the first order). Budget: ${bud('captions.top')}.
- vo.intro: narration over the opening, about ${SLOTS[15].intro[1]} s. Must contain {name} and {orders} once each; {year} is optional. Budget besides the spoken values: zh ≤ ${B['vo.intro.zh']} characters, en ≤ ${B['vo.intro.en']} syllables.
- vo.top: narration over the favourite, about ${SLOTS[15].top[1]} s. Must contain {top} and {repeat} once each. Budget: zh ≤ ${B['vo.top.zh']} characters, en ≤ ${B['vo.top.en']} syllables.
- pick: one catalogue id to recommend on 11.11 (a restock of a favourite at the deal price, or a natural next step). Its name and price go on the end card, and the 6-second narration says "${ONE.zh[1111]}" / "${ONE.en[1111]}".
- why: one sentence for the human reviewer on the pick and the title. It may mention numbers; it is not shown or spoken.

Rules the checker enforces: exactly the placeholders listed for each field, no others; no digits and no number words outside placeholders (English: one, two, … twenty, hundred, thousand, dozen; Chinese: 〇零两二三四五六七八九十百千万, while 一 is allowed); the captions must fit their zones in 16:9, 1:1 and 9:16; the narration must fit its slot.

Catalogue (id, name zh / en, price, 11.11 deal price):
${cats}`;
}

export const STORY = {
  axis: 'user',
  ids: USER_IDS,
  facts: factsOf,
  schema: SCHEMA,
  system: SYSTEM,
  prompt,
  toolDescription: 'Hand back the whole year-in-review story for this customer: title, captions, narration, the 11.11 pick and why.',
  check,
};
