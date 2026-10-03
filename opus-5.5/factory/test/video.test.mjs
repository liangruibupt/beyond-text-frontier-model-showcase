// video.test.mjs — 「视频背景」图层的纯函数：按故事时间取帧要确定、单调、钳进范围；clipKey 命名；manifest 校验。
// draw / load 要浏览器（document / Image / WebGL），不在这里测；由 08 的引擎渲染路径（render.mjs）覆盖。
import test from 'node:test';
import assert from 'node:assert/strict';
import { pickFrame, clipKey, loadManifest } from '../engine/video.js';

test('pickFrame: story time -> frame index, deterministic and clamped', () => {
  const m = { frames: 73, fps: 24 };
  assert.equal(pickFrame(0, m), 0);
  assert.equal(pickFrame(1 / 24, m), 1);           // 恰好一帧
  assert.equal(pickFrame(0.49 / 24, m), 0);        // 四舍五入到最近帧
  assert.equal(pickFrame(0.5 / 24, m), 1);
  assert.equal(pickFrame(-5, m), 0);               // 负时间钳到 0
  assert.equal(pickFrame(1e6, m), 72);             // 超出钳到最后一帧
  assert.equal(pickFrame(100, m), 72);
});

test('pickFrame is a pure function of (lt): same lt -> same frame, monotonic non-decreasing', () => {
  const m = { frames: 89, fps: 24 };
  let prev = -1;
  for (let lt = 0; lt <= 4; lt += 0.013) {
    const a = pickFrame(lt, m), b = pickFrame(lt, m);
    assert.equal(a, b, `determinism at ${lt}`);
    assert.ok(a >= prev, `monotonic at ${lt}: ${a} < ${prev}`);
    prev = a;
  }
});

test('clipKey = <shot>_<ar>, matching beans-gen.py frame directory names', () => {
  assert.equal(clipKey('roast', '16x9'), 'roast_16x9');
  assert.equal(clipKey('pour', '1x1'), 'pour_1x1');
});

test('loadManifest validates frames/fps and surfaces a clear error', async () => {
  const ok = { frames: 73, fps: 24 };
  const fakeFetch = body => async () => ({ ok: true, status: 200, json: async () => body });
  assert.deepEqual(await loadManifest('base', 'roast_16x9', { fetchImpl: fakeFetch(ok) }), ok);
  await assert.rejects(() => loadManifest('base', 'x', { fetchImpl: async () => ({ ok: false, status: 404 }) }), /no manifest/);
  await assert.rejects(() => loadManifest('base', 'x', { fetchImpl: fakeFetch({ frames: 0, fps: 24 }) }), /bad manifest/);
});
