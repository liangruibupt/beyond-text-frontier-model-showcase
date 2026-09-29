import test from 'node:test';
import assert from 'node:assert/strict';
import { CUTS, EV, GRID, META } from '../meta.js';
import { USER_IDS } from '../users.js';
import { statsFor } from '../facts.js';
import { score, monthDegrees, penta, clickAt, CLICKS, LOGO, TONIC, STEP, RANGE } from '../js/score.js';
import { riseAt } from '../js/chart.js';
import { VOICES, BUSES, mtof } from '../../factory/engine/audio.js';
import { buildCut, shotAt } from '../../factory/engine/timeline.js';

const V = (o = {}) => ({ user: 'coffee', ar: '16x9', lang: 'zh', cut: 15, promo: 'none', vo: 'on', ...o });
const run = o => { const v = V(o), built = buildCut(CUTS[v.cut]); return { built, ...score(v, built) }; };
const onGrid = (t, g) => Math.abs(t / g - Math.round(t / g)) < 1e-9;
const near = (a, b) => Math.abs(a - b) < 1e-9;
const each = fn => { for (const user of USER_IDS) for (const cut of META.axes.cut) fn(user, cut, run({ user, cut })); };
const midi = f => 69 + 12 * Math.log2(f / 440);
/** 成片里 months 的柱子音：pluck、在第 i 根柱子升起的时刻 */
const barNotes = ({ built, notes }) => {
  const e = shotAt(built, 'months');
  if (!e) return [];                                     // 6 秒版没有 months
  return Array.from({ length: 12 }, (_, i) => notes.find(x => x.voice === 'pluck' && x.bus === 'music' && near(x.t, e.start + riseAt(i) - e.from) && midi(x.f) >= TONIC - 1e-6));
};

test('every event is well-formed, inside the film and sorted', () => {
  each((user, cut, { built, notes }) => {
    assert.ok(notes.length > 30, `${user} ${cut}s: only ${notes.length} notes`);
    for (const e of notes) {
      const where = `${user} ${cut}s ${e.voice} at ${e.t}`;
      assert.ok(VOICES[e.voice], `${where}: unknown voice`);
      assert.ok(BUSES.includes(e.bus), `${where}: bus ${e.bus}`);
      for (const k of ['t', 'f', 'd', 'v']) assert.ok(Number.isFinite(e[k]), `${where}: ${k} = ${e[k]}`);
      assert.ok(e.t >= 0 && e.t < built.duration, `${where}: outside 0…${built.duration}`);
      assert.ok(e.d > 0 && e.v > 0 && e.v <= 1 && e.f > 20 && e.f < 16000, `${where}: d ${e.d} v ${e.v} f ${e.f}`);
      assert.ok(Math.abs(e.pan ?? 0) <= 1, `${where}: pan ${e.pan}`);
    }
    for (let i = 1; i < notes.length; i++) assert.ok(notes[i].t >= notes[i - 1].t, 'sorted by time');
  });
});

test('every hit is on the 0.75 s grid and the music lands on it', () => {
  each((user, cut, { built, notes }) => {
    assert.ok(Object.keys(built.hits).length >= 3);
    for (const [name, t] of Object.entries(built.hits)) {
      assert.ok(onGrid(t, GRID), `${user} ${cut}s hit ${name} at ${t} is off the grid`);
      assert.ok(notes.some(e => e.bus === 'music' && near(e.t, t)), `${user} ${cut}s: no music onset on the ${name} hit at ${t}`);
    }
  });
});

test('music onsets sit on the sixteenth-note grid, except the month plucks, which follow their bars', () => {
  each((user, cut, r) => {
    const bars = new Set(barNotes(r).filter(Boolean));
    for (const e of r.notes.filter(e => e.bus === 'music' && !bars.has(e))) assert.ok(onGrid(e.t, STEP), `${user} ${cut}s: ${e.voice} at ${e.t}`);
  });
});

test('months: each bar plays its month on the pentatonic scale, so each customer has their own melody', () => {
  const tunes = {};
  for (const user of USER_IDS) {
    const { months } = statsFor(user), deg = monthDegrees(months), got = barNotes(run({ user }));
    assert.equal(Math.min(...deg), 0); assert.equal(Math.max(...deg), RANGE);
    got.forEach((e, i) => {
      assert.ok(e, `${user}: no pluck as bar ${i + 1} rises`);
      assert.ok(Math.abs(midi(e.f) - penta(deg[i])) < 1e-6, `${user}: bar ${i + 1} plays ${midi(e.f)}, expected ${penta(deg[i])}`);
    });
    for (let i = 0; i < 12; i++) for (let j = 0; j < 12; j++) if (months[i] > months[j]) assert.ok(deg[i] >= deg[j], `${user}: more orders never sound lower`);
    const peak = months.indexOf(Math.max(...months));
    assert.ok(Math.abs(midi(got[peak].f) - (TONIC + 24)) < 1e-6, `${user}: the busiest month is the top note, D6`);
    tunes[user] = deg.join(',');
  }
  assert.equal(new Set(Object.values(tunes)).size, USER_IDS.length, JSON.stringify(tunes));
  for (const n of [0, 1, 4, 5, 7, 10]) assert.ok([0, 2, 4, 7, 9].includes((penta(n) - TONIC + 120) % 12), `penta(${n})`);
  assert.deepEqual(monthDegrees(Array(12).fill(3)), Array(12).fill(RANGE / 2), 'a flat year sits in the middle');
});

test('count: the clicks follow the rolling number and the last one is the landing', () => {
  assert.ok(near(clickAt(0), 0) && near(clickAt(CLICKS), EV.land));
  for (let j = 1; j < CLICKS; j++) assert.ok(clickAt(j + 1) - clickAt(j) > clickAt(j) - clickAt(j - 1), 'further apart as the number slows');
  for (const cut of [15, 6]) {
    const { built, notes } = run({ cut }), e = shotAt(built, 'count');
    const clicks = notes.filter(x => x.voice === 'click' && x.t < e.start + EV.land - e.from);
    assert.equal(clicks.length, CLICKS - 1, `${cut}s clicks`);
  }
});

test('the sonic logo: E4 A4 D5 on the sfx bus at the logo hit, in both cuts', () => {
  each((user, cut, { built, notes }) => {
    const t = built.hits.logo, got = notes.filter(e => e.bus === 'sfx' && e.voice === 'pluck' && e.t >= t - 1e-9);
    assert.deepEqual(got.map(e => +(e.t - t).toFixed(6)), [0, 0.375, 0.75], `${user} ${cut}s logo rhythm`);
    got.forEach((e, i) => assert.ok(Math.abs(e.f - mtof(TONIC + LOGO[i])) < 1e-6));
  });
});

test('sound effects follow the picture: cart, medal, transitions and a bed over the whole film', () => {
  for (const cut of [15, 6]) {
    const { built, notes } = run({ cut }), top = shotAt(built, 'top');
    assert.ok(notes.some(e => e.voice === 'plink' && near(e.t, top.start + EV.cart - top.from)), `${cut}s: plink into the cart`);
    assert.ok(notes.some(e => e.voice === 'noise' && e.t === 0 && near(e.d, built.duration)), `${cut}s: bed`);
    for (const e of built.entries.filter(e => e.transition.type !== 'cut')) assert.ok(notes.some(x => x.voice === 'noise' && near(x.t, e.start + e.transition.dur / 2 - 0.4)), `${cut}s: whoosh into ${e.shot}`);
  }
  const { notes } = run();
  assert.ok(notes.some(e => e.bus === 'sfx' && near(e.t, 10.5 + EV.medal)), 'the medal lands with a thud');
  assert.ok(!run({ cut: 6 }).notes.some(e => e.t < 1.5 && midi(e.f) > 90 && e.voice === 'bell'), 'the 6 s cut has no title sparkles');
});

test('a shot that starts part-way keeps its pad from the start of the shot', () => {
  const { built, notes } = run({ cut: 6 }), top = shotAt(built, 'top');
  assert.ok(notes.some(e => e.voice === 'pad' && near(e.t, top.start)), 'the Bm pad carries into the 6 s top');
});

test('deterministic, and the aspect ratio, language, promo and vo do not change the music', () => {
  const a = run();
  assert.deepEqual(run(), a);
  for (const o of [{ ar: '1x1' }, { ar: '9x16' }, { lang: 'en' }, { promo: '1111' }, { promo: 'launch' }, { vo: 'off' }]) assert.deepEqual(run(o).notes, a.notes, JSON.stringify(o));
  assert.notDeepEqual(run({ user: 'gamer' }).notes, a.notes);
});

// 同一份混音在 Chromium 的 OfflineAudioContext 里渲两遍，逐采样相同（和 check.mjs 的 audio 一项同一个判断，不用 GPU）
test('the mix renders the same samples twice, and is neither silent nor clipping', async t => {
  let chromium;
  try { ({ chromium } = await import('playwright')); } catch { return t.skip('playwright not installed'); }
  const { serve, ROOT } = await import('../../factory/lib/serve.mjs');
  let browser;
  try { browser = await chromium.launch({ headless: true }); } catch (e) { return t.skip(`no Chromium: ${e.message.split('\n')[0]}`); }
  const srv = await serve(ROOT, 0);
  t.after(async () => { await browser.close(); srv.close(); });
  const base = `http://127.0.0.1:${srv.port}`, page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route(`${base}/04-year-review/test/mix.html`, r => r.fulfill({ contentType: 'text/html', body: `<!doctype html><script type="importmap">{"imports":{"three":"/node_modules/three/build/three.module.js","three/addons/":"/node_modules/three/examples/jsm/"}}</script>` }));
  await page.goto(`${base}/04-year-review/test/mix.html`);
  const res = await page.evaluate(async () => {
    const [{ renderMix }, { buildCut }, { CUTS }, { score }] = await Promise.all(['/factory/engine/audio.js', '/factory/engine/timeline.js', '/04-year-review/meta.js', '/04-year-review/js/score.js'].map(p => import(p)));
    const film = { id: '04-year-review', score }, out = [];
    for (const [user, cut] of [['coffee', 15], ['gamer', 6]]) {
      const v = { user, cut, ar: '16x9', lang: 'zh', promo: 'none', vo: 'off' }, built = buildCut(CUTS[cut]);
      const [a, b] = [await renderMix(film, v, built), await renderMix(film, v, built)];
      let same = a.length === b.length, pk = 0, ss = 0;
      for (let c = 0; c < 2; c++) {
        const x = a.getChannelData(c), y = b.getChannelData(c);
        for (let i = 0; i < x.length; i++) { if (x[i] !== y[i]) same = false; pk = Math.max(pk, Math.abs(x[i])); ss += x[i] * x[i]; }
      }
      out.push({ user, cut, same, len: a.length, dur: built.duration, peak: pk, rms: Math.sqrt(ss / (2 * a.length)) });
    }
    return out;
  });
  assert.deepEqual(errors, []);
  for (const r of res) {
    t.diagnostic(`${r.user} ${r.cut}s: identical ${r.same}, peak ${(20 * Math.log10(r.peak)).toFixed(1)} dBFS, rms ${(20 * Math.log10(r.rms)).toFixed(1)} dBFS`);
    const where = `${r.user} ${r.cut}s`;
    assert.ok(r.same, `${where}: the two renders differ`);
    assert.equal(r.len, Math.ceil(r.dur * 48000), `${where}: length`);
    assert.ok(r.rms > 1e-3, `${where}: silent (rms ${r.rms})`);
    assert.ok(r.peak < 1, `${where}: clips before the loudness step (peak ${r.peak})`);
  }
});
