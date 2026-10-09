import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { META, CUTS, SHOTS, GRID, BAR } from '../meta.js';
import { THEMES } from '../themes.js';
import { T, voLines, SLOTS, VOICE, CAP, MILE } from '../copy.js';
import { PROMO_T } from '../promos.js';
import { layersFor, fontsFor } from '../captions.js';
import { LAYOUTS } from '../layouts.js';
import { expandJobs, allAxes } from '../../factory/engine/variant.js';
import { buildCut, shotAt } from '../../factory/engine/timeline.js';
import { offGrid } from '../../factory/engine/mix.js';

const manifest = JSON.parse(readFileSync(new URL('../manifest.json', import.meta.url)));
const every = () => expandJobs(META, { jobs: [] }, { all: true });

test('file names encode every axis that changes the output', () => {
  const v = { theme: 'national', lang: 'en', cut: 6, promo: '1111', ar: '1x1', vo: 'off' };
  assert.equal(META.fileName(v), 'startide_national_6s_1x1_en_1111_novo');
  assert.equal(META.fileName({ ...v, promo: 'none', vo: 'on' }), 'startide_national_6s_1x1_en');
  const names = every().map(META.fileName);
  assert.equal(new Set(names).size, names.length, 'two variants share a file name');
});

test('manifest = the 2 videos the user scoped (national 15s 16x9 zh none + national 6s 1x1 en launch)', () => {
  const jobs = expandJobs(META, manifest);
  assert.equal(jobs.length, 2);
  const kinds = jobs.map(j => `${j.theme} ${j.ar} ${j.cut} ${j.lang} ${j.promo}`).sort();
  assert.deepEqual(kinds, ['national 16x9 15 zh none', 'national 1x1 6 en launch']);
});

test('cuts: lengths add up, shot names known, hits land on the 0.75 s grid, logo = end start', () => {
  assert.equal(BAR, 4 * GRID);
  for (const [c, cut] of Object.entries(CUTS)) {
    const b = buildCut(cut);
    assert.ok(Math.abs(b.duration - Number(c)) < 1e-9, `cut ${c} lasts ${b.duration}`);
    for (const e of cut.shots) assert.ok(SHOTS.includes(e.shot), e.shot);
    assert.deepEqual(offGrid(Object.values(cut.hits), GRID), [], `cut ${c} has off-grid hits`);
    assert.equal(cut.hits.logo, shotAt(b, 'end').start, `cut ${c}: logo hit = end start`);
  }
  const b15 = buildCut(CUTS[15]);
  assert.ok(b15.cover > 0 && b15.cover < 15, '15 s cover in range');
  const s6 = buildCut(CUTS[6]), e6 = shotAt(s6, 'end');
  assert.ok(s6.cover > e6.start + 1.0, '6 s cover must show the end/price card');
});

test('every shot in every cut has a layout row in all three aspect ratios, with the zones its captions use', () => {
  const used = new Set();
  for (const cut of Object.values(CUTS)) for (const e of cut.shots) used.add(e.shot);
  for (const ar of ['9x16', '1x1', '16x9']) {
    for (const shot of used) assert.ok(LAYOUTS[ar][shot], `${ar} missing layout for ${shot}`);
  }
  // 每条字幕图层引用的 zone 必须在该比例该镜头的构图里存在
  for (const v of every().slice(0, 40)) {
    for (const e of CUTS[v.cut].shots) {
      const row = LAYOUTS[v.ar][e.shot];
      for (const L of layersFor(v, { name: e.shot, from: e.from ?? 0, dur: e.dur, row })) {
        assert.ok(row.zones?.[L.zone], `${v.ar} ${e.shot}: layer ${L.id} wants zone ${L.zone}`);
      }
    }
  }
});

test('themes: the four approved ones, each with palette, constellation mode, hubs, milestone text', () => {
  assert.deepEqual(Object.keys(THEMES), ['national', 'megacity', 'crossborder', 'logistics']);
  assert.deepEqual(Object.keys(THEMES), META.axes.theme);
  for (const [id, th] of Object.entries(THEMES)) {
    assert.ok(['spread', 'clusters', 'worldmap', 'rings'].includes(th.mode), `${id} mode`);
    assert.ok(th.nodeCount > 0 && th.hubs > 0, `${id} counts`);
    for (const f of ['bg', 'node', 'hub', 'arc', 'glow']) assert.match(th[f], /^#[0-9a-f]{6}$/i, `${id} ${f}`);
    for (const f of ['ink', 'soft', 'cta', 'ctaInk', 'accent', 'shadow']) assert.ok(th.pal[f], `${id} pal.${f}`);
    for (const L of ['zh', 'en']) assert.ok(typeof MILE[id][L] === 'function', `${id} milestone ${L}`);
  }
});

test('captions present for every shot that has one, in both languages', () => {
  for (const key of ['countdown', 'ignite', 'arcs', 'gmv']) {
    for (const L of ['zh', 'en']) assert.ok(CAP[key][L], `CAP.${key}.${L}`);
  }
});

test('voice-over: chosen voices, numbers spelt out, Double Eleven not 11.11, each line ends before the fade', () => {
  assert.deepEqual(VOICE, { zh: 'zf_xiaoxiao', en: 'bf_emma' });
  for (const [cut, slots] of Object.entries(SLOTS)) for (const [k, [a, max]] of Object.entries(slots)) assert.ok(a + max <= +cut - 0.3 + 1e-9, `${cut}s ${k} ends before fade`);
  const ids = new Map();
  for (const v of every()) for (const l of voLines(v)) {
    assert.ok(!/\d/.test(l.text), `${l.id}: "${l.text}" has digits`);
    assert.ok(!/11\.11|eleven-eleven/i.test(l.text), `${l.id}: "${l.text}"`);
    assert.equal(l.voice, VOICE[v.lang]);
    if (ids.has(l.id)) assert.equal(ids.get(l.id), l.text, `${l.id} differs between variants`); else ids.set(l.id, l.text);
  }
  assert.deepEqual(voLines({ ...every()[0], vo: 'off' }), []);
});

test('promo text: English writes "Double 11", never "11.11"', () => {
  assert.match(PROMO_T.en.ribbon, /Double 11/);
  for (const L of ['zh', 'en']) for (const s of Object.values(PROMO_T[L])) assert.ok(!/11\.11/.test(s), `"${s}"`);
  for (const L of ['zh', 'en']) for (const s of Object.values(T[L])) assert.ok(!/11\.11/.test(String(s)), `"${s}"`);
});

test('fontsFor lists every face with its characters', () => {
  for (const v of every().slice(0, 40)) {
    const f = fontsFor(v);
    assert.ok(f.length > 0);
    for (const x of f) assert.ok(x.family && x.weight && x.text.length > 0);
  }
});
