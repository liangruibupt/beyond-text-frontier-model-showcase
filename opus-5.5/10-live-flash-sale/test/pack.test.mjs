import test from 'node:test';
import assert from 'node:assert/strict';
import { chrome } from '../js/pack/chrome.js';
import { danmaku, conveyor } from '../js/pack/danmaku.js';
import { countdown } from '../js/pack/countdown.js';
import { cart, spring } from '../js/pack/cart.js';
import { envelopes } from '../js/pack/envelopes.js';
import { stockbar } from '../js/pack/stockbar.js';
import { DANMAKU } from '../copy.js';

const times = [0, 0.25, 0.5, 1.0, 1.5, 2.0, 2.4, 3.0, 5.0, 7.5, 9.5, 12.0, 14.9];
const eq = (a, b) => assert.deepEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)));

// 每个组件：同一 t 两次结果相同（闭式、无逐帧随机）
test('pack components are deterministic at the same t', () => {
  for (const t of times) {
    eq(chrome(t, { dur: 15 }), chrome(t, { dur: 15 }));
    eq(danmaku(t, { lines: DANMAKU.zh, dur: 15 }), danmaku(t, { lines: DANMAKU.zh, dur: 15 }));
    eq(countdown(t, {}), countdown(t, {}));
    eq(cart(t, {}), cart(t, {}));
    eq(envelopes(t, {}), envelopes(t, {}));
    eq(stockbar(t, {}), stockbar(t, {}));
  }
});

// 乱序取样：顺着算和倒着算，逐 t 结果一致（拖动预览 / 转场评估两个镜头时要稳）
test('pack components sample out of order identically', () => {
  const fwd = times.map(t => countdown(t, {}));
  const bwd = [...times].reverse().map(t => countdown(t, {}));
  times.forEach((t, i) => eq(fwd[i], bwd[times.length - 1 - i]));

  const cf = times.map(t => cart(t, {}));
  const cb = [...times].reverse().map(t => cart(t, {}));
  times.forEach((t, i) => eq(cf[i], cb[times.length - 1 - i]));

  const ef = times.map(t => envelopes(t, {}));
  const eb = [...times].reverse().map(t => envelopes(t, {}));
  times.forEach((t, i) => eq(ef[i], eb[times.length - 1 - i]));
});

// 关键时刻落在拍点上（§B / §C 的命中点都在 0.5 s 网格）
test('countdown digits land on their beats', () => {
  // 15 秒版 count：本地拍点 0.5 / 1.0 / 1.5 分别是 3 / 2 / 1
  assert.equal(countdown(0.5, {}).digit.char, '3');
  assert.equal(countdown(1.0, {}).digit.char, '2');
  assert.equal(countdown(1.5, {}).digit.char, '1');
  // 拍点上数字应接近最大且不透明
  for (const b of [0.5, 1.0, 1.5]) { const d = countdown(b + 0.08, {}).digit; assert.ok(d.scale > 0.8 && d.alpha === 1); }
  // 上链接的冲击在 linkAt=2.0 处出现
  assert.ok(countdown(2.1, {}).linkBurst > 0);
  assert.equal(countdown(1.9, {}).linkBurst, 0);
});

test('cart popup is settled by the tap and the badge appears on tap', () => {
  assert.ok(cart(1.0, {}).rise > 0.9);            // riseAt=0，1 秒后基本落定
  assert.equal(cart(0, {}).badge, null);          // 点击前没有角标
  assert.ok(cart(1.5, {}).badge && cart(1.5, {}).tapped);   // tapAt=1.5 起有角标 + 水波
  assert.ok(cart(1.5, {}).ripple);
});

test('envelopes densify then one opens with coins', () => {
  assert.ok(envelopes(0.1, {}).envelopes.length < envelopes(1.0, {}).envelopes.length);   // denseAt 后变密
  assert.equal(envelopes(1.0, {}).coins.length, 0);        // openAt=2.0 前没有金币
  assert.ok(envelopes(2.1, {}).big.open > 0);              // 2.0 起拆开
  assert.ok(envelopes(2.2, {}).coins.length > 0);          // 金币炸开
});

test('stockbar drains 37%->0 and stamps SOLD OUT on its beat', () => {
  assert.ok(Math.abs(stockbar(0, {}).width - 0.37) < 1e-6);
  assert.ok(stockbar(1.5, {}).width < 1e-6);               // drainTo=1.5 掉空
  assert.ok(stockbar(0.75, {}).left < 24 && stockbar(0.75, {}).left > 0);  // 中途件数在跳
  assert.equal(stockbar(1.4, {}).soldout, null);           // soldAt=1.5 前没有印章
  assert.ok(stockbar(1.6, {}).soldout);                    // 1.5 起砸下印章
});

test('chrome viewer count rises monotonically and hearts stay in the top-right band', () => {
  let prev = -1;
  for (const t of times) { const v = chrome(t, { dur: 15 }).viewers; assert.ok(v >= prev); prev = v; }
  for (const hh of chrome(7, { dur: 15 }).hearts) { assert.ok(hh.x >= 0.9 && hh.x <= 0.99); assert.ok(hh.y >= 0.54 && hh.y <= 1.01); }
});

test('danmaku stays in the top 40% band and speeds up in the stock phase', () => {
  for (const d of danmaku(5, { lines: DANMAKU.zh })) assert.ok(d.y <= 0.4 + 1e-9 && d.y >= 0.08 - 1e-9);
  // 加速：stockFrom 之后传送带整体更快 → conveyor(t) 更大，且 stockFrom 之前两者相等
  assert.ok(Math.abs(conveyor(6, { stockFrom: 10.5 }) - conveyor(6, { stockFrom: Infinity })) < 1e-12);  // 提速点之前无差别
  assert.ok(conveyor(13, { stockFrom: 10.5 }) > conveyor(13, { stockFrom: Infinity }) + 1e-6);           // 提速点之后走得更远
  // 单调：传送带只增不减
  let prevP = -1; for (let f = 0; f <= 15 * 30; f++) { const p = conveyor(f / 30, { stockFrom: 10.5 }); assert.ok(p >= prevP - 1e-12); prevP = p; }
});

// 车道内零重叠：任意 1/30 s 的 t、任意两条同车道的胶囊 [x, x+w] 不相交（16:9 与 1:1）
test('no two danmaku pills in the same lane ever overlap (1/30s grid, 16x9 & 1x1)', () => {
  for (const aspect of [16 / 9, 1]) {
    for (let f = 0; f <= 15 * 30; f++) {
      const t = f / 30;
      const list = danmaku(t, { lines: DANMAKU.zh, aspect, stockFrom: 10.5 });
      const byLane = {};
      for (const d of list) (byLane[d.lane] ??= []).push(d);
      for (const lane of Object.keys(byLane)) {
        const arr = byLane[lane].sort((a, b) => a.x - b.x);
        for (let i = 1; i < arr.length; i++) {
          const prev = arr[i - 1], cur = arr[i];
          assert.ok(prev.x + prev.w <= cur.x + 1e-9, `aspect ${aspect} t=${t.toFixed(2)} lane ${lane}: "${prev.text}"(${prev.x.toFixed(3)}+${prev.w.toFixed(3)}) overlaps "${cur.text}"(${cur.x.toFixed(3)})`);
        }
      }
    }
  }
});

test('spring is monotone-ish and settles to 1', () => {
  assert.equal(spring(0), 0);
  assert.ok(Math.abs(spring(5) - 1) < 0.02);
});
