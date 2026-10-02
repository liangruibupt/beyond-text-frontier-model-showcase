import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import film from '../film.js';
import { META, VASE } from '../meta.js';
import { SCARVES } from '../scarves.js';
import { buildWorld, bust } from '../js/worlds.js';
import { buildScarf } from '../js/scarf.js';
import { bakeFor } from '../js/sims.js';
import { buildCut, cutOf, resolve } from '../../factory/engine/timeline.js';

// 在 Node 里按引擎的方式求帧（reset → 镜头函数），比较丝巾顶点、人台 / 礼盒可见性与相机意图；顺序、倒序、乱序必须一致
function make(scarf) {
  const ctx = { variant: { scarf, lang: 'zh', cut: 15, promo: 'none', ar: '16x9', vo: 'on' }, scene: new THREE.Scene(), renderer: null };
  const k = SCARVES[scarf];
  ctx.world = buildWorld(ctx, scarf, k);
  const scarfMesh = buildScarf(k), b = bust(), gb = new THREE.Group(); gb.userData.floor = 0.888;
  gb.userData.lid = 0; gb.userData.closeLid = x => { gb.userData.lid = x; };
  const reveal = scarfMesh.setReveal; scarfMesh.reveal = 1; scarfMesh.setReveal = r => { scarfMesh.reveal = r; reveal(r); };   // 记下织出进度，状态里比
  ctx.subjects = { scarf: scarfMesh, sims: bakeFor(scarf), world: ctx.world, bust: b.group, giftBox: gb };
  return ctx;
}
function state(ctx, built, t) {
  const r = resolve(built, t);
  film.reset(ctx);
  const o = film.shots[r.shot](ctx, { name: r.shot, lt: r.lt, dur: r.dur, u: r.u, from: 0, t, row: {} });
  const { scarf, bust: b, giftBox, world } = ctx.subjects, vase = world.props.vase?.mesh;
  return [Array.from(scarf.positions).map(x => x.toFixed(6)).join(','), scarf.mesh.visible, b.visible, giftBox.visible, giftBox.userData.lid.toFixed(4), scarf.reveal.toFixed(4), vase ? vase.rotation.y.toFixed(5) + '/' + vase.userData.reveal : '', JSON.stringify(o.camera.dir)].join('|');
}

for (const scarf of ['dunhuang', 'songjin', 'qinghua']) test(`${scarf} frames depend only on t (both cuts): in order, reversed and shuffled agree`, () => {
  const ctx = make(scarf);
  for (const cut of [15, 6]) {
    ctx.variant.cut = cut;
    const b = buildCut(cutOf(META, ctx.variant)), ts = Array.from({ length: 20 }, (_, i) => (i + 0.31) * (b.duration / 20));
    const fwd = ts.map(t => state(ctx, b, t)), rev = [...ts].reverse().map(t => state(ctx, b, t)).reverse();
    const mix = [];
    for (const i of ts.map((_, i) => (i * 7) % ts.length)) mix[i] = state(ctx, b, ts[i]);
    fwd.forEach((s, i) => {
      assert.equal(rev[i], s, `${cut}s t=${ts[i].toFixed(2)} reversed`);
      assert.equal(mix[i], s, `${cut}s t=${ts[i].toFixed(2)} shuffled`);
    });
  }
});

test('the dunhuang scarf ends up on the bust shoulders (drape) and every vertex is finite', () => {
  const ctx = make('dunhuang'), b = buildCut(cutOf(META, ctx.variant)), e = b.entries.find(x => x.shot === 'dh_drape');
  state(ctx, b, e.end - 0.01);
  const P = ctx.subjects.scarf.positions;
  let top = -1;
  for (let k = 0; k < P.length; k += 3) { assert.ok(Number.isFinite(P[k]) && Number.isFinite(P[k + 1])); top = Math.max(top, P[k + 1]); }
  assert.ok(top > 1.38 && top < 1.6, `top of the scarf at ${top.toFixed(3)} m`);
});

test('songjin: the weave reveals the pattern row by row, finishes woven, and the box lid closes', () => {
  const ctx = make('songjin'), b = buildCut(cutOf(META, ctx.variant)), at = id => b.entries.find(x => x.shot === id);
  const rv = t => { state(ctx, b, t); return ctx.subjects.scarf.reveal; };
  const w = at('sj_warp'), v = at('sj_weave'), x = at('sj_box');
  assert.ok(rv(w.start + 0.1) < 0.05, 'warp starts bare');
  assert.ok(rv(w.start + 1.5) > rv(w.start + 0.8), 'reveal advances');
  assert.equal(rv(v.end - 0.05), 1, 'woven by the end of sj_weave');
  state(ctx, b, x.end - 0.01); assert.ok(ctx.subjects.giftBox.userData.lid > 0.99, 'lid shut');
  state(ctx, b, x.start + 0.1); assert.ok(ctx.subjects.giftBox.userData.lid < 0.01, 'lid open at the drop');
});

test('qinghua: the scarf slips down the vase onto the table and never passes through it', () => {
  const ctx = make('qinghua'), b = buildCut(cutOf(META, ctx.variant)), e = b.entries.find(x => x.shot === 'qh_slip'), V = VASE;
  state(ctx, b, e.end - 0.01);
  const P = ctx.subjects.scarf.positions;
  let onTable = 0;
  for (let k = 0; k < P.length; k += 3) {
    const y = P[k + 1] - V.table, r = Math.hypot(P[k] - V.x, P[k + 2] - V.z);
    assert.ok(y > -0.002, `vertex below the table (${y.toFixed(4)})`);
    // 瓶身内部：半径小于该高度轮廓半径 − 5 mm
    const seg = V.profile.findIndex(([py], q) => q + 1 < V.profile.length && y >= py && y <= V.profile[q + 1][0]);
    if (seg >= 0) { const [y0, r0] = V.profile[seg], [y1, r1] = V.profile[seg + 1], rr = r0 + (r1 - r0) * (y - y0) / (y1 - y0 || 1); assert.ok(r > rr - 0.005, `vertex inside the vase at y=${y.toFixed(3)} r=${r.toFixed(3)}`); }
    if (y < 0.02) onTable++;
  }
  assert.ok(onTable > 20, `${onTable} vertices on the table`);
});
