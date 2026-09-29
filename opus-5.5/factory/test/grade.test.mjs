import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { AGX, TONE_GLSL, agx, neutral, toneOf, grade, ungrade, toSrgb, fromSrgb } from '../engine/grade.js';
import { POST_DEFAULTS, mergePost } from '../engine/post.js';

const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255);

test('the grade shader takes its tone curves from grade.js and does the same steps as grade()', () => {
  for (const k of Object.keys(AGX)) assert.match(TONE_GLSL, new RegExp(`const mat3 ${k} = mat3\\(vec3\\(`));
  assert.match(TONE_GLSL, /vec3 agx\(vec3 c\)/); assert.match(TONE_GLSL, /vec3 neutral\(vec3 c\)/);
  const src = fs.readFileSync(new URL('../engine/post.js', import.meta.url), 'utf8');
  assert.match(src, /\$\{TONE_GLSL\}/);
  assert.ok(src.includes('c = tone == 1 ? neutral(x) : agx(x);'));
  assert.ok(src.includes('c = mix(vec3(dot(c, vec3(0.2126, 0.7152, 0.0722))), c, saturation);'));
  assert.ok(src.includes('c = pow(max(c * gain + lift * (1.0 - c), 0.0), 1.0 / gamma);'));
});

test('grade: mid grey lands mid screen, black stays black, brighter in is brighter out', () => {
  assert.ok(Math.abs(grade([0.18, 0.18, 0.18], POST_DEFAULTS)[0] - 0.5) < 0.01);
  assert.ok(grade([0, 0, 0], POST_DEFAULTS).every(x => x < 0.01));
  let last = -1;
  for (let v = 0.01; v < 20; v *= 1.3) { const g = grade([v, v, v], POST_DEFAULTS)[1]; assert.ok(g > last); last = g; }
  assert.ok(agx([100, 100, 100]).every(x => x <= 1));
  for (const x of [0, 0.002, 0.2, 0.7, 1]) assert.ok(Math.abs(fromSrgb(toSrgb(x)) - x) < 1e-9);
});

test('PBR Neutral keeps colours below its knee (less a small offset) and rolls highlights off below white', () => {
  neutral([0.5, 0.3, 0.2]).forEach((x, i) => assert.ok(Math.abs(x - [0.46, 0.26, 0.16][i]) < 1e-9));
  const hi = neutral([4, 4, 4]);
  assert.ok(hi.every(x => x > 0.95 && x < 1));
  const [r, , b] = neutral([3, 1, 0.5]);
  assert.ok(r < 1 && b / r > 0.46 / 2.96);                                     // 高光往白里去饱和
  assert.equal(toneOf({}), 0); assert.equal(toneOf({ tone: 'neutral' }), 1);
  assert.throws(() => toneOf({ tone: 'filmic' }), /unknown tone "filmic"/);
});

test('ungrade finds the scene colour that shows as the designed colour, for any grade', () => {
  const colours = ['#f6ead8', '#e3c9a4', '#fde8dc', '#f5c8b6', '#ece3cc', '#cfbf98', '#221544', '#0b0718', '#808080'].map(hex);
  for (const P of [POST_DEFAULTS, mergePost({ tone: 'neutral' }), mergePost({ tone: 'neutral', exposure: 1.2, saturation: 1.1 }), mergePost({ exposure: 2.5, saturation: 1.2 }), mergePost({ gain: [1.05, 1, 0.95], gamma: [1.1, 1, 0.9] })])
    for (const c of colours) {
      const back = grade(ungrade(c, P), P);
      c.forEach((x, i) => assert.ok(Math.abs(back[i] - x) < 0.5 / 255, `${c} → ${back}`));
    }
});

test('outside what the grade can show (a saturated mint under AgX, black under a lift), ungrade still gets closer', () => {
  const d = (a, b) => Math.hypot(...a.map((x, i) => x - b[i]));
  for (const [h, P] of [['#3fa888', POST_DEFAULTS], ['#0b0718', mergePost({ lift: [0.03, 0.03, 0.03] })]]) {
    const c = hex(h);
    assert.ok(d(grade(ungrade(c, P), P), c) < d(grade(c.map(fromSrgb), P), c), h);
  }
});

test('ungrade stops at a finite brightness for colours the grade can never show', () => {
  const x = ungrade([1, 1, 1], POST_DEFAULTS);
  assert.ok(x.every(v => Number.isFinite(v) && v <= 64));
});
