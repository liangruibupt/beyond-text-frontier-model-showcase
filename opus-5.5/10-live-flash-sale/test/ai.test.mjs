// ai.test.mjs — 整片 AI 变体（lantern-ai / headset-ai / beans-ai）的数据约定：
// 默认交付 = 三条 AI 变体；配音复用基准商品；片尾卡在 16:9 挪到左半负空间；shots.json 覆盖 3 商品 × 6 镜头 × 2 比例，
// 片段帧数够剪辑表（含 6 秒版 from 与叠化）用；AI 镜头分流不碰代码版。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { META, CUTS, SHOTS } from '../meta.js';
import { LAYOUTS, countdownSpot, COUNTDOWN_DEFAULT } from '../layouts.js';
import { ITEMS, ITEM_IDS, AI_ITEM_IDS, baseItem, isAiItem } from '../items.js';
import { voLines, overlayText } from '../copy.js';
import { layersFor } from '../captions.js';
import { expandJobs } from '../../factory/engine/variant.js';
import { pickFrame } from '../../factory/engine/video.js';
import { CLIP_MAX, framesUrl } from '../js/world-ai.js';
import { SHOTS_AI } from '../js/shots-ai.js';

const json = rel => JSON.parse(readFileSync(fileURLToPath(new URL(rel, import.meta.url))));
const manifest = json('../manifest.json');
const spec = json('../ai/shots.json');

test('default manifest = the 3 AI variants x 3 deliverables; code variants stay on the axis', () => {
  const jobs = expandJobs(META, manifest);
  assert.equal(jobs.length, 9);
  assert.deepEqual([...new Set(jobs.map(v => v.item))].sort(), ['beans-ai', 'headset-ai', 'lantern-ai']);
  assert.deepEqual(AI_ITEM_IDS.map(baseItem), ['lantern', 'headset', 'beans']);
  for (const id of ['lantern', 'headset', 'beans']) assert.ok(ITEM_IDS.includes(id) && !isAiItem(id), `${id} code variant gone`);
  const want = new Set(['16x9|zh|15|none', '16x9|en|15|launch', '1x1|zh|6|1111']);
  for (const v of jobs) assert.ok(want.has(`${v.ar}|${v.lang}|${v.cut}|${v.promo}`), META.fileName(v));
});

test('AI variants reuse the base item VO files, prices and cart icon', () => {
  for (const id of AI_ITEM_IDS) {
    const b = baseItem(id);
    assert.deepEqual(ITEMS[id].deal, ITEMS[b].deal);
    for (const v of expandJobs(META, { jobs: [{ item: [id], ar: ['16x9'], lang: ['*'], cut: ['*'], promo: ['*'] }] })) {
      const ids = voLines(v).map(l => l.id), base = voLines({ ...v, item: b }).map(l => l.id);
      assert.deepEqual(ids, base);
      assert.equal(overlayText(v, 128000).item, b);
    }
  }
});

test('AI 16:9 end card sits in the left half; 1:1 stays in the lower half; code variants unchanged', () => {
  for (const id of AI_ITEM_IDS) for (const promo of ['none', '1111', 'launch']) for (const lang of ['zh', 'en']) {
    const L169 = layersFor({ item: id, ar: '16x9', lang, cut: 15, promo, vo: 'on' }, { name: 'end', from: 0, dur: 2.5 });
    for (const l of L169) {
      const z = LAYOUTS['16x9'].end.zones[l.zone];
      assert.ok(z, `no zone ${l.zone}`);
      assert.ok(z[0] + z[2] <= 0.5 + 1e-9, `${id} ${promo} ${l.id} zone crosses into the right half`);
    }
    const L11 = layersFor({ item: id, ar: '1x1', lang, cut: 6, promo, vo: 'on' }, { name: 'end', from: 0, dur: 3 });
    for (const l of L11) assert.ok(LAYOUTS['1x1'].end.zones[l.zone][1] >= 0.5 - 1e-9, `${id} 1x1 ${l.id} above the lower half`);
  }
  const code = layersFor({ item: 'lantern', ar: '16x9', lang: 'zh', cut: 15, promo: 'none', vo: 'on' }, { name: 'end', from: 0, dur: 2.5 });
  assert.ok(code.every(l => !l.zone.endsWith('_l')));
});

test('shots.json has a prompt for every item x shot x ar, with no product cross-talk', () => {
  const ids = spec.shots.map(s => s.id);
  assert.deepEqual(ids, SHOTS);
  for (const s of spec.shots) {
    assert.equal((s.frames - 1) % 8, 0, `${s.id} frames not on LTX 8k+1 grid`);
    for (const it of ['lantern', 'headset', 'beans']) for (const ar of ['16x9', '1x1']) {
      const p = s[it]?.[ar];
      assert.ok(typeof p === 'string' && p.length > 200, `${it} ${s.id} ${ar} missing`);
      assert.ok(p.toLowerCase().includes(it === 'beans' ? 'coffee' : it), `${it} ${s.id} ${ar} does not name its product`);
      if (it !== 'lantern') assert.ok(!/lantern/i.test(p), `${it} ${s.id} ${ar} mentions lantern`);
    }
  }
});

test('every clip is long enough for both cuts (incl. 6 s `from` and the dissolve overlap); CLIP_MAX stays inside', () => {
  const frames = Object.fromEntries(spec.shots.map(s => [s.id, s.frames]));
  for (const cut of [15, 6]) for (const e of CUTS[cut].shots) {
    const need = (e.from ?? 0) + e.dur;                // 叠化时前一镜头会被求值到 dur 之后，cue 用 CLIP_MAX 钳住
    const have = frames[e.shot] / spec.fps;
    assert.ok(Math.min(need, CLIP_MAX[e.shot]) <= have, `${cut}s ${e.shot} needs ${need}s, clip has ${have}s`);
    assert.ok(CLIP_MAX[e.shot] < have, `${e.shot} CLIP_MAX beyond clip`);
    assert.ok(need <= CLIP_MAX[e.shot] + 0.06, `${cut}s ${e.shot} would freeze for ${(need - CLIP_MAX[e.shot]).toFixed(2)}s`);
  }
  assert.equal(pickFrame(CLIP_MAX.rain, { frames: frames.rain, fps: spec.fps }) < frames.rain, true);
});

test('AI shot table covers every shot and frames resolve to the base item folder', () => {
  for (const s of SHOTS) assert.equal(typeof SHOTS_AI[s], 'function');
  assert.equal(framesUrl('beans-ai'), '/10-live-flash-sale/out/ai/beans/frames');
});

test('AI 变体的倒计时数字和「上链接！」不压主播的脸（脸 ≈ 画面中间 x 0.3–0.7、y < 0.62）', () => {
  const inFace = ([x, y]) => x > 0.3 && x < 0.7 && y < 0.62;
  for (const ar of ['16x9', '1x1']) {
    const s = countdownSpot(ar, true);
    // 数字是方块近似：中心 ± 半个字号（按画面高；16:9 横向再除以宽高比）
    const half = s.size / 2, hx = ar === '16x9' ? half * 9 / 16 : half;
    assert.ok(s.digit[0] + hx < 0.36 || s.digit[0] - hx > 0.64, `${ar}: 数字横向避开脸`);
    assert.ok(!inFace(s.link), `${ar}: 上链接不在脸上`);
    for (const v of [...s.digit, ...s.link]) assert.ok(v > 0 && v < 1);
  }
  assert.deepEqual(countdownSpot('16x9', false), COUNTDOWN_DEFAULT, '代码 3D 版位置不变');
});
