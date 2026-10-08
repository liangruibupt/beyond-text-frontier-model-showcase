import test from 'node:test';
import assert from 'node:assert/strict';
import { packState } from '../js/pack/state.js';
import { META } from '../meta.js';
import { expandJobs } from '../../factory/engine/variant.js';

// 回归：R1 的 check.mjs determinism 在这些时刻两遍不一致。根因是 overlay 平面当时按「上一帧的相机」摆位
// （attach 在镜头函数里调用，而 applyPose 在镜头返回之后才跑），于是同一 t 顺画 / 倒画得到不同帧。
// R2 把 overlay 的摆位和重绘移到 film.render（相机已 posed），并让图形层数据完全来自纯函数 packState(v, t)。
// 这个测试锁住纯函数这一半：同一 (变体, t) 不论求值顺序，packState 必得同一对象。
const FAIL_15 = [1.5, 4.0, 6.5, 9.3, 11.7];
const FAIL_6 = [1.2, 2.6, 3.15];
const GRID = (dur, step = 0.1) => Array.from({ length: Math.round(dur / step) + 1 }, (_, i) => +(i * step).toFixed(2));

const canon = x => JSON.stringify(x);
const shuffle = (arr, seed = 1) => { const a = [...arr]; let s = seed; for (let i = a.length - 1; i > 0; i--) { s = (s * 1103515245 + 12345) & 0x7fffffff; const j = s % (i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };

test('packState is identical regardless of evaluation order (the R1 determinism bug)', () => {
  for (const v of expandJobs(META, { jobs: [] }, { all: true })) {
    const dur = v.cut === 15 ? 15 : 6;
    const times = [...(v.cut === 15 ? FAIL_15 : FAIL_6), ...GRID(dur)];
    // 正序建立基准
    const base = new Map(times.map(t => [t, canon(packState(v, t))]));
    // 乱序重算，逐 t 对比
    for (const t of shuffle(times, 7)) assert.equal(canon(packState(v, t)), base.get(t), `${META.fileName(v)} t=${t} differs by order`);
    // 倒序再来一遍
    for (const t of [...times].reverse()) assert.equal(canon(packState(v, t)), base.get(t), `${META.fileName(v)} t=${t} differs reversed`);
  }
});

test('packState places exactly the right component in each shot window', () => {
  const v = { item: 'lantern', ar: '16x9', lang: 'zh', cut: 15, promo: 'none', vo: 'on' };
  assert.equal(packState(v, 1.0).shot, 'room');
  assert.equal(packState(v, 3.5).shot, 'count');  assert.ok(packState(v, 3.5).countdown);
  assert.equal(packState(v, 6.0).shot, 'cart');   assert.ok(packState(v, 6.0).cart);
  assert.equal(packState(v, 9.0).shot, 'rain');   assert.ok(packState(v, 9.0).envelopes);
  assert.equal(packState(v, 11.5).shot, 'stock'); assert.ok(packState(v, 11.5).stockbar);
  assert.equal(packState(v, 13.5).shot, 'end');
  // end 镜头外框淡出：不画弹幕
  assert.deepEqual(packState(v, 13.5).danmaku, []);
  // chrome 常驻（非 end 镜头）
  assert.ok(packState(v, 1.0).chrome.hearts.length > 0);
});
