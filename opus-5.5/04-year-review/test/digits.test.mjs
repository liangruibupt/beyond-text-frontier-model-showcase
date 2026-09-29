import test from 'node:test';
import assert from 'node:assert/strict';
import { layoutYear, strokePts, DIGITS, WALL } from '../js/digits.js';
import { BOX } from '../meta.js';
import { daysInYear } from '../stats.js';

const h = WALL.tile / 2, YEARS = Array.from({ length: 20 }, (_, i) => 2020 + i);
/** 两块转过角度的方块（边长 WALL.tile）有没有重叠：分离轴 */
function overlap(p, q) {
  const dx = q.x - p.x, dy = q.y - p.y, r = (a, th) => h * (Math.abs(Math.cos(a - th)) + Math.abs(Math.sin(a - th)));
  if (Math.hypot(dx, dy) > 2 * h * Math.SQRT2) return false;
  return [p.angle, p.angle + Math.PI / 2, q.angle, q.angle + Math.PI / 2].every(th => Math.abs(dx * Math.cos(th) + dy * Math.sin(th)) < r(p.angle, th) + r(q.angle, th));
}

test('every year from 2020 to 2039 lays one tile per day, none overlapping', () => {
  for (const y of YEARS) {
    const n = daysInYear(y), t = layoutYear(y, n);
    assert.equal(t.length, n);
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) assert.ok(!overlap(t[i], t[j]), `${y}: tiles ${i} and ${j} overlap`);
  }
});

test('every tile stays inside the wall box, corners included', () => {
  const [[x0, y0], [x1, y1]] = BOX.wall, r = h * Math.SQRT2;
  for (const y of YEARS) for (const t of layoutYear(y, daysInYear(y))) assert.ok(t.x - r >= x0 && t.x + r <= x1 && t.y - r >= y0 && t.y + r <= y1, `${y}: (${t.x}, ${t.y})`);
});

test('the tiles lie along the strokes, one lane on each side, in writing order', () => {
  const t = layoutYear(2026, 365), glyph = WALL.height * 0.62 + WALL.gap, x0 = -(4 * glyph - WALL.gap) / 2;
  const mids = [...'2026'].map((c, i) => DIGITS[c].flatMap(strokePts).map(([x, y]) => [x0 + i * glyph + x * WALL.height, WALL.y0 + y * WALL.height]));
  for (const [k, p] of t.entries()) {
    const d = Math.min(...mids[p.digit].map(([x, y]) => Math.hypot(x - p.x, y - p.y)));
    assert.ok(Math.abs(d - WALL.lane) < 0.008, `tile ${k} is ${d.toFixed(3)} from its stroke`);
  }
  for (let k = 1; k < t.length; k++) assert.ok(t[k].digit >= t[k - 1].digit, `tile ${k} goes back a digit`);
});
