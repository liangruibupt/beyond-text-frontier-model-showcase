import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { USERS, USER_IDS } from '../users.js';
import { CATALOG, ITEMS, CATS, KINDS } from '../catalog.js';
import { generate, format, dataFile, YEAR } from '../data/gen.mjs';
import { statsOf, daysInYear } from '../stats.js';

const orders = u => JSON.parse(fs.readFileSync(dataFile(u), 'utf8'));

test('the committed order files are exactly what the generator makes', () => {
  for (const u of USER_IDS) assert.equal(fs.readFileSync(dataFile(u), 'utf8'), format(generate(u)), `${u}: run node 04-year-review/data/gen.mjs`);
});

test('orders are well formed: one year, sorted, unique ids, catalogue items, prices paid', () => {
  for (const u of USER_IDS) {
    const os = orders(u), ids = new Set();
    os.forEach((o, i) => {
      assert.match(o.at, /^2026-\d\d-\d\dT\d\d:\d\d$/);
      assert.ok(i === 0 || os[i - 1].at <= o.at, `${u}: ${o.id} out of order`);
      assert.ok(!ids.has(o.id), `${u}: duplicate id ${o.id}`); ids.add(o.id);
      const it = ITEMS[o.item];
      assert.ok([1, 2].includes(o.qty));
      assert.ok([it.price.CNY, it.deal.CNY].map(p => p * o.qty).includes(o.paid), `${u}: ${o.id} paid ${o.paid}`);
    });
  }
});

test('the catalogue: every item has names, a known kind, three colours, a deal below its price', () => {
  for (const [id, it] of Object.entries(ITEMS)) {
    assert.ok(CATS[it.cat], id);
    assert.ok(it.name.zh && it.name.en, id);
    assert.ok(KINDS.includes(it.kind), id);
    assert.equal(it.colors.length, 3, id);
    for (const c of ['CNY', 'USD']) assert.ok(Number.isInteger(it.deal[c]) && it.deal[c] > 0 && it.deal[c] < it.price[c], `${id} ${c}`);
  }
});

test('each customer\'s year tells the designed story', () => {
  const S = Object.fromEntries(USER_IDS.map(u => [u, statsOf(orders(u), CATALOG)]));
  const c = S.coffee;
  assert.equal(c.orders, 146);
  assert.deepEqual(c.busiest, { month: 11, orders: 38 });
  assert.deepEqual(c.top, { category: 'coffee', item: 'cf-beans', count: 13, repeat: 12 });
  assert.ok(c.earlyBird / c.orders > 0.4, 'coffee orders early');
  assert.equal(c.biggestDay.date, '2026-11-11');

  assert.equal(S.baby.busiest.month, 3); assert.equal(S.baby.top.item, 'bb-diapers');
  assert.ok(S.baby.lateNight / S.baby.orders > 0.3, 'baby orders at night');
  assert.equal(S.camp.busiest.month, 5); assert.equal(S.camp.top.item, 'od-gas');
  assert.ok(S.camp.weekendShare > 0.6, 'camp orders at weekends');
  assert.equal(S.gamer.busiest.month, 11); assert.equal(S.gamer.top.item, 'dr-energy');
  assert.ok(S.gamer.lateNight / S.gamer.orders > 0.5, 'gamer orders after midnight');

  for (const [u, s] of Object.entries(S)) {
    assert.equal(s.year, YEAR);
    assert.equal(s.orders, USERS[u].gen.total);
    assert.deepEqual(s.months, USERS[u].gen.months);
    // "最爱"要站得住：最大的品类是唯一最大的，最爱的那件比其他任何一件都买得多，busiest 也是唯一最多的月
    assert.ok(s.categories[0].orders > s.categories[1].orders, `${u}: top category is tied`);
    const counts = Object.values(USERS[u].gen.items).sort((a, b) => b - a);
    assert.equal(counts[0], s.top.count); assert.ok(counts[1] < counts[0], `${u}: favourite item is tied`);
    assert.equal(s.months.filter(n => n === s.busiest.orders).length, 1, `${u}: busiest month is tied`);
    assert.ok(Math.abs(s.categories.reduce((a, x) => a + x.share, 0) - 1) < 1e-3);
    assert.ok(s.days.every(d => d >= 0 && d < daysInYear(YEAR)));
  }
});

test('statsOf on a hand-made year: boundaries and ties', () => {
  const cat = { cats: { a: {}, b: {} }, items: { x: { cat: 'a' }, y: { cat: 'b' }, z: { cat: 'b' } } };
  const o = (at, item, paid = 10) => ({ id: at, at, item, qty: 1, paid });
  const s = statsOf([
    o('2026-01-31T04:59', 'x'), o('2026-02-01T05:00', 'y'), o('2026-02-02T08:59', 'z'),   // 1 月 31 日到 2 月 2 日连着三天
    o('2026-01-10T09:00', 'y'), o('2026-12-31T23:59', 'z', 30),                             // 12 月 31 日是周四
  ], cat);
  assert.equal(s.orders, 5);
  assert.deepEqual(s.days, [9, 30, 31, 32, 364]);
  assert.deepEqual(s.busiest, { month: 1, orders: 2 }, 'January and February tie; the earlier month wins');
  assert.deepEqual(s.categories.map(c => [c.id, c.orders, c.share]), [['b', 4, 0.8], ['a', 1, 0.2]]);
  assert.deepEqual(s.top, { category: 'b', item: 'y', count: 2, repeat: 1 }, 'y and z tie; the catalogue order wins');
  assert.equal(s.lateNight, 1); assert.equal(s.earlyBird, 2);
  assert.equal(s.weekendShare, 0.6, '1 月 10 日、1 月 31 日是周六，2 月 1 日是周日');
  assert.equal(daysInYear(2026), 365); assert.equal(daysInYear(2028), 366);
  assert.deepEqual(s.longestStreak, { days: 3, from: '2026-01-31' });
  assert.equal(s.spend, 70);
  assert.deepEqual(s.firstOrder, { at: '2026-01-10T09:00', item: 'y' });
  assert.deepEqual(s.biggestDay, { date: '2026-01-10', orders: 1 });
  assert.throws(() => statsOf([o('2026-01-01T00:00', 'x'), o('2027-01-01T00:00', 'x')], cat), /more than one year/);
  assert.throws(() => statsOf([o('2026-01-01T00:00', 'q')], cat), /not in the catalogue/);
});
