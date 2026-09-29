import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { CUTS, JOIN, joinOf } from '../meta.js';
import { LAYOUTS } from '../layouts.js';
import { USERS, USER_IDS } from '../users.js';
import { statsFor } from '../facts.js';
import { cameraOf, EASE_IN } from '../js/shots.js';
import { buildWall } from '../js/wall.js';
import { buildPile } from '../js/pile.js';
import { buildChart } from '../js/chart.js';
import { ASPECTS } from '../../factory/engine/variant.js';
import { solvePose } from '../../factory/engine/framing.js';

const durOf = (cut, name) => CUTS[cut].shots.find(e => e.shot === name).dur;
const at = (cut, name, lt) => ({ name, lt, u: Math.min(1, lt / durOf(cut, name)), from: 0 });
const close = (a, b, eps, what) => a.forEach((x, i) => assert.ok(Math.abs(x - b[i]) < eps, `${what}[${i}]: ${x} vs ${b[i]}`));

test('joins: count follows open (and opens the 6-second cut), top follows months only in the 15-second cut', () => {
  assert.equal(joinOf(15, 'count'), 'open'); assert.equal(joinOf(15, 'top'), 'months');
  assert.equal(joinOf(6, 'count'), 'open'); assert.equal(joinOf(6, 'top'), null);
  for (const c of [15, 6]) for (const n of ['open', 'months', 'title', 'end']) assert.equal(joinOf(c, n), null);
  assert.deepEqual(Object.keys(JOIN), ['count', 'top']);
});

test('across each join the camera does not move: the last frame of the shot before and the first frame after solve to the same pose', () => {
  for (const ar of Object.keys(ASPECTS)) {
    const [W, H] = ASPECTS[ar], v = { cut: 15, promo: 'none', ar };
    for (const [name, prev] of Object.entries(JOIN)) {
      const end = solvePose(cameraOf(prev, at(15, prev, durOf(15, prev)), v, ar), LAYOUTS[ar][prev], W / H);
      const start = solvePose(cameraOf(name, at(15, name, 0), v, ar), LAYOUTS[ar][name], W / H);
      for (const k of ['position', 'target', 'offset']) close(start[k], end[k], 1e-6, `${ar} ${prev}→${name} ${k}`);
      assert.ok(Math.abs(start.fov - end.fov) < 1e-9);
      // 缓完之后就是本镜头自己的机位
      const own = cameraOf(name, at(15, name, EASE_IN), v, ar);
      assert.equal(own.type, 'fit', `${ar} ${name} is still blending at EASE_IN`);
    }
  }
});

test('open → count: every tile on the wall is exactly where open left it, and no parcel shows yet', () => {
  for (const u of USER_IDS) {
    const pal = USERS[u].palette, s = statsFor(u), wall = buildWall({ year: s.year, days: s.days, pal }), pile = buildPile({ wall, pal, user: u });
    const grab = () => wall.root.children.map(m => Array.from(m.instanceMatrix.array));
    wall.pose(durOf(15, 'open')); const a = grab();
    pile.pose(0); const b = grab();
    a.forEach((arr, i) => close(arr, b[i], 1e-5, `${u} wall set ${i}`));
    const m = new THREE.Matrix4(), sc = new THREE.Vector3(), [box] = pile.root.children;
    for (let j = 0; j < box.count; j++) { box.getMatrixAt(j, m); sc.setFromMatrixScale(m); assert.ok(sc.length() < 1e-9, `${u}: parcel ${j} shows at count 0`); }
  }
});

test('months → top: the chart starts top exactly as months left it', () => {
  for (const u of USER_IDS) {
    const s = statsFor(u), chart = buildChart({ months: s.months, pal: USERS[u].palette });
    const grab = () => { chart.root.updateMatrixWorld(true); return chart.root.children.map(m => [...m.matrixWorld.elements, ...(m.material.color?.toArray() ?? []), m.material.emissiveIntensity ?? 0]); };
    chart.pose(durOf(15, 'months')); const a = grab();
    chart.sink(0); const b = grab();
    a.forEach((x, i) => close(x, b[i], 1e-9, `${u} chart part ${i}`));
  }
});
