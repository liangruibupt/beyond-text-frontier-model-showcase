import test from 'node:test';
import assert from 'node:assert/strict';
import { bake, sampleBake, sampleInto, sampleRange } from '../engine/bake.js';
import { mulberry32 } from '../engine/rng.js';

// 一颗球：[y, vy]，重力 + 地面反弹（恢复系数 0.6）
const G = 9.8;
const ball = { seed: 1, dt: 1 / 240, t1: 2, init: () => [1, 0], step(s, dt) {
  s[1] -= G * dt; s[0] += s[1] * dt;
  if (s[0] < 0) { s[0] = -s[0] * 0.6; s[1] = -s[1] * 0.6; }
} };

// 带随机扰动的小系统：每步从 rng 取一个数
const noisy = { seed: 7, dt: 0.01, t1: 1, init: rng => [rng(), rng(), rng()], step(s, dt, rng) { for (let i = 0; i < 3; i++) s[i] += (rng() - 0.5) * dt; } };

const bytes = tb => Buffer.from(tb.data.buffer, tb.data.byteOffset, tb.data.byteLength);

test('two bakes with the same args are byte-identical', () => {
  for (const cfg of [ball, noisy]) assert.ok(bytes(bake(cfg)).equals(bytes(bake(cfg))));
  assert.ok(!bytes(bake(noisy)).equals(bytes(bake({ ...noisy, seed: 8 }))), 'seed must matter');
});

test('stored count = ceil(t1/dt) + 1, or ceil(steps/stride) + 1 with a stride', () => {
  const a = bake(ball);
  assert.equal(a.count, Math.ceil(2 / (1 / 240)) + 1); assert.equal(a.count, 481);
  assert.equal(a.data.length, a.count * a.size);
  const b = bake({ ...noisy, dt: 0.03 });                 // 1 / 0.03 = 33.3 → 34 步
  assert.equal(b.count, 35);
  const c = bake({ ...noisy, stride: 4 });                // 100 步，每 4 步一帧
  assert.equal(c.count, 26); assert.equal(c.steps, 100);
  const d = bake({ ...noisy, stride: 3 });                // 100 步 → 补齐到 102 步，35 帧
  assert.equal(d.count, 35); assert.equal(d.steps, 102);
  for (const k of ['dt', 't1', 'stride', 'count', 'size', 'bakeMs']) assert.equal(typeof a[k], 'number', k);
  assert.equal(bake({ ...noisy, t1: 0 }).count, 1);
});

test('stride stores the same states as every-step baking', () => {
  const all = bake(noisy), s4 = bake({ ...noisy, stride: 4 });
  for (let j = 0; j < s4.count; j++)
    assert.deepEqual(s4.data.subarray(j * 3, j * 3 + 3), all.data.subarray(j * 4 * 3, j * 4 * 3 + 3));
});

test('sampling exactly at a node equals the stored state', () => {
  const tb = bake(ball);
  for (const j of [0, 1, 17, 240, 479, 480])
    assert.deepEqual(sampleBake(tb, j * tb.dt), tb.data.subarray(j * tb.size, (j + 1) * tb.size));
});

test('between nodes it interpolates linearly', () => {
  const tb = bake(noisy), j = 42, a = tb.data.subarray(j * 3, j * 3 + 3), b = tb.data.subarray(j * 3 + 3, j * 3 + 6);
  const s = sampleBake(tb, (j + 0.25) * tb.dt);
  for (let i = 0; i < 3; i++) assert.ok(Math.abs(s[i] - (a[i] + (b[i] - a[i]) * 0.25)) < 1e-6);
});

test('out-of-order and reverse sampling equal in-order sampling', () => {
  const tb = bake(noisy), ts = [];
  for (let t = 0; t <= 1; t += 1 / 30) ts.push(t);
  const fwd = ts.map(t => Array.from(sampleBake(tb, t)));
  const rev = [...ts].reverse().map(t => Array.from(sampleBake(tb, t))).reverse();
  const r = mulberry32(3), order = ts.map((_, i) => i).sort(() => r() - 0.5), mix = [];
  const out = new Float32Array(3);
  for (const i of order) mix[i] = Array.from(sampleInto(tb, ts[i], out));
  assert.deepEqual(rev, fwd); assert.deepEqual(mix, fwd);
});

test('t < 0 and t > t1 clamp to the ends', () => {
  const tb = bake(ball);
  assert.deepEqual(sampleBake(tb, -3), sampleBake(tb, 0));
  assert.deepEqual(sampleBake(tb, 99), sampleBake(tb, 2));
  assert.deepEqual(sampleBake(tb, 99), tb.data.subarray((tb.count - 1) * 2));
  assert.deepEqual(sampleBake(tb, NaN), sampleBake(tb, 0));
});

test('sampleRange reads one item without touching the rest of out', () => {
  const tb = bake(noisy), out = new Float32Array([9, 9, 9]);
  sampleRange(tb, 0.37, 1, 2, out);
  const full = sampleBake(tb, 0.37);
  assert.deepEqual([out[0], out[1], out[2]], [full[1], full[2], 9]);
});

test('step receives an rng whose sequence is reproducible from the seed', () => {
  const seen = cfg => { const xs = []; bake({ ...cfg, step: (s, dt, rng) => { xs.push(rng()); } }); return xs; };
  const a = seen(noisy);
  assert.deepEqual(seen(noisy), a);
  const r = mulberry32(7); r(); r(); r();                 // init 先取了 3 个
  assert.deepEqual(a.slice(0, 5), [r(), r(), r(), r(), r()]);
  const ts = []; bake({ ...noisy, step: (s, dt, rng, t) => ts.push(t) });
  assert.equal(ts.length, 100); assert.equal(ts[0], 0); assert.ok(Math.abs(ts[99] - 0.99) < 1e-12);
});

test('a ball under gravity falls, bounces and settles', () => {
  const tb = bake(ball), y = t => sampleBake(tb, t)[0];
  const tHit = Math.sqrt(2 / G);                          // ≈ 0.452 s
  assert.ok(Math.abs(y(0.3) - (1 - 0.5 * G * 0.09)) < 0.01, `free fall y(0.3)=${y(0.3)}`);
  for (let i = 0; i < tb.count; i++) assert.ok(tb.data[i * 2] >= 0, 'never below the floor');
  let peak = 0; for (let t = tHit + 0.02; t < tHit + 0.6; t += 0.005) peak = Math.max(peak, y(t));
  assert.ok(peak > 0.25 && peak < 0.45, `first bounce peak ${peak} ≈ 0.36`);
  assert.ok(y(2) < 0.05, `settled near the floor: ${y(2)}`);
});

test('60 bodies for 2.5 s at dt=1/240 bake fast and deterministically', () => {
  // 60 颗球落进圆筒：球-球 + 球-筒壁 + 筒底碰撞；物理写在测试里，引擎不带具体物理
  const N = 60, R = 0.04, CUP = 0.3, E = 0.3;
  const cfg = { seed: 5, dt: 1 / 240, t1: 2.5,
    init(rng) { const s = new Float32Array(N * 6); for (let i = 0; i < N; i++) { s[i * 6] = (rng() - 0.5) * 0.3; s[i * 6 + 1] = 0.3 + i * 0.03; s[i * 6 + 2] = (rng() - 0.5) * 0.3; } return s; },
    step(s, dt) {
      for (let i = 0; i < N; i++) {
        const o = i * 6; s[o + 4] -= G * dt;
        for (let a = 0; a < 3; a++) s[o + a] += s[o + 3 + a] * dt;
        if (s[o + 1] < R) { s[o + 1] = R; if (s[o + 4] < 0) s[o + 4] *= -E; }
        const rr = Math.hypot(s[o], s[o + 2]), lim = CUP - R;
        if (rr > lim) { const nx = s[o] / rr, nz = s[o + 2] / rr, vn = s[o + 3] * nx + s[o + 5] * nz;
          s[o] = nx * lim; s[o + 2] = nz * lim; if (vn > 0) { s[o + 3] -= (1 + E) * vn * nx; s[o + 5] -= (1 + E) * vn * nz; } }
      }
      for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
        const a = i * 6, b = j * 6, dx = s[b] - s[a], dy = s[b + 1] - s[a + 1], dz = s[b + 2] - s[a + 2], d = Math.hypot(dx, dy, dz);
        if (d >= 2 * R || d === 0) continue;
        const nx = dx / d, ny = dy / d, nz = dz / d, push = (2 * R - d) / 2;
        s[a] -= nx * push; s[a + 1] -= ny * push; s[a + 2] -= nz * push; s[b] += nx * push; s[b + 1] += ny * push; s[b + 2] += nz * push;
        const vn = (s[b + 3] - s[a + 3]) * nx + (s[b + 4] - s[a + 4]) * ny + (s[b + 5] - s[a + 5]) * nz;
        if (vn < 0) { const k = (1 + E) * vn / 2; s[a + 3] += k * nx; s[a + 4] += k * ny; s[a + 5] += k * nz; s[b + 3] -= k * nx; s[b + 4] -= k * ny; s[b + 5] -= k * nz; }
      }
      for (let i = 0; i < N; i++) {                        // 筒底、筒壁最后约束，保证不出杯
        const o = i * 6;
        if (s[o + 1] < R) { s[o + 1] = R; if (s[o + 4] < 0) s[o + 4] *= -E; }
        const rr = Math.hypot(s[o], s[o + 2]), lim = CUP - R;
        if (rr > lim) { const nx = s[o] / rr, nz = s[o + 2] / rr, vn = s[o + 3] * nx + s[o + 5] * nz;
          s[o] = nx * lim; s[o + 2] = nz * lim; if (vn > 0) { s[o + 3] -= (1 + E) * vn * nx; s[o + 5] -= (1 + E) * vn * nz; } }
      }
    } };
  const a = bake(cfg), b = bake(cfg);
  console.log(`bake: ${N} bodies × ${a.steps} steps → ${a.count} frames in ${a.bakeMs.toFixed(1)} ms (${(a.data.byteLength / 1024).toFixed(0)} KB)`);
  assert.ok(a.bakeMs < 3000, `bake took ${a.bakeMs} ms`);
  assert.equal(a.count, 601);
  assert.ok(bytes(a).equals(bytes(b)));
  const end = sampleBake(a, 2.5);
  for (let i = 0; i < N; i++) {
    assert.ok(end[i * 6 + 1] >= R - 1e-3 && end[i * 6 + 1] < 2, `body ${i} y=${end[i * 6 + 1]}`);
    assert.ok(Math.hypot(end[i * 6], end[i * 6 + 2]) <= CUP - R + 1e-3, `body ${i} left the cup: r=${Math.hypot(end[i * 6], end[i * 6 + 2])}`);
  }
});
