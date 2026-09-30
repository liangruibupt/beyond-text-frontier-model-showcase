import test from 'node:test';
import assert from 'node:assert/strict';
import { bakePearls, pearlAt, settled, releaseAt, SIM } from '../js/pearls.js';
import { PEARL, CUP, EV } from '../meta.js';

const T = bakePearls(), q = [0, 0, 0];
const falling = t => { let n = 0; for (let i = 0; i < PEARL.count; i++) { pearlAt(T, t, i, q); if (q[1] > 0.035) n++; } return n; };
const maxMove = (t0, t1) => {
  const a = [0, 0, 0], b = [0, 0, 0]; let m = 0;
  for (let i = 0; i < PEARL.count; i++) { pearlAt(T, t0, i, a); pearlAt(T, t1, i, b); m = Math.max(m, Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])); }
  return m;
};

test('the bake is deterministic: two bakes are byte-identical', () => {
  const U = bakePearls();
  assert.equal(Buffer.compare(Buffer.from(T.data.buffer), Buffer.from(U.data.buffer)), 0);
});

test('the bake is fast enough to rerun on every flavour switch', () => {
  console.log(`# pearls: ${PEARL.count} × ${Math.ceil(SIM.t1 / SIM.dt)} steps in ${T.bakeMs.toFixed(0)} ms`);
  assert.ok(T.bakeMs < 1500, `${T.bakeMs} ms`);
});

test('pearls pour in one after another and the last lands on the 1.5 s hit', () => {
  assert.equal(releaseAt(PEARL.count - 1), SIM.release[1]);
  assert.equal(falling(0.2), PEARL.count, 'none released yet');
  assert.ok(falling(0.9) > 10 && falling(0.9) < PEARL.count - 10, 'a stream, not a clump');
  assert.equal(falling(EV.land), 0, 'every pearl is down by the land hit');
});

test('every pearl ends inside the cup and the pile comes to rest', () => {
  const s = settled(T);
  assert.deepEqual(s.bad, [], 'pearls outside the cup or under its floor');
  assert.ok(s.top < CUP.height * 0.3, `pile too high: ${s.top}`);
  assert.ok(maxMove(1.8, 2.25) < 0.002, `still moving: ${maxMove(1.8, 2.25)}`);
  for (let i = 0; i < PEARL.count; i++) for (let j = i + 1; j < PEARL.count; j++) {
    const a = pearlAt(T, SIM.t1, i, [0, 0, 0]), b = pearlAt(T, SIM.t1, j, [0, 0, 0]);
    assert.ok(Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) > 1.6 * PEARL.r, `pearls ${i} and ${j} overlap`);
  }
});

test('sampling scrubbed out of order gives the same positions', () => {
  const ts = [2.1, 0.4, 1.5, 0.9, 2.5, 0], seq = ts.map(t => pearlAt(T, t, 7, [0, 0, 0]));
  const rev = [...ts].reverse().map(t => pearlAt(T, t, 7, [0, 0, 0])).reverse();
  assert.deepEqual(seq, rev);
});
