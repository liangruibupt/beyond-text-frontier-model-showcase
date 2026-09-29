// story.js — Level 3 文案的纯函数（页面、测试、factory/story.mjs 共用）：数据指纹、占位符、查模型有没有自己写数字、估念多久
// 分工：数字全由代码算、由代码填进 {占位符}；模型只写字。模型写出来的字里不许有数字，编不出统计
import { seedOf } from './rng.js';

/** 键排好序的 JSON：同样的数据，键的顺序不同也得到同一个串 */
export function stableJson(x) {
  if (Array.isArray(x)) return `[${x.map(stableJson).join(',')}]`;
  if (x && typeof x === 'object') return `{${Object.keys(x).sort().map(k => `${JSON.stringify(k)}:${stableJson(x[k])}`).join(',')}}`;
  return JSON.stringify(x);
}
const hex = n => n.toString(16).padStart(8, '0');
/** 统计数据的指纹：存进 stories/<id>.json，数据一变文案就算过期 */
export const storyKey = facts => { const s = stableJson(facts); return hex(seedOf(s)) + hex(seedOf(`${s}#`)); };

/** 文案里的占位符名，按出现顺序（重复的也列出） */
export const slotsOf = tpl => [...tpl.matchAll(/\{(\w+)\}/g)].map(m => m[1]);
/** 填占位符；缺值就报错，不留下 {x} 出片 */
export function fill(tpl, values) {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => {
    if (values[k] === undefined) throw new Error(`no value for {${k}} in "${tpl}"`);
    return String(values[k]);
  });
}
/** 占位符查错：required 每个正好一次，optional 最多一次，别的都不许有；返回错误描述（空 = 通过） */
export function slotErrors(label, tpl, { required = [], optional = [] } = {}) {
  const got = slotsOf(tpl), errs = [];
  for (const k of required) if (got.filter(x => x === k).length !== 1) errs.push(`${label} must contain {${k}} exactly once`);
  for (const k of optional) if (got.filter(x => x === k).length > 1) errs.push(`${label} may contain {${k}} at most once`);
  for (const k of new Set(got)) if (!required.includes(k) && !optional.includes(k)) errs.push(`${label} has an unknown placeholder {${k}}`);
  return errs;
}

// 中文里的"一"不查：一起、每一次、一年，太常见
const ZH_NUM = /[〇零两二三四五六七八九十百千万亿]/g;
const EN_NUM = /\b(zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million|billion|dozen|dozens)\b/gi;
/** 模型自己写出来的数字（占位符以外）：阿拉伯数字、英文数词、中文数字。返回去重后的片段，空 = 没有 */
export function writtenNumbers(s, lang) {
  const bare = s.replace(/\{\w+\}/g, ' ');
  const hits = [...(bare.match(/[0-9０-９]+/g) ?? []), ...(bare.match(lang === 'zh' ? ZH_NUM : EN_NUM) ?? [])];
  return [...new Set(hits.map(h => h.toLowerCase()))];
}

const PAUSE = /[，。、：；！？,.;:!?—]/g;
const syllables = w => {
  const x = w.toLowerCase().replace(/[^a-z]/g, '');
  if (!x) return 0;
  const n = (x.match(/[aeiouy]+/g) ?? []).length - (/[^l]e$/.test(x) && x.length > 2 ? 1 : 0);
  return Math.max(1, n);
};
/**
 * 估一句配音念多久（秒）：中文每秒 4.8 个字，英文每秒 4 个音节，句中每个停顿（标点）加 0.15 秒。
 * 比 03 的 Kokoro 实测（中文约 5.1 字 / 秒）略慢，只会高估。真正的时长由 vo.mjs 量
 */
export function speechSec(s, lang) {
  const pauses = Math.max(0, (s.trim().replace(/[。.!?！？]+$/, '').match(PAUSE) ?? []).length);
  if (lang === 'zh') {
    const han = (s.match(/[㐀-鿿]/g) ?? []).length, latin = (s.match(/[A-Za-z]+/g) ?? []).reduce((a, w) => a + syllables(w), 0);
    return (han + latin) / 4.8 + 0.15 * pauses;
  }
  return s.split(/[\s-]+/).reduce((a, w) => a + syllables(w), 0) / 4 + 0.15 * pauses;
}
