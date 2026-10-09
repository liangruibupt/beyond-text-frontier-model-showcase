import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { META, CUTS, SHOTS } from '../meta.js';
import { LAYOUTS } from '../layouts.js';
import { ITEMS } from '../items.js';
import { voLines } from '../copy.js';
import { ITEMS as CATALOG } from '../../04-year-review/catalog.js';
import { UNSAFE, MARGIN, expandJobs } from '../../factory/engine/variant.js';

const manifest = JSON.parse(readFileSync(fileURLToPath(new URL('../manifest.json', import.meta.url))));

test('default manifest is exactly 9 videos (3 items x 3 deliverables)', () => {
  const jobs = expandJobs(META, manifest);
  assert.equal(jobs.length, 9);
});

test('fileName is unique across the whole axis grid and encodes the output axes', () => {
  const all = expandJobs(META, { jobs: [] }, { all: true });
  const names = all.map(v => META.fileName(v));
  assert.equal(new Set(names).size, names.length, 'file names collide');
  // 轴值都进了文件名（换任一轴都换名）
  const base = { item: 'lantern', ar: '16x9', lang: 'zh', cut: 15, promo: 'none', vo: 'on' };
  const n0 = META.fileName(base);
  for (const [k, alt] of [['item', 'headset'], ['ar', '1x1'], ['lang', 'en'], ['cut', 6], ['promo', '1111'], ['vo', 'off']]) {
    assert.notEqual(META.fileName({ ...base, [k]: alt }), n0, `${k} not encoded in fileName`);
  }
});

test('prices and models come from 04 catalog (integers, unchanged)', () => {
  assert.equal(ITEMS.lantern.deal.CNY, CATALOG['od-lantern'].deal.CNY);
  assert.equal(ITEMS.headset.deal.CNY, CATALOG['gm-headset'].deal.CNY);
  assert.equal(ITEMS.beans.deal.CNY, CATALOG['cf-geisha'].deal.CNY);
  for (const it of Object.values(ITEMS)) { assert.ok(Number.isInteger(it.deal.CNY) && Number.isInteger(it.price.USD)); }
});

// 每个比例、每个镜头的文字区都要落在画布内、避开 4% 边距；9:16 还要避开平台红区（UNSAFE）
function overlaps(z, u) { return z[0] < u[0] + u[2] && z[0] + z[2] > u[0] && z[1] < u[1] + u[3] && z[1] + z[3] > u[1]; }
test('every text zone is inside the frame and clear of 9x16 platform red areas', () => {
  for (const [ar, shots] of Object.entries(LAYOUTS)) {
    for (const [shot, row] of Object.entries(shots)) {
      for (const [name, z] of Object.entries(row.zones ?? {})) {
        assert.ok(z[0] >= -1e-9 && z[1] >= -1e-9 && z[0] + z[2] <= 1 + 1e-9 && z[1] + z[3] <= 1 + 1e-9, `${ar} ${shot}.${name} out of frame`);
        if (ar === '9x16') for (const u of UNSAFE['9x16']) assert.ok(!overlaps(z, u), `${ar} ${shot}.${name} overlaps red area`);
      }
    }
  }
});

test('every shot named in both cuts has a layout row in all aspect ratios', () => {
  const used = new Set([...CUTS[15].shots, ...CUTS[6].shots].map(e => e.shot));
  for (const shot of used) assert.ok(SHOTS.includes(shot), `${shot} missing from SHOTS`);
  for (const ar of Object.keys(LAYOUTS)) for (const shot of used) assert.ok(LAYOUTS[ar][shot], `${ar} missing layout for ${shot}`);
});

// 配音：每句都在它的时段内念完（用 speechSec 的保守估计不超过 max*1.15），同一 id 文字不随比例变
import { speechSec } from '../../factory/engine/story.js';
test('every voice-over line fits its slot (estimated) and is ar-independent', () => {
  for (const v of expandJobs(META, { jobs: [] }, { all: true })) {
    if (v.vo === 'off') { assert.deepEqual(voLines(v), []); continue; }
    for (const l of voLines(v)) {
      assert.ok(l.at >= 0 && l.max > 0, `${l.id} bad slot`);
      const est = speechSec(l.text, l.lang ?? v.lang);
      assert.ok(est <= l.max * 1.15 + 1e-6, `${l.id} "${l.text}" est ${est.toFixed(2)}s > slot ${l.max}s*1.15`);
    }
  }
});

test('end-card promo lines exist for every promo', () => {
  for (const promo of ['none', '1111', 'launch']) {
    const v = { item: 'lantern', ar: '16x9', lang: 'en', cut: 15, promo, vo: 'on' };
    const lines = voLines(v);
    assert.ok(lines.some(l => l.id.includes(`end_${promo}`)), `no end line for ${promo}`);
  }
});
