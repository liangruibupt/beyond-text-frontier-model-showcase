import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildCup, dewAt, lidDent, rOut, DEW, LID, STREAM, surfaceDisp, streamAt } from '../js/cup.js';
import { bakePearls } from '../js/pearls.js';
import { SHOTS } from '../js/shots.js';
import { FLAVORS } from '../flavors.js';
import { CUTS, CUP, STRAW, BOX, EV } from '../meta.js';
import { buildCut } from '../../factory/engine/timeline.js';

const pearls = bakePearls();
const make = (flavor = 'brownsugar') => {
  const ctx = { variant: { flavor, lang: 'zh', cut: 15, promo: 'none', ar: '16x9', vo: 'on' } };
  ctx.subjects = { cup: buildCup(ctx, FLAVORS[flavor], pearls) };
  return ctx;
};
/** 按引擎的方式求一帧（先 reset 再调镜头），返回杯子的全部逐帧状态 */
function frame(ctx, b, t) {
  const e = b.entries.find(x => t >= x.start && t < x.end) ?? b.entries.at(-1), lt = e.from + t - e.start, dur = e.from + (e.end - e.start), cup = ctx.subjects.cup;
  cup.pose(); cup.root.rotation.y = 0;
  SHOTS[e.shot](ctx, { name: e.shot, lt, dur, u: Math.min(1, lt / dur), from: e.from, t, row: {} });
  const P = cup.parts;
  return [P.pearls.instanceMatrix.array, P.dew.instanceMatrix.array, P.lid.geometry.attributes.position.array, P.straw.position.toArray(), [P.straw.visible, P.lid.visible, P.ice.visible, P.dew.visible, cup.root.rotation.y],
    P.ice.children.flatMap(c => [...c.position.toArray(), ...c.rotation.toArray().slice(0, 3)]), [P.body.scale.y, P.body.position.y], P.surface.geometry.attributes.position.array, P.foam.instanceMatrix.array, P.splash.instanceMatrix.array, P.stream.geometry.attributes.position.array, [P.stream.visible]].map(a => Array.from(a).join(',')).join('|');
}

test('every frame depends only on t: in order, shuffled and reversed give the same state (both cuts, all flavours)', () => {
  for (const f of Object.keys(FLAVORS)) for (const cut of Object.values(CUTS)) {
    const ctx = make(f), b = buildCut(cut), ts = Array.from({ length: 24 }, (_, i) => (i + 0.37) * (b.duration / 24));
    const fwd = ts.map(t => frame(ctx, b, t)), rev = [...ts].reverse().map(t => frame(ctx, b, t)).reverse();
    const idx = ts.map((_, i) => (i * 7) % ts.length), mix = []; for (const i of idx) mix[i] = frame(ctx, b, ts[i]);
    fwd.forEach((s, i) => { assert.equal(rev[i], s, `${f} ${b.duration}s t=${ts[i].toFixed(2)} reversed`); assert.equal(mix[i], s, `${f} ${b.duration}s t=${ts[i].toFixed(2)} shuffled`); });
  }
});

test('the lid dents smoothly toward the centre and is flat at the rim', () => {
  let prev = Infinity;
  for (let r = 0; r <= LID.radius; r += LID.radius / 40) { const d = lidDent(r, 1); assert.ok(d <= prev + 1e-12); prev = d; }
  assert.ok(Math.abs(lidDent(0, 1) - LID.dent) < 1e-12);
  assert.equal(lidDent(LID.radius, 1), 0);
  assert.equal(lidDent(0.01, 0), 0);
});

test('the straw punches through on the shot event and ends at the cup floor', () => {
  const ctx = make(), cup = ctx.subjects.cup, run = lt => { cup.pose(); SHOTS.straw(ctx, { name: 'straw', lt, dur: 3, u: lt / 3, from: 0, t: lt, row: {} }); return cup.posed; };
  assert.equal(run(EV.punch - 0.01).punch, -1, 'not yet punched just before the event');
  assert.ok(run(EV.punch).punch >= 0, 'punched on the event');
  const tip = () => cup.parts.straw.position.y - STRAW.len / 2;
  run(EV.punch - 0.05); assert.ok(tip() > CUP.height - LID.dent - 1e-3, 'before the punch the straw rests on the dented lid');
  run(2.9); assert.ok(tip() < CUP.base + 0.006, `the straw reaches the floor (tip ${tip()})`);
});

test('condensation sits on the outer wall below the tea line; one drop slides down during hero', () => {
  for (let i = 0; i < DEW.n; i++) {
    const [, y, r] = dewAt(i, 2.5);
    assert.ok(y > CUP.base && y < CUP.fill, `dew ${i} at ${y}`);
    assert.ok(r > 0 && r <= DEW.r[1] * 1.3);
  }
  assert.equal(dewAt(3, 0)[2], 0, 'no dew before it condenses');
  const y0 = dewAt(DEW.drip.i, DEW.drip.at)[1], y1 = dewAt(DEW.drip.i, DEW.drip.at + DEW.drip.dur)[1];
  assert.ok(y0 - y1 > 0.04, `drip falls ${y0 - y1} m`);
  assert.ok(rOut(y1) > rOut(0));
});

test('everything visible stays inside the framing boxes', () => {
  const ctx = make(), cup = ctx.subjects.cup, box = ([a, b]) => new THREE.Box3(new THREE.Vector3(...a), new THREE.Vector3(...b)).expandByScalar(0.004);
  cup.pose({ punch: 3, straw: 1, dewT: 6, iceT: 5 });
  const B = new THREE.Box3();
  for (const k of ['glass', 'liquid', 'ice', 'lid']) B.union(new THREE.Box3().setFromObject(cup.parts[k]));
  assert.ok(box(BOX.cup).containsBox(B), `cup parts ${B.min.toArray()} ${B.max.toArray()}`);
  const S = new THREE.Box3().setFromObject(cup.parts.straw);
  assert.ok(S.min.y >= 0 && S.max.y > CUP.height, 'the straw sticks out above the lid');
});

test('pouring: the surface dips under the stream, is flat before the pour and at the wall, and the stream lands on it', () => {
  const R = 0.04;
  assert.equal(surfaceDisp(STREAM.x, STREAM.z, -1, R), 0);
  assert.ok(surfaceDisp(STREAM.x, STREAM.z, 0.8, R) < -0.002, 'a crater where the milk lands');
  for (let a = 0; a < 6.3; a += 0.3) assert.ok(Math.abs(surfaceDisp(Math.cos(a) * R, Math.sin(a) * R, 0.8, R)) < 1e-9, 'still at the wall');
  assert.ok(Math.abs(surfaceDisp(0.01, 0.01, 4, R)) < 2e-4, 'settles after the pour');
  const top = 0.07, c = streamAt(1, top, 0.5); assert.ok(Math.abs(c[1] - top) < 1e-12);
  assert.ok(Math.abs(c[0] - STREAM.x) < 0.002 && Math.abs(c[2] - STREAM.z) < 0.002);
});
