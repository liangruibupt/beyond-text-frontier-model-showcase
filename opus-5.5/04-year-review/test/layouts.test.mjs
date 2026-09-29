import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { LAYOUTS } from '../layouts.js';
import { META, CUTS, VIEW, BOX, endBox, viewDir } from '../meta.js';
import { layersFor } from '../captions.js';
import { ASPECTS, UNSAFE, MARGIN, expandJobs } from '../../factory/engine/variant.js';
import { solvePose, applyPose, project } from '../../factory/engine/framing.js';

const hit = (a, b, eps = 1e-3) => a[0] < b[0] + b[2] - eps && b[0] < a[0] + a[2] - eps && a[1] < b[1] + b[3] - eps && b[1] < a[1] + a[3] - eps;
const inside = r => r[0] >= MARGIN - 1e-9 && r[1] >= MARGIN - 1e-9 && r[0] + r[2] <= 1 - MARGIN + 1e-9 && r[1] + r[3] <= 1 - MARGIN + 1e-9;
const box3 = ([a, b]) => new THREE.Box3(new THREE.Vector3(...a), new THREE.Vector3(...b));
// 每个镜头框取的盒子；片尾两种都查（none、launch 是奖牌，1111 是商品）
const framed = shot => (shot === 'end' ? [...new Set(META.axes.promo.map(endBox))] : [VIEW[shot].box]);

/** 该比例下镜头 shot 框取 box 时主体的投影矩形 [x, y, w, h]；yaw 取镜头机位范围内的 5 个值 */
function subjectRects(ar, shot, box) {
  const [W, H] = ASPECTS[ar], V = VIEW[shot], row = LAYOUTS[ar][shot], cam = new THREE.PerspectiveCamera();
  return [0, 0.25, 0.5, 0.75, 1].map(k => {
    const yaw = V.yaw[0] + (V.yaw[1] - V.yaw[0]) * k;
    applyPose(cam, solvePose({ type: 'fit', box: box3(BOX[box]), dir: viewDir(V.pitch, yaw), fov: V.fov }, row, W / H), W, H);
    const p = project(cam, box3(BOX[box]));
    return [p.minX, p.minY, p.maxX - p.minX, p.maxY - p.minY];
  });
}

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
    for (const l of layersFor(v, { name: e.shot, from: e.from ?? 0, row })) assert.ok(row.zones?.[l.zone], `${v.ar}.${e.shot} has no zone ${l.zone}`);
  }
});

test('the subject stays in the safe frame and clear of the text zones', () => {
  for (const ar of Object.keys(ASPECTS)) for (const shot of Object.keys(VIEW)) for (const box of framed(shot)) {
    const row = LAYOUTS[ar][shot];
    for (const r of subjectRects(ar, shot, box)) {
      assert.ok(inside(r), `${ar}.${shot} ${box} crosses the margin: ${r.map(x => x.toFixed(3))}`);
      for (const u of UNSAFE[ar]) assert.ok(!hit(r, u), `${ar}.${shot} ${box} is under platform UI`);
      for (const [z, zr] of Object.entries(row.zones ?? {})) assert.ok(!hit(r, zr), `${ar}.${shot} ${box} overlaps ${z}: ${r.map(x => x.toFixed(3))}`);
    }
  }
});
