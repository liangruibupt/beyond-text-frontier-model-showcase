import test from 'node:test';
import assert from 'node:assert/strict';
import { LAYOUTS, UI } from '../layouts.js';
import { META, CUTS } from '../meta.js';
import { layersFor } from '../captions.js';
import { clockBox } from '../js/motion.js';
import { ASPECTS, UNSAFE, MARGIN, expandJobs } from '../../factory/engine/variant.js';

const hit = (a, b, eps = 1e-3) => a[0] < b[0] + b[2] - eps && b[0] < a[0] + a[2] - eps && a[1] < b[1] + b[3] - eps && b[1] < a[1] + a[3] - eps;
const inside = r => r[0] >= MARGIN - 1e-9 && r[1] >= MARGIN - 1e-9 && r[0] + r[2] <= 1 - MARGIN + 1e-9 && r[1] + r[3] <= 1 - MARGIN + 1e-9;
const aspect = ar => ASPECTS[ar][0] / ASPECTS[ar][1];
// 屏幕坐标（单位是画面高度）的矩形 → 取景不动时的画面比例坐标
const toFrame = (ar, [x, y, w, h]) => [x / aspect(ar), y, w / aspect(ar), h];
const clockRect = ar => { const c = clockBox(UI[ar]); return [c.x0, c.top, c.x1 - c.x0, c.bottom - c.top]; };

test('every aspect ratio has a row for every shot used by a cut', () => {
  const used = new Set(Object.values(CUTS).flatMap(c => c.shots.map(e => e.shot)));
  for (const ar of Object.keys(ASPECTS)) for (const s of used) assert.ok(LAYOUTS[ar][s], `${ar}.${s}`);
});

test('text zones stay inside the margin and out of platform UI', () => {
  for (const [ar, rows] of Object.entries(LAYOUTS)) for (const [shot, row] of Object.entries(rows)) {
    for (const [z, r] of Object.entries(row.zones ?? {})) {
      assert.ok(inside(r), `${ar}.${shot}.${z} crosses the margin`);
      for (const u of UNSAFE[ar]) assert.ok(!hit(r, u), `${ar}.${shot}.${z} is under platform UI`);
    }
  }
});

test('every zone a caption asks for exists', () => {
  for (const v of expandJobs(META, { jobs: [] }, { all: true })) for (const e of CUTS[v.cut].shots) {
    const row = LAYOUTS[v.ar][e.shot];
    for (const l of layersFor(v, { name: e.shot, from: e.from ?? 0, dur: e.dur, row })) assert.ok(row.zones?.[l.zone], `${v.ar}.${e.shot} has no zone ${l.zone}`);
  }
});

test('the date, clock, widgets and end card sit inside the safe frame', () => {
  for (const ar of Object.keys(ASPECTS)) {
    const u = UI[ar], rects = { clock: clockRect(ar), card: u.card, ...u.widgets };
    for (const [id, r] of Object.entries(rects)) {
      const f = toFrame(ar, r);
      assert.ok(inside(f), `${ar}.${id} crosses the margin: ${f.map(x => x.toFixed(3))}`);
      for (const z of UNSAFE[ar]) assert.ok(!hit(f, z), `${ar}.${id} is under platform UI`);
    }
    assert.ok(u.date.y - u.date.size >= MARGIN && u.date.y < clockRect(ar)[1], `${ar}: the date is not above the clock`);
  }
});

test('the home screen is clear of the caption band: widgets and the clock do not overlap it or each other', () => {
  for (const ar of Object.keys(ASPECTS)) {
    const cap = LAYOUTS[ar].wall.zones.cap, u = UI[ar], rects = { clock: clockRect(ar), ...u.widgets };
    for (const [id, r] of Object.entries(rects)) assert.ok(!hit(toFrame(ar, r), cap), `${ar}.${id} overlaps the caption band`);
    const ids = Object.keys(rects);
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) assert.ok(!hit(rects[ids[i]], rects[ids[j]]), `${ar}: ${ids[i]} overlaps ${ids[j]}`);
  }
});

test('the end card text sits inside the card', () => {
  for (const ar of Object.keys(ASPECTS)) {
    const card = toFrame(ar, UI[ar].card);
    for (const [z, r] of Object.entries(LAYOUTS[ar].end.zones)) {
      assert.ok(r[0] >= card[0] && r[1] >= card[1] && r[0] + r[2] <= card[0] + card[2] + 1e-9 && r[1] + r[3] <= card[1] + card[3] + 1e-9, `${ar}.end.${z} leaves the card`);
    }
  }
});
