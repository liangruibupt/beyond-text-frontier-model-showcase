import test from 'node:test';
import assert from 'node:assert/strict';
import { CUTS, GRID, META } from '../meta.js';
import { score, STEP, TONIC } from '../js/score.js';
import { VOICES, BUSES } from '../../factory/engine/audio.js';
import { buildCut, shotAt } from '../../factory/engine/timeline.js';

const run = (o = {}) => { const v = { flavor: 'brownsugar', ar: '16x9', lang: 'zh', cut: 15, promo: 'none', vo: 'on', ...o }, built = buildCut(CUTS[v.cut]); return { built, ...score(v, built) }; };
const onGrid = (t, g) => Math.abs(t / g - Math.round(t / g)) < 1e-9;
const near = (a, b) => Math.abs(a - b) < 1e-9;
const cuts = META.axes.cut.map(cut => [cut, run({ cut })]);

test('every event is well-formed, inside the film and sorted', () => {
  for (const [cut, { built, notes }] of cuts) {
    assert.ok(notes.length > cut * 3, `${cut}s: only ${notes.length} notes`);
    for (const e of notes) {
      const where = `${cut}s ${e.voice} at ${e.t}`;
      assert.ok(VOICES[e.voice], `${where}: unknown voice`);
      assert.ok(BUSES.includes(e.bus), `${where}: bus ${e.bus}`);
      for (const k of ['t', 'f', 'd', 'v']) assert.ok(Number.isFinite(e[k]), `${where}: ${k}`);
      assert.ok(e.t >= 0 && e.t + e.d <= built.duration + 1e-9, `${where}: outside the film`);
      assert.ok(e.d > 0 && e.v > 0 && e.v <= 1 && e.f > 20 && e.f < 16000, where);
      assert.ok(Math.abs(e.pan ?? 0) <= 1, `${where}: pan`);
    }
    for (let i = 1; i < notes.length; i++) assert.ok(notes[i].t >= notes[i - 1].t, 'sorted by time');
  }
});

test('every hit is on the 0.75 s grid and a music note starts on it', () => {
  for (const [cut, { built, notes }] of cuts) {
    for (const [name, t] of Object.entries(built.hits)) {
      assert.ok(onGrid(t, GRID), `${cut}s ${name} off grid`);
      assert.ok(notes.some(e => e.bus === 'music' && near(e.t, t)), `${cut}s: no music onset on ${name} at ${t}`);
    }
  }
});

test('music notes sit on the sixteenth-note grid (pearl drops are sfx and follow the bake)', () => {
  for (const [cut, { notes }] of cuts) for (const e of notes.filter(e => e.bus === 'music')) assert.ok(onGrid(e.t, STEP), `${cut}s ${e.voice} at ${e.t}`);
});

test('the melody and percussion stop when the end card starts', () => {
  for (const [cut, { built, notes }] of cuts) {
    const end = shotAt(built, 'end').start;
    const late = notes.filter(e => e.t > end + 1e-9 && e.bus === 'music' && (e.voice === 'click' || (e.voice === 'pluck' && e.f > 300)));
    assert.deepEqual(late.map(e => `${e.voice}@${e.t}`), [], `${cut}s`);
    assert.ok(notes.some(e => e.voice === 'bell' && e.f > 600 && e.t >= built.hits.logo), `${cut}s: logo motif`);
  }
});

test('the score is deterministic and the same for every flavour and language', () => {
  const a = JSON.stringify(run().notes);
  assert.equal(JSON.stringify(run().notes), a);
  for (const flavor of META.axes.flavor) for (const lang of META.axes.lang) assert.equal(JSON.stringify(run({ flavor, lang }).notes), a, `${flavor} ${lang}`);
  assert.ok(TONIC === 65);
});
