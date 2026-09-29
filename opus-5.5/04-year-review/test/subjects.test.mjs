import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { EV, BOX } from '../meta.js';
import { USERS, USER_IDS } from '../users.js';
import { ITEMS, KINDS } from '../catalog.js';
import { statsFor, storyOf } from '../facts.js';
import { buildWall } from '../js/wall.js';
import { buildPile, layoutPile, liftAt, FLY, SQUASH } from '../js/pile.js';
import { buildChart, CHART, RISE, SINK, riseAt, barX } from '../js/chart.js';
import { LABEL_GAP, layoutLabel } from '../js/digits.js';
import { buildTop, PIE, PRODUCT, CART_AT, SWEEP, sweepAt } from '../js/pie.js';
import { CART } from '../js/models/cart.js';
import { buildProduct } from '../js/models/product.js';
import { buildMedal, heightAt, CONTACTS, BOUNCE, DROP, SPARKLE } from '../js/medal.js';
import { buildStand, STAND } from '../js/stand.js';
import { buildMedalModel } from '../js/models/medal.js';

const EPS = 5e-3;
const box3 = ([a, b]) => new THREE.Box3(new THREE.Vector3(...a), new THREE.Vector3(...b));
/** 看得见的部分的包围盒：柱子和饼块在地面以下的部分被裁掉，所以 y 从 0 算 */
function seen(o) {
  o.updateMatrixWorld(true);
  const b = new THREE.Box3();
  o.traverse(m => {
    if (!m.isMesh || !m.visible) return;
    if (m.isInstancedMesh) m.boundingBox = null;                       // 实例的包围盒算一次就缓存，跟不上姿态
    b.union(new THREE.Box3().setFromObject(m, true));
  });
  b.min.y = Math.max(b.min.y, 0);
  return b;
}
const within = (b, name, what) => {
  const B = box3(BOX[name]).expandByScalar(EPS);
  assert.ok(B.containsBox(b), `${what} leaves BOX.${name}: ${b.min.toArray().map(x => x.toFixed(3))} → ${b.max.toArray().map(x => x.toFixed(3))}`);
};
const scene = u => {
  const pal = USERS[u].palette, s = statsFor(u), wall = buildWall({ year: s.year, days: s.days, pal });
  return { pal, s, wall, pile: buildPile({ wall, pal, user: u }) };
};

// ── count：包裹堆 ──

test('one parcel per order day; the last one leaves at LIFT and every parcel has landed by EV.land', () => {
  for (const u of USER_IDS) {
    const { s, pile } = scene(u), n = s.activeDays;
    assert.equal(pile.slots.length, n, u);
    assert.ok(Math.abs(liftAt(n - 1, n) + FLY - EV.land) < 1e-9);
    for (let j = 0; j < n; j++) assert.ok(liftAt(j, n) + FLY <= EV.land + 1e-9);
  }
});

test('settled parcels never overlap: stacked ones touch, neighbours have daylight between their turned footprints', () => {
  const corners = f => { const [sx, , sz] = f.scale, c = Math.cos(f.yaw), s = Math.sin(f.yaw); return [[1, 1], [1, -1], [-1, -1], [-1, 1]].map(([a, b]) => [f.at[0] + (a * sx * c + b * sz * s) / 2, f.at[2] + (-a * sx * s + b * sz * c) / 2]); };
  const axes = P => P.map((p, i) => { const q = P[(i + 1) % 4]; return [q[1] - p[1], p[0] - q[0]]; });
  const apart = (P, Q) => [...axes(P), ...axes(Q)].some(([ax, az]) => {
    const pr = R => R.map(([x, z]) => x * ax + z * az), a = pr(P), b = pr(Q);
    return Math.max(...a) <= Math.min(...b) + 1e-9 || Math.max(...b) <= Math.min(...a) + 1e-9;
  });
  for (const u of USER_IDS) {
    const { pile } = scene(u), F = pile.slots.map((_, j) => pile.flight(j, EV.land + SQUASH + 0.01)), C = F.map(corners);
    for (let i = 0; i < F.length; i++) for (let j = i + 1; j < F.length; j++) {
      const [yi, yj] = [F[i], F[j]].map(f => [f.at[1] - f.scale[1] / 2, f.at[1] + f.scale[1] / 2]);
      if (yi[1] <= yj[0] + 1e-6 || yj[1] <= yi[0] + 1e-6) continue;
      assert.ok(apart(C[i], C[j]), `${u}: parcels ${i} and ${j} overlap`);
    }
    for (const f of F) assert.ok(f.at[1] - f.scale[1] / 2 >= -1e-9, `${u}: a parcel sinks into the floor`);
  }
});

test('a parcel squashes as it lands and the ones stacked on it ride down with it, so a stack never interpenetrates', () => {
  for (const u of USER_IDS) {
    const { pile } = scene(u), S = pile.slots;
    for (let lt = 0.3; lt <= EV.land + SQUASH; lt += 0.01) {
      const F = S.map((_, j) => pile.flight(j, lt));
      S.forEach((s, j) => {
        const under = S.findIndex(o => o.col === s.col && o.level === s.level - 1);
        if (under < 0 || F[j].scale[1] < s.h * 0.999 * (1 - 0.16)) return;   // 还在空中长大
        const top = F[under].at[1] + F[under].scale[1] / 2, bottom = F[j].at[1] - F[j].scale[1] / 2;
        if (lt >= liftAt(j, S.length) + FLY) assert.ok(Math.abs(bottom - top) < 1e-9, `${u} lt ${lt.toFixed(2)}: parcel ${j} floats or sinks on ${under}`);
      });
    }
  }
});

test('the settled pile stays inside BOX.pile, and the pile layout is the same every time', () => {
  for (const u of USER_IDS) {
    const { pile } = scene(u);
    for (const lt of [EV.land, EV.land + SQUASH, 2.25]) { pile.pose(lt); within(seen(pile.root.children[0]), 'pile', `${u} at ${lt}`); }
  }
  assert.deepEqual(layoutPile(100, 3), layoutPile(100, 3));
});

// ── months：柱子和月份 ──

test('month labels: dots at least 1.1 diameters apart, on the plinth face, centred under their bars and clearly apart from the next label', () => {
  const { height, dot, y0 } = CHART.label, [pw, ph, pd] = CHART.plinth, L = Array.from({ length: 12 }, (_, i) => layoutLabel(String(i + 1), { height, dot, x: barX(i), y0 }));
  const all = L.flat();
  for (let a = 0; a < all.length; a++) for (let b = a + 1; b < all.length; b++) assert.ok(Math.hypot(all[a].x - all[b].x, all[a].y - all[b].y) >= LABEL_GAP * dot - 1e-9);
  for (const p of all) assert.ok(Math.abs(p.x) + dot / 2 <= pw / 2 - 0.05 && p.y - dot / 2 >= 0.02 && p.y + dot / 2 <= ph - 0.02, `dot at (${p.x}, ${p.y})`);
  const ext = L.map(l => [Math.min(...l.map(p => p.x)), Math.max(...l.map(p => p.x))]);
  ext.forEach(([a, b], i) => assert.ok(Math.abs((a + b) / 2 - barX(i)) < 1e-9, `label ${i + 1} is off its bar`));
  // 两位数的标签里字距是 0.3 字高；和相邻标签的间距至少是它的两倍，10 11 12 不连成一串
  for (let i = 1; i < 12; i++) assert.ok(ext[i][0] - ext[i - 1][1] >= 2 * 0.3 * height, `labels ${i} and ${i + 1} run together`);
  assert.ok(pd > 0);
});

test('bars rise in month order from EV.rise, the busiest one lights at EV.peak, and the chart stays in BOX.bars', () => {
  for (const u of USER_IDS) {
    const { pal, s } = scene(u), chart = buildChart({ months: s.months, pal }), [, ph] = CHART.plinth, max = Math.max(...s.months);
    const bars = chart.root.children.slice(1, 13);                     // 底座之后是十二根柱子
    const top = (i, lt) => { chart.pose(lt); chart.root.updateMatrixWorld(true); return new THREE.Box3().setFromObject(bars[i]).max.y; };
    for (let i = 0; i < 12; i++) {
      assert.ok(Math.abs(top(i, riseAt(i)) - ph) < 1e-6, `${u}: bar ${i} shows before riseAt`);
      assert.ok(Math.abs(top(i, riseAt(i) + RISE) - (ph + (CHART.tall * s.months[i]) / max)) < 1e-6, `${u}: bar ${i} is not full at riseAt + RISE`);
    }
    assert.ok(Math.abs(riseAt(11) + RISE - EV.rise[1]) < 1e-12);
    chart.pose(0); const dark = bars[chart.peak].material.emissiveIntensity;
    chart.pose(EV.peak + 0.1); assert.ok(dark === 0 && bars[chart.peak].material.emissiveIntensity > 0.8, u);
    for (let lt = 0; lt <= 3; lt += 0.05) { chart.pose(lt); within(seen(chart.root), 'bars', `${u} months at ${lt.toFixed(2)}`); }
  }
});

test('at the start of top the chart shrinks and sinks: after SINK nothing of it is above the floor', () => {
  for (const u of USER_IDS) {
    const { pal, s } = scene(u), chart = buildChart({ months: s.months, pal });
    chart.sink(SINK);
    chart.root.updateMatrixWorld(true);
    chart.root.traverse(m => { if (m.isInstancedMesh) m.boundingBox = null; });
    const top = new THREE.Box3().setFromObject(chart.root).max.y;
    assert.ok(top < 0, `${u}: the chart still reaches ${top}`);
    for (const m of chart.root.children.filter(m => m.isMesh)) assert.ok(m.material.clippingPlanes?.some(p => p.normal.y === 1 && p.constant === 0), `${u}: a chart part is not clipped at the floor`);
  }
});

// ── top：饼图、商品、购物车 ──

test('pie slices follow the category shares, the biggest centred on PIE.mid, and sweep up in order from EV.sweep', () => {
  for (const u of USER_IDS) {
    const { pal, s } = scene(u), top = buildTop({ categories: s.categories, item: s.top.item, pal }), sl = top.slices, tot = s.categories.reduce((a, c) => a + c.share, 0);
    assert.equal(sl.length, s.categories.length);
    assert.ok(Math.abs(sl[0].mid - PIE.mid) < 1e-12);
    sl.forEach((x, i) => {
      assert.ok(Math.abs(x.angles[1] - x.angles[0] - (2 * Math.PI * s.categories[i].share) / tot) < 1e-12);
      if (i) assert.equal(x.angles[0], sl[i - 1].angles[1]);
    });
    assert.ok(Math.abs(sl.at(-1).angles[1] - sl[0].angles[0] - 2 * Math.PI) < 1e-12);
    const k = sl.length;
    assert.equal(sweepAt(0, k), EV.sweep[0]); assert.ok(Math.abs(sweepAt(k - 1, k) + SWEEP - EV.sweep[1]) < 1e-12);
    top.pose(sweepAt(0, k)); for (const x of sl) assert.ok(x.mesh.position.y <= -PIE.h, `${u}: a slice shows before its sweep`);
    top.pose(EV.sweep[1]); for (const x of sl) assert.ok(Math.abs(x.mesh.position.y) < 1e-9, `${u}: a slice is not up at the end of the sweep`);
    for (const x of sl) assert.ok(x.mesh.material.clippingPlanes?.some(p => p.normal.y === 1 && p.constant === 0));
  }
});

test('the cart rolls in and stops before the favourite flies; it lands in the basket at EV.cart and rests inside it, whatever the item', () => {
  const B = CART.bottom;
  for (const [id, item] of Object.entries(ITEMS)) {
    const pal = USERS.coffee.palette, s = statsFor('coffee'), top = buildTop({ categories: s.categories, item: id, pal });
    top.pose(CART_AT.roll[1]); assert.equal(top.cart.position.x, CART_AT.x);
    top.pose(PRODUCT.pop[0] - 0.01); assert.equal(top.product.visible, false);
    for (const lt of [EV.cart, EV.cart + 0.5, 3]) {
      top.pose(lt); top.root.updateMatrixWorld(true);
      const b = new THREE.Box3().setFromObject(top.product, true), x0 = CART_AT.x + B.x[0], x1 = CART_AT.x + B.x[1];
      assert.ok(b.min.x >= x0 - 1e-3 && b.max.x <= x1 + 1e-3 && b.min.z >= -B.z && b.max.z <= B.z && b.min.y >= B.y - 1e-3, `${id} (${item.kind}) at ${lt}: ${b.min.toArray().map(v => v.toFixed(3))} → ${b.max.toArray().map(v => v.toFixed(3))}`);
    }
  }
});

test('once the cart has stopped, the pie, the cart and the flying favourite stay inside BOX.top', () => {
  for (const u of USER_IDS) {
    const { pal, s } = scene(u), top = buildTop({ categories: s.categories, item: s.top.item, pal });
    for (let lt = CART_AT.roll[1]; lt <= 3; lt += 0.01) { top.pose(lt); within(seen(top.root), 'top', `${u} at ${lt.toFixed(2)}`); }
  }
});

// ── title / end：奖牌、转台 ──

test('the medal falls from DROP, lands at EV.medal, bounces BOUNCE high and then stands still', () => {
  assert.equal(heightAt(0), DROP); assert.equal(heightAt(EV.medal), 0);
  for (const t of CONTACTS) assert.ok(Math.abs(heightAt(t)) < 1e-12);
  BOUNCE.forEach((h, i) => assert.ok(Math.abs(heightAt((CONTACTS[i] + CONTACTS[i + 1]) / 2) - h) < 1e-9));
  let prev = heightAt(0);
  for (let t = 0.001; t < 1.5; t += 0.001) { const y = heightAt(t); assert.ok(y >= 0 && Math.abs(y - prev) < 0.02, `t ${t}`); prev = y; }
  assert.equal(heightAt(CONTACTS.at(-1) + 0.01), 0);
});

test('sparkles twinkle only after the landing and are gone by the end of title; the settled and resting medal stays in BOX.medal', () => {
  for (const u of USER_IDS) {
    const medal = buildMedal({ pal: USERS[u].palette }), [model, sparks] = medal.root.children, m = new THREE.Matrix4(), sc = new THREE.Vector3();
    const lit = () => { let n = 0; for (let i = 0; i < SPARKLE.n; i++) { sparks.getMatrixAt(i, m); sc.setFromMatrixScale(m); if (sc.x > 1e-4) n++; } return n; };
    medal.drop(SPARKLE.at[0] - 0.01, [0, 0, 1]); assert.equal(lit(), 0);
    medal.drop(SPARKLE.at[1] + SPARKLE.life + 0.01, [0, 0, 1]); assert.equal(lit(), 0);
    let seenAny = 0; for (let t = SPARKLE.at[0]; t < 1.5; t += 0.05) { medal.drop(t, [0, 0, 1]); seenAny = Math.max(seenAny, lit()); }
    assert.ok(seenAny > 0, u);
    // 弹起的两下（0.14 秒）绶带顶会冒出盒子 0.08，框取按停住的奖牌
    for (let t = CONTACTS.at(-1); t <= 2; t += 0.02) { medal.drop(t, [0, 0, 1]); within(seen(model), 'medal', `${u} title at ${t.toFixed(2)}`); }
    for (let t = 0; t <= 3.4; t += 0.05) { medal.rest(t); within(seen(model), 'medal', `${u} end at ${t.toFixed(2)}`); assert.equal(lit(), 0); }
  }
});

test('the 11.11 pick turns on the stand and stays in BOX.product, for every item', () => {
  for (const id of Object.keys(ITEMS)) {
    const st = buildStand({ item: id, pal: USERS.gamer.palette });
    st.pose(0); assert.equal(st.product.rotation.y, STAND.yaw);
    for (let t = 0; t <= 3.4; t += 0.1) { st.pose(t); within(seen(st.root), 'product', `${id} at ${t.toFixed(1)}`); }
  }
  for (const u of USER_IDS) assert.ok(ITEMS[storyOf(u).pick], u);
});

// ── 商品模型 ──

test('every product kind stands on the floor, 0.6–0.9 tall and at most 0.85 wide; products, the medal and the stand face outward', () => {
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3(), o = new THREE.Vector3();
  const parts = KINDS.map(kind => {
    const item = Object.values(ITEMS).find(i => i.kind === kind), g = buildProduct(item), bb = new THREE.Box3().setFromObject(g, true);
    assert.ok(Math.abs(bb.min.y) < 1e-6 && bb.max.y >= 0.6 && bb.max.y <= 0.9 && bb.max.x - bb.min.x <= 0.85, `${kind}: ${bb.min.toArray()} → ${bb.max.toArray()}`);
    return [kind, g];
  });
  parts.push(['medal', buildMedalModel(USERS.coffee.palette).root], ['stand', buildStand({ item: 'cf-beans', pal: USERS.coffee.palette }).root]);
  for (const [kind, g] of parts) {
    g.updateMatrixWorld(true);
    const mid = new THREE.Box3().setFromObject(g, true).getCenter(new THREE.Vector3()).y;
    g.children.forEach((m, k) => {
      if (!m.isMesh) return;
      const geo = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry, P = geo.attributes.position, mb = new THREE.Box3().setFromBufferAttribute(P);
      // 从部件自身的竖轴往外看（圆的、方的外壳和标签都绕着它），按面积加权的"朝外"要是正的；
      // 平放的片（立袋的底）没有侧面，就看它朝上还是朝下，要背着整件东西的中间
      const flat = mb.max.y - mb.min.y < 1e-6, away = Math.sign(mb.min.y + m.position.y - mid);
      let out = 0;
      for (let i = 0; i < P.count; i += 3) {
        a.fromBufferAttribute(P, i); b.fromBufferAttribute(P, i + 1); c.fromBufferAttribute(P, i + 2);
        n.subVectors(c, b).cross(o.subVectors(a, b));                  // 三角形正面的法线（three 的逆时针为正面）
        const centre = new THREE.Vector3((mb.min.x + mb.max.x) / 2, (a.y + b.y + c.y) / 3, (mb.min.z + mb.max.z) / 2);
        out += flat ? away * n.y : n.dot(o.copy(a).add(b).add(c).divideScalar(3).sub(centre));
      }
      assert.ok(out > 0, `${kind}: part ${k} (${m.geometry.type}) faces inward`);
    });
  }
});
