import test from 'node:test';
import assert from 'node:assert/strict';
import { sayNum, sayYear, sayMonth, MONTHS } from '../engine/say.js';

test('sayNum reads numbers the way a narrator would, up to 99 999', () => {
  const zh = { 0: '零', 9: '九', 10: '十', 11: '十一', 15: '十五', 20: '二十', 101: '一百零一', 110: '一百一十', 146: '一百四十六', 509: '五百零九',
    1000: '一千', 1010: '一千零一十', 1050: '一千零五十', 10000: '一万', 10010: '一万零一十', 12000: '一万二千', 15300: '一万五千三百', 99999: '九万九千九百九十九' };
  for (const [n, s] of Object.entries(zh)) assert.equal(sayNum(+n, 'zh'), s, n);
  const en = { 0: 'zero', 13: 'thirteen', 20: 'twenty', 69: 'sixty-nine', 109: 'one hundred nine', 146: 'one hundred forty-six', 1200: 'one thousand two hundred', 12005: 'twelve thousand five' };
  for (const [n, s] of Object.entries(en)) assert.equal(sayNum(+n, 'en'), s, n);
  for (const bad of [-1, 1.5, 100000, NaN]) assert.throws(() => sayNum(bad, 'zh'), /not an integer/);
});

test('sayYear: digit by digit in Chinese, in pairs in English', () => {
  assert.equal(sayYear(2026, 'zh'), '二零二六');
  assert.equal(sayYear(2026, 'en'), 'twenty twenty-six');
  assert.equal(sayYear(2010, 'en'), 'twenty ten');
  assert.equal(sayYear(2005, 'en'), 'two thousand five');
  assert.equal(sayYear(1905, 'en'), 'nineteen oh five');
  assert.equal(sayYear(1900, 'en'), 'nineteen hundred');
});

test('months: captions get 11月 / November, narration 十一月 / November', () => {
  assert.equal(MONTHS.zh[10], '11月');
  assert.equal(MONTHS.en[10], 'November');
  assert.equal(sayMonth(11, 'zh'), '十一月');
  assert.equal(sayMonth(1, 'zh'), '一月');
  assert.equal(sayMonth(12, 'en'), 'December');
});
