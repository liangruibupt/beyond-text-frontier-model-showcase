// world.test.mjs — 在 Node 里搭整座世界（不渲染），检查：每个镜头的机位有限、不跳；世界只看故事时间（乱序求值 = 顺序求值，reset 复原）；
// 6 秒版从中段切入时落在主体上；主体都在画面里。
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import film from '../film.js';
import { CUTS, SHOTS as NAMES, poseFor, rowsFor, NATURAL, RIG, storyT, FOV } from '../meta.js';
import { ITEM_IDS, isAiItem } from '../items.js';
import { buildCut } from '../../factory/engine/timeline.js';

async function make(item, ar = '16x9') {
  const ctx = { THREE, scene: new THREE.Scene(), variant: { item, ar, lang: 'zh', cut: 15, promo: 'none', vo: 'on' }, ar };
  await film.setup(ctx);
  return ctx;
}
const snap = scene => { const o = []; scene.traverse(n => o.push(`${n.name || n.type}:${n.position.toArray().map(v => v.toFixed(5))}/${n.rotation.toArray().slice(0, 3).map(v => v.toFixed(5))}/${n.visible}/${n.scale.x.toFixed(5)}${n.intensity !== undefined ? '/' + n.intensity.toFixed(5) : ''}`)); return o; };
/** 两份快照相同；不同就只报第一处差异 */
function same(a, b, where) {
  const i = a.findIndex((x, k) => x !== b[k]);
  assert.ok(i < 0 && a.length === b.length, `${where}: node ${i}: ${a[i]} ≠ ${b[i]}`);
}

test('camera is finite everywhere and continuous across every 15 s cut (one take)', () => {
  for (const ar of ['16x9', '1x1', '9x16']) {
    const rows = rowsFor(ar);
    for (let i = 0; i < NAMES.length - 1; i++) {
      const a = poseFor(NAMES[i], NATURAL[NAMES[i]], rows), b = poseFor(NAMES[i + 1], 0, rows);
      for (const k of ['position', 'target', 'offset']) a[k].forEach((v, j) => assert.ok(Math.abs(v - b[k][j]) < 1e-6, `${ar} ${NAMES[i]}→${NAMES[i + 1]} ${k}`));
    }
    for (const n of NAMES) for (let lt = 0; lt <= NATURAL[n]; lt += 0.05) {
      const p = poseFor(n, lt, rows);
      for (const v of [...p.position, ...p.target, ...p.offset]) assert.ok(Number.isFinite(v), `${n}@${lt}`);
    }
  }
});

test('the world depends on story time only: shuffled evaluation = in-order evaluation, reset restores t = 0', async () => {
  for (const item of ITEM_IDS) {
    if (isAiItem(item)) continue;   // AI 变体画面来自预拆帧，没有可快照的 three.js 场景；由引擎渲染路径验证
    const ctx = await make(item), w = ctx.world, ts = [];
    for (let t = 0; t <= 15; t += 0.37) ts.push(+t.toFixed(2));
    const ref = new Map();
    w.reset(); const s0 = snap(ctx.scene);
    for (const t of ts) { w.update({ t }); ref.set(t, snap(ctx.scene)); }
    for (const t of [...ts].reverse()) { w.update({ t: 14.9 }); w.reset(); w.update({ t }); same(snap(ctx.scene), ref.get(t), `${item} t=${t}`); }
    w.reset(); same(snap(ctx.scene), s0, `${item} reset`);
    w.dispose();
  }
});

test('6 s cut: every moment lands on the same frame as the 15 s cut at that story time', async () => {
  const ctx = await make('lantern', '1x1'), b6 = buildCut(CUTS[6]), w = ctx.world;
  for (const e of b6.entries) for (let lt = e.from; lt < e.dur; lt += 0.1) {
    const s = { name: e.shot, lt, dur: e.dur, u: lt / e.dur, from: e.from, t: e.start + lt - e.from, row: rowsFor('1x1')[e.shot] };
    const cam6 = film.shots[e.shot](ctx, s).camera, a = snap(ctx.scene);
    const s15 = { ...s, t: storyT(e.shot, lt) }, cam15 = film.shots[e.shot](ctx, s15).camera;
    same(a, snap(ctx.scene), `${e.shot}@${lt}`); assert.deepEqual(cam6, cam15);
  }
  w.dispose();
});

/** 把世界点投到画面（0–1，y 向下），带 view offset */
function project(pose, p, aspect) {
  const cam = new THREE.PerspectiveCamera(FOV, aspect, 0.01, 100);
  cam.position.fromArray(pose.position); cam.lookAt(...pose.target); cam.updateMatrixWorld();
  const v = new THREE.Vector3(...p).project(cam);
  return [(v.x + 1) / 2 - pose.offset[0], (1 - v.y) / 2 - pose.offset[1]];
}

test('subjects sit inside the frame while each shot holds, and the 6 s entry points frame the right subject', async () => {
  const AR = { '16x9': 16 / 9, '1x1': 1 };
  for (const [ar, aspect] of Object.entries(AR)) {
    const rows = rowsFor(ar);
    for (const n of NAMES) {
      const hold = RIG[n].move[0] * NATURAL[n];
      for (let lt = 0; lt < Math.min(hold, NATURAL[n]); lt += 0.1) {
        const p = poseFor(n, lt, rows), [x, y] = project(p, RIG[n].at(lt), aspect), [ax, ay] = rows[n]?.anchor ?? [0.5, 0.5];
        assert.ok(Math.abs(x - ax) < 0.02 && Math.abs(y - ay) < 0.02, `${ar} ${n}@${lt.toFixed(1)} subject at ${x.toFixed(2)},${y.toFixed(2)} not ${ax},${ay}`);
      }
    }
  }
  // 6 秒版的三个切入时刻都还在各自镜头的 hold 里（不是半路机位）
  const b6 = buildCut(CUTS[6]);
  for (const [t, name] of [[0.5, 'order'], [1.6, 'sort'], [2.8, 'door']]) {
    const e = b6.entries.find(x => t >= x.start && t < x.end); assert.equal(e.shot, name);
    const lt = e.from + t - e.start; assert.ok(lt / NATURAL[name] < RIG[name].move[0], `${name} entered at lt ${lt} is mid-move`);
  }
});
