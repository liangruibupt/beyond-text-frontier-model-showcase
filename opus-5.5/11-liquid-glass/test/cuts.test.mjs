import test from 'node:test';
import assert from 'node:assert/strict';
import { CUTS, EV, BEAT, BAR, SHOTS } from '../meta.js';
import { buildCut } from '../../factory/engine/timeline.js';

const near = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;

test('the 15 s cut is 15 s and the 6 s cut is 6 s, in whole bars', () => {
  for (const [cut, c] of Object.entries(CUTS)) {
    const D = buildCut(c).duration;
    assert.ok(near(D, +cut), `${cut}: ${D}`);
    assert.ok(near(D / BAR, Math.round(D / BAR)), `${cut}: ${D} s is not whole bars`);
    for (const e of c.shots) assert.ok(SHOTS.includes(e.shot), e.shot);
  }
});

test('every hit is on the beat grid and where its shot event happens', () => {
  const at = { pop1: ['wall', EV.pops[0]], pop2: ['wall', EV.pops[1]], pop3: ['wall', EV.pops[2]], tick: ['lens', EV.tick], merge: ['flow', EV.merge], sweep: ['sweep', EV.sweep], logo: ['end', 0] };
  for (const [cut, c] of Object.entries(CUTS)) {
    const b = buildCut(c);
    for (const [name, t] of Object.entries(c.hits)) {
      assert.ok(near(t / BEAT, Math.round(t / BEAT)), `${cut} ${name} ${t} is off the grid`);
      const [shot, lt] = at[name], e = b.entries.find(x => x.shot === shot);
      assert.ok(e, `${cut} ${name}: no ${shot} shot`);
      assert.ok(near(e.start + lt - e.from, t), `${cut} ${name}: the ${shot} event is at ${e.start + lt - e.from}, the hit at ${t}`);
    }
    assert.ok(c.cover > 0 && c.cover < b.duration);
  }
});

test('the 6 s cut keeps each shot event inside its trimmed window', () => {
  for (const e of buildCut(CUTS[6]).entries) {
    const ev = { lens: EV.tick, flow: EV.merge, end: EV.card }[e.shot];
    assert.ok(ev >= e.from && ev < e.dur, `${e.shot}: event at ${ev} is outside [${e.from}, ${e.dur})`);
  }
});
