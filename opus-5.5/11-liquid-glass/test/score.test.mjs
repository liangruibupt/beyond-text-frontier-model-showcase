import test from 'node:test';
import assert from 'node:assert/strict';
import { CUTS, EV, BAR, BEAT, META } from '../meta.js';
import { score, THEMES, LOGO, STEP } from '../js/score.js';
import { SWEEP } from '../js/motion.js';
import { VOICES, BUSES, mtof } from '../../factory/engine/audio.js';
import { buildCut, shotAt } from '../../factory/engine/timeline.js';

const V = (o = {}) => ({ theme: 'iris', ar: '16x9', lang: 'zh', cut: 15, promo: 'none', vo: 'on', ...o });
const run = o => { const v = V(o), built = buildCut(CUTS[v.cut]); return { built, ...score(v, built) }; };
const onGrid = (t, g) => Math.abs(t / g - Math.round(t / g)) < 1e-9;
const near = (a, b) => Math.abs(a - b) < 1e-9;
const each = fn => { for (const theme of META.axes.theme) for (const cut of META.axes.cut) fn(theme, cut, run({ theme, cut })); };
const at = (e, lt) => e.start + lt - e.from;

test('every theme has a tonic, a glass timbre, a reverb and an air bed', () => {
  for (const theme of META.axes.theme) {
    const c = THEMES[theme];
    assert.ok(c, `no score for ${theme}`);
    assert.ok(Number.isInteger(c.tonic) && c.reverb.decay > 0 && c.glass.ratios.length && c.bed.v > 0, theme);
  }
});

test('every event is well-formed and inside the film', () => {
  each((theme, cut, { built, notes }) => {
    assert.ok(notes.length > 20);
    for (const e of notes) {
      const where = `${theme} ${cut}s ${e.voice} at ${e.t}`;
      assert.ok(VOICES[e.voice], `${where}: unknown voice`);
      assert.ok(BUSES.includes(e.bus), `${where}: bus ${e.bus}`);
      for (const k of ['t', 'f', 'd', 'v']) assert.ok(Number.isFinite(e[k]), `${where}: ${k} = ${e[k]}`);
      assert.ok(e.t >= 0 && e.t < built.duration, `${where}: outside 0…${built.duration}`);
      assert.ok(e.d > 0 && e.v > 0 && e.v <= 1 && e.f > 20 && e.f < 16000, `${where}: d ${e.d} v ${e.v} f ${e.f}`);
      assert.ok(e.pan === undefined || Math.abs(e.pan) <= 1);
      // 玻璃钟最高的分音不逼近 AAC 的上限（再高，编码后过冲）
      if (e.voice === 'bell') assert.ok(e.f * Math.max(...(e.p.ratios ?? [5.43])) < 15000, `${where}: top partial ${Math.round(e.f * Math.max(...(e.p.ratios ?? [5.43])))} Hz`);
    }
    for (let i = 1; i < notes.length; i++) assert.ok(notes[i].t >= notes[i - 1].t, 'sorted by time');
  });
});

test('hits are on the beat and the music lands on each of them; the logo is on a downbeat', () => {
  each((theme, cut, { built, notes }) => {
    for (const [name, t] of Object.entries(built.hits)) {
      assert.ok(onGrid(t, BEAT), `${theme} ${cut}s hit ${name} at ${t} is off the beat`);
      assert.ok(notes.some(e => e.bus === 'music' && near(e.t, t)), `${theme} ${cut}s: no music onset on the ${name} hit at ${t}`);
    }
    assert.ok(onGrid(built.hits.logo, BAR), `${theme} ${cut}s: the logo is not on a downbeat`);
  });
});

test('music onsets sit on the sixteenth-note grid', () => {
  each((theme, cut, { notes }) => {
    for (const e of notes.filter(e => e.bus === 'music')) assert.ok(onGrid(e.t, STEP), `${theme} ${cut}s: ${e.voice} at ${e.t}`);
  });
});

test('the sonic logo: same intervals from the tonic in every theme, on the sfx bus at the logo hit', () => {
  each((theme, cut, { built, notes }) => {
    const t = built.hits.logo, tonic = THEMES[theme].tonic;
    const logo = notes.filter(e => e.bus === 'sfx' && e.voice === 'pluck' && e.t >= t - 1e-9 && e.t < t + BAR / 2);
    assert.deepEqual(logo.map(e => e.t - t), [0, 0.375, 0.75], `${theme} ${cut}s logo rhythm`);
    logo.forEach((e, i) => assert.ok(Math.abs(e.f - mtof(tonic + LOGO[i])) < 1e-6, `${theme} ${cut}s logo note ${i}`));
  });
});

test('sound effects follow the picture: pops, the minute flip, the merge, the sweep, transitions, bed', () => {
  const sfxAt = (notes, voice, t) => notes.some(e => e.bus === 'sfx' && e.voice === voice && near(e.t, t));
  for (const cut of [15, 6]) {
    const { built, notes } = run({ cut }), lens = shotAt(built, 'lens'), flow = shotAt(built, 'flow');
    assert.ok(sfxAt(notes, 'click', at(lens, EV.tick)), `${cut}s: click on the minute flip`);
    assert.ok(sfxAt(notes, 'plink', at(flow, EV.merge)), `${cut}s: plink as the drops merge`);
    assert.ok(notes.some(e => e.voice === 'noise' && near(e.t, 0) && near(e.d, built.duration)), `${cut}s: bed over the whole film`);
    for (const e of built.entries.filter(e => e.transition.type !== 'cut')) assert.ok(sfxAt(notes, 'noise', e.start + e.transition.dur / 2 - 0.4), `${cut}s: whoosh into ${e.shot}`);
  }
  const { built, notes } = run(), wall = shotAt(built, 'wall'), sweep = shotAt(built, 'sweep');
  for (const lt of EV.pops) assert.ok(sfxAt(notes, 'plink', at(wall, lt)), `plink as a widget lands at ${lt}`);
  const swish = notes.find(e => e.bus === 'sfx' && e.voice === 'noise' && near(e.t, at(sweep, SWEEP.t[0])));
  assert.ok(swish, 'swish as the sheet sweeps');
  assert.ok(near(swish.t + swish.p.a, at(sweep, EV.sweep)), 'the swish peaks as the edge crosses the midline');
  assert.ok(!run({ cut: 6 }).notes.some(e => e.bus === 'sfx' && e.voice === 'plink' && e.t < at(shotAt(buildCut(CUTS[6]), 'flow'), EV.merge) - 1e-9), 'the 6 s cut has no wall, so no pops');
});

test('the 6 s cut has its own arrangement, not a slice of the 15 s one', () => {
  for (const theme of META.axes.theme) {
    const key = e => `${e.voice}|${e.f.toFixed(3)}|${e.d.toFixed(4)}`, music = n => n.filter(e => e.bus === 'music');
    const long = music(run({ theme }).notes), short = music(run({ theme, cut: 6 }).notes);
    const has = new Set(long.map(e => `${key(e)}|${e.t.toFixed(4)}`));
    for (const shift of new Set(long.map(e => e.t))) {
      const hit = short.filter(e => has.has(`${key(e)}|${(e.t + shift).toFixed(4)}`)).length;
      assert.ok(hit < short.length * 0.5, `${theme}: ${hit}/${short.length} of the 6 s notes appear in the 15 s cut shifted by ${shift} s`);
    }
  }
});

test('the themes differ only in key and colour: same rhythm, the melody moved by the tonic', () => {
  const a = run(), T = THEMES.iris.tonic, music = n => n.filter(e => e.bus === 'music' && e.voice !== 'noise');
  for (const theme of ['dawn', 'mint']) {
    const b = run({ theme }), k = Math.pow(2, (THEMES[theme].tonic - T) / 12);
    assert.deepEqual(music(b.notes).map(e => e.t), music(a.notes).map(e => e.t), theme);
    music(b.notes).forEach((e, i) => assert.ok(Math.abs(e.f / music(a.notes)[i].f - k) < 1e-9, `${theme} note ${i}`));
  }
});

test('deterministic, and the aspect ratio, language and promo do not change the sound', () => {
  const a = run();
  assert.deepEqual(run(), a);
  for (const o of [{ ar: '9x16' }, { ar: '1x1' }, { lang: 'en' }, { promo: '1111' }, { promo: 'launch' }]) assert.deepEqual(run(o).notes, a.notes, JSON.stringify(o));
});
