import test from 'node:test';
import assert from 'node:assert/strict';
import { planCrowd, agvAt, COUNT, STEPS, STEP, HORIZON, PICK, PICK_T, GRID_W, GRID_H } from '../js/crowd.js';
import { seedOf } from '../../factory/engine/rng.js';
import { ITEM_IDS } from '../items.js';

const KEY = (x, z) => z * GRID_W + x;
const cellAt = (cells, i, s) => { const o = (i * STEPS + s) * 2; return { x: cells[o], z: cells[o + 1] }; };

function conflicts(cells) {
  let cell = 0, edge = 0;
  for (let s = 0; s < STEPS; s++) {
    const occ = new Set();
    for (let i = 0; i < COUNT; i++) { const c = cellAt(cells, i, s), k = KEY(c.x, c.z); if (occ.has(k)) cell++; occ.add(k); }
  }
  for (let s = 1; s < STEPS; s++) for (let i = 0; i < COUNT; i++) for (let j = i + 1; j < COUNT; j++) {
    const ai = cellAt(cells, i, s), aip = cellAt(cells, i, s - 1), bj = cellAt(cells, j, s), bjp = cellAt(cells, j, s - 1);
    if (aip.x === bj.x && aip.z === bj.z && ai.x === bjp.x && ai.z === bjp.z) edge++;
  }
  return { cell, edge };
}

// 每件商品的种子（film.setup 就是这样取的），再加几个裸种子
const SEEDS = [...ITEM_IDS.map(id => seedOf(`08-${id}`)), 1, 2, 7, 42];

test('no two AGVs ever occupy the same cell and none swap across an edge', () => {
  for (const seed of SEEDS) {
    const { cells } = planCrowd({ seed });
    const c = conflicts(cells);
    assert.equal(c.cell, 0, `seed ${seed}: ${c.cell} shared cells`);
    assert.equal(c.edge, 0, `seed ${seed}: ${c.edge} edge swaps`);
  }
});

test('the target AGV reaches the picking station exactly on the pick hit (shot-local 2.5 s)', () => {
  for (const seed of SEEDS) {
    const { cells } = planCrowd({ seed });
    const want = Math.round(PICK_T / STEP), c = cellAt(cells, 0, want);
    assert.equal(c.x, PICK.x, `seed ${seed}: target x`);
    assert.equal(c.z, PICK.z, `seed ${seed}: target z`);
    // 并且它在那之前不在拣货台上（真的是刚好到）
    assert.ok(!(cellAt(cells, 0, want - 2).x === PICK.x && cellAt(cells, 0, want - 2).z === PICK.z), `seed ${seed}: target parked early`);
  }
});

test('every AGV stays on the grid for the full horizon', () => {
  const { cells } = planCrowd({ seed: 1 });
  assert.equal(STEPS, Math.round(HORIZON / STEP) + 1);
  for (let i = 0; i < COUNT; i++) for (let s = 0; s < STEPS; s++) {
    const c = cellAt(cells, i, s);
    assert.ok(c.x >= 0 && c.x < GRID_W && c.z >= 0 && c.z < GRID_H, `agv ${i} step ${s} off grid: ${c.x},${c.z}`);
    // 相邻两步最多挪一格（四邻 + 原地）
    if (s > 0) { const p = cellAt(cells, i, s - 1); assert.ok(Math.abs(c.x - p.x) + Math.abs(c.z - p.z) <= 1, `agv ${i} step ${s} jumped`); }
  }
});

test('the same seed plans byte-identical, twice', () => {
  const a = planCrowd({ seed: 7 }), b = planCrowd({ seed: 7 });
  assert.equal(Buffer.compare(Buffer.from(a.cells.buffer), Buffer.from(b.cells.buffer)), 0);
  assert.equal(a.seed, b.seed);
});

test('planning is well under 1.5 s so it can rerun on every item switch', () => {
  let worst = 0;
  for (const seed of SEEDS) { const r = planCrowd({ seed }); worst = Math.max(worst, r.planMs); }
  console.log(`# crowd: ${COUNT} AGVs × ${STEPS} steps, worst plan ${worst.toFixed(0)} ms over ${SEEDS.length} seeds`);
  assert.ok(worst < 1500, `${worst} ms`);
});

test('sampling is deterministic and gives the same positions scrubbed out of order', () => {
  const { cells } = planCrowd({ seed: 2 });
  const ts = [1.9, 0.3, HORIZON, 1.0, 2.6, 0];
  const fwd = ts.map(t => { const o = agvAt(cells, 11, t); return [o.x, o.z, o.heading, o.moving]; });
  const rev = [...ts].reverse().map(t => { const o = agvAt(cells, 11, t); return [o.x, o.z, o.heading, o.moving]; }).reverse();
  assert.deepEqual(fwd, rev);
});
