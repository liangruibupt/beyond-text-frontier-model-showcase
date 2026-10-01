import test from 'node:test';
import assert from 'node:assert/strict';
import { CUTS, GRID, META } from '../meta.js';
import { score, STEP, SWING, BEAT, ARR } from '../js/score.js';
import { VOICES, BUSES } from '../../factory/engine/audio.js';
import { buildCut, shotAt } from '../../factory/engine/timeline.js';

const run = (o = {}) => { const v = { flavor: 'brownsugar', ar: '16x9', lang: 'zh', cut: 15, promo: 'none', vo: 'on', ...o }, built = buildCut(CUTS[v.cut]); return { built, ...score(v, built) }; };
const onGrid = (t, g) => Math.abs(t / g - Math.round(t / g)) < 1e-9;
const near = (a, b) => Math.abs(a - b) < 1e-9;
const each = fn => { for (const flavor of META.axes.flavor) for (const cut of META.axes.cut) fn(flavor, cut, run({ flavor, cut })); };

test('every event is well-formed, inside the film and sorted', () => {
  each((flavor, cut, { built, notes }) => {
    assert.ok(notes.length > cut * 3, `${flavor} ${cut}s: only ${notes.length} notes`);
    for (const e of notes) {
      const where = `${flavor} ${cut}s ${e.voice} at ${e.t}`;
      assert.ok(VOICES[e.voice], `${where}: unknown voice`);
      assert.ok(BUSES.includes(e.bus), `${where}: bus ${e.bus}`);
      for (const k of ['t', 'f', 'd', 'v']) assert.ok(Number.isFinite(e[k]), `${where}: ${k}`);
      assert.ok(e.t >= 0 && e.t + e.d <= built.duration + 1e-9, `${where}: outside the film`);
      assert.ok(e.d > 0 && e.v > 0 && e.v <= 1 && e.f > 20 && e.f < 16000, where);
      assert.ok(Math.abs(e.pan ?? 0) <= 1, `${where}: pan`);
    }
    for (let i = 1; i < notes.length; i++) assert.ok(notes[i].t >= notes[i - 1].t, 'sorted by time');
  });
});

test('every hit is on the 0.75 s grid and a music note starts on it', () => {
  each((flavor, cut, { built, notes }) => {
    for (const [name, t] of Object.entries(built.hits)) {
      assert.ok(onGrid(t, GRID), `${cut}s ${name} off grid`);
      assert.ok(notes.some(e => e.bus === 'music' && near(e.t, t)), `${flavor} ${cut}s: no music onset on ${name} at ${t}`);
    }
  });
});

test('music notes sit on the sixteenth grid; the lo-fi swing lands on the last triplet of the beat', () => {
  each((flavor, cut, { notes }) => {
    for (const e of notes.filter(e => e.bus === 'music')) {
      const swung = flavor === 'brownsugar' && onGrid(((e.t % BEAT) + BEAT) % BEAT - 2 * SWING + 1e-12, BEAT);
      assert.ok(onGrid(e.t, STEP) || swung || (flavor === 'brownsugar' && onGrid(e.t - (2 * SWING - BEAT / 2), BEAT)), `${flavor} ${cut}s ${e.voice} at ${e.t}`);
    }
  });
});

test('the melody and percussion stop when the end card starts; the logo motif plays', () => {
  each((flavor, cut, { built, notes }) => {
    const end = shotAt(built, 'end').start;
    const late = notes.filter(e => e.t > end + 1e-9 && e.bus === 'music' && (e.voice === 'click' || (e.voice === 'noise' && e.p.type === 'highpass')));
    assert.deepEqual(late.map(e => `${e.voice}@${e.t}`), [], `${flavor} ${cut}s`);
    assert.equal(notes.filter(e => e.voice === 'bell' && e.t >= built.hits.logo - 1e-9 && e.t < built.hits.logo + BEAT + 1e-9 && e.v > 0.4).length, 3, `${flavor} ${cut}s: logo motif`);
  });
});

test('deterministic, the same in both languages, and a different arrangement for every flavour', () => {
  const sig = {};
  for (const flavor of META.axes.flavor) {
    const a = JSON.stringify(run({ flavor }).notes);
    assert.equal(JSON.stringify(run({ flavor }).notes), a);
    assert.equal(JSON.stringify(run({ flavor, lang: 'en' }).notes), a, `${flavor}: language must not change the music`);
    sig[flavor] = a;
    assert.ok(ARR[flavor], `${flavor} has an arrangement`);
  }
  const ids = Object.keys(sig);
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) assert.notEqual(sig[ids[i]], sig[ids[j]], `${ids[i]} and ${ids[j]} share a score`);
  // 听起来不一样：调（主音）两两不同；每款的「签名」——音色 × 用量的分布——两两不同；密度按风格排：草莓最密、芋泥最疏
  assert.equal(new Set(ids.map(f => ARR[f].key)).size, ids.length, 'every flavour in its own key');
  const mix = f => { const c = {}; for (const e of run({ flavor: f }).notes) if (e.bus === 'music') c[e.voice] = (c[e.voice] ?? 0) + 1; return JSON.stringify(Object.entries(c).sort()); };
  assert.equal(new Set(ids.map(mix)).size, ids.length);
  const dens = f => run({ flavor: f }).notes.filter(e => e.bus === 'music').length;
  assert.ok(dens('strawberry') > dens('brownsugar') && dens('brownsugar') > dens('taro'), `density ${ids.map(f => `${f} ${dens(f)}`).join(', ')}`);
  assert.ok(dens('strawberry') > dens('jasmine') && dens('jasmine') > dens('taro'), `density ${ids.map(f => `${f} ${dens(f)}`).join(', ')}`);
});
