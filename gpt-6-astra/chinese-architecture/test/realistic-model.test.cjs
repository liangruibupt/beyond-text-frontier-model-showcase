const assert = require('node:assert/strict');
const test = require('node:test');
require('../data.js');
require('../geometry.js');
require('../realistic-model.js');
const M = globalThis.ARCH_REALISTIC_MODEL;
const buildings = globalThis.ARCH_DATA.BUILDINGS;

for (const b of buildings) {
  test(`${b.id}: exterior retains bay dimensions and resolved structural levels`, () => {
    const section = ARCH_GEO.sectionScene(b), model = M.layout(b, section);
    assert.equal(model.xs.length, b.elevation.bays.length + 1);
    assert.equal(model.levels.length, b.layers.length);
    assert(Math.abs(model.width - b.elevation.bays.reduce((a, v) => a + v, 0) / 100) < 1e-8);
    assert(model.platformWidth > model.width && model.platformDepth > model.depth);
    for (const level of model.levels) {
      assert([level.base, level.top, level.frontBase, level.depth, level.diameter,
        level.bracketHeight, level.reach, ...level.xs].every(Number.isFinite));
      assert(level.top > level.base);
      assert(level.frontBase >= level.base);
      assert(level.xs[0] < level.xs.at(-1));
      if (level.roofProfile) {
        assert.equal(level.roofProfile[0][0], 0);
        assert.equal(level.roofProfile.at(-1)[0], 1);
        for (let i = 1; i < level.roofProfile.length; i++) {
          assert(level.roofProfile[i][0] > level.roofProfile[i - 1][0]);
          assert(level.roofProfile[i][1] >= level.roofProfile[i - 1][1]);
        }
      }
    }
  });
}

test('four roof slopes meet at their hips and retain open gables', () => {
  for (const type of ['wudian', 'xieshan']) {
    const roof = { a: 22, b: 13, ridge: 10, type, kick: .4, profile: [[0, 7], [.5, 9], [1, 13]] };
    for (const t of [0, .1, .46, .8, 1]) {
      const front = M.roofPoint(roof, 0, 1, t), side = M.roofPoint(roof, 2, 1, t);
      assert.deepEqual(front, side);
      assert(front.every(Number.isFinite));
      if (type === 'xieshan' && t >= .46) assert.equal(front[0], roof.ridge);
    }
    assert.deepEqual(M.roofPoint(roof, 0, 0, 1), [0, 13, 0]);
  }
});

test('lower eaves terminate at the inner rectangular hall rather than a fictitious ridge', () => {
  const roof = { a: 25, b: 18, ridge: 18, innerB: 11, type: 'wudian', kick: .4, profile: [[0, 5], [1, 7]] };
  assert.deepEqual(M.roofPoint(roof, 0, 1, 1), [18, 7, 11]);
  assert.deepEqual(M.roofPoint(roof, 2, 1, 1), [18, 7, 11]);
});

test('lattice motifs remain inside their frames and distinguish vertical from diagonal joinery', () => {
  for (const kind of ['zhiling', 'pozi', 'gezi', 'linghua']) {
    const segments = M.lattice(.72, 2.8, kind);
    assert(segments.length > 3);
    for (const [x1, y1, x2, y2] of segments) {
      assert([x1, y1, x2, y2].every(Number.isFinite));
      assert(x1 >= -1e-8 && x2 <= .72 + 1e-8);
      assert(y1 >= -1e-8 && y2 >= -1e-8 && y1 <= 2.8 + 1e-8 && y2 <= 2.8 + 1e-8);
    }
    assert.equal(segments.some(([x1, y1, x2, y2]) => x1 !== x2 && y1 !== y2),
      kind === 'gezi' || kind === 'linghua');
  }
});
