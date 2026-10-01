import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { META, CUTS, SHOTS, GRID, BAR } from '../meta.js';
import { ITEMS, ITEM_IDS } from '../items.js';
import { ITEMS as CATALOG } from '../../04-year-review/catalog.js';
import { T, voLines, SLOTS, VOICE } from '../copy.js';
import { PROMO_T } from '../promos.js';
import { layersFor, fontsFor } from '../captions.js';
import { score } from '../js/score.js';
import { expandJobs, allAxes } from '../../factory/engine/variant.js';
import { buildCut, shotAt } from '../../factory/engine/timeline.js';
import { offGrid } from '../../factory/engine/mix.js';
import { VOICES, BUSES } from '../../factory/engine/audio.js';

const manifest = JSON.parse(readFileSync(new URL('../manifest.json', import.meta.url)));
const every = () => expandJobs(META, { jobs: [] }, { all: true });

test('file names encode every axis that changes the output', () => {
  const v = { item: 'beans', lang: 'en', cut: 6, promo: '1111', ar: '1x1', vo: 'off' };
  assert.equal(META.fileName(v), 'youji-parcel_beans_6s_1x1_en_1111_novo');
  assert.equal(META.fileName({ ...v, promo: 'none', vo: 'on' }), 'youji-parcel_beans_6s_1x1_en');
  const names = every().map(META.fileName);
  assert.equal(new Set(names).size, names.length, 'two variants share a file name');
});

test('default manifest = every item × (16:9 15 s zh, 16:9 15 s en launch, 1:1 6 s zh 1111) = 9 jobs', () => {
  const jobs = expandJobs(META, manifest);
  assert.equal(jobs.length, 9);
  const kinds = new Set(jobs.map(j => `${j.ar} ${j.cut} ${j.lang} ${j.promo} ${j.vo}`));
  assert.deepEqual([...kinds].sort(), ['16x9 15 en launch on', '16x9 15 zh none on', '1x1 6 zh 1111 on']);
  for (const it of allAxes(META).item) assert.equal(jobs.filter(j => j.item === it).length, 3, `item ${it}`);
});

test('items reuse 04 catalog: three approved products, integer prices with the deal below the price', () => {
  assert.deepEqual(ITEM_IDS, ['lantern', 'headset', 'beans']);
  assert.deepEqual(ITEM_IDS, META.axes.item);
  const expect = { lantern: 'od-lantern', headset: 'gm-headset', beans: 'cf-geisha' };
  for (const [id, it] of Object.entries(ITEMS)) {
    assert.equal(it.catId, expect[id]);
    assert.deepEqual(it.name, CATALOG[expect[id]].name, `${id} name = 04 catalog`);
    assert.deepEqual(it.price, CATALOG[expect[id]].price, `${id} price = 04 catalog`);
    assert.deepEqual(it.deal, CATALOG[expect[id]].deal, `${id} deal = 04 catalog`);
    for (const c of ['CNY', 'USD']) {
      assert.ok(Number.isInteger(it.price[c]) && Number.isInteger(it.deal[c]), `${id} ${c} integer`);
      assert.ok(it.deal[c] < it.price[c], `${id} deal < price ${c}`);
    }
    assert.ok(['lantern', 'headset', 'pouch'].includes(it.model), `${id} model`);
    assert.equal(it.box.length, 3);
    for (const f of ['wall', 'door', 'ground', 'trim', 'porch']) assert.match(it.street[f], /^#[0-9a-f]{6}$/i, `${id} street.${f}`);
  }
});

test('cuts: lengths exactly 15 / 6, shot names, hits on the 0.5 s grid', () => {
  assert.equal(BAR, 4 * GRID);
  for (const [c, cut] of Object.entries(CUTS)) {
    const b = buildCut(cut);
    assert.ok(Math.abs(b.duration - Number(c)) < 1e-9, `cut ${c} lasts ${b.duration}`);
    for (const e of cut.shots) assert.ok(SHOTS.includes(e.shot), e.shot);
    assert.deepEqual(offGrid(Object.values(cut.hits), GRID), [], `cut ${c} has off-grid hits`);
    assert.equal(cut.hits.logo, shotAt(b, 'door').start + (c === '6' ? 0.5 : 0.5), `cut ${c} logo = door + 0.5`);
  }
  // 15 秒七段时长 1.5+3.5+2+2+2+2+2 = 15
  assert.deepEqual(CUTS[15].shots.map(s => s.dur), [1.5, 3.5, 2.0, 2.0, 2.0, 2.0, 2.0]);
  const b15 = buildCut(CUTS[15]);
  assert.ok(b15.cover > shotAt(b15, 'robots').start && b15.cover < shotAt(b15, 'robots').end, '15 s cover in robots');
  const b6 = buildCut(CUTS[6]), d6 = shotAt(b6, 'door'); assert.ok(b6.cover > d6.start + 1.0, '6 s cover shows the price card');
});

test('voice-over: 04 voices, numbers spelt out, Double 11 read as 双十一 / Double Eleven, every line ends before the fade', () => {
  assert.deepEqual(VOICE, { zh: 'zm_yunjian', en: 'am_michael' });
  for (const [cut, slots] of Object.entries(SLOTS)) for (const [k, [a, max]] of Object.entries(slots)) assert.ok(a + max <= +cut - 0.3 + 1e-9, `${cut}s ${k} ends before fade`);
  const ids = new Map();
  for (const v of every()) for (const l of voLines(v)) {
    assert.ok(!/\d/.test(l.text), `${l.id}: "${l.text}" has digits`);
    assert.ok(!/11\.11|eleven-eleven/i.test(l.text), `${l.id}: "${l.text}"`);
    if (v.cut === 6 && v.promo === '1111') assert.ok(v.lang === 'zh' ? l.text.includes('双十一') : /Double Eleven/.test(l.text), `${l.id}: "${l.text}"`);
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

test('the 1:1 6 s Double 11 card shows the deal price and the struck regular price', () => {
  const v = { item: 'lantern', lang: 'zh', cut: 6, promo: '1111', ar: '1x1', vo: 'on' };
  const e = CUTS[6].shots.find(x => x.shot === 'door'), L = layersFor(v, { name: 'door', from: e.from ?? 0, dur: e.dur });
  const byId = Object.fromEntries(L.map(l => [l.id, l]));
  assert.equal(byId.ribbon.text, '双11 狂欢价');
  assert.equal(byId.price.text, '到手价 ¥129'); assert.equal(byId.was.text, '日常价 ¥189'); assert.ok(byId.was.strike);
  assert.ok(byId.price.size >= 0.07, 'deal price must be large at 1080×1080');
});

test('fontsFor lists every face with its characters', () => {
  for (const v of every()) {
    const f = fontsFor(v);
    assert.ok(f.length > 0);
    for (const x of f) assert.ok(x.family && x.weight && x.text.length > 0);
  }
});

const onGrid = (t, g) => Math.abs(t / g - Math.round(t / g)) < 1e-9;
const near = (a, b) => Math.abs(a - b) < 1e-9;

test('score: well-formed notes, inside the film, sorted; a music note or sfx on every hit; hits on the 0.5 s grid', () => {
  for (const item of META.axes.item) for (const cut of META.axes.cut) {
    const v = { item, ar: '16x9', lang: 'zh', cut, promo: 'none', vo: 'on' }, built = buildCut(CUTS[cut]), { notes } = score(v, built);
    assert.ok(notes.length > 0, `${item} ${cut}s empty`);
    for (const e of notes) {
      const where = `${item} ${cut}s ${e.voice}@${e.t}`;
      assert.ok(VOICES[e.voice], `${where}: unknown voice`);
      assert.ok(BUSES.includes(e.bus), `${where}: bus`);
      for (const k of ['t', 'f', 'd', 'v']) assert.ok(Number.isFinite(e[k]), `${where}: ${k}`);
      assert.ok(e.t >= 0 && e.t + e.d <= built.duration + 1e-9, `${where}: outside film`);
      assert.ok(e.d > 0 && e.v > 0 && e.v <= 1 && e.f > 20 && e.f < 16000, where);
    }
    for (let i = 1; i < notes.length; i++) assert.ok(notes[i].t >= notes[i - 1].t, 'sorted');
    for (const [name, t] of Object.entries(built.hits)) {
      assert.ok(onGrid(t, GRID), `${cut}s ${name} off grid`);
      assert.ok(notes.some(e => near(e.t, t)), `${item} ${cut}s: no note on ${name} at ${t}`);
    }
  }
});

test('score is deterministic and the same in both languages', () => {
  const run = o => JSON.stringify(score({ item: 'lantern', ar: '16x9', lang: 'zh', cut: 15, promo: 'none', vo: 'on', ...o }, buildCut(CUTS[o.cut ?? 15])).notes);
  assert.equal(run({}), run({}));
  assert.equal(run({}), run({ lang: 'en' }), 'language must not change the music');
});
