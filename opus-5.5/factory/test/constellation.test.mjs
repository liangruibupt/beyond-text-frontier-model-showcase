import test from 'node:test';
import assert from 'node:assert/strict';
import {
  layoutNodes, layoutHubs, arcPath, arcSchedule, progressAt, activeArcs,
  lonLatToXY, cityCenters, inLandMask, CITIES_BJSHGZSZ,
} from '../engine/constellation.js';

const eqNodes = (a, b) => a.length === b.length && a.every((n, i) =>
  n.x === b[i].x && n.y === b[i].y && n.w === b[i].w);

test('layoutNodes is deterministic and seed-sensitive', () => {
  const cfg = { seed: 42, count: 500, mode: 'spread', aspect: 16 / 9 };
  assert.ok(eqNodes(layoutNodes(cfg), layoutNodes(cfg)), 'same args → identical');
  assert.ok(!eqNodes(layoutNodes(cfg), layoutNodes({ ...cfg, seed: 43 })), 'seed must matter');
});

test('node count equals requested count and all in [0,1]', () => {
  for (const mode of ['spread', 'clusters', 'rings']) {
    const nodes = layoutNodes({ seed: 7, count: 777, mode });
    assert.equal(nodes.length, 777, mode);
    for (const n of nodes) {
      assert.ok(n.x >= 0 && n.x <= 1 && n.y >= 0 && n.y <= 1, `${mode} xy in range`);
      assert.ok(n.w > 0 && n.w <= 1, `${mode} w in (0,1]`);
    }
  }
});

test('clusters mode: every node sits near one of the cluster centres', () => {
  const C = 3;
  const nodes = layoutNodes({ seed: 11, count: 600, mode: 'clusters', clusters: C });
  // 用 k-means 的"每点最近中心距"间接验证：聚类后点到最近其它点应比均匀铺更密
  // 直接验证：团簇模式下 x 的方差应明显小于把它们当作单一均匀分布的 1/12
  const xs = nodes.map(n => n.x);
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  const varX = xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length;
  assert.ok(varX < 1 / 12, `clustered variance ${varX.toFixed(3)} should be < uniform 0.083`);
});

test('rings mode: nodes fall on an inner or outer ring, not the centre', () => {
  const nodes = layoutNodes({ seed: 5, count: 800, mode: 'rings', aspect: 1 });
  // 以画面中心 0.5,0.5 的半径分两簇：没有点落在很靠近中心处
  const nearCentre = nodes.filter(n => Math.hypot(n.x - 0.5, n.y - 0.5) < 0.08).length;
  assert.ok(nearCentre / nodes.length < 0.05, `few nodes near centre, got ${nearCentre}`);
});

test('layoutHubs is deterministic, returns k hubs, each in range', () => {
  const nodes = layoutNodes({ seed: 9, count: 300 });
  const a = layoutHubs({ seed: 9, nodes, k: 8 });
  const b = layoutHubs({ seed: 9, nodes, k: 8 });
  assert.equal(a.length, 8);
  assert.deepEqual(a, b, 'same args → identical hubs');
  for (const h of a) assert.ok(h.x >= 0 && h.x <= 1 && h.y >= 0 && h.y <= 1);
  // k 不超过节点数
  assert.equal(layoutHubs({ seed: 9, nodes: nodes.slice(0, 3), k: 8 }).length, 3);
});

test('arcPath hits its endpoints exactly at u=0 and u=1', () => {
  const from = { x: 0.1, y: 0.2 }, to = { x: 0.8, y: 0.7 };
  const p0 = arcPath(from, to, 0), p1 = arcPath(from, to, 1);
  assert.ok(Math.abs(p0.x - from.x) < 1e-9 && Math.abs(p0.y - from.y) < 1e-9, 'u=0 → from');
  assert.ok(Math.abs(p1.x - to.x) < 1e-9 && Math.abs(p1.y - to.y) < 1e-9, 'u=1 → to');
  // 中点被抬离弦（有拱高）
  const mid = arcPath(from, to, 0.5, 0.3, 1);
  const chordMidY = (from.y + to.y) / 2;
  assert.ok(mid.y !== chordMidY, 'midpoint lifted off the chord');
  // u 钳制：越界等于端点
  assert.deepEqual(arcPath(from, to, -1), p0);
  assert.deepEqual(arcPath(from, to, 2), p1);
});

test('arcSchedule is deterministic and respects reverse direction', () => {
  const base = { seed: 3, nodeCount: 300, hubCount: 8, n: 2000, t0: 0, t1: 3 };
  const a = arcSchedule(base), b = arcSchedule(base);
  assert.deepEqual(a.arcs, b.arcs, 'same args → identical schedule');
  assert.equal(a.arcs.length, 2000);
  for (const arc of a.arcs) {
    assert.ok(arc.from >= 0 && arc.from < 300);
    assert.ok(arc.to >= 0 && arc.to < 8);
    assert.ok(arc.launch >= 0 && arc.launch <= 3);
    assert.ok(arc.dur > 0);
  }
  const rev = arcSchedule({ ...base, reverse: true });
  for (const arc of rev.arcs) {
    assert.ok(arc.from >= 0 && arc.from < 8, 'reverse: from is a hub');
    assert.ok(arc.to >= 0 && arc.to < 300, 'reverse: to is a node');
  }
});

test('progressAt is a pure function of t: out-of-order == in-order', () => {
  const s = arcSchedule({ seed: 1, nodeCount: 100, hubCount: 6, n: 500, t0: 0, t1: 3 });
  const ts = [0, 0.3, 0.75, 1.5, 2.25, 3.0];
  // 顺序取样
  const inOrder = ts.map(t => s.arcs.map((_, i) => progressAt(s, i, t)));
  // 乱序取样同样的 (i,t) 对，结果必须一致
  const shuffled = [...ts].reverse();
  for (let k = 0; k < shuffled.length; k++) {
    const t = shuffled[k];
    const row = s.arcs.map((_, i) => progressAt(s, i, t));
    const refIdx = ts.indexOf(t);
    assert.deepEqual(row, inOrder[refIdx], `t=${t} out-of-order sample must match`);
  }
  // 边界：t 很早全 0，t 很晚全 1
  assert.ok(s.arcs.every((_, i) => progressAt(s, i, -5) === 0));
  assert.ok(s.arcs.every((_, i) => progressAt(s, i, 100) === 1));
});

test('activeArcs returns only in-flight arcs (0<u<1)', () => {
  const s = arcSchedule({ seed: 2, nodeCount: 50, hubCount: 4, n: 200, t0: 0, t1: 3 });
  const act = activeArcs(s, 1.0);
  for (const i of act) {
    const u = progressAt(s, i, 1.0);
    assert.ok(u > 0 && u < 1, `arc ${i} u=${u} must be in flight`);
  }
  assert.equal(activeArcs(s, -5).length, 0, 'none active before any launch');
});

test('module uses no forbidden randomness (no Math.random/Date.now/performance.now)', async () => {
  const src = await (await import('node:fs/promises')).readFile(
    new URL('../engine/constellation.js', import.meta.url), 'utf8');
  assert.ok(!/Math\.random\s*\(/.test(src), 'no Math.random()');
  assert.ok(!/Date\.now\s*\(/.test(src), 'no Date.now()');
  assert.ok(!/performance\.now\s*\(/.test(src), 'no performance.now()');
});

test('worldmap mode: every node lands inside the continent mask, deterministic', () => {
  const cfg = { seed: 21, count: 900, mode: 'worldmap' };
  const a = layoutNodes(cfg), b = layoutNodes(cfg);
  assert.ok(eqNodes(a, b), 'worldmap same args → identical');
  assert.equal(a.length, 900, 'worldmap reaches requested count');
  const scale = 1.35; // 默认 mapScale
  for (const n of a) {
    assert.ok(n.x >= 0 && n.x <= 1 && n.y >= 0 && n.y <= 1, 'xy in range');
    assert.ok(inLandMask(n.x, n.y, scale), `node (${n.x.toFixed(2)},${n.y.toFixed(2)}) must be on land`);
  }
  // 放大 mapScale 应让更多随机点落在陆地内（点阵更大/更满）→ 不同于默认布局
  assert.ok(!eqNodes(a, layoutNodes({ ...cfg, mapScale: 1.0 })), 'mapScale changes the layout');
});

test('clusters mode with external centers pins nodes near 北上广深', () => {
  const centers = cityCenters(16 / 9);
  assert.equal(centers.length, 4);
  assert.deepEqual(centers.map(c => c.name), ['北京', '上海', '广州', '深圳']);
  const nodes = layoutNodes({ seed: 13, count: 800, mode: 'clusters', centers, tightness: 0.08 });
  // 每个节点到其标注团簇中心的距离应很小（聚集到四城）
  for (const n of nodes) {
    const c = centers[n.c];
    assert.ok(Math.hypot(n.x - c.x, n.y - c.y) < 0.3, 'node sits near its city centre');
  }
  // 四城都被用到
  const used = new Set(nodes.map(n => n.c));
  assert.equal(used.size, 4, 'all four cities populated');
});

test('lonLatToXY and cityCenters are deterministic and preserve relative city positions', () => {
  // 等距柱状：北京(lat 39.9)在上海(lat 31.2)之上 → y 更小
  const bj = lonLatToXY(116.41, 39.90);
  const sh = lonLatToXY(121.47, 31.23);
  assert.ok(bj.y < sh.y, '北京在上海之上 (y smaller)');
  assert.ok(sh.x > bj.x, '上海在北京之东 (x larger)');
  const c = cityCenters();
  const bjC = c.find(x => x.name === '北京'), szC = c.find(x => x.name === '深圳');
  assert.ok(bjC.y < szC.y, 'mapped 北京 above 深圳');
  assert.deepEqual(cityCenters(), cityCenters(), 'cityCenters deterministic');
  assert.equal(CITIES_BJSHGZSZ.length, 4);
});
