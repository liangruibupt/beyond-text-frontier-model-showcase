import test from 'node:test';
import assert from 'node:assert/strict';
import { CUTS, EV, GRID, BAR } from '../meta.js';
import { buildCut } from '../../factory/engine/timeline.js';

const near = (a, b) => Math.abs(a - b) < 1e-9;

test('the 15 s cut is 15 s and the 6 s cut is 6 s, in whole bars', () => {
  for (const [cut, c] of Object.entries(CUTS)) {
    const D = buildCut(c).duration;
    assert.ok(near(D, +cut), `${cut}: ${D}`);
    assert.ok(near(D / BAR, Math.round(D / BAR)) || near(D * 2 / BAR, Math.round(D * 2 / BAR)), `${cut}: ${D} s is not whole or half bars`);
  }
});

test('every hit is on the beat grid and where its shot event happens', () => {
  const at = { land: ['count', EV.land], peak: ['months', EV.peak], cart: ['top', EV.cart], medal: ['title', 0], logo: ['end', 0] };   // title 的命中是闪白那一拍，奖牌随后落下
  for (const [cut, c] of Object.entries(CUTS)) {
    const b = buildCut(c);
    for (const [name, t] of Object.entries(c.hits)) {
      assert.ok(near(t / GRID, Math.round(t / GRID)), `${cut} ${name} ${t} is off the grid`);
      const [shot, lt] = at[name], e = b.entries.find(x => x.shot === shot);
      assert.ok(e, `${cut} ${name}: no ${shot} shot`);
      assert.ok(near(e.start + lt - e.from, t), `${cut} ${name}: the ${shot} event is at ${e.start + lt - e.from}, the hit at ${t}`);
    }
    assert.ok(c.cover > 0 && c.cover < b.duration);
  }
});
