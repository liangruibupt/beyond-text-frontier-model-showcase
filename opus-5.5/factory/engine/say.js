// say.js — 配音里的数字、年份、月份一律写成汉字 / 英文单词：Kokoro 直接读阿拉伯数字不稳定

const ZH = '零一二三四五六七八九', UNIT = ['', '十', '百', '千'];
const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

/** 0–9999；lead = 这一段在最前面（十开头时省掉"一"：十五，不是一十五） */
function zh4(n, lead = true) {
  const ds = [...String(n)].map(Number);
  let s = '', zero = false;
  ds.forEach((d, i) => {
    const u = UNIT[ds.length - 1 - i];
    if (d === 0) { zero = true; return; }
    if (zero) { s += '零'; zero = false; }
    s += (d === 1 && u === '十' && i === 0 && lead ? '' : ZH[d]) + u;
  });
  return s;
}
function zhNum(n) {
  if (n === 0) return '零';
  if (n < 10000) return zh4(n);
  const hi = Math.floor(n / 10000), lo = n % 10000;
  return `${zh4(hi)}万${lo ? (lo < 1000 ? '零' : '') + zh4(lo, false) : ''}`;
}
function enNum(n) {
  if (n < 20) return ONES[n];
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? `-${ONES[n % 10]}` : '');
  if (n < 1000) return `${ONES[Math.floor(n / 100)]} hundred${n % 100 ? ` ${enNum(n % 100)}` : ''}`;
  return `${enNum(Math.floor(n / 1000))} thousand${n % 1000 ? ` ${enNum(n % 1000)}` : ''}`;
}

/** 0–99 999 的整数 → 读法 */
export function sayNum(n, lang) {
  if (!Number.isInteger(n) || n < 0 || n > 99999) throw new Error(`sayNum: ${n} is not an integer in 0–99999`);
  return lang === 'zh' ? zhNum(n) : enNum(n);
}

/** 年份：中文逐位读（二零二六），英文两位一读（twenty twenty-six；2000–2009 读 two thousand …） */
export function sayYear(y, lang) {
  if (lang === 'zh') return [...String(y)].map(d => ZH[d]).join('');
  const hi = Math.floor(y / 100), lo = y % 100;
  if (y >= 2000 && y < 2010) return enNum(y);
  return `${enNum(hi)} ${lo === 0 ? 'hundred' : lo < 10 ? `oh ${enNum(lo)}` : enNum(lo)}`;
}

export const MONTHS = {
  zh: Array.from({ length: 12 }, (_, i) => `${i + 1}月`),
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
};
/** 月份（1–12）：字幕用 MONTHS，配音用这个 */
export const sayMonth = (m, lang) => (lang === 'zh' ? `${zhNum(m)}月` : MONTHS.en[m - 1]);
