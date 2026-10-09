import test from 'node:test';
import assert from 'node:assert/strict';
import { META, CUTS } from '../meta.js';
import { LAYOUTS } from '../layouts.js';
import { layersFor } from '../captions.js';
import { ASPECTS, MIN_TEXT, expandJobs } from '../../factory/engine/variant.js';
import { prepareLayer, layout, approxMeasure } from '../../factory/engine/text.js';

// 每个变体 × 每个镜头 × 每个文字层，用偏宽的字宽模型排版：必须放得下，且不低于最小字号
// （三种比例、两种语言、三件商品、三种促销、两种时长）
test('every text layer fits its zone at or above the minimum size', () => {
  let n = 0;
  const bad = [];
  for (const v of expandJobs(META, { jobs: [] }, { all: true })) {
    const [W, H] = ASPECTS[v.ar];
    for (const e of CUTS[v.cut].shots) {
      const row = LAYOUTS[v.ar][e.shot];
      for (const spec of layersFor(v, { name: e.shot, from: e.from ?? 0, dur: e.dur, row, stockLeft: 24 })) {
        if (!spec.text) continue;   // 片尾卡底板（panel，无文字）跳过
        const L = prepareLayer(spec, { lt: 99, zones: row.zones, W, H, minFrac: MIN_TEXT[v.ar] }), r = layout(approxMeasure, L);
        n++;
        if (r.overflow) bad.push(`${v.ar} ${v.item} ${v.lang} ${v.promo} ${v.cut}s ${e.shot}.${spec.id}: "${spec.text}"`);
        assert.ok(r.size >= L.min - 1e-9, `${v.ar} ${e.shot}.${spec.id} below min`);
      }
    }
  }
  assert.deepEqual(bad, []);
  assert.ok(n > 200, `only ${n} layouts checked`);
});
