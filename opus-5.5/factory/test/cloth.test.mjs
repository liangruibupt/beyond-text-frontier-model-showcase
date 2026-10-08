import test from 'node:test';
import assert from 'node:assert/strict';
import { bakeCloth, clothAt, clothIndex, maxStretch } from '../engine/cloth.js';

const drape = (extra = {}) => bakeCloth({
  nx: 24, ny: 24, size: [0.6, 0.6], origin: [0, 0.6, 0], t1: 1.5, seed: 3,
  colliders: [{ type: 'sphere', c: [0, 0.35, 0], r: 0.12 }, { type: 'ground', y: 0 }], ...extra,
});
const at = (c, t) => clothAt(c, t, new Float32Array(c.n * 3));

test('baking is deterministic and samples identically in any order', () => {
  const a = drape(), b = drape();
  assert.deepEqual(a.table.data, b.table.data);
  const ts = [0, 0.31, 0.77, 1.2, 1.5], fwd = ts.map(t => at(a, t).join()), rev = [...ts].reverse().map(t => at(a, t).join()).reverse();
  assert.deepEqual(fwd, rev);
});

test('a dropped square drapes over a sphere: it falls, does not pass through, barely stretches', () => {
  const c = drape(), P = at(c, 1.5);
  const ys = []; for (let k = 1; k < P.length; k += 3) ys.push(P[k]);
  assert.ok(Math.min(...ys) < 0.3, 'the edges fall below the top of the sphere');
  for (let k = 0; k < P.length; k += 3) {
    const d = Math.hypot(P[k], P[k + 1] - 0.35, P[k + 2]);
    assert.ok(d > 0.12, `vertex ${k / 3} inside the sphere (d=${d.toFixed(4)})`);
    assert.ok(P[k + 1] > -1e-6, 'above the ground');
  }
  assert.ok(maxStretch(c, P) < 0.03, `stretch ${maxStretch(c, P)}`);
});

test('pins follow their script and release after until', () => {
  const c = bakeCloth({ nx: 16, ny: 16, size: [0.4, 0.4], origin: [0, 1, 0], t1: 1, seed: 1,
    pins: [{ i: 0, j: 0, pos: t => [-0.2 + 0.1 * t, 1 + 0.2 * t, -0.2] }, { i: 15, j: 0, pos: () => [0.2, 1, -0.2], until: 0.5 }] });
  const P = at(c, 0.8), k0 = 0, k1 = 15 * 3;
  assert.deepEqual([P[k0], P[k0 + 1], P[k0 + 2]].map(x => +x.toFixed(5)), [-0.12, 1.16, -0.2]);
  assert.ok(P[k1 + 1] < 0.99, 'the released corner falls');
});

test('wind lifts a pinned square; the cylinder and capsule colliders hold cloth off them', () => {
  const pinTop = [{ i: 0, j: 0, pos: () => [-0.15, 1, 0] }, { i: 11, j: 0, pos: () => [0.15, 1, 0] }];
  const rest = (i, j) => [-0.15 + (i / 11) * 0.3, 1 - (j / 11) * 0.3, 0];
  const still = bakeCloth({ nx: 12, ny: 12, rest, pins: pinTop, t1: 1, seed: 2 });
  const blown = bakeCloth({ nx: 12, ny: 12, rest, pins: pinTop, t1: 1, seed: 2, wind: (x, y, z, t, o) => { o[0] = 0; o[1] = 0; o[2] = 6; } });
  const z = c => { const P = at(c, 1); let s = 0; for (let k = 2; k < P.length; k += 3) s += P[k]; return s / c.n; };
  assert.ok(z(blown) > z(still) + 0.05, 'the wind pushes the cloth downwind');
  const wrap = bakeCloth({ nx: 16, ny: 16, size: [0.4, 0.4], origin: [0, 0.5, 0], t1: 1, seed: 4,
    colliders: [{ type: 'cylinder', c: [0, 0, 0], r: 0.08, y0: 0, y1: 0.45 }, { type: 'capsule', a: [-0.3, 0.45, 0], b: [0.3, 0.45, 0], r: 0.02 }] });
  const P = at(wrap, 1);
  for (let k = 0; k < P.length; k += 3) if (P[k + 1] >= 0 && P[k + 1] <= 0.45) assert.ok(Math.hypot(P[k], P[k + 2]) > 0.08, 'outside the cylinder');
});

test('a 40 × 40 scarf bakes 2.5 s in under 1.5 s; index covers every cell', () => {
  const c = bakeCloth({ nx: 40, ny: 40, size: [0.7, 0.7], t1: 2.5, seed: 5, colliders: [{ type: 'sphere', c: [0, 0.7, 0], r: 0.15 }] });
  assert.ok(c.table.bakeMs < 1500, `bake took ${c.table.bakeMs.toFixed(0)} ms`);
  assert.equal(clothIndex(40, 40).length, 39 * 39 * 6);
});

test('cloth landing on a cylinder top rests on the cap instead of being thrown off the side', () => {
  const c = bakeCloth({ nx: 16, ny: 16, size: [0.3, 0.3], origin: [0, 0.6, 0], t1: 1, seed: 6,
    colliders: [{ type: 'cylinder', c: [0, 0, 0], r: 0.25, y0: 0, y1: 0.5 }] });
  const P = at(c, 1);
  for (let k = 1; k < P.length; k += 3) assert.ok(P[k] > 0.49, `vertex ${(k - 1) / 3} slid off (y=${P[k].toFixed(3)})`);
  for (const t of [0.2, 0.25, 0.3, 0.5]) assert.ok(maxStretch(c, at(c, t)) < 0.03, `no spike at t=${t}`);
});
