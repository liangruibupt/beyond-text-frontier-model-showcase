import test from 'node:test';
import assert from 'node:assert/strict';
import { EV, SHOTS } from '../meta.js';
import { UI } from '../layouts.js';
import { STATES, MAX_SHAPES, FLOW, APART, SWEEP, POP, pop, stateAt, clockBox, sdShape, sdLayer, sweepEdge, widgetShapes } from '../js/motion.js';
import { ASPECTS } from '../../factory/engine/variant.js';

const ARS = Object.keys(ASPECTS), aspect = ar => ASPECTS[ar][0] / ASPECTS[ar][1];
const at = (name, ar, lt) => stateAt(name, UI[ar], aspect(ar), lt);
const range = (a, b, step) => Array.from({ length: Math.round((b - a) / step) + 1 }, (_, i) => a + i * step);
/** 屏幕坐标 → 画面比例坐标（取景 view 下） */
const toFrame = (view, a, [x, y]) => [0.5 + ((x - view.f[0]) * view.z) / a, 0.5 + (y - view.f[1]) * view.z];

test('pop starts at 0, first reaches 1 at rise, overshoots, and settles', () => {
  assert.equal(pop(0), 0);
  assert.ok(Math.abs(pop(POP.rise) - 1) < 1e-9);
  assert.ok(Math.max(...range(POP.rise, POP.rise + 0.5, 0.01).map(t => pop(t))) > 1.05);
  assert.ok(Math.abs(pop(3) - 1) < 1e-3);
});

test('frames are pure: the same (shot, lt) gives the same state, whatever came before', () => {
  for (const ar of ARS) for (const name of SHOTS) for (const lt of [0, 0.7, 1.5, 2.2, 2.99]) {
    const a = JSON.stringify(at(name, ar, lt));
    at(SHOTS[(SHOTS.indexOf(name) + 1) % SHOTS.length], ar, 3 - lt);
    assert.equal(JSON.stringify(at(name, ar, lt)), a, `${ar} ${name} ${lt}`);
  }
});

test('no layer has more shapes than the shader takes', () => {
  for (const ar of ARS) for (const name of SHOTS) for (const lt of range(0, 3, 0.1)) {
    for (const [k, shapes] of Object.entries(at(name, ar, lt).layers)) assert.ok(shapes.length <= MAX_SHAPES, `${ar} ${name} ${k}`);
  }
});

test('each widget lands on its pop beat, and by the end of wall every widget is in place', () => {
  for (const ar of ARS) {
    const ids = Object.keys(UI[ar].widgets);
    ids.forEach((id, i) => { const T = EV.pops[Math.min(i, EV.pops.length - 1)]; assert.ok(Math.abs(at('wall', ar, T).widgets[id].g - 1) < 1e-9, `${ar}.${id}`); });
    for (const id of ids) assert.ok(Math.abs(at('wall', ar, 2.99).widgets[id].g - 1) < 0.03, `${ar}.${id} is still bouncing`);
  }
});

test('widget glass stays inside the screen even at the top of its overshoot', () => {
  for (const ar of ARS) for (const lt of range(0, 3, 0.02)) {
    for (const s of widgetShapes(UI[ar], at('wall', ar, lt).widgets)) {
      assert.ok(s.c[0] - s.h[0] >= 0 && s.c[0] + s.h[0] <= aspect(ar) && s.c[1] - s.h[1] >= 0 && s.c[1] + s.h[1] <= 1, `${ar} ${lt}`);
    }
  }
});

test('the lens covers both minute digits while the last one flips, and the push-in keeps the whole clock in frame', () => {
  for (const ar of ARS) {
    const cb = clockBox(UI[ar]);
    for (const lt of range(EV.tick - 0.1, EV.tick + 0.3, 0.05)) {
      const F = at('lens', ar, lt), [s] = F.layers.lens;
      for (const x of [cb.min0 + 0.01, cb.min1 - 0.01]) assert.ok(sdShape(s, [x, cb.cy]) < 0, `${ar} ${lt.toFixed(2)}: the lens misses x=${x.toFixed(3)}`);
    }
    assert.equal(at('lens', ar, EV.tick - 0.11).clock.flip, 0);
    assert.equal(at('lens', ar, EV.tick + 0.3).clock.flip, 1);
    for (const lt of range(0, 3, 0.1)) {
      const { view } = at('lens', ar, lt);
      for (const p of [[cb.x0, cb.top], [cb.x1, cb.bottom]]) {
        const [u, v] = toFrame(view, aspect(ar), p);
        assert.ok(u >= 0 && u <= 1 && v >= 0 && v <= 1, `${ar} ${lt.toFixed(1)}: the clock leaves the frame (${u.toFixed(3)}, ${v.toFixed(3)})`);
      }
    }
  }
});

test('the two drops touch on the merge beat with a bridge, stay two drops, and pull apart by the end', () => {
  for (const ar of ARS) {
    const lensAt = lt => { const F = at('flow', ar, lt); return { F, L: { shapes: F.layers.lens, k: F.k.lens } }; };
    const { F, L } = lensAt(EV.merge), [a, b] = F.layers.lens, d = Math.hypot(a.c[0] - b.c[0], a.c[1] - b.c[1]), mid = [(a.c[0] + b.c[0]) / 2, (a.c[1] + b.c[1]) / 2];
    assert.ok(sdLayer(L, mid) < 0, `${ar}: no bridge on the merge beat`);
    assert.ok(d > FLOW.r, `${ar}: the drops are already one circle (${d.toFixed(3)} apart)`);
    for (const lt of range(EV.merge, APART.t, 0.05)) { const [p, q] = lensAt(lt).F.layers.lens; assert.ok(Math.hypot(p.c[0] - q.c[0], p.c[1] - q.c[1]) > FLOW.r * 0.4, `${ar} ${lt}`); }
    for (const lt of range(0, EV.merge - 0.2, 0.05)) { const { F: G, L: M } = lensAt(lt), [p, q] = G.layers.lens; assert.ok(sdLayer(M, [(p.c[0] + q.c[0]) / 2, (p.c[1] + q.c[1]) / 2]) > 0, `${ar} ${lt}: touching too early`); }
    const { F: E, L: M } = lensAt(2.99), [p, q] = E.layers.lens;
    assert.ok(sdLayer(M, [(p.c[0] + q.c[0]) / 2, (p.c[1] + q.c[1]) / 2]) > 0, `${ar}: still joined at the end`);
  }
});

test('the sheet edge crosses the midline on the sweep beat and has covered the screen by the end', () => {
  assert.ok(Math.abs(sweepEdge(EV.sweep) - 0.5) < 1e-9);
  for (const ar of ARS) {
    const a = aspect(ar), bottom = range(0, a, a / 40).map(x => [x, 1]);
    const [s] = at('sweep', ar, 2.99).layers.sheet;
    for (const p of bottom) assert.ok(sdShape(s, p) < 0, `${ar}: the sheet has not reached the bottom at ${p[0].toFixed(2)}`);
    assert.equal(at('sweep', ar, 2.99).view.z, 1);
    const [e] = at('end', ar, 0).layers.sheet;
    for (const p of bottom) assert.ok(sdShape(e, p) < 0, `${ar}: the end sheet leaves a gap`);
    assert.ok(e.c[1] === SWEEP.to);
  }
});

test('the end card forms on its beat and fills its rectangle', () => {
  for (const ar of ARS) {
    assert.equal(at('end', ar, 0).layers.card.length, 0);
    const [x, y, w, h] = UI[ar].card, [c] = at('end', ar, 2.99).layers.card;
    assert.ok(Math.abs(c.h[0] - w / 2) < 1e-3 && Math.abs(c.h[1] - h / 2) < 1e-3, `${ar}: ${c.h}`);
    assert.ok(Math.abs(at('end', ar, EV.card).layers.card[0].h[1] - h / 2) < 1e-9);
    assert.deepEqual(c.c, [x + w / 2, y + h / 2]);
  }
});

test('every shot state names only known shots and layers', () => {
  assert.deepEqual(Object.keys(STATES).sort(), [...SHOTS].sort());
  for (const ar of ARS) for (const name of SHOTS) for (const k of Object.keys(at(name, ar, 1).layers)) assert.ok(['widgets', 'lens', 'sheet', 'card'].includes(k), k);
});
