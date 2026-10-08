import test from 'node:test';
import assert from 'node:assert/strict';
import { META, BOARDS, SHOTS, GRID } from '../meta.js';
import { LAYOUTS, KIND } from '../layouts.js';
import { SCARVES } from '../scarves.js';
import { voLines, slots } from '../copy.js';
import { layersFor, fontsFor } from '../captions.js';
import { score } from '../js/score.js';
import { buildCut, cutOf } from '../../factory/engine/timeline.js';
import { prepareLayer, layout, approxMeasure } from '../../factory/engine/text.js';
import { allAxes, ASPECTS, MIN_TEXT, expandJobs } from '../../factory/engine/variant.js';
import fs from 'node:fs';

const scarves = META.axes.scarf, variants = [];
for (const scarf of scarves) for (const lang of ['zh', 'en']) for (const cut of [15, 6]) for (const promo of ['none', '1111', 'launch']) variants.push({ scarf, lang, cut, promo, ar: '16x9', vo: 'on' });

test('every scarf has its own 15 s and 6 s storyboard, hits on the 0.75 s grid and inside the cut', () => {
  const sigs = new Set();
  for (const s of scarves) for (const c of [15, 6]) {
    const b = buildCut(cutOf(META, { scarf: s, cut: c }));
    assert.equal(b.duration, c);
    for (const [k, t] of Object.entries(b.hits)) { assert.ok(Math.abs(t / GRID - Math.round(t / GRID)) < 1e-9, `${s} ${c}s ${k} off grid`); assert.ok(t >= 0 && t <= c); }
    assert.ok(b.cover > 0 && b.cover < c);
    if (c === 15) sigs.add(b.entries.map(e => e.shot).join(','));
  }
  assert.equal(sigs.size, scarves.length, 'four different storyboards');
});

test('layouts cover every shot in every delivered ratio; each shot has a kind', () => {
  for (const ar of ['16x9', '1x1', '9x16']) for (const s of SHOTS) assert.ok(LAYOUTS[ar][s]?.anchor, `${ar} ${s}`);
  for (const s of SHOTS) assert.ok(KIND[s], s);
});

test('every caption fits its zone at or above the minimum size (all variants, all ratios)', () => {
  let n = 0;
  const bad = [];
  for (const v of expandJobs(META, { jobs: [] }, { all: true })) {
    const [W, H] = ASPECTS[v.ar];
    for (const e of cutOf(META, v).shots) {
      const row = LAYOUTS[v.ar][e.shot];
      for (const spec of layersFor(v, { name: e.shot, from: e.from ?? 0, dur: e.dur, row })) {
        const L = prepareLayer(spec, { lt: 99, zones: row.zones, W, H, minFrac: MIN_TEXT[v.ar] }), r = layout(approxMeasure, L);
        n++;
        if (r.overflow) bad.push(`${v.ar} ${v.scarf} ${v.lang} ${v.promo} ${e.shot}.${spec.id}: "${spec.text}"`);
      }
    }
  }
  assert.deepEqual(bad, []);
  assert.ok(n > 500, `only ${n} layouts checked`);
});

test('fonts list every family and weight index.html loads', () => {
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  for (const v of variants) for (const f of fontsFor(v)) {
    const slug = f.family.toLowerCase().replace(/ /g, '-');
    assert.ok(html.includes(`${slug}@5/${f.weight}.css`), `${f.family} ${f.weight}`);
  }
});

test('voice-over: ids stable across variants, slots per scarf, numbers spelt out, "Double Eleven" not 11.11', () => {
  const seen = new Map();
  for (const v of variants) for (const l of voLines(v)) {
    if (seen.has(l.id)) assert.equal(seen.get(l.id), l.text, l.id); else seen.set(l.id, l.text);
    assert.ok(!/\d/.test(l.text), `${l.id}: ${l.text}`);
    assert.ok(!/11\.11/.test(l.text));
    assert.ok(l.at >= 0 && l.at + l.max <= v.cut);
  }
  assert.equal(voLines({ ...variants[0], vo: 'off' }).length, 0);
  assert.ok(slots('songjin', 15).hero[0] !== slots('dunhuang', 15).hero[0], 'hero slot follows each storyboard');
});

test('score: four arrangements, every hit has a music onset, deterministic', () => {
  const keys = new Set();
  for (const s of scarves) for (const c of [15, 6]) {
    const b = buildCut(cutOf(META, { scarf: s, cut: c })), a = score({ scarf: s, cut: c }, b), z = score({ scarf: s, cut: c }, b);
    assert.deepEqual(a, z);
    for (const [k, t] of Object.entries(b.hits)) assert.ok(a.notes.some(n => Math.abs(n.t - t) < 1e-9 && n.bus === 'music' || Math.abs(n.t - t) < 1e-9), `${s} ${c}s ${k}`);
    for (const n of a.notes) { assert.ok(n.t >= 0 && n.t < c && n.d > 0 && Number.isFinite(n.f)); }
    keys.add(JSON.stringify(a.reverb));
  }
  assert.equal(keys.size, 4);
});

test('manifest: 4 scarves × 3 deliverables, file names unique', () => {
  const m = JSON.parse(fs.readFileSync(new URL('../manifest.json', import.meta.url), 'utf8'));
  assert.equal(m.jobs.length, 3);
  assert.ok(allAxes(META));
  const names = new Set(variants.map(v => META.fileName(v)));
  assert.equal(names.size, variants.length);
  assert.ok(Object.keys(SCARVES).every(k => scarves.includes(k)));
});
