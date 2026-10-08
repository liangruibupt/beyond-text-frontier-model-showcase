import test from 'node:test';
import assert from 'node:assert/strict';
import { chrome } from '../js/pack/chrome.js';
import { danmaku } from '../js/pack/danmaku.js';
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
  for (const d of danmaku(5, { lines: DANMAKU.zh, dur: 15 })) assert.ok(d.y <= 0.4 + 1e-9);
  // 加速：同一组弹幕在 stock 段，某条的 x 比常速时更靠左（走得更远）
  const normal = danmaku(5, { lines: DANMAKU.zh, dur: 15, stock: false });
  const fast = danmaku(5, { lines: DANMAKU.zh, dur: 15, stock: true });
  // 两者条数可能不同；比较同一 i 的 x
  const byI = l => Object.fromEntries(l.map(d => [d.i, d.x]));
  const nI = byI(normal), fI = byI(fast);
  let compared = 0;
  for (const i of Object.keys(fI)) if (i in nI) { assert.ok(fI[i] <= nI[i] + 1e-9); compared++; }
  assert.ok(compared > 0);
});

test('spring is monotone-ish and settles to 1', () => {
  assert.equal(spring(0), 0);
  assert.ok(Math.abs(spring(5) - 1) < 0.02);
});
