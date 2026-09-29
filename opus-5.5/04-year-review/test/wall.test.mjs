import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildWall, tilePose, flipStart, FLIP, POP } from '../js/wall.js';
import { DEPTH } from '../js/models/tile.js';
import { WALL } from '../js/digits.js';
import { EV, BOX } from '../meta.js';
import { USERS, USER_IDS } from '../users.js';
import { statsFor } from '../facts.js';

test('the flips run in day order from the start of EV.flip, and the last one lands at its end', () => {
  const n = 365;
  assert.equal(flipStart(0, n), EV.flip[0]);
  assert.ok(Math.abs(flipStart(n - 1, n) + FLIP - EV.flip[1]) < 1e-12);
  for (let k = 1; k < n; k++) assert.ok(flipStart(k, n) > flipStart(k - 1, n));
});

test('a tile starts with its back to the camera, ends facing it, and never leaves the wall box while it turns', () => {
  const tile = { x: 0, y: 1, angle: 0.3 }, n = 365, zMax = BOX.wall[1][2];
  for (const k of [0, 180, 364]) {
    assert.equal(tilePose(tile, k, n, 0).flip, Math.PI);
    assert.equal(tilePose(tile, k, n, EV.flip[1]).flip, 0);
    for (let lt = 0; lt <= 2.25; lt += 0.01) {
      const P = tilePose(tile, k, n, lt), reach = P.z + Math.abs(Math.sin(P.flip)) * WALL.tile / 2 + Math.abs(Math.cos(P.flip)) * DEPTH / 2;
      assert.ok(P.z >= 0 && P.z <= POP && reach <= zMax, `k ${k} lt ${lt.toFixed(2)} reaches z ${reach.toFixed(3)}`);
    }
  }
});

test('every order day is a lit tile, every other day a base tile, and the instance matrices follow the pose', () => {
  for (const u of USER_IDS) {
    const s = statsFor(u), wall = buildWall({ year: s.year, days: s.days, pal: USERS[u].palette });
    const [lit, base] = wall.root.children;
    assert.equal(lit.count, s.activeDays); assert.equal(base.count, wall.tiles.length - s.activeDays);
    const m = new THREE.Matrix4(), p = new THREE.Vector3(), zAxis = new THREE.Vector3();
    for (const [lt, facing] of [[0, -1], [EV.flip[1], 1]]) {
      wall.pose(lt);
      lit.getMatrixAt(0, m); p.setFromMatrixPosition(m); m.extractBasis(new THREE.Vector3(), new THREE.Vector3(), zAxis);
      const k = s.days[0], t = wall.tiles[k];
      assert.ok(Math.abs(p.x - t.x) < 1e-6 && Math.abs(p.y - t.y) < 1e-6 && Math.abs(p.z) < 1e-6, u);   // 实例矩阵是 float32
      assert.ok(Math.abs(zAxis.z - facing) < 1e-6, `${u} at ${lt}: the face points ${zAxis.z}`);
    }
  }
});
