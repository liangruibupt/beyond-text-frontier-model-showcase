import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { META, CUTS, EV, SHOTS, GRID, BAR } from '../meta.js';
import { FLAVORS } from '../flavors.js';
import { T, voLines, SLOTS, VOICE } from '../copy.js';
import { PROMO_T } from '../promos.js';
import { layersFor, fontsFor } from '../captions.js';
import { expandJobs, allAxes } from '../../factory/engine/variant.js';
import { buildCut, shotAt } from '../../factory/engine/timeline.js';
import { offGrid } from '../../factory/engine/mix.js';

const manifest = JSON.parse(readFileSync(new URL('../manifest.json', import.meta.url)));
const every = () => expandJobs(META, { jobs: [] }, { all: true });

test('file names encode every axis that changes the output', () => {
  const v = { flavor: 'taro', lang: 'en', cut: 6, promo: '1111', ar: '1x1', vo: 'off' };
  assert.equal(META.fileName(v), 'bocha_taro_6s_1x1_en_1111_novo');
  assert.equal(META.fileName({ ...v, promo: 'none', vo: 'on' }), 'bocha_taro_6s_1x1_en');
  const names = every().map(META.fileName);
  assert.equal(new Set(names).size, names.length, 'two variants share a file name');
});

test('default manifest = every flavour × (16:9 15 s zh, 16:9 15 s en launch, 1:1 6 s zh 1111) = 12 jobs', () => {
  const jobs = expandJobs(META, manifest);
  assert.equal(jobs.length, 12);
  const kinds = new Set(jobs.map(j => `${j.ar} ${j.cut} ${j.lang} ${j.promo} ${j.vo}`));
  assert.deepEqual([...kinds].sort(), ['16x9 15 en launch on', '16x9 15 zh none on', '1x1 6 zh 1111 on']);
  for (const f of allAxes(META).flavor) assert.equal(jobs.filter(j => j.flavor === f).length, 3, `flavor ${f}`);
});

test('cuts: lengths, shot names, hits on the 0.75 s grid and on the shot events', () => {
  assert.equal(BAR, 4 * GRID);
  const at = (b, name, lt) => { const e = shotAt(b, name); return e.start + lt - e.from; };
  for (const [c, cut] of Object.entries(CUTS)) {
    const b = buildCut(cut);
    assert.ok(Math.abs(b.duration - Number(c)) < 1e-9, `cut ${c} lasts ${b.duration}`);
    for (const e of cut.shots) assert.ok(SHOTS.includes(e.shot), e.shot);
    assert.deepEqual(offGrid(Object.values(cut.hits), GRID), [], `cut ${c} has off-grid hits`);
    assert.ok(Math.abs(cut.hits.punch - at(b, 'straw', EV.punch)) < 1e-9, `cut ${c}: punch hit ≠ straw puncture`);
    assert.ok(Math.abs(cut.hits.clink - at(b, 'ice', EV.clink)) < 1e-9, `cut ${c}: clink hit ≠ ice clink`);
    assert.equal(cut.hits.logo, shotAt(b, 'end').start);
  }
  const b = buildCut(CUTS[15]);
  assert.ok(Math.abs(CUTS[15].hits.land - at(b, 'pearls', EV.land)) < 1e-9);
  assert.ok(Math.abs(CUTS[15].hits.bloom - at(b, 'pour', EV.bloom)) < 1e-9);
  assert.ok(Math.abs(CUTS[15].hits.drip - at(b, 'hero', EV.drip)) < 1e-9);
  const h = shotAt(b, 'hero'); assert.ok(b.cover > h.start && b.cover < h.end, '15 s cover must be in the hero shot');
  const s6 = buildCut(CUTS[6]), e6 = shotAt(s6, 'end'); assert.ok(s6.cover > e6.start + 1.0, '6 s cover must show the price card');
});

test('flavours: the four approved ones, complete in both languages, integer prices with the deal below the price', () => {
  assert.deepEqual(Object.keys(FLAVORS), ['brownsugar', 'jasmine', 'strawberry', 'taro']);
  assert.deepEqual(Object.keys(FLAVORS), META.axes.flavor);
  assert.deepEqual(Object.values(FLAVORS).map(k => k.name.zh), ['黑糖珍珠', '茉莉奶绿', '草莓啵啵', '芋泥波波']);
  for (const [id, k] of Object.entries(FLAVORS)) {
    for (const L of META.axes.lang) { assert.ok(k.name[L] && k.image[L] && k.pour[L], `${id} ${L}`); assert.equal(k.parts[L].length, 3); }
    for (const c of ['CNY', 'USD']) {
      assert.ok(Number.isInteger(k.price[c]) && Number.isInteger(k.deal[c]), `${id} ${c} prices must be integers`);
      assert.ok(k.deal[c] < k.price[c], `${id} deal ${c}`);
    }
    assert.match(k.liquid.color, /^#[0-9a-f]{6}$/); assert.equal(k.liquid.absorb.length, 3);
    assert.ok(k.liquid.scatter > 0 && k.liquid.band > 0);
    for (const f of ['ink', 'soft', 'accent', 'cta', 'ctaInk', 'shadow']) assert.ok(k.palette[f], `${id} palette.${f}`);
  }
});

test('voice-over: the chosen voices, numbers spelt out, Double 11 read as 双十一 / Double Eleven, every line ends before the fade', () => {
  assert.deepEqual(VOICE, { zh: 'zf_xiaoyi', en: 'af_heart' });
  for (const [cut, slots] of Object.entries(SLOTS)) for (const [k, [a, max]] of Object.entries(slots)) assert.ok(a + max <= +cut - 0.3 + 1e-9, `${cut}s ${k}`);
  const ids = new Map();
  for (const v of every()) for (const l of voLines(v)) {
    assert.ok(!/\d/.test(l.text), `${l.id}: "${l.text}" has digits`);
    assert.ok(!/11\.11|eleven-eleven/i.test(l.text), `${l.id}: "${l.text}"`);
    if (v.promo === '1111' && /_(end|one)_1111$/.test(l.id)) assert.ok(v.lang === 'zh' ? l.text.includes('双十一') : l.text.includes('Double Eleven'), `${l.id}: "${l.text}"`);
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
  const v = { flavor: 'brownsugar', lang: 'zh', cut: 6, promo: '1111', ar: '1x1', vo: 'on' };
  const e = CUTS[6].shots.find(x => x.shot === 'end'), L = layersFor(v, { name: 'end', from: 0, dur: e.dur });
  const byId = Object.fromEntries(L.map(l => [l.id, l]));
  assert.equal(byId.ribbon.text, '双11 狂欢价');
  assert.equal(byId.price.text, '到手价 ¥15'); assert.equal(byId.was.text, '日常价 ¥22'); assert.ok(byId.was.strike);
  assert.ok(byId.price.size >= 0.07, 'deal price must be large at 1080×1080');
});

test('fontsFor lists every face with its characters', () => {
  for (const v of every().slice(0, 40)) {
    const f = fontsFor(v);
    assert.ok(f.length > 0);
    for (const x of f) assert.ok(x.family && x.weight && x.text.length > 0);
  }
});
