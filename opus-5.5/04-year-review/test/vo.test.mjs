import test from 'node:test';
import assert from 'node:assert/strict';
import { META, CUTS } from '../meta.js';
import { voLines, SLOTS } from '../copy.js';
import { MAX_RATE } from '../../factory/vo.mjs';
import { expandJobs } from '../../factory/engine/variant.js';
import { speechSec } from '../../factory/engine/story.js';

const all = expandJobs(META, { jobs: [{ user: ['*'], lang: ['*'], cut: ['*'], promo: ['*'], vo: ['*'] }] });
const dur = cut => CUTS[cut].shots.reduce((s, e) => s + e.dur, 0);

test('the slots end before the last 0.3 s fade and do not overlap', () => {
  for (const [cut, slots] of Object.entries(SLOTS)) {
    const s = Object.values(slots).sort((a, b) => a[0] - b[0]);
    s.forEach(([at, max], i) => {
      assert.ok(at >= 0 && at + max <= dur(cut) - 0.3 + 1e-9, `${cut}: [${at}, ${max}]`);
      if (i) assert.ok(s[i - 1][0] + s[i - 1][1] <= at + 1e-9, `${cut}: slots overlap at ${at}`);
    });
  }
});

// 按 speechSec 估的时长：到时段的 MAX_RATE 倍都算念得完（和 story.js 的 check 相同）；真正的时长由 vo.mjs 量
test('every line of every variant is short enough for its slot', () => {
  for (const v of all) for (const l of voLines(v)) {
    const sec = speechSec(l.text, v.lang);
    assert.ok(sec <= l.max * MAX_RATE, `${l.id}: "${l.text}" ≈ ${sec.toFixed(2)} s in ${l.max} s`);
  }
});

test('each line id has one text, and vo off has no lines', () => {
  const seen = new Map();
  for (const v of all) {
    const ls = voLines(v);
    assert.equal(ls.length, v.vo === 'off' ? 0 : v.cut === 6 ? 1 : 3);
    for (const l of ls) { assert.ok(!seen.has(l.id) || seen.get(l.id) === l.text, l.id); seen.set(l.id, l.text); }
  }
  assert.equal(seen.size, 4 * 2 * (2 + 3 + 3));                         // 4 人 × 2 语言 ×（15 秒 intro、top、3 种片尾 + 6 秒 3 种）
});
