import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FIXTURE, fixtureOf } from './glsl-snapshot.mjs';

// fixtures/refract-03.json 是把折射搬进 factory/engine/refract.js 之前、03 原来的 glass.js 生成的：
// 每一遍的顶点 / 片元源码、defines、程序缓存键、uniform 值、材质开关、焦散网格。逐字节相同 = 画面不变
test('03 generates byte-identical GLSL, uniforms and material state to the pre-engine glass.js, for every SKU', () => {
  const want = JSON.parse(readFileSync(FIXTURE, 'utf8')), got = JSON.parse(JSON.stringify(fixtureOf()));
  assert.deepEqual(Object.keys(got), Object.keys(want));
  for (const sku of Object.keys(want)) {
    for (const pass of ['glass', 'liquid']) for (const k of ['vertexShader', 'fragmentShader'])
      assert.ok(got[sku].passes[pass][k] === want[sku].passes[pass][k], `${sku} ${pass} ${k} changed`);
    want[sku].caustics.forEach((c, i) => { for (const k of ['vertexShader', 'fragmentShader']) assert.ok(got[sku].caustics[i][k] === c[k], `${sku} caustic ${i} ${k} changed`); });
    assert.deepEqual(got[sku], want[sku], sku);
  }
});
